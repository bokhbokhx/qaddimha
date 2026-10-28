// حسابات مالية دقيقة بالأعداد الصحيحة (هللة = 1/100 ريال، الكمية بالألف)
// لا نستخدم الفاصلة العائمة في الجمع أو الضرب.

export const QTY_SCALE = 1000n;

/** يحوّل نصًا مثل "1,250.50" أو "١٢٥٠٫٥" إلى هللات. يرمي خطأ عند عدم الصلاحية. */
export function parseSarToHalalas(input: string | number): bigint {
  const s = normalizeDigits(String(input)).replace(/[,\s،]/g, "").replace("٫", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw new Error("مبلغ غير صالح");
  const neg = s.startsWith("-");
  const [whole, frac = ""] = s.replace("-", "").split(".");
  const v = BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
  return neg ? -v : v;
}

/** يحوّل كمية نصية (حتى 3 خانات عشرية) إلى وحدات بالألف. */
export function parseQuantityToMilli(input: string | number): bigint {
  const s = normalizeDigits(String(input)).replace(/[,\s،]/g, "").replace("٫", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(s)) throw new Error("كمية غير صالحة");
  const [whole, frac = ""] = s.split(".");
  return BigInt(whole) * QTY_SCALE + BigInt((frac + "000").slice(0, 3));
}

export function normalizeDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** قسمة صحيحة مع تقريب نصف للأعلى (للقيم الموجبة والسالبة). */
export function divRoundHalfUp(n: bigint, d: bigint): bigint {
  if (d <= 0n) throw new Error("قاسم غير صالح");
  const neg = n < 0n;
  const a = neg ? -n : n;
  const q = (a * 2n + d) / (2n * d);
  return neg ? -q : q;
}

export type CalcType = "ONE_TIME" | "RECURRING";

/**
 * إجمالي البند:
 *  - ONE_TIME: الكمية × تكلفة الوحدة (عدد الفترات لا يُحتسب، لمنع احتساب المدة مرتين)
 *  - RECURRING: الكمية × تكلفة الوحدة × عدد الفترات
 */
export function lineTotalHalalas(line: {
  quantityMilli: bigint;
  unitCostHalalas: bigint;
  calc: CalcType;
  periods: number;
}): bigint {
  const periods = line.calc === "RECURRING" ? BigInt(Math.max(0, Math.trunc(line.periods))) : 1n;
  return divRoundHalfUp(line.quantityMilli * line.unitCostHalalas * periods, QTY_SCALE);
}

export function lineFormula(line: { calc: CalcType }): string {
  return line.calc === "RECURRING"
    ? "الكمية × تكلفة الوحدة × عدد الفترات"
    : "الكمية × تكلفة الوحدة (مرة واحدة)";
}

export interface BudgetLineInput {
  quantityMilli: bigint;
  unitCostHalalas: bigint;
  calc: CalcType;
  periods: number;
  fundingSource: "DONOR" | "SELF" | "PARTNER";
  contributionType: "CASH" | "IN_KIND";
}

export interface BudgetSummary {
  total: bigint; // إجمالي المشروع (نقدي + عيني)
  cashTotal: bigint;
  inKindTotal: bigint;
  donor: bigint; // المطلوب من المانح (نقدي دائمًا)
  selfCash: bigint;
  selfInKind: bigint;
  partnerCash: bigint;
  partnerInKind: bigint;
  /**
   * الفجوة النقدية = البنود النقدية المنسوبة للشركاء − التعهدات النقدية من شركاء «مؤكدين».
   * أي مبلغ نقدي يعتمد على شريك غير مؤكد يُعد فجوة حتى يُؤكَّد.
   */
  cashGap: bigint;
  /** نسبة المساهمة غير المانحة من الإجمالي بالأساس 10000 (basis points) */
  nonDonorShareBp: number;
}

/**
 * ملخص الميزانية. المساهمة العينية تُحتسب في إجمالي المشروع ولكن لا تُخصم من التمويل النقدي،
 * ولا يُعقل أن يكون المانح مصدر مساهمة عينية (تُعامل كنقدية).
 */
export function summarizeBudget(
  lines: BudgetLineInput[],
  opts: { confirmedPartnerCash?: bigint } = {},
): BudgetSummary {
  const s = {
    total: 0n, cashTotal: 0n, inKindTotal: 0n, donor: 0n,
    selfCash: 0n, selfInKind: 0n, partnerCash: 0n, partnerInKind: 0n,
  };
  for (const l of lines) {
    const t = lineTotalHalalas(l);
    s.total += t;
    const inKind = l.contributionType === "IN_KIND" && l.fundingSource !== "DONOR";
    if (inKind) s.inKindTotal += t; else s.cashTotal += t;
    if (l.fundingSource === "DONOR") s.donor += t;
    else if (l.fundingSource === "SELF") {
      if (inKind) s.selfInKind += t;
      else s.selfCash += t;
    } else if (inKind) s.partnerInKind += t;
    else s.partnerCash += t;
  }
  const cashGap = partnerCashGap(s.partnerCash, opts.confirmedPartnerCash ?? 0n);
  const nonDonor = s.total - s.donor;
  const nonDonorShareBp = s.total === 0n ? 0 : Number((nonDonor * 10000n) / s.total);
  return { ...s, cashGap, nonDonorShareBp };
}

/** فجوة نقدية مقابل تعهدات الشركاء الفعلية: البنود الممولة من شريك نقديًا تتجاوز ما تعهد به الشركاء */
export function partnerCashGap(partnerCashLines: bigint, partnerCommitted: bigint): bigint {
  return partnerCashLines > partnerCommitted ? partnerCashLines - partnerCommitted : 0n;
}

const sarFmt = new Intl.NumberFormat("ar-SA-u-nu-latn", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function halalasToNumberString(h: bigint): string {
  const neg = h < 0n;
  const a = neg ? -h : h;
  return `${neg ? "-" : ""}${a / 100n}.${String(a % 100n).padStart(2, "0")}`;
}

/** عرض المبلغ بالريال مع فواصل الآلاف (يُبنى نصيًا لتجنب تحويل BigInt كبير إلى Number) */
export function formatSar(h: bigint, withUnit = true): string {
  const neg = h < 0n;
  const a = neg ? -h : h;
  const whole = (a / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = String(a % 100n).padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}${withUnit ? " ر.س" : ""}`;
}

export function milliToString(m: bigint): string {
  const whole = m / QTY_SCALE;
  const frac = (m % QTY_SCALE).toString().padStart(3, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}

export { sarFmt };
