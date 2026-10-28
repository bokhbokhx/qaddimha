"use client";
import { useActionState } from "react";
import { signupAction, type FormState } from "../actions/auth";
import { btnClass, inputClass } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signupAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="orgName" className="mb-1 block text-sm font-medium">اسم الجمعية</label>
        <input id="orgName" name="orgName" required minLength={3} className={inputClass} />
      </div>
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">اسمك</label>
        <input id="name" name="name" required autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={`${inputClass} text-left`} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">كلمة المرور</label>
        <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" dir="ltr" className={`${inputClass} text-left`} aria-describedby="pw-hint" />
        <p id="pw-hint" className="mt-1 text-xs text-muted">10 أحرف على الأقل.</p>
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnClass("primary")} w-full`}>{pending ? "جارٍ الإنشاء…" : "إنشاء الحساب"}</button>
      <p className="text-xs text-muted">بإنشاء الحساب توافق على <a href="/terms" className="underline">شروط الاستخدام</a> و<a href="/privacy" className="underline">سياسة الخصوصية</a> (مسودتان تحتاجان مراجعة قبل الإطلاق).</p>
    </form>
  );
}
