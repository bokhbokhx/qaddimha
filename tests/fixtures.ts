import { SECTIONS } from "@/lib/catalog";
import type { Snapshot } from "@/lib/domain/types";

/** لقطة مكتملة وجاهزة — تُعدّل في كل اختبار لإحداث عائق محدد */
export function readySnapshot(): Snapshot {
  return {
    schemaVersion: 1,
    takenAt: new Date().toISOString(),
    application: { id: "a1", title: "طلب", beneficiaryCount: 150, durationMonths: 12, region: "منطقة الرياض", ideaSummary: "فكرة", ideaApproved: true },
    organization: { id: "o1", displayName: "جمعية", isDemo: true, profileVersion: 1, profile: { entity_type: { value: "جمعية أهلية", status: "CONFIRMED", sourceType: "USER" } } },
    opportunity: { id: "p1", funderName: "جهة", title: "منحة", referenceUrl: null, isDemo: true, facts: { funder: { value: "جهة", status: "CONFIRMED", sourceType: "USER" } } },
    requirements: [
      { id: "r1", code: "ش1", category: "ORG_ELIGIBILITY", text: "جمعية أهلية", mandatory: true, rule: "ENTITY_TYPE", ruleParams: { allowed: ["جمعية أهلية"] }, sourceLocator: null, sourceExcerpt: null, sourceDocName: null, userAssessment: null, evaluation: { result: "MET", evidence: "مؤكد", nextAction: null, decidedBy: "RULE" } },
    ],
    sections: SECTIONS.map((s) => ({ key: s.key, content: s.key === "summary" ? "تمكين 150 شابًا" : "محتوى معتمد", status: "APPROVED" as const, isEstimate: false, origin: "USER", reviewReason: null })),
    activities: [{ id: "act1", code: "ن1", name: "تدريب", description: "", startMonth: 1, endMonth: 12, responsible: "", outputs: "" }],
    indicators: [{ id: "i1", name: "متدربون", type: "OUTPUT", baseline: null, target: "150", unit: "متدرب", method: "سجلات", activityId: "act1", isEstimate: false, needsReview: false }],
    budgetLines: [{ id: "b1", item: "مدربون", costCenter: "تدريب", activityId: "act1", partnerId: null, unit: "ساعة", quantityMilli: "1000", unitCostHalalas: "100000", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "مبرر", isEstimate: false, needsReview: false, totalHalalas: "100000", periodsFollowDuration: false, quantityFollowsBeneficiaries: false }],
    partners: [],
    questions: [{ id: "q1", text: "صف المشروع", type: "TEXT", mandatory: true, limitType: "WORDS", limitValue: 5, linkedSections: ["summary"], answer: { content: "مشروع تمكين الشباب", status: "APPROVED", staleReason: null } }],
    documents: [],
    budget: { total: "100000", cashTotal: "100000", inKindTotal: "0", donor: "100000", selfCash: "0", selfInKind: "0", partnerCash: "0", partnerInKind: "0", cashGap: "0", nonDonorShareBp: 0 },
  };
}
