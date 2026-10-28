"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, readSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/guard";
import { acceptInvitation, findInvitation } from "@/lib/services/members";
import { changePassword, createPasswordReset, PasswordError, resetPassword } from "@/lib/services/passwords";
import { appBaseUrl, mailer, showDevLinks } from "@/lib/mailer";

export type FormState = { error?: string; message?: string; devLink?: string } | undefined;

/** مسار عودة آمن بعد الدخول: داخلي فقط */
function safeNext(next: string) {
  return /^\/(app|invite)(\/|$)/.test(next) && !next.startsWith("//") ? next : "/app";
}

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

const SignupSchema = z.object({
  name: z.string().trim().min(2, "الاسم قصير").max(100),
  email: z.string().trim().toLowerCase().email("بريد غير صالح"),
  password: z.string().min(PASSWORD_MIN, `كلمة المرور ${PASSWORD_MIN} أحرف على الأقل`).max(200),
  orgName: z.string().trim().min(3, "اسم الجمعية قصير").max(200),
});

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`signup:${await clientKey()}`, 5, 15 * 60_000)) return { error: "محاولات كثيرة. حاول بعد قليل." };
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, orgName } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "يوجد حساب بهذا البريد. سجّل الدخول بدلًا من ذلك." };
  const user = await db.user.create({
    data: {
      name, email, passwordHash: await hashPassword(password),
      memberships: { create: { role: "OWNER", organization: { create: { displayName: orgName, profile: { create: {} } } } } },
    },
    include: { memberships: true },
  });
  await db.fact.create({
    data: { organizationId: user.memberships[0].organizationId, scope: "ORG_PROFILE", scopeRef: "org", key: "display_name", value: orgName, status: "CONFIRMED", sourceType: "USER", sourceLocator: "إدخال المستخدم عند التسجيل", confirmedById: user.id, confirmedAt: new Date() },
  });
  await audit({ organizationId: user.memberships[0].organizationId, userId: user.id, action: "user.signup" });
  await createSession(user.id);
  redirect("/app/organization?welcome=1");
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const key = await clientKey();
  const max = Number(process.env.LOGIN_RATE_LIMIT ?? 10);
  if (!rateLimit(`login:${key}`, max, 10 * 60_000) || !rateLimit(`login:${email}`, max, 10 * 60_000))
    return { error: "محاولات دخول كثيرة. انتظر عشر دقائق ثم حاول مجددًا." };
  const user = await db.user.findUnique({ where: { email } });
  // رسالة موحدة لا تكشف وجود الحساب
  if (!user || !(await verifyPassword(password, user.passwordHash))) return { error: "البريد أو كلمة المرور غير صحيحة" };
  await createSession(user.id);
  await audit({ userId: user.id, action: "user.login" });
  const next = String(form.get("next") ?? "");
  if (user.platformRole === "EXPERT") redirect("/expert");
  if (user.platformRole === "ADMIN") redirect("/ops");
  redirect(safeNext(next));
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function switchOrgAction(organizationId: string) {
  const s = await readSession();
  if (!s) redirect("/login");
  const m = await db.membership.findUnique({ where: { userId_organizationId: { userId: s.userId, organizationId } } });
  if (!m) return;
  await db.session.update({ where: { id: s.id }, data: { activeOrganizationId: organizationId } });
  redirect("/app");
}

// ===== الدعوات =====

export async function acceptInviteAction(token: string) {
  const ctx = await requireUser();
  let orgId: string;
  try {
    orgId = await acceptInvitation(token, ctx.user.id);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "تعذر قبول الدعوة" };
  }
  await db.session.update({ where: { id: ctx.sessionId }, data: { activeOrganizationId: orgId } });
  redirect("/app");
}

const InviteSignup = z.object({
  name: z.string().trim().min(2, "الاسم قصير").max(100),
  password: z.string().min(PASSWORD_MIN, `كلمة المرور ${PASSWORD_MIN} أحرف على الأقل`).max(200),
  token: z.string().min(10),
});

/** إنشاء حساب ببريد الدعوة والانضمام مباشرة — دون إنشاء جمعية جديدة */
export async function inviteSignupAction(_: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`signup:${await clientKey()}`, 5, 15 * 60_000)) return { error: "محاولات كثيرة. حاول بعد قليل." };
  const parsed = InviteSignup.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const inv = await findInvitation(parsed.data.token);
  if (!inv) return { error: "الدعوة غير صالحة أو منتهية" };
  if (await db.user.findUnique({ where: { email: inv.email } })) return { error: "يوجد حساب بهذا البريد. سجّل الدخول ثم اقبل الدعوة." };
  const user = await db.user.create({ data: { name: parsed.data.name, email: inv.email, passwordHash: await hashPassword(parsed.data.password) } });
  await acceptInvitation(parsed.data.token, user.id);
  await createSession(user.id);
  redirect("/app");
}

// ===== كلمة المرور =====

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  if (!rateLimit(`reset:${await clientKey()}`, 5, 15 * 60_000)) return { error: "محاولات كثيرة. حاول بعد قليل." };
  const r = await createPasswordReset(email);
  // الرسالة نفسها سواء وُجد الحساب أم لا
  const message = "إذا كان البريد مسجلًا فسيصله رابط لإعادة تعيين كلمة المرور صالح لمدة ساعة.";
  if (!r) return { message };
  const link = `${await appBaseUrl()}/reset-password/${r.token}`;
  await mailer.send({ to: r.email, subject: "إعادة تعيين كلمة المرور — قدمها", text: `الرابط صالح لمدة ساعة: ${link}` });
  return { message, devLink: showDevLinks() ? `/reset-password/${r.token}` : undefined };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const pw = String(form.get("password") ?? "");
  if (pw !== String(form.get("confirm") ?? "")) return { error: "كلمتا المرور غير متطابقتين" };
  try {
    await resetPassword(String(form.get("token") ?? ""), pw);
  } catch (e) {
    return { error: e instanceof PasswordError ? e.message : "تعذر إعادة التعيين" };
  }
  redirect("/login?reset=1");
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireUser();
  const next = String(form.get("password") ?? "");
  if (next !== String(form.get("confirm") ?? "")) return { error: "كلمتا المرور غير متطابقتين" };
  try {
    await changePassword(ctx.user.id, ctx.sessionId, String(form.get("current") ?? ""), next);
  } catch (e) {
    return { error: e instanceof PasswordError ? e.message : "تعذر تغيير كلمة المرور" };
  }
  return { message: "تم تغيير كلمة المرور، وأُنهيت جلساتك على الأجهزة الأخرى." };
}

/** مستخدم بلا جمعية (أُزيل أو لم ينضم بعد) ينشئ جمعية جديدة */
export async function createOrganizationAction(_: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireUser();
  const name = String(form.get("orgName") ?? "").trim();
  if (name.length < 3 || name.length > 200) return { error: "اسم الجمعية بين 3 و200 حرف" };
  const org = await db.organization.create({
    data: { displayName: name, profile: { create: {} }, memberships: { create: { userId: ctx.user.id, role: "OWNER" } } },
  });
  await db.fact.create({ data: { organizationId: org.id, scope: "ORG_PROFILE", scopeRef: "org", key: "display_name", value: name, status: "CONFIRMED", sourceType: "USER", sourceLocator: "إدخال المستخدم", confirmedById: ctx.user.id, confirmedAt: new Date() } });
  await db.session.update({ where: { id: ctx.sessionId }, data: { activeOrganizationId: org.id } });
  redirect("/app/organization?welcome=1");
}
