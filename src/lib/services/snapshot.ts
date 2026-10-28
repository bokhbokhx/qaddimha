import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { lineTotalHalalas, summarizeBudget } from "@/lib/money";
import { evaluateRequirement } from "@/lib/domain/requirements";
import type { FactSnap, Snapshot } from "@/lib/domain/types";

type Tx = Prisma.TransactionClient | typeof db;

export function factsToMap(
  facts: { key: string; value: unknown; status: FactSnap["status"]; sourceType: string; sourceLocator: string | null; sourceExcerpt: string | null; sourceDocId: string | null; alternatives: unknown }[],
  docNames: Map<string, string>,
): Record<string, FactSnap> {
  return Object.fromEntries(
    facts.map((f) => [
      f.key,
      {
        value: f.value,
        status: f.status,
        sourceType: f.sourceType,
        sourceLocator: f.sourceLocator,
        sourceExcerpt: f.sourceExcerpt,
        sourceDocName: f.sourceDocId ? docNames.get(f.sourceDocId) ?? null : null,
        alternatives: f.alternatives ?? null,
      },
    ]),
  );
}

/** لقطة ملف الجمعية الحالي — تُحفظ داخل الطلب كي لا يتغير الطلب بصمت */
export async function buildProfileSnapshot(organizationId: string, tx: Tx = db) {
  const [profile, facts, docs] = await Promise.all([
    tx.organizationProfile.findUnique({ where: { organizationId } }),
    tx.fact.findMany({ where: { organizationId, scopeRef: "org" } }),
    tx.document.findMany({ where: { organizationId }, select: { id: true, filename: true } }),
  ]);
  const names = new Map(docs.map((d) => [d.id, d.filename]));
  return { version: profile?.version ?? 1, profile: factsToMap(facts as never, names) };
}

/** يبني لقطة كاملة للطلب من قاعدة البيانات، مع تقييم الشروط وحساب الميزانية برمجيًا */
export async function buildSnapshot(applicationId: string, tx: Tx = db): Promise<Snapshot> {
  const app = await tx.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: {
      organization: true,
      opportunity: { include: { facts: true, requirements: { orderBy: { sortOrder: "asc" } }, questions: { orderBy: { sortOrder: "asc" } } } },
      sections: true,
      activities: { orderBy: [{ sortOrder: "asc" }, { startMonth: "asc" }] },
      indicators: { orderBy: { sortOrder: "asc" } },
      budgetLines: { orderBy: { sortOrder: "asc" } },
      partners: true,
      answers: true,
      assessments: true,
    },
  });
  const documents = await tx.document.findMany({
    where: { organizationId: app.organizationId, kind: { notIn: ["GRANT_GUIDE", "GRANT_FORM"] } },
    select: { id: true, kind: true, label: true, filename: true, expiresOn: true, status: true },
  });
  const oppDocs = await tx.document.findMany({ where: { opportunityId: app.opportunityId }, select: { id: true, filename: true } });
  const names = new Map([...documents, ...oppDocs].map((d) => [d.id, d.filename]));

  const ps = (app.profileSnapshot as { version: number; profile: Record<string, FactSnap> } | null) ?? (await buildProfileSnapshot(app.organizationId, tx));

  const lineInputs = app.budgetLines.map((l) => ({ ...l, calc: l.calc, totalHalalas: lineTotalHalalas(l) }));
  const confirmedPartnerCash = app.partners.filter((p) => p.status === "CONFIRMED" && p.orgApproved).reduce((a, p) => a + p.cashHalalas, 0n);
  const budget = summarizeBudget(lineInputs, { confirmedPartnerCash });

  const ctx = {
    profile: ps.profile,
    documents: documents.map((d) => ({ ...d, expiresOn: d.expiresOn?.toISOString() ?? null })),
    app: { region: app.region, durationMonths: app.durationMonths, beneficiaryCount: app.beneficiaryCount },
    budget,
    budgetLines: lineInputs,
    now: new Date(),
  };

  const requirements = app.opportunity.requirements.map((r) => {
    const ua = app.assessments.find((a) => a.requirementId === r.id && a.decidedBy === "USER");
    const userAssessment = ua ? { result: ua.result, evidence: ua.evidence, nextAction: ua.nextAction } : null;
    const ruleParams = (r.ruleParams as Record<string, unknown> | null) ?? null;
    return {
      id: r.id, code: r.code, category: r.category, text: r.text, mandatory: r.mandatory, rule: r.rule, ruleParams,
      sourceLocator: r.sourceLocator, sourceExcerpt: r.sourceExcerpt, sourceDocName: r.sourceDocId ? names.get(r.sourceDocId) ?? null : null,
      userAssessment,
      evaluation: evaluateRequirement({ rule: r.rule, ruleParams, userAssessment }, ctx),
    };
  });

  const s = (b: bigint) => b.toString();
  return {
    schemaVersion: 1,
    takenAt: new Date().toISOString(),
    application: {
      id: app.id, title: app.title, beneficiaryCount: app.beneficiaryCount, durationMonths: app.durationMonths,
      region: app.region, ideaSummary: app.ideaSummary, ideaApproved: app.ideaApproved,
    },
    organization: { id: app.organizationId, displayName: app.organization.displayName, isDemo: app.organization.isDemo, profileVersion: ps.version, profile: ps.profile },
    opportunity: {
      id: app.opportunityId, funderName: app.opportunity.funderName, title: app.opportunity.title, referenceUrl: app.opportunity.referenceUrl,
      isDemo: app.opportunity.isDemo, facts: factsToMap(app.opportunity.facts as never, names),
    },
    requirements,
    sections: app.sections.map((x) => ({ key: x.key, content: x.content, status: x.status, isEstimate: x.isEstimate, origin: x.origin, reviewReason: x.reviewReason })),
    activities: app.activities.map((a) => ({ id: a.id, code: a.code, name: a.name, description: a.description, startMonth: a.startMonth, endMonth: a.endMonth, responsible: a.responsible, outputs: a.outputs })),
    indicators: app.indicators.map((i) => ({ id: i.id, name: i.name, type: i.type, baseline: i.baseline, target: i.target, unit: i.unit, method: i.method, activityId: i.activityId, isEstimate: i.isEstimate, needsReview: i.needsReview })),
    budgetLines: lineInputs.map((l) => ({
      id: l.id, item: l.item, costCenter: l.costCenter, activityId: l.activityId, partnerId: l.partnerId, unit: l.unit,
      quantityMilli: s(l.quantityMilli), unitCostHalalas: s(l.unitCostHalalas), calc: l.calc, periods: l.periods,
      fundingSource: l.fundingSource, contributionType: l.contributionType, justification: l.justification,
      isEstimate: l.isEstimate, needsReview: l.needsReview, totalHalalas: s(l.totalHalalas),
      periodsFollowDuration: l.periodsFollowDuration, quantityFollowsBeneficiaries: l.quantityFollowsBeneficiaries,
    })),
    partners: app.partners.map((p) => ({
      id: p.id, name: p.name, partnerType: p.partnerType, role: p.role, status: p.status, tasks: p.tasks, cashHalalas: s(p.cashHalalas),
      inKindDescription: p.inKindDescription, responsibilities: p.responsibilities, mutualValue: p.mutualValue, evidenceDocId: p.evidenceDocId, orgApproved: p.orgApproved,
    })),
    questions: app.opportunity.questions.map((q) => {
      const a = app.answers.find((x) => x.questionId === q.id);
      return {
        id: q.id, text: q.text, type: q.type, mandatory: q.mandatory, limitType: q.limitType, limitValue: q.limitValue, linkedSections: q.linkedSections,
        answer: a ? { content: a.content, status: a.status, staleReason: a.staleReason } : null,
      };
    }),
    documents: documents.map((d) => ({ id: d.id, kind: d.kind, label: d.label, filename: d.filename, expiresOn: d.expiresOn?.toISOString() ?? null, status: d.status })),
    budget: {
      total: s(budget.total), cashTotal: s(budget.cashTotal), inKindTotal: s(budget.inKindTotal), donor: s(budget.donor),
      selfCash: s(budget.selfCash), selfInKind: s(budget.selfInKind), partnerCash: s(budget.partnerCash), partnerInKind: s(budget.partnerInKind),
      cashGap: s(budget.cashGap), nonDonorShareBp: budget.nonDonorShareBp,
    },
  };
}

/** بصمة المحتوى دون وقت أخذ اللقطة — لمعرفة إن تغير شيء */
export function snapshotHash(s: Snapshot) {
  const { takenAt: _t, ...rest } = s;
  void _t;
  const stable = JSON.stringify(rest, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));
  // نُسقط نتائج التقييم المعتمدة على الوقت فقط؛ تبقى كما هي لأنها جزء من المحتوى
  return createHash("sha256").update(stable).digest("hex").slice(0, 16);
}
