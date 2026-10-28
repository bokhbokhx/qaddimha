import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { LIMITS } from "@/lib/pricing";
import { computeReadiness } from "@/lib/domain/readiness";
import type { Snapshot } from "@/lib/domain/types";
import { buildSnapshot, snapshotHash } from "./snapshot";

type Tx = Prisma.TransactionClient;

export class ConflictError extends Error {
  constructor(message = "تم تعديل هذه البيانات من مكان آخر. حدّث الصفحة لرؤية آخر نسخة، وتعديلك محفوظ في المسودة المحلية.") {
    super(message);
  }
}

/** يزيد إصدار الطلب بشرط مطابقة الإصدار المتوقع — يمنع فقد التحديثات المتزامنة */
export async function bumpVersion(tx: Tx, applicationId: string, expectedVersion?: number) {
  if (expectedVersion == null) {
    await tx.application.update({ where: { id: applicationId }, data: { version: { increment: 1 }, readinessValid: false } });
    return;
  }
  const r = await tx.application.updateMany({
    where: { id: applicationId, version: expectedVersion },
    data: { version: { increment: 1 }, readinessValid: false },
  });
  if (r.count === 0) throw new ConflictError();
}

export async function createRevision(
  tx: Tx,
  applicationId: string,
  userId: string,
  opts: { label: string; reason: "AUTO_BEFORE_CHANGE" | "MANUAL" | "APPROVAL" | "RESTORE"; approve?: boolean },
) {
  const snapshot = await buildSnapshot(applicationId, tx);
  const last = await tx.revision.findFirst({ where: { applicationId }, orderBy: { number: "desc" } });
  const ready = computeReadiness(snapshot).ready;
  if (opts.approve) {
    const approvedCount = await tx.revision.count({ where: { applicationId, isApproved: true } });
    if (approvedCount >= LIMITS.approvedRevisionsPerApplication)
      throw new Error(`بلغت حد النسخ المعتمدة (${LIMITS.approvedRevisionsPerApplication})`);
  }
  return tx.revision.create({
    data: {
      applicationId,
      number: (last?.number ?? 0) + 1,
      label: opts.label,
      reason: opts.reason,
      snapshot: snapshot as unknown as Prisma.InputJsonValue,
      contentHash: snapshotHash(snapshot),
      isApproved: !!opts.approve,
      readyAtApproval: opts.approve ? ready : false,
      createdById: userId,
    },
  });
}

export function getRevisionSnapshot(rev: { snapshot: unknown }): Snapshot {
  return rev.snapshot as Snapshot;
}

/** استعادة نسخة: تُحفظ الحالة الحالية أولًا ثم تُستبدل محتويات الطلب */
export async function restoreRevision(applicationId: string, revisionId: string, userId: string) {
  return db.$transaction(async (tx) => {
    const rev = await tx.revision.findFirstOrThrow({ where: { id: revisionId, applicationId } });
    const s = getRevisionSnapshot(rev);
    await createRevision(tx, applicationId, userId, { label: `قبل استعادة النسخة ${rev.number}`, reason: "AUTO_BEFORE_CHANGE" });

    await tx.application.update({
      where: { id: applicationId },
      data: {
        title: s.application.title, beneficiaryCount: s.application.beneficiaryCount, durationMonths: s.application.durationMonths,
        region: s.application.region, ideaSummary: s.application.ideaSummary, ideaApproved: s.application.ideaApproved,
        version: { increment: 1 }, readinessValid: false,
      },
    });
    await tx.projectSection.deleteMany({ where: { applicationId } });
    await tx.projectSection.createMany({ data: s.sections.map((x) => ({ applicationId, key: x.key, content: x.content, status: x.status, isEstimate: x.isEstimate, origin: x.origin as never, reviewReason: x.reviewReason })) });
    await tx.budgetLine.deleteMany({ where: { applicationId } });
    await tx.indicator.deleteMany({ where: { applicationId } });
    await tx.activity.deleteMany({ where: { applicationId } });
    await tx.partner.deleteMany({ where: { applicationId } });
    await tx.activity.createMany({ data: s.activities.map((a, i) => ({ ...a, applicationId, sortOrder: i })) });
    await tx.partner.createMany({ data: s.partners.map((p) => ({ ...p, cashHalalas: BigInt(p.cashHalalas), applicationId })) });
    await tx.indicator.createMany({ data: s.indicators.map((x, i) => ({ ...x, applicationId, sortOrder: i })) });
    await tx.budgetLine.createMany({
      data: s.budgetLines.map((l, i) => {
        const { totalHalalas: _t, ...rest } = l;
        void _t;
        return { ...rest, quantityMilli: BigInt(l.quantityMilli), unitCostHalalas: BigInt(l.unitCostHalalas), applicationId, sortOrder: i };
      }),
    });
    await tx.formAnswer.deleteMany({ where: { applicationId } });
    await tx.formAnswer.createMany({
      data: s.questions.filter((q) => q.answer).map((q) => ({ applicationId, questionId: q.id, content: q.answer!.content, status: q.answer!.status, staleReason: q.answer!.staleReason })),
      skipDuplicates: true,
    });
    await tx.requirementAssessment.deleteMany({ where: { applicationId, decidedBy: "USER" } });
    await tx.requirementAssessment.createMany({
      data: s.requirements.filter((r) => r.userAssessment).map((r) => ({
        applicationId, requirementId: r.id, result: r.userAssessment!.result as never, evidence: r.userAssessment!.evidence, nextAction: r.userAssessment!.nextAction, decidedBy: "USER", decidedById: userId,
      })),
      skipDuplicates: true,
    });
    return createRevision(tx, applicationId, userId, { label: `استعادة النسخة ${rev.number}`, reason: "RESTORE" });
  });
}
