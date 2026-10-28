import Link from "next/link";
import { SignupForm } from "./form";

export const metadata = { title: "إنشاء حساب" };

export default function SignupPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
      <h1 className="mt-6 text-xl font-bold">أنشئ حساب جمعيتك</h1>
      <p className="mt-1 text-sm text-muted">تصبح مالك مساحة عمل الجمعية، ويمكنك لاحقًا إضافة محررين وقراء.</p>
      <div className="mt-6 rounded-2xl border border-line bg-white p-6"><SignupForm /></div>
      <p className="mt-4 text-sm text-muted">لديك حساب؟ <Link href="/login" className="text-brand-700 underline">سجّل الدخول</Link></p>
    </main>
  );
}
