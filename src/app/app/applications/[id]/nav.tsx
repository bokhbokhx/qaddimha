"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function WorkspaceNav({ id, items }: { id: string; items: { path: string; label: string }[] }) {
  const pathname = usePathname();
  const base = `/app/applications/${id}`;
  return (
    <nav aria-label="أقسام الطلب" className="rounded-2xl border border-line bg-white p-2">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        <li>
          <Link href={base} aria-current={pathname === base ? "page" : undefined} className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${pathname === base ? "bg-brand-900 text-white" : "hover:bg-brand-50"}`}>
            نظرة عامة
          </Link>
        </li>
        {items.map((it, i) => {
          const href = `${base}/${it.path}`;
          const active = pathname === href;
          return (
            <li key={it.path}>
              <Link href={href} aria-current={active ? "page" : undefined} className={`block whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-brand-900 text-white" : "hover:bg-brand-50"}`}>
                {i < 9 && <span className="tabular me-2 inline-block w-4 opacity-60">{i + 1}</span>}{it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
