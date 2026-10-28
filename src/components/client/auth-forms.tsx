"use client";
import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { btnClass, inputClass } from "../ui";

type Act = (s: FormState, f: FormData) => Promise<FormState>;

function Msg({ state }: { state: FormState }) {
  if (!state) return null;
  return (
    <div aria-live="polite" className="space-y-2 text-sm">
      {state.error && <p role="alert" className="text-danger-700">{state.error}</p>}
      {state.message && <p role="status" className="text-ok-700">{state.message}</p>}
      {state.devLink && (
        <p className="rounded-lg bg-gold-100 p-2 text-gold-600">
          بيئة التطوير فقط — لا يوجد مزود بريد مفعّل: <Link href={state.devLink} className="underline">افتح رابط إعادة التعيين</Link>
        </p>
      )}
    </div>
  );
}

const pw = (id: string, label: string, auto: string) => (
  <div>
    <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
    <input id={id} name={id} type="password" required autoComplete={auto} dir="ltr" className={`${inputClass} text-left`} />
  </div>
);

export function ForgotForm({ action }: { action: Act }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required dir="ltr" className={`${inputClass} text-left`} />
      </div>
      <button type="submit" disabled={pending} className={`${btnClass()} w-full`}>{pending ? "جارٍ الإرسال…" : "أرسل رابط إعادة التعيين"}</button>
      <Msg state={state} />
    </form>
  );
}

export function ResetForm({ action, token }: { action: Act; token: string }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {pw("password", "كلمة المرور الجديدة (10 أحرف على الأقل)", "new-password")}
      {pw("confirm", "تأكيد كلمة المرور", "new-password")}
      <button type="submit" disabled={pending} className={`${btnClass()} w-full`}>{pending ? "جارٍ الحفظ…" : "حفظ كلمة المرور"}</button>
      <Msg state={state} />
    </form>
  );
}

export function ChangePasswordForm({ action }: { action: Act }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="max-w-md space-y-4">
      {pw("current", "كلمة المرور الحالية", "current-password")}
      {pw("password", "كلمة المرور الجديدة (10 أحرف على الأقل)", "new-password")}
      {pw("confirm", "تأكيد كلمة المرور الجديدة", "new-password")}
      <button type="submit" disabled={pending} className={btnClass()}>{pending ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}</button>
      <Msg state={state} />
    </form>
  );
}

export function InviteSignupForm({ action, token, email }: { action: Act; token: string; email: string }) {
  const [state, act, pending] = useActionState(action, undefined);
  return (
    <form action={act} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <span className="mb-1 block text-sm font-medium">البريد</span>
        <div dir="ltr" className="rounded-lg bg-paper px-3 py-2 text-left">{email}</div>
      </div>
      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">اسمك</label>
        <input id="name" name="name" required className={inputClass} />
      </div>
      {pw("password", "كلمة المرور (10 أحرف على الأقل)", "new-password")}
      <button type="submit" disabled={pending} className={`${btnClass()} w-full`}>{pending ? "جارٍ الإنشاء…" : "إنشاء الحساب والانضمام"}</button>
      <Msg state={state} />
    </form>
  );
}
