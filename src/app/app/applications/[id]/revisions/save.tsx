"use client";
import { useState } from "react";
import { btnClass, inputClass } from "@/components/ui";
import { Feedback, useAction, type Result } from "@/components/client/use-action";

export function SaveRevision({ save }: { save: (label: string) => Promise<Result> }) {
  const [label, setLabel] = useState("");
  const { pending, error, message, exec } = useAction();
  return (
    <div className="flex flex-wrap items-start gap-2">
      <label htmlFor="sr-label" className="sr-only">اسم النسخة</label>
      <input id="sr-label" className={`${inputClass} w-56`} placeholder="اسم النسخة" value={label} onChange={(e) => setLabel(e.target.value)} />
      <button type="button" className={btnClass("secondary")} disabled={pending} onClick={() => exec(() => save(label), () => setLabel(""))}>حفظ نسخة</button>
      <Feedback error={error} message={message} />
    </div>
  );
}
