"use client";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

export function ReviewRequestForm({
  revisions, docs, submit,
}: {
  revisions: { id: string; label: string }[];
  docs: { id: string; name: string }[];
  submit: (d: { revisionId: string; consent: boolean; sharedDocIds: string[]; notes: string }) => Promise<Result>;
}) {
  const [revisionId, setRev] = useState(revisions[0]?.id ?? "");
  const [shared, setShared] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [consent, setConsent] = useState(false);
  const { pending, error, message, exec } = useAction();
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="rr-rev" className="mb-1 block text-sm font-medium">النسخة التي يراجعها الخبير</label>
        <select id="rr-rev" className={inputClass} value={revisionId} onChange={(e) => setRev(e.target.value)}>{revisions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}</select>
      </div>
      <fieldset>
        <legend className="mb-1 text-sm font-medium">المرفقات التي تشاركها (اختياري)</legend>
        {docs.length ? docs.map((d) => (
          <label key={d.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared.includes(d.id)} onChange={(e) => setShared(e.target.checked ? [...shared, d.id] : shared.filter((x) => x !== d.id))} />{d.name}</label>
        )) : <p className="text-sm text-muted">لا توجد مستندات.</p>}
      </fieldset>
      <div>
        <label htmlFor="rr-notes" className="mb-1 block text-sm font-medium">ملاحظات للخبير</label>
        <textarea id="rr-notes" rows={3} className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ما الذي تريد التركيز عليه؟" />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
        أوافق على منح الخبير وصولًا لهذه النسخة المحددة والمرفقات المختارة فقط، دون بقية بيانات الجمعية أو طلباتها الأخرى.
      </label>
      <button type="button" className={btnClass()} disabled={pending || !consent || !revisionId} onClick={() => exec(() => submit({ revisionId, consent, sharedDocIds: shared, notes }))}>إرسال طلب المراجعة</button>
      <Feedback error={error} message={message} />
    </div>
  );
}

export function CommentForm({ sections, submit, placeholder }: { sections: { key: string; label: string }[]; submit: (section: string, body: string) => Promise<Result>; placeholder?: string }) {
  const [section, setSection] = useState(sections[0]?.key ?? "general");
  const [body, setBody] = useState("");
  const { pending, error, message, exec } = useAction();
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[220px_1fr]">
        <select aria-label="القسم" className={inputClass} value={section} onChange={(e) => setSection(e.target.value)}>{sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
        <textarea aria-label="التعليق" rows={2} className={inputClass} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} />
      </div>
      <button type="button" className={btnClass("primary", "sm")} disabled={pending || !body.trim()} onClick={() => exec(() => submit(section, body), () => setBody(""))}>إرسال</button>
      <Feedback error={error} message={message} />
    </div>
  );
}
