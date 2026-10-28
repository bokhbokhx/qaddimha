import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DEMO_FUNDER, DEMO_GRANT_TITLE, SAMPLE_FILES, SAMPLE_LABELS } from "@/lib/demo/content";
import { readSample } from "@/lib/demo/samples";
import { storeDocument } from "./documents";
import { extractOpportunityFromDocument } from "./extraction";
import { confirmFact } from "./facts";

/** الرابط مرجع فقط ولا يُقرأ محتواه — نتحقق من صيغته لا أكثر */
export function validateReferenceUrl(url: string | null | undefined) {
  if (!url?.trim()) return null;
  try {
    const u = new URL(url.trim());
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.toString().slice(0, 500);
  } catch {
    return null;
  }
}

export async function createOpportunity(args: { organizationId: string; userId: string; funderName: string; title: string; referenceUrl?: string | null; pastedText?: string | null; isDemo?: boolean }) {
  const opp = await db.fundingOpportunity.create({
    data: {
      organizationId: args.organizationId,
      funderName: args.funderName.trim().slice(0, 200),
      title: args.title.trim().slice(0, 200),
      referenceUrl: validateReferenceUrl(args.referenceUrl),
      pastedText: args.pastedText?.slice(0, 100_000) ?? null,
      isDemo: !!args.isDemo,
    },
  });
  // الاسمان المدخلان يدويًا يُسجلان كتصريح من المستخدم
  await confirmFact(db, { organizationId: args.organizationId, scope: "OPPORTUNITY", opportunityId: opp.id, key: "funder", value: opp.funderName, userId: args.userId });
  await confirmFact(db, { organizationId: args.organizationId, scope: "OPPORTUNITY", opportunityId: opp.id, key: "grant_name", value: opp.title, userId: args.userId });
  if (args.pastedText?.trim()) {
    await storeDocument({
      organizationId: args.organizationId, userId: args.userId, filename: "نص-ملصق.txt", data: Buffer.from(args.pastedText, "utf8"),
      kind: "GRANT_GUIDE", label: "نص ملصق من المستخدم", opportunityId: opp.id,
    });
  }
  return opp;
}

/** المنحة التجريبية: تُرفع ملفات المثال المعروفة عبر نفس مسار الرفع والاستخراج */
export async function createDemoOpportunity(organizationId: string, userId: string) {
  const opp = await createOpportunity({ organizationId, userId, funderName: DEMO_FUNDER, title: DEMO_GRANT_TITLE, isDemo: true });
  const doc = await storeDocument({
    organizationId, userId, filename: SAMPLE_FILES.grantGuide, data: await readSample("grantGuide"),
    kind: "GRANT_GUIDE", label: SAMPLE_LABELS.grantGuide, opportunityId: opp.id,
  });
  await extractOpportunityFromDocument(organizationId, opp.id, doc.id);
  return opp;
}

export async function addSampleToOpportunity(organizationId: string, userId: string, opportunityId: string, key: "grantUpdate") {
  const doc = await storeDocument({
    organizationId, userId, filename: SAMPLE_FILES[key], data: await readSample(key), kind: "GRANT_GUIDE", label: SAMPLE_LABELS[key], opportunityId,
  });
  await extractOpportunityFromDocument(organizationId, opportunityId, doc.id);
  return doc;
}

export async function resolveConflict(args: { organizationId: string; opportunityId: string; key: string; value: unknown; userId: string }) {
  await confirmFact(db, { organizationId: args.organizationId, scope: "OPPORTUNITY", opportunityId: args.opportunityId, key: args.key, value: args.value, userId: args.userId });
  await audit({ organizationId: args.organizationId, userId: args.userId, action: "opportunity.resolve_conflict", targetType: "FundingOpportunity", targetId: args.opportunityId });
}

export async function addManualRequirement(opportunityId: string, data: { code: string; category: string; text: string; mandatory: boolean }) {
  const n = await db.requirement.count({ where: { opportunityId } });
  return db.requirement.create({
    data: { opportunityId, code: data.code || `ي${n + 1}`, category: data.category as never, text: data.text, mandatory: data.mandatory, rule: "MANUAL", sourceLocator: "إدخال المستخدم", sortOrder: n },
  });
}

export async function addManualQuestion(opportunityId: string, data: { text: string; mandatory: boolean; limitType: "NONE" | "WORDS" | "CHARS"; limitValue: number | null; linkedSections: string[] }) {
  const n = await db.formQuestion.count({ where: { opportunityId } });
  return db.formQuestion.create({ data: { ...data, opportunityId, sortOrder: n, sourceLocator: "إدخال المستخدم" } });
}

export async function deleteRequirement(opportunityId: string, id: string) {
  await db.requirement.delete({ where: { id, opportunityId } });
}

export async function updateRequirementMandatory(opportunityId: string, id: string, mandatory: boolean) {
  await db.requirement.update({ where: { id, opportunityId }, data: { mandatory } });
}

export type { Prisma };
