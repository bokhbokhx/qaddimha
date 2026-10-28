import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/guard";
import { CreateOrgForm } from "./form";
import { logoutAction } from "../actions/auth";

export const metadata = { title: "لا توجد جمعية" };

export default async function NoOrg() {
  const { user } = await requireUserPage();
  if (await db.membership.findFirst({ where: { userId: user.id } })) redirect("/app");
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
      <h1 className="mt-6 text-xl font-bold">حسابك غير مرتبط بأي جمعية</h1>
      <p className="mt-1 text-sm text-muted">إذا وصلتك دعوة فافتح رابطها، أو أنشئ مساحة لجمعيتك.</p>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6"><CreateOrgForm /></div>
      <form action={logoutAction} className="mt-4"><button type="submit" className="text-sm text-brand-700 underline">تسجيل الخروج</button></form>
    </main>
  );
}
