import Link from "next/link";
import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { PRICING } from "@/lib/pricing";
import { formatDateTime } from "@/lib/format";
import { REVIEW_SECTIONS, REVIEW_SECTION_LABEL } from "@/lib/review-sections";
import { buildSnapshot, snapshotHash } from "@/lib/services/snapshot";
import { Card, EmptyState, LinkButton, Notice, PageHeader } from "@/components/ui";
import { ReviewStatus } from "@/components/status";
import { CommentForm, ReviewRequestForm } from "@/components/client/review-forms";
import { orgReplyAction, requestReviewAction } from "../../../../actions/commerce";

export default async function ReviewPage(props: PageProps<"/app/applications/[id]/review">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const [paidOrder, requests, revisions, docs] = await Promise.all([
    db.order.findFirst({ where: { applicationId: id, product: "EXPERT_REVIEW", status: "PAID" } }),
    db.reviewRequest.findMany({ where: { applicationId: id }, include: { revision: true, comments: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" } }),
    db.revision.findMany({ where: { applicationId: id }, orderBy: { number: "desc" }, select: { id: true, number: true, label: true, isApproved: true } }),
    db.document.findMany({ where: { organizationId: ctx.app.organizationId, kind: { not: "LOGO" } }, select: { id: true, filename: true, label: true } }),
  ]);
  const unusedOrder = paidOrder && !requests.some((r) => r.orderId === paidOrder.id);
  const currentHash = snapshotHash(await buildSnapshot(id));
  const info = PRICING.EXPERT_REVIEW;

  return (
    <div className="space-y-6">
      <PageHeader title="مراجعة خبير" description="إضافة اختيارية مدفوعة. الخبير يقرأ نسخة محددة تختارها ويكتب ملاحظات مرتبطة بالأقسام، ولا يغيّر محتوى الطلب أو اعتماده." />
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <div><h2 className="mb-1 font-bold">تشمل</h2><ul className="list-disc pe-5 text-sm">{info.scope.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div><h2 className="mb-1 font-bold">لا تشمل</h2><ul className="list-disc pe-5 text-sm text-muted">{info.excludes.map((x) => <li key={x}>{x}</li>)}</ul></div>
        </div>
      </Card>
      {ctx.isOwner && !paidOrder && <Notice tone="gold">لطلب مراجعة خبير أكمل شراء الإضافة أولًا. <Link className="underline" href={`/app/applications/${id}/purchase`}>الشراء</Link></Notice>}
      {ctx.isOwner && unusedOrder && (
        <Card>
          <h2 className="mb-3 text-lg font-bold text-brand-900">اطلب المراجعة</h2>
          {revisions.length ? (
            <ReviewRequestForm revisions={revisions.map((r) => ({ id: r.id, label: `النسخة ${r.number} — ${r.label}${r.isApproved ? " (معتمدة)" : ""}` }))} docs={docs.map((d) => ({ id: d.id, name: d.label ?? d.filename }))} submit={requestReviewAction.bind(null, id)} />
          ) : <EmptyState title="لا توجد نسخ" action={<LinkButton href={`/app/applications/${id}/revisions`} variant="secondary">احفظ نسخة</LinkButton>}>احفظ أو اعتمد نسخة لتسليمها للخبير.</EmptyState>}
        </Card>
      )}
      {requests.map((rr) => (
        <Card key={rr.id}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-brand-900">طلب مراجعة — النسخة {rr.revision.number}</h2>
            <ReviewStatus status={rr.status} />
          </div>
          <p className="text-xs text-muted">أُرسل {formatDateTime(rr.createdAt)} · {rr.expertUserId ? "أُسند لخبير" : "بانتظار الإسناد (الخدمة تُشغّل يدويًا حاليًا؛ لا توجد مدة إنجاز مضمونة)"}</p>
          {rr.revision.contentHash !== currentHash && <p className="mt-2 rounded-lg bg-brand-50 p-2 text-sm text-brand-800">عُدّل الطلب بعد النسخة التي سُلّمت للخبير؛ التعديلات الجديدة لم تتم مراجعتها.</p>}
          <div className="mt-3 space-y-2">
            {rr.comments.length === 0 && <p className="text-sm text-muted">لا توجد ملاحظات بعد.</p>}
            {rr.comments.map((c) => (
              <div key={c.id} className={`rounded-xl p-3 text-sm ${c.authorRole === "EXPERT" ? "bg-brand-50" : "bg-gold-100"}`}>
                <div className="mb-1 text-xs text-muted">{c.authorRole === "EXPERT" ? "الخبير" : "الجمعية"} · {REVIEW_SECTION_LABEL[c.sectionKey] ?? c.sectionKey} · {formatDateTime(c.createdAt)}</div>
                <div className="whitespace-pre-line">{c.body}</div>
              </div>
            ))}
          </div>
          {ctx.canEdit && rr.status !== "COMPLETED" && rr.expertUserId && (
            <div className="mt-3"><CommentForm sections={REVIEW_SECTIONS} submit={orgReplyAction.bind(null, id, rr.id)} placeholder={rr.status === "NEEDS_INFO" ? "أضف المعلومات التي طلبها الخبير" : "رد أو توضيح"} /></div>
          )}
        </Card>
      ))}
    </div>
  );
}
