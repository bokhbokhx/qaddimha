import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { config } from "@/lib/env";

export interface GenerateRequest<T> {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
}

export interface GenerateResult<T> {
  data: T;
  usage: { inputTokens: number; outputTokens: number };
}

export interface AIProvider {
  name: string;
  model: string;
  generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>>;
}

export class AIProviderError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "TIMEOUT" | "RATE_LIMIT" | "INVALID_OUTPUT" | "REFUSED" | "UPSTREAM" | "DEMO_UNSUPPORTED" | "LIMIT", message: string) {
    super(message);
  }
}

/** مزود Claude عبر Anthropic SDK — المفتاح على الخادم فقط، والنموذج معرف إعداد */
class AnthropicProvider implements AIProvider {
  name = "anthropic";
  private client: Anthropic;
  constructor(public model: string) {
    this.client = new Anthropic({ timeout: config.ai.timeoutMs, maxRetries: config.ai.maxRetries });
  }
  async generate<T>(req: GenerateRequest<T>): Promise<GenerateResult<T>> {
    try {
      const stream = this.client.messages.stream({
        model: this.model,
        max_tokens: req.maxTokens ?? config.ai.maxOutputTokens,
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.prompt }],
        output_config: { format: zodOutputFormat(req.schema as never) },
      });
      const msg = await stream.finalMessage();
      if (msg.stop_reason === "refusal") throw new AIProviderError("REFUSED", "رفض المزود معالجة الطلب");
      if (msg.stop_reason === "max_tokens") throw new AIProviderError("INVALID_OUTPUT", "انقطع الرد قبل اكتماله");
      const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        throw new AIProviderError("INVALID_OUTPUT", "رد غير صالح من المزود");
      }
      const parsed = req.schema.safeParse(json);
      if (!parsed.success) throw new AIProviderError("INVALID_OUTPUT", "رد لا يطابق البنية المطلوبة");
      return { data: parsed.data, usage: { inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens } };
    } catch (e) {
      if (e instanceof AIProviderError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new AIProviderError("RATE_LIMIT", "المزود مشغول حاليًا، حاول بعد قليل");
      if (e instanceof Anthropic.APIConnectionTimeoutError) throw new AIProviderError("TIMEOUT", "انتهت مهلة الاتصال بالمزود");
      if (e instanceof Anthropic.AuthenticationError) throw new AIProviderError("NOT_CONFIGURED", "مفتاح المزود غير صالح");
      if (e instanceof Anthropic.APIError) throw new AIProviderError("UPSTREAM", `خطأ من المزود (${e.status ?? "?"})`);
      throw new AIProviderError("UPSTREAM", "تعذر الاتصال بالمزود");
    }
  }
}

export function getRealProvider(): AIProvider | null {
  if (config.ai.provider !== "anthropic") return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!config.ai.model) throw new AIProviderError("NOT_CONFIGURED", "لم يُحدَّد AI_MODEL في الإعدادات");
  return new AnthropicProvider(config.ai.model);
}
