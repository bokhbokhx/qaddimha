"use client";
import { useState, useTransition } from "react";
import { btnClass } from "@/components/ui";
import { acceptInviteAction } from "../../actions/auth";

export function AcceptInvite({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button type="button" className={`${btnClass()} w-full`} disabled={pending} onClick={() => start(async () => { const r = await acceptInviteAction(token); if (r?.error) setError(r.error); })}>
        {pending ? "جارٍ الانضمام…" : "قبول الدعوة"}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-danger-700">{error}</p>}
    </div>
  );
}
