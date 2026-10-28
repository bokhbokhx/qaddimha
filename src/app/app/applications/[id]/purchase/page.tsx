import { db } from "@/lib/db";
import { appPageContext } from "@/lib/page-context";
import { buildSnapshot } from "@/lib/services/snapshot";
import { computeReadiness } from "@/lib/domain/readiness";
import { PRICING, PRICING_IS_DEMO, LIMITS } from "@/lib/pricing";
import { simulatedPaymentsAllowed } from "@/lib/env";
import { ORDER_STATUS_LABEL } from "@/lib/catalog";
import { formatSar } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { Badge, Card, Notice, PageHeader } from "@/components/ui";
import { ActionButton } from "@/components/client/action-button";
import { createOrderAction, simulatePaymentAction } from "../../../../actions/commerce";

export default async function PurchasePage(props: PageProps<"/app/applications/[id]/purchase">) {
  const { id } = await props.params;
  const ctx = await appPageContext(id);
  const r = computeReadiness(await buildSnapshot(id));
  const orders = await db.order.findMany({ where: { applicationId: id }, include: { payments: true }, orderBy: { createdAt: "desc" } });
  const sim = simulatedPaymentsAllowed();
  const products = ["APPLICATION_PACKAGE", "EXPERT_REVIEW"] as const;

  return (
    <div className="space-y-6">
      <PageHeader title="الشراء" description="رسم ثابت لكل طلب تمويل لمشروع واحد لدى جهة واحدة. لا عمولة على قيمة المنحة." />
      {PRICING_IS_DEMO && <Notice tone="gold" title="أسعار تجريبية">الأسعار المعروضة بيانات تجريبية للتطوير وليست تسعيرًا معتمدًا.</Notice>}
      <Card>
        <h2 className="mb-2 font-bold text-brand-900">الفحص الأولي قبل الشراء</h2>
        <p className="text-sm">{r.ready ? "لا توجد عوائق حالية." : `توجد ${r.blockers.length} عوائق حالية (منها ${r.items.filter((i) => i.group === "eligibility" && i.status === "blocker").length} في الأهلية والمتطلبات). يمكنك الشراء ومتابعة العمل، لكن التصدير يبقى «مسودة» حتى تُعالج.`}</p>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {products.map((p) => {
          const info = PRICING[p];
          const order = orders.find((o) => o.product === p && (o.status === "PENDING" || o.status === "PAID"));
          return (
            <Card key={p}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-bold text-brand-900">{info.name}{p === "EXPERT_REVIEW" && <span className="text-sm font-normal text-muted"> (إضافة اختيارية)</span>}</h2>
                {order && <Badge tone={order.status === "PAID" ? "ok" : "warn"}>{ORDER_STATUS_LABEL[order.status]}</Badge>}
              </div>
              <div className="my-2 text-2xl font-bold tabular">{formatSar(info.amountHalalas)}</div>
              <h3 className="text-sm font-bold">يشمل</h3>
              <ul className="mb-2 list-disc pe-5 text-sm">{info.scope.map((x) => <li key={x}>{x}</li>)}</ul>
              <h3 className="text-sm font-bold">لا يشمل</h3>
              <ul className="mb-3 list-disc pe-5 text-sm text-muted">{info.excludes.map((x) => <li key={x}>{x}</li>)}</ul>
              {ctx.isOwner ? (
                order?.status === "PAID" ? <p className="text-sm text-ok-700">مدفوع{order.payments.some((x) => x.isSimulated) ? " (محاكاة — لم يُحصّل مبلغ)" : ""} في {formatDateTime(order.paidAt)}.</p>
                : order ? (
                  sim ? (
                    <div className="space-y-2 rounded-xl border-2 border-dashed border-gold-400 p-3">
                      <div className="text-sm font-bold text-gold-600">محاكاة — لا يتم تحصيل مبلغ</div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton size="sm" variant="gold" label="محاكاة دفع ناجح" action={simulatePaymentAction.bind(null, id, order.id, "success")} />
                        <ActionButton size="sm" variant="secondary" label="محاكاة دفع فاشل" action={simulatePaymentAction.bind(null, id, order.id, "failure")} />
                      </div>
                    </div>
                  ) : <Notice tone="warn">لا يوجد مزود دفع حقيقي مهيأ في هذه البيئة. الدفع غير متاح حاليًا.</Notice>
                ) : <ActionButton label="إنشاء طلب شراء" action={createOrderAction.bind(null, id, p)} />
              ) : <p className="text-sm text-muted">الشراء متاح لمالك الجمعية فقط.</p>}
            </Card>
          );
        })}
      </div>
      <Card>
        <h2 className="mb-2 font-bold text-brand-900">حدود الاستخدام لهذا الطلب</h2>
        <ul className="text-sm">
          <li>عمليات المساعد المستخدمة: <span className="tabular">{ctx.app.aiActionsUsed}</span> من <span className="tabular">{orders.some((o) => o.product === "APPLICATION_PACKAGE" && o.status === "PAID") ? LIMITS.aiActionsPerApplication : LIMITS.aiActionsBeforePurchase}</span></li>
          <li>النسخ المعتمدة المسموحة: <span className="tabular">{LIMITS.approvedRevisionsPerApplication}</span></li>
        </ul>
      </Card>
      {orders.length > 0 && (
        <Card>
          <h2 className="mb-2 font-bold text-brand-900">سجل المدفوعات</h2>
          <ul className="divide-y divide-line text-sm">
            {orders.flatMap((o) => o.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{PRICING[o.product].name} — {p.status === "SUCCEEDED" ? "ناجح" : "فاشل"}{p.isSimulated ? " (محاكاة)" : ""}</span>
                <span className="text-muted">{formatSar(p.amountHalalas)} · {formatDateTime(p.createdAt)}</span>
              </li>
            )))}
          </ul>
        </Card>
      )}
    </div>
  );
}
