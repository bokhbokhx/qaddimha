import Link from "next/link";
import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { computeReadiness } from "@/lib/domain/readiness";
import { STAGES } from "@/lib/catalog";
import { Badge, Card } from "@/components/ui";
import { KeyParams } from "@/components/client/key-params";
import { ActionButton } from "@/components/client/action-button";
import { updateKeyParamsAction, refreshProfileAction } from "../../../actions/app";
import { WorkspaceNav } from "./nav";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/applications/[id]">) {
  const { id } = await params;
  const ctx = await appPageContext(id);
  const snapshot = await buildSnapshot(id);
  const readiness = computeReadiness(snapshot);
  const [profile, proposals, lastApproved, lastReview] = await Promise.all([
    db.organizationProfile.findUnique({ where: { organizationId: ctx.app.organizationId } }),
    db.changeProposal.count({ where: { applicationId: id, status: "PENDING" } }),
    db.revision.findFirst({ where: { applicationId: id, isApproved: true }, orderBy: { number: "desc" } }),
    db.reviewRequest.findFirst({ where: { applicationId: id }, orderBy: { createdAt: "desc" }, include: { revision: true } }),
  ]);
  const profileOutdated = profile && snapshot.organization.profileVersion != null && profile.version > snapshot.organization.profileVersion;
  const stage = STAGES.find((s) => s.key === ctx.app.stage);
  const { snapshotHash } = await import("@/lib/services/snapshot");
  const currentHash = snapshotHash(snapshot);
  const changedSinceApproval = lastApproved && lastApproved.contentHash !== currentHash;
  const changedSinceReview = lastReview && lastReview.revision.contentHash !== currentHash;

  return (
    <div>
      <div className="mb-4 text-sm text-muted"><Link href="/app" className="hover:underline">الطلبات</Link> / {ctx.app.title}</div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">{ctx.app.title}</h1>
          <div className="text-muted">{ctx.app.opportunity.funderName} — {ctx.app.opportunity.title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">المرحلة: {stage?.label}</Badge>
          <Badge tone={readiness.ready ? "ok" : "warn"}>{readiness.ready ? "جاهز للتقديم" : `${readiness.blockers.length} عوائق`}</Badge>
          <Badge title={readiness.formula}>اكتمال المتطلبات المعروفة: {readiness.completionPct}%</Badge>
        </div>
      </div>

      <div className="mb-4 space-y-2">
        {profileOutdated && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn-50 p-3 text-sm text-warn-700">
            <span>تغيّر ملف الجمعية منذ أُخذت نسخته لهذا الطلب. الطلب ما زال يستخدم النسخة السابقة.</span>
            {ctx.canEdit && <ActionButton size="sm" variant="secondary" label="استخدم أحدث بيانات الجمعية" action={refreshProfileAction.bind(null, id)} />}
          </div>
        )}
        {proposals > 0 && (
          <div className="rounded-xl bg-warn-50 p-3 text-sm text-warn-700">
            توجد {proposals} مقترحات تعديل بانتظار موافقتك. <Link href={`/app/applications/${id}/changes`} className="font-bold underline">راجع قبل/بعد</Link>
          </div>
        )}
        {changedSinceApproval && (
          <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">تغيّر الطلب بعد آخر نسخة معتمدة (رقم {lastApproved!.number}). المخرجات تُنشأ من نسخة معتمدة؛ اعتمد نسخة جديدة لتضمين التعديلات.</div>
        )}
        {changedSinceReview && (
          <div className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">راجع الخبير النسخة رقم {lastReview!.revision.number}. التعديلات اللاحقة لم تتم مراجعتها.</div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <WorkspaceNav id={id} items={[...STAGES.map((s) => ({ path: s.path, label: s.label })), { path: "changes", label: `مقترحات التعديل${proposals ? ` (${proposals})` : ""}` }, { path: "revisions", label: "سجل الإصدارات" }, { path: "purchase", label: "الشراء" }, { path: "review", label: "مراجعة خبير" }]} />
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold text-brand-900">ملخص المشروع</h2>
            <KeyParams beneficiaryCount={ctx.app.beneficiaryCount} durationMonths={ctx.app.durationMonths} region={ctx.app.region} version={ctx.app.version} save={updateKeyParamsAction.bind(null, id)} canEdit={ctx.canEdit} />
            {ctx.app.ideaSummary && <p className="mt-3 line-clamp-5 text-xs text-muted">{ctx.app.ideaSummary}</p>}
          </Card>
          <Card className="p-4">
            <h2 className="mb-2 text-sm font-bold text-brand-900">يحتاج إجراء</h2>
            {readiness.blockers.length === 0 ? (
              <p className="text-sm text-ok-700">لا توجد عوائق.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {readiness.blockers.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <Link href={b.link.startsWith("/") ? b.link : `/app/applications/${id}/${b.link}`} className="text-danger-700 hover:underline">• {b.label}</Link>
                  </li>
                ))}
                {readiness.blockers.length > 5 && <li><Link className="text-brand-700 underline" href={`/app/applications/${id}/readiness`}>كل العوائق ({readiness.blockers.length})</Link></li>}
              </ul>
            )}
          </Card>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
