import { SECTIONS, SECTION_LABEL } from "@/lib/catalog";
import { checkLimit } from "@/lib/text-limits";
import type { Snapshot } from "./types";

export type CheckStatus = "ok" | "blocker" | "warning";

export interface ReadinessItem {
  id: string;
  group: "eligibility" | "opportunity" | "project" | "budget" | "answers" | "partners" | "consistency";
  label: string;
  status: CheckStatus;
  message: string;
  link: string; // مسار القسم داخل مساحة الطلب
  counted: boolean; // يدخل في نسبة الاكتمال
}

export interface ReadinessResult {
  ready: boolean;
  completionPct: number;
  countedOk: number;
  countedTotal: number;
  formula: string;
  items: ReadinessItem[];
  blockers: ReadinessItem[];
  warnings: ReadinessItem[];
}

export const GROUP_LABEL: Record<ReadinessItem["group"], string> = {
  eligibility: "الأهلية والمتطلبات",
  opportunity: "بيانات المنحة",
  project: "أقسام المشروع",
  budget: "الميزانية",
  answers: "إجابات النموذج",
  partners: "الشراكات",
  consistency: "الاتساق",
};

/**
 * فحص الجاهزية — دالة نقية على لقطة.
 * الطلب «جاهز للتقديم» فقط إذا لم يبقَ أي عائق. النسبة تقيس اكتمال المتطلبات المعروفة فقط وليست نسبة قبول.
 */
export function computeReadiness(s: Snapshot): ReadinessResult {
  const items: ReadinessItem[] = [];
  const add = (i: ReadinessItem) => items.push(i);

  // 1) الشروط
  for (const r of s.requirements) {
    const ev = r.evaluation;
    add({
      id: `req:${r.id}`,
      group: "eligibility",
      label: `${r.code} — ${r.text}`,
      status: ev.result === "MET" ? "ok" : r.mandatory ? "blocker" : "warning",
      message: ev.result === "MET" ? ev.evidence : `${ev.result === "NOT_MET" ? "غير مستوفى" : "يحتاج تحققًا"}: ${ev.evidence}${ev.nextAction ? ` — ${ev.nextAction}` : ""}`,
      link: "eligibility",
      counted: r.mandatory,
    });
  }

  // 2) بيانات المنحة: تعارضات أو استخراج غير مراجع
  for (const [key, f] of Object.entries(s.opportunity.facts)) {
    if (f.status === "CONFLICT")
      add({ id: `opp:${key}`, group: "opportunity", label: `تعارض في «${key}»`, status: "blocker", message: "توجد قيم متعارضة من مصادر مختلفة — احسمها في مراجعة الاستخراج", link: "extraction", counted: true });
  }
  const unconfirmedOpp = Object.values(s.opportunity.facts).filter((f) => f.status === "EXTRACTED_UNCONFIRMED").length;
  add({
    id: "opp:review",
    group: "opportunity",
    label: "مراجعة بيانات المنحة المستخرجة",
    status: unconfirmedOpp ? "warning" : "ok",
    message: unconfirmedOpp ? `${unconfirmedOpp} معلومة مستخرجة لم تُؤكَّد بعد` : "تمت مراجعة البيانات",
    link: "extraction",
    counted: false,
  });

  // 3) الفكرة والأقسام
  add({
    id: "idea",
    group: "project",
    label: "اعتماد ملخص الفكرة",
    status: s.application.ideaApproved ? "ok" : "blocker",
    message: s.application.ideaApproved ? "الفكرة معتمدة" : "اعتمد ملخص الفكرة قبل إكمال المشروع",
    link: "idea",
    counted: true,
  });
  for (const def of SECTIONS) {
    const sec = s.sections.find((x) => x.key === def.key);
    const st = sec?.status ?? "EMPTY";
    const hasPlaceholder = sec ? /\[يحتاج استكمال/.test(sec.content) : false;
    let status: CheckStatus = "ok";
    let message = "معتمد";
    if (st === "EMPTY") [status, message] = ["blocker", "القسم فارغ"];
    else if (st === "NEEDS_REVIEW") [status, message] = ["blocker", `يحتاج مراجعة: ${sec?.reviewReason ?? "تغيرت مدخلات مؤثرة"}`];
    else if (st === "DRAFT") [status, message] = ["blocker", sec?.isEstimate ? "مسودة بها أرقام تقديرية تحتاج اعتمادًا" : "مسودة لم تُعتمد"];
    else if (hasPlaceholder) [status, message] = ["blocker", "يحتوي موضعًا «يحتاج استكمال»"];
    add({ id: `sec:${def.key}`, group: "project", label: def.label, status, message, link: `project#${def.key}`, counted: true });
  }

  // 4) الأنشطة والمؤشرات
  const dur = s.application.durationMonths;
  add({
    id: "activities",
    group: "project",
    label: "خطة التنفيذ",
    status: s.activities.length ? "ok" : "blocker",
    message: s.activities.length ? `${s.activities.length} نشاط` : "لا توجد أنشطة",
    link: "project#plan",
    counted: true,
  });
  for (const a of s.activities) {
    if (dur && a.endMonth > dur)
      add({ id: `act:${a.id}`, group: "consistency", label: `النشاط ${a.code}`, status: "blocker", message: `ينتهي في الشهر ${a.endMonth} بعد نهاية المشروع (${dur} شهرًا)`, link: "project#plan", counted: false });
    if (a.startMonth > a.endMonth)
      add({ id: `actord:${a.id}`, group: "consistency", label: `النشاط ${a.code}`, status: "blocker", message: "شهر البداية بعد شهر النهاية", link: "project#plan", counted: false });
  }
  add({
    id: "indicators",
    group: "project",
    label: "مؤشرات القياس",
    status: s.indicators.length ? "ok" : "blocker",
    message: s.indicators.length ? `${s.indicators.length} مؤشر` : "لا توجد مؤشرات",
    link: "project#indicators",
    counted: true,
  });
  for (const i of s.indicators) {
    if (i.isEstimate)
      add({ id: `indest:${i.id}`, group: "project", label: `مؤشر: ${i.name}`, status: "blocker", message: "مستهدف تقديري يحتاج اعتمادًا", link: "project#indicators", counted: false });
    if (i.needsReview)
      add({ id: `indrev:${i.id}`, group: "project", label: `مؤشر: ${i.name}`, status: "blocker", message: "يحتاج مراجعة بعد تعديل مرتبط", link: "project#indicators", counted: false });
    if (i.type === "OUTCOME" && !i.activityId)
      add({ id: `indlink:${i.id}`, group: "consistency", label: `نتيجة: ${i.name}`, status: "warning", message: "نتيجة غير مرتبطة بنشاط", link: "project#indicators", counted: false });
  }
  for (const a of s.activities) {
    if (!s.indicators.some((i) => i.activityId === a.id))
      add({ id: `actind:${a.id}`, group: "consistency", label: `النشاط ${a.code}`, status: "warning", message: "نشاط بلا مؤشر مرتبط", link: "project#indicators", counted: false });
  }

  // 5) الميزانية
  add({
    id: "budget",
    group: "budget",
    label: "بنود الميزانية",
    status: s.budgetLines.length ? "ok" : "blocker",
    message: s.budgetLines.length ? `${s.budgetLines.length} بند` : "الميزانية فارغة",
    link: "budget",
    counted: true,
  });
  for (const l of s.budgetLines) {
    if (l.isEstimate)
      add({ id: `blest:${l.id}`, group: "budget", label: `بند: ${l.item}`, status: "blocker", message: "تكلفة تقديرية تحتاج اعتمادًا", link: "budget", counted: false });
    if (l.needsReview)
      add({ id: `blrev:${l.id}`, group: "budget", label: `بند: ${l.item}`, status: "blocker", message: "يحتاج مراجعة بعد تعديل مرتبط", link: "budget", counted: false });
    if (!l.justification.trim())
      add({ id: `bljust:${l.id}`, group: "budget", label: `بند: ${l.item}`, status: "warning", message: "بلا مبرر تكلفة", link: "budget", counted: false });
  }
  if (BigInt(s.budget.cashGap) > 0n)
    add({ id: "cashgap", group: "budget", label: "الفجوة النقدية", status: "blocker", message: "بنود نقدية منسوبة لشركاء غير مؤكدين أو تتجاوز تعهداتهم", link: "budget", counted: false });

  // 6) الشراكات
  for (const p of s.partners) {
    if (p.status === "CONFIRMED" && !p.orgApproved)
      add({ id: `pa:${p.id}`, group: "partners", label: `شريك: ${p.name}`, status: "blocker", message: "موسوم مؤكدًا دون اعتماد الجمعية", link: "project#partners", counted: false });
    if (p.status === "CONFIRMED" && !p.evidenceDocId)
      add({ id: `pe:${p.id}`, group: "partners", label: `شريك: ${p.name}`, status: "warning", message: "لا يوجد إثبات اتفاق مرفوع", link: "project#partners", counted: false });
    if (p.status !== "CONFIRMED")
      add({ id: `pp:${p.id}`, group: "partners", label: `شريك: ${p.name}`, status: "warning", message: "سيظهر في الحزمة بوصفه «مقترحًا» أو «جارٍ التفاوض» وليس مؤكدًا", link: "project#partners", counted: false });
  }

  // 7) الإجابات
  for (const q of s.questions) {
    const a = q.answer;
    const content = a?.content ?? "";
    const lim = checkLimit(content, q.limitType, q.limitValue);
    let status: CheckStatus = "ok";
    let message = "معتمدة";
    if (!content.trim()) [status, message] = [q.mandatory ? "blocker" : "warning", "لا توجد إجابة"];
    else if (!lim.withinLimit) [status, message] = ["blocker", `تتجاوز الحد: ${lim.count} من ${lim.limit} ${q.limitType === "WORDS" ? "كلمة" : "حرف"}`];
    else if (a?.status === "STALE") [status, message] = ["blocker", `قديمة بعد تعديل المشروع: ${a.staleReason ?? ""}`];
    else if (a?.status !== "APPROVED") [status, message] = [q.mandatory ? "blocker" : "warning", "مسودة لم تُعتمد"];
    add({ id: `ans:${q.id}`, group: "answers", label: q.text, status, message, link: "answers", counted: q.mandatory });
  }

  // 8) ادعاءات بلا مصدر في ملف الجمعية
  const results = s.organization.profile["past_results"]?.value;
  if (Array.isArray(results)) {
    results.forEach((r, idx) => {
      const rr = r as { text?: string; source?: string | null };
      if (!rr?.source)
        add({ id: `claim:${idx}`, group: "consistency", label: "نتيجة سابقة بلا مصدر", status: "warning", message: `«${(rr?.text ?? "").slice(0, 80)}» — أضف مصدرًا أو لا تستخدمها في الطلب`, link: "/app/organization", counted: false });
    });
  }

  // 9) عدد المستفيدين في الملخص
  if (s.application.beneficiaryCount) {
    const summary = s.sections.find((x) => x.key === "summary")?.content ?? "";
    const nums = Array.from(summary.matchAll(/(\d[\d,]*)\s*(?:مستفيد|مستفيدًا|مستفيدة|شاب|شابًا|شابة)/g)).map((m) => Number(m[1].replace(/,/g, "")));
    if (nums.length && !nums.includes(s.application.beneficiaryCount))
      add({ id: "benef-mismatch", group: "consistency", label: "عدد المستفيدين", status: "blocker", message: `الملخص يذكر ${nums.join("، ")} بينما العدد المعتمد ${s.application.beneficiaryCount}`, link: "project#summary", counted: false });
  }

  const counted = items.filter((i) => i.counted);
  const countedOk = counted.filter((i) => i.status === "ok").length;
  const completionPct = counted.length ? Math.floor((countedOk / counted.length) * 100) : 0;
  const blockers = items.filter((i) => i.status === "blocker");
  const warnings = items.filter((i) => i.status === "warning");
  return {
    ready: blockers.length === 0,
    completionPct,
    countedOk,
    countedTotal: counted.length,
    formula: `نسبة الاكتمال = عدد المتطلبات المعروفة المستوفاة (${countedOk}) ÷ عدد المتطلبات المعروفة (${counted.length}). تشمل الشروط الإلزامية، اعتماد الفكرة، أقسام المشروع، وجود الأنشطة والمؤشرات والميزانية، والأسئلة الإلزامية. ليست نسبة قبول ولا تقديرًا لفرص الفوز.`,
    items,
    blockers,
    warnings,
  };
}

export function readinessLabel(r: { ready: boolean }) {
  return r.ready ? "جاهز للتقديم" : "مسودة — توجد عوائق";
}

export { SECTION_LABEL };
