import Link from "next/link";
import { ForgotForm } from "@/components/client/auth-forms";
import { forgotPasswordAction } from "../actions/auth";

export const metadata = { title: "نسيت كلمة المرور" };

export default function ForgotPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
      <h1 className="mt-6 text-xl font-bold">نسيت كلمة المرور</h1>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6"><ForgotForm action={forgotPasswordAction} /></div>
      <p className="mt-4 text-sm"><Link href="/login" className="text-brand-700 underline">العودة لتسجيل الدخول</Link></p>
    </main>
  );
}
