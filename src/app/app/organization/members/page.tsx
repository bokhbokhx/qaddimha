import Link from "next/link";
import { orgPageContext } from "@/lib/page-context";
import { listMembers } from "@/lib/services/members";
import { formatDate } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { InviteForm, RoleSelect } from "@/components/client/members";
import { changeRoleAction, inviteMemberAction, removeMemberAction, revokeInvitationAction } from "../../../actions/members";

export const metadata = { title: "أعضاء الجمعية" };
const ROLE: Record<string, string> = { OWNER: "مالك", EDITOR: "محرر", VIEWER: "قارئ" };

export default async function MembersPage() {
  const ctx = await orgPageContext();
  const { members, invitations } = await listMembers(ctx.orgId);
  return (
    <div className="space-y-6">
      <div className="text-sm text-muted"><Link href="/app/organization" className="hover:underline">ملف الجمعية</Link> / الأعضاء</div>
      <PageHeader title="أعضاء الجمعية" description="المالك يدير الأعضاء والشراء، والمحرر يعدّل الملف والطلبات، والقارئ يطّلع فقط." />
      {ctx.isOwner && (
        <Card>
          <h2 className="mb-3 font-bold text-brand-900">دعوة عضو</h2>
          <InviteForm invite={inviteMemberAction} />
          <p className="mt-2 text-xs text-muted">لا يوجد مزود بريد مفعّل في هذه النسخة، لذلك تشارك رابط الدعوة بنفسك. يجب أن يدخل العضو بنفس البريد المدعو.</p>
        </Card>
      )}
      <Card>
        <h2 className="mb-3 font-bold text-brand-900">الأعضاء ({members.length})</h2>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div>
                <div className="font-medium">{m.user.name} {m.userId === ctx.user.id && <Badge tone="brand">أنت</Badge>}</div>
                <div dir="ltr" className="text-right text-xs text-muted">{m.user.email}</div>
              </div>
              {ctx.isOwner ? (
                <div className="flex flex-wrap items-center gap-2">
                  <RoleSelect role={m.role} change={changeRoleAction.bind(null, m.id)} />
                  {m.userId !== ctx.user.id && <ActionButton size="sm" variant="danger" label="إزالة" confirm={`إزالة ${m.user.name} من الجمعية؟`} action={removeMemberAction.bind(null, m.id)} />}
                </div>
              ) : <Badge>{ROLE[m.role]}</Badge>}
            </li>
          ))}
        </ul>
      </Card>
      {ctx.isOwner && invitations.length > 0 && (
        <Card>
          <h2 className="mb-3 font-bold text-brand-900">دعوات معلقة</h2>
          <ul className="divide-y divide-line">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div><span dir="ltr">{i.email}</span> · {ROLE[i.role]} <span className="text-xs text-muted">· تنتهي {formatDate(i.expiresAt)}</span></div>
                <ActionButton size="sm" variant="ghost" label="إلغاء الدعوة" action={revokeInvitationAction.bind(null, i.id)} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
