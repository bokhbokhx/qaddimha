"use client";
import { useActionState } from "react";
import { loginAction, type FormState } from "../actions/auth";
import { btnClass, inputClass } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium">البريد الإلكتروني</label>
        <input id="email" name="email" type="email" required autoComplete="email" dir="ltr" className={`${inputClass} text-left`} />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium">كلمة المرور</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" dir="ltr" className={`${inputClass} text-left`} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnClass("primary")} w-full`}>{pending ? "جارٍ الدخول…" : "دخول"}</button>
    </form>
  );
}
