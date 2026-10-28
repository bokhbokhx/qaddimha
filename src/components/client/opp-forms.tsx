"use client";
import { useState } from "react";
import { CATEGORY_LABEL, SECTIONS } from "@/lib/catalog";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

export function AddRequirementForm({ save }: { save: (d: { code: string; category: string; text: string; mandatory: boolean }) => Promise<Result> }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ code: "", category: "ORG_ELIGIBILITY", text: "", mandatory: true });
  const { pending, error, message, exec } = useAction();
  if (!open) return <button type="button" className={btnClass("secondary", "sm")} onClick={() => setOpen(true)}>+ إضافة شرط يدويًا</button>;
  return (
    <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-4">
      <input aria-label="الرمز" className={inputClass} placeholder="الرمز (اختياري)" value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} />
      <select aria-label="الفئة" className={inputClass} value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })}>
        {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.mandatory} onChange={(e) => setD({ ...d, mandatory: e.target.checked })} /> إلزامي</label>
      <span />
      <textarea aria-label="نص الشرط" className={`${inputClass} sm:col-span-4`} rows={2} placeholder="نص الشرط كما ورد في المصدر" value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />
      <div className="flex gap-2 sm:col-span-4">
        <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(d), () => { setOpen(false); setD({ code: "", category: "ORG_ELIGIBILITY", text: "", mandatory: true }); })}>حفظ</button>
        <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
      </div>
      <div className="sm:col-span-4"><Feedback error={error} message={message} /></div>
    </div>
  );
}

export function AddQuestionForm({ save }: { save: (d: { text: string; mandatory: boolean; limitType: "NONE" | "WORDS" | "CHARS"; limitValue: number | null; linkedSections: string[] }) => Promise<Result> }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ text: "", mandatory: true, limitType: "WORDS" as "NONE" | "WORDS" | "CHARS", limitValue: "150", linkedSections: [] as string[] });
  const { pending, error, message, exec } = useAction();
  if (!open) return <button type="button" className={btnClass("secondary", "sm")} onClick={() => setOpen(true)}>+ إضافة سؤال يدويًا</button>;
  return (
    <div className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-3">
      <textarea aria-label="نص السؤال" className={`${inputClass} sm:col-span-3`} rows={2} placeholder="نص السؤال كما في النموذج" value={d.text} onChange={(e) => setD({ ...d, text: e.target.value })} />
      <select aria-label="نوع الحد" className={inputClass} value={d.limitType} onChange={(e) => setD({ ...d, limitType: e.target.value as typeof d.limitType })}>
        <option value="WORDS">حد بالكلمات</option><option value="CHARS">حد بالأحرف</option><option value="NONE">بلا حد</option>
      </select>
      {d.limitType !== "NONE" ? <input aria-label="قيمة الحد" inputMode="numeric" className={inputClass} value={d.limitValue} onChange={(e) => setD({ ...d, limitValue: e.target.value })} /> : <span />}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.mandatory} onChange={(e) => setD({ ...d, mandatory: e.target.checked })} /> إلزامي</label>
      <fieldset className="sm:col-span-3">
        <legend className="text-sm">الأقسام التي تُبنى عليها الإجابة</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {SECTIONS.map((s) => (
            <label key={s.key} className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={d.linkedSections.includes(s.key)} onChange={(e) => setD({ ...d, linkedSections: e.target.checked ? [...d.linkedSections, s.key] : d.linkedSections.filter((x) => x !== s.key) })} />
              {s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2 sm:col-span-3">
        <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save({ text: d.text, mandatory: d.mandatory, limitType: d.limitType, limitValue: d.limitType === "NONE" ? null : Number(d.limitValue), linkedSections: d.linkedSections }), () => setOpen(false))}>حفظ</button>
        <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
      </div>
      <div className="sm:col-span-3"><Feedback error={error} message={message} /></div>
    </div>
  );
}

export function AssessmentForm({ current, evidence, save }: { current: string | null; evidence: string; save: (result: "MET" | "NOT_MET" | "NEEDS_VERIFICATION", evidence: string) => Promise<Result> }) {
  const [open, setOpen] = useState(false);
  const [r, setR] = useState<"MET" | "NOT_MET" | "NEEDS_VERIFICATION">((current as "MET") ?? "MET");
  const [e, setE] = useState(evidence);
  const { pending, error, message, exec } = useAction();
  if (!open) return <button type="button" className={btnClass("secondary", "sm")} onClick={() => setOpen(true)}>{current ? "تعديل القرار" : "سجّل قرارك مع الدليل"}</button>;
  return (
    <div className="mt-2 space-y-2 rounded-xl border border-line p-3">
      <fieldset className="flex flex-wrap gap-3 text-sm">
        <legend className="sr-only">النتيجة</legend>
        {([["MET", "مستوفى"], ["NOT_MET", "غير مستوفى"], ["NEEDS_VERIFICATION", "يحتاج تحققًا"]] as const).map(([v, l]) => (
          <label key={v} className="flex items-center gap-1"><input type="radio" name="res" checked={r === v} onChange={() => setR(v)} /> {l}</label>
        ))}
      </fieldset>
      <textarea aria-label="الدليل" className={inputClass} rows={2} placeholder="الدليل: مثال — برنامج «مهارتي» منذ 2022 (التقرير السنوي)" value={e} onChange={(x) => setE(x.target.value)} />
      <div className="flex gap-2">
        <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(r, e), () => setOpen(false))}>حفظ</button>
        <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
      </div>
      <Feedback error={error} message={message} />
    </div>
  );
}
