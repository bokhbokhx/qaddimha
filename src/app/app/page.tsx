import Link from "next/link";
import { db } from "@/lib/db";
import { orgPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { computeReadiness } from "@/lib/domain/readiness";
import { STAGES } from "@/lib/catalog";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const metadata = { title: "لوحة الجمعية" };

export default async function Dashboard(props: PageProps<"/app">) {
  const ctx = await orgPageContext();
  const sp = await props.searchParams;
  const apps = await db.application.findMany({
    where: { organizationId: ctx.orgId },
    include: { opportunity: true, revisions: { where: { isApproved: true }, orderBy: { number: "desc" }, take: 1 }, orders: { where: { status: "PAID" } } },
    orderBy: { updatedAt: "desc" },
  });
  const facts = await db.fact.findMany({ where: { organizationId: ctx.orgId, scopeRef: "org" } });
  const unconfirmed = facts.filter((f) => f.status === "EXTRACTED_UNCONFIRMED" || f.status === "CONFLICT").length;
  const missing = facts.filter((f) => f.status === "MISSING").length;
  const rows = await Promise.all(apps.map(async (a) => ({ a, r: computeReadiness(await buildSnapshot(a.id)) })));

  return (
    <div>
      <PageHeader
        title={`مرحبًا، ${ctx.org.displayName}`}
        description="طلبات الدعم وحالتها والنواقص التي تحتاج إجراءً."
        actions={ctx.canEdit && <LinkButton href="/app/applications/new">ابدأ طلبًا جديدًا</LinkButton>}
      />
      {sp.deleted && <div role="status" className="mb-4 rounded-xl bg-ok-50 p-3 text-sm text-ok-700">حُذف الطلب ومشتقاته.</div>}
      {(unconfirmed > 0 || missing > 0) && (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold text-brand-900">ملف الجمعية يحتاج مراجعة</div>
            <div className="text-sm text-muted">معلومات مستخرجة تحتاج تأكيدًا: {unconfirmed} · معلومات ناقصة: {missing}</div>
          </div>
          <LinkButton href="/app/organization" variant="secondary" size="sm">راجع ملف الجمعية</LinkButton>
        </Card>
      )}
      {!rows.length ? (
        <EmptyState title="لا توجد طلبات بعد" action={ctx.canEdit && <LinkButton href="/app/applications/new">ابدأ طلبًا جديدًا</LinkButton>}>
          ابدأ بإضافة فرصة التمويل التي تريد التقديم عليها. سنرشدك خطوة بخطوة.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map(({ a, r }) => {
            const stage = STAGES.find((s) => s.key === a.stage);
            return (
              <Card key={a.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link href={`/app/applications/${a.id}`} className="text-lg font-bold text-brand-900 hover:underline">{a.title}</Link>
                    <div className="text-sm text-muted">{a.opportunity.funderName} — {a.opportunity.title}</div>
                  </div>
                  <Badge tone={r.ready ? "ok" : "warn"}>{r.ready ? "جاهز للتقديم" : "قيد الإعداد"}</Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-muted">المرحلة</dt><dd className="font-medium">{stage?.label}</dd></div>
                  <div><dt className="text-muted">العوائق</dt><dd className="font-medium tabular">{r.blockers.length}</dd></div>
                  <div><dt className="text-muted">اكتمال المعروف</dt><dd className="font-medium tabular">{r.completionPct}%</dd></div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {a.revisions[0] ? <Badge tone="brand">آخر نسخة معتمدة: {a.revisions[0].number}</Badge> : <Badge>لا توجد نسخة معتمدة</Badge>}
                  {a.orders.some((o) => o.product === "APPLICATION_PACKAGE") && <Badge tone="ok">الحزمة مدفوعة</Badge>}
                  <span className="text-muted">آخر تحديث {formatDateTime(a.updatedAt)}</span>
                </div>
                {r.blockers.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
                    {r.blockers.slice(0, 3).map((b) => <li key={b.id} className="text-danger-700">• {b.label}: {b.message}</li>)}
                    {r.blockers.length > 3 && <li className="text-muted">و{r.blockers.length - 3} عوائق أخرى</li>}
                  </ul>
                )}
                <div className="mt-4"><LinkButton href={`/app/applications/${a.id}`} size="sm" variant="secondary">متابعة الطلب</LinkButton></div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
