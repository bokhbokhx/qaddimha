import Link from "next/link";
import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { SECTIONS } from "@/lib/catalog";
import { formatDateTime } from "@/lib/format";
import { formatSar } from "@/lib/money";
import type { Snapshot } from "@/lib/domain/types";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { TextDiff } from "@/components/diff";
import { ActionButton } from "@/components/client/action-button";
import { SaveRevision } from "./save";
import { restoreRevisionAction, saveRevisionAction } from "../../../../actions/app";

const REASON: Record<string, string> = { AUTO_BEFORE_CHANGE: "تلقائية قبل تغيير", MANUAL: "يدوية", APPROVAL: "اعتماد", RESTORE: "استعادة" };

export default async function RevisionsPage(props: PageProps<"/app/applications/[id]/revisions">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const ctx = await appPageContext(id);
  const revs = await db.revision.findMany({ where: { applicationId: id }, orderBy: { number: "desc" }, select: { id: true, number: true, label: true, reason: true, isApproved: true, readyAtApproval: true, createdAt: true, contentHash: true } });
  const a = typeof sp.a === "string" ? sp.a : null;
  const b = typeof sp.b === "string" ? sp.b : null;
  let compare: { A: Snapshot; B: Snapshot; na: number; nb: number } | null = null;
  if (a && b) {
    const [ra, rb] = await Promise.all([db.revision.findFirst({ where: { id: a, applicationId: id } }), db.revision.findFirst({ where: { id: b, applicationId: id } })]);
    if (ra && rb) compare = { A: ra.snapshot as unknown as Snapshot, B: rb.snapshot as unknown as Snapshot, na: ra.number, nb: rb.number };
  }
  return (
    <div className="space-y-6">
      <PageHeader title="سجل الإصدارات والمقارنة" description="تُحفظ نسخة تلقائيًا قبل كل تغيير مؤثر، ويمكنك حفظ نسخة يدوية أو استعادة أي نسخة (مع حفظ الحالة الحالية أولًا)." actions={ctx.canEdit && <SaveRevision save={saveRevisionAction.bind(null, id)} />} />
      {!revs.length ? <EmptyState title="لا توجد نسخ بعد" /> : (
        <Card className="p-0">
          <form className="overflow-x-auto" action={`/app/applications/${id}/revisions`}>
            <table className="w-full min-w-[720px] text-sm">
              <thead><tr className="border-b border-line text-right text-muted"><th className="p-2">أ</th><th className="p-2">ب</th><th className="p-2">رقم</th><th className="p-2">الاسم</th><th className="p-2">النوع</th><th className="p-2">التاريخ</th><th className="p-2">الحالة</th><th className="p-2"><span className="sr-only">إجراءات</span></th></tr></thead>
              <tbody>
                {revs.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="p-2"><input type="radio" name="a" value={r.id} defaultChecked={a === r.id} aria-label={`النسخة ${r.number} كطرف أ`} /></td>
                    <td className="p-2"><input type="radio" name="b" value={r.id} defaultChecked={b === r.id} aria-label={`النسخة ${r.number} كطرف ب`} /></td>
                    <td className="p-2 font-bold tabular">{r.number}</td>
                    <td className="p-2">{r.label}</td>
                    <td className="p-2">{REASON[r.reason]}</td>
                    <td className="p-2">{formatDateTime(r.createdAt)}</td>
                    <td className="p-2">{r.isApproved ? <Badge tone={r.readyAtApproval ? "ok" : "warn"}>{r.readyAtApproval ? "معتمدة — جاهزة" : "معتمدة — مسودة"}</Badge> : <Badge>محفوظة</Badge>}</td>
                    <td className="p-2">{ctx.canEdit && <ActionButton size="sm" variant="ghost" label="استعادة" confirm={`استعادة النسخة ${r.number}؟ ستُحفظ الحالة الحالية كنسخة أولًا.`} action={restoreRevisionAction.bind(null, id, r.id)} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-3"><button type="submit" className="rounded-lg bg-brand-900 px-3 py-1.5 text-sm text-white">قارن النسختين المحددتين</button></div>
          </form>
        </Card>
      )}
      {compare && (
        <Card>
          <h2 className="mb-3 text-lg font-bold text-brand-900">المقارنة: النسخة {compare.na} ← النسخة {compare.nb}</h2>
          <dl className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
            {[["عدد المستفيدين", compare.A.application.beneficiaryCount, compare.B.application.beneficiaryCount], ["المدة", compare.A.application.durationMonths, compare.B.application.durationMonths], ["إجمالي الميزانية", formatSar(BigInt(compare.A.budget.total)), formatSar(BigInt(compare.B.budget.total))], ["المطلوب من المانح", formatSar(BigInt(compare.A.budget.donor)), formatSar(BigInt(compare.B.budget.donor))], ["عدد البنود", compare.A.budgetLines.length, compare.B.budgetLines.length], ["عدد الأنشطة", compare.A.activities.length, compare.B.activities.length]].map(([l, x, y]) => (
              <div key={String(l)} className={`rounded-lg p-2 ${x !== y ? "bg-warn-50" : "bg-paper"}`}><dt className="text-muted">{l}</dt><dd className="tabular">{String(x ?? "—")} ← {String(y ?? "—")}</dd></div>
            ))}
          </dl>
          {SECTIONS.map((s) => {
            const x = compare!.A.sections.find((q) => q.key === s.key)?.content ?? "";
            const y = compare!.B.sections.find((q) => q.key === s.key)?.content ?? "";
            if (x === y) return null;
            return <div key={s.key} className="mb-4"><h3 className="mb-1 font-bold">{s.label}</h3><TextDiff before={x} after={y} /></div>;
          })}
          {compare.A.questions.map((q) => {
            const x = q.answer?.content ?? "";
            const y = compare!.B.questions.find((z) => z.id === q.id)?.answer?.content ?? "";
            if (x === y) return null;
            return <div key={q.id} className="mb-4"><h3 className="mb-1 font-bold">إجابة: {q.text}</h3><TextDiff before={x} after={y} /></div>;
          })}
          <Link href={`/app/applications/${id}/revisions`} className="text-sm text-brand-700 underline">إغلاق المقارنة</Link>
        </Card>
      )}
    </div>
  );
}
