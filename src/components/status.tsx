import { ASSESSMENT_LABEL, FACT_STATUS_LABEL, REVIEW_STATUS_LABEL } from "@/lib/catalog";
import { Badge, type Tone } from "./ui";

const FACT_TONE: Record<string, Tone> = { CONFIRMED: "ok", EXTRACTED_UNCONFIRMED: "warn", MISSING: "neutral", CONFLICT: "danger" };
export function FactStatus({ status }: { status: string }) {
  return <Badge tone={FACT_TONE[status] ?? "neutral"}>{FACT_STATUS_LABEL[status] ?? status}</Badge>;
}

const ASSESS_TONE: Record<string, Tone> = { MET: "ok", NOT_MET: "danger", NEEDS_VERIFICATION: "warn" };
export function AssessmentBadge({ result }: { result: string }) {
  return <Badge tone={ASSESS_TONE[result]}>{ASSESSMENT_LABEL[result]}</Badge>;
}

const SECTION_STATUS: Record<string, [string, Tone]> = {
  EMPTY: ["فارغ", "neutral"],
  DRAFT: ["مسودة", "warn"],
  APPROVED: ["معتمد", "ok"],
  NEEDS_REVIEW: ["يحتاج مراجعة", "danger"],
};
export function SectionStatus({ status }: { status: string }) {
  const [l, t] = SECTION_STATUS[status] ?? [status, "neutral"];
  return <Badge tone={t}>{l}</Badge>;
}

const ANSWER_STATUS: Record<string, [string, Tone]> = {
  EMPTY: ["لا توجد إجابة", "neutral"],
  DRAFT: ["مسودة", "warn"],
  APPROVED: ["معتمدة", "ok"],
  STALE: ["قديمة بعد تعديل المشروع", "danger"],
};
export function AnswerStatus({ status }: { status: string }) {
  const [l, t] = ANSWER_STATUS[status] ?? [status, "neutral"];
  return <Badge tone={t}>{l}</Badge>;
}

const REVIEW_TONE: Record<string, Tone> = { NEW: "neutral", IN_REVIEW: "brand", NEEDS_INFO: "warn", COMPLETED: "ok" };
export function ReviewStatus({ status }: { status: string }) {
  return <Badge tone={REVIEW_TONE[status]}>{REVIEW_STATUS_LABEL[status]}</Badge>;
}

export function EstimateBadge() {
  return <Badge tone="gold">تقديري يحتاج اعتمادًا</Badge>;
}
