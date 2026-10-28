import { NextResponse } from "next/server";

/**
 * نقطة توسعة لمزود دفع حقيقي. غير مفعلة في هذه النسخة.
 * عند التفعيل: تحقق من التوقيع، ثم المبلغ والعملة والطلب، ثم استدعِ processPaymentEvent
 * (يمنع المعالجة المكررة عبر providerRef فريد). لا تعتمد على صفحة النجاح كدليل دفع.
 */
export async function POST() {
  return NextResponse.json({ error: "لا يوجد مزود دفع حقيقي مهيأ" }, { status: 501 });
}
