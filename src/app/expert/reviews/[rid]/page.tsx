import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/guard";
import { expertView } from "@/lib/domain/expert-view";
import type { Snapshot } from "@/lib/domain/types";
import { SECTION_LABEL, ASSESSMENT_LABEL, FUNDING_SOURCE_LABEL, PARTNER_STATUS_LABEL } from "@/lib/catalog";
import { formatSar } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { REVIEW_SECTIONS, REVIEW_SECTION_LABEL } from "@/lib/review-sections";
import { Card, PageHeader } from "@/components/ui";
import { ReviewStatus } from "@/components/status";
import { ActionButton } from "@/components/client/action-button";
import { CommentForm } from "@/components/client/review-forms";
import { expertCommentAction, expertStatusAction } from "../../../actions/commerce";

export default async function ExpertReview(props: PageProps<"/expert/reviews/[rid]">) {
  const { rid } = await props.params;
  const { user } = await requireUserPage();
  // صلاحية الخبير محددة بهذا الطلب فقط
  const rr = await db.reviewRequest.findFirst({ where: { id: rid, expertUserId: user.id }, include: { revision: true, comments: { orderBy: { createdAt: "asc" } } } });
  if (!rr || user.platformRole !== "EXPERT") notFound();
  const docs = await db.document.findMany({ where: { id: { in: rr.sharedDocIds } }, select: { id: true, filename: true, label: true } });
  const v = expertView(rr.revision.snapshot as unknown as Snapshot, docs);
  const open = rr.status !== "COMPLETED";
  return (
    <div className="space-y-6">
      <PageHeader title={v.title} description={`${v.organizationName} — ${v.funder} — النسخة ${rr.revision.number}`} actions={<ReviewStatus status={rr.status} />} />
      {rr.notes && <Card><h2 className="mb-1 font-bold">ملاحظات الجمعية</h2><p className="text-sm whitespace-pre-line">{rr.notes}</p></Card>}
      <Card>
        <h2 className="mb-2 font-bold">المرفقات المشاركة</h2>
        {docs.length ? <ul className="text-sm">{docs.map((d) => <li key={d.id}><a className="text-brand-700 underline" href={`/api/documents/${d.id}`}>{d.label ?? d.filename}</a></li>)}</ul> : <p className="text-sm text-muted">لم تُشارك مرفقات.</p>}
      </Card>
      <Card>
        <h2 className="mb-2 font-bold">المدخلات الرئيسية</h2>
        <p className="text-sm">المستفيدون: {v.params.beneficiaryCount ?? "—"} · المدة: {v.params.durationMonths ?? "—"} شهرًا · المنطقة: {v.params.region ?? "—"}</p>
        {v.ideaSummary && <p className="mt-2 text-sm">{v.ideaSummary}</p>}
      </Card>
      {v.sections.map((s) => <Card key={s.key}><h2 className="mb-1 font-bold text-brand-900">{SECTION_LABEL[s.key]}</h2><p className="whitespace-pre-line text-sm">{s.content || "—"}</p></Card>)}
      <Card>
        <h2 className="mb-2 font-bold text-brand-900">الخطة والمؤشرات والشركاء</h2>
        <ul className="mb-3 text-sm">{v.activities.map((a) => <li key={a.id}>{a.code} {a.name} (الأشهر {a.startMonth}–{a.endMonth})</li>)}</ul>
        <ul className="mb-3 text-sm">{v.indicators.map((i) => <li key={i.id}>{i.type === "OUTPUT" ? "مخرج" : "نتيجة"}: {i.name} — {i.target} {i.unit}</li>)}</ul>
        <ul className="text-sm">{v.partners.map((p) => <li key={p.id}>{p.name} ({PARTNER_STATUS_LABEL[p.status]}) — {p.role}</li>)}</ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-bold text-brand-900">الميزانية</h2>
        <ul className="text-sm">{v.budgetLines.map((l) => <li key={l.id}>{l.item}: <span className="tabular" dir="ltr">{formatSar(BigInt(l.totalHalalas))}</span> ({FUNDING_SOURCE_LABEL[l.fundingSource]})</li>)}</ul>
        <p className="mt-2 text-sm font-bold">الإجمالي: <span dir="ltr">{formatSar(BigInt(v.budget.total))}</span> · المطلوب من المانح: <span dir="ltr">{formatSar(BigInt(v.budget.donor))}</span></p>
      </Card>
      <Card>
        <h2 className="mb-2 font-bold text-brand-900">الإجابات والمتطلبات</h2>
        {v.questions.map((q) => <div key={q.id} className="mb-2 text-sm"><div className="font-medium">{q.text}</div><p className="whitespace-pre-line">{q.answer?.content || "—"}</p></div>)}
        <ul className="mt-3 text-sm">{v.requirements.map((r) => <li key={r.id}>{r.code} {r.text}: {ASSESSMENT_LABEL[r.result]}</li>)}</ul>
      </Card>
      <Card>
        <h2 className="mb-2 font-bold text-brand-900">الملاحظات</h2>
        {rr.comments.map((c) => (
          <div key={c.id} className={`mb-2 rounded-xl p-3 text-sm ${c.authorRole === "EXPERT" ? "bg-brand-50" : "bg-gold-100"}`}>
            <div className="text-xs text-muted">{c.authorRole === "EXPERT" ? "أنت" : "الجمعية"} · {REVIEW_SECTION_LABEL[c.sectionKey]} · {formatDateTime(c.createdAt)}</div>
            <div className="whitespace-pre-line">{c.body}</div>
          </div>
        ))}
        {open && <CommentForm sections={REVIEW_SECTIONS} submit={expertCommentAction.bind(null, rid)} placeholder="ملاحظة مرتبطة بالقسم" />}
        {open && (
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton size="sm" variant="secondary" label="طلب معلومات من الجمعية" action={expertStatusAction.bind(null, rid, "NEEDS_INFO")} />
            <ActionButton size="sm" label="إنهاء المراجعة" confirm="إنهاء المراجعة؟ لن تتمكن من إضافة ملاحظات بعدها." action={expertStatusAction.bind(null, rid, "COMPLETED")} />
          </div>
        )}
      </Card>
    </div>
  );
}
