import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { SECTION_LABEL } from "@/lib/catalog";
import { checkLimit } from "@/lib/text-limits";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { AnswerStatus } from "@/components/status";
import { ActionButton } from "@/components/client/action-button";
import { AnswerEditor } from "@/components/client/answer-editor";
import * as act from "../../../../actions/app";

export default async function AnswersPage(props: PageProps<"/app/applications/[id]/answers">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const [questions, answers, sections] = await Promise.all([
    db.formQuestion.findMany({ where: { opportunityId: ctx.app.opportunityId }, orderBy: { sortOrder: "asc" } }),
    db.formAnswer.findMany({ where: { applicationId: id } }),
    db.projectSection.findMany({ where: { applicationId: id }, select: { key: true, status: true } }),
  ]);
  const hasApproved = sections.some((s) => s.status === "APPROVED");
  const emptyCount = questions.filter((q) => !answers.find((a) => a.questionId === q.id && a.content.trim())).length;
  return (
    <div className="space-y-6">
      <PageHeader
        title="إجابات نموذج الجهة"
        description="لكل سؤال: نصه الأصلي، إلزاميته، حده، والإجابة. الحدود يُتحقق منها برمجيًا. الإجابة المعتمدة تصبح «قديمة» إذا عُدّل قسم مرتبط بها."
        actions={ctx.canEdit && emptyCount > 0 && <ActionButton variant="secondary" label={`أنشئ مسودات لـ${emptyCount} أسئلة فارغة`} pendingLabel="جارٍ الإنشاء…" disabled={!hasApproved} action={act.draftAnswersAction.bind(null, id)} />}
      />
      {!hasApproved && emptyCount > 0 && <p className="text-sm text-muted">إنشاء المسودات يعتمد على أقسام المشروع المعتمدة فقط؛ اعتمد بعض الأقسام أولًا، أو اكتب الإجابات مباشرة.</p>}
      {!questions.length ? (
        <EmptyState title="لا توجد أسئلة" action={<LinkButton href={`/app/applications/${id}/extraction`} variant="secondary">أضف أسئلة النموذج</LinkButton>} />
      ) : questions.map((q, i) => {
        const a = answers.find((x) => x.questionId === q.id);
        const within = checkLimit(a?.content ?? "", q.limitType, q.limitValue).withinLimit;
        return (
          <Card key={q.id}>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <h2 className="font-bold text-brand-900">{i + 1}. {q.text}</h2>
              <div className="flex flex-wrap gap-1">
                <Badge tone={q.mandatory ? "danger" : "neutral"}>{q.mandatory ? "إلزامي" : "اختياري"}</Badge>
                <Badge>{q.limitType === "NONE" ? "بلا حد" : `الحد ${q.limitValue} ${q.limitType === "WORDS" ? "كلمة" : "حرف"}`}</Badge>
                <AnswerStatus status={a?.status ?? "EMPTY"} />
                {a && a.origin !== "USER" && a.status !== "APPROVED" && <Badge tone="brand">مسودة من المساعد</Badge>}
              </div>
            </div>
            {q.linkedSections.length > 0 && <p className="mb-2 text-xs text-muted">مبنية على: {q.linkedSections.map((s) => SECTION_LABEL[s]).join("، ")}</p>}
            {a?.status === "STALE" && <p className="mb-2 rounded-lg bg-danger-50 p-2 text-sm text-danger-700">قديمة: {a.staleReason}. راجعها لتتسق مع المشروع.</p>}
            <AnswerEditor key={`${q.id}-${a?.version ?? 0}`} storageKey={`${id}:ans:${q.id}`} label={q.text} initial={a?.content ?? ""} version={a?.version ?? null} limitType={q.limitType} limitValue={q.limitValue} save={act.saveAnswerAction.bind(null, id, q.id) as never} disabled={!ctx.canEdit} />
            {ctx.canEdit && a && a.content.trim() && a.status !== "APPROVED" && (
              <div className="mt-2"><ActionButton size="sm" label="اعتماد الإجابة" disabled={!within} action={act.approveAnswerAction.bind(null, id, q.id)} /></div>
            )}
          </Card>
        );
      })}
      <div className="flex justify-end"><LinkButton href={`/app/applications/${id}/readiness`}>التالي: تحقق من جاهزية الطلب</LinkButton></div>
    </div>
  );
}
