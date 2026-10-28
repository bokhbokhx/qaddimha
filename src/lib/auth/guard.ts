import "server-only";
import { redirect } from "next/navigation";
import type { MemberRole } from "@prisma/client";
import { db } from "@/lib/db";
import { readSession } from "./session";

export class AuthError extends Error {
  constructor(public status: 401 | 403 | 404, message: string) {
    super(message);
  }
}

const RANK: Record<MemberRole, number> = { VIEWER: 1, EDITOR: 2, OWNER: 3 };

export function roleAtLeast(role: MemberRole, min: MemberRole) {
  return RANK[role] >= RANK[min];
}

export type SessionUser = { id: string; email: string; name: string; platformRole: "USER" | "EXPERT" | "ADMIN" };

/** للمكونات الخادمية: يعيد التوجيه إلى الدخول عند غياب الجلسة */
export async function requireUserPage(): Promise<{ user: SessionUser; sessionId: string; activeOrganizationId: string | null }> {
  const s = await readSession();
  if (!s) redirect("/login");
  return { user: s.user, sessionId: s.id, activeOrganizationId: s.activeOrganizationId };
}

export async function requireUser() {
  const s = await readSession();
  if (!s) throw new AuthError(401, "يلزم تسجيل الدخول");
  return { user: s.user as SessionUser, sessionId: s.id, activeOrganizationId: s.activeOrganizationId };
}

/**
 * الجمعية النشطة تُستخرج من الجلسة وتُتحقق عضويتها في كل مرة.
 * لا نقبل organizationId من العميل كدليل صلاحية.
 */
export async function requireOrg(min: MemberRole = "VIEWER") {
  const ctx = await requireUser();
  const membership = ctx.activeOrganizationId
    ? await db.membership.findUnique({
        where: { userId_organizationId: { userId: ctx.user.id, organizationId: ctx.activeOrganizationId } },
        include: { organization: true },
      })
    : await db.membership.findFirst({ where: { userId: ctx.user.id }, include: { organization: true } });
  if (!membership) throw new AuthError(403, "لا توجد جمعية مرتبطة بحسابك");
  if (!roleAtLeast(membership.role, min)) throw new AuthError(403, "صلاحيتك لا تسمح بهذا الإجراء");
  return { ...ctx, membership, organization: membership.organization, orgId: membership.organizationId };
}

/** يتحقق أن الطلب يتبع جمعية للمستخدم فيها عضوية بالدور المطلوب. 404 بدل 403 لعدم كشف الوجود. */
export async function requireApplication(applicationId: string, min: MemberRole = "VIEWER") {
  const ctx = await requireUser();
  const app = await db.application.findUnique({ where: { id: applicationId }, select: { id: true, organizationId: true } });
  if (!app) throw new AuthError(404, "الطلب غير موجود");
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: ctx.user.id, organizationId: app.organizationId } },
  });
  if (!membership) throw new AuthError(404, "الطلب غير موجود");
  if (!roleAtLeast(membership.role, min)) throw new AuthError(403, "صلاحيتك لا تسمح بهذا الإجراء");
  return { ...ctx, membership, orgId: app.organizationId, applicationId: app.id };
}

export async function requireDocument(documentId: string, min: MemberRole = "VIEWER") {
  const ctx = await requireUser();
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new AuthError(404, "المستند غير موجود");
  const membership = await db.membership.findUnique({
    where: { userId_organizationId: { userId: ctx.user.id, organizationId: doc.organizationId } },
  });
  if (!membership || !roleAtLeast(membership.role, min)) throw new AuthError(404, "المستند غير موجود");
  return { ...ctx, membership, doc, orgId: doc.organizationId };
}

/** صلاحية الخبير محددة بطلب مراجعة واحد مُسند إليه */
export async function requireExpertReview(reviewRequestId: string) {
  const ctx = await requireUser();
  if (ctx.user.platformRole !== "EXPERT") throw new AuthError(404, "غير موجود");
  const rr = await db.reviewRequest.findUnique({ where: { id: reviewRequestId } });
  if (!rr || rr.expertUserId !== ctx.user.id) throw new AuthError(404, "غير موجود");
  return { ...ctx, review: rr };
}

export async function requireAdmin() {
  const ctx = await requireUser();
  if (ctx.user.platformRole !== "ADMIN") throw new AuthError(404, "غير موجود");
  return ctx;
}
