import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { SECTIONS, PARTNER_STATUS_LABEL } from "@/lib/catalog";
import { formatSar, halalasToNumberString } from "@/lib/money";
import { Badge, Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { EstimateBadge, SectionStatus } from "@/components/status";
import { AutosaveText } from "@/components/client/autosave-text";
import { ActionButton } from "@/components/client/action-button";
import { ActivityForm, IndicatorForm, PartnerForm } from "@/components/client/project-editors";
import * as act from "../../../../actions/app";

export default async function ProjectPage(props: PageProps<"/app/applications/[id]/project">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const [sections, activities, indicators, partners, docs] = await Promise.all([
    db.projectSection.findMany({ where: { applicationId: id } }),
    db.activity.findMany({ where: { applicationId: id }, orderBy: [{ sortOrder: "asc" }] }),
    db.indicator.findMany({ where: { applicationId: id }, orderBy: { sortOrder: "asc" } }),
    db.partner.findMany({ where: { applicationId: id } }),
    db.document.findMany({ where: { organizationId: ctx.app.organizationId, opportunityId: null, kind: { not: "LOGO" } }, select: { id: true, filename: true, label: true } }),
  ]);
  const empty = sections.every((s) => !s.content.trim());
  const actById = new Map(activities.map((a) => [a.id, a]));
  const dur = ctx.app.durationMonths;

  return (
    <div className="space-y-6">
      <PageHeader
        title="محرر المشروع"
        description="عدّل كل قسم مباشرة؛ الحفظ تلقائي. القسم لا يُحتسب جاهزًا حتى تعتمده. الأرقام المقترحة من النظام موسومة «تقديري»."
        actions={ctx.canEdit && ctx.app.ideaApproved && <ActionButton label={empty ? "أنشئ مسودة المشروع" : "اقترح من المساعد للأقسام"} pendingLabel="جارٍ الإعداد…" action={act.draftProjectAction.bind(null, id)} />}
      />
      {!ctx.app.ideaApproved && <Notice tone="warn">اعتمد ملخص الفكرة أولًا قبل إنشاء تفاصيل كبيرة. <a className="underline" href={`/app/applications/${id}/idea`}>اذهب إلى الفكرة</a></Notice>}
      <nav aria-label="أقسام المحرر" className="flex flex-wrap gap-2 text-sm">
        {SECTIONS.map((s) => <a key={s.key} href={`#${s.key}`} className="rounded-full bg-white px-3 py-1 hover:bg-brand-50">{s.label}</a>)}
        <a href="#plan" className="rounded-full bg-white px-3 py-1 hover:bg-brand-50">خطة التنفيذ</a>
        <a href="#indicators" className="rounded-full bg-white px-3 py-1 hover:bg-brand-50">المؤشرات</a>
        <a href="#partners" className="rounded-full bg-white px-3 py-1 hover:bg-brand-50">الشركاء</a>
      </nav>

      {SECTIONS.map((def) => {
        const s = sections.find((x) => x.key === def.key);
        if (!s) return null;
        return (
          <Card key={def.key} id={def.key} className="scroll-mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-brand-900">{def.label}</h2>
              <div className="flex items-center gap-2"><SectionStatus status={s.status} />{s.isEstimate && s.status !== "APPROVED" && <EstimateBadge />}{s.origin !== "USER" && s.status !== "APPROVED" && <Badge tone="brand">مقترح من المساعد</Badge>}</div>
            </div>
            <p className="mb-2 text-xs text-muted">{def.hint}</p>
            {s.reviewReason && s.status === "NEEDS_REVIEW" && <p className="mb-2 rounded-lg bg-danger-50 p-2 text-sm text-danger-700">يحتاج مراجعة بسبب: {s.reviewReason}</p>}
            <AutosaveText key={`${s.id}-${s.version}`} storageKey={`${id}:sec:${def.key}`} label={def.label} initial={s.content} version={s.version} save={act.saveSectionAction.bind(null, id, def.key) as never} disabled={!ctx.canEdit} rows={def.key === "summary" ? 5 : 6} />
            {ctx.canEdit && s.status !== "APPROVED" && s.content.trim() && (
              <div className="mt-2"><ActionButton size="sm" label="اعتماد القسم" action={act.approveSectionAction.bind(null, id, def.key)} /></div>
            )}
          </Card>
        );
      })}

      <Card id="plan" className="scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-900">خطة التنفيذ والجدول</h2>
          {ctx.canEdit && <ActivityForm save={act.saveActivityAction.bind(null, id)} label="+ نشاط" />}
        </div>
        {!activities.length ? <EmptyState title="لا توجد أنشطة" /> : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="border-b border-line text-right text-muted"><th className="py-2">الرمز</th><th>النشاط</th><th>الأشهر</th><th>المسؤول</th><th>المخرجات</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
              <tbody>
                {activities.map((a) => (
                  <tr key={a.id} className="border-b border-line align-top">
                    <td className="py-2 font-medium">{a.code}</td>
                    <td>{a.name}<div className="text-xs text-muted">{a.description}</div></td>
                    <td className="tabular">{a.startMonth}–{a.endMonth}{dur && a.endMonth > dur && <div className="text-xs text-danger-700">بعد نهاية المدة</div>}</td>
                    <td>{a.responsible}</td>
                    <td>{a.outputs}</td>
                    <td className="whitespace-nowrap">
                      {ctx.canEdit && <>
                        <ActivityForm initial={{ id: a.id, code: a.code, name: a.name, description: a.description, startMonth: a.startMonth, endMonth: a.endMonth, responsible: a.responsible, outputs: a.outputs }} save={act.saveActivityAction.bind(null, id)} label="تعديل" />
                        <ActionButton size="sm" variant="ghost" label="حذف" confirm={`حذف النشاط ${a.code}؟ ستُحفظ نسخة قبل الحذف، وستُوسم المؤشرات وبنود الميزانية والأقسام المرتبطة بـ«تحتاج مراجعة».`} action={act.deleteActivityAction.bind(null, id, a.id, ctx.app.version)} />
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {dur && activities.length > 0 && (
          <div className="relative mt-4 overflow-x-auto" aria-label="مخطط زمني">
            <div className="min-w-[560px] space-y-1">
              {activities.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-xs">
                  <span className="w-10 shrink-0">{a.code}</span>
                  <div className="relative h-4 flex-1 rounded bg-[#efece4]">
                    <div className="absolute top-0 h-4 rounded bg-brand-600" style={{ insetInlineStart: `${((a.startMonth - 1) / dur) * 100}%`, width: `${(Math.min(dur, a.endMonth) - a.startMonth + 1) / dur * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card id="indicators" className="scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-900">مؤشرات القياس</h2>
          {ctx.canEdit && <IndicatorForm activities={activities.map((a) => ({ id: a.id, code: a.code, name: a.name }))} save={act.saveIndicatorAction.bind(null, id)} label="+ مؤشر" />}
        </div>
        <p className="mb-2 text-xs text-muted">المخرجات ما ينتجه المشروع مباشرة، والنتائج التغيير المتوقع لدى المستفيدين.</p>
        {!indicators.length ? <EmptyState title="لا توجد مؤشرات" /> : (
          <ul className="divide-y divide-line">
            {indicators.map((i) => (
              <li key={i.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div>
                  <div className="font-medium">{i.name}</div>
                  <div className="text-xs text-muted">{i.type === "OUTPUT" ? "مخرج" : "نتيجة"} · خط الأساس: {i.baseline ?? "غير متوفر"} · المستهدف: {i.target} {i.unit} · {i.method} {i.activityId ? `· ${actById.get(i.activityId)?.code}` : "· غير مرتبط بنشاط"}</div>
                  <div className="mt-1 flex gap-1">{i.isEstimate && <EstimateBadge />}{i.needsReview && <Badge tone="danger">يحتاج مراجعة</Badge>}</div>
                </div>
                {ctx.canEdit && (
                  <div className="flex flex-wrap gap-1">
                    {(i.isEstimate || i.needsReview) && <ActionButton size="sm" label="اعتماد" action={act.approveIndicatorAction.bind(null, id, i.id)} />}
                    <IndicatorForm initial={{ id: i.id, name: i.name, type: i.type, baseline: i.baseline, target: i.target, unit: i.unit, method: i.method, activityId: i.activityId }} activities={activities.map((a) => ({ id: a.id, code: a.code, name: a.name }))} save={act.saveIndicatorAction.bind(null, id)} label="تعديل" />
                    <ActionButton size="sm" variant="ghost" label="حذف" confirm="حذف المؤشر؟" action={act.deleteIndicatorAction.bind(null, id, i.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="partners" className="scroll-mt-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-brand-900">الشركاء والأدوار</h2>
          {ctx.canEdit && <PartnerForm docs={docs.map((d) => ({ id: d.id, name: d.label ?? d.filename }))} save={act.savePartnerAction.bind(null, id)} label="+ شريك" />}
        </div>
        {!partners.length ? <EmptyState title="لا يوجد شركاء" /> : (
          <ul className="divide-y divide-line">
            {partners.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2 font-medium">{p.name}<Badge tone={p.status === "CONFIRMED" ? (p.orgApproved ? "ok" : "danger") : "warn"}>{PARTNER_STATUS_LABEL[p.status]}{p.status === "CONFIRMED" && !p.orgApproved ? " — غير معتمد" : ""}</Badge></div>
                  <div className="text-muted">{p.role}</div>
                  <div className="text-xs text-muted">المساهمة: نقدي {formatSar(p.cashHalalas)}{p.inKindDescription ? ` · عيني: ${p.inKindDescription}` : ""}</div>
                  {p.mutualValue && <div className="text-xs text-muted">القيمة المتبادلة: {p.mutualValue}</div>}
                </div>
                {ctx.canEdit && (
                  <div className="flex gap-1">
                    <PartnerForm initial={{ id: p.id, name: p.name, partnerType: p.partnerType, role: p.role, status: p.status, tasks: p.tasks, cashSar: halalasToNumberString(p.cashHalalas), inKindDescription: p.inKindDescription, responsibilities: p.responsibilities, mutualValue: p.mutualValue, evidenceDocId: p.evidenceDocId, orgApproved: p.orgApproved }} docs={docs.map((d) => ({ id: d.id, name: d.label ?? d.filename }))} save={act.savePartnerAction.bind(null, id)} label="تعديل" />
                    <ActionButton size="sm" variant="ghost" label="حذف" confirm="حذف الشريك؟ البنود المرتبطة به ستُوسم «تحتاج مراجعة»." action={act.deletePartnerAction.bind(null, id, p.id)} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex justify-end"><LinkButton href={`/app/applications/${id}/budget`}>التالي: راجع الميزانية</LinkButton></div>
    </div>
  );
}
