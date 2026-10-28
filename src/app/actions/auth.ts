"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, readSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export type FormState = { error?: string } | undefined;

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
  redirect(next.startsWith("/app") ? next : "/app");
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
