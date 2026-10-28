import Link from "next/link";
import { btnClass } from "@/components/ui";

const STEPS = [
  ["عرّفنا بجمعيتك", "ارفع ملفاتك أو ابدأ بالبيانات الأساسية. نستخرج المعلومات ونطلب تأكيدك لكل منها مع مصدرها."],
  ["أضف فرصة التمويل", "ارفع دليل المنحة ونموذج التقديم أو الصق نصهما. نستخرج الشروط والأسئلة وحدودها."],
  ["تحقق من الأهلية", "نقارن كل شرط ببيانات جمعيتك: مستوفى، غير مستوفى، أو يحتاج تحققًا — دون افتراض."],
  ["طوّر فكرة المشروع", "حوار قصير موجّه مع إدخال منظم بجانبه، ينتهي بملخص فكرة تعتمده أنت."],
  ["ابنِ المشروع والميزانية", "أقسام ومؤشرات وخطة تنفيذ وميزانية بحسابات دقيقة، مع وسم كل رقم تقديري."],
  ["صدّر حزمة التقديم", "وثيقة المشروع والميزانية والإجابات وقائمة المتطلبات من نسخة معتمدة واحدة."],
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-2xl font-bold text-brand-900">قدمها</Link>
          <nav className="flex gap-2" aria-label="الحساب">
            <Link href="/login" className={btnClass("ghost", "sm")}>تسجيل الدخول</Link>
            <Link href="/signup" className={btnClass("primary", "sm")}>إنشاء حساب</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">
        <section className="bg-brand-900 text-white">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
            <p className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-gold-400">للجمعيات والمؤسسات غير الربحية في السعودية</p>
            <h1 className="max-w-3xl text-3xl font-bold leading-snug md:text-5xl md:leading-tight">جهّز طلب دعم يعكس قدرات جمعيتك</h1>
            <p className="mt-4 max-w-2xl text-lg text-brand-100">من بيانات جمعيتك إلى طلب دعم متكامل، خطوة بخطوة. أنت تعتمد المحتوى والأرقام وتقدّم الطلب بنفسك.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className={btnClass("gold")}>ابدأ طلبًا جديدًا</Link>
              <Link href="/login" className="inline-flex items-center rounded-lg border border-white/30 px-4 py-2.5 text-white hover:bg-white/10">جرّب الحساب التجريبي</Link>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="mb-8 text-2xl font-bold text-brand-900">كيف تعمل المنصة</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-line bg-white p-5">
                <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-900">{i + 1}</div>
                <h3 className="font-bold text-brand-900">{t}</h3>
                <p className="mt-1 text-sm text-muted">{d}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="border-y border-line bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 md:grid-cols-3">
            <div>
              <h3 className="font-bold text-brand-900">ما نعدك به</h3>
              <p className="mt-1 text-sm text-muted">طلب متسق: الأهداف والأنشطة والمؤشرات والميزانية والإجابات مترابطة، مع إظهار النواقص والعوائق بوضوح.</p>
            </div>
            <div>
              <h3 className="font-bold text-brand-900">ما لا نعد به</h3>
              <p className="mt-1 text-sm text-muted">لا نضمن القبول ولا نقدّر احتمالية الفوز. لا نختلق نتائج أو شراكات أو أرقامًا موثقة. لا نقدم الطلب نيابة عنك.</p>
            </div>
            <div>
              <h3 className="font-bold text-brand-900">التسعير</h3>
              <p className="mt-1 text-sm text-muted">رسم ثابت لكل طلب (مشروع واحد لدى جهة واحدة)، ومراجعة خبير اختيارية بإضافة مستقلة. لا عمولة على قيمة المنحة. الأسعار الحالية تجريبية.</p>
            </div>
          </div>
        </section>
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap justify-between gap-2 px-4 py-6 text-sm text-muted">
        <span>قدمها — نسخة أولى</span>
        <nav className="flex gap-4" aria-label="روابط قانونية">
          <Link href="/privacy" className="hover:underline">سياسة الخصوصية (مسودة)</Link>
          <Link href="/terms" className="hover:underline">شروط الاستخدام (مسودة)</Link>
        </nav>
      </footer>
    </div>
  );
}
