import "server-only";
import type { FactScope, Prisma, SourceType } from "@prisma/client";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof db;

export function scopeRefOf(scope: FactScope, opportunityId?: string | null) {
  return scope === "ORG_PROFILE" ? "org" : opportunityId!;
}

/** حفظ قيمة أدخلها أو أكدها المستخدم */
export async function confirmFact(
  tx: Tx,
  args: { organizationId: string; scope: FactScope; opportunityId?: string | null; key: string; value: unknown; userId: string; keepSource?: boolean },
) {
  const scopeRef = scopeRefOf(args.scope, args.opportunityId);
  const empty = args.value == null || (typeof args.value === "string" && !args.value.trim()) || (Array.isArray(args.value) && args.value.length === 0);
  const existing = await tx.fact.findUnique({ where: { organizationId_scopeRef_key: { organizationId: args.organizationId, scopeRef, key: args.key } } });
  const sameAsExtracted = existing && JSON.stringify(existing.value) === JSON.stringify(args.value);
  const data = {
    value: empty ? undefined : (args.value as Prisma.InputJsonValue),
    status: empty ? ("MISSING" as const) : ("CONFIRMED" as const),
    // إذا أكد المستخدم القيمة المستخرجة كما هي نحتفظ بمصدرها الوثائقي
    sourceType: (sameAsExtracted && args.keepSource !== false ? existing!.sourceType : "USER") as SourceType,
    sourceDocId: sameAsExtracted ? existing!.sourceDocId : null,
    sourceLocator: sameAsExtracted ? existing!.sourceLocator : `إدخال المستخدم`,
    sourceExcerpt: sameAsExtracted ? existing!.sourceExcerpt : null,
    alternatives: undefined,
    confirmedById: args.userId,
    confirmedAt: new Date(),
  };
  const fact = await tx.fact.upsert({
    where: { organizationId_scopeRef_key: { organizationId: args.organizationId, scopeRef, key: args.key } },
    create: { organizationId: args.organizationId, scope: args.scope, opportunityId: args.opportunityId ?? null, scopeRef, key: args.key, ...data, value: data.value },
    update: { ...data, alternatives: empty ? undefined : (null as unknown as Prisma.InputJsonValue) },
  });
  if (args.scope === "ORG_PROFILE") {
    await tx.organizationProfile.upsert({
      where: { organizationId: args.organizationId },
      create: { organizationId: args.organizationId, version: 2 },
      update: { version: { increment: 1 } },
    });
  }
  return fact;
}

/**
 * حفظ نتيجة استخراج كمقترح: لا يستبدل قيمة مؤكدة، بل يُسجَّل تعارضًا إن اختلفت.
 */
export async function proposeFact(
  tx: Tx,
  args: { organizationId: string; scope: FactScope; opportunityId?: string | null; key: string; value: unknown; sourceDocId: string | null; sourceLocator: string | null; sourceExcerpt: string | null; sourceType?: SourceType },
) {
  const scopeRef = scopeRefOf(args.scope, args.opportunityId);
  const existing = await tx.fact.findUnique({ where: { organizationId_scopeRef_key: { organizationId: args.organizationId, scopeRef, key: args.key } } });
  const src = { sourceDocId: args.sourceDocId, sourceLocator: args.sourceLocator, sourceExcerpt: args.sourceExcerpt };
  if (!existing || existing.status === "MISSING" || existing.value == null) {
    return tx.fact.upsert({
      where: { organizationId_scopeRef_key: { organizationId: args.organizationId, scopeRef, key: args.key } },
      create: { organizationId: args.organizationId, scope: args.scope, opportunityId: args.opportunityId ?? null, scopeRef, key: args.key, value: args.value as Prisma.InputJsonValue, status: "EXTRACTED_UNCONFIRMED", sourceType: args.sourceType ?? "DOCUMENT", ...src },
      update: { value: args.value as Prisma.InputJsonValue, status: "EXTRACTED_UNCONFIRMED", sourceType: args.sourceType ?? "DOCUMENT", ...src },
    });
  }
  if (JSON.stringify(existing.value) === JSON.stringify(args.value)) return existing;
  // تعارض: نعرض القيمتين ومصدر كل منهما ولا نعتبر الأحدث صحيحًا تلقائيًا
  const incoming = { value: args.value, ...src, sourceType: args.sourceType ?? "DOCUMENT" };
  const prior = (existing.alternatives as { value: unknown }[] | null) ?? [];
  const alts =
    existing.status === "CONFLICT" && prior.length
      ? prior.some((a) => JSON.stringify(a.value) === JSON.stringify(args.value)) ? prior : [...prior, incoming]
      : [{ value: existing.value, sourceDocId: existing.sourceDocId, sourceLocator: existing.sourceLocator, sourceExcerpt: existing.sourceExcerpt, sourceType: existing.sourceType }, incoming];
  return tx.fact.update({ where: { id: existing.id }, data: { status: "CONFLICT", alternatives: alts as Prisma.InputJsonValue } });
}
