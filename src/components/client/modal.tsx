"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** نافذة حوار أصلية (dialog) — تدعم Esc والتركيز ولوحة المفاتيح */
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="modal-title" className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl p-0 text-right shadow-xl`}>
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 id="modal-title" className="font-bold text-brand-900">{title}</h2>
        <button type="button" onClick={onClose} className="rounded p-1 text-muted hover:bg-brand-50" aria-label="إغلاق">✕</button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-5">{open && children}</div>
    </dialog>
  );
}
