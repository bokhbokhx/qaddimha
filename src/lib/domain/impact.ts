// تحليل أثر التعديل — دالة نقية.
// الحسابات المباشرة تُعاد فورًا؛ النصوص تحتاج اقتراحًا وموافقة.

export type Change =
  | { type: "beneficiaries"; from: number | null; to: number }
  | { type: "duration"; from: number | null; to: number }
  | { type: "region"; from: string | null; to: string }
  | { type: "activity_deleted"; activityId: string; code: string; name: string };

export interface ImpactState {
  sections: { key: string; content: string; status: string }[];
  questions: { id: string; linkedSections: string[]; answer: { content: string; status: string } | null }[];
  indicators: { id: string; activityId: string | null; target: string; type: string }[];
  budgetLines: { id: string; activityId: string | null; quantityFollowsBeneficiaries: boolean; periodsFollowDuration: boolean; calc: string; periods: number; quantityMilli: bigint }[];
}

export interface Proposal {
  targetType: "SECTION" | "ANSWER";
  targetId: string;
  before: string;
  after: string;
  explanation: string;
}

export interface ImpactResult {
  label: string;
  sectionsToReview: { key: string; reason: string }[];
  answersToStale: { questionId: string; reason: string }[];
  indicatorsToReview: string[];
  budgetLinesToReview: string[];
  budgetRecalc: { id: string; field: "quantityMilli" | "periods"; from: string; to: string }[];
  proposals: Proposal[];
}

const SECTION_MAP: Record<Change["type"], string[]> = {
  beneficiaries: ["summary", "target_group", "objectives", "outcomes", "assumptions"],
  duration: ["summary", "scope", "objectives", "sustainability", "assumptions"],
  region: ["summary", "target_group", "scope"],
  activity_deleted: ["scope", "outcomes"],
};

/** يستبدل الرقم كاملًا فقط (لا جزءًا من رقم أكبر)، بالأرقام اللاتينية والعربية */
export function replaceWholeNumber(text: string, from: number, to: number): string {
  const ar = (n: number) => String(n).replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)));
  let out = text;
  for (const [f, t] of [
    [String(from), String(to)],
    [ar(from), ar(to)],
    [from.toLocaleString("en-US"), to.toLocaleString("en-US")],
  ]) {
    const re = new RegExp(`(?<![\\d٠-٩,.٫])${f.replace(/[,.]/g, "\\$&")}(?![\\d٠-٩,.٫])`, "g");
    out = out.replace(re, t);
  }
  return out;
}

export function changeLabel(c: Change): string {
  switch (c.type) {
    case "beneficiaries": return `تغيير عدد المستفيدين من ${c.from ?? "—"} إلى ${c.to}`;
    case "duration": return `تغيير مدة المشروع من ${c.from ?? "—"} إلى ${c.to} شهرًا`;
    case "region": return `تغيير منطقة التنفيذ من «${c.from ?? "—"}» إلى «${c.to}»`;
    case "activity_deleted": return `حذف النشاط ${c.code} «${c.name}»`;
  }
}

export function analyzeImpact(change: Change, state: ImpactState): ImpactResult {
  const label = changeLabel(change);
  const affectedKeys = new Set(SECTION_MAP[change.type]);
  const sectionsToReview: ImpactResult["sectionsToReview"] = [];
  const proposals: Proposal[] = [];

  for (const s of state.sections) {
    if (!s.content.trim()) continue;
    let after = s.content;
    if ((change.type === "beneficiaries" || change.type === "duration") && change.from != null) after = replaceWholeNumber(s.content, change.from, change.to);
    if (change.type === "region" && change.from) after = s.content.split(change.from).join(change.to);
    const textChanged = after !== s.content;
    if (affectedKeys.has(s.key) || textChanged) sectionsToReview.push({ key: s.key, reason: label });
    if (textChanged) proposals.push({ targetType: "SECTION", targetId: s.key, before: s.content, after, explanation: `تحديث القيم في النص بعد ${label}` });
  }

  const reviewedKeys = new Set(sectionsToReview.map((s) => s.key));
  const answersToStale: ImpactResult["answersToStale"] = [];
  for (const q of state.questions) {
    if (!q.answer?.content.trim()) continue;
    let after = q.answer.content;
    if ((change.type === "beneficiaries" || change.type === "duration") && change.from != null) after = replaceWholeNumber(after, change.from, change.to);
    if (change.type === "region" && change.from) after = after.split(change.from).join(change.to);
    const linked = q.linkedSections.some((k) => reviewedKeys.has(k));
    if (linked || after !== q.answer.content) answersToStale.push({ questionId: q.id, reason: label });
    if (after !== q.answer.content) proposals.push({ targetType: "ANSWER", targetId: q.id, before: q.answer.content, after, explanation: `تحديث الإجابة بعد ${label}` });
  }

  const indicatorsToReview: string[] = [];
  const budgetLinesToReview: string[] = [];
  const budgetRecalc: ImpactResult["budgetRecalc"] = [];

  if (change.type === "activity_deleted") {
    for (const i of state.indicators) if (i.activityId === change.activityId) indicatorsToReview.push(i.id);
    for (const l of state.budgetLines) if (l.activityId === change.activityId) budgetLinesToReview.push(l.id);
  }
  if (change.type === "beneficiaries") {
    for (const i of state.indicators)
      if (change.from != null && replaceWholeNumber(i.target, change.from, change.to) !== i.target) indicatorsToReview.push(i.id);
    for (const l of state.budgetLines)
      if (l.quantityFollowsBeneficiaries)
        budgetRecalc.push({ id: l.id, field: "quantityMilli", from: l.quantityMilli.toString(), to: (BigInt(change.to) * 1000n).toString() });
  }
  if (change.type === "duration") {
    for (const l of state.budgetLines)
      if (l.periodsFollowDuration && l.calc === "RECURRING" && l.periods !== change.to)
        budgetRecalc.push({ id: l.id, field: "periods", from: String(l.periods), to: String(change.to) });
  }

  return { label, sectionsToReview, answersToStale, indicatorsToReview, budgetLinesToReview, budgetRecalc, proposals };
}
