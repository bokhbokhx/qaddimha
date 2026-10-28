"use client";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

export function ExtractFromDocs({
  docs, extract,
}: {
  docs: { id: string; filename: string; label: string | null }[];
  extract: (ids: string[]) => Promise<Result<{ fields: number; notes: string[]; demo: boolean }>>;
}) {
  const [sel, setSel] = useState<string[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const { pending, error, exec, message, setMessage } = useAction();
  if (!docs.length) return <p className="text-sm text-muted">ارفع مستندًا نصيًا (مثل الملف التعريفي) لاستخراج البيانات منه.</p>;
  return (
    <div className="space-y-2">
      <fieldset className="space-y-1">
        <legend className="mb-1 text-sm font-medium">اختر المستندات التي نستخرج منها بيانات الجمعية</legend>
        {docs.map((d) => (
          <label key={d.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sel.includes(d.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id)))} />
            {d.label ?? d.filename}
          </label>
        ))}
      </fieldset>
      <button
        type="button"
        className={btnClass("primary", "sm")}
        disabled={!sel.length || pending}
        onClick={() =>
          exec(() => extract(sel), (d) => {
            setNotes(d?.notes ?? []);
            setMessage(`استخرجنا ${d?.fields ?? 0} معلومة. راجعها وأكّدها أدناه — لن تُعتمد دون تأكيدك.`);
          })
        }
      >
        {pending ? "جارٍ الاستخراج…" : "استخرج البيانات للمراجعة"}
      </button>
      <Feedback error={error} message={message} />
      {notes.length > 0 && <ul className="list-disc pe-5 text-sm text-warn-700">{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
    </div>
  );
}

export function IdentityForm({ primary, secondary, save, canEdit }: { primary: string; secondary: string; save: (p: string, s: string) => Promise<Result>; canEdit: boolean }) {
  const [p, setP] = useState(primary);
  const [s, setS] = useState(secondary);
  const { pending, error, message, exec } = useAction();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">اللون الأساسي <input type="color" value={p} onChange={(e) => setP(e.target.value)} disabled={!canEdit} className="h-9 w-14 rounded border border-line" /> <span className="ltr text-xs text-muted">{p}</span></label>
        <label className="flex items-center gap-2 text-sm">اللون الثانوي <input type="color" value={s} onChange={(e) => setS(e.target.value)} disabled={!canEdit} className="h-9 w-14 rounded border border-line" /> <span className="ltr text-xs text-muted">{s}</span></label>
      </div>
      {canEdit && <button type="button" className={btnClass("secondary", "sm")} disabled={pending} onClick={() => exec(() => save(p, s))}>حفظ الألوان</button>}
      <Feedback error={error} message={message} />
    </div>
  );
}

export function DocMetaEditor({
  kind, label, expiresOn, kinds, save,
}: {
  kind: string; label: string; expiresOn: string; kinds: [string, string][];
  save: (kind: string, label: string, expiresOn: string) => Promise<Result>;
}) {
  const [open, setOpen] = useState(false);
  const [k, setK] = useState(kind);
  const [l, setL] = useState(label);
  const [e, setE] = useState(expiresOn);
  const { pending, error, message, exec } = useAction();
  if (!open) return <button type="button" className="text-sm text-brand-700 underline" onClick={() => setOpen(true)}>تعديل البيانات</button>;
  return (
    <div className="mt-2 grid gap-2 rounded-lg bg-paper p-2 sm:grid-cols-4">
      <select aria-label="النوع" className={inputClass} value={k} onChange={(x) => setK(x.target.value)}>{kinds.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      <input aria-label="الوصف" className={inputClass} value={l} onChange={(x) => setL(x.target.value)} placeholder="الوصف" />
      <input aria-label="تاريخ الانتهاء" type="date" className={inputClass} value={e} onChange={(x) => setE(x.target.value)} />
      <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(k, l, e), () => setOpen(false))}>حفظ</button>
      <div className="sm:col-span-4"><Feedback error={error} message={message} /></div>
    </div>
  );
}
