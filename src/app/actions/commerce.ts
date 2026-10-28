"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin, requireApplication, requireExpertReview } from "@/lib/auth/guard";
import { run } from "@/lib/action-result";
import { createOrder, simulatePayment } from "@/lib/services/payments";
import { addReviewComment, assignExpert, requestExpertReview, setReviewStatus } from "@/lib/services/reviews";

export async function createOrderAction(applicationId: string, product: "APPLICATION_PACKAGE" | "EXPERT_REVIEW") {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "OWNER");
    const o = await createOrder({ organizationId: ctx.orgId, applicationId, userId: ctx.user.id, product: z.enum(["APPLICATION_PACKAGE", "EXPERT_REVIEW"]).parse(product) });
    revalidatePath(`/app/applications/${applicationId}`, "layout");
    return o.id;
  });
}

/** الدفع المحاكى: لا يتم تحصيل أي مبلغ. متاح في بيئة التطوير فقط. */
export async function simulatePaymentAction(applicationId: string, orderId: string, outcome: "success" | "failure") {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "OWNER");
    const order = await db.order.findFirst({ where: { id: orderId, applicationId } });
    if (!order) throw new Error("طلب الشراء غير موجود");
    await simulatePayment(orderId, ctx.orgId, ctx.user.id, outcome);
    revalidatePath(`/app/applications/${applicationId}`, "layout");
    const after = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    return after.status;
  });
}

export async function requestReviewAction(applicationId: string, input: { revisionId: string; consent: boolean; sharedDocIds: string[]; notes: string }) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "OWNER");
    await requestExpertReview({ applicationId, organizationId: ctx.orgId, userId: ctx.user.id, ...input });
    revalidatePath(`/app/applications/${applicationId}`, "layout");
  }, "أُرسل طلب المراجعة. سيظهر هنا عند إسناده لخبير.");
}

export async function orgReplyAction(applicationId: string, reviewRequestId: string, sectionKey: string, body: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const rr = await db.reviewRequest.findFirst({ where: { id: reviewRequestId, applicationId } });
    if (!rr) throw new Error("طلب المراجعة غير موجود");
    await addReviewComment({ reviewRequestId, sectionKey, authorId: ctx.user.id, authorRole: "ORG", body });
    if (rr.status === "NEEDS_INFO") await setReviewStatus(rr.id, "IN_REVIEW");
    revalidatePath(`/app/applications/${applicationId}`, "layout");
  }, "أُرسل الرد");
}

export async function expertCommentAction(reviewRequestId: string, sectionKey: string, body: string) {
  return run(async () => {
    const ctx = await requireExpertReview(reviewRequestId);
    if (ctx.review.status === "COMPLETED") throw new Error("المراجعة مكتملة");
    await addReviewComment({ reviewRequestId, sectionKey, authorId: ctx.user.id, authorRole: "EXPERT", body });
    revalidatePath(`/expert/reviews/${reviewRequestId}`);
  }, "أُضيف التعليق");
}

export async function expertStatusAction(reviewRequestId: string, status: "IN_REVIEW" | "NEEDS_INFO" | "COMPLETED") {
  return run(async () => {
    await requireExpertReview(reviewRequestId);
    // الخبير لا يغير اعتماد الجمعية ولا محتوى الطلب — يغير حالة المراجعة فقط
    await setReviewStatus(reviewRequestId, z.enum(["IN_REVIEW", "NEEDS_INFO", "COMPLETED"]).parse(status));
    revalidatePath(`/expert/reviews/${reviewRequestId}`);
  }, "تم تحديث الحالة");
}

export async function assignExpertAction(reviewRequestId: string, expertUserId: string) {
  return run(async () => {
    const ctx = await requireAdmin();
    await assignExpert(reviewRequestId, expertUserId, ctx.user.id);
    revalidatePath("/ops");
  }, "أُسند الطلب");
}
