import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ReviewStatus } from "@/components/status";
import { ActionButton } from "@/components/client/action-button";
import { assignExpertAction, } from "../actions/commerce";
import { logoutAction } from "../actions/auth";

export const metadata = { title: "تشغيل المراجعات" };

/** تشغيل يدوي لخدمة المراجعة: إسناد الطلبات للخبراء. لا يعرض محتوى الطلبات. */
export default async function Ops() {
  const { user } = await requireUserPage();
  if (user.platformRole !== "ADMIN") redirect("/app");
  const [reqs, experts] = await Promise.all([
    db.reviewRequest.findMany({ include: { application: { select: { title: true, organization: { select: { displayName: true } } } }, revision: { select: { number: true } } }, orderBy: { createdAt: "desc" } }),
    db.user.findMany({ where: { platformRole: "EXPERT" }, select: { id: true, name: true } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex justify-between"><Link href="/ops" className="text-xl font-bold text-brand-900">قدمها — التشغيل</Link><form action={logoutAction}><button className="text-sm text-brand-700">خروج</button></form></div>
      <PageHeader title="طلبات مراجعة الخبراء" description="إسناد يدوي. المشغل لا يرى محتوى الطلبات." />
      {!reqs.length ? <EmptyState title="لا توجد طلبات" /> : reqs.map((r) => (
        <Card key={r.id} className="mb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="font-bold">{r.application.organization.displayName} — {r.application.title}</div><div className="text-xs text-muted">النسخة {r.revision.number} · {formatDateTime(r.createdAt)}</div></div>
            <ReviewStatus status={r.status} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {experts.map((e) => <ActionButton key={e.id} size="sm" variant={r.expertUserId === e.id ? "primary" : "secondary"} label={r.expertUserId === e.id ? `مسند إلى ${e.name}` : `إسناد إلى ${e.name}`} disabled={r.expertUserId === e.id} action={assignExpertAction.bind(null, r.id, e.id)} />)}
          </div>
        </Card>
      ))}
    </div>
  );
}
