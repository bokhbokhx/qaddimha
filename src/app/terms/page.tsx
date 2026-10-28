import Link from "next/link";
export const metadata = { title: "شروط الاستخدام (مسودة)" };
export default function Terms() {
  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-12">
      <Link href="/" className="text-brand-700">← قدمها</Link>
      <div className="my-4 rounded-xl bg-warn-50 p-3 text-sm text-warn-700">مسودة أولية تحتاج مراجعة قانونية قبل الإطلاق.</div>
      <h1 className="text-2xl font-bold text-brand-900">شروط الاستخدام</h1>
      <ul className="mt-4 list-disc space-y-2 pe-5">
        <li>المنصة أداة مساعدة لإعداد طلبات الدعم. الجمعية مسؤولة عن صحة المحتوى والأرقام واعتمادها وتقديم الطلب بنفسها.</li>
        <li>لا تضمن المنصة قبول أي طلب ولا تقدّر احتمالية الفوز.</li>
        <li>الشراء يشمل مشروعًا واحدًا لدى جهة واحدة وفرصة واحدة، ضمن حدود الاستخدام المعلنة في صفحة الشراء. لا يوجد استخدام غير محدود.</li>
        <li>مراجعة الخبير إضافة مستقلة بنطاق موضح في صفحتها، ولا تشمل الكتابة نيابة عن الجمعية أو مدة إنجاز مضمونة.</li>
        <li>يُمنع رفع محتوى لا تملك حق استخدامه أو يحتوي بيانات شخصية دون أساس نظامي.</li>
      </ul>
    </main>
  );
}
