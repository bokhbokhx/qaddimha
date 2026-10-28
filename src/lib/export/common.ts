import { SECTION_LABEL, SECTIONS, valueToText, ASSESSMENT_LABEL, CATEGORY_LABEL, FUNDING_SOURCE_LABEL, CONTRIBUTION_LABEL, PARTNER_STATUS_LABEL } from "@/lib/catalog";
import { formatSar, milliToString } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { computeReadiness } from "@/lib/domain/readiness";
import type { Snapshot } from "@/lib/domain/types";

export interface ExportMeta {
  revisionNumber: number;
  revisionId: string;
  revisionLabel: string;
  exportedAt: Date;
  isDraft: boolean;
  draftReason: string | null;
  isDemo: boolean;
  brand?: Brand;
}

/** هوية الجمعية البصرية في المخرجات: لون أساسي وشعار (صور آمنة فقط) */
export interface Brand {
  primary: string;
  logo: { buffer: Buffer; type: "png" | "jpg" | "webp" } | null;
}

export function brandColor(m: ExportMeta) {
  const c = m.brand?.primary ?? "";
  return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#0f3d2e";
}

export function logoDataUri(m: ExportMeta) {
  const l = m.brand?.logo;
  if (!l) return null;
  const mime = l.type === "jpg" ? "image/jpeg" : `image/${l.type}`;
  return `data:${mime};base64,${l.buffer.toString("base64")}`;
}

export function metaLine(m: ExportMeta) {
  return `النسخة رقم ${m.revisionNumber} (${m.revisionId.slice(-8)}) — تاريخ التصدير: ${formatDateTime(m.exportedAt)} بتوقيت الرياض${m.isDraft ? ` — مسودة: ${m.draftReason ?? "لم تكتمل الجاهزية"}` : ""}`;
}

export const DEMO_EXPORT_NOTICE = "بيانات تجريبية غير حقيقية — لأغراض العرض فقط";

/** نموذج موحد تُبنى منه كل الصيغ — من لقطة نسخة واحدة */
export function exportModel(s: Snapshot) {
  const readiness = computeReadiness(s);
  const actById = new Map(s.activities.map((a) => [a.id, a]));
  const partnerById = new Map(s.partners.map((p) => [p.id, p]));
  return {
    title: s.application.title,
    org: s.organization.displayName,
    funder: s.opportunity.funderName,
    grant: s.opportunity.title,
    readiness,
    params: [
      ["عدد المستفيدين", s.application.beneficiaryCount != null ? String(s.application.beneficiaryCount) : "غير محدد"],
      ["مدة التنفيذ", s.application.durationMonths != null ? `${s.application.durationMonths} شهرًا` : "غير محددة"],
      ["منطقة التنفيذ", s.application.region ?? "غير محددة"],
    ] as [string, string][],
    sections: SECTIONS.map((d) => {
      const sec = s.sections.find((x) => x.key === d.key);
      return { key: d.key, label: SECTION_LABEL[d.key], content: sec?.content ?? "", status: sec?.status ?? "EMPTY" };
    }),
    activities: s.activities,
    indicators: s.indicators.map((i) => ({ ...i, typeLabel: i.type === "OUTPUT" ? "مخرج" : "نتيجة", activity: i.activityId ? actById.get(i.activityId)?.code ?? "" : "" })),
    partners: s.partners.map((p) => ({ ...p, statusLabel: PARTNER_STATUS_LABEL[p.status] + (p.status === "CONFIRMED" && !p.orgApproved ? " (غير معتمد من الجمعية)" : "") })),
    budgetRows: s.budgetLines.map((l) => ({
      ...l,
      activity: l.activityId ? actById.get(l.activityId)?.code ?? "" : "",
      partner: l.partnerId ? partnerById.get(l.partnerId)?.name ?? "" : "",
      qty: milliToString(BigInt(l.quantityMilli)),
      unitCost: formatSar(BigInt(l.unitCostHalalas), false),
      total: formatSar(BigInt(l.totalHalalas), false),
      source: FUNDING_SOURCE_LABEL[l.fundingSource],
      contribution: CONTRIBUTION_LABEL[l.contributionType],
      formula: l.calc === "RECURRING" ? `${milliToString(BigInt(l.quantityMilli))} × ${formatSar(BigInt(l.unitCostHalalas), false)} × ${l.periods}` : `${milliToString(BigInt(l.quantityMilli))} × ${formatSar(BigInt(l.unitCostHalalas), false)}`,
    })),
    budget: [
      ["إجمالي المشروع", formatSar(BigInt(s.budget.total))],
      ["المطلوب من المانح", formatSar(BigInt(s.budget.donor))],
      ["المساهمة الذاتية النقدية", formatSar(BigInt(s.budget.selfCash))],
      ["المساهمة الذاتية العينية", formatSar(BigInt(s.budget.selfInKind))],
      ["مساهمات الشركاء النقدية", formatSar(BigInt(s.budget.partnerCash))],
      ["مساهمات الشركاء العينية", formatSar(BigInt(s.budget.partnerInKind))],
      ["الفجوة النقدية", formatSar(BigInt(s.budget.cashGap))],
    ] as [string, string][],
    requirements: s.requirements.map((r) => ({
      code: r.code, text: r.text, category: CATEGORY_LABEL[r.category] ?? r.category, mandatory: r.mandatory ? "إلزامي" : "اختياري",
      result: ASSESSMENT_LABEL[r.evaluation.result], evidence: r.evaluation.evidence, next: r.evaluation.nextAction ?? "",
      source: [r.sourceDocName, r.sourceLocator].filter(Boolean).join(" — "),
    })),
    questions: s.questions.map((q, i) => ({
      n: i + 1, text: q.text, mandatory: q.mandatory, limit: q.limitType === "NONE" ? "بلا حد" : `${q.limitValue} ${q.limitType === "WORDS" ? "كلمة" : "حرف"}`,
      answer: q.answer?.content ?? "", status: q.answer?.status ?? "EMPTY",
    })),
    documents: s.documents,
    facts: s.opportunity.facts,
    valueToText,
  };
}

export type ExportModel = ReturnType<typeof exportModel>;
