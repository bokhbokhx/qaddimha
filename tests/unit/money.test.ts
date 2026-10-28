import { describe, expect, it } from "vitest";
import { divRoundHalfUp, formatSar, lineTotalHalalas, parseQuantityToMilli, parseSarToHalalas, summarizeBudget } from "@/lib/money";

describe("المبالغ والحسابات", () => {
  it("يحلل المبالغ العشرية والأرقام العربية دون فاصلة عائمة", () => {
    expect(parseSarToHalalas("1,250.5")).toBe(125050n);
    expect(parseSarToHalalas("٠٫١")).toBe(10n);
    expect(parseSarToHalalas("0.1")).toBe(10n);
    expect(() => parseSarToHalalas("1.234")).toThrow();
    expect(parseQuantityToMilli("2.5")).toBe(2500n);
  });

  it("0.1 + 0.2 بالهللة يساوي 0.3 تمامًا", () => {
    const lines = ["0.1", "0.2"].map((c) => ({ quantityMilli: 1000n, unitCostHalalas: parseSarToHalalas(c), calc: "ONE_TIME" as const, periods: 1, fundingSource: "DONOR" as const, contributionType: "CASH" as const }));
    expect(summarizeBudget(lines).total).toBe(30n);
  });

  it("الكمية × تكلفة الوحدة × الفترات مع تقريب نصف للأعلى", () => {
    expect(lineTotalHalalas({ quantityMilli: 2500n, unitCostHalalas: 33333n, calc: "RECURRING", periods: 12 })).toBe(999990n);
    expect(lineTotalHalalas({ quantityMilli: 1500n, unitCostHalalas: 1n, calc: "ONE_TIME", periods: 1 })).toBe(2n);
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
  });

  it("البند لمرة واحدة لا يحتسب المدة حتى لو حُفظت فترات", () => {
    expect(lineTotalHalalas({ quantityMilli: 1000n, unitCostHalalas: 100000n, calc: "ONE_TIME", periods: 12 })).toBe(100000n);
  });

  it("يفصل العيني عن النقدي ولا يخصمه من التمويل النقدي", () => {
    const s = summarizeBudget([
      { quantityMilli: 1000n, unitCostHalalas: 900000n, calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH" },
      { quantityMilli: 1000n, unitCostHalalas: 50000n, calc: "RECURRING", periods: 2, fundingSource: "SELF", contributionType: "IN_KIND" },
      { quantityMilli: 1000n, unitCostHalalas: 20000n, calc: "ONE_TIME", periods: 1, fundingSource: "PARTNER", contributionType: "CASH" },
      // المانح لا يقدم مساهمة عينية: تُعامل كنقدية
      { quantityMilli: 1000n, unitCostHalalas: 1000n, calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "IN_KIND" },
    ]);
    expect(s.total).toBe(1021000n);
    expect(s.donor).toBe(901000n);
    expect(s.cashTotal).toBe(921000n);
    expect(s.inKindTotal).toBe(100000n);
    expect(s.selfInKind).toBe(100000n);
    expect(s.cashGap).toBe(20000n); // شريك نقدي غير مؤكد
    expect(summarizeBudget([{ quantityMilli: 1000n, unitCostHalalas: 20000n, calc: "ONE_TIME", periods: 1, fundingSource: "PARTNER", contributionType: "CASH" }], { confirmedPartnerCash: 20000n }).cashGap).toBe(0n);
    expect(s.nonDonorShareBp).toBe(1175);
  });

  it("يعرض المبالغ الكبيرة بدقة", () => {
    expect(formatSar(123456789012345n)).toBe("1,234,567,890,123.45 ر.س");
  });
});
