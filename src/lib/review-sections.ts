import { SECTIONS } from "@/lib/catalog";

export const REVIEW_SECTIONS = [
  { key: "general", label: "ملاحظة عامة" },
  ...SECTIONS.map((s) => ({ key: s.key, label: s.label })),
  { key: "plan", label: "خطة التنفيذ" },
  { key: "indicators", label: "المؤشرات" },
  { key: "budget", label: "الميزانية" },
  { key: "answers", label: "إجابات النموذج" },
  { key: "eligibility", label: "الأهلية والمتطلبات" },
];
export const REVIEW_SECTION_LABEL: Record<string, string> = Object.fromEntries(REVIEW_SECTIONS.map((s) => [s.key, s.label]));
