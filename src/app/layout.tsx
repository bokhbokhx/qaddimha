import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "قدمها — جهّز طلب دعم يعكس قدرات جمعيتك", template: "%s — قدمها" },
  description: "منصة تساعد الجمعيات غير الربحية على تجهيز طلب دعم متكامل لمنحة محددة، خطوة بخطوة.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:right-2 focus:z-50 focus:bg-white focus:px-3 focus:py-2 focus:rounded">
          انتقل إلى المحتوى
        </a>
        {children}
      </body>
    </html>
  );
}
