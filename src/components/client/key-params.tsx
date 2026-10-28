"use client";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

type Summary = { label: string; sections: number; answers: number; recalc: number; proposals: number; indicators: number }[];

/** المدخلات المؤثرة: تغييرها يعيد الحسابات المباشرة فورًا، ويعلّم النصوص المتأثرة ويقترح تعديلها */
export function KeyParams({
  beneficiaryCount, durationMonths, region, version, save, canEdit,
}: {
  beneficiaryCount: number | null; durationMonths: number | null; region: string | null; version: number;
  save: (version: number, p: { beneficiaryCount?: string; durationMonths?: string; region?: string }) => Promise<Result<{ changed: boolean; summary: Summary }>>;
  canEdit: boolean;
}) {
  const [b, setB] = useState(beneficiaryCount?.toString() ?? "");
  const [d, setD] = useState(durationMonths?.toString() ?? "");
  const [r, setR] = useState(region ?? "");
  const [summary, setSummary] = useState<Summary | null>(null);
  const { pending, error, exec } = useAction();
  const dirty = b !== (beneficiaryCount?.toString() ?? "") || d !== (durationMonths?.toString() ?? "") || r !== (region ?? "");
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label htmlFor="kp-b" className="block text-xs text-muted">المستفيدون</label>
          <input id="kp-b" inputMode="numeric" className={`${inputClass} tabular`} value={b} onChange={(e) => setB(e.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <label htmlFor="kp-d" className="block text-xs text-muted">المدة (شهر)</label>
          <input id="kp-d" inputMode="numeric" className={`${inputClass} tabular`} value={d} onChange={(e) => setD(e.target.value)} disabled={!canEdit} />
        </div>
        <div>
          <label htmlFor="kp-r" className="block text-xs text-muted">المنطقة</label>
          <input id="kp-r" className={inputClass} value={r} onChange={(e) => setR(e.target.value)} disabled={!canEdit} />
        </div>
      </div>
      {canEdit && dirty && (
        <button
          type="button"
          className={btnClass("primary", "sm")}
          disabled={pending}
          onClick={() => exec(() => save(version, { beneficiaryCount: b, durationMonths: d, region: r }), (data) => setSummary(data?.summary ?? null))}
        >
          {pending ? "جارٍ التحليل…" : "حفظ وتحليل الأثر"}
        </button>
      )}
      <Feedback error={error} message={null} />
      {summary && summary.length > 0 && (
        <div role="status" className="rounded-lg bg-warn-50 p-3 text-sm text-warn-700">
          {summary.map((s, i) => (
            <div key={i}>
              <strong>{s.label}</strong>
              <ul className="mt-1 list-disc pe-5">
                <li>بنود ميزانية أُعيد حسابها مباشرة: {s.recalc}</li>
                <li>أقسام وُسمت «تحتاج مراجعة»: {s.sections}</li>
                <li>إجابات أصبحت قديمة: {s.answers}</li>
                <li>مؤشرات تحتاج مراجعة: {s.indicators}</li>
                <li>مقترحات تعديل (قبل/بعد) بانتظار موافقتك: {s.proposals}</li>
              </ul>
              <div className="mt-1">حُفظت نسخة قبل التغيير.</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
