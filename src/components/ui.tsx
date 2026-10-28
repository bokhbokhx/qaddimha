import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

const BTN = {
  primary: "bg-brand-900 text-white hover:bg-brand-800 disabled:bg-brand-200",
  secondary: "bg-white text-brand-900 border border-brand-200 hover:bg-brand-50 disabled:text-muted",
  gold: "bg-gold-400 text-brand-900 hover:bg-[#c9a24c]",
  danger: "bg-white text-danger-700 border border-[#e6bdb5] hover:bg-danger-50",
  ghost: "text-brand-900 hover:bg-brand-50",
} as const;

export type BtnVariant = keyof typeof BTN;

export function btnClass(variant: BtnVariant = "primary", size: "sm" | "md" = "md") {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
    size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5",
    BTN[variant],
  );
}

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <button {...p} className={cx(btnClass(variant, size), className)} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: BtnVariant; size?: "sm" | "md" }) {
  return <Link {...p} className={cx(btnClass(variant, size), className)} />;
}

export function Card({ className, children, ...p }: ComponentProps<"section">) {
  return (
    <section {...p} className={cx("rounded-2xl border border-line bg-card p-5 shadow-[0_1px_2px_rgba(15,61,46,.04)]", className)}>
      {children}
    </section>
  );
}

const TONES = {
  neutral: "bg-[#efece4] text-ink",
  ok: "bg-ok-50 text-ok-700",
  warn: "bg-warn-50 text-warn-700",
  danger: "bg-danger-50 text-danger-700",
  brand: "bg-brand-50 text-brand-800",
  gold: "bg-gold-100 text-gold-600",
} as const;

export type Tone = keyof typeof TONES;

export function Badge({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span title={title} className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">{title}</h1>
        {description && <div className="mt-1 max-w-3xl text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Notice({ tone = "brand", title, children }: { tone?: Tone; title?: string; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cx("rounded-xl px-4 py-3 text-sm", TONES[tone])}>
      {title && <div className="mb-0.5 font-bold">{title}</div>}
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-white/60 p-8 text-center">
      <div className="font-bold text-brand-900">{title}</div>
      {children && <div className="mx-auto mt-1 max-w-md text-sm text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-white px-3 py-2 text-ink placeholder:text-[#9aa49f] focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-100";

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && <div className="text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function DemoBanner() {
  return (
    <div className="bg-gold-100 px-4 py-1.5 text-center text-sm text-gold-600" role="note">
      <strong>وضع تجريبي:</strong> المساعد يستخدم بيانات معدّة مسبقًا ولا يحلل الملفات العشوائية. البيانات التجريبية غير حقيقية.
    </div>
  );
}
