// إعدادات تسعير قابلة للتغيير. القيم الحالية بيانات تجريبية وليست تسعيرًا معتمدًا.
export const PRICING_IS_DEMO = true;

export const PRICING = {
  APPLICATION_PACKAGE: {
    name: "حزمة طلب دعم",
    amountHalalas: BigInt(process.env.PRICE_PACKAGE_HALALAS ?? "149000"), // 1,490 ر.س (تجريبي)
    scope: [
      "مشروع واحد لدى جهة مانحة واحدة وفرصة تمويل واحدة",
      "تصدير نهائي بلا وسم «مسودة» عند اكتمال الجاهزية: وثيقة المشروع PDF وDOCX، الميزانية XLSX، إجابات النموذج، قائمة المتطلبات، الملخص التنفيذي، وحزمة ZIP",
      "حتى 150 عملية مساعد ذكي على هذا الطلب",
      "حتى 10 نسخ معتمدة",
    ],
    excludes: ["التقديم نيابةً عن الجمعية", "ضمان القبول أو أي نسبة احتمالية للفوز", "مراجعة الخبير (إضافة مستقلة)"],
  },
  EXPERT_REVIEW: {
    name: "مراجعة خبير",
    amountHalalas: BigInt(process.env.PRICE_REVIEW_HALALAS ?? "90000"), // 900 ر.س (تجريبي)
    scope: [
      "قراءة نسخة محددة من الطلب تختارها الجمعية",
      "ملاحظات مكتوبة مرتبطة بأقسام المشروع والميزانية والإجابات",
      "جولة توضيح واحدة عند الحاجة لمعلومات",
    ],
    excludes: [
      "إعادة كتابة الطلب أو تعديله مباشرة",
      "اعتماد المحتوى نيابةً عن الجمعية",
      "مراجعة التعديلات التي تتم بعد تسليم النسخة",
      "مدة إنجاز مضمونة — الخدمة تُشغَّل يدويًا في هذه المرحلة",
    ],
  },
} as const;

export const LIMITS = {
  aiActionsPerApplication: 150,
  aiActionsBeforePurchase: 60,
  approvedRevisionsPerApplication: 10,
};

export function pricingSnapshot(product: keyof typeof PRICING) {
  const p = PRICING[product];
  return {
    product,
    name: p.name,
    amountHalalas: p.amountHalalas.toString(),
    currency: "SAR",
    scope: [...p.scope],
    excludes: [...p.excludes],
    isDemoPricing: PRICING_IS_DEMO,
    limits: LIMITS,
  };
}
