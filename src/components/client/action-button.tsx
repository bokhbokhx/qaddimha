"use client";
import { useRef } from "react";
import { btnClass, cx, type BtnVariant } from "../ui";
import { Feedback, useAction, type Result } from "./use-action";

/** زر ينفذ إجراءً خادميًا مربوطًا مسبقًا، مع تأكيد اختياري */
export function ActionButton({
  action, label, pendingLabel, variant = "primary", size = "md", confirm, className, disabled,
}: {
  action: () => Promise<Result | undefined>;
  label: string;
  pendingLabel?: string;
  variant?: BtnVariant;
  size?: "sm" | "md";
  confirm?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending, error, message, exec } = useAction();
  const dlg = useRef<HTMLDialogElement>(null);
  const go = () => exec(action);
  return (
    <span className="inline-block">
      <button type="button" disabled={pending || disabled} aria-busy={pending} aria-label={label} onClick={() => (confirm ? dlg.current?.showModal() : go())} className={cx(btnClass(variant, size), className)}>
        {pending ? pendingLabel ?? "جارٍ التنفيذ…" : label}
      </button>
      {confirm && (
        <dialog ref={dlg} className="m-auto max-w-md rounded-2xl p-6 text-right" aria-label="تأكيد">
          <p className="mb-4 text-ink">{confirm}</p>
          <div className="flex justify-start gap-2">
            <button type="button" className={btnClass(variant === "danger" ? "danger" : "primary", "sm")} onClick={() => { dlg.current?.close(); go(); }}>
              تأكيد
            </button>
            <button type="button" className={btnClass("secondary", "sm")} onClick={() => dlg.current?.close()} autoFocus>
              إلغاء
            </button>
          </div>
        </dialog>
      )}
      <Feedback error={error} message={message} />
    </span>
  );
}
