"use client";
import { useEffect, useRef, useState } from "react";
import { inputClass } from "../ui";
import type { Result } from "./use-action";

type SaveResult = Result<{ version: number; status: string }>;

/**
 * حقل نص بحفظ تلقائي:
 * - نسخة محلية في المتصفح تحمي من فقد التعديل عند فشل الشبكة.
 * - رقم إصدار يكشف التعارض بدل الكتابة فوق تعديل آخر.
 */
export function AutosaveText({
  storageKey, initial, version: initialVersion, save, rows = 6, label, disabled, onChange, describedBy,
}: {
  storageKey: string;
  initial: string;
  version: number | null;
  save: (content: string, version: number | null) => Promise<SaveResult>;
  rows?: number;
  label: string;
  disabled?: boolean;
  onChange?: (v: string) => void;
  describedBy?: string;
}) {
  const [value, setValue] = useState(initial);
  const [version, setVersion] = useState(initialVersion);
  const [state, setState] = useState<"idle" | "dirty" | "saving" | "saved" | "error" | "conflict">("idle");
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(value);
  const key = `qd-draft:${storageKey}`;

  // استعادة مسودة محلية لم تُحفظ
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const d = JSON.parse(raw) as { value: string; base: string };
        if (d.value !== initial && d.base === initial) {
          // مزامنة مع نظام خارجي (التخزين المحلي) بعد التحميل؛ القراءة أثناء العرض تسبب عدم تطابق مع الخادم
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setValue(d.value);
          latest.current = d.value;
          setState("dirty");
          setRestored(true);
        } else localStorage.removeItem(key);
      }
    } catch {
      /* التخزين المحلي غير متاح */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSave(v: string, ver: number | null) {
    setState("saving");
    try {
      const r = await save(v, ver);
      if (latest.current !== v) return; // تغيّر النص أثناء الحفظ — سيُحفظ مجددًا
      if (r.ok) {
        setVersion(r.data?.version ?? ver);
        setState("saved");
        try { localStorage.removeItem(key); } catch {}
      } else if (r.conflict) setState("conflict");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  function onInput(v: string) {
    setValue(v);
    latest.current = v;
    onChange?.(v);
    setState("dirty");
    try { localStorage.setItem(key, JSON.stringify({ value: v, base: initial })); } catch {}
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSave(v, version), 1200);
  }

  const status = {
    idle: "",
    dirty: "تعديلات غير محفوظة…",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ تلقائيًا",
    error: "تعذر الحفظ. تعديلك محفوظ في هذا المتصفح وسيُعاد المحاولة.",
    conflict: "عُدّل هذا النص من مكان آخر. نصك محفوظ محليًا؛ حدّث الصفحة لرؤية النسخة الأحدث ثم انسخ تعديلك إليها.",
  }[state];

  return (
    <div>
      <label className="sr-only" htmlFor={key}>{label}</label>
      {restored && <div className="mb-1 text-xs text-warn-700">استُعيد تعديل غير محفوظ من هذا المتصفح.</div>}
      <textarea
        id={key}
        className={`${inputClass} leading-8`}
        rows={rows}
        value={value}
        disabled={disabled}
        aria-describedby={describedBy}
        onChange={(e) => onInput(e.target.value)}
        onBlur={() => {
          if (state === "dirty") {
            if (timer.current) clearTimeout(timer.current);
            doSave(latest.current, version);
          }
        }}
      />
      <div className="mt-1 flex items-center justify-between gap-2 text-xs" aria-live="polite">
        <span className={state === "error" || state === "conflict" ? "text-danger-700" : "text-muted"}>{status}</span>
        {state === "error" && (
          <button type="button" className="text-brand-700 underline" onClick={() => doSave(latest.current, version)}>
            إعادة المحاولة
          </button>
        )}
      </div>
    </div>
  );
}
