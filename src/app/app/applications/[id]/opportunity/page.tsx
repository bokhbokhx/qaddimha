import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { formatDateTime } from "@/lib/format";
import { ACCEPTED_DOCS_LABEL } from "@/lib/extraction/files";
import { DOCUMENT_KIND_LABEL } from "@/lib/catalog";
import { isDemoAI } from "@/lib/env";
import { Badge, Card, LinkButton, Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { UploadForm } from "@/components/client/upload";
import { addGrantUpdateSampleAction, analyzeOpportunityDocAction } from "../../../../actions/app";
import { deleteDocumentAction } from "../../../../actions/org";

export default async function OpportunityPage(props: PageProps<"/app/applications/[id]/opportunity">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const ctx = await appPageContext(id);
  const opp = ctx.app.opportunity;
  const docs = await db.document.findMany({ where: { opportunityId: opp.id, organizationId: ctx.app.organizationId }, include: { extractions: { where: { target: "OPPORTUNITY" } } }, orderBy: { createdAt: "asc" } });
  const reqCount = await db.requirement.count({ where: { opportunityId: opp.id } });
  return (
    <div className="space-y-6">
      <PageHeader title="أضف فرصة التمويل" description="ارفع دليل المنحة ونموذج التقديم أو الصق نصهما. نستخرج الشروط والأسئلة مع مصدر كل معلومة." actions={reqCount > 0 && <LinkButton href={`/app/applications/${id}/extraction`}>راجع ما استخرجناه</LinkButton>} />
      {sp.created && <Notice tone="ok" title="أُنشئ الطلب">{opp.isDemo ? "رُفع الدليل التجريبي وحُلل. راجع البيانات المستخرجة قبل المتابعة." : "أضف الآن ملفات الفرصة لتحليلها."}</Notice>}
      <Card>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-muted">الجهة المانحة</dt><dd className="font-medium">{opp.funderName}</dd></div>
          <div><dt className="text-sm text-muted">الفرصة</dt><dd className="font-medium">{opp.title}</dd></div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted">الرابط المرجعي</dt>
            <dd>{opp.referenceUrl ? <><a href={opp.referenceUrl} target="_blank" rel="noopener noreferrer nofollow" className="ltr break-all text-brand-700 underline">{opp.referenceUrl}</a> <span className="text-xs text-muted">(مرجع فقط — لم تتم قراءة محتواه)</span></> : <span className="text-muted">—</span>}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h2 className="mb-3 font-bold text-brand-900">ملفات الفرصة</h2>
        {docs.length === 0 && <p className="mb-3 text-sm text-muted">لم تُرفع ملفات بعد.</p>}
        <ul className="mb-4 divide-y divide-line">
          {docs.map((d) => {
            const analyzed = d.extractions.some((e) => e.status === "APPLIED");
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <a href={`/api/documents/${d.id}`} className="font-medium text-brand-800 underline">{d.label ?? d.filename}</a>
                  <div className="text-xs text-muted">{DOCUMENT_KIND_LABEL[d.kind]} · {formatDateTime(d.createdAt)}</div>
                  {d.extractionError && <p className="mt-1 max-w-xl text-xs text-danger-700">{d.extractionError}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {analyzed ? <Badge tone="ok">حُلل</Badge> : d.status === "EXTRACTED" ? (
                    ctx.canEdit && <ActionButton size="sm" label="حلّل المستند" pendingLabel="جارٍ التحليل…" action={analyzeOpportunityDocAction.bind(null, id, d.id)} />
                  ) : <Badge tone="danger">تعذر استخراج النص</Badge>}
                  {ctx.canEdit && <ActionButton size="sm" variant="danger" label="حذف" confirm="حذف الملف ونصوصه المستخرجة؟ الشروط والأسئلة المستخرجة منه تبقى حتى تحذفها." action={deleteDocumentAction.bind(null, d.id)} />}
                </div>
              </li>
            );
          })}
        </ul>
        {isDemoAI() && !opp.isDemo && (
          <div className="mb-4"><Notice tone="gold" title="الوضع التجريبي">تحليل ملفات فرصة حقيقية يحتاج تفعيل مزود الذكاء الاصطناعي. يمكنك رفع الملفات الآن (يُستخرج نصها فعليًا)، وإدخال الشروط والأسئلة يدويًا في صفحة المراجعة.</Notice></div>
        )}
        {ctx.canEdit && <UploadForm kinds={["GRANT_GUIDE", "GRANT_FORM"]} applicationId={id} hint={ACCEPTED_DOCS_LABEL} />}
        {opp.isDemo && ctx.canEdit && !docs.some((d) => d.filename.includes("update")) && (
          <div className="mt-4 rounded-xl bg-gold-100 p-3 text-sm">
            <p className="mb-2 text-gold-600">لتجربة حالة تعارض بين مصدرين: أضف تعميمًا تجريبيًا يذكر موعدًا مختلفًا لآخر موعد للتقديم.</p>
            <ActionButton size="sm" variant="secondary" label="أضف التعميم التجريبي" action={addGrantUpdateSampleAction.bind(null, id)} />
          </div>
        )}
      </Card>
    </div>
  );
}
