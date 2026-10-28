import type { BudgetSummary } from "@/lib/money";
import type { DocumentMeta, Evaluation, FactSnap } from "./types";

export interface EvalContext {
  profile: Record<string, FactSnap>;
  documents: DocumentMeta[];
  app: { region: string | null; durationMonths: number | null; beneficiaryCount: number | null };
  budget: BudgetSummary | null;
  budgetLines: { item: string; costCenter: string; fundingSource: string; totalHalalas: bigint }[];
  now: Date;
}

export interface RequirementLike {
  rule: string;
  ruleParams: Record<string, unknown> | null;
  userAssessment?: { result: string; evidence: string | null; nextAction: string | null } | null;
}

/** القواعد التي تقبل قرار المستخدم؛ البقية تُحسم من البيانات فقط */
export const USER_DECIDABLE_RULES = new Set(["MANUAL", "TARGET_GROUP"]);

export function normalizeAr(s: string) {
  return s
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/^منطقة\s+|\s+منطقة\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function matchesAny(value: string, allowed: string[]) {
  const v = normalizeAr(value);
  return allowed.some((a) => {
    const n = normalizeAr(a);
    return n.length > 0 && (v.includes(n) || n.includes(v));
  });
}

function factText(f: FactSnap | undefined): string | null {
  if (!f || f.value == null) return null;
  if (Array.isArray(f.value)) return f.value.map(String).join("، ");
  return String(f.value);
}

const nv = (evidence: string, nextAction: string): Evaluation => ({ result: "NEEDS_VERIFICATION", evidence, nextAction, decidedBy: "RULE" });
const met = (evidence: string): Evaluation => ({ result: "MET", evidence, nextAction: null, decidedBy: "RULE" });
const notMet = (evidence: string, nextAction: string): Evaluation => ({ result: "NOT_MET", evidence, nextAction, decidedBy: "RULE" });

const sar = (h: bigint) => `${(h / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ر.س`;

/**
 * تقييم شرط واحد. القاعدة الذهبية: غياب المعلومة لا يعني الاستيفاء ولا عدمه — النتيجة «يحتاج تحققًا».
 */
export function evaluateRequirement(req: RequirementLike, ctx: EvalContext): Evaluation {
  const p = (req.ruleParams ?? {}) as Record<string, unknown>;
  const allowed = (p.allowed as string[] | undefined) ?? [];

  if (USER_DECIDABLE_RULES.has(req.rule) && req.userAssessment) {
    const ua = req.userAssessment;
    if (ua.result === "MET" && !ua.evidence?.trim()) {
      return nv("قرار الاستيفاء بلا دليل مكتوب", "أضف الدليل الذي يثبت الاستيفاء");
    }
    return { result: ua.result as Evaluation["result"], evidence: ua.evidence ?? "", nextAction: ua.nextAction, decidedBy: "USER" };
  }

  switch (req.rule) {
    case "ENTITY_TYPE": {
      const f = ctx.profile["entity_type"];
      const t = factText(f);
      if (!t || f?.status === "MISSING") return nv("نوع الكيان غير مسجل في ملف الجمعية", "أضف نوع الكيان في ملف الجمعية وأكّده");
      if (f!.status !== "CONFIRMED") return nv(`نوع الكيان «${t}» مستخرج ولم يُؤكَّد`, "أكّد نوع الكيان في ملف الجمعية");
      return matchesAny(t, allowed) ? met(`نوع الكيان المؤكد: ${t}`) : notMet(`نوع الكيان «${t}» ليس ضمن: ${allowed.join("، ")}`, "راجع شروط الأهلية مع الجهة المانحة");
    }
    case "REGION": {
      if (!ctx.app.region) return nv("لم تُحدَّد منطقة التنفيذ", "حدد منطقة تنفيذ المشروع");
      return matchesAny(ctx.app.region, allowed)
        ? met(`منطقة التنفيذ: ${ctx.app.region}`)
        : notMet(`منطقة التنفيذ «${ctx.app.region}» ليست ضمن: ${allowed.join("، ")}`, "غيّر منطقة التنفيذ أو تحقق مع الجهة");
    }
    case "TARGET_GROUP": {
      const f = ctx.profile["target_groups"];
      const t = factText(f);
      if (t && f?.status === "CONFIRMED" && matchesAny(t, allowed)) return met(`الفئات المستهدفة المؤكدة تشمل: ${allowed.join("، ")}`);
      return nv(t ? `الفئات المسجلة: ${t}` : "الفئات المستهدفة غير مسجلة", "أكّد أن المستفيدين ضمن الفئات المؤهلة مع الدليل");
    }
    case "DOCUMENT_PRESENT": {
      const kind = p.documentKind as string | undefined;
      const kw = p.labelKeyword ? normalizeAr(String(p.labelKeyword)) : null;
      const docs = ctx.documents.filter(
        (d) => (!kind || d.kind === kind) && (!kw || normalizeAr(`${d.label ?? ""} ${d.filename}`).includes(kw)),
      );
      if (!docs.length) return nv("المستند غير مرفوع على المنصة (قد يكون متوفرًا لديكم)", "ارفع المستند إن كان متوفرًا");
      const valid = docs.find((d) => !d.expiresOn || new Date(d.expiresOn) >= ctx.now);
      if (!valid) return notMet(`المستند «${docs[0].filename}» منتهي الصلاحية`, "ارفع نسخة سارية");
      return met(`مرفوع: ${valid.label ?? valid.filename}${valid.expiresOn ? ` (ساري حتى ${valid.expiresOn.slice(0, 10)})` : ""}`);
    }
    case "BUDGET_CAP": {
      const max = p.maxSar != null ? BigInt(Math.round(Number(p.maxSar) * 100)) : null;
      if (max == null) return nv("الحد الأعلى غير معلوم", "أكّد الحد الأعلى من دليل المنحة");
      if (!ctx.budget || ctx.budget.total === 0n) return nv("لا توجد ميزانية بعد", "أعدّ الميزانية");
      return ctx.budget.donor <= max
        ? met(`المطلوب من المانح ${sar(ctx.budget.donor)} ضمن الحد ${sar(max)}`)
        : notMet(`المطلوب من المانح ${sar(ctx.budget.donor)} يتجاوز الحد ${sar(max)}`, "خفّض البنود الممولة من المانح أو انقلها لمصدر آخر");
    }
    case "DURATION_MAX": {
      const max = Number(p.maxMonths);
      if (!max) return nv("أقصى مدة غير معلومة", "أكّد المدة من دليل المنحة");
      if (!ctx.app.durationMonths) return nv("لم تُحدَّد مدة المشروع", "حدد مدة التنفيذ");
      return ctx.app.durationMonths <= max
        ? met(`مدة المشروع ${ctx.app.durationMonths} شهرًا ضمن الحد ${max}`)
        : notMet(`مدة المشروع ${ctx.app.durationMonths} شهرًا تتجاوز ${max}`, "قلّص مدة التنفيذ");
    }
    case "COFUNDING_MIN": {
      const minPct = Number(p.minPct);
      if (!minPct) return nv("نسبة المساهمة غير معلومة", "أكّد نسبة المساهمة من الدليل");
      if (!ctx.budget || ctx.budget.total === 0n) return nv("لا توجد ميزانية بعد", "أعدّ الميزانية");
      const b = ctx.budget;
      const contrib = p.countInKind === false ? b.selfCash + b.partnerCash : b.total - b.donor;
      const bp = Number((contrib * 10000n) / b.total);
      const pct = (bp / 100).toFixed(2);
      return bp >= minPct * 100
        ? met(`المساهمة غير المانحة ${pct}% (المطلوب ${minPct}%)`)
        : notMet(`المساهمة غير المانحة ${pct}% أقل من ${minPct}%`, "أضف مساهمة ذاتية أو من شريك");
    }
    case "EXCLUDED_COSTS": {
      const kws = ((p.keywords as string[] | undefined) ?? []).map(normalizeAr).filter(Boolean);
      if (!kws.length) return nv("قائمة التكاليف المستبعدة غير معلومة", "راجع دليل المنحة");
      if (!ctx.budgetLines.length) return nv("لا توجد ميزانية بعد", "أعدّ الميزانية");
      const bad = ctx.budgetLines.filter(
        (l) => l.fundingSource === "DONOR" && kws.some((k) => normalizeAr(`${l.item} ${l.costCenter}`).includes(k)),
      );
      return bad.length
        ? notMet(`بنود مستبعدة ممولة من المانح: ${bad.map((b) => b.item).join("، ")}`, "احذف البند أو غيّر مصدر تمويله")
        : met("لا توجد بنود مستبعدة ممولة من المانح");
    }
    default:
      return nv("شرط يحتاج قرارًا منك", "تحقق من الشرط وأضف الدليل");
  }
}
