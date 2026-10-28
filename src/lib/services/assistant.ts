import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { runAITask } from "@/lib/ai/runner";
import { AIProviderError } from "@/lib/ai/provider";
import { BudgetSuggestionSchema, DraftAnswersSchema, DraftProjectSchema, IdeaTurnSchema, type IdeaTurn } from "@/lib/ai/schemas";
import { SECTIONS, valueToText } from "@/lib/catalog";
import { parseQuantityToMilli, parseSarToHalalas } from "@/lib/money";
import { checkLimit } from "@/lib/text-limits";
import { BUDGET_SUGGESTION, DEMO_ANSWERS, DRAFT_PROJECT, IDEA_OPTIONS, IDEA_SUMMARY } from "@/lib/demo/fixtures";
import { DEMO_UNSUPPORTED_MESSAGE } from "@/lib/demo/provider";
import type { FactSnap } from "@/lib/domain/types";
import { bumpVersion, createRevision } from "./revisions";

export const IDEA_INPUT_FIELDS = [
  { key: "existing_project", label: "هل يوجد مشروع قائم تريدون تكييفه؟" },
  { key: "problem", label: "ما المشكلة التي يعالجها المشروع؟" },
  { key: "need_evidence", label: "ما دليل الحاجة ومصدره؟" },
  { key: "beneficiaries", label: "من المستفيدون؟" },
  { key: "beneficiary_count", label: "كم عددهم تقريبًا؟" },
  { key: "region", label: "منطقة التنفيذ" },
  { key: "duration", label: "مدة التنفيذ بالأشهر" },
  { key: "capabilities", label: "ما الإمكانات المتاحة لديكم؟" },
  { key: "approx_budget", label: "الميزانية التقريبية (ر.س)" },
] as const;

type IdeaInputs = Partial<Record<(typeof IDEA_INPUT_FIELDS)[number]["key"], string>>;

function profileText(profile: Record<string, FactSnap>) {
  return Object.entries(profile)
    .filter(([, f]) => f.value != null)
    .map(([k, f]) => `- ${k} [${f.status === "CONFIRMED" ? "مؤكد" : "غير مؤكد"}]: ${valueToText(f.value)}`)
    .join("\n");
}

async function loadContext(applicationId: string) {
  const app = await db.application.findUniqueOrThrow({
    where: { id: applicationId },
    include: { opportunity: { include: { facts: true, questions: { orderBy: { sortOrder: "asc" } } } }, sections: true, activities: true },
  });
  const profile = ((app.profileSnapshot as { profile?: Record<string, FactSnap> } | null)?.profile ?? {}) as Record<string, FactSnap>;
  const oppText = app.opportunity.facts.map((f) => `- ${f.key}: ${valueToText(f.value)}`).join("\n");
  return { app, profile, oppText, isDemoGrant: app.opportunity.isDemo };
}

/** خطوة في حوار تطوير الفكرة */
export async function ideaTurn(applicationId: string, userMessage: string | null) {
  const { app, profile, oppText, isDemoGrant } = await loadContext(applicationId);
  const conv = await db.conversation.findFirstOrThrow({ where: { applicationId, purpose: "IDEA" }, include: { messages: { orderBy: { createdAt: "asc" } } } });
  if (userMessage?.trim()) await db.message.create({ data: { conversationId: conv.id, role: "user", content: userMessage.trim().slice(0, 4000) } });
  const inputs = (app.ideaInputs as IdeaInputs | null) ?? {};
  const history = [...conv.messages, ...(userMessage?.trim() ? [{ role: "user", content: userMessage.trim() }] : [])].slice(-16);

  try {
    const r = await runAITask({
      task: "idea_turn",
      organizationId: app.organizationId,
      applicationId,
      input: { history: history.map((m) => [m.role, m.content]), inputs },
      prompt: `ملف الجمعية:\n${profileText(profile)}\n\nبيانات المنحة:\n${oppText}\n\nالمدخلات المنظمة الحالية:\n${JSON.stringify(inputs)}\n\nالمحادثة:\n${history.map((m) => `${m.role === "user" ? "المستخدم" : "المساعد"}: ${m.content}`).join("\n")}`,
      schema: IdeaTurnSchema,
      demo: () => demoIdeaTurn(inputs, isDemoGrant),
      force: true,
    });
    await db.message.create({ data: { conversationId: conv.id, role: "assistant", content: r.data.reply, structured: r.data as unknown as Prisma.InputJsonValue } });
    return r.data;
  } catch (e) {
    // الفشل لا يفقد رسالة المستخدم المحفوظة
    throw e;
  }
}

/** رد تجريبي قائم على قواعد: يسأل عن الناقص، ولا يدّعي فهم النص الحر */
function demoIdeaTurn(inputs: IdeaInputs, isDemoGrant: boolean): IdeaTurn {
  const missing = IDEA_INPUT_FIELDS.filter((f) => !inputs[f.key]?.trim());
  const understood = IDEA_INPUT_FIELDS.filter((f) => inputs[f.key]?.trim()).map((f) => ({ key: f.key, label: f.label, value: inputs[f.key]! }));
  const note = "(وضع تجريبي: المساعد لا يحلل النص الحر. سجّل إجاباتك في الحقول المنظمة بجانب المحادثة.)";
  if (missing.length > 3) {
    return {
      reply: `لنبدأ بأهم المعلومات. ${note}`,
      questions: missing.slice(0, 3).map((m) => m.label),
      understood, ideaOptions: [], ideaSummary: null, outOfScopeWarning: null,
    };
  }
  if (!isDemoGrant) {
    return {
      reply: `سجلنا مدخلاتك. اقتراح مسارات مشروع لهذه المنحة يحتاج تفعيل مزود الذكاء الاصطناعي. يمكنك كتابة ملخص الفكرة يدويًا واعتماده. ${note}`,
      questions: missing.map((m) => m.label), understood, ideaOptions: [], ideaSummary: null, outOfScopeWarning: null,
    };
  }
  return {
    reply: `بناءً على ملف الجمعية ومحاور المنحة التجريبية، هذه ثلاثة مسارات ممكنة. المسار الأول هو الأقرب لخبرتكم. ${note}`,
    questions: missing.map((m) => m.label),
    understood,
    ideaOptions: IDEA_OPTIONS,
    ideaSummary: IDEA_SUMMARY,
    outOfScopeWarning: "المسار الثالث (الحاضنة) أبعد عن اختصاص الجمعية الحالي ويحتاج خبرة غير موثقة في ملفها.",
  };
}

export async function saveIdeaInputs(applicationId: string, inputs: IdeaInputs) {
  const clean: IdeaInputs = {};
  for (const f of IDEA_INPUT_FIELDS) if (inputs[f.key] != null) clean[f.key] = String(inputs[f.key]).slice(0, 2000);
  await db.application.update({ where: { id: applicationId }, data: { ideaInputs: clean as Prisma.InputJsonValue } });
}

export async function saveIdeaSummary(applicationId: string, summary: string, approve: boolean) {
  await db.$transaction(async (tx) => {
    await tx.application.update({ where: { id: applicationId }, data: { ideaSummary: summary.trim(), ideaApproved: approve && !!summary.trim(), stage: approve ? "PROJECT" : undefined } });
    await bumpVersion(tx, applicationId);
  });
}

/**
 * إعداد مسودة المشروع. يملأ الأقسام الفارغة فقط؛ الأقسام ذات المحتوى تتلقى مقترحات قبل/بعد تحتاج موافقة.
 */
export async function draftProject(applicationId: string, userId: string) {
  const { app, profile, oppText, isDemoGrant } = await loadContext(applicationId);
  if (!app.ideaApproved || !app.ideaSummary) throw new Error("اعتمد ملخص الفكرة أولًا قبل إنشاء تفاصيل المشروع");
  const r = await runAITask({
    task: "draft_project",
    organizationId: app.organizationId,
    applicationId,
    input: { idea: app.ideaSummary, b: app.beneficiaryCount, d: app.durationMonths, reg: app.region },
    prompt: `الفكرة المعتمدة:\n${app.ideaSummary}\nعدد المستفيدين: ${app.beneficiaryCount ?? "غير محدد"}\nالمدة: ${app.durationMonths ?? "غير محددة"} شهرًا\nالمنطقة: ${app.region ?? "غير محددة"}\n\nملف الجمعية:\n${profileText(profile)}\n\nبيانات المنحة:\n${oppText}`,
    schema: DraftProjectSchema,
    demo: () => {
      if (!isDemoGrant) throw new AIProviderError("DEMO_UNSUPPORTED", "إعداد أقسام المشروع آليًا لهذه المنحة يحتاج تفعيل المزود. يمكنك كتابة الأقسام يدويًا.");
      return DRAFT_PROJECT;
    },
  });
  const origin = r.demo ? "DEMO_SEED" : "AI_SUGGESTION";
  await db.$transaction(async (tx) => {
    await createRevision(tx, applicationId, userId, { label: "قبل إنشاء مسودة المشروع", reason: "AUTO_BEFORE_CHANGE" });
    const valid = new Set(SECTIONS.map((s) => s.key));
    for (const s of r.data.sections) {
      if (!valid.has(s.key)) continue;
      const cur = app.sections.find((x) => x.key === s.key);
      if (!cur || !cur.content.trim()) {
        await tx.projectSection.update({ where: { applicationId_key: { applicationId, key: s.key } }, data: { content: s.content, status: "DRAFT", isEstimate: s.isEstimate, origin, version: { increment: 1 } } });
      } else if (cur.content !== s.content) {
        await tx.changeProposal.create({ data: { applicationId, trigger: "مسودة المساعد", targetType: "SECTION", targetId: s.key, before: cur.content, after: s.content, explanation: "مقترح من المساعد لقسم يحتوي نصًا قائمًا — لن يُطبق دون موافقتك" } });
      }
    }
    if (!app.activities.length) {
      const codeToId = new Map<string, string>();
      for (const [i, a] of r.data.activities.entries()) {
        const created = await tx.activity.create({ data: { ...a, applicationId, sortOrder: i } });
        codeToId.set(a.code, created.id);
      }
      for (const [i, ind] of r.data.indicators.entries()) {
        const { activityCode, ...rest } = ind;
        await tx.indicator.create({ data: { ...rest, activityId: activityCode ? codeToId.get(activityCode) ?? null : null, applicationId, sortOrder: i } });
      }
      for (const p of r.data.partners) {
        await tx.partner.create({ data: { ...p, applicationId, status: "PROPOSED" } });
      }
    }
    await tx.application.update({ where: { id: applicationId }, data: { stage: "PROJECT" } });
    await bumpVersion(tx, applicationId);
  });
  return r;
}

/** اقتراح بنود ميزانية تقديرية. تُضاف موسومة «تقديرية تحتاج اعتمادًا». */
export async function suggestBudget(applicationId: string, userId: string) {
  const { app, oppText, isDemoGrant } = await loadContext(applicationId);
  const existing = await db.budgetLine.count({ where: { applicationId } });
  if (existing) throw new Error("الميزانية تحتوي بنودًا. أضف البنود يدويًا أو احذف الحالية لطلب اقتراح جديد.");
  const r = await runAITask({
    task: "suggest_budget",
    organizationId: app.organizationId,
    applicationId,
    input: { acts: app.activities.map((a) => a.code + a.name), d: app.durationMonths, b: app.beneficiaryCount },
    prompt: `الأنشطة:\n${app.activities.map((a) => `${a.code}: ${a.name} (الأشهر ${a.startMonth}–${a.endMonth})`).join("\n")}\nالمدة: ${app.durationMonths} شهرًا\nالمستفيدون: ${app.beneficiaryCount}\n\nشروط المنحة:\n${oppText}`,
    schema: BudgetSuggestionSchema,
    demo: () => {
      if (!isDemoGrant) throw new AIProviderError("DEMO_UNSUPPORTED", "اقتراح بنود الميزانية لهذه المنحة يحتاج تفعيل المزود. أضف البنود يدويًا.");
      return BUDGET_SUGGESTION;
    },
  });
  await db.$transaction(async (tx) => {
    await createRevision(tx, applicationId, userId, { label: "قبل اقتراح الميزانية", reason: "AUTO_BEFORE_CHANGE" });
    const acts = await tx.activity.findMany({ where: { applicationId } });
    const partner = await tx.partner.findFirst({ where: { applicationId } });
    for (const [i, l] of r.data.lines.entries()) {
      const { activityCode, quantity, unitCostSar, ...rest } = l;
      let periods = l.calc === "RECURRING" ? l.periods : 1;
      if (l.periodsFollowDuration && app.durationMonths) periods = app.durationMonths;
      let quantityMilli = parseQuantityToMilli(quantity);
      if (l.quantityFollowsBeneficiaries && app.beneficiaryCount) quantityMilli = BigInt(app.beneficiaryCount) * 1000n;
      await tx.budgetLine.create({
        data: {
          ...rest, periods, quantityMilli, unitCostHalalas: parseSarToHalalas(unitCostSar), applicationId, sortOrder: i, isEstimate: true,
          activityId: acts.find((a) => a.code === activityCode)?.id ?? null,
          partnerId: l.fundingSource === "PARTNER" ? partner?.id ?? null : null,
          contributionType: l.fundingSource === "DONOR" ? "CASH" : l.contributionType,
        },
      });
    }
    await tx.application.update({ where: { id: applicationId }, data: { stage: "BUDGET" } });
    await bumpVersion(tx, applicationId);
  });
  return r;
}

/** إنشاء مسودات إجابات للأسئلة الفارغة فقط، من الأقسام المعتمدة */
export async function draftAnswers(applicationId: string) {
  const { app, isDemoGrant } = await loadContext(applicationId);
  const approved = app.sections.filter((s) => s.status === "APPROVED");
  if (!approved.length) throw new Error("اعتمد بعض أقسام المشروع أولًا؛ الإجابات تُبنى على المحتوى المعتمد فقط");
  const answers = await db.formAnswer.findMany({ where: { applicationId } });
  const qs = app.opportunity.questions.filter((q) => !answers.find((a) => a.questionId === q.id && a.content.trim()));
  if (!qs.length) throw new Error("كل الأسئلة لها إجابات. عدّلها مباشرة.");
  const r = await runAITask({
    task: "draft_answers",
    organizationId: app.organizationId,
    applicationId,
    input: { q: qs.map((q) => q.id), s: approved.map((s) => s.content) },
    prompt: `الأقسام المعتمدة:\n${approved.map((s) => `## ${s.key}\n${s.content}`).join("\n\n")}\n\nالأسئلة:\n${qs.map((q) => `- [${q.id}] ${q.text} (الحد: ${q.limitType === "NONE" ? "بلا حد" : `${q.limitValue} ${q.limitType === "WORDS" ? "كلمة" : "حرف"}`})`).join("\n")}`,
    schema: DraftAnswersSchema,
    demo: () => {
      if (!isDemoGrant) throw new AIProviderError("DEMO_UNSUPPORTED", DEMO_UNSUPPORTED_MESSAGE);
      return { answers: qs.map((q) => ({ questionId: q.id, content: DEMO_ANSWERS[app.opportunity.questions.findIndex((x) => x.id === q.id)] ?? "" })) };
    },
  });
  await db.$transaction(async (tx) => {
    for (const a of r.data.answers) {
      const q = qs.find((x) => x.id === a.questionId);
      if (!q || !a.content.trim()) continue;
      await tx.formAnswer.upsert({
        where: { applicationId_questionId: { applicationId, questionId: q.id } },
        create: { applicationId, questionId: q.id, content: a.content, status: "DRAFT", origin: r.demo ? "DEMO_SEED" : "AI_SUGGESTION" },
        update: { content: a.content, status: "DRAFT", origin: r.demo ? "DEMO_SEED" : "AI_SUGGESTION", version: { increment: 1 } },
      });
    }
    await tx.application.update({ where: { id: applicationId }, data: { stage: "ANSWERS" } });
    await bumpVersion(tx, applicationId);
  });
  return { ...r, overLimit: r.data.answers.filter((a) => { const q = qs.find((x) => x.id === a.questionId); return q && !checkLimit(a.content, q.limitType, q.limitValue).withinLimit; }).length };
}
