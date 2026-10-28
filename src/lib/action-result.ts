import "server-only";
import { AuthError } from "@/lib/auth/guard";
import { AIProviderError } from "@/lib/ai/provider";
import { ConflictError } from "@/lib/services/revisions";
import { PaymentError } from "@/lib/services/payments";
import { UploadError } from "@/lib/services/documents";
import { ZodError } from "zod";
import { MemberError } from "@/lib/services/members";
import { PasswordError } from "@/lib/services/passwords";

export type ActionResult<T = unknown> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; conflict?: boolean; code?: string };

/** يغلف الإجراء: يحوّل الأخطاء المتوقعة إلى رسائل عربية واضحة دون كشف تفاصيل داخلية */
export async function run<T>(fn: () => Promise<T>, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data, message };
  } catch (e) {
    if (e instanceof ConflictError) return { ok: false, error: e.message, conflict: true };
    if (e instanceof AuthError) return { ok: false, error: e.message, code: String(e.status) };
    if (e instanceof AIProviderError) return { ok: false, error: e.message, code: e.code };
    if (e instanceof ZodError) return { ok: false, error: "بيانات غير صالحة: " + e.issues.map((i) => i.message).join("، ") };
    if (e instanceof PaymentError || e instanceof UploadError || e instanceof MemberError || e instanceof PasswordError) return { ok: false, error: e.message };
    if (e instanceof Error && /[؀-ۿ]/.test(e.message)) return { ok: false, error: e.message };
    // NEXT_REDIRECT وما شابه يجب أن يمر
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error("[action]", e instanceof Error ? e.name : "unknown");
    return { ok: false, error: "حدث خطأ غير متوقع. لم تُفقد بياناتك المحفوظة؛ حاول مرة أخرى." };
  }
}
