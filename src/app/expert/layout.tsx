import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/auth/guard";
import { logoutAction } from "../actions/auth";

export default async function ExpertLayout({ children }: LayoutProps<"/expert">) {
  const { user } = await requireUserPage();
  if (user.platformRole !== "EXPERT") redirect("/app");
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/expert" className="text-xl font-bold text-brand-900">قدمها <span className="text-sm font-normal text-muted">— بوابة الخبير</span></Link>
          <div className="flex items-center gap-3 text-sm"><span className="text-muted">{user.name}</span><form action={logoutAction}><button type="submit" className="text-brand-700">خروج</button></form></div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
