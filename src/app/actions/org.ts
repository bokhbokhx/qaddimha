"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireDocument, requireOrg } from "@/lib/auth/guard";
import { run } from "@/lib/action-result";
import { PROFILE_FIELDS } from "@/lib/catalog";
import { confirmFact } from "@/lib/services/facts";
import { deleteDocument, extractDocumentText, storeDocument } from "@/lib/services/documents";
import { extractOrgProfile } from "@/lib/services/extraction";
import { readSample } from "@/lib/demo/samples";
import { SAMPLE_FILES, SAMPLE_LABELS } from "@/lib/demo/content";

const keys = new Set(PROFILE_FIELDS.map((f) => f.key));

/** حفظ أو تأكيد معلومة في ملف الجمعية — تحديث الملف المعتمد يتم بقرار المستخدم فقط */
export async function saveProfileFactAction(key: string, value: unknown) {
  return run(async () => {
    const ctx = await requireOrg("EDITOR");
    if (!keys.has(key)) throw new Error("حقل غير معروف");
    const v = z.union([z.string().max(5000), z.array(z.string().max(1000)).max(50), z.array(z.object({ text: z.string().max(1000), source: z.string().max(500).nullable(), period: z.string().max(200).nullable() })).max(50), z.null()]).parse(value);
    await confirmFact(db, { organizationId: ctx.orgId, scope: "ORG_PROFILE", key, value: v, userId: ctx.user.id });
    revalidatePath("/app/organization");
  }, "تم الحفظ");
}

export async function extractProfileAction(documentIds: string[]) {
  return run(async () => {
    const ctx = await requireOrg("EDITOR");
    const r = await extractOrgProfile(ctx.orgId, documentIds);
    revalidatePath("/app/organization");
    return { fields: r.data.fields.length, notes: r.data.notes, demo: r.demo };
  });
}

export async function updateIdentityAction(primaryColor: string, secondaryColor: string) {
  return run(async () => {
    const ctx = await requireOrg("EDITOR");
    const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح");
    await db.organizationProfile.upsert({
      where: { organizationId: ctx.orgId },
      create: { organizationId: ctx.orgId, primaryColor: hex.parse(primaryColor), secondaryColor: hex.parse(secondaryColor) },
      update: { primaryColor: hex.parse(primaryColor), secondaryColor: hex.parse(secondaryColor) },
    });
    revalidatePath("/app/organization");
  }, "تم الحفظ");
}

export async function setLogoAction(documentId: string) {
  return run(async () => {
    const { doc, orgId } = await requireDocument(documentId, "EDITOR");
    if (doc.kind !== "LOGO") throw new Error("المستند ليس شعارًا");
    await db.organizationProfile.update({ where: { organizationId: orgId }, data: { logoDocumentId: doc.id } });
    revalidatePath("/app/organization");
  });
}

export async function deleteDocumentAction(documentId: string) {
  return run(async () => {
    const ctx = await requireDocument(documentId, "EDITOR");
    await deleteDocument(documentId, ctx.user.id);
    revalidatePath("/app", "layout");
  }, "تم حذف المستند ومشتقاته");
}

export async function reprocessDocumentAction(documentId: string) {
  return run(async () => {
    await requireDocument(documentId, "EDITOR");
    await extractDocumentText(documentId);
    revalidatePath("/app", "layout");
  });
}

export async function updateDocumentMetaAction(documentId: string, kind: string, label: string, expiresOn: string) {
  return run(async () => {
    await requireDocument(documentId, "EDITOR");
    const k = z.enum(["ORG_DOC", "ORG_LICENSE", "ORG_FINANCIAL", "ORG_PROFILE_DECK", "BUDGET_SHEET", "PARTNER_EVIDENCE", "OTHER", "LOGO", "GRANT_GUIDE", "GRANT_FORM"]).parse(kind);
    await db.document.update({ where: { id: documentId }, data: { kind: k, label: label.slice(0, 200) || null, expiresOn: expiresOn ? new Date(`${expiresOn}T00:00:00+03:00`) : null } });
    revalidatePath("/app", "layout");
  }, "تم الحفظ");
}

/** يضيف ملفات المثال إلى جمعية تجريبية فقط — لإكمال النواقص داخل العرض */
export async function addDemoSampleAction(sample: "financials" | "pledge" | "orgProfile") {
  return run(async () => {
    const ctx = await requireOrg("EDITOR");
    if (!ctx.organization.isDemo) throw new Error("ملفات المثال متاحة للجمعية التجريبية فقط");
    const kind = sample === "financials" ? "ORG_FINANCIAL" : sample === "pledge" ? "ORG_DOC" : "ORG_PROFILE_DECK";
    await storeDocument({ organizationId: ctx.orgId, userId: ctx.user.id, filename: SAMPLE_FILES[sample], data: await readSample(sample), kind, label: SAMPLE_LABELS[sample] });
    revalidatePath("/app", "layout");
  }, "تمت إضافة ملف المثال");
}
