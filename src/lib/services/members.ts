import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { MemberRole } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

const INVITE_DAYS = 7;
export const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export class MemberError extends Error {}

export async function listMembers(organizationId: string) {
  const [members, invitations] = await Promise.all([
    db.membership.findMany({ where: { organizationId }, include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } }),
    db.invitation.findMany({ where: { organizationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  return { members, invitations };
}

/** ينشئ دعوة ويعيد الرمز مرة واحدة فقط (لا يُخزن إلا تجزئته) */
export async function createInvitation(args: { organizationId: string; invitedById: string; email: string; role: MemberRole }) {
  const email = args.email.trim().toLowerCase();
  const existingUser = await db.user.findUnique({ where: { email } });
  if (existingUser && (await db.membership.findUnique({ where: { userId_organizationId: { userId: existingUser.id, organizationId: args.organizationId } } })))
    throw new MemberError("هذا البريد عضو في الجمعية بالفعل");
  // دعوة واحدة فعالة لكل بريد
  await db.invitation.updateMany({ where: { organizationId: args.organizationId, email, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = randomBytes(24).toString("base64url");
  const inv = await db.invitation.create({
    data: { organizationId: args.organizationId, email, role: args.role, tokenHash: sha(token), invitedById: args.invitedById, expiresAt: new Date(Date.now() + INVITE_DAYS * 864e5) },
  });
  await audit({ organizationId: args.organizationId, userId: args.invitedById, action: "member.invite", targetType: "Invitation", targetId: inv.id });
  return { invitation: inv, token };
}

export async function revokeInvitation(organizationId: string, invitationId: string, actorId: string) {
  await db.invitation.updateMany({ where: { id: invitationId, organizationId, acceptedAt: null }, data: { revokedAt: new Date() } });
  await audit({ organizationId, userId: actorId, action: "member.invite_revoke", targetType: "Invitation", targetId: invitationId });
}

export async function findInvitation(token: string) {
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha(token) } });
  if (!inv || inv.revokedAt || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  const org = await db.organization.findUniqueOrThrow({ where: { id: inv.organizationId }, select: { displayName: true } });
  return { ...inv, organizationName: org.displayName };
}

/** قبول الدعوة: يجب أن يطابق بريد الحساب بريد الدعوة */
export async function acceptInvitation(token: string, userId: string) {
  const inv = await findInvitation(token);
  if (!inv) throw new MemberError("الدعوة غير صالحة أو منتهية");
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.email !== inv.email) throw new MemberError(`هذه الدعوة موجهة إلى ${inv.email}. سجّل الدخول بذلك البريد.`);
  await db.$transaction([
    db.membership.upsert({
      where: { userId_organizationId: { userId, organizationId: inv.organizationId } },
      create: { userId, organizationId: inv.organizationId, role: inv.role },
      update: {},
    }),
    db.invitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } }),
  ]);
  await audit({ organizationId: inv.organizationId, userId, action: "member.join", targetType: "Invitation", targetId: inv.id });
  return inv.organizationId;
}

async function ownerCount(organizationId: string) {
  return db.membership.count({ where: { organizationId, role: "OWNER" } });
}

export async function changeRole(organizationId: string, membershipId: string, role: MemberRole, actorId: string) {
  const m = await db.membership.findFirst({ where: { id: membershipId, organizationId } });
  if (!m) throw new MemberError("العضو غير موجود");
  if (m.role === "OWNER" && role !== "OWNER" && (await ownerCount(organizationId)) <= 1) throw new MemberError("لا يمكن إزالة آخر مالك للجمعية");
  await db.membership.update({ where: { id: m.id }, data: { role } });
  await audit({ organizationId, userId: actorId, action: "member.role", targetType: "Membership", targetId: m.id });
}

export async function removeMember(organizationId: string, membershipId: string, actorId: string) {
  const m = await db.membership.findFirst({ where: { id: membershipId, organizationId } });
  if (!m) throw new MemberError("العضو غير موجود");
  if (m.role === "OWNER" && (await ownerCount(organizationId)) <= 1) throw new MemberError("لا يمكن إزالة آخر مالك للجمعية");
  await db.$transaction([
    db.membership.delete({ where: { id: m.id } }),
    // إنهاء الجلسات التي كانت الجمعية نشطة فيها
    db.session.updateMany({ where: { userId: m.userId, activeOrganizationId: organizationId }, data: { activeOrganizationId: null } }),
  ]);
  await audit({ organizationId, userId: actorId, action: "member.remove", targetType: "Membership", targetId: m.id });
}
