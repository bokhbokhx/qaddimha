import { describe, expect, it } from "vitest";
import { evaluateRequirement, type EvalContext } from "@/lib/domain/requirements";
import { computeReadiness } from "@/lib/domain/readiness";
import { analyzeImpact, replaceWholeNumber } from "@/lib/domain/impact";
import { expertView } from "@/lib/domain/expert-view";
import { readySnapshot } from "../fixtures";

const ctx = (over: Partial<EvalContext> = {}): EvalContext => ({
  profile: {}, documents: [], app: { region: null, durationMonths: null, beneficiaryCount: null }, budget: null, budgetLines: [], now: new Date("2026-10-28"), ...over,
});

describe("تقييم الشروط: المجهول لا يصبح مستوفى", () => {
  it("كل القواعد تعيد «يحتاج تحققًا» عند غياب البيانات", () => {
    for (const rule of ["ENTITY_TYPE", "REGION", "TARGET_GROUP", "DOCUMENT_PRESENT", "BUDGET_CAP", "DURATION_MAX", "COFUNDING_MIN", "EXCLUDED_COSTS", "MANUAL"]) {
      const r = evaluateRequirement({ rule, ruleParams: { allowed: ["x"], maxSar: 10, maxMonths: 12, minPct: 10, keywords: ["ضيافة"] } }, ctx());
      expect(r.result, rule).toBe("NEEDS_VERIFICATION");
    }
  });
  it("المعلومة المستخرجة غير المؤكدة لا تكفي للاستيفاء", () => {
    const r = evaluateRequirement({ rule: "ENTITY_TYPE", ruleParams: { allowed: ["جمعية أهلية"] } }, ctx({ profile: { entity_type: { value: "جمعية أهلية", status: "EXTRACTED_UNCONFIRMED", sourceType: "DOCUMENT" } } }));
    expect(r.result).toBe("NEEDS_VERIFICATION");
  });
  it("المؤكد والمطابق مستوفى، والمؤكد المخالف غير مستوفى", () => {
    const ok = evaluateRequirement({ rule: "ENTITY_TYPE", ruleParams: { allowed: ["جمعية أهلية"] } }, ctx({ profile: { entity_type: { value: "جمعيه اهليه", status: "CONFIRMED", sourceType: "USER" } } }));
    expect(ok.result).toBe("MET");
    const bad = evaluateRequirement({ rule: "ENTITY_TYPE", ruleParams: { allowed: ["جمعية أهلية"] } }, ctx({ profile: { entity_type: { value: "شركة", status: "CONFIRMED", sourceType: "USER" } } }));
    expect(bad.result).toBe("NOT_MET");
  });
  it("المستند المنتهي غير مستوفى، والساري مستوفى", () => {
    const doc = (expiresOn: string) => ({ id: "d", kind: "ORG_LICENSE", label: null, filename: "f.pdf", expiresOn, status: "EXTRACTED" });
    expect(evaluateRequirement({ rule: "DOCUMENT_PRESENT", ruleParams: { documentKind: "ORG_LICENSE" } }, ctx({ documents: [doc("2025-01-01")] })).result).toBe("NOT_MET");
    expect(evaluateRequirement({ rule: "DOCUMENT_PRESENT", ruleParams: { documentKind: "ORG_LICENSE" } }, ctx({ documents: [doc("2027-01-01")] })).result).toBe("MET");
  });
  it("قرار المستخدم بالاستيفاء دون دليل لا يُقبل", () => {
    expect(evaluateRequirement({ rule: "MANUAL", ruleParams: null, userAssessment: { result: "MET", evidence: " ", nextAction: null } }, ctx()).result).toBe("NEEDS_VERIFICATION");
    expect(evaluateRequirement({ rule: "MANUAL", ruleParams: null, userAssessment: { result: "MET", evidence: "دليل", nextAction: null } }, ctx()).result).toBe("MET");
  });
  it("البند المستبعد الممول من المانح يخالف الشرط، ومن الجمعية لا يخالف", () => {
    const line = (fundingSource: string) => ({ item: "ضيافة ورش العمل", costCenter: "", fundingSource, totalHalalas: 100n });
    expect(evaluateRequirement({ rule: "EXCLUDED_COSTS", ruleParams: { keywords: ["ضيافة"] } }, ctx({ budgetLines: [line("DONOR")] })).result).toBe("NOT_MET");
    expect(evaluateRequirement({ rule: "EXCLUDED_COSTS", ruleParams: { keywords: ["ضيافة"] } }, ctx({ budgetLines: [line("SELF")] })).result).toBe("MET");
  });
});

describe("الجاهزية", () => {
  it("اللقطة المكتملة جاهزة بنسبة 100%", () => {
    const r = computeReadiness(readySnapshot());
    expect(r.blockers).toEqual([]);
    expect(r.ready).toBe(true);
    expect(r.completionPct).toBe(100);
  });
  it("عائق إلزامي واحد يمنع وصف الطلب بأنه جاهز رغم ارتفاع النسبة", () => {
    const s = readySnapshot();
    s.requirements[0].evaluation = { result: "NEEDS_VERIFICATION", evidence: "غير معروف", nextAction: "تحقق", decidedBy: "RULE" };
    const r = computeReadiness(s);
    expect(r.ready).toBe(false);
    expect(r.completionPct).toBeGreaterThan(90);
    expect(r.blockers.map((b) => b.id)).toContain("req:r1");
  });
  it("الإجابة المتجاوزة للحد، والقسم المحتاج مراجعة، والرقم التقديري، والشريك المؤكد دون اعتماد — كلها عوائق", () => {
    const s = readySnapshot();
    s.questions[0].answer!.content = "واحد اثنان ثلاثة أربعة خمسة ستة";
    s.sections[1].status = "NEEDS_REVIEW";
    s.budgetLines[0].isEstimate = true;
    s.partners.push({ id: "p", name: "شريك", partnerType: "", role: "", status: "CONFIRMED", tasks: "", cashHalalas: "0", inKindDescription: "", responsibilities: "", mutualValue: "", evidenceDocId: null, orgApproved: false });
    const ids = computeReadiness(s).blockers.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["ans:q1", `sec:${s.sections[1].key}`, "blest:b1", "pa:p"]));
  });
  it("تعارض في بيانات المنحة عائق، وتناقض عدد المستفيدين في الملخص عائق", () => {
    const s = readySnapshot();
    s.opportunity.facts.deadlines = { value: "x", status: "CONFLICT", sourceType: "DOCUMENT" };
    s.application.beneficiaryCount = 200;
    const ids = computeReadiness(s).blockers.map((b) => b.id);
    expect(ids).toEqual(expect.arrayContaining(["opp:deadlines", "benef-mismatch"]));
  });
});

describe("تحليل أثر التعديل", () => {
  const state = () => ({
    sections: [{ key: "summary", content: "تمكين 150 شابًا خلال 12 شهرًا بتكلفة 1500 ريال", status: "APPROVED" }, { key: "risks", content: "لا أرقام", status: "APPROVED" }],
    questions: [{ id: "q1", linkedSections: ["summary"], answer: { content: "نخدم 150 شابًا", status: "APPROVED" } }, { id: "q2", linkedSections: ["risks"], answer: { content: "نص", status: "APPROVED" } }],
    indicators: [{ id: "i1", activityId: "a1", target: "150", type: "OUTPUT" }, { id: "i2", activityId: null, target: "30%", type: "OUTCOME" }],
    budgetLines: [
      { id: "l1", activityId: "a1", quantityFollowsBeneficiaries: true, periodsFollowDuration: false, calc: "ONE_TIME", periods: 1, quantityMilli: 150000n },
      { id: "l2", activityId: null, quantityFollowsBeneficiaries: false, periodsFollowDuration: true, calc: "RECURRING", periods: 12, quantityMilli: 1000n },
    ],
  });
  it("يستبدل الرقم كاملًا فقط", () => {
    expect(replaceWholeNumber("150 و1500 و150.5", 150, 200)).toBe("200 و1500 و150.5");
  });
  it("تغيير عدد المستفيدين: إعادة حساب مباشرة + وسم الأقسام والإجابات + مقترحات قبل/بعد", () => {
    const r = analyzeImpact({ type: "beneficiaries", from: 150, to: 200 }, state());
    expect(r.budgetRecalc).toEqual([{ id: "l1", field: "quantityMilli", from: "150000", to: "200000" }]);
    expect(r.sectionsToReview.map((s) => s.key)).toContain("summary");
    expect(r.answersToStale.map((a) => a.questionId)).toEqual(["q1"]);
    expect(r.indicatorsToReview).toEqual(["i1"]);
    const p = r.proposals.find((x) => x.targetId === "summary")!;
    expect(p.after).toBe("تمكين 200 شابًا خلال 12 شهرًا بتكلفة 1500 ريال");
    expect(p.before).toContain("150 شابًا");
  });
  it("تغيير المدة يعيد حساب البنود الدورية المرتبطة بها", () => {
    const r = analyzeImpact({ type: "duration", from: 12, to: 9 }, state());
    expect(r.budgetRecalc).toEqual([{ id: "l2", field: "periods", from: "12", to: "9" }]);
  });
  it("حذف نشاط يعلّم مؤشراته وبنوده والأقسام المرتبطة", () => {
    const r = analyzeImpact({ type: "activity_deleted", activityId: "a1", code: "ن1", name: "تدريب" }, { ...state(), sections: [{ key: "scope", content: "نطاق", status: "APPROVED" }] });
    expect(r.indicatorsToReview).toEqual(["i1"]);
    expect(r.budgetLinesToReview).toEqual(["l1"]);
    expect(r.sectionsToReview.map((s) => s.key)).toEqual(["scope"]);
  });
});

describe("عرض الخبير", () => {
  it("لا يكشف ملف الجمعية الكامل ولا قائمة مستنداتها", () => {
    const s = readySnapshot();
    s.organization.profile.contact_email = { value: "secret@org.test", status: "CONFIRMED", sourceType: "USER" };
    s.documents = [{ id: "d-secret", kind: "ORG_FINANCIAL", label: "قوائم سرية", filename: "fin.pdf", expiresOn: null, status: "EXTRACTED" }];
    const v = expertView(s, []);
    const json = JSON.stringify(v);
    expect(json).not.toContain("secret@org.test");
    expect(json).not.toContain("d-secret");
    expect(v.sharedDocs).toEqual([]);
  });
});
