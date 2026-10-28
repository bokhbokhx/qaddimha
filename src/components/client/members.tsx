"use client";
import { useState } from "react";
import { btnClass, inputClass } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

const ROLES: [string, string][] = [["EDITOR", "محرر"], ["VIEWER", "قارئ"], ["OWNER", "مالك"]];

export function InviteForm({ invite }: { invite: (email: string, role: string) => Promise<Result<{ link: string }>> }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("EDITOR");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { pending, error, exec } = useAction();
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
        <label className="sr-only" htmlFor="inv-email">البريد</label>
        <input id="inv-email" type="email" dir="ltr" className={`${inputClass} text-left`} placeholder="email@example.org" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="sr-only" htmlFor="inv-role">الدور</label>
        <select id="inv-role" className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <button type="button" className={btnClass()} disabled={pending || !email} onClick={() => exec(() => invite(email, role), (d) => { setLink(d?.link ?? null); setEmail(""); setCopied(false); })}>
          {pending ? "جارٍ الإنشاء…" : "إنشاء دعوة"}
        </button>
      </div>
      <Feedback error={error} message={null} />
      {link && (
        <div role="status" className="rounded-xl bg-ok-50 p-3 text-sm text-ok-700">
          <div className="mb-1 font-bold">أُنشئت الدعوة. انسخ الرابط وأرسله للعضو بنفسك (يظهر مرة واحدة، صالح 7 أيام):</div>
          <div className="flex flex-wrap items-center gap-2">
            <code dir="ltr" className="break-all rounded bg-white px-2 py-1 text-xs text-ink">{link}</code>
            <button type="button" className={btnClass("secondary", "sm")} onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch { setCopied(false); } }}>{copied ? "نُسخ" : "نسخ"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoleSelect({ role, change, disabled }: { role: string; change: (r: string) => Promise<Result>; disabled?: boolean }) {
  const { pending, error, message, exec } = useAction();
  return (
    <div>
      <label className="sr-only" htmlFor={`role-${role}`}>الدور</label>
      <select className={`${inputClass} w-32 py-1`} defaultValue={role} disabled={disabled || pending} onChange={(e) => exec(() => change(e.target.value))}>
        {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <Feedback error={error} message={message} />
    </div>
  );
}
