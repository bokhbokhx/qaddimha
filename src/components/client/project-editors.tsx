"use client";
import { useState } from "react";
import { PARTNER_STATUS_LABEL } from "@/lib/catalog";
import { btnClass, inputClass } from "../ui";
import { Modal } from "./modal";
import { Feedback, useAction, type Result } from "./use-action";

type Activity = { id?: string; code: string; name: string; description: string; startMonth: number; endMonth: number; responsible: string; outputs: string };

export function ActivityForm({ initial, save, label }: { initial?: Activity; save: (d: unknown) => Promise<Result>; label: string }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Activity>(initial ?? { code: "", name: "", description: "", startMonth: 1, endMonth: 1, responsible: "", outputs: "" });
  const { pending, error, message, exec } = useAction();
  const f = (k: keyof Activity, l: string, type = "text") => (
    <div>
      <label className="mb-1 block text-sm" htmlFor={`act-${k}`}>{l}</label>
      <input id={`act-${k}`} type={type} className={inputClass} value={String(d[k] ?? "")} onChange={(e) => setD({ ...d, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
    </div>
  );
  return (
    <>
      <button type="button" className={btnClass(initial ? "ghost" : "secondary", "sm")} onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={initial ? "تعديل نشاط" : "نشاط جديد"}>
        <div className="grid gap-3 sm:grid-cols-2">
          {f("code", "الرمز")}{f("name", "اسم النشاط")}{f("startMonth", "من شهر", "number")}{f("endMonth", "إلى شهر", "number")}{f("responsible", "المسؤول")}{f("outputs", "المخرجات")}
          <div className="sm:col-span-2"><label className="mb-1 block text-sm" htmlFor="act-desc">الوصف</label><textarea id="act-desc" className={inputClass} rows={2} value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(d), () => setOpen(false))}>حفظ</button>
          <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
        </div>
        <Feedback error={error} message={message} />
      </Modal>
    </>
  );
}

type Indicator = { id?: string; name: string; type: "OUTPUT" | "OUTCOME"; baseline: string | null; target: string; unit: string; method: string; activityId: string | null };

export function IndicatorForm({ initial, activities, save, label }: { initial?: Indicator; activities: { id: string; code: string; name: string }[]; save: (d: unknown) => Promise<Result>; label: string }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Indicator>(initial ?? { name: "", type: "OUTPUT", baseline: null, target: "", unit: "", method: "", activityId: null });
  const { pending, error, message, exec } = useAction();
  return (
    <>
      <button type="button" className={btnClass(initial ? "ghost" : "secondary", "sm")} onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={initial ? "تعديل مؤشر" : "مؤشر جديد"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1 block text-sm" htmlFor="ind-name">المؤشر</label><input id="ind-name" className={inputClass} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></div>
          <div>
            <label className="mb-1 block text-sm" htmlFor="ind-type">النوع</label>
            <select id="ind-type" className={inputClass} value={d.type} onChange={(e) => setD({ ...d, type: e.target.value as Indicator["type"] })}><option value="OUTPUT">مخرج (ما يُنتج مباشرة)</option><option value="OUTCOME">نتيجة (التغيير المتوقع)</option></select>
          </div>
          <div>
            <label className="mb-1 block text-sm" htmlFor="ind-act">النشاط المرتبط</label>
            <select id="ind-act" className={inputClass} value={d.activityId ?? ""} onChange={(e) => setD({ ...d, activityId: e.target.value || null })}><option value="">— بلا —</option>{activities.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select>
          </div>
          <div><label className="mb-1 block text-sm" htmlFor="ind-base">خط الأساس (إن توفر)</label><input id="ind-base" className={inputClass} value={d.baseline ?? ""} onChange={(e) => setD({ ...d, baseline: e.target.value || null })} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="ind-target">المستهدف</label><input id="ind-target" className={inputClass} value={d.target} onChange={(e) => setD({ ...d, target: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="ind-unit">الوحدة</label><input id="ind-unit" className={inputClass} value={d.unit} onChange={(e) => setD({ ...d, unit: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="ind-method">طريقة القياس</label><input id="ind-method" className={inputClass} value={d.method} onChange={(e) => setD({ ...d, method: e.target.value })} /></div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(d), () => setOpen(false))}>حفظ</button>
          <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
        </div>
        <Feedback error={error} message={message} />
      </Modal>
    </>
  );
}

type Partner = {
  id?: string; name: string; partnerType: string; role: string; status: "PROPOSED" | "NEGOTIATING" | "CONFIRMED"; tasks: string; cashSar: string;
  inKindDescription: string; responsibilities: string; mutualValue: string; evidenceDocId: string | null; orgApproved: boolean;
};

export function PartnerForm({ initial, docs, save, label }: { initial?: Partner; docs: { id: string; name: string }[]; save: (d: unknown) => Promise<Result>; label: string }) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState<Partner>(initial ?? { name: "", partnerType: "", role: "", status: "PROPOSED", tasks: "", cashSar: "0", inKindDescription: "", responsibilities: "", mutualValue: "", evidenceDocId: null, orgApproved: false });
  const { pending, error, message, exec } = useAction();
  const t = (k: keyof Partner, l: string, area = false) => (
    <div className={area ? "sm:col-span-2" : ""}>
      <label className="mb-1 block text-sm" htmlFor={`p-${k}`}>{l}</label>
      {area ? <textarea id={`p-${k}`} rows={2} className={inputClass} value={String(d[k] ?? "")} onChange={(e) => setD({ ...d, [k]: e.target.value })} /> : <input id={`p-${k}`} className={inputClass} value={String(d[k] ?? "")} onChange={(e) => setD({ ...d, [k]: e.target.value })} />}
    </div>
  );
  return (
    <>
      <button type="button" className={btnClass(initial ? "ghost" : "secondary", "sm")} onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={initial ? "تعديل شريك" : "شريك جديد"} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          {t("name", "اسم الشريك أو نوعه")}{t("partnerType", "نوع الجهة")}
          <div>
            <label className="mb-1 block text-sm" htmlFor="p-status">الحالة</label>
            <select id="p-status" className={inputClass} value={d.status} onChange={(e) => setD({ ...d, status: e.target.value as Partner["status"] })}>
              {Object.entries(PARTNER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {t("cashSar", "المساهمة النقدية (ر.س)")}
          {t("role", "الدور", true)}{t("tasks", "المهام", true)}{t("inKindDescription", "المساهمة العينية")}{t("responsibilities", "المسؤوليات")}{t("mutualValue", "القيمة المتبادلة", true)}
          <div>
            <label className="mb-1 block text-sm" htmlFor="p-ev">إثبات الاتفاق (مستند)</label>
            <select id="p-ev" className={inputClass} value={d.evidenceDocId ?? ""} onChange={(e) => setD({ ...d, evidenceDocId: e.target.value || null })}><option value="">— لا يوجد —</option>{docs.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          </div>
          {d.status === "CONFIRMED" && (
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={d.orgApproved} onChange={(e) => setD({ ...d, orgApproved: e.target.checked })} /> أؤكد أن الاتفاق قائم فعلًا وأعتمد ظهوره كشريك مؤكد</label>
          )}
        </div>
        <p className="mt-3 text-xs text-muted">لا يظهر الشريك «مؤكدًا» في الحزمة دون اعتمادك. إن اشترطت الجهة إثبات الاتفاق فارفع المستند من ملف الجمعية بنوع «إثبات شراكة».</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(d), () => setOpen(false))}>حفظ</button>
          <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
        </div>
        <Feedback error={error} message={message} />
      </Modal>
    </>
  );
}
