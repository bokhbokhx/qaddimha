import type { Snapshot } from "./types";

/**
 * ما يراه الخبير: محتوى النسخة المسلّمة فقط.
 * يُستبعد ملف الجمعية الكامل وقائمة مستنداتها وبيانات التواصل؛ المرفقات تظهر فقط إن شاركتها الجمعية.
 */
export function expertView(s: Snapshot, sharedDocs: { id: string; filename: string; label: string | null }[]) {
  return {
    title: s.application.title,
    organizationName: s.organization.displayName,
    funder: s.opportunity.funderName,
    grant: s.opportunity.title,
    params: { beneficiaryCount: s.application.beneficiaryCount, durationMonths: s.application.durationMonths, region: s.application.region },
    ideaSummary: s.application.ideaSummary,
    sections: s.sections,
    activities: s.activities,
    indicators: s.indicators,
    partners: s.partners.map((p) => ({ id: p.id, name: p.name, status: p.status, role: p.role, inKindDescription: p.inKindDescription, cashHalalas: p.cashHalalas, mutualValue: p.mutualValue })),
    budgetLines: s.budgetLines,
    budget: s.budget,
    questions: s.questions,
    requirements: s.requirements.map((r) => ({ id: r.id, code: r.code, text: r.text, mandatory: r.mandatory, result: r.evaluation.result, evidence: r.evaluation.evidence })),
    sharedDocs,
  };
}
export type ExpertView = ReturnType<typeof expertView>;
