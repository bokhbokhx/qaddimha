import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { computeReadiness } from "@/lib/domain/readiness";
import { exportModel } from "@/lib/export/common";
import type { Snapshot } from "@/lib/domain/types";
import { formatDateTime } from "@/lib/format";
import { isPackagePaid } from "@/lib/services/payments";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { generateExportsAction } from "../../../../actions/app";

const FORMAT: Record<string, string> = { PDF: "وثيقة المشروع (PDF)", DOCX: "وثيقة المشروع (DOCX)", XLSX: "الميزانية (XLSX)", ANSWERS_TXT: "إجابات النموذج (نص)", CHECKLIST_PDF: "قائمة المتطلبات والمرفقات (PDF)", SUMMARY_PDF: "الملخص التنفيذي — صفحة واحدة (PDF)", ZIP: "حزمة التقديم كاملة (ZIP)" };

export default async function ExportPage(props: PageProps<"/app/applications/[id]/export">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const ctx = await appPageContext(id);
  const approved = await db.revision.findMany({ where: { applicationId: id, isApproved: true }, orderBy: { number: "desc" } });
  const paid = await isPackagePaid(id);
  const selected = approved.find((r) => r.id === sp.rev) ?? approved[0];
  const exports = await db.export.findMany({ where: { applicationId: id }, include: { revision: { select: { number: true } } }, orderBy: [{ createdAt: "desc" }] });
  const snap = selected ? (selected.snapshot as unknown as Snapshot) : null;
  const model = snap ? exportModel(snap) : null;
  const readiness = snap ? computeReadiness(snap) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="المعاينة والتصدير" description="كل المخرجات تُنشأ من نسخة معتمدة محددة، وتحمل رقم النسخة وتاريخ التصدير، وتُوسم «مسودة» إذا لم تكتمل الجاهزية." />
      {!approved.length ? (
        <EmptyState title="لا توجد نسخة معتمدة" action={<LinkButton href={`/app/applications/${id}/readiness`}>اذهب إلى فحص الجاهزية والاعتماد</LinkButton>}>اعتمد نسخة أولًا؛ التصدير لا يعتمد على الحالة المتغيرة.</EmptyState>
      ) : (
        <>
          <Card>
            <form className="flex flex-wrap items-end gap-2" action={`/app/applications/${id}/export`}>
              <div>
                <label htmlFor="rev" className="mb-1 block text-sm">النسخة المعتمدة</label>
                <select id="rev" name="rev" defaultValue={selected?.id} className="rounded-lg border border-line bg-white px-3 py-2">
                  {approved.map((r) => <option key={r.id} value={r.id}>النسخة {r.number} — {r.label} ({r.readyAtApproval ? "جاهزة" : "مسودة"})</option>)}
                </select>
              </div>
              <button type="submit" className="rounded-lg border border-line px-3 py-2 text-sm">عرض</button>
            </form>
            {readiness && (
              <div className="mt-4 space-y-2">
                {!readiness.ready && <Notice tone="warn">هذه النسخة بها {readiness.blockers.length} عوائق؛ ستُوسم المخرجات «مسودة» ولا تُسمّى جاهزة للتقديم.</Notice>}
                {readiness.ready && !paid && <Notice tone="gold">النسخة جاهزة. التصدير النهائي بلا وسم «مسودة» يتطلب شراء الحزمة؛ يمكنك الآن تنزيل معاينة موسومة. <a className="underline" href={`/app/applications/${id}/purchase`}>الشراء</a></Notice>}
                {readiness.ready && paid && <Notice tone="ok">النسخة جاهزة والحزمة مدفوعة: سيُنشأ تصدير نهائي.</Notice>}
                {ctx.canEdit && <ActionButton label={`إنشاء ملفات النسخة ${selected!.number}`} pendingLabel="جارٍ إنشاء الملفات (قد يستغرق دقيقة)…" action={generateExportsAction.bind(null, id, selected!.id)} />}
              </div>
            )}
          </Card>

          {exports.length > 0 && (
            <Card>
              <h2 className="mb-3 text-lg font-bold text-brand-900">الملفات المنشأة</h2>
              <ul className="divide-y divide-line text-sm">
                {exports.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div>
                      <a href={`/api/exports/${e.id}`} className="font-medium text-brand-800 underline">{FORMAT[e.format]}</a>
                      <div className="text-xs text-muted">النسخة {e.revision.number} · {formatDateTime(e.createdAt)}</div>
                    </div>
                    <Badge tone={e.isDraft ? "warn" : "ok"}>{e.isDraft ? "مسودة" : "نهائي"}</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {model && (
            <Card>
              <h2 className="mb-1 text-lg font-bold text-brand-900">معاينة النسخة {selected!.number}</h2>
              <p className="mb-4 text-xs text-muted">معاينة من اللقطة المعتمدة نفسها التي تُبنى منها الملفات.</p>
              <article className="space-y-4">
                {model.sections.map((s) => (
                  <section key={s.key}><h3 className="font-bold text-brand-900">{s.label}</h3><p className="whitespace-pre-line text-sm">{s.content || "— لم يُستكمل —"}</p></section>
                ))}
                <section>
                  <h3 className="font-bold text-brand-900">ملخص الميزانية</h3>
                  <table className="mt-1 text-sm"><tbody>{model.budget.map(([k, v]) => <tr key={k}><th className="pe-4 text-right font-normal text-muted">{k}</th><td className="tabular" dir="ltr">{v}</td></tr>)}</tbody></table>
                </section>
                <section>
                  <h3 className="font-bold text-brand-900">إجابات النموذج</h3>
                  {model.questions.map((q) => <div key={q.n} className="mt-2 text-sm"><div className="font-medium">{q.n}. {q.text} <span className="text-xs text-muted">({q.limit})</span></div><p className="whitespace-pre-line">{q.answer || "— لا توجد إجابة —"}</p></div>)}
                </section>
              </article>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
