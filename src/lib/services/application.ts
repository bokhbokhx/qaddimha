import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { SECTIONS } from "@/lib/catalog";
import { parseQuantityToMilli, parseSarToHalalas } from "@/lib/money";
import { checkLimit } from "@/lib/text-limits";
import { analyzeImpact, type Change } from "@/lib/domain/impact";
import { USER_DECIDABLE_RULES } from "@/lib/domain/requirements";
import { buildProfileSnapshot } from "./snapshot";
import { bumpVersion, ConflictError, createRevision } from "./revisions";

type Tx = Prisma.TransactionClient;

export async function createApplication(args: { organizationId: string; userId: string; opportunityId: string; title: string }) {
  const opp = await db.fundingOpportunity.findFirst({ where: { id: args.opportunityId, organizationId: args.organizationId } });
  if (!opp) throw new Error("الفرصة غير موجودة");
  const ps = await buildProfileSnapshot(args.organizationId);
  const app = await db.application.create({
    data: {
      organizationId: args.organizationId,
      opportunityId: opp.id,
      title: args.title,
      stage: "EXTRACTION_REVIEW",
      profileSnapshot: ps as unknown as Prisma.InputJsonValue,
      sections: { create: SECTIONS.map((s) => ({ key: s.key })) },
      conversations: { create: { purpose: "IDEA" } },
    },
  });
  await audit({ organizationId: args.organizationId, userId: args.userId, action: "application.create", targetType: "Application", targetId: app.id });
  return app;
}

export async function refreshProfileSnapshot(applicationId: string, organizationId: string, userId: string) {
  await db.$transaction(async (tx) => {
    await createRevision(tx, applicationId, userId, { label: "قبل تحديث بيانات الجمعية", reason: "AUTO_BEFORE_CHANGE" });
    const ps = await buildProfileSnapshot(organizationId, tx);
    await tx.application.update({ where: { id: applicationId }, data: { profileSnapshot: ps as unknown as Prisma.InputJsonValue, version: { increment: 1 }, readinessValid: false } });
  });
}

/** يعلم الإجابات المرتبطة بقسم بأنها قديمة إن كانت معتمدة */
async function staleLinkedAnswers(tx: Tx, applicationId: string, sectionKeys: string[], reason: string) {
  if (!sectionKeys.length) return;
  const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId }, select: { opportunityId: true } });
  const qs = await tx.formQuestion.findMany({ where: { opportunityId: app.opportunityId, linkedSections: { hasSome: sectionKeys } }, select: { id: true } });
  await tx.formAnswer.updateMany({
    where: { applicationId, questionId: { in: qs.map((q) => q.id) }, status: { in: ["APPROVED", "DRAFT"] } },
    data: { status: "STALE", staleReason: reason },
  });
}

// ===== المدخلات المؤثرة وتحليل الأثر =====

export async function updateKeyParams(args: {
  applicationId: string;
  userId: string;
  expectedVersion: number;
  beneficiaryCount?: number | null;
  durationMonths?: number | null;
  region?: string | null;
}) {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({
      where: { id: args.applicationId },
      include: { sections: true, answers: true, indicators: true, budgetLines: true, opportunity: { include: { questions: true } } },
    });
    if (app.version !== args.expectedVersion) throw new ConflictError();
    const changes: Change[] = [];
    if (args.beneficiaryCount !== undefined && args.beneficiaryCount !== app.beneficiaryCount && args.beneficiaryCount != null)
      changes.push({ type: "beneficiaries", from: app.beneficiaryCount, to: args.beneficiaryCount });
    if (args.durationMonths !== undefined && args.durationMonths !== app.durationMonths && args.durationMonths != null)
      changes.push({ type: "duration", from: app.durationMonths, to: args.durationMonths });
    if (args.region !== undefined && args.region !== app.region && args.region)
      changes.push({ type: "region", from: app.region, to: args.region });
    if (!changes.length) return { changed: false, impacts: [] };

    // نسخة قبل التطبيق — تسمح بالتراجع
    const hasContent = app.sections.some((s) => s.content.trim()) || app.budgetLines.length > 0;
    if (hasContent) await createRevision(tx, app.id, args.userId, { label: `قبل: ${changes.map((c) => c.type).join("، ")}`, reason: "AUTO_BEFORE_CHANGE" });

    const state = {
      sections: app.sections,
      questions: app.opportunity.questions.map((q) => {
        const a = app.answers.find((x) => x.questionId === q.id);
        return { id: q.id, linkedSections: q.linkedSections, answer: a ? { content: a.content, status: a.status } : null };
      }),
      indicators: app.indicators,
      budgetLines: app.budgetLines,
    };
    const impacts = changes.map((c) => analyzeImpact(c, state));

    await tx.application.update({
      where: { id: app.id },
      data: {
        beneficiaryCount: args.beneficiaryCount === undefined ? undefined : args.beneficiaryCount,
        durationMonths: args.durationMonths === undefined ? undefined : args.durationMonths,
        region: args.region === undefined ? undefined : args.region,
        version: { increment: 1 },
        readinessValid: false,
      },
    });

    for (const imp of impacts) {
      // الحسابات المباشرة فورًا
      for (const r of imp.budgetRecalc) {
        await tx.budgetLine.update({ where: { id: r.id }, data: r.field === "periods" ? { periods: Number(r.to) } : { quantityMilli: BigInt(r.to) } });
      }
      // النصوص: وسم «تحتاج مراجعة» + مقترحات قبل/بعد
      for (const s of imp.sectionsToReview) {
        await tx.projectSection.updateMany({
          where: { applicationId: app.id, key: s.key, status: { not: "EMPTY" } },
          data: { status: "NEEDS_REVIEW", reviewReason: s.reason },
        });
      }
      for (const a of imp.answersToStale) {
        await tx.formAnswer.updateMany({ where: { applicationId: app.id, questionId: a.questionId }, data: { status: "STALE", staleReason: a.reason } });
      }
      if (imp.indicatorsToReview.length) await tx.indicator.updateMany({ where: { id: { in: imp.indicatorsToReview } }, data: { needsReview: true } });
      for (const p of imp.proposals) {
        await tx.changeProposal.create({
          data: { applicationId: app.id, trigger: imp.label, targetType: p.targetType, targetId: p.targetId, before: p.before, after: p.after, explanation: p.explanation },
        });
      }
    }
    return { changed: true, impacts };
  });
}

export async function applyProposal(applicationId: string, proposalId: string, userId: string) {
  await db.$transaction(async (tx) => {
    const p = await tx.changeProposal.findFirstOrThrow({ where: { id: proposalId, applicationId, status: "PENDING" } });
    await createRevision(tx, applicationId, userId, { label: `قبل تطبيق مقترح: ${p.trigger}`, reason: "AUTO_BEFORE_CHANGE" });
    if (p.targetType === "SECTION") {
      const sec = await tx.projectSection.findUniqueOrThrow({ where: { applicationId_key: { applicationId, key: p.targetId } } });
      if (sec.content !== p.before) throw new ConflictError("تغير نص القسم بعد إنشاء المقترح. راجع القسم يدويًا.");
      await tx.projectSection.update({ where: { id: sec.id }, data: { content: p.after, status: "DRAFT", version: { increment: 1 } } });
    } else if (p.targetType === "ANSWER") {
      const ans = await tx.formAnswer.findUniqueOrThrow({ where: { applicationId_questionId: { applicationId, questionId: p.targetId } } });
      if (ans.content !== p.before) throw new ConflictError("تغيرت الإجابة بعد إنشاء المقترح. راجعها يدويًا.");
      await tx.formAnswer.update({ where: { id: ans.id }, data: { content: p.after, status: "DRAFT", staleReason: null, version: { increment: 1 } } });
    }
    await tx.changeProposal.update({ where: { id: p.id }, data: { status: "APPLIED" } });
    await bumpVersion(tx, applicationId);
  });
}

export async function rejectProposal(applicationId: string, proposalId: string) {
  await db.changeProposal.updateMany({ where: { id: proposalId, applicationId, status: "PENDING" }, data: { status: "REJECTED" } });
}

// ===== الأقسام =====

export async function saveSection(args: { applicationId: string; key: string; content: string; expectedVersion: number }) {
  return db.$transaction(async (tx) => {
    const r = await tx.projectSection.updateMany({
      where: { applicationId: args.applicationId, key: args.key, version: args.expectedVersion },
      data: { content: args.content, status: args.content.trim() ? "DRAFT" : "EMPTY", version: { increment: 1 } },
    });
    if (r.count === 0) throw new ConflictError();
    await staleLinkedAnswers(tx, args.applicationId, [args.key], `تعديل قسم المشروع`);
    await bumpVersion(tx, args.applicationId);
    return tx.projectSection.findUniqueOrThrow({ where: { applicationId_key: { applicationId: args.applicationId, key: args.key } } });
  });
}

/** اعتماد القسم يعني أن الجمعية راجعت محتواه وأرقامه التقديرية */
export async function approveSection(applicationId: string, key: string) {
  return db.$transaction(async (tx) => {
    const sec = await tx.projectSection.findUniqueOrThrow({ where: { applicationId_key: { applicationId, key } } });
    if (!sec.content.trim()) throw new Error("لا يمكن اعتماد قسم فارغ");
    if (/\[يحتاج استكمال/.test(sec.content)) throw new Error("القسم يحتوي موضعًا «يحتاج استكمال». أكمله أولًا.");
    await tx.projectSection.update({ where: { id: sec.id }, data: { status: "APPROVED", isEstimate: false, reviewReason: null } });
    await tx.changeProposal.updateMany({ where: { applicationId, targetType: "SECTION", targetId: key, status: "PENDING" }, data: { status: "REJECTED" } });
    await bumpVersion(tx, applicationId);
  });
}

// ===== الأنشطة والمؤشرات =====

export async function upsertActivity(applicationId: string, data: { id?: string; code: string; name: string; description: string; startMonth: number; endMonth: number; responsible: string; outputs: string }) {
  return db.$transaction(async (tx) => {
    if (data.startMonth < 1 || data.endMonth < data.startMonth) throw new Error("نطاق الأشهر غير صالح");
    const { id, ...rest } = data;
    const res = id
      ? await tx.activity.update({ where: { id, applicationId }, data: rest })
      : await tx.activity.create({ data: { ...rest, applicationId, sortOrder: await tx.activity.count({ where: { applicationId } }) } });
    await bumpVersion(tx, applicationId);
    return res;
  });
}

export async function deleteActivity(applicationId: string, activityId: string, userId: string, expectedVersion: number) {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId }, include: { sections: true, indicators: true, budgetLines: true, answers: true, opportunity: { include: { questions: true } } } });
    if (app.version !== expectedVersion) throw new ConflictError();
    const act = await tx.activity.findFirstOrThrow({ where: { id: activityId, applicationId } });
    await createRevision(tx, applicationId, userId, { label: `قبل حذف النشاط ${act.code}`, reason: "AUTO_BEFORE_CHANGE" });
    const imp = analyzeImpact(
      { type: "activity_deleted", activityId, code: act.code, name: act.name },
      {
        sections: app.sections,
        questions: app.opportunity.questions.map((q) => {
          const a = app.answers.find((x) => x.questionId === q.id);
          return { id: q.id, linkedSections: q.linkedSections, answer: a ? { content: a.content, status: a.status } : null };
        }),
        indicators: app.indicators,
        budgetLines: app.budgetLines,
      },
    );
    if (imp.indicatorsToReview.length) await tx.indicator.updateMany({ where: { id: { in: imp.indicatorsToReview } }, data: { needsReview: true } });
    if (imp.budgetLinesToReview.length) await tx.budgetLine.updateMany({ where: { id: { in: imp.budgetLinesToReview } }, data: { needsReview: true } });
    for (const s of imp.sectionsToReview)
      await tx.projectSection.updateMany({ where: { applicationId, key: s.key, status: { not: "EMPTY" } }, data: { status: "NEEDS_REVIEW", reviewReason: s.reason } });
    for (const a of imp.answersToStale)
      await tx.formAnswer.updateMany({ where: { applicationId, questionId: a.questionId }, data: { status: "STALE", staleReason: a.reason } });
    await tx.activity.delete({ where: { id: activityId } });
    await bumpVersion(tx, applicationId);
    return imp;
  });
}

export async function upsertIndicator(applicationId: string, data: { id?: string; name: string; type: "OUTPUT" | "OUTCOME"; baseline: string | null; target: string; unit: string; method: string; activityId: string | null }) {
  return db.$transaction(async (tx) => {
    if (data.activityId) await tx.activity.findFirstOrThrow({ where: { id: data.activityId, applicationId } });
    const { id, ...rest } = data;
    // التعديل اليدوي يعني مراجعة المستخدم
    const res = id
      ? await tx.indicator.update({ where: { id, applicationId }, data: { ...rest, needsReview: false } })
      : await tx.indicator.create({ data: { ...rest, applicationId, sortOrder: await tx.indicator.count({ where: { applicationId } }) } });
    await bumpVersion(tx, applicationId);
    return res;
  });
}

export async function approveIndicator(applicationId: string, id: string) {
  await db.$transaction(async (tx) => {
    await tx.indicator.update({ where: { id, applicationId }, data: { isEstimate: false, needsReview: false } });
    await bumpVersion(tx, applicationId);
  });
}

export async function deleteIndicator(applicationId: string, id: string) {
  await db.$transaction(async (tx) => {
    await tx.indicator.delete({ where: { id, applicationId } });
    await bumpVersion(tx, applicationId);
  });
}

// ===== الميزانية =====

export interface BudgetLineForm {
  id?: string;
  item: string; costCenter: string; activityId: string | null; partnerId: string | null; unit: string;
  quantity: string; unitCostSar: string; calc: "ONE_TIME" | "RECURRING"; periods: number;
  fundingSource: "DONOR" | "SELF" | "PARTNER"; contributionType: "CASH" | "IN_KIND";
  justification: string; periodsFollowDuration: boolean; quantityFollowsBeneficiaries: boolean;
}

export async function saveBudgetLine(applicationId: string, f: BudgetLineForm, expectedVersion: number) {
  return db.$transaction(async (tx) => {
    await bumpVersion(tx, applicationId, expectedVersion);
    const app = await tx.application.findUniqueOrThrow({ where: { id: applicationId }, select: { durationMonths: true, beneficiaryCount: true } });
    if (f.activityId) await tx.activity.findFirstOrThrow({ where: { id: f.activityId, applicationId } });
    if (f.partnerId) await tx.partner.findFirstOrThrow({ where: { id: f.partnerId, applicationId } });
    let quantityMilli = parseQuantityToMilli(f.quantity);
    let periods = f.calc === "RECURRING" ? Math.max(1, Math.trunc(f.periods)) : 1;
    if (f.periodsFollowDuration && f.calc === "RECURRING" && app.durationMonths) periods = app.durationMonths;
    if (f.quantityFollowsBeneficiaries && app.beneficiaryCount) quantityMilli = BigInt(app.beneficiaryCount) * 1000n;
    const unitCostHalalas = parseSarToHalalas(f.unitCostSar);
    if (unitCostHalalas < 0n) throw new Error("تكلفة الوحدة لا تكون سالبة");
    const contributionType = f.fundingSource === "DONOR" ? "CASH" : f.contributionType;
    const data = {
      item: f.item.trim(), costCenter: f.costCenter.trim(), activityId: f.activityId, partnerId: f.fundingSource === "PARTNER" ? f.partnerId : null, unit: f.unit.trim(),
      quantityMilli, unitCostHalalas, calc: f.calc, periods, fundingSource: f.fundingSource, contributionType,
      justification: f.justification.trim(), periodsFollowDuration: f.calc === "RECURRING" && f.periodsFollowDuration,
      quantityFollowsBeneficiaries: f.quantityFollowsBeneficiaries,
      // تعديل المستخدم للبند يعني مراجعته: يزول وسم «تحتاج مراجعة»، ويبقى «تقديري» حتى الاعتماد الصريح
      needsReview: false,
    };
    if (!data.item) throw new Error("اسم البند مطلوب");
    return f.id
      ? tx.budgetLine.update({ where: { id: f.id, applicationId }, data })
      : tx.budgetLine.create({ data: { ...data, applicationId, sortOrder: await tx.budgetLine.count({ where: { applicationId } }) } });
  });
}

export async function deleteBudgetLine(applicationId: string, id: string, expectedVersion: number) {
  await db.$transaction(async (tx) => {
    await bumpVersion(tx, applicationId, expectedVersion);
    await tx.budgetLine.delete({ where: { id, applicationId } });
  });
}

export async function approveBudgetLines(applicationId: string, ids: string[], expectedVersion: number) {
  await db.$transaction(async (tx) => {
    await bumpVersion(tx, applicationId, expectedVersion);
    await tx.budgetLine.updateMany({ where: { id: { in: ids }, applicationId }, data: { isEstimate: false, needsReview: false } });
  });
}

// ===== الشركاء =====

export async function savePartner(applicationId: string, f: {
  id?: string; name: string; partnerType: string; role: string; status: "PROPOSED" | "NEGOTIATING" | "CONFIRMED"; tasks: string;
  cashSar: string; inKindDescription: string; responsibilities: string; mutualValue: string; evidenceDocId: string | null; orgApproved: boolean;
}, orgId: string) {
  return db.$transaction(async (tx) => {
    if (f.evidenceDocId) await tx.document.findFirstOrThrow({ where: { id: f.evidenceDocId, organizationId: orgId } });
    const { id, cashSar, ...rest } = f;
    // لا يظهر الشريك مؤكدًا دون اعتماد الجمعية
    const data = { ...rest, cashHalalas: parseSarToHalalas(cashSar || "0"), orgApproved: f.status === "CONFIRMED" ? f.orgApproved : false };
    const res = id ? await tx.partner.update({ where: { id, applicationId }, data }) : await tx.partner.create({ data: { ...data, applicationId } });
    await bumpVersion(tx, applicationId);
    return res;
  });
}

export async function deletePartner(applicationId: string, id: string) {
  await db.$transaction(async (tx) => {
    await tx.budgetLine.updateMany({ where: { partnerId: id, applicationId }, data: { needsReview: true } });
    await tx.partner.delete({ where: { id, applicationId } });
    await bumpVersion(tx, applicationId);
  });
}

// ===== الإجابات =====

export async function saveAnswer(args: { applicationId: string; questionId: string; content: string; expectedVersion: number | null }) {
  return db.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id: args.applicationId }, select: { opportunityId: true } });
    await tx.formQuestion.findFirstOrThrow({ where: { id: args.questionId, opportunityId: app.opportunityId } });
    const existing = await tx.formAnswer.findUnique({ where: { applicationId_questionId: { applicationId: args.applicationId, questionId: args.questionId } } });
    const status = args.content.trim() ? "DRAFT" : "EMPTY";
    if (!existing) {
      const created = await tx.formAnswer.create({ data: { applicationId: args.applicationId, questionId: args.questionId, content: args.content, status } });
      await bumpVersion(tx, args.applicationId);
      return created;
    }
    const r = await tx.formAnswer.updateMany({
      where: { id: existing.id, version: args.expectedVersion ?? -1 },
      data: { content: args.content, status, staleReason: null, version: { increment: 1 } },
    });
    if (r.count === 0) throw new ConflictError();
    await bumpVersion(tx, args.applicationId);
    return tx.formAnswer.findUniqueOrThrow({ where: { id: existing.id } });
  });
}

export async function approveAnswer(applicationId: string, questionId: string) {
  await db.$transaction(async (tx) => {
    const a = await tx.formAnswer.findUniqueOrThrow({ where: { applicationId_questionId: { applicationId, questionId } }, include: { question: true } });
    if (!a.content.trim()) throw new Error("لا يمكن اعتماد إجابة فارغة");
    const lim = checkLimit(a.content, a.question.limitType, a.question.limitValue);
    if (!lim.withinLimit) throw new Error(`الإجابة تتجاوز الحد (${lim.count} من ${lim.limit}). اختصرها قبل الاعتماد.`);
    await tx.formAnswer.update({ where: { id: a.id }, data: { status: "APPROVED", staleReason: null } });
    await bumpVersion(tx, applicationId);
  });
}

// ===== الشروط =====

export async function setUserAssessment(args: { applicationId: string; requirementId: string; userId: string; result: "MET" | "NOT_MET" | "NEEDS_VERIFICATION"; evidence: string; nextAction?: string }) {
  await db.$transaction(async (tx) => {
    const app = await tx.application.findUniqueOrThrow({ where: { id: args.applicationId }, select: { opportunityId: true } });
    const req = await tx.requirement.findFirstOrThrow({ where: { id: args.requirementId, opportunityId: app.opportunityId } });
    if (!USER_DECIDABLE_RULES.has(req.rule)) throw new Error("هذا الشرط يُحسم من البيانات. حدّث البيانات المرتبطة به بدلًا من ذلك.");
    if (args.result === "MET" && !args.evidence.trim()) throw new Error("أضف الدليل الذي يثبت الاستيفاء");
    await tx.requirementAssessment.upsert({
      where: { applicationId_requirementId: { applicationId: args.applicationId, requirementId: args.requirementId } },
      create: { applicationId: args.applicationId, requirementId: args.requirementId, result: args.result, evidence: args.evidence, nextAction: args.nextAction ?? null, decidedBy: "USER", decidedById: args.userId },
      update: { result: args.result, evidence: args.evidence, nextAction: args.nextAction ?? null, decidedBy: "USER", decidedById: args.userId },
    });
    await bumpVersion(tx, args.applicationId);
  });
}

// ===== الاعتماد =====

export async function approveRevision(applicationId: string, userId: string, label: string) {
  const rev = await db.$transaction(async (tx) => {
    const r = await createRevision(tx, applicationId, userId, { label: label || "نسخة معتمدة", reason: "APPROVAL", approve: true });
    await tx.application.update({ where: { id: applicationId }, data: { readinessValid: r.readyAtApproval, stage: "EXPORT" } });
    return r;
  });
  return rev;
}
