import { appPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { CONTRIBUTION_LABEL, FUNDING_SOURCE_LABEL } from "@/lib/catalog";
import { formatSar, halalasToNumberString, milliToString } from "@/lib/money";
import { normalizeAr } from "@/lib/domain/requirements";
import { AssessmentBadge, EstimateBadge } from "@/components/status";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { BudgetLineForm } from "@/components/client/budget-editor";
import * as act from "../../../../actions/app";

export default async function BudgetPage(props: PageProps<"/app/applications/[id]/budget">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const s = await buildSnapshot(id);
  const v = ctx.app.version;
  const actMap = new Map(s.activities.map((a) => [a.id, a]));
  const partnerMap = new Map(s.partners.map((p) => [p.id, p]));
  const excludedReq = s.requirements.find((r) => r.rule === "EXCLUDED_COSTS");
  const kws = ((excludedReq?.ruleParams?.keywords as string[] | undefined) ?? []).map(normalizeAr);
  const budgetReqs = s.requirements.filter((r) => r.category === "BUDGET");
  const estimates = s.budgetLines.filter((l) => l.isEstimate || l.needsReview);
  const acts = s.activities.map((a) => ({ id: a.id, code: a.code, name: a.name }));
  const partners = s.partners.map((p) => ({ id: p.id, name: p.name }));
  const B = (k: keyof typeof s.budget) => formatSar(BigInt(s.budget[k] as string));

  return (
    <div className="space-y-6">
      <PageHeader
        title="راجع الميزانية"
        description="الحسابات برمجية دقيقة بالهللة. الإجمالي = الكمية × تكلفة الوحدة، وللبنود الدورية × عدد الفترات (لمنع احتساب المدة مرتين)."
        actions={ctx.canEdit && (
          <>
            {!s.budgetLines.length && <ActionButton variant="secondary" label="اقترح بنودًا تقديرية" pendingLabel="جارٍ الاقتراح…" action={act.suggestBudgetAction.bind(null, id)} />}
            <BudgetLineForm activities={acts} partners={partners} save={act.saveBudgetLineAction.bind(null, id, v)} label="+ بند" duration={s.application.durationMonths} beneficiaries={s.application.beneficiaryCount} />
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4"><div className="text-sm text-muted">إجمالي المشروع</div><div className="text-xl font-bold tabular">{B("total")}</div><div className="text-xs text-muted">نقدي {B("cashTotal")} · عيني {B("inKindTotal")}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted">المطلوب من المانح</div><div className="text-xl font-bold text-brand-900 tabular">{B("donor")}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted">المساهمة الذاتية</div><div className="text-xl font-bold tabular">{formatSar(BigInt(s.budget.selfCash) + BigInt(s.budget.selfInKind))}</div><div className="text-xs text-muted">نقدي {B("selfCash")} · عيني {B("selfInKind")}</div></Card>
        <Card className="p-4"><div className="text-sm text-muted">مساهمات الشركاء</div><div className="text-xl font-bold tabular">{formatSar(BigInt(s.budget.partnerCash) + BigInt(s.budget.partnerInKind))}</div><div className="text-xs text-muted">نقدي {B("partnerCash")} · عيني {B("partnerInKind")}</div></Card>
      </div>
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>الفجوة النقدية: <strong className={BigInt(s.budget.cashGap) > 0n ? "text-danger-700" : ""}>{B("cashGap")}</strong> <span className="text-muted">(بنود نقدية منسوبة لشركاء غير مؤكدين أو تتجاوز تعهداتهم)</span></div>
          <div className="text-muted">نسبة المساهمة غير المانحة: <span className="tabular">{(s.budget.nonDonorShareBp / 100).toFixed(2)}%</span> — المساهمة العينية تُحتسب في الإجمالي ولا تُخصم من النقدي.</div>
        </div>
      </Card>

      {budgetReqs.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold text-brand-900">فحص الاشتراطات المالية المعلومة</h2>
          <ul className="space-y-2 text-sm">
            {budgetReqs.map((r) => <li key={r.id} className="flex flex-wrap items-start gap-2"><AssessmentBadge result={r.evaluation.result} /><span><strong>{r.text}</strong> — {r.evaluation.evidence}</span></li>)}
          </ul>
        </Card>
      )}

      {estimates.length > 0 && ctx.canEdit && (
        <Notice tone="gold" title="بنود تقديرية">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{estimates.length} بنود تقديرية أو تحتاج مراجعة. راجع الكميات والأسعار ثم اعتمدها.</span>
            <ActionButton size="sm" label="اعتماد كل البنود المعروضة" confirm="أؤكد أنني راجعت الكميات والتكاليف والمبررات لهذه البنود وأعتمدها." action={act.approveBudgetLinesAction.bind(null, id, estimates.map((l) => l.id), v)} />
          </div>
        </Notice>
      )}

      {!s.budgetLines.length ? (
        <EmptyState title="الميزانية فارغة">أضف البنود يدويًا، أو اطلب اقتراحًا تقديريًا مرتبطًا بالأنشطة يحتاج اعتمادك.</EmptyState>
      ) : (
        <Card className="p-0">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <caption className="sr-only">بنود الميزانية</caption>
              <thead className="bg-brand-900 text-white">
                <tr className="text-right">
                  <th className="p-2">البند</th><th className="p-2">مركز التكلفة</th><th className="p-2">النشاط</th><th className="p-2">الوحدة</th>
                  <th className="p-2">الكمية</th><th className="p-2">تكلفة الوحدة</th><th className="p-2">الفترات</th><th className="p-2">الإجمالي</th>
                  <th className="p-2">المصدر</th><th className="p-2">النوع</th><th className="p-2"><span className="sr-only">إجراءات</span></th>
                </tr>
              </thead>
              <tbody>
                {s.budgetLines.map((l) => {
                  const excluded = l.fundingSource === "DONOR" && kws.some((k) => k && normalizeAr(`${l.item} ${l.costCenter}`).includes(k));
                  return (
                    <tr key={l.id} className={`border-b border-line align-top ${excluded ? "bg-danger-50" : ""}`}>
                      <td className="p-2">
                        <div className="font-medium">{l.item}</div>
                        <div className="text-xs text-muted">{l.justification}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {l.isEstimate && <EstimateBadge />}{l.needsReview && <Badge tone="danger">يحتاج مراجعة</Badge>}
                          {excluded && <Badge tone="danger">بند مستبعد في شروط المنحة</Badge>}
                          {l.quantityFollowsBeneficiaries && <Badge tone="brand">يتبع عدد المستفيدين</Badge>}{l.periodsFollowDuration && <Badge tone="brand">يتبع المدة</Badge>}
                        </div>
                      </td>
                      <td className="p-2">{l.costCenter}</td>
                      <td className="p-2">{l.activityId ? actMap.get(l.activityId)?.code : "—"}</td>
                      <td className="p-2">{l.unit}</td>
                      <td className="p-2 tabular" dir="ltr">{milliToString(BigInt(l.quantityMilli))}</td>
                      <td className="p-2 tabular" dir="ltr">{formatSar(BigInt(l.unitCostHalalas), false)}</td>
                      <td className="p-2 tabular">{l.calc === "RECURRING" ? l.periods : "—"}</td>
                      <td className="p-2 font-bold tabular" dir="ltr">{formatSar(BigInt(l.totalHalalas), false)}</td>
                      <td className="p-2">{FUNDING_SOURCE_LABEL[l.fundingSource]}{l.partnerId ? <div className="text-xs text-muted">{partnerMap.get(l.partnerId)?.name}</div> : null}</td>
                      <td className="p-2">{CONTRIBUTION_LABEL[l.contributionType]}</td>
                      <td className="whitespace-nowrap p-2">
                        {ctx.canEdit && <>
                          <BudgetLineForm
                            initial={{ id: l.id, item: l.item, costCenter: l.costCenter, activityId: l.activityId, partnerId: l.partnerId, unit: l.unit, quantity: milliToString(BigInt(l.quantityMilli)), unitCostSar: halalasToNumberString(BigInt(l.unitCostHalalas)), calc: l.calc, periods: l.periods, fundingSource: l.fundingSource, contributionType: l.contributionType, justification: l.justification, periodsFollowDuration: l.periodsFollowDuration, quantityFollowsBeneficiaries: l.quantityFollowsBeneficiaries }}
                            activities={acts} partners={partners} save={act.saveBudgetLineAction.bind(null, id, v)} label="تعديل" duration={s.application.durationMonths} beneficiaries={s.application.beneficiaryCount}
                          />
                          <ActionButton size="sm" variant="ghost" label="حذف" confirm={`حذف البند «${l.item}»؟`} action={act.deleteBudgetLineAction.bind(null, id, l.id, v)} />
                        </>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-paper font-bold"><td className="p-2" colSpan={7}>الإجمالي</td><td className="p-2 tabular" dir="ltr">{formatSar(BigInt(s.budget.total), false)}</td><td colSpan={3} /></tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
      <div className="flex justify-end"><LinkButton href={`/app/applications/${id}/answers`}>التالي: إجابات نموذج الجهة</LinkButton></div>
    </div>
  );
}
