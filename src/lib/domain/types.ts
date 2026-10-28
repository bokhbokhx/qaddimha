// بنية لقطة الطلب — كل المخرجات تُبنى من لقطة نسخة محددة.

export interface FactSnap {
  value: unknown;
  status: "EXTRACTED_UNCONFIRMED" | "CONFIRMED" | "MISSING" | "CONFLICT";
  sourceType: string;
  sourceLocator?: string | null;
  sourceExcerpt?: string | null;
  sourceDocName?: string | null;
  alternatives?: unknown;
}

export interface RequirementSnap {
  id: string;
  code: string;
  category: string;
  text: string;
  mandatory: boolean;
  rule: string;
  ruleParams: Record<string, unknown> | null;
  sourceLocator: string | null;
  sourceExcerpt: string | null;
  sourceDocName: string | null;
  userAssessment: { result: string; evidence: string | null; nextAction: string | null } | null;
  evaluation: Evaluation;
}

export interface Evaluation {
  result: "MET" | "NOT_MET" | "NEEDS_VERIFICATION";
  evidence: string;
  nextAction: string | null;
  decidedBy: "RULE" | "USER";
}

export interface SectionSnap {
  key: string;
  content: string;
  status: "EMPTY" | "DRAFT" | "APPROVED" | "NEEDS_REVIEW";
  isEstimate: boolean;
  origin: string;
  reviewReason: string | null;
}

export interface ActivitySnap {
  id: string; code: string; name: string; description: string;
  startMonth: number; endMonth: number; responsible: string; outputs: string;
}

export interface IndicatorSnap {
  id: string; name: string; type: "OUTPUT" | "OUTCOME"; baseline: string | null; target: string;
  unit: string; method: string; activityId: string | null; isEstimate: boolean; needsReview: boolean;
}

export interface BudgetLineSnap {
  id: string; item: string; costCenter: string; activityId: string | null; partnerId: string | null; unit: string;
  quantityMilli: string; unitCostHalalas: string; calc: "ONE_TIME" | "RECURRING"; periods: number;
  fundingSource: "DONOR" | "SELF" | "PARTNER"; contributionType: "CASH" | "IN_KIND";
  justification: string; isEstimate: boolean; needsReview: boolean; totalHalalas: string;
  periodsFollowDuration: boolean; quantityFollowsBeneficiaries: boolean;
}

export interface PartnerSnap {
  id: string; name: string; partnerType: string; role: string; status: "PROPOSED" | "NEGOTIATING" | "CONFIRMED";
  tasks: string; cashHalalas: string; inKindDescription: string; responsibilities: string; mutualValue: string;
  evidenceDocId: string | null; orgApproved: boolean;
}

export interface QuestionSnap {
  id: string; text: string; type: string; mandatory: boolean; limitType: "NONE" | "WORDS" | "CHARS"; limitValue: number | null;
  linkedSections: string[];
  answer: { content: string; status: "EMPTY" | "DRAFT" | "APPROVED" | "STALE"; staleReason: string | null } | null;
}

export interface DocumentMeta {
  id: string; kind: string; label: string | null; filename: string; expiresOn: string | null; status: string;
}

export interface BudgetSummarySnap {
  total: string; cashTotal: string; inKindTotal: string; donor: string; selfCash: string; selfInKind: string;
  partnerCash: string; partnerInKind: string; cashGap: string; nonDonorShareBp: number;
}

export interface Snapshot {
  schemaVersion: 1;
  takenAt: string;
  application: {
    id: string; title: string; beneficiaryCount: number | null; durationMonths: number | null; region: string | null;
    ideaSummary: string | null; ideaApproved: boolean;
  };
  organization: { id: string; displayName: string; isDemo: boolean; profileVersion: number | null; profile: Record<string, FactSnap> };
  opportunity: { id: string; funderName: string; title: string; referenceUrl: string | null; isDemo: boolean; facts: Record<string, FactSnap> };
  requirements: RequirementSnap[];
  sections: SectionSnap[];
  activities: ActivitySnap[];
  indicators: IndicatorSnap[];
  budgetLines: BudgetLineSnap[];
  partners: PartnerSnap[];
  questions: QuestionSnap[];
  documents: DocumentMeta[];
  budget: BudgetSummarySnap;
}
