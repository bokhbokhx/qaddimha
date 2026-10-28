"use client";
import { useActionState } from "react";
import { createOrganizationAction, type FormState } from "../actions/auth";
import { btnClass, inputClass } from "@/components/ui";

export function CreateOrgForm() {
  const [state, act, pending] = useActionState<FormState, FormData>(createOrganizationAction, undefined);
  return (
    <form action={act} className="space-y-4">
      <div>
        <label htmlFor="orgName" className="mb-1 block text-sm font-medium">اسم الجمعية</label>
        <input id="orgName" name="orgName" required minLength={3} className={inputClass} />
      </div>
      {state?.error && <p role="alert" className="text-sm text-danger-700">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btnClass()} w-full`}>{pending ? "جارٍ الإنشاء…" : "إنشاء الجمعية"}</button>
    </form>
  );
}
