"use client";
import { useState } from "react";
import { CONTRIBUTION_LABEL, FUNDING_SOURCE_LABEL } from "@/lib/catalog";
import { btnClass, inputClass } from "../ui";
import { Modal } from "./modal";
import { Feedback, useAction, type Result } from "./use-action";

export type LineView = {
  id: string; item: string; costCenter: string; activityId: string | null; partnerId: string | null; unit: string;
  quantity: string; unitCostSar: string; calc: "ONE_TIME" | "RECURRING"; periods: number;
  fundingSource: "DONOR" | "SELF" | "PARTNER"; contributionType: "CASH" | "IN_KIND"; justification: string;
  periodsFollowDuration: boolean; quantityFollowsBeneficiaries: boolean;
  totalDisplay: string; formula: string; isEstimate: boolean; needsReview: boolean; activityCode: string; partnerName: string; warnings: string[];
};

const EMPTY = { item: "", costCenter: "", activityId: null, partnerId: null, unit: "", quantity: "1", unitCostSar: "0", calc: "ONE_TIME" as const, periods: 1, fundingSource: "DONOR" as const, contributionType: "CASH" as const, justification: "", periodsFollowDuration: false, quantityFollowsBeneficiaries: false };

export function BudgetLineForm({
  initial, activities, partners, save, label, duration, beneficiaries,
}: {
  initial?: Partial<LineView>;
  activities: { id: string; code: string; name: string }[];
  partners: { id: string; name: string }[];
  save: (d: unknown) => Promise<Result>;
  label: string;
  duration: number | null;
  beneficiaries: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState({ ...EMPTY, ...initial });
  const { pending, error, message, exec } = useAction();
  const set = (patch: Partial<typeof d>) => setD({ ...d, ...patch });
  return (
    <>
      <button type="button" className={btnClass(initial ? "ghost" : "secondary", "sm")} onClick={() => setOpen(true)}>{label}</button>
      <Modal open={open} onClose={() => setOpen(false)} title={initial ? "تعديل بند" : "بند جديد"} wide>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><label className="mb-1 block text-sm" htmlFor="bl-item">البند</label><input id="bl-item" className={inputClass} value={d.item} onChange={(e) => set({ item: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="bl-cc">مركز التكلفة</label><input id="bl-cc" className={inputClass} value={d.costCenter} onChange={(e) => set({ costCenter: e.target.value })} /></div>
          <div>
            <label className="mb-1 block text-sm" htmlFor="bl-act">النشاط المرتبط</label>
            <select id="bl-act" className={inputClass} value={d.activityId ?? ""} onChange={(e) => set({ activityId: e.target.value || null })}><option value="">— بلا —</option>{activities.map((a) => <option key={a.id} value={a.id}>{a.code} {a.name}</option>)}</select>
          </div>
          <div><label className="mb-1 block text-sm" htmlFor="bl-unit">الوحدة</label><input id="bl-unit" className={inputClass} value={d.unit} onChange={(e) => set({ unit: e.target.value })} /></div>
          <div>
            <label className="mb-1 block text-sm" htmlFor="bl-calc">طريقة الحساب</label>
            <select id="bl-calc" className={inputClass} value={d.calc} onChange={(e) => set({ calc: e.target.value as "ONE_TIME" | "RECURRING", periods: e.target.value === "ONE_TIME" ? 1 : d.periods })}>
              <option value="ONE_TIME">مرة واحدة: الكمية × تكلفة الوحدة</option>
              <option value="RECURRING">دوري: الكمية × تكلفة الوحدة × الفترات</option>
            </select>
          </div>
          <div><label className="mb-1 block text-sm" htmlFor="bl-q">الكمية</label><input id="bl-q" inputMode="decimal" dir="ltr" className={`${inputClass} text-left tabular`} value={d.quantity} onChange={(e) => set({ quantity: e.target.value })} disabled={d.quantityFollowsBeneficiaries} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="bl-u">تكلفة الوحدة (ر.س)</label><input id="bl-u" inputMode="decimal" dir="ltr" className={`${inputClass} text-left tabular`} value={d.unitCostSar} onChange={(e) => set({ unitCostSar: e.target.value })} /></div>
          <div><label className="mb-1 block text-sm" htmlFor="bl-p">عدد الفترات</label><input id="bl-p" inputMode="numeric" dir="ltr" className={`${inputClass} text-left tabular`} value={d.calc === "ONE_TIME" ? 1 : d.periods} disabled={d.calc === "ONE_TIME" || d.periodsFollowDuration} onChange={(e) => set({ periods: Number(e.target.value) || 1 })} /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={d.quantityFollowsBeneficiaries} onChange={(e) => set({ quantityFollowsBeneficiaries: e.target.checked })} /> الكمية = عدد المستفيدين ({beneficiaries ?? "غير محدد"}) وتُحدّث تلقائيًا عند تغييره</label>
          {d.calc === "RECURRING" && <label className="flex items-center gap-2 text-sm sm:col-span-3"><input type="checkbox" checked={d.periodsFollowDuration} onChange={(e) => set({ periodsFollowDuration: e.target.checked })} /> عدد الفترات = مدة المشروع ({duration ?? "غير محددة"} شهرًا) ويُحدّث تلقائيًا</label>}
          <div>
            <label className="mb-1 block text-sm" htmlFor="bl-src">مصدر التمويل</label>
            <select id="bl-src" className={inputClass} value={d.fundingSource} onChange={(e) => set({ fundingSource: e.target.value as typeof d.fundingSource, contributionType: e.target.value === "DONOR" ? "CASH" : d.contributionType })}>
              {Object.entries(FUNDING_SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm" htmlFor="bl-ct">نوع المساهمة</label>
            <select id="bl-ct" className={inputClass} value={d.contributionType} disabled={d.fundingSource === "DONOR"} onChange={(e) => set({ contributionType: e.target.value as typeof d.contributionType })}>
              {Object.entries(CONTRIBUTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {d.fundingSource === "PARTNER" ? (
            <div>
              <label className="mb-1 block text-sm" htmlFor="bl-pa">الشريك</label>
              <select id="bl-pa" className={inputClass} value={d.partnerId ?? ""} onChange={(e) => set({ partnerId: e.target.value || null })}><option value="">— اختر —</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            </div>
          ) : <span />}
          <div className="sm:col-span-3"><label className="mb-1 block text-sm" htmlFor="bl-j">مبرر التكلفة</label><textarea id="bl-j" rows={2} className={inputClass} value={d.justification} onChange={(e) => set({ justification: e.target.value })} /></div>
        </div>
        <p className="mt-2 text-xs text-muted">لا تُضاف ضريبة أو نسبة مصاريف إدارية تلقائيًا. أضفها بندًا مستقلًا إن احتجت أو اشترطتها الجهة.</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className={btnClass("primary", "sm")} disabled={pending} onClick={() => exec(() => save(d), () => setOpen(false))}>حفظ وإعادة الحساب</button>
          <button type="button" className={btnClass("ghost", "sm")} onClick={() => setOpen(false)}>إلغاء</button>
        </div>
        <Feedback error={error} message={message} />
      </Modal>
    </>
  );
}
