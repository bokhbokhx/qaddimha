import Link from "next/link";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/guard";
import { formatDateTime } from "@/lib/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { ReviewStatus } from "@/components/status";

export const metadata = { title: "المراجعات المسندة" };

export default async function ExpertHome() {
  const { user } = await requireUserPage();
  const reviews = await db.reviewRequest.findMany({ where: { expertUserId: user.id }, include: { revision: { select: { number: true } }, application: { select: { title: true } } }, orderBy: { updatedAt: "desc" } });
  return (
    <div>
      <PageHeader title="المراجعات المسندة إليك" description="ترى فقط النسخ والمرفقات التي وافقت الجمعيات على مشاركتها معك." />
      {!reviews.length ? <EmptyState title="لا توجد مراجعات مسندة" /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id}>
              <div className="flex justify-between gap-2"><Link href={`/expert/reviews/${r.id}`} className="font-bold text-brand-900 hover:underline">{r.application.title}</Link><ReviewStatus status={r.status} /></div>
              <div className="text-sm text-muted">النسخة {r.revision.number} · {formatDateTime(r.createdAt)}</div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
