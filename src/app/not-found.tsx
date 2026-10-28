import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-md flex-1 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-brand-900">الصفحة غير موجودة</h1>
      <p className="mt-2 text-muted">قد تكون الصفحة حُذفت أو ليست لديك صلاحية الوصول إليها.</p>
      <Link href="/app" className="mt-6 inline-block text-brand-700 underline">العودة إلى الطلبات</Link>
    </main>
  );
}
