"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DOCUMENT_KIND_LABEL } from "@/lib/catalog";
import { btnClass, inputClass } from "../ui";

/** رفع ملف عبر واجهة خادمية تتحقق من النوع والحجم فعليًا */
export function UploadForm({
  kinds, applicationId, defaultKind, accept, hint, onUploaded, compact,
}: {
  kinds: string[];
  applicationId?: string;
  defaultKind?: string;
  accept?: string;
  hint?: string;
  onUploaded?: (id: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setDone(null);
    const fd = new FormData(e.currentTarget);
    if (!(fd.get("file") as File)?.size) return setError("اختر ملفًا أولًا");
    if (applicationId) fd.set("applicationId", applicationId);
    setBusy(true);
    try {
      const res = await fetch("/api/documents", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error ?? "تعذر رفع الملف");
      else {
        setDone(j.status === "FAILED" ? `رُفع الملف لكن تعذر استخراج نصه: ${j.extractionError}` : "رُفع الملف واستُخرج نصه");
        form.current?.reset();
        onUploaded?.(j.id);
        router.refresh();
      }
    } catch {
      setError("انقطع الاتصال أثناء الرفع. حاول مجددًا.");
    } finally {
      setBusy(false);
    }
  }

  const uid = applicationId ?? "org";
  return (
    <form ref={form} onSubmit={submit} className={compact ? "space-y-2" : "space-y-3"}>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor={`file-${uid}`}>الملف</label>
          <input id={`file-${uid}`} name="file" type="file" accept={accept ?? ".pdf,.docx,.txt,.xlsx"} className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-brand-900" />
        </div>
        {kinds.length > 1 ? (
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor={`kind-${uid}`}>نوع المستند</label>
            <select id={`kind-${uid}`} name="kind" defaultValue={defaultKind ?? kinds[0]} className={inputClass}>
              {kinds.map((k) => <option key={k} value={k}>{DOCUMENT_KIND_LABEL[k]}</option>)}
            </select>
          </div>
        ) : (
          <input type="hidden" name="kind" value={kinds[0]} />
        )}
        {!compact && (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor={`label-${uid}`}>وصف مختصر (اختياري)</label>
              <input id={`label-${uid}`} name="label" className={inputClass} placeholder="مثال: خطاب تعهد بالمساهمة" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor={`exp-${uid}`}>تاريخ الانتهاء (إن وجد)</label>
              <input id={`exp-${uid}`} name="expiresOn" type="date" className={inputClass} />
            </div>
          </>
        )}
      </div>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <button type="submit" disabled={busy} className={btnClass("primary", "sm")} aria-busy={busy}>
        {busy ? "جارٍ الرفع والاستخراج…" : "رفع الملف"}
      </button>
      <div aria-live="polite" className="text-sm">
        {error && <span className="text-danger-700" role="alert">{error}</span>}
        {done && <span className={done.startsWith("رُفع الملف لكن") ? "text-warn-700" : "text-ok-700"}>{done}</span>}
      </div>
    </form>
  );
}
