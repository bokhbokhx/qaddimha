import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession } from "@/lib/auth/session";
import { LoginForm } from "./form";

export const metadata = { title: "تسجيل الدخول" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await readSession()) redirect("/app");
  const sp = await props.searchParams;
  const showDemo = (process.env.APP_ENV ?? "development") !== "production";
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
      <h1 className="mt-6 text-xl font-bold">تسجيل الدخول</h1>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <LoginForm next={typeof sp.next === "string" ? sp.next : undefined} />
      </div>
      <p className="mt-4 text-sm text-muted">ليس لديك حساب؟ <Link href="/signup" className="text-brand-700 underline">أنشئ حسابًا</Link></p>
      {showDemo && (
        <div className="mt-6 rounded-xl bg-gold-100 p-4 text-sm text-gold-600">
          <div className="font-bold">حسابات تجريبية (بيئة التطوير فقط)</div>
          <ul className="mt-1 space-y-0.5">
            <li>مالك الجمعية التجريبية: <bdi dir="ltr">owner@demo.qaddimha.test</bdi></li>
            <li>قارئ: <bdi dir="ltr">viewer@demo.qaddimha.test</bdi></li>
            <li>خبير: <bdi dir="ltr">expert@demo.qaddimha.test</bdi></li>
            <li>مشغل المنصة: <bdi dir="ltr">admin@demo.qaddimha.test</bdi></li>
            <li>كلمة المرور: <bdi dir="ltr">Demo#Qaddimha2026</bdi></li>
          </ul>
        </div>
      )}
    </main>
  );
}
