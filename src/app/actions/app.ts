"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireApplication, requireOrg } from "@/lib/auth/guard";
import { run } from "@/lib/action-result";
import { OPPORTUNITY_FIELDS } from "@/lib/catalog";
import { confirmFact } from "@/lib/services/facts";
import * as A from "@/lib/services/application";
import * as AS from "@/lib/services/assistant";
import * as O from "@/lib/services/opportunity";
import { extractOpportunityFromDocument } from "@/lib/services/extraction";
import { restoreRevision, createRevision } from "@/lib/services/revisions";
import { generateExportPackage } from "@/lib/services/exports";

const rv = (id: string) => revalidatePath(`/app/applications/${id}`, "layout");

// ===== إنشاء =====

export async function createApplicationAction(input: { mode: "demo" | "manual"; title: string; funderName?: string; grantTitle?: string; referenceUrl?: string; pastedText?: string }) {
  const res = await run(async () => {
    const ctx = await requireOrg("EDITOR");
    const title = z.string().trim().min(3, "اكتب اسمًا مختصرًا للطلب").max(200).parse(input.title);
    let oppId: string;
    if (input.mode === "demo") {
      if (!ctx.organization.isDemo) throw new Error("المنحة التجريبية متاحة للجمعية التجريبية فقط");
      oppId = (await O.createDemoOpportunity(ctx.orgId, ctx.user.id)).id;
    } else {
      const funderName = z.string().trim().min(2, "اكتب اسم الجهة المانحة").max(200).parse(input.funderName);
      const grantTitle = z.string().trim().min(2, "اكتب اسم الفرصة").max(200).parse(input.grantTitle);
      oppId = (await O.createOpportunity({ organizationId: ctx.orgId, userId: ctx.user.id, funderName, title: grantTitle, referenceUrl: input.referenceUrl, pastedText: input.pastedText })).id;
    }
    const app = await A.createApplication({ organizationId: ctx.orgId, userId: ctx.user.id, opportunityId: oppId, title });
    return app.id;
  });
  if (res.ok) redirect(`/app/applications/${res.data}/opportunity?created=1`);
  return res;
}

export async function analyzeOpportunityDocAction(applicationId: string, documentId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    const r = await extractOpportunityFromDocument(ctx.orgId, app.opportunityId, documentId);
    rv(applicationId);
    return { notes: r.data.notes, demo: r.demo, requirements: r.data.requirements.length, questions: r.data.questions.length };
  });
}

export async function addGrantUpdateSampleAction(applicationId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId }, include: { opportunity: true } });
    if (!app.opportunity.isDemo) throw new Error("متاح للمنحة التجريبية فقط");
    await O.addSampleToOpportunity(ctx.orgId, ctx.user.id, app.opportunityId, "grantUpdate");
    rv(applicationId);
  }, "أُضيف التعميم واستُخرجت بياناته");
}

// ===== مراجعة بيانات المنحة =====

const oppKeys = new Set(OPPORTUNITY_FIELDS.map((f) => f.key));

export async function confirmOpportunityFactAction(applicationId: string, key: string, value: unknown) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    if (!oppKeys.has(key)) throw new Error("حقل غير معروف");
    const v = z.union([z.string().max(5000), z.array(z.string().max(1000)).max(60), z.null()]).parse(value);
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    await confirmFact(db, { organizationId: ctx.orgId, scope: "OPPORTUNITY", opportunityId: app.opportunityId, key, value: v, userId: ctx.user.id });
    rv(applicationId);
  }, "تم التأكيد");
}

export async function confirmAllOpportunityFactsAction(applicationId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    // التعارضات لا تُؤكد جماعيًا — تحتاج حسمًا فرديًا
    const facts = await db.fact.findMany({ where: { opportunityId: app.opportunityId, organizationId: ctx.orgId, status: "EXTRACTED_UNCONFIRMED" } });
    for (const f of facts) await confirmFact(db, { organizationId: ctx.orgId, scope: "OPPORTUNITY", opportunityId: app.opportunityId, key: f.key, value: f.value, userId: ctx.user.id });
    await db.application.update({ where: { id: applicationId }, data: { stage: "ELIGIBILITY" } });
    rv(applicationId);
    return facts.length;
  });
}

export async function resolveConflictAction(applicationId: string, key: string, value: unknown) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    await O.resolveConflict({ organizationId: ctx.orgId, opportunityId: app.opportunityId, key, value, userId: ctx.user.id });
    rv(applicationId);
  }, "تم حسم التعارض");
}

export async function addRequirementAction(applicationId: string, data: { code: string; category: string; text: string; mandatory: boolean }) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    z.string().min(3, "اكتب نص الشرط").parse(data.text);
    z.enum(["ORG_ELIGIBILITY", "PROJECT_FIT", "DOCUMENT", "BUDGET", "SUBMISSION"]).parse(data.category);
    await O.addManualRequirement(app.opportunityId, data);
    rv(applicationId);
  }, "أُضيف الشرط");
}

export async function deleteRequirementAction(applicationId: string, requirementId: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    await O.deleteRequirement(app.opportunityId, requirementId);
    rv(applicationId);
  });
}

export async function addQuestionAction(applicationId: string, data: { text: string; mandatory: boolean; limitType: "NONE" | "WORDS" | "CHARS"; limitValue: number | null; linkedSections: string[] }) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId } });
    z.string().min(3, "اكتب نص السؤال").parse(data.text);
    await O.addManualQuestion(app.opportunityId, { ...data, limitValue: data.limitType === "NONE" ? null : z.number().int().positive("حد غير صالح").parse(data.limitValue) });
    rv(applicationId);
  }, "أُضيف السؤال");
}

// ===== الأهلية =====

export async function setAssessmentAction(applicationId: string, requirementId: string, result: "MET" | "NOT_MET" | "NEEDS_VERIFICATION", evidence: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await A.setUserAssessment({ applicationId, requirementId, userId: ctx.user.id, result, evidence: evidence.slice(0, 2000) });
    rv(applicationId);
  }, "تم الحفظ");
}

export async function refreshProfileAction(applicationId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await A.refreshProfileSnapshot(applicationId, ctx.orgId, ctx.user.id);
    rv(applicationId);
  }, "تم تحديث بيانات الجمعية في الطلب، وحُفظت نسخة قبل التحديث");
}

// ===== المدخلات المؤثرة =====

export async function updateKeyParamsAction(applicationId: string, expectedVersion: number, p: { beneficiaryCount?: string; durationMonths?: string; region?: string }) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const int = (s: string | undefined, max: number) => (s === undefined || s === "" ? undefined : z.coerce.number().int().min(1).max(max).parse(s));
    const r = await A.updateKeyParams({
      applicationId, userId: ctx.user.id, expectedVersion,
      beneficiaryCount: int(p.beneficiaryCount, 1_000_000), durationMonths: int(p.durationMonths, 120),
      region: p.region === undefined ? undefined : p.region.trim().slice(0, 100) || undefined,
    });
    rv(applicationId);
    return {
      changed: r.changed,
      summary: r.impacts.map((i) => ({ label: i.label, sections: i.sectionsToReview.length, answers: i.answersToStale.length, recalc: i.budgetRecalc.length, proposals: i.proposals.length, indicators: i.indicatorsToReview.length })),
    };
  });
}

export async function applyProposalAction(applicationId: string, proposalId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await A.applyProposal(applicationId, proposalId, ctx.user.id);
    rv(applicationId);
  }, "طُبق المقترح وحُفظت نسخة قبله");
}

export async function rejectProposalAction(applicationId: string, proposalId: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.rejectProposal(applicationId, proposalId);
    rv(applicationId);
  });
}

// ===== الفكرة =====

export async function saveIdeaInputsAction(applicationId: string, inputs: Record<string, string>) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await AS.saveIdeaInputs(applicationId, inputs);
    rv(applicationId);
  }, "تم الحفظ");
}

export async function ideaTurnAction(applicationId: string, message: string | null) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const r = await AS.ideaTurn(applicationId, message);
    rv(applicationId);
    return r;
  });
}

export async function saveIdeaSummaryAction(applicationId: string, summary: string, approve: boolean) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    z.string().trim().min(approve ? 20 : 0, "الملخص قصير جدًا للاعتماد").max(3000).parse(summary);
    await AS.saveIdeaSummary(applicationId, summary, approve);
    rv(applicationId);
  }, approve ? "اعتُمد ملخص الفكرة" : "حُفظ الملخص");
}

// ===== المشروع =====

export async function draftProjectAction(applicationId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const r = await AS.draftProject(applicationId, ctx.user.id);
    rv(applicationId);
    return { demo: r.demo };
  }, "أُنشئت المسودة. راجع كل قسم واعتمده.");
}

export async function saveSectionAction(applicationId: string, key: string, content: string, expectedVersion: number) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const s = await A.saveSection({ applicationId, key, content: content.slice(0, 20000), expectedVersion });
    return { version: s.version, status: s.status };
  });
}

export async function approveSectionAction(applicationId: string, key: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.approveSection(applicationId, key);
    rv(applicationId);
  }, "اعتُمد القسم");
}

const ActivitySchema = z.object({
  id: z.string().optional(), code: z.string().trim().min(1, "الرمز مطلوب").max(10), name: z.string().trim().min(2, "اسم النشاط مطلوب").max(200),
  description: z.string().max(2000), startMonth: z.coerce.number().int().min(1), endMonth: z.coerce.number().int().min(1),
  responsible: z.string().max(200), outputs: z.string().max(1000),
});

export async function saveActivityAction(applicationId: string, data: unknown) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.upsertActivity(applicationId, ActivitySchema.parse(data));
    rv(applicationId);
  }, "تم حفظ النشاط");
}

export async function deleteActivityAction(applicationId: string, activityId: string, expectedVersion: number) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const imp = await A.deleteActivity(applicationId, activityId, ctx.user.id, expectedVersion);
    rv(applicationId);
    return { indicators: imp.indicatorsToReview.length, budget: imp.budgetLinesToReview.length, sections: imp.sectionsToReview.length };
  });
}

const IndicatorSchema = z.object({
  id: z.string().optional(), name: z.string().trim().min(2, "اسم المؤشر مطلوب").max(300), type: z.enum(["OUTPUT", "OUTCOME"]),
  baseline: z.string().max(200).nullable(), target: z.string().trim().min(1, "المستهدف مطلوب").max(200), unit: z.string().max(50),
  method: z.string().max(500), activityId: z.string().nullable(),
});

export async function saveIndicatorAction(applicationId: string, data: unknown) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.upsertIndicator(applicationId, IndicatorSchema.parse(data));
    rv(applicationId);
  }, "تم حفظ المؤشر");
}

export async function approveIndicatorAction(applicationId: string, id: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.approveIndicator(applicationId, id);
    rv(applicationId);
  });
}

export async function deleteIndicatorAction(applicationId: string, id: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.deleteIndicator(applicationId, id);
    rv(applicationId);
  });
}

const PartnerSchema = z.object({
  id: z.string().optional(), name: z.string().trim().min(2, "اسم الشريك مطلوب").max(200), partnerType: z.string().max(100), role: z.string().max(500),
  status: z.enum(["PROPOSED", "NEGOTIATING", "CONFIRMED"]), tasks: z.string().max(1000), cashSar: z.string().max(20), inKindDescription: z.string().max(500),
  responsibilities: z.string().max(1000), mutualValue: z.string().max(1000), evidenceDocId: z.string().nullable(), orgApproved: z.boolean(),
});

export async function savePartnerAction(applicationId: string, data: unknown) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await A.savePartner(applicationId, PartnerSchema.parse(data), ctx.orgId);
    rv(applicationId);
  }, "تم حفظ الشريك");
}

export async function deletePartnerAction(applicationId: string, id: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.deletePartner(applicationId, id);
    rv(applicationId);
  });
}

// ===== الميزانية =====

const BudgetSchema = z.object({
  id: z.string().optional(), item: z.string().trim().min(1, "اسم البند مطلوب").max(200), costCenter: z.string().max(100), activityId: z.string().nullable(),
  partnerId: z.string().nullable(), unit: z.string().max(50), quantity: z.string().min(1, "الكمية مطلوبة"), unitCostSar: z.string().min(1, "تكلفة الوحدة مطلوبة"),
  calc: z.enum(["ONE_TIME", "RECURRING"]), periods: z.coerce.number().int().min(1).max(240), fundingSource: z.enum(["DONOR", "SELF", "PARTNER"]),
  contributionType: z.enum(["CASH", "IN_KIND"]), justification: z.string().max(1000), periodsFollowDuration: z.boolean(), quantityFollowsBeneficiaries: z.boolean(),
});

export async function saveBudgetLineAction(applicationId: string, expectedVersion: number, data: unknown) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.saveBudgetLine(applicationId, BudgetSchema.parse(data), expectedVersion);
    rv(applicationId);
  }, "تم حفظ البند وأُعيد الحساب");
}

export async function deleteBudgetLineAction(applicationId: string, id: string, expectedVersion: number) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.deleteBudgetLine(applicationId, id, expectedVersion);
    rv(applicationId);
  }, "حُذف البند");
}

export async function approveBudgetLinesAction(applicationId: string, ids: string[], expectedVersion: number) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.approveBudgetLines(applicationId, ids, expectedVersion);
    rv(applicationId);
  }, "اعتُمدت البنود");
}

export async function suggestBudgetAction(applicationId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await AS.suggestBudget(applicationId, ctx.user.id);
    rv(applicationId);
  }, "أُضيفت بنود تقديرية تحتاج مراجعتك واعتمادك");
}

// ===== الإجابات =====

export async function saveAnswerAction(applicationId: string, questionId: string, content: string, expectedVersion: number | null) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const a = await A.saveAnswer({ applicationId, questionId, content: content.slice(0, 20000), expectedVersion });
    return { version: a.version, status: a.status };
  });
}

export async function approveAnswerAction(applicationId: string, questionId: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    await A.approveAnswer(applicationId, questionId);
    rv(applicationId);
  }, "اعتُمدت الإجابة");
}

export async function draftAnswersAction(applicationId: string) {
  return run(async () => {
    await requireApplication(applicationId, "EDITOR");
    const r = await AS.draftAnswers(applicationId);
    rv(applicationId);
    return { overLimit: r.overLimit };
  }, "أُنشئت مسودات للإجابات الفارغة");
}

// ===== النسخ والاعتماد والتصدير =====

export async function saveRevisionAction(applicationId: string, label: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await db.$transaction((tx) => createRevision(tx, applicationId, ctx.user.id, { label: label.trim().slice(0, 100) || "نسخة يدوية", reason: "MANUAL" }));
    rv(applicationId);
  }, "حُفظت نسخة");
}

export async function approveRevisionAction(applicationId: string, label: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const r = await A.approveRevision(applicationId, ctx.user.id, label.trim().slice(0, 100));
    rv(applicationId);
    return { number: r.number, ready: r.readyAtApproval };
  });
}

export async function restoreRevisionAction(applicationId: string, revisionId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    await restoreRevision(applicationId, revisionId, ctx.user.id);
    rv(applicationId);
  }, "استُعيدت النسخة، وحُفظت الحالة السابقة كنسخة");
}

export async function generateExportsAction(applicationId: string, revisionId: string) {
  return run(async () => {
    const ctx = await requireApplication(applicationId, "EDITOR");
    const r = await generateExportPackage(applicationId, revisionId, ctx.user.id);
    rv(applicationId);
    return { isDraft: r.isDraft, count: r.exports.length };
  });
}

export async function deleteApplicationAction(applicationId: string) {
  const res = await run(async () => {
    const ctx = await requireApplication(applicationId, "OWNER");
    const app = await db.application.findUniqueOrThrow({ where: { id: applicationId }, include: { exports: true } });
    const { storage } = await import("@/lib/storage");
    // حذف الطلب ومشتقاته (النسخ والمخرجات والمحادثات) — الفرصة تبقى إن ارتبطت بطلبات أخرى
    await db.reviewRequest.deleteMany({ where: { applicationId } });
    await db.application.delete({ where: { id: applicationId } });
    for (const e of app.exports) await storage.remove(e.storageKey);
    const others = await db.application.count({ where: { opportunityId: app.opportunityId } });
    if (!others) {
      const docs = await db.document.findMany({ where: { opportunityId: app.opportunityId } });
      await db.fundingOpportunity.delete({ where: { id: app.opportunityId } });
      for (const d of docs) await storage.remove(d.storageKey);
    }
    const { audit } = await import("@/lib/audit");
    await audit({ organizationId: ctx.orgId, userId: ctx.user.id, action: "application.delete", targetType: "Application", targetId: applicationId });
  });
  if (res.ok) redirect("/app?deleted=1");
  return res;
}
