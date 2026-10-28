import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { CATEGORY_LABEL, OPPORTUNITY_FIELDS, OPPORTUNITY_GROUPS, SECTION_LABEL } from "@/lib/catalog";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { FactStatus } from "@/components/status";
import { ConflictResolver, FactEditor } from "@/components/client/fact-editor";
import { ActionButton } from "@/components/client/action-button";
import { AddQuestionForm, AddRequirementForm } from "@/components/client/opp-forms";
import * as act from "../../../../actions/app";

const RULE_LABEL: Record<string, string> = {
  MANUAL: "يحتاج قرارك", ENTITY_TYPE: "يُقارن بنوع الكيان", REGION: "يُقارن بمنطقة التنفيذ", TARGET_GROUP: "يُقارن بالفئات المستهدفة",
  DOCUMENT_PRESENT: "يُتحقق من المستند", BUDGET_CAP: "يُتحقق من الميزانية", DURATION_MAX: "يُتحقق من المدة", COFUNDING_MIN: "يُتحقق من المساهمة", EXCLUDED_COSTS: "يُتحقق من البنود",
};

export default async function ExtractionReview(props: PageProps<"/app/applications/[id]/extraction">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const oppId = ctx.app.opportunityId;
  const [facts, reqs, questions, docs] = await Promise.all([
    db.fact.findMany({ where: { opportunityId: oppId, organizationId: ctx.app.organizationId } }),
    db.requirement.findMany({ where: { opportunityId: oppId }, orderBy: { sortOrder: "asc" } }),
    db.formQuestion.findMany({ where: { opportunityId: oppId }, orderBy: { sortOrder: "asc" } }),
    db.document.findMany({ where: { opportunityId: oppId }, select: { id: true, filename: true, label: true } }),
  ]);
  const docName = new Map(docs.map((d) => [d.id, d.label ?? d.filename]));
  const byKey = new Map(facts.map((f) => [f.key, f]));
  const unconfirmed = facts.filter((f) => f.status === "EXTRACTED_UNCONFIRMED").length;
  const conflicts = facts.filter((f) => f.status === "CONFLICT").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="راجع ما استخرجناه"
        description="كل معلومة معروضة مع مصدرها وموضعها. المعلومة المجهولة تبقى مجهولة، والتعارض يحتاج حسمك."
        actions={ctx.canEdit && unconfirmed > 0 && <ActionButton label={`تأكيد ${unconfirmed} معلومة مستخرجة`} action={act.confirmAllOpportunityFactsAction.bind(null, id)} />}
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge tone="warn">تحتاج تأكيدًا: {unconfirmed}</Badge>
        <Badge tone="danger">تعارضات: {conflicts}</Badge>
        <Badge tone="brand">شروط: {reqs.length}</Badge>
        <Badge tone="brand">أسئلة: {questions.length}</Badge>
      </div>

      {OPPORTUNITY_GROUPS.map((g) => (
        <Card key={g.key}>
          <h2 className="mb-3 text-lg font-bold text-brand-900">{g.label}</h2>
          <div className="divide-y divide-line">
            {OPPORTUNITY_FIELDS.filter((f) => f.group === g.key).map((f) => {
              const fact = byKey.get(f.key);
              const status = fact?.status ?? "MISSING";
              return (
                <div key={f.key} className="grid gap-2 py-3 md:grid-cols-[200px_1fr]">
                  <div><div className="font-medium">{f.label}</div><div className="mt-1"><FactStatus status={status} /></div></div>
                  <div className="min-w-0">
                    {status === "CONFLICT" ? (
                      <ConflictResolver canEdit={ctx.canEdit} resolve={act.resolveConflictAction.bind(null, id, f.key)}
                        alternatives={((fact?.alternatives as { value: unknown; sourceDocId?: string; sourceLocator?: string; sourceExcerpt?: string }[]) ?? []).map((a) => ({ ...a, docName: a.sourceDocId ? docName.get(a.sourceDocId) : "إدخال المستخدم" }))} />
                    ) : (
                      <FactEditor type={f.type} value={fact?.value ?? null} status={status} canEdit={ctx.canEdit} fieldLabel={f.label} save={act.confirmOpportunityFactAction.bind(null, id, f.key)} />
                    )}
                    {fact && fact.status !== "MISSING" && fact.status !== "CONFLICT" && (
                      <div className="mt-2 text-xs text-muted">
                        المصدر: {fact.sourceType === "USER" ? "إدخال المستخدم" : `${fact.sourceDocId ? docName.get(fact.sourceDocId) : "مستند محذوف"}${fact.sourceLocator ? ` — ${fact.sourceLocator}` : ""}`}
                        {fact.sourceExcerpt && <blockquote className="mt-1 border-s-2 border-gold-400 ps-2">«{fact.sourceExcerpt}»</blockquote>}
                      </div>
                    )}
                    {!fact && <div className="text-xs text-muted">لم يُذكر في المصادر المرفوعة. لا نفترض قيمة له.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-900">الشروط المستخرجة</h2>
          {ctx.canEdit && <AddRequirementForm save={act.addRequirementAction.bind(null, id)} />}
        </div>
        {!reqs.length ? <EmptyState title="لا توجد شروط بعد">حلّل ملفات الفرصة أو أضف الشروط يدويًا.</EmptyState> : (
          <ul className="divide-y divide-line">
            {reqs.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <span className="me-2 font-bold">{r.code}</span>{r.text}
                    <div className="mt-1 flex flex-wrap gap-1"><Badge>{CATEGORY_LABEL[r.category]}</Badge><Badge tone={r.mandatory ? "danger" : "neutral"}>{r.mandatory ? "إلزامي" : "اختياري"}</Badge><Badge tone="brand">{RULE_LABEL[r.rule]}</Badge></div>
                  </div>
                  {ctx.canEdit && <ActionButton size="sm" variant="ghost" label="حذف" confirm="حذف هذا الشرط من الفرصة؟" action={act.deleteRequirementAction.bind(null, id, r.id)} />}
                </div>
                <div className="mt-1 text-xs text-muted">المصدر: {r.sourceDocId ? docName.get(r.sourceDocId) : "إدخال المستخدم"}{r.sourceLocator && r.sourceDocId ? ` — ${r.sourceLocator}` : ""}</div>
                {r.sourceExcerpt && <blockquote className="mt-1 border-s-2 border-gold-400 ps-2 text-xs text-muted">«{r.sourceExcerpt}»</blockquote>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-900">أسئلة نموذج الجهة</h2>
          {ctx.canEdit && <AddQuestionForm save={act.addQuestionAction.bind(null, id)} />}
        </div>
        {!questions.length ? <EmptyState title="لا توجد أسئلة">أضف أسئلة النموذج وحدودها.</EmptyState> : (
          <ol className="divide-y divide-line">
            {questions.map((q, i) => (
              <li key={q.id} className="py-3">
                <div>{i + 1}. {q.text}</div>
                <div className="mt-1 flex flex-wrap gap-1 text-xs">
                  <Badge tone={q.mandatory ? "danger" : "neutral"}>{q.mandatory ? "إلزامي" : "اختياري"}</Badge>
                  <Badge>{q.limitType === "NONE" ? "بلا حد" : `حد ${q.limitValue} ${q.limitType === "WORDS" ? "كلمة" : "حرف"}`}</Badge>
                  {q.linkedSections.map((s) => <Badge key={s} tone="brand">{SECTION_LABEL[s]}</Badge>)}
                </div>
                <div className="mt-1 text-xs text-muted">المصدر: {q.sourceDocId ? `${docName.get(q.sourceDocId)}${q.sourceLocator ? ` — ${q.sourceLocator}` : ""}` : "إدخال المستخدم"}</div>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <div className="flex justify-end"><LinkButton href={`/app/applications/${id}/eligibility`}>التالي: الأهلية والمتطلبات</LinkButton></div>
    </div>
  );
}
