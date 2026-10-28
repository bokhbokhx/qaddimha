"use client";
import { useState } from "react";
import { createApplicationAction } from "../../../actions/app";
import { btnClass, inputClass } from "@/components/ui";
import { Feedback, useAction } from "@/components/client/use-action";

export function NewApplicationWizard({ isDemoOrg, orgName }: { isDemoOrg: boolean; orgName: string }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<"demo" | "manual">(isDemoOrg ? "demo" : "manual");
  const [title, setTitle] = useState("");
  const [funderName, setFunder] = useState("");
  const [grantTitle, setGrant] = useState("");
  const [referenceUrl, setUrl] = useState("");
  const [pastedText, setPasted] = useState("");
  const { pending, error, exec } = useAction();

  return (
    <div className="space-y-6">
      <ol className="flex gap-2 text-sm" aria-label="خطوات المعالج">
        <li className={`rounded-full px-3 py-1 ${step === 1 ? "bg-brand-900 text-white" : "bg-brand-50"}`} aria-current={step === 1 ? "step" : undefined}>1. الجمعية</li>
        <li className={`rounded-full px-3 py-1 ${step === 2 ? "bg-brand-900 text-white" : "bg-brand-50"}`} aria-current={step === 2 ? "step" : undefined}>2. فرصة التمويل</li>
      </ol>

      {step === 1 && (
        <div className="space-y-4">
          <p>سيُعدّ الطلب باسم <strong>{orgName}</strong> وباستخدام نسخة من ملفها الحالي. تحديث ملف الجمعية لاحقًا لا يغير الطلب إلا بموافقتك.</p>
          <div>
            <label htmlFor="title" className="mb-1 block text-sm font-medium">اسم مختصر لهذا الطلب</label>
            <input id="title" className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: طلب منحة تمكين الشباب 2027" />
          </div>
          <button type="button" className={btnClass()} disabled={title.trim().length < 3} onClick={() => setStep(2)}>التالي: أضف فرصة التمويل</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 font-medium">كيف تريد إضافة الفرصة؟</legend>
            {isDemoOrg && (
              <label className={`cursor-pointer rounded-xl border p-4 ${mode === "demo" ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`}>
                <input type="radio" name="mode" className="sr-only" checked={mode === "demo"} onChange={() => setMode("demo")} />
                <div className="font-bold">المنحة التجريبية</div>
                <div className="text-sm text-muted">«منحة تمكين المجتمع — تجريبية». يُرفع دليلها التجريبي ويُحلل عبر نفس المسار. بيانات غير حقيقية.</div>
              </label>
            )}
            <label className={`cursor-pointer rounded-xl border p-4 ${mode === "manual" ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`}>
              <input type="radio" name="mode" className="sr-only" checked={mode === "manual"} onChange={() => setMode("manual")} />
              <div className="font-bold">فرصة حقيقية</div>
              <div className="text-sm text-muted">أدخل اسم الجهة والفرصة، والصق النص الآن أو ارفع الدليل ونموذج التقديم في الخطوة التالية.</div>
            </label>
          </fieldset>

          {mode === "manual" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="funder" className="mb-1 block text-sm font-medium">اسم الجهة المانحة</label>
                <input id="funder" className={inputClass} value={funderName} onChange={(e) => setFunder(e.target.value)} />
              </div>
              <div>
                <label htmlFor="grant" className="mb-1 block text-sm font-medium">اسم الفرصة أو المنحة</label>
                <input id="grant" className={inputClass} value={grantTitle} onChange={(e) => setGrant(e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="url" className="mb-1 block text-sm font-medium">رابط مرجعي (اختياري)</label>
                <input id="url" dir="ltr" className={`${inputClass} text-left`} value={referenceUrl} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
                <p className="mt-1 text-xs text-muted">الرابط يُحفظ مرجعًا فقط ولا نقرأ محتواه. ارفع الملفات أو الصق النص ليُحلل.</p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="pasted" className="mb-1 block text-sm font-medium">الصق نص الدليل أو الإعلان (اختياري)</label>
                <textarea id="pasted" rows={6} className={inputClass} value={pastedText} onChange={(e) => setPasted(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" className={btnClass("secondary")} onClick={() => setStep(1)}>رجوع</button>
            <button
              type="button"
              className={btnClass()}
              disabled={pending || (mode === "manual" && (funderName.trim().length < 2 || grantTitle.trim().length < 2))}
              onClick={() => exec(() => createApplicationAction({ mode, title, funderName, grantTitle, referenceUrl, pastedText }))}
            >
              {pending ? (mode === "demo" ? "جارٍ رفع الدليل التجريبي وتحليله…" : "جارٍ الإنشاء…") : "إنشاء الطلب"}
            </button>
          </div>
          <Feedback error={error} message={null} />
        </div>
      )}
    </div>
  );
}
