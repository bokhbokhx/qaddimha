"use client";
import { useState } from "react";
import { checkLimit, type LimitType } from "@/lib/text-limits";
import { AutosaveText } from "./autosave-text";
import type { Result } from "./use-action";

export function AnswerEditor({
  storageKey, initial, version, limitType, limitValue, save, disabled, label,
}: {
  storageKey: string; initial: string; version: number | null; limitType: LimitType; limitValue: number | null;
  save: (content: string, version: number | null) => Promise<Result<{ version: number; status: string }>>; disabled: boolean; label: string;
}) {
  const [text, setText] = useState(initial);
  const [copied, setCopied] = useState(false);
  const lim = checkLimit(text, limitType, limitValue);
  const id = `cnt-${storageKey.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <div>
      <AutosaveText storageKey={storageKey} initial={initial} version={version} save={save} rows={6} label={label} disabled={disabled} onChange={setText} describedBy={id} />
      <div id={id} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className={lim.withinLimit ? "text-muted" : "font-bold text-danger-700"} aria-live="polite">
          {limitType === "NONE" ? `${lim.count} كلمة` : `${lim.count} / ${lim.limit} ${limitType === "WORDS" ? "كلمة" : "حرف"}${lim.withinLimit ? "" : " — يتجاوز الحد"}`}
        </span>
        <button
          type="button"
          className="text-brand-700 underline"
          onClick={async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setCopied(false); }
          }}
        >
          {copied ? "نُسخ" : "نسخ الإجابة"}
        </button>
      </div>
      {limitType !== "NONE" && <details className="text-xs text-muted"><summary className="cursor-pointer">طريقة العد</summary>{lim.method} قد يختلف العد في بوابة الجهة.</details>}
    </div>
  );
}
