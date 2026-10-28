"use client";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md flex-1 px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-brand-900">حدث خطأ غير متوقع</h1>
      <p className="mt-2 text-muted">لم تُفقد بياناتك المحفوظة. حاول مرة أخرى.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-lg bg-brand-900 px-4 py-2 text-white">إعادة المحاولة</button>
    </main>
  );
}
