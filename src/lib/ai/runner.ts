import "server-only";
import { createHash } from "node:crypto";
import type { z } from "zod";
import { db } from "@/lib/db";
import { config, isDemoAI } from "@/lib/env";
import { LIMITS } from "@/lib/pricing";
import { AIProviderError, getRealProvider } from "./provider";
import { BASE_SYSTEM, TASK_INSTRUCTIONS, type AITask } from "./prompts";

export interface RunOptions<T> {
  task: AITask;
  organizationId: string;
  applicationId?: string | null;
  /** مدخلات مختصرة تُستخدم في البصمة (لا تُسجَّل) */
  input: unknown;
  prompt: string;
  schema: z.ZodType<T>;
  /** معالج الوضع التجريبي: يعيد بيانات معدة مسبقًا أو يرمي DEMO_UNSUPPORTED */
  demo: () => T | Promise<T>;
  /** إعادة التوليد رغم وجود نتيجة سابقة مطابقة */
  force?: boolean;
  /** هل تُحتسب ضمن حدود الاستخدام */
  countsTowardLimit?: boolean;
}

export interface RunResult<T> {
  data: T;
  jobId: string;
  provider: string;
  cached: boolean;
  demo: boolean;
}

/** يحوّل المهام العالقة إلى فاشلة كي لا يبقى انتظار دائم */
async function failStaleJobs(organizationId: string) {
  const cutoff = new Date(Date.now() - config.ai.timeoutMs * (config.ai.maxRetries + 2));
  await db.aIJob.updateMany({
    where: { organizationId, status: { in: ["PENDING", "RUNNING"] }, createdAt: { lt: cutoff } },
    data: { status: "FAILED", error: "انتهت المهلة دون اكتمال", finishedAt: new Date() },
  });
}

export async function runAITask<T>(o: RunOptions<T>): Promise<RunResult<T>> {
  const demo = isDemoAI();
  const provider = demo ? null : getRealProvider();
  if (!demo && !provider) throw new AIProviderError("NOT_CONFIGURED", "مزود الذكاء الاصطناعي غير مهيأ");
  const providerName = demo ? "demo" : provider!.name;
  const model = demo ? "fixtures-v1" : provider!.model;

  const inputHash = createHash("sha256")
    .update(JSON.stringify({ t: o.task, m: model, i: o.input }))
    .digest("hex");

  await failStaleJobs(o.organizationId);

  if (!o.force) {
    const prev = await db.aIJob.findFirst({
      where: { organizationId: o.organizationId, applicationId: o.applicationId ?? null, task: o.task, inputHash, status: "SUCCEEDED" },
      orderBy: { createdAt: "desc" },
    });
    if (prev?.result) {
      const parsed = o.schema.safeParse(prev.result);
      if (parsed.success) return { data: parsed.data, jobId: prev.id, provider: prev.provider, cached: true, demo };
    }
  }

  if (o.applicationId && o.countsTowardLimit !== false) {
    const app = await db.application.findUnique({ where: { id: o.applicationId }, select: { aiActionsUsed: true, orders: { where: { status: "PAID", product: "APPLICATION_PACKAGE" }, select: { id: true } } } });
    const limit = app?.orders.length ? LIMITS.aiActionsPerApplication : LIMITS.aiActionsBeforePurchase;
    if (app && app.aiActionsUsed >= limit)
      throw new AIProviderError("LIMIT", `بلغت حد عمليات المساعد لهذا الطلب (${limit}). ${app.orders.length ? "" : "شراء الحزمة يرفع الحد."}`);
  }

  const job = await db.aIJob.create({
    data: { organizationId: o.organizationId, applicationId: o.applicationId ?? null, task: o.task, provider: providerName, model, inputHash, status: "RUNNING", attempts: 1 },
  });

  try {
    let data: T;
    let usage = { inputTokens: 0, outputTokens: 0 };
    if (demo) {
      data = o.schema.parse(await o.demo());
    } else {
      if (o.prompt.length > config.ai.maxInputChars)
        throw new AIProviderError("LIMIT", "حجم المحتوى أكبر من الحد المسموح لمعالجة واحدة. قلّل المستندات أو قسّمها.");
      const r = await provider!.generate({ system: `${BASE_SYSTEM}\n\nالمهمة:\n${TASK_INSTRUCTIONS[o.task]}`, prompt: o.prompt, schema: o.schema });
      data = r.data;
      usage = r.usage;
    }
    await db.$transaction([
      db.aIJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", result: data as object, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, finishedAt: new Date() },
      }),
      ...(o.applicationId && o.countsTowardLimit !== false
        ? [db.application.update({ where: { id: o.applicationId }, data: { aiActionsUsed: { increment: 1 } } })]
        : []),
    ]);
    return { data, jobId: job.id, provider: providerName, cached: false, demo };
  } catch (e) {
    const err = e instanceof AIProviderError ? e : new AIProviderError("INVALID_OUTPUT", "تعذر التحقق من مخرجات المساعد");
    // لا نسجل المحتوى، فقط رمز الخطأ ورسالة عامة
    await db.aIJob.update({ where: { id: job.id }, data: { status: "FAILED", error: `${err.code}: ${err.message}`, finishedAt: new Date() } });
    throw err;
  }
}

export function aiErrorMessage(e: unknown): string {
  if (e instanceof AIProviderError) return e.message;
  return "حدث خطأ غير متوقع أثناء تشغيل المساعد. لم تتغير بياناتك.";
}
