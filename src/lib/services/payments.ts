import "server-only";
import { randomBytes } from "node:crypto";
import type { OrderProduct } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { simulatedPaymentsAllowed } from "@/lib/env";
import { PRICING, pricingSnapshot } from "@/lib/pricing";

// حالات الطلب (Application) منفصلة عن حالات الدفع (Order/Payment) وعن حالات المراجعة (ReviewRequest).

export async function createOrder(args: { organizationId: string; applicationId: string; userId: string; product: OrderProduct }) {
  const existing = await db.order.findFirst({ where: { applicationId: args.applicationId, product: args.product, status: { in: ["PENDING", "PAID"] } } });
  if (existing) return existing;
  return db.order.create({
    data: {
      organizationId: args.organizationId, applicationId: args.applicationId, product: args.product,
      amountHalalas: PRICING[args.product].amountHalalas, currency: "SAR", pricingSnapshot: pricingSnapshot(args.product), createdById: args.userId,
    },
  });
}

export class PaymentError extends Error {}

/**
 * معالجة حدث دفع موثق. يتحقق من المبلغ والعملة والطلب، ويمنع المعالجة المكررة عبر providerRef فريد.
 * الضغط على زر أو العودة لصفحة نجاح ليس دليلًا على الدفع — هذه الدالة وحدها تغير الحالة.
 */
export async function processPaymentEvent(evt: { provider: string; providerRef: string; orderId: string; amountHalalas: bigint; currency: string; succeeded: boolean; isSimulated: boolean }) {
  return db.$transaction(async (tx) => {
    const dup = await tx.payment.findUnique({ where: { providerRef: evt.providerRef } });
    if (dup) return { duplicate: true, orderId: dup.orderId };
    const order = await tx.order.findUnique({ where: { id: evt.orderId } });
    if (!order) throw new PaymentError("طلب الشراء غير موجود");
    if (order.amountHalalas !== evt.amountHalalas || order.currency !== evt.currency) throw new PaymentError("المبلغ أو العملة لا يطابقان طلب الشراء");
    await tx.payment.create({
      data: { orderId: order.id, provider: evt.provider, providerRef: evt.providerRef, amountHalalas: evt.amountHalalas, currency: evt.currency, status: evt.succeeded ? "SUCCEEDED" : "FAILED", isSimulated: evt.isSimulated },
    });
    if (order.status !== "PAID") {
      await tx.order.update({ where: { id: order.id }, data: evt.succeeded ? { status: "PAID", paidAt: new Date() } : { status: "FAILED" } });
    }
    return { duplicate: false, orderId: order.id };
  });
}

/** دفع محاكى — بيئة التطوير فقط. «محاكاة — لا يتم تحصيل مبلغ» */
export async function simulatePayment(orderId: string, organizationId: string, userId: string, outcome: "success" | "failure") {
  if (!simulatedPaymentsAllowed()) throw new PaymentError("الدفع التجريبي غير متاح في هذه البيئة");
  const order = await db.order.findFirst({ where: { id: orderId, organizationId } });
  if (!order) throw new PaymentError("طلب الشراء غير موجود");
  if (order.status === "PAID") return { duplicate: true, orderId };
  const r = await processPaymentEvent({
    provider: "SIMULATED", providerRef: `sim_${randomBytes(12).toString("hex")}`, orderId: order.id,
    amountHalalas: order.amountHalalas, currency: order.currency, succeeded: outcome === "success", isSimulated: true,
  });
  await audit({ organizationId, userId, action: `payment.simulated.${outcome}`, targetType: "Order", targetId: order.id });
  return r;
}

export async function isPackagePaid(applicationId: string) {
  return !!(await db.order.findFirst({ where: { applicationId, product: "APPLICATION_PACKAGE", status: "PAID" } }));
}
