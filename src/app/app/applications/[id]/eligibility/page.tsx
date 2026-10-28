import Link from "next/link";
import { appPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { CATEGORY_LABEL } from "@/lib/catalog";
import { USER_DECIDABLE_RULES } from "@/lib/domain/requirements";
import { Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { AssessmentBadge } from "@/components/status";
import { AssessmentForm } from "@/components/client/opp-forms";
import { UploadForm } from "@/components/client/upload";
import { setAssessmentAction } from "../../../../actions/app";

const GROUPS = [
  { key: "ORG_ELIGIBILITY", title: "أهلية الجمعية" },
  { key: "PROJECT_FIT", title: "ملاءمة فكرة المشروع" },
  { key: "DOCUMENT", title: "اكتمال الطلب: المستندات" },
  { key: "BUDGET", title: "اكتمال الطلب: الاشتراطات المالية" },
  { key: "SUBMISSION", title: "اكتمال الطلب: التقديم" },
];

export default async function Eligibility(props: PageProps<"/app/applications/[id]/eligibility">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const s = await buildSnapshot(id);
  const mandatory = s.requirements.filter((r) => r.mandatory);
  const counts = { met: mandatory.filter((r) => r.evaluation.result === "MET").length, not: mandatory.filter((r) => r.evaluation.result === "NOT_MET").length, nv: mandatory.filter((r) => r.evaluation.result === "NEEDS_VERIFICATION").length };

  return (
    <div className="space-y-6">
      <PageHeader title="الأهلية والمتطلبات" description="فحص أولي قبل الشراء. لكل شرط: نصه، مصدره، دليل الجمعية، النتيجة، والإجراء التالي. الشرط المجهول لا يُعد مستوفى." />
      {!s.requirements.length ? (
        <EmptyState title="لا توجد شروط بعد" action={<LinkButton href={`/app/applications/${id}/extraction`} variant="secondary">أضف الشروط</LinkButton>}>حلّل ملفات الفرصة أو أضف الشروط يدويًا.</EmptyState>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4"><div className="text-sm text-muted">مستوفى (إلزامي)</div><div className="text-2xl font-bold text-ok-700 tabular">{counts.met}</div></Card>
            <Card className="p-4"><div className="text-sm text-muted">غير مستوفى</div><div className="text-2xl font-bold text-danger-700 tabular">{counts.not}</div></Card>
            <Card className="p-4"><div className="text-sm text-muted">يحتاج تحققًا</div><div className="text-2xl font-bold text-warn-700 tabular">{counts.nv}</div></Card>
          </div>
          {counts.not + counts.nv > 0 && <Notice tone="warn">يمكنك متابعة الاستكشاف والمسودة، لكن لن تُسمّى الحزمة «جاهزة للتقديم» ما دام شرط إلزامي غير محسوم.</Notice>}
          {GROUPS.map((g) => {
            const items = s.requirements.filter((r) => r.category === g.key);
            if (!items.length) return null;
            return (
              <Card key={g.key}>
                <h2 className="mb-3 text-lg font-bold text-brand-900">{g.title}</h2>
                <ul className="divide-y divide-line">
                  {items.map((r) => (
                    <li key={r.id} className="py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium"><span className="me-2 text-muted">{r.code}</span>{r.text} {!r.mandatory && <span className="text-xs text-muted">(اختياري)</span>}</div>
                          <div className="mt-1 text-xs text-muted">المصدر: {r.sourceDocName ?? "إدخال المستخدم"}{r.sourceLocator && r.sourceDocName ? ` — ${r.sourceLocator}` : ""}</div>
                          {r.sourceExcerpt && <blockquote className="mt-1 border-s-2 border-gold-400 ps-2 text-xs text-muted">«{r.sourceExcerpt}»</blockquote>}
                        </div>
                        <AssessmentBadge result={r.evaluation.result} />
                      </div>
                      <dl className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
                        <div><dt className="inline text-muted">دليل الجمعية: </dt><dd className="inline">{r.evaluation.evidence || "—"}</dd> {r.evaluation.decidedBy === "USER" && <span className="text-xs text-muted">(قرارك)</span>}</div>
                        {r.evaluation.nextAction && <div><dt className="inline text-muted">الإجراء التالي: </dt><dd className="inline">{r.evaluation.nextAction}</dd></div>}
                      </dl>
                      {ctx.canEdit && USER_DECIDABLE_RULES.has(r.rule) && (r.rule === "MANUAL" || r.evaluation.result !== "MET" || r.userAssessment) && (
                        <AssessmentForm current={r.userAssessment?.result ?? null} evidence={r.userAssessment?.evidence ?? ""} save={setAssessmentAction.bind(null, id, r.id)} />
                      )}
                      {ctx.canEdit && r.rule === "DOCUMENT_PRESENT" && r.evaluation.result !== "MET" && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-brand-700">ارفع المستند الآن</summary>
                          <div className="mt-2 rounded-xl bg-paper p-3">
                            <UploadForm kinds={[String(r.ruleParams?.documentKind ?? "ORG_DOC")]} hint={r.ruleParams?.labelKeyword ? `اكتب في الوصف كلمة «${r.ruleParams.labelKeyword}» ليُطابق الشرط.` : undefined} />
                            {s.organization.isDemo && <p className="mt-2 text-xs text-gold-600">في العرض التجريبي: يمكنك إضافة ملف المثال من <Link href="/app/organization" className="underline">ملف الجمعية</Link>.</p>}
                          </div>
                        </details>
                      )}
                      {["ENTITY_TYPE", "TARGET_GROUP"].includes(r.rule) && r.evaluation.result !== "MET" && (
                        <Link href="/app/organization" className="mt-2 inline-block text-sm text-brand-700 underline">حدّث ملف الجمعية ثم استخدم أحدث بياناته في الطلب</Link>
                      )}
                      {r.rule === "REGION" && !s.application.region && <p className="mt-2 text-sm text-brand-700">حدد منطقة التنفيذ في «ملخص المشروع» بالشريط الجانبي.</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
          <div className="flex justify-end"><LinkButton href={`/app/applications/${id}/idea`}>التالي: طوّر فكرة المشروع</LinkButton></div>
        </>
      )}
    </div>
  );
}
