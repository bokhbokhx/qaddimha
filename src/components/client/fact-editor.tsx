"use client";
import { useState } from "react";
import type { FieldType } from "@/lib/catalog";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

type ResultItem = { text: string; source: string | null; period: string | null };

function toEditable(type: FieldType, value: unknown): string | ResultItem[] {
  if (type === "results") return Array.isArray(value) ? (value as ResultItem[]) : [];
  if (type === "list") return Array.isArray(value) ? (value as string[]).join("\n") : value ? String(value) : "";
  return value == null ? "" : Array.isArray(value) ? value.join("، ") : String(value);
}

export function FactValue({ type, value }: { type: FieldType; value: unknown }) {
  if (value == null || (Array.isArray(value) && !value.length) || value === "") return <span className="text-muted">— غير متوفر —</span>;
  if (type === "results" && Array.isArray(value))
    return (
      <ul className="space-y-1">
        {(value as ResultItem[]).map((r, i) => (
          <li key={i}>
            {r.text}{" "}
            <span className="text-xs text-muted">({r.source ? `المصدر: ${r.source}` : <span className="text-danger-700">بلا مصدر</span>}{r.period ? ` — ${r.period}` : ""})</span>
          </li>
        ))}
      </ul>
    );
  if (Array.isArray(value)) return <ul className="list-disc pe-5">{value.map((v, i) => <li key={i}>{String(v)}</li>)}</ul>;
  return <span className="whitespace-pre-line">{String(value)}</span>;
}

/** تحرير معلومة وتأكيدها — التغيير لا يُعتمد إلا بقرار المستخدم */
export function FactEditor({
  type, value, status, save, canEdit, fieldLabel,
}: {
  type: FieldType;
  value: unknown;
  status: string;
  save: (value: unknown) => Promise<Result>;
  canEdit: boolean;
  fieldLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toEditable(type, value));
  const { pending, error, message, exec } = useAction();

  const submit = (v: unknown) => exec(() => save(v), () => setEditing(false));
  const parsed = () => {
    if (type === "results") return (draft as ResultItem[]).filter((r) => r.text.trim()).map((r) => ({ text: r.text.trim(), source: r.source?.trim() || null, period: r.period?.trim() || null }));
    if (type === "list") return String(draft).split("\n").map((s) => s.trim()).filter(Boolean);
    return String(draft).trim() || null;
  };

  if (!editing)
    return (
      <div>
        <FactValue type={type} value={value} />
        {canEdit && (
          <div className="mt-2 flex flex-wrap gap-2">
            {status === "EXTRACTED_UNCONFIRMED" && (
              <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => submit(value)}>{pending ? "…" : "تأكيد كما هي"}</button>
            )}
            <button type="button" className={btnClass("secondary", "sm")} onClick={() => setEditing(true)} aria-label={`تعديل ${fieldLabel}`}>
              {status === "MISSING" || value == null ? "إضافة" : "تعديل"}
            </button>
          </div>
        )}
        <Feedback error={error} message={message} />
      </div>
    );

  return (
    <div className="space-y-2">
      {type === "results" ? (
        <div className="space-y-2">
          {(draft as ResultItem[]).map((r, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-line p-2 sm:grid-cols-3">
              <input aria-label="النتيجة" className={inputClass} value={r.text} placeholder="النتيجة" onChange={(e) => setDraft((d) => (d as ResultItem[]).map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
              <input aria-label="المصدر" className={inputClass} value={r.source ?? ""} placeholder="المصدر (مطلوب للاستخدام)" onChange={(e) => setDraft((d) => (d as ResultItem[]).map((x, j) => (j === i ? { ...x, source: e.target.value } : x)))} />
              <input aria-label="الفترة" className={inputClass} value={r.period ?? ""} placeholder="الفترة" onChange={(e) => setDraft((d) => (d as ResultItem[]).map((x, j) => (j === i ? { ...x, period: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="text-sm text-brand-700 underline" onClick={() => setDraft((d) => [...(d as ResultItem[]), { text: "", source: "", period: "" }])}>+ إضافة نتيجة</button>
        </div>
      ) : type === "text" ? (
        <input aria-label={fieldLabel} className={inputClass} value={String(draft)} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <textarea aria-label={fieldLabel} className={inputClass} rows={type === "list" ? 4 : 3} value={String(draft)} onChange={(e) => setDraft(e.target.value)} />
      )}
      {type === "list" && <div className="text-xs text-muted">عنصر واحد في كل سطر.</div>}
      <div className="flex gap-2">
        <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => submit(parsed())}>{pending ? "جارٍ الحفظ…" : "حفظ وتأكيد"}</button>
        <button type="button" className={btnClass("ghost", "sm")} onClick={() => { setEditing(false); setDraft(toEditable(type, value)); }}>إلغاء</button>
      </div>
      <Feedback error={error} message={message} />
    </div>
  );
}

/** حسم تعارض: عرض كل قيمة ومصدرها، والاختيار صريح من المستخدم */
export function ConflictResolver({
  alternatives, resolve, canEdit,
}: {
  alternatives: { value: unknown; sourceLocator?: string | null; sourceExcerpt?: string | null; docName?: string | null }[];
  resolve: (value: unknown) => Promise<Result>;
  canEdit: boolean;
}) {
  const { pending, error, message, exec } = useAction();
  return (
    <div className="space-y-2">
      <p className="text-sm text-danger-700">مصادر مختلفة تذكر قيمًا مختلفة. لا نعتمد الأحدث تلقائيًا — اختر القيمة الصحيحة بناءً على مصدر موثوق.</p>
      {alternatives.map((a, i) => (
        <div key={i} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-line p-3">
          <div>
            <div className="font-medium">{Array.isArray(a.value) ? (a.value as string[]).join("، ") : String(a.value)}</div>
            <div className="text-xs text-muted">المصدر: {a.docName ?? "—"}{a.sourceLocator ? ` — ${a.sourceLocator}` : ""}</div>
            {a.sourceExcerpt && <blockquote className="mt-1 border-s-2 border-gold-400 ps-2 text-xs text-muted">«{a.sourceExcerpt}»</blockquote>}
          </div>
          {canEdit && <button type="button" className={btnClass("secondary", "sm")} disabled={pending} onClick={() => exec(() => resolve(a.value))}>اعتماد هذه القيمة</button>}
        </div>
      ))}
      <Feedback error={error} message={message} />
    </div>
  );
}
