import "server-only";
import type { Prisma, RequirementCategory, RequirementRule } from "@prisma/client";
import { db } from "@/lib/db";
import { runAITask } from "@/lib/ai/runner";
import { OpportunityExtractionSchema, OrgExtractionSchema, type ExtractedField, type OpportunityExtraction } from "@/lib/ai/schemas";
import { wrapDocuments } from "@/lib/ai/prompts";
import { OPPORTUNITY_FIELDS, PROFILE_FIELDS } from "@/lib/catalog";
import { demoExtractOpportunity, demoExtractOrg } from "@/lib/demo/provider";
import { proposeFact } from "./facts";
import { getChunks } from "./documents";
import { preciseLocator } from "@/lib/extraction/locate";

export function fieldValue(f: ExtractedField): unknown {
  if (f.results?.length) return f.results;
  if (f.items?.length) return f.items;
  return f.text;
}

/** استخراج بيانات الجمعية من مستندات محددة، وحفظها كمقترحات تحتاج تأكيدًا */
export async function extractOrgProfile(organizationId: string, documentIds: string[]) {
  const docs = (await getChunks(documentIds, organizationId)).filter((d) => d.status === "EXTRACTED" && d.chunks.length);
  if (!docs.length) throw new Error("لا توجد مستندات بنص مستخرج");
  const keys = PROFILE_FIELDS.map((f) => `${f.key} (${f.label})`).join("، ");
  const r = await runAITask({
    task: "extract_org_profile",
    organizationId,
    input: { docs: docs.map((d) => d.sha256) },
    prompt: `المفاتيح المسموحة: ${keys}\n\n${wrapDocuments(docs.map((d) => ({ name: d.filename, chunks: d.chunks })))}`,
    schema: OrgExtractionSchema,
    demo: () => demoExtractOrg(docs.map((d) => ({ sha256: d.sha256, chunks: d.chunks }))),
  });
  const allowed = new Set(PROFILE_FIELDS.map((f) => f.key));
  await db.$transaction(async (tx) => {
    for (const field of r.data.fields) {
      if (!allowed.has(field.key)) continue;
      const v = fieldValue(field);
      if (v == null) continue;
      const doc = docs.find((d) => field.excerpt && d.chunks.some((c) => c.text.includes(field.excerpt!))) ?? docs[0];
      await proposeFact(tx, { organizationId, scope: "ORG_PROFILE", key: field.key, value: v, sourceDocId: doc.id, sourceLocator: preciseLocator(doc.chunks, field.excerpt) ?? field.locator, sourceExcerpt: field.excerpt });
    }
    for (const d of docs) {
      await tx.documentExtraction.create({ data: { documentId: d.id, target: "ORG_PROFILE", aiJobId: r.jobId, result: r.data as Prisma.InputJsonValue, status: "APPLIED" } });
    }
  });
  return r;
}

/** استخراج متطلبات المنحة من مستند واحد وحفظ الحقول والشروط والأسئلة مع مصادرها */
export async function extractOpportunityFromDocument(organizationId: string, opportunityId: string, documentId: string) {
  const [doc] = await getChunks([documentId], organizationId);
  if (!doc || doc.opportunityId !== opportunityId) throw new Error("المستند غير مرتبط بهذه الفرصة");
  if (doc.status !== "EXTRACTED" || !doc.chunks.length) throw new Error(doc.extractionError ?? "لم يُستخرج نص من المستند");
  const already = await db.documentExtraction.findFirst({ where: { documentId, target: "OPPORTUNITY", status: "APPLIED" } });
  if (already) throw new Error("تم تحليل هذا المستند مسبقًا. راجع النتائج في صفحة المراجعة.");
  const keys = OPPORTUNITY_FIELDS.map((f) => `${f.key} (${f.label})`).join("، ");
  const r = await runAITask({
    task: "extract_opportunity",
    organizationId,
    input: { doc: doc.sha256, opp: opportunityId },
    prompt: `المفاتيح المسموحة للحقول: ${keys}\nأنواع المستندات للقاعدة DOCUMENT_PRESENT: ORG_LICENSE, ORG_FINANCIAL, ORG_PROFILE_DECK, ORG_DOC, OTHER\nمفاتيح أقسام المشروع: summary, problem, objectives, target_group, scope, outcomes, team, risks, sustainability, assumptions\n\n${wrapDocuments([{ name: doc.filename, chunks: doc.chunks }])}`,
    schema: OpportunityExtractionSchema,
    demo: () => demoExtractOpportunity({ sha256: doc.sha256, chunks: doc.chunks }),
  });
  await applyOpportunityExtraction(organizationId, opportunityId, doc.id, r.data, r.jobId);
  return r;
}

export async function applyOpportunityExtraction(organizationId: string, opportunityId: string, documentId: string, data: OpportunityExtraction, jobId: string | null) {
  const allowed = new Set(OPPORTUNITY_FIELDS.map((f) => f.key));
  await db.$transaction(async (tx) => {
    for (const field of data.fields) {
      if (!allowed.has(field.key)) continue;
      const v = fieldValue(field);
      if (v == null) continue;
      await proposeFact(tx, { organizationId, scope: "OPPORTUNITY", opportunityId, key: field.key, value: v, sourceDocId: documentId, sourceLocator: field.locator, sourceExcerpt: field.excerpt });
    }
    for (const c of data.conflicts) {
      if (!allowed.has(c.key)) continue;
      for (const val of c.values)
        await proposeFact(tx, { organizationId, scope: "OPPORTUNITY", opportunityId, key: c.key, value: val.value, sourceDocId: documentId, sourceLocator: val.locator, sourceExcerpt: val.excerpt });
    }
    const existingReq = await tx.requirement.count({ where: { opportunityId } });
    let i = existingReq;
    for (const rq of data.requirements) {
      const params = Object.fromEntries(Object.entries(rq.params).filter(([, v]) => v != null));
      await tx.requirement.create({
        data: {
          opportunityId, code: rq.code, category: rq.category as RequirementCategory, text: rq.text, mandatory: rq.mandatory,
          rule: rq.rule as RequirementRule, ruleParams: params as Prisma.InputJsonValue, sourceDocId: documentId, sourceLocator: rq.locator, sourceExcerpt: rq.excerpt, sortOrder: i++,
        },
      });
    }
    const existingQ = await tx.formQuestion.count({ where: { opportunityId } });
    let qi = existingQ;
    for (const q of data.questions) {
      await tx.formQuestion.create({
        data: {
          opportunityId, sortOrder: qi++, text: q.text, type: q.type, mandatory: q.mandatory, limitType: q.limitType,
          limitValue: q.limitValue, linkedSections: q.linkedSections, sourceDocId: documentId, sourceLocator: q.locator,
        },
      });
    }
    await tx.documentExtraction.create({ data: { documentId, target: "OPPORTUNITY", aiJobId: jobId, result: data as unknown as Prisma.InputJsonValue, status: "APPLIED" } });
  });
}
