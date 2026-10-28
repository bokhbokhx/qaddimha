import Link from "next/link";
import { orgPageContext } from "@/lib/page-context";
import { isDemoAI } from "@/lib/env";
import { logoutAction } from "../actions/auth";
import { DemoBanner } from "@/components/ui";
import { OrgSwitcher } from "./org-switcher";

const ROLE: Record<string, string> = { OWNER: "مالك", EDITOR: "محرر", VIEWER: "قارئ" };

export default async function AppLayout({ children }: LayoutProps<"/app">) {
  const ctx = await orgPageContext();
  return (
    <div className="flex min-h-screen flex-col">
      {(isDemoAI() || ctx.org.isDemo) && <DemoBanner />}
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/app" className="text-xl font-bold text-brand-900">قدمها</Link>
            <nav aria-label="التنقل الرئيسي" className="flex gap-1 text-sm">
              <Link href="/app" className="rounded-lg px-3 py-1.5 hover:bg-brand-50">الطلبات</Link>
              <Link href="/app/organization" className="rounded-lg px-3 py-1.5 hover:bg-brand-50">ملف الجمعية</Link>
              <Link href="/app/organization/members" className="rounded-lg px-3 py-1.5 hover:bg-brand-50">الأعضاء</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <OrgSwitcher current={ctx.orgId} orgs={ctx.memberships.map((m) => ({ id: m.organizationId, name: m.organization.displayName }))} />
            <Link href="/app/account" className="text-muted hover:underline">{ctx.user.name} · {ROLE[ctx.membership.role]}</Link>
            <form action={logoutAction}><button type="submit" className="rounded-lg px-2 py-1 text-brand-700 hover:bg-brand-50">خروج</button></form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
