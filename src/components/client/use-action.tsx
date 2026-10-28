"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type Result<T = unknown> = { ok: true; data?: T; message?: string } | { ok: false; error: string; conflict?: boolean; code?: string };

/** تشغيل إجراء خادمي مع حالات الانتظار والخطأ. لا تُعرض رسالة نجاح إلا إذا نجح الإجراء فعلًا. */
export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  function exec<T>(fn: () => Promise<Result<T> | undefined>, onOk?: (data: T | undefined) => void) {
    setError(null);
    setMessage(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r) return;
        if (r.ok) {
          setMessage(r.message ?? null);
          onOk?.(r.data);
          router.refresh();
        } else setError(r.error);
      } catch (e) {
        // انقطاع الشبكة أو خطأ في الخادم
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: string }).digest).startsWith("NEXT_REDIRECT")) throw e;
        setError("تعذر الاتصال بالخادم. تحقق من الشبكة وحاول مجددًا؛ لم يُحفظ هذا الإجراء.");
      }
    });
  }
  return { pending, error, message, exec, setError, setMessage };
}

export function Feedback({ error, message }: { error: string | null; message: string | null }) {
  if (!error && !message) return null;
  return (
    <div role={error ? "alert" : "status"} aria-live="polite" className={`mt-2 text-sm ${error ? "text-danger-700" : "text-ok-700"}`}>
      {error ?? message}
    </div>
  );
}
