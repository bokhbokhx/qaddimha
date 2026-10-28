import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { SECTION_LABEL } from "@/lib/catalog";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { TextDiff } from "@/components/diff";
import { ActionButton } from "@/components/client/action-button";
import { applyProposalAction, rejectProposalAction } from "../../../../actions/app";

export default async function ChangesPage(props: PageProps<"/app/applications/[id]/changes">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const [proposals, questions] = await Promise.all([
    db.changeProposal.findMany({ where: { applicationId: id, status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    db.formQuestion.findMany({ where: { opportunityId: ctx.app.opportunityId }, select: { id: true, text: true } }),
  ]);
  const qText = new Map(questions.map((q) => [q.id, q.text]));
  return (
    <div className="space-y-6">
      <PageHeader title="مقترحات التعديل" description="عند تغيير مدخلات مؤثرة نقترح تعديلات على النصوص المتأثرة. لا يُطبق أي مقترح دون موافقتك، وتُحفظ نسخة قبل التطبيق." />
      {!proposals.length ? <EmptyState title="لا توجد مقترحات معلقة" /> : proposals.map((p) => (
        <Card key={p.id}>
          <div className="mb-2 text-sm text-muted">{p.trigger}</div>
          <h2 className="mb-2 font-bold text-brand-900">{p.targetType === "SECTION" ? `قسم: ${SECTION_LABEL[p.targetId]}` : `إجابة: ${qText.get(p.targetId) ?? ""}`}</h2>
          <p className="mb-2 text-sm">{p.explanation}</p>
          <TextDiff before={p.before} after={p.after} />
          <details className="mt-2 text-sm"><summary className="cursor-pointer text-brand-700">عرض النصين كاملين (قبل / بعد)</summary>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div><div className="mb-1 text-xs text-muted">قبل</div><div className="whitespace-pre-wrap rounded-lg bg-paper p-2">{p.before}</div></div>
              <div><div className="mb-1 text-xs text-muted">بعد</div><div className="whitespace-pre-wrap rounded-lg bg-paper p-2">{p.after}</div></div>
            </div>
          </details>
          {ctx.canEdit && (
            <div className="mt-3 flex gap-2">
              <ActionButton size="sm" label="تطبيق المقترح" action={applyProposalAction.bind(null, id, p.id)} />
              <ActionButton size="sm" variant="secondary" label="رفض" action={rejectProposalAction.bind(null, id, p.id)} />
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
