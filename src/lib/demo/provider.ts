import "server-only";
import { AIProviderError } from "@/lib/ai/provider";
import type { ExtractedField, OpportunityExtraction, OrgExtraction } from "@/lib/ai/schemas";
import { GRANT_EXTRACTION, GRANT_UPDATE_EXTRACTION, ORG_EXTRACTION } from "./fixtures";
import { identifySample } from "./samples";
import { preciseLocator } from "@/lib/extraction/locate";

export const DEMO_UNSUPPORTED_MESSAGE =
  "الوضع التجريبي لا يحلل الملفات العشوائية. استخدم ملفات المثال المرفقة، أو أدخل البيانات يدويًا، أو فعّل مزود الذكاء الاصطناعي لتحليل ملفاتك فعليًا.";

/** يربط المقتطف بموضعه الفعلي في المقاطع المستخرجة — لا نخترع مواضع */
function locate<T extends { excerpt: string | null; locator: string | null }>(items: T[], chunks: { locator: string; text: string }[]): T[] {
  return items.map((it) => {
    return { ...it, locator: preciseLocator(chunks, it.excerpt) };
  });
}

export async function demoExtractOrg(docs: { sha256: string; chunks: { locator: string; text: string }[] }[]): Promise<OrgExtraction> {
  for (const d of docs) {
    if ((await identifySample(d.sha256)) === "orgProfile") {
      return { ...ORG_EXTRACTION, fields: locate<ExtractedField>(ORG_EXTRACTION.fields, d.chunks) };
    }
  }
  throw new AIProviderError("DEMO_UNSUPPORTED", DEMO_UNSUPPORTED_MESSAGE);
}

export async function demoExtractOpportunity(doc: { sha256: string; chunks: { locator: string; text: string }[] }): Promise<OpportunityExtraction> {
  const k = await identifySample(doc.sha256);
  const base = k === "grantGuide" ? GRANT_EXTRACTION : k === "grantUpdate" ? GRANT_UPDATE_EXTRACTION : null;
  if (!base) throw new AIProviderError("DEMO_UNSUPPORTED", DEMO_UNSUPPORTED_MESSAGE);
  return {
    ...base,
    fields: locate(base.fields, doc.chunks),
    requirements: locate(base.requirements, doc.chunks),
    questions: base.questions.map((q) => {
      return { ...q, locator: preciseLocator(doc.chunks, q.text) };
    }),
  };
}
