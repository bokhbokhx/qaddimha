import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export async function requestExpertReview(args: { applicationId: string; organizationId: string; userId: string; revisionId: string; consent: boolean; sharedDocIds: string[]; notes: string }) {
  if (!args.consent) throw new Error("يلزم موافقتك على مشاركة النسخة والمرفقات المحددة مع الخبير");
  const rev = await db.revision.findFirst({ where: { id: args.revisionId, applicationId: args.applicationId } });
  if (!rev) throw new Error("النسخة غير موجودة");
  const order = await db.order.findFirst({ where: { applicationId: args.applicationId, product: "EXPERT_REVIEW", status: "PAID" } });
  if (!order) throw new Error("مراجعة الخبير إضافة مدفوعة. أكمل الدفع أولًا.");
  const used = await db.reviewRequest.findFirst({ where: { orderId: order.id } });
  if (used) throw new Error("تم استخدام هذه المراجعة. يمكنك شراء مراجعة جديدة.");
  // المرفقات المشاركة يجب أن تتبع الجمعية نفسها
  const docs = await db.document.findMany({ where: { id: { in: args.sharedDocIds }, organizationId: args.organizationId }, select: { id: true } });
  const rr = await db.reviewRequest.create({
    data: {
      applicationId: args.applicationId, revisionId: rev.id, consentAt: new Date(), consentById: args.userId,
      sharedDocIds: docs.map((d) => d.id), notes: args.notes.slice(0, 2000), orderId: order.id,
    },
  });
  await audit({ organizationId: args.organizationId, userId: args.userId, action: "review.request", targetType: "ReviewRequest", targetId: rr.id });
  return rr;
}

export async function assignExpert(reviewRequestId: string, expertUserId: string, adminId: string) {
  const expert = await db.user.findFirst({ where: { id: expertUserId, platformRole: "EXPERT" } });
  if (!expert) throw new Error("المستخدم ليس خبيرًا");
  const rr = await db.reviewRequest.update({ where: { id: reviewRequestId }, data: { expertUserId, status: "IN_REVIEW" } });
  await audit({ userId: adminId, action: "review.assign", targetType: "ReviewRequest", targetId: rr.id });
  return rr;
}

export async function addReviewComment(args: { reviewRequestId: string; sectionKey: string; authorId: string; authorRole: "EXPERT" | "ORG"; body: string }) {
  if (!args.body.trim()) throw new Error("التعليق فارغ");
  return db.reviewComment.create({ data: { ...args, body: args.body.trim().slice(0, 5000) } });
}

export async function setReviewStatus(reviewRequestId: string, status: "IN_REVIEW" | "NEEDS_INFO" | "COMPLETED") {
  return db.reviewRequest.update({ where: { id: reviewRequestId }, data: { status } });
}
