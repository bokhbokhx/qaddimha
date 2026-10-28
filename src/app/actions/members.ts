"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrg } from "@/lib/auth/guard";
import { run } from "@/lib/action-result";
import { appBaseUrl, mailer } from "@/lib/mailer";
import * as M from "@/lib/services/members";

const Role = z.enum(["OWNER", "EDITOR", "VIEWER"]);

/** الرابط يُعاد للمالك ليشاركه بنفسه — لا يوجد مزود بريد مفعّل */
export async function inviteMemberAction(email: string, role: string) {
  return run(async () => {
    const ctx = await requireOrg("OWNER");
    const e = z.string().trim().toLowerCase().email("بريد غير صالح").parse(email);
    const { token } = await M.createInvitation({ organizationId: ctx.orgId, invitedById: ctx.user.id, email: e, role: Role.parse(role) });
    const link = `${await appBaseUrl()}/invite/${token}`;
    await mailer.send({ to: e, subject: `دعوة للانضمام إلى ${ctx.organization.displayName} على قدمها`, text: `للانضمام افتح الرابط (صالح 7 أيام): ${link}` });
    revalidatePath("/app/organization/members");
    return { link };
  });
}

export async function revokeInvitationAction(invitationId: string) {
  return run(async () => {
    const ctx = await requireOrg("OWNER");
    await M.revokeInvitation(ctx.orgId, invitationId, ctx.user.id);
    revalidatePath("/app/organization/members");
  }, "أُلغيت الدعوة");
}

export async function changeRoleAction(membershipId: string, role: string) {
  return run(async () => {
    const ctx = await requireOrg("OWNER");
    await M.changeRole(ctx.orgId, membershipId, Role.parse(role), ctx.user.id);
    revalidatePath("/app/organization/members");
  }, "تم تغيير الدور");
}

export async function removeMemberAction(membershipId: string) {
  return run(async () => {
    const ctx = await requireOrg("OWNER");
    await M.removeMember(ctx.orgId, membershipId, ctx.user.id);
    revalidatePath("/app/organization/members");
  }, "أُزيل العضو");
}
