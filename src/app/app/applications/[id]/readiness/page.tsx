import Link from "next/link";
import { appPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { computeReadiness, GROUP_LABEL } from "@/lib/domain/readiness";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { ApproveRevision } from "@/components/client/approve";
import { aiConsistencyAction, approveRevisionAction } from "../../../../actions/app";
import { ActionButton } from "@/components/client/action-button";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export default async function ReadinessPage(props: PageProps<"/app/applications/[id]/readiness">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const s = await buildSnapshot(id);
  const r = computeReadiness(s);
  const lastAi = await db.readinessCheck.findFirst({ where: { applicationId: id }, orderBy: { createdAt: "desc" } });
  const aiIssues = ((lastAi?.result as { aiIssues?: { severity: string; message: string; sectionKey: string | null }[] } | null)?.aiIssues) ?? null;
  const link = (l: string) => (l.startsWith("/") ? l : `/app/applications/${id}/${l}`);
  return (
    <div className="space-y-6">
      <PageHeader title="تحقق من جاهزية الطلب" description="الفحص يفصل بين أهلية الجمعية وملاءمة المشروع واكتمال الطلب، ويبقي العوائق ظاهرة حتى عند ارتفاع نسبة الاكتمال." />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm text-muted">الحالة</div>
            <div className={`text-2xl font-bold ${r.ready ? "text-ok-700" : "text-warn-700"}`}>{r.ready ? "جاهز للتقديم" : "مسودة — توجد عوائق"}</div>
          </div>
          <div className="min-w-60 flex-1">
            <div className="mb-1 flex justify-between text-sm"><span>اكتمال المتطلبات المعروفة</span><span className="tabular">{r.completionPct}%</span></div>
            <div className="h-3 rounded-full bg-[#efece4]" role="progressbar" aria-valuenow={r.completionPct} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة الاكتمال"><div className="h-3 rounded-full bg-brand-600" style={{ width: `${r.completionPct}%` }} /></div>
            <p className="mt-1 text-xs text-muted">{r.formula}</p>
          </div>
        </div>
      </Card>
      {r.blockers.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-bold text-danger-700">العوائق ({r.blockers.length})</h2>
          <ul className="divide-y divide-line">
            {r.blockers.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                <div><Badge tone="danger">{GROUP_LABEL[b.group]}</Badge> <strong>{b.label}</strong> — {b.message}</div>
                <Link href={link(b.link)} className="text-brand-700 underline">معالجة</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {r.warnings.length > 0 && (
        <Card>
          <h2 className="mb-3 text-lg font-bold text-warn-700">تنبيهات ({r.warnings.length})</h2>
          <ul className="divide-y divide-line">
            {r.warnings.map((b) => (
              <li key={b.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
                <div><Badge tone="warn">{GROUP_LABEL[b.group]}</Badge> <strong>{b.label}</strong> — {b.message}</div>
                <Link href={link(b.link)} className="text-brand-700 underline">عرض</Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-900">فحص إضافي بالمساعد</h2>
          {ctx.canEdit && <ActionButton size="sm" variant="secondary" label="افحص الاتساق بالمساعد" pendingLabel="جارٍ الفحص…" action={aiConsistencyAction.bind(null, id)} />}
        </div>
        <p className="mt-1 text-xs text-muted">ملاحظات غير ملزمة للتحقق منها (مثل ادعاءات بلا مصدر أو تناقضات نصية). لا تغيّر حالة الجاهزية؛ العوائق أعلاه تُحسب برمجيًا.</p>
        {aiIssues && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-muted">آخر فحص: {formatDateTime(lastAi!.createdAt)}</div>
            {aiIssues.length === 0 ? <p className="text-sm text-ok-700">لم يجد المساعد ملاحظات إضافية.</p> : (
              <ul className="space-y-1 text-sm">{aiIssues.map((i, n) => <li key={n}><Badge tone={i.severity === "blocker" ? "danger" : "warn"}>{i.severity === "blocker" ? "مهم" : "تنبيه"}</Badge> {i.message}</li>)}</ul>
            )}
          </div>
        )}
      </Card>
      <Card>
        <h2 className="mb-2 text-lg font-bold text-brand-900">المرفقات</h2>
        <ul className="space-y-1 text-sm">
          {s.requirements.filter((x) => x.category === "DOCUMENT").map((x) => (
            <li key={x.id} className="flex flex-wrap gap-2"><Badge tone={x.evaluation.result === "MET" ? "ok" : x.evaluation.result === "NOT_MET" ? "danger" : "warn"}>{x.evaluation.result === "MET" ? "مرفق" : "ناقص"}</Badge>{x.text} — <span className="text-muted">{x.evaluation.evidence}</span></li>
          ))}
        </ul>
      </Card>
      {ctx.canEdit && (
        <Card>
          <h2 className="mb-2 text-lg font-bold text-brand-900">اعتماد نسخة</h2>
          <p className="mb-3 text-sm text-muted">الاعتماد يحفظ لقطة ثابتة من الطلب بكل أقسامه وميزانيته وإجاباته. كل المخرجات تُنشأ من نسخة معتمدة محددة، والتعديلات اللاحقة لا تغيّرها.</p>
          <ApproveRevision approve={approveRevisionAction.bind(null, id)} ready={r.ready} blockers={r.blockers.length} />
          <div className="mt-4"><LinkButton href={`/app/applications/${id}/export`} variant="secondary">إلى المعاينة والتصدير</LinkButton></div>
        </Card>
      )}
    </div>
  );
}
