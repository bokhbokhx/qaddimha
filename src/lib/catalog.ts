// كتالوجات الحقول — مشتركة بين الخادم والواجهة.

export type FieldType = "text" | "longtext" | "list" | "results" | "documents";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  group: string;
  important?: boolean;
  hint?: string;
}

export const PROFILE_GROUPS = [
  { key: "identity", label: "الهوية النظامية" },
  { key: "direction", label: "التوجه والتخصص" },
  { key: "work", label: "البرامج والخبرة" },
  { key: "capacity", label: "القدرات والموارد" },
  { key: "contact", label: "التواصل" },
] as const;

export const PROFILE_FIELDS: FieldDef[] = [
  { key: "legal_name", label: "الاسم القانوني", type: "text", group: "identity", important: true },
  { key: "display_name", label: "اسم العرض", type: "text", group: "identity" },
  { key: "entity_type", label: "نوع الكيان", type: "text", group: "identity", important: true, hint: "مثال: جمعية أهلية، مؤسسة أهلية، جمعية تعاونية" },
  { key: "registration_number", label: "رقم التسجيل", type: "text", group: "identity", important: true },
  { key: "supervising_body", label: "الجهة المشرفة", type: "text", group: "identity" },
  { key: "vision", label: "الرؤية", type: "longtext", group: "direction" },
  { key: "mission", label: "الرسالة", type: "longtext", group: "direction", important: true },
  { key: "goals", label: "الأهداف", type: "list", group: "direction" },
  { key: "specializations", label: "التخصصات", type: "list", group: "direction", important: true },
  { key: "geographic_scope", label: "النطاق الجغرافي", type: "list", group: "direction", important: true },
  { key: "target_groups", label: "الفئات المستهدفة", type: "list", group: "direction", important: true },
  { key: "current_programs", label: "البرامج الحالية", type: "list", group: "work" },
  { key: "past_projects", label: "المشاريع السابقة", type: "list", group: "work" },
  { key: "past_results", label: "نتائج سابقة (مع المصدر والفترة)", type: "results", group: "work", hint: "كل نتيجة تحتاج مصدرًا وفترة زمنية" },
  { key: "team", label: "الفريق", type: "longtext", group: "capacity" },
  { key: "operating_capacity", label: "قدرات التشغيل والطاقة الاستيعابية", type: "longtext", group: "capacity" },
  { key: "confirmed_partnerships", label: "الشراكات المؤكدة", type: "list", group: "capacity", hint: "أدرج فقط الشراكات القائمة فعلًا" },
  { key: "available_resources", label: "الموارد المتاحة", type: "list", group: "capacity" },
  { key: "contact_email", label: "البريد المعتمد", type: "text", group: "contact" },
  { key: "contact_phone", label: "الهاتف المعتمد", type: "text", group: "contact" },
  { key: "website", label: "الموقع الإلكتروني", type: "text", group: "contact" },
];

export const OPPORTUNITY_GROUPS = [
  { key: "basics", label: "التعريف بالمنحة" },
  { key: "eligibility", label: "الأهلية" },
  { key: "funding", label: "التمويل والتكاليف" },
  { key: "process", label: "المواعيد والتقديم" },
] as const;

export const OPPORTUNITY_FIELDS: FieldDef[] = [
  { key: "funder", label: "الجهة المانحة", type: "text", group: "basics", important: true },
  { key: "grant_name", label: "اسم المنحة", type: "text", group: "basics", important: true },
  { key: "description", label: "الوصف", type: "longtext", group: "basics" },
  { key: "focus_areas", label: "محاور الدعم", type: "list", group: "basics", important: true },
  { key: "objectives", label: "أهداف المنحة", type: "list", group: "basics" },
  { key: "eligible_entities", label: "الكيانات المؤهلة", type: "list", group: "eligibility", important: true },
  { key: "eligible_regions", label: "المناطق المؤهلة", type: "list", group: "eligibility", important: true },
  { key: "eligible_groups", label: "الفئات المستهدفة المؤهلة", type: "list", group: "eligibility" },
  { key: "funding_max", label: "الحد الأعلى للتمويل (ر.س)", type: "text", group: "funding", important: true },
  { key: "funding_min", label: "الحد الأدنى للتمويل (ر.س)", type: "text", group: "funding" },
  { key: "duration_max_months", label: "أقصى مدة (بالأشهر)", type: "text", group: "funding" },
  { key: "allowed_costs", label: "التكاليف المسموحة", type: "list", group: "funding" },
  { key: "excluded_costs", label: "التكاليف المستبعدة", type: "list", group: "funding", important: true },
  { key: "cofunding", label: "التمويل المشترك أو المساهمة المطلوبة", type: "text", group: "funding" },
  { key: "deadlines", label: "التواريخ والمواعيد", type: "list", group: "process", important: true },
  { key: "timezone", label: "المنطقة الزمنية للمواعيد", type: "text", group: "process" },
  { key: "evaluation_criteria", label: "معايير التقييم المعلنة", type: "list", group: "process" },
  { key: "required_documents", label: "المستندات المطلوبة", type: "list", group: "process", important: true },
  { key: "submission_method", label: "طريقة التقديم", type: "text", group: "process" },
];

export interface SectionDef {
  key: string;
  label: string;
  hint: string;
}

export const SECTIONS: SectionDef[] = [
  { key: "summary", label: "الملخص التنفيذي", hint: "اسم المشروع وفكرته والمستفيدون والمدة والأثر المتوقع في فقرة أو فقرتين." },
  { key: "problem", label: "المشكلة ومبررات التدخل والأدلة", hint: "اذكر المشكلة ودليل الحاجة مع مصدره. لا تضف إحصاءات بلا مصدر." },
  { key: "objectives", label: "الأهداف المحددة القابلة للقياس", hint: "أهداف محددة وقابلة للقياس ومرتبطة بمدة المشروع." },
  { key: "target_group", label: "الفئة المستهدفة وشروط الاختيار", hint: "من هم المستفيدون، وعددهم، وكيف يُختارون." },
  { key: "scope", label: "نطاق التنفيذ والأنشطة والمخرجات", hint: "المنطقة والأنشطة الرئيسية والمخرجات المباشرة." },
  { key: "outcomes", label: "النتائج المستهدفة", hint: "ميّز بين النتائج (التغيير المتوقع) والمخرجات (ما يُنتَج)." },
  { key: "team", label: "الفريق والموارد", hint: "الأدوار والمسؤوليات والموارد المتاحة للتنفيذ." },
  { key: "risks", label: "المخاطر والمعالجة", hint: "أهم المخاطر واحتماليتها وطريقة معالجتها." },
  { key: "sustainability", label: "الاستدامة بعد انتهاء الدعم", hint: "كيف يستمر الأثر بعد الدعم، دون افتراض عوائد تجارية." },
  { key: "assumptions", label: "الافتراضات والنقاط التي تحتاج اعتمادًا", hint: "كل افتراض أو رقم تقديري يحتاج اعتماد الجمعية." },
];

export const SECTION_LABEL: Record<string, string> = Object.fromEntries(SECTIONS.map((s) => [s.key, s.label]));

export const STAGES = [
  { key: "OPPORTUNITY", label: "أضف فرصة التمويل", path: "opportunity" },
  { key: "EXTRACTION_REVIEW", label: "راجع ما استخرجناه", path: "extraction" },
  { key: "ELIGIBILITY", label: "الأهلية والمتطلبات", path: "eligibility" },
  { key: "IDEA", label: "طوّر فكرة المشروع", path: "idea" },
  { key: "PROJECT", label: "محرر المشروع", path: "project" },
  { key: "BUDGET", label: "راجع الميزانية", path: "budget" },
  { key: "ANSWERS", label: "إجابات نموذج الجهة", path: "answers" },
  { key: "READINESS", label: "تحقق من جاهزية الطلب", path: "readiness" },
  { key: "EXPORT", label: "صدّر حزمة التقديم", path: "export" },
] as const;

export const DOCUMENT_KIND_LABEL: Record<string, string> = {
  ORG_DOC: "مستند عام للجمعية",
  ORG_LICENSE: "شهادة التسجيل أو الترخيص",
  ORG_FINANCIAL: "قوائم مالية",
  ORG_PROFILE_DECK: "الملف التعريفي",
  LOGO: "الشعار",
  GRANT_GUIDE: "دليل المنحة",
  GRANT_FORM: "نموذج التقديم",
  BUDGET_SHEET: "ملف ميزانية",
  PARTNER_EVIDENCE: "إثبات شراكة",
  OTHER: "أخرى",
};

export const FACT_STATUS_LABEL: Record<string, string> = {
  EXTRACTED_UNCONFIRMED: "مستخرجة — تحتاج تأكيدًا",
  CONFIRMED: "مؤكدة",
  MISSING: "ناقصة",
  CONFLICT: "متعارضة — تحتاج حسمًا",
};

export const ASSESSMENT_LABEL: Record<string, string> = {
  MET: "مستوفى",
  NOT_MET: "غير مستوفى",
  NEEDS_VERIFICATION: "يحتاج تحققًا",
};

export const CATEGORY_LABEL: Record<string, string> = {
  ORG_ELIGIBILITY: "أهلية الجمعية",
  PROJECT_FIT: "ملاءمة المشروع",
  DOCUMENT: "المستندات",
  BUDGET: "الاشتراطات المالية",
  SUBMISSION: "اكتمال الطلب",
};

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  NEW: "طلب جديد",
  IN_REVIEW: "قيد المراجعة",
  NEEDS_INFO: "يحتاج معلومات",
  COMPLETED: "مكتمل",
};

export const PARTNER_STATUS_LABEL: Record<string, string> = {
  PROPOSED: "مقترح",
  NEGOTIATING: "جارٍ التفاوض",
  CONFIRMED: "مؤكد",
};

export const FUNDING_SOURCE_LABEL: Record<string, string> = { DONOR: "المانح", SELF: "الجمعية", PARTNER: "شريك" };
export const CONTRIBUTION_LABEL: Record<string, string> = { CASH: "نقدي", IN_KIND: "عيني" };

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار الدفع",
  PAID: "مدفوع",
  FAILED: "فشل الدفع",
  CANCELLED: "ملغى",
};

export function valueToText(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v))
    return v
      .map((x) => (typeof x === "object" && x ? Object.values(x as Record<string, unknown>).filter(Boolean).join(" — ") : String(x)))
      .join("، ");
  if (typeof v === "object") return Object.values(v as Record<string, unknown>).filter(Boolean).join(" — ");
  return String(v);
}
