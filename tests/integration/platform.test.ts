import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { beforeAll, describe, expect, it, vi } from "vitest";

// جلسة قابلة للتبديل بدل الكعكات الحقيقية
let currentToken: string | null = null;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => (currentToken ? { value: currentToken } : undefined), set: () => {}, delete: () => {} }),
  headers: async () => new Headers(),
}));
vi.mock("next/navigation", () => ({ redirect: (u: string) => { throw new Error(`REDIRECT ${u}`); }, notFound: () => { throw new Error("NOT_FOUND"); } }));

const { db } = await import("@/lib/db");
const { hashToken } = await import("@/lib/auth/session");
const { AuthError, requireApplication, requireDocument, requireExpertReview } = await import("@/lib/auth/guard");
const { createDemoOpportunity } = await import("@/lib/services/opportunity");
const A = await import("@/lib/services/application");
const AS = await import("@/lib/services/assistant");
const { ConflictError, createRevision } = await import("@/lib/services/revisions");
const { generateExportPackage } = await import("@/lib/services/exports");
const { storeDocument, UploadError } = await import("@/lib/services/documents");
const { processPaymentEvent, createOrder, PaymentError } = await import("@/lib/services/payments");
const { runAITask } = await import("@/lib/ai/runner");
const { OrgExtractionSchema } = await import("@/lib/ai/schemas");
const { extractOrgProfile } = await import("@/lib/services/extraction");
const { requestExpertReview, assignExpert } = await import("@/lib/services/reviews");
const { storage } = await import("@/lib/storage");
const docRoute = await import("@/app/api/documents/[id]/route");
const exportRoute = await import("@/app/api/exports/[id]/route");

async function user(email: string, platformRole: "USER" | "EXPERT" | "ADMIN" = "USER") {
  const u = await db.user.create({ data: { email, name: email, passwordHash: "x", platformRole } });
  const token = randomBytes(16).toString("hex");
  await db.session.create({ data: { id: hashToken(token), userId: u.id, expiresAt: new Date(Date.now() + 864e5) } });
  return { ...u, token };
}
const as = (u: { token: string }) => { currentToken = u.token; };
const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;

let owner: Awaited<ReturnType<typeof user>>, viewer: typeof owner, outsider: typeof owner, expert: typeof owner, expert2: typeof owner, admin: typeof owner;
let orgId: string, appId: string;

beforeAll(async () => {
  owner = await user("owner@t.test");
  viewer = await user("viewer@t.test");
  outsider = await user("outsider@t.test");
  expert = await user("expert@t.test", "EXPERT");
  expert2 = await user("expert2@t.test", "EXPERT");
  admin = await user("admin@t.test", "ADMIN");
  const org = await db.organization.create({ data: { displayName: "جمعية الاختبار", isDemo: true, memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: viewer.id, role: "VIEWER" }] }, profile: { create: {} } } });
  await db.organization.create({ data: { displayName: "جمعية أخرى", memberships: { create: [{ userId: outsider.id, role: "OWNER" }] }, profile: { create: {} } } });
  orgId = org.id;
  const opp = await createDemoOpportunity(orgId, owner.id);
  appId = (await A.createApplication({ organizationId: orgId, userId: owner.id, opportunityId: opp.id, title: "طلب اختبار" })).id;
});

describe("عزل الجمعيات على الخادم", () => {
  it("مستخدم جمعية أخرى لا يقرأ الطلب ولا يعدّله", async () => {
    as(outsider);
    await expect(requireApplication(appId)).rejects.toMatchObject({ status: 404 });
    await expect(requireApplication(appId, "EDITOR")).rejects.toBeInstanceOf(AuthError);
  });
  it("القارئ يقرأ ولا يعدّل", async () => {
    as(viewer);
    await expect(requireApplication(appId, "VIEWER")).resolves.toMatchObject({ applicationId: appId });
    await expect(requireApplication(appId, "EDITOR")).rejects.toMatchObject({ status: 403 });
  });
  it("مستخدم جمعية أخرى لا ينزل مستنداتها", async () => {
    const doc = await db.document.findFirstOrThrow({ where: { organizationId: orgId } });
    as(outsider);
    await expect(requireDocument(doc.id)).rejects.toMatchObject({ status: 404 });
    const res = await docRoute.GET(new Request("http://x/api/documents/" + doc.id), params(doc.id));
    expect(res.status).toBe(404);
    currentToken = null;
    expect((await docRoute.GET(new Request("http://x"), params(doc.id))).status).toBe(401);
    as(owner);
    const ok = await docRoute.GET(new Request("http://x"), params(doc.id));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-disposition")).toContain("attachment");
  });
});

describe("الملفات والاستخراج", () => {
  it("فشل استخراج PDF ممسوح لا يحذف الملف ويشرح الخيارات", async () => {
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF");
    const d = await storeDocument({ organizationId: orgId, userId: owner.id, filename: "scan.pdf", data: pdf, kind: "ORG_DOC" });
    expect(d.status).toBe("FAILED");
    expect(d.extractionError).toMatch(/OCR|تالف/);
    expect(await db.document.count({ where: { id: d.id } })).toBe(1);
  });
  it("يرفض SVG والأنواع غير المدعومة بالتحقق من المحتوى لا الاسم", async () => {
    await expect(storeDocument({ organizationId: orgId, userId: owner.id, filename: "logo.png", data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>'), kind: "LOGO" })).rejects.toBeInstanceOf(UploadError);
    await expect(storeDocument({ organizationId: orgId, userId: owner.id, filename: "a.exe", data: Buffer.from([0x4d, 0x5a, 0, 1, 2, 0]), kind: "ORG_DOC" })).rejects.toBeInstanceOf(UploadError);
  });
  it("الوضع التجريبي لا يدّعي فهم ملف عشوائي، ولا يترك مهمة معلقة أو بيانات ناقصة", async () => {
    const d = await storeDocument({ organizationId: orgId, userId: owner.id, filename: "random.txt", data: Buffer.from("نص عشوائي عن جمعية مجهولة"), kind: "ORG_DOC" });
    const factsBefore = await db.fact.count({ where: { organizationId: orgId } });
    await expect(extractOrgProfile(orgId, [d.id])).rejects.toMatchObject({ code: "DEMO_UNSUPPORTED" });
    expect(await db.fact.count({ where: { organizationId: orgId } })).toBe(factsBefore);
    expect(await db.aIJob.count({ where: { organizationId: orgId, status: { in: ["PENDING", "RUNNING"] } } })).toBe(0);
  });
  it("ملف المثال المعروف يُستخرج كمقترحات تحتاج تأكيدًا مع مصدرها", async () => {
    const buf = await readFile("samples/athar-profile-demo.docx");
    const d = await storeDocument({ organizationId: orgId, userId: owner.id, filename: "athar-profile-demo.docx", data: buf, kind: "ORG_PROFILE_DECK" });
    await extractOrgProfile(orgId, [d.id]);
    const f = await db.fact.findFirstOrThrow({ where: { organizationId: orgId, key: "entity_type" } });
    expect(f.status).toBe("EXTRACTED_UNCONFIRMED");
    expect(f.sourceDocId).toBe(d.id);
    expect(f.sourceLocator).toMatch(/فقرة \d+/);
  });
});

describe("فشل الذكاء الاصطناعي", () => {
  it("الفشل يُسجَّل ولا يستهلك الحد ولا يغير البيانات", async () => {
    const before = await db.application.findUniqueOrThrow({ where: { id: appId } });
    await expect(
      runAITask({ task: "extract_org_profile", organizationId: orgId, applicationId: appId, input: { x: 1 }, prompt: "", schema: OrgExtractionSchema, demo: () => { throw new Error("boom"); } }),
    ).rejects.toBeTruthy();
    const job = await db.aIJob.findFirstOrThrow({ where: { organizationId: orgId, applicationId: appId }, orderBy: { createdAt: "desc" } });
    expect(job.status).toBe("FAILED");
    expect((await db.application.findUniqueOrThrow({ where: { id: appId } })).aiActionsUsed).toBe(before.aiActionsUsed);
  });
  it("المهام العالقة القديمة تتحول إلى فاشلة", async () => {
    const stale = await db.aIJob.create({ data: { organizationId: orgId, task: "draft_project", provider: "demo", model: "x", inputHash: "h", status: "RUNNING", createdAt: new Date(Date.now() - 24 * 3600e3) } });
    await runAITask({ task: "consistency_check", organizationId: orgId, input: { y: 2 }, prompt: "", schema: OrgExtractionSchema, demo: () => ({ fields: [], notes: [] }) });
    expect((await db.aIJob.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("FAILED");
  });
});

describe("المسار والتعديل والنسخ والتصدير", () => {
  it("يبني الطلب ويكشف التعارض في الحفظ المتزامن", async () => {
    const app0 = await db.application.findUniqueOrThrow({ where: { id: appId } });
    await A.updateKeyParams({ applicationId: appId, userId: owner.id, expectedVersion: app0.version, beneficiaryCount: 150, durationMonths: 12, region: "منطقة الرياض" });
    await AS.saveIdeaSummary(appId, "فكرة تجريبية معتمدة لمشروع جاهز رقميًا", true);
    await AS.draftProject(appId, owner.id);
    await AS.suggestBudget(appId, owner.id);

    const sec = await db.projectSection.findFirstOrThrow({ where: { applicationId: appId, key: "risks" } });
    await A.saveSection({ applicationId: appId, key: "risks", content: "نص 1", expectedVersion: sec.version });
    await expect(A.saveSection({ applicationId: appId, key: "risks", content: "نص 2 من نافذة قديمة", expectedVersion: sec.version })).rejects.toBeInstanceOf(ConflictError);
    expect((await db.projectSection.findFirstOrThrow({ where: { id: sec.id } })).content).toBe("نص 1");

    const v = (await db.application.findUniqueOrThrow({ where: { id: appId } })).version;
    const line = await db.budgetLine.findFirstOrThrow({ where: { applicationId: appId } });
    const form = { id: line.id, item: line.item, costCenter: "", activityId: null, partnerId: null, unit: "", quantity: "2", unitCostSar: "10.05", calc: "ONE_TIME" as const, periods: 1, fundingSource: "DONOR" as const, contributionType: "CASH" as const, justification: "", periodsFollowDuration: false, quantityFollowsBeneficiaries: false };
    await A.saveBudgetLine(appId, form, v);
    await expect(A.saveBudgetLine(appId, { ...form, quantity: "3" }, v)).rejects.toBeInstanceOf(ConflictError);
    expect((await db.budgetLine.findUniqueOrThrow({ where: { id: line.id } })).quantityMilli).toBe(2000n);
  });

  it("حذف نشاط وتغيير المستفيدين يعلّم المتأثر ويحفظ نسخة قبل التغيير", async () => {
    for (const s of await db.projectSection.findMany({ where: { applicationId: appId } })) {
      if (/\[يحتاج استكمال/.test(s.content)) await A.saveSection({ applicationId: appId, key: s.key, content: s.content.replace(/\[يحتاج استكمال[^\]]*\]/, "دليل: استبيان 2025"), expectedVersion: s.version });
      await A.approveSection(appId, s.key);
    }
    const revsBefore = await db.revision.count({ where: { applicationId: appId } });
    let app = await db.application.findUniqueOrThrow({ where: { id: appId } });
    await A.updateKeyParams({ applicationId: appId, userId: owner.id, expectedVersion: app.version, beneficiaryCount: 200 });
    expect(await db.revision.count({ where: { applicationId: appId } })).toBe(revsBefore + 1);
    const summary = await db.projectSection.findFirstOrThrow({ where: { applicationId: appId, key: "summary" } });
    expect(summary.status).toBe("NEEDS_REVIEW");
    expect(summary.content).toContain("150"); // النص لا يتغير دون موافقة
    const proposal = await db.changeProposal.findFirstOrThrow({ where: { applicationId: appId, targetId: "summary", status: "PENDING" } });
    expect(proposal.after).toContain("200 شابًا");
    const materials = await db.budgetLine.findFirstOrThrow({ where: { applicationId: appId, item: "مواد تدريبية" } });
    expect(materials.quantityMilli).toBe(200000n); // حساب مباشر فوري

    const act = await db.activity.findFirstOrThrow({ where: { applicationId: appId, code: "ن5" } });
    app = await db.application.findUniqueOrThrow({ where: { id: appId } });
    await A.deleteActivity(appId, act.id, owner.id, app.version);
    const evalLine = await db.budgetLine.findFirstOrThrow({ where: { applicationId: appId, item: "التقييم والقياس" } });
    expect(evalLine.needsReview).toBe(true);
    expect(evalLine.activityId).toBeNull();
    const lastRev = await db.revision.findFirstOrThrow({ where: { applicationId: appId }, orderBy: { number: "desc" } });
    expect(lastRev.label).toContain("ن5");
    expect(JSON.stringify(lastRev.snapshot)).toContain("التقييم والقياس");
  });

  it("التصدير يستخدم نفس النسخة المعتمدة ولا يتأثر بالتعديلات اللاحقة", async () => {
    const rev = await A.approveRevision(appId, owner.id, "نسخة للتصدير");
    expect(rev.readyAtApproval).toBe(false);
    const first = await generateExportPackage(appId, rev.id, owner.id);
    expect(first.isDraft).toBe(true);
    expect(first.exports.every((e) => e.revisionId === rev.id)).toBe(true);

    const sec = await db.projectSection.findFirstOrThrow({ where: { applicationId: appId, key: "risks" } });
    await A.saveSection({ applicationId: appId, key: "risks", content: "نص جديد بعد الاعتماد لا يجب أن يظهر", expectedVersion: sec.version });
    const second = await generateExportPackage(appId, rev.id, owner.id);

    const pdf = second.exports.find((e) => e.format === "PDF")!;
    expect((await storage.get(pdf.storageKey)).subarray(0, 5).toString()).toBe("%PDF-");
    const docx = await JSZip.loadAsync(await storage.get(second.exports.find((e) => e.format === "DOCX")!.storageKey));
    const xml = await docx.file("word/document.xml")!.async("string");
    expect(xml).not.toContain("نص جديد بعد الاعتماد");
    expect(xml).toContain("<w:bidi/>");
    expect(xml).toContain(`النسخة رقم ${rev.number}`);
    const answers = (await storage.get(second.exports.find((e) => e.format === "ANSWERS_TXT")!.storageKey)).toString("utf8");
    expect(answers).toContain(`النسخة رقم ${rev.number}`);
    expect(answers).toContain("مسودة");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await storage.get(second.exports.find((e) => e.format === "XLSX")!.storageKey)) as never);
    const ws = wb.getWorksheet("الميزانية")!;
    expect(ws.views[0].rightToLeft).toBe(true);
    const f = ws.getCell("I6").value as { formula: string };
    expect(f.formula).toBe("ROUND(E6*F6*H6,2)");
    // القيم المخزنة للمجاميع أرقام صحيحة لا NaN
    let found = false;
    ws.eachRow((row) => {
      if (row.getCell(8).value === "إجمالي المشروع") {
        const v = row.getCell(9).value as { result: number };
        expect(Number.isFinite(v.result)).toBe(true);
        expect(v.result).toBeGreaterThan(0);
        found = true;
      }
    });
    expect(found).toBe(true);

    as(outsider);
    expect((await exportRoute.GET(new Request("http://x"), params(pdf.id))).status).toBe(404);
  });
});

describe("الدفع", () => {
  it("يتحقق من المبلغ والعملة ويمنع المعالجة المكررة", async () => {
    const o = await createOrder({ organizationId: orgId, applicationId: appId, userId: owner.id, product: "APPLICATION_PACKAGE" });
    await expect(processPaymentEvent({ provider: "T", providerRef: "r-bad", orderId: o.id, amountHalalas: 1n, currency: "SAR", succeeded: true, isSimulated: true })).rejects.toBeInstanceOf(PaymentError);
    await expect(processPaymentEvent({ provider: "T", providerRef: "r-usd", orderId: o.id, amountHalalas: o.amountHalalas, currency: "USD", succeeded: true, isSimulated: true })).rejects.toBeInstanceOf(PaymentError);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING");
    const r1 = await processPaymentEvent({ provider: "T", providerRef: "r-1", orderId: o.id, amountHalalas: o.amountHalalas, currency: "SAR", succeeded: true, isSimulated: true });
    const r2 = await processPaymentEvent({ provider: "T", providerRef: "r-1", orderId: o.id, amountHalalas: o.amountHalalas, currency: "SAR", succeeded: true, isSimulated: true });
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    expect(await db.payment.count({ where: { orderId: o.id } })).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
  });
});

describe("مراجعة الخبير", () => {
  it("لا تكشف بقية بيانات الجمعية ومحصورة بالخبير المُسند", async () => {
    await expect(requestExpertReview({ applicationId: appId, organizationId: orgId, userId: owner.id, revisionId: "x", consent: true, sharedDocIds: [], notes: "" })).rejects.toThrow();
    const o = await createOrder({ organizationId: orgId, applicationId: appId, userId: owner.id, product: "EXPERT_REVIEW" });
    await processPaymentEvent({ provider: "T", providerRef: "rev-1", orderId: o.id, amountHalalas: o.amountHalalas, currency: "SAR", succeeded: true, isSimulated: true });
    const rev = await db.$transaction((tx) => createRevision(tx, appId, owner.id, { label: "للخبير", reason: "MANUAL" }));
    const docs = await db.document.findMany({ where: { organizationId: orgId } });
    const shared = docs[0];
    const notShared = docs[1];
    await expect(requestExpertReview({ applicationId: appId, organizationId: orgId, userId: owner.id, revisionId: rev.id, consent: false, sharedDocIds: [], notes: "" })).rejects.toThrow(/موافقتك/);
    const rr = await requestExpertReview({ applicationId: appId, organizationId: orgId, userId: owner.id, revisionId: rev.id, consent: true, sharedDocIds: [shared.id, "doc-of-other-org"], notes: "" });
    expect(rr.sharedDocIds).toEqual([shared.id]);
    await assignExpert(rr.id, expert.id, admin.id);

    as(expert2);
    await expect(requireExpertReview(rr.id)).rejects.toMatchObject({ status: 404 });
    as(expert);
    await expect(requireExpertReview(rr.id)).resolves.toBeTruthy();
    await expect(requireApplication(appId)).rejects.toMatchObject({ status: 404 });
    expect((await docRoute.GET(new Request("http://x"), params(shared.id))).status).toBe(200);
    expect((await docRoute.GET(new Request("http://x"), params(notShared.id))).status).toBe(404);
  });
});
