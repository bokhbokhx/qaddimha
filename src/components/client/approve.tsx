"use client";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

export function ApproveRevision({ approve, ready, blockers }: { approve: (label: string) => Promise<Result<{ number: number; ready: boolean }>>; ready: boolean; blockers: number }) {
  const [label, setLabel] = useState("");
  const { pending, error, message, exec, setMessage } = useAction();
  return (
    <div className="space-y-2">
      <label htmlFor="rev-label" className="block text-sm">اسم النسخة (اختياري)</label>
      <input id="rev-label" className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="مثال: نسخة التقديم النهائية" />
      {!ready && <p className="text-sm text-warn-700">توجد {blockers} عوائق. يمكنك اعتماد نسخة الآن، لكنها ستُصدَّر موسومة «مسودة».</p>}
      <button type="button" className={btnClass("primary")} disabled={pending} onClick={() => exec(() => approve(label), (d) => setMessage(`اعتُمدت النسخة رقم ${d?.number}${d?.ready ? " وهي جاهزة للتقديم" : " (مسودة — توجد عوائق)"}.`))}>
        {pending ? "جارٍ الاعتماد…" : "اعتماد نسخة من الحالة الحالية"}
      </button>
      <Feedback error={error} message={message} />
    </div>
  );
}
