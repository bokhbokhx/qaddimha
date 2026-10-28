// بيانات منظمة معدّة مسبقًا للوضع التجريبي — لا تحليل عشوائي.
import type { BudgetSuggestion, DraftProject, OpportunityExtraction, OrgExtraction } from "@/lib/ai/schemas";

const f = (key: string, v: { text?: string; items?: string[]; results?: { text: string; source: string | null; period: string | null }[] }, excerpt: string) => ({
  key, text: v.text ?? null, items: v.items ?? null, results: v.results ?? null, locator: null, excerpt,
});

export const ORG_EXTRACTION: OrgExtraction = {
  fields: [
    f("legal_name", { text: "جمعية أثر للتنمية المجتمعية" }, "الاسم القانوني: جمعية أثر للتنمية المجتمعية"),
    f("entity_type", { text: "جمعية أهلية" }, "نوع الكيان: جمعية أهلية"),
    f("registration_number", { text: "0000-تجريبي" }, "رقم التسجيل: 0000-تجريبي"),
    f("vision", { text: "مجتمع شاب منتج ومبادر." }, "الرؤية: مجتمع شاب منتج ومبادر."),
    f("mission", { text: "تمكين الشباب في منطقة الرياض بالمهارات والفرص عبر برامج تدريبية وتطوعية بالشراكة مع المجتمع." }, "الرسالة: تمكين الشباب في منطقة الرياض"),
    f("specializations", { items: ["تنمية الشباب", "التدريب على المهارات", "التطوع"] }, "التخصصات: تنمية الشباب، التدريب على المهارات، التطوع."),
    f("geographic_scope", { items: ["منطقة الرياض"] }, "النطاق الجغرافي: منطقة الرياض."),
    f("target_groups", { items: ["الشباب", "الباحثون عن عمل"] }, "الفئات المستهدفة: الشباب، الباحثون عن عمل."),
    f("current_programs", { items: ["برنامج «مهارتي» للتدريب الرقمي منذ 2022", "برنامج «سواعد» للتطوع منذ 2021"] }, "البرامج الحالية: برنامج «مهارتي» للتدريب الرقمي منذ 2022"),
    f("past_projects", { items: ["مشروع «جاهز» للتهيئة الوظيفية 2023–2024"] }, "المشاريع السابقة: مشروع «جاهز» للتهيئة الوظيفية 2023–2024."),
    f(
      "past_results",
      {
        results: [
          { text: "تدريب 320 شابًا وشابة في برنامج مهارتي", source: "التقرير السنوي للبرنامج", period: "عام 2024" },
          { text: "رضا المستفيدين عن البرامج مرتفع", source: null, period: null },
        ],
      },
      "نتائج سابقة: تدريب 320 شابًا وشابة في برنامج مهارتي خلال عام 2024",
    ),
    f("team", { text: "مدير تنفيذي، منسقا برامج، محاسب بدوام جزئي، و25 متطوعًا نشطًا." }, "الفريق: مدير تنفيذي، منسقا برامج"),
    f("operating_capacity", { text: "قاعتا تدريب بسعة 30 متدربًا لكل قاعة، وإمكانية تشغيل 4 دفعات تدريبية في السنة." }, "الطاقة الاستيعابية: قاعتا تدريب بسعة 30 متدربًا لكل قاعة"),
    f("available_resources", { items: ["قاعتا تدريب مجهزتان", "أجهزة حاسب محمولة عدد 20"] }, "الموارد المتاحة: قاعتا تدريب مجهزتان"),
    f("contact_email", { text: "info@athar-demo.test" }, "البريد المعتمد: info@athar-demo.test"),
  ],
  notes: ["نتيجة «رضا المستفيدين مرتفع» لا يذكر الملف مصدرها أو فترتها؛ لا تستخدمها في الطلب قبل توثيقها.", "لم يذكر الملف الجهة المشرفة ولا رقم الهاتف."],
};

const nullParams = { allowed: null, maxSar: null, maxMonths: null, minPct: null, countInKind: null, documentKind: null, labelKeyword: null, keywords: null };

export const GRANT_EXTRACTION: OpportunityExtraction = {
  fields: [
    f("funder", { text: "صندوق الأثر التجريبي للتنمية (جهة وهمية)" }, "الجهة المانحة: صندوق الأثر التجريبي للتنمية (جهة وهمية)."),
    f("grant_name", { text: "منحة تمكين المجتمع — تجريبية" }, "دليل منحة تمكين المجتمع — تجريبية"),
    f("description", { text: "دعم مشاريع الجمعيات الأهلية التي تمكّن الشباب من اكتساب المهارات الرقمية وفرص العمل والتطوع." }, "تهدف منحة تمكين المجتمع إلى دعم مشاريع الجمعيات الأهلية"),
    f("focus_areas", { items: ["المهارات الرقمية للشباب", "التهيئة لسوق العمل", "العمل التطوعي المجتمعي"] }, "محاور الدعم: المهارات الرقمية للشباب، التهيئة لسوق العمل، العمل التطوعي المجتمعي."),
    f("eligible_entities", { items: ["الجمعيات الأهلية", "المؤسسات الأهلية"] }, "الكيانات المؤهلة: الجمعيات الأهلية والمؤسسات الأهلية المسجلة لدى الجهة المشرفة."),
    f("eligible_regions", { items: ["منطقة الرياض", "منطقة القصيم"] }, "المناطق المؤهلة: منطقة الرياض ومنطقة القصيم."),
    f("eligible_groups", { items: ["الشباب من عمر 18 إلى 29 عامًا"] }, "الفئات المستهدفة: الشباب من عمر 18 إلى 29 عامًا."),
    f("funding_max", { text: "500000" }, "الحد الأعلى للدعم 500,000 ريال سعودي للمشروع الواحد"),
    f("funding_min", { text: "100000" }, "والحد الأدنى 100,000 ريال."),
    f("duration_max_months", { text: "12" }, "أقصى مدة للتنفيذ 12 شهرًا."),
    f("allowed_costs", { items: ["أجور المدربين", "المواد التدريبية", "المنصات الرقمية", "التنقل المرتبط بالأنشطة", "التقييم والقياس"] }, "التكاليف المسموحة: أجور المدربين"),
    f("excluded_costs", { items: ["شراء الأراضي أو المباني", "الضيافة والولائم", "الرواتب الثابتة للإدارة العليا"] }, "التكاليف المستبعدة: شراء الأراضي أو المباني، الضيافة والولائم، الرواتب الثابتة للإدارة العليا."),
    f("cofunding", { text: "مساهمة ذاتية أو من الشركاء لا تقل عن 10% من إجمالي التكلفة، نقدية أو عينية" }, "يشترط ألا تقل المساهمة الذاتية أو مساهمة الشركاء عن 10% من إجمالي تكلفة المشروع"),
    f("deadlines", { items: ["آخر موعد لاستلام الطلبات: 31 يناير 2027، 11:59 مساءً", "إعلان النتائج خلال 60 يومًا من الإغلاق"] }, "آخر موعد لاستلام الطلبات 31 يناير 2027 الساعة 11:59 مساءً بتوقيت الرياض."),
    f("timezone", { text: "بتوقيت الرياض (Asia/Riyadh)" }, "بتوقيت الرياض"),
    f("evaluation_criteria", { items: ["وضوح الحاجة ودليلها 25%", "الأثر القابل للقياس 30%", "الكفاءة المالية 20%", "القدرة التنفيذية 15%", "الاستدامة 10%"] }, "وضوح الحاجة ودليلها 25%"),
    f("required_documents", { items: ["شهادة تسجيل سارية", "آخر قوائم مالية مدققة", "خطاب تعهد بالمساهمة الذاتية"] }, "شهادة تسجيل سارية، آخر قوائم مالية مدققة، خطاب تعهد بالمساهمة الذاتية."),
    f("submission_method", { text: "عبر البوابة الإلكترونية للصندوق بعد تعبئة النموذج وإرفاق المستندات" }, "طريقة التقديم: عبر البوابة الإلكترونية للصندوق"),
  ],
  requirements: [
    { code: "ش1", category: "ORG_ELIGIBILITY", text: "أن تكون الجهة جمعية أهلية أو مؤسسة أهلية مسجلة", mandatory: true, rule: "ENTITY_TYPE", params: { ...nullParams, allowed: ["جمعية أهلية", "مؤسسة أهلية"] }, locator: null, excerpt: "الكيانات المؤهلة: الجمعيات الأهلية والمؤسسات الأهلية المسجلة" },
    { code: "ش2", category: "ORG_ELIGIBILITY", text: "أن يُنفذ المشروع في منطقة الرياض أو منطقة القصيم", mandatory: true, rule: "REGION", params: { ...nullParams, allowed: ["الرياض", "القصيم"] }, locator: null, excerpt: "المناطق المؤهلة: منطقة الرياض ومنطقة القصيم." },
    { code: "ش3", category: "ORG_ELIGIBILITY", text: "خبرة لا تقل عن سنتين في تنفيذ برامج موجهة للشباب", mandatory: true, rule: "MANUAL", params: nullParams, locator: null, excerpt: "يشترط أن تكون للجمعية خبرة لا تقل عن سنتين في تنفيذ برامج موجهة للشباب." },
    { code: "ش4", category: "PROJECT_FIT", text: "أن يقع المشروع ضمن أحد محاور الدعم المعلنة", mandatory: true, rule: "MANUAL", params: nullParams, locator: null, excerpt: "يشترط أن يقع المشروع ضمن أحد محاور الدعم المعلنة." },
    { code: "ش5", category: "PROJECT_FIT", text: "أن يستهدف المشروع الشباب", mandatory: true, rule: "TARGET_GROUP", params: { ...nullParams, allowed: ["الشباب"] }, locator: null, excerpt: "الفئات المستهدفة: الشباب من عمر 18 إلى 29 عامًا." },
    { code: "م1", category: "DOCUMENT", text: "شهادة تسجيل سارية", mandatory: true, rule: "DOCUMENT_PRESENT", params: { ...nullParams, documentKind: "ORG_LICENSE" }, locator: null, excerpt: "شهادة تسجيل سارية" },
    { code: "م2", category: "DOCUMENT", text: "آخر قوائم مالية مدققة", mandatory: true, rule: "DOCUMENT_PRESENT", params: { ...nullParams, documentKind: "ORG_FINANCIAL" }, locator: null, excerpt: "آخر قوائم مالية مدققة" },
    { code: "م3", category: "DOCUMENT", text: "خطاب تعهد بالمساهمة الذاتية", mandatory: true, rule: "DOCUMENT_PRESENT", params: { ...nullParams, documentKind: "ORG_DOC", labelKeyword: "تعهد" }, locator: null, excerpt: "خطاب تعهد بالمساهمة الذاتية" },
    { code: "ت1", category: "BUDGET", text: "ألا يتجاوز المطلوب من المانح 500,000 ريال", mandatory: true, rule: "BUDGET_CAP", params: { ...nullParams, maxSar: 500000 }, locator: null, excerpt: "الحد الأعلى للدعم 500,000 ريال سعودي للمشروع الواحد" },
    { code: "ت2", category: "BUDGET", text: "ألا تتجاوز مدة التنفيذ 12 شهرًا", mandatory: true, rule: "DURATION_MAX", params: { ...nullParams, maxMonths: 12 }, locator: null, excerpt: "أقصى مدة للتنفيذ 12 شهرًا." },
    { code: "ت3", category: "BUDGET", text: "مساهمة ذاتية أو من الشركاء لا تقل عن 10% (نقدية أو عينية)", mandatory: true, rule: "COFUNDING_MIN", params: { ...nullParams, minPct: 10, countInKind: true }, locator: null, excerpt: "يشترط ألا تقل المساهمة الذاتية أو مساهمة الشركاء عن 10% من إجمالي تكلفة المشروع" },
    { code: "ت4", category: "BUDGET", text: "عدم تمويل التكاليف المستبعدة من المنحة", mandatory: true, rule: "EXCLUDED_COSTS", params: { ...nullParams, keywords: ["أراضي", "مباني", "ضيافة", "ولائم", "رواتب الإدارة العليا"] }, locator: null, excerpt: "التكاليف المستبعدة: شراء الأراضي أو المباني، الضيافة والولائم" },
  ],
  questions: [
    { text: "صف المشروع باختصار", type: "TEXT", mandatory: true, limitType: "WORDS", limitValue: 150, linkedSections: ["summary", "scope"], locator: null },
    { text: "كيف ستقيسون أثر المشروع؟", type: "TEXT", mandatory: true, limitType: "CHARS", limitValue: 1000, linkedSections: ["outcomes", "objectives"], locator: null },
    { text: "ما خطة استدامة المشروع بعد انتهاء الدعم؟", type: "TEXT", mandatory: true, limitType: "WORDS", limitValue: 200, linkedSections: ["sustainability"], locator: null },
    { text: "اذكر أي شراكات قائمة أو مخطط لها", type: "TEXT", mandatory: false, limitType: "NONE", limitValue: null, linkedSections: ["team"], locator: null },
  ],
  conflicts: [],
  notes: ["الرابط المرجعي (إن أضفته) لم تتم قراءته؛ الاستخراج من الملف المرفوع فقط."],
};

export const GRANT_UPDATE_EXTRACTION: OpportunityExtraction = {
  fields: [
    f("deadlines", { items: ["آخر موعد لاستلام الطلبات: 15 فبراير 2027، 11:59 مساءً"] }, "تم تمديد آخر موعد لاستلام الطلبات إلى 15 فبراير 2027"),
  ],
  requirements: [],
  questions: [],
  conflicts: [],
  notes: ["هذا التعميم يذكر موعدًا مختلفًا عن الدليل. لا نعتمد الأحدث تلقائيًا؛ احسم التعارض بناءً على مصدر موثوق من الجهة."],
};

export const IDEA_OPTIONS = [
  {
    title: "«جاهز رقميًا»: تمكين 150 شابًا بالمهارات الرقمية والتهيئة لسوق العمل",
    rationale: "يبني على برنامج «مهارتي» القائم وخبرة الجمعية منذ 2022، ويقع ضمن محوري «المهارات الرقمية» و«التهيئة لسوق العمل».",
    assumptions: ["عدد المستفيدين 150 تقديري ويحتاج اعتمادًا", "توفر قاعتي التدريب طوال المدة", "إمكانية الوصول لجهات توظيف للإرشاد"],
    requirements: ["دليل حاجة موثق لمنطقة التنفيذ", "مدربون معتمدون", "شريك يوفر منصة أو قاعة إضافية (مقترح)"],
  },
  {
    title: "مسار مهارات رقمية داخل برنامج «سواعد» التطوعي",
    rationale: "يستفيد من شبكة المتطوعين الحالية (25 متطوعًا) ويقع ضمن محور «العمل التطوعي المجتمعي».",
    assumptions: ["استمرار المتطوعين طوال المشروع"],
    requirements: ["تصميم مسار تدريبي قصير", "آلية لقياس ساعات التطوع"],
  },
  {
    title: "حاضنة مشاريع رقمية صغيرة للشباب",
    rationale: "تتصل بمحور التهيئة لسوق العمل، لكنها أبعد عن خبرة الجمعية الحالية وتحتاج شريكًا متخصصًا.",
    assumptions: ["توفر شريك متخصص في ريادة الأعمال"],
    requirements: ["خبرة احتضان غير موجودة حاليًا في ملف الجمعية"],
  },
];

export const IDEA_SUMMARY =
  "مشروع «جاهز رقميًا» يمكّن 150 شابًا وشابة من عمر 18 إلى 29 عامًا في منطقة الرياض خلال 12 شهرًا من المهارات الرقمية الأساسية والتهيئة لسوق العمل، عبر تدريب عملي وإرشاد مهني ومبادرات تطوعية، بناءً على خبرة الجمعية في برنامج «مهارتي». الأعداد والمدة تقديرية وتحتاج اعتماد الجمعية.";

export const DRAFT_PROJECT: DraftProject = {
  sections: [
    { key: "summary", isEstimate: true, content: "يهدف مشروع «جاهز رقميًا» إلى تمكين 150 شابًا وشابة في منطقة الرياض خلال 12 شهرًا من المهارات الرقمية الأساسية والتهيئة لسوق العمل. يتضمن المشروع تدريبًا عمليًا على أدوات العمل الرقمي، وجلسات إرشاد مهني، ومبادرات تطوعية يطبق فيها المتدربون مهاراتهم. يبني المشروع على خبرة الجمعية في برنامج «مهارتي» الذي درّب 320 شابًا وشابة خلال عام 2024 وفق التقرير السنوي للبرنامج." },
    { key: "problem", isEstimate: false, content: "يواجه عدد من الشباب الباحثين عن عمل في منطقة الرياض فجوة بين مهاراتهم الرقمية ومتطلبات سوق العمل. [يحتاج استكمال: دليل الحاجة مع مصدره، مثل نتائج استبيان الجمعية أو تقرير رسمي منشور]. تلاحظ الجمعية من خلال برنامج «مهارتي» طلبًا متزايدًا على التدريب الرقمي العملي المرتبط بفرص عمل." },
    { key: "objectives", isEstimate: true, content: "1. تدريب 150 شابًا وشابة على المهارات الرقمية الأساسية خلال 12 شهرًا.\n2. تقديم جلسات إرشاد مهني لجميع المتدربين.\n3. تنفيذ مبادرات تطوعية رقمية بمشاركة المتدربين بإجمالي 3000 ساعة تطوع." },
    { key: "target_group", isEstimate: true, content: "الشباب من عمر 18 إلى 29 عامًا في منطقة الرياض، وبالأخص الباحثون عن عمل. العدد المستهدف 150 مستفيدًا. شروط الاختيار: العمر، الإقامة في منطقة الرياض، الالتزام بحضور 80% من التدريب، وأولوية للباحثين عن عمل." },
    { key: "scope", isEstimate: false, content: "يُنفذ المشروع في مقر الجمعية بمنطقة الرياض عبر خمسة أنشطة: تصميم البرنامج واختيار المتدربين، التدريب الرقمي، التهيئة لسوق العمل والإرشاد، مبادرات التطوع، والقياس والتقييم. المخرجات المباشرة: دفعات تدريبية مكتملة، جلسات إرشاد، ومبادرات تطوعية منفذة." },
    { key: "outcomes", isEstimate: true, content: "النتائج المستهدفة (التغيير المتوقع): تحسن المهارات الرقمية للمتدربين مقاسًا بالاختبار القبلي والبعدي، وحصول نسبة من المتدربين على عمل أو تدريب منتهٍ بالتوظيف خلال 6 أشهر من التخرج. أما المخرجات فهي ما ينتجه المشروع مباشرة مثل عدد المتدربين وساعات التدريب." },
    { key: "team", isEstimate: false, content: "يدير المشروع منسق مشروع بدوام جزئي من فريق الجمعية، بإشراف المدير التنفيذي، ويشارك منسقا البرامج والمتطوعون. يُستعان بمدربين متعاقدين ومرشدين مهنيين. الموارد المتاحة: قاعتا تدريب مجهزتان و20 جهاز حاسب محمول." },
    { key: "risks", isEstimate: false, content: "1. انخفاض الالتزام بالحضور — المعالجة: شروط اختيار واضحة ومتابعة أسبوعية.\n2. تأخر التعاقد مع المدربين — المعالجة: قائمة مدربين بديلة.\n3. محدودية فرص العمل — المعالجة: التركيز على مهارات مطلوبة وبناء علاقات مع جهات توظيف." },
    { key: "sustainability", isEstimate: false, content: "تدمج الجمعية المحتوى التدريبي في برنامج «مهارتي» القائم بعد انتهاء الدعم، وتستمر مبادرات التطوع ضمن برنامج «سواعد»، ويُعاد استخدام المواد التدريبية والمنصة. لا يفترض المشروع عوائد تجارية." },
    { key: "assumptions", isEstimate: true, content: "- عدد المستفيدين 150 والمدة 12 شهرًا تقديريان ويحتاجان اعتمادًا.\n- تكاليف الوحدات في الميزانية تقديرية ولم تُدعم بعروض أسعار.\n- الشريك التقني مقترح ولا يوجد اتفاق بعد." },
  ],
  activities: [
    { code: "ن1", name: "تصميم البرنامج واختيار المتدربين", description: "إعداد المحتوى والإعلان والفرز", startMonth: 1, endMonth: 2, responsible: "منسق المشروع", outputs: "خطة تدريبية وقائمة متدربين" },
    { code: "ن2", name: "التدريب الرقمي", description: "دفعات تدريبية عملية على أدوات العمل الرقمي", startMonth: 3, endMonth: 8, responsible: "المدربون", outputs: "دفعات تدريبية مكتملة" },
    { code: "ن3", name: "التهيئة لسوق العمل والإرشاد", description: "جلسات إرشاد مهني وكتابة السيرة الذاتية والمقابلات", startMonth: 6, endMonth: 10, responsible: "المرشدون المهنيون", outputs: "جلسات إرشاد منفذة" },
    { code: "ن4", name: "مبادرات التطوع الرقمية", description: "تطبيق المهارات في مبادرات لصالح جهات مجتمعية", startMonth: 4, endMonth: 11, responsible: "منسقا البرامج", outputs: "مبادرات تطوعية منفذة" },
    { code: "ن5", name: "القياس والتقييم", description: "اختبارات قبلية وبعدية ومتابعة التوظيف", startMonth: 11, endMonth: 12, responsible: "جهة تقييم متعاقدة", outputs: "تقرير تقييم نهائي" },
  ],
  indicators: [
    { name: "عدد الشباب الذين أتموا التدريب", type: "OUTPUT", baseline: null, target: "150", unit: "متدرب", method: "سجلات الحضور", activityCode: "ن2", isEstimate: true },
    { name: "متوسط تحسن درجة المهارات الرقمية", type: "OUTCOME", baseline: "يُقاس في الاختبار القبلي", target: "20%", unit: "نسبة", method: "اختبار قبلي وبعدي", activityCode: "ن2", isEstimate: true },
    { name: "نسبة المتدربين الحاصلين على عمل أو تدريب منتهٍ بالتوظيف خلال 6 أشهر", type: "OUTCOME", baseline: null, target: "30%", unit: "نسبة", method: "متابعة هاتفية موثقة", activityCode: "ن3", isEstimate: true },
    { name: "ساعات التطوع المنفذة", type: "OUTPUT", baseline: null, target: "3000", unit: "ساعة", method: "سجل ساعات التطوع", activityCode: "ن4", isEstimate: true },
  ],
  partners: [
    { name: "شركة تقنية محلية (مقترح)", partnerType: "قطاع خاص", role: "توفير قاعة تدريب إضافية ومنصة تعلم عينيًا", tasks: "إتاحة القاعة 6 أشهر، دعم فني للمنصة", mutualValue: "مسؤولية اجتماعية للشركة ووصولها إلى مواهب شابة؛ وللجمعية توسيع الطاقة الاستيعابية", inKindDescription: "قاعة تدريب لمدة 6 أشهر" },
  ],
};

export const BUDGET_SUGGESTION: BudgetSuggestion = {
  lines: [
    { item: "أجور المدربين", costCenter: "التدريب", activityCode: "ن2", unit: "ساعة", quantity: "480", unitCostSar: "250", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "480 ساعة تدريبية لخمس دفعات تقريبًا (تقديري)", periodsFollowDuration: false, quantityFollowsBeneficiaries: false },
    { item: "اشتراك منصة تعلم رقمية", costCenter: "المنصات الرقمية", activityCode: "ن2", unit: "شهر", quantity: "1", unitCostSar: "3000", calc: "RECURRING", periods: 12, fundingSource: "DONOR", contributionType: "CASH", justification: "اشتراك شهري طوال مدة المشروع (تقديري)", periodsFollowDuration: true, quantityFollowsBeneficiaries: false },
    { item: "مواد تدريبية", costCenter: "التدريب", activityCode: "ن2", unit: "متدرب", quantity: "150", unitCostSar: "200", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "حقيبة تدريبية لكل متدرب (تقديري)", periodsFollowDuration: false, quantityFollowsBeneficiaries: true },
    { item: "مرشدون مهنيون", costCenter: "الإرشاد", activityCode: "ن3", unit: "جلسة", quantity: "300", unitCostSar: "300", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "جلستان لكل متدرب (تقديري)", periodsFollowDuration: false, quantityFollowsBeneficiaries: false },
    { item: "تنقل المتدربين للمبادرات", costCenter: "التنقل", activityCode: "ن4", unit: "متدرب", quantity: "150", unitCostSar: "400", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "بدل تنقل للمبادرات الميدانية (تقديري)", periodsFollowDuration: false, quantityFollowsBeneficiaries: true },
    { item: "ضيافة ورش العمل", costCenter: "الضيافة", activityCode: "ن2", unit: "ورشة", quantity: "20", unitCostSar: "1500", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "ضيافة للمتدربين في الورش (تقديري)", periodsFollowDuration: false, quantityFollowsBeneficiaries: false },
    { item: "منسق المشروع (دوام جزئي)", costCenter: "الإدارة", activityCode: "ن1", unit: "شهر", quantity: "1", unitCostSar: "6000", calc: "RECURRING", periods: 12, fundingSource: "SELF", contributionType: "CASH", justification: "مساهمة الجمعية بوقت منسق من فريقها (تقديري)", periodsFollowDuration: true, quantityFollowsBeneficiaries: false },
    { item: "قاعة تدريب إضافية", costCenter: "المرافق", activityCode: "ن2", unit: "شهر", quantity: "1", unitCostSar: "4000", calc: "RECURRING", periods: 6, fundingSource: "PARTNER", contributionType: "IN_KIND", justification: "مساهمة عينية من الشريك المقترح (غير مؤكدة)", periodsFollowDuration: false, quantityFollowsBeneficiaries: false },
    { item: "التقييم والقياس", costCenter: "التقييم", activityCode: "ن5", unit: "تقرير", quantity: "1", unitCostSar: "25000", calc: "ONE_TIME", periods: 1, fundingSource: "DONOR", contributionType: "CASH", justification: "جهة تقييم متعاقدة لتقرير نهائي (تقديري)", periodsFollowDuration: false, quantityFollowsBeneficiaries: false },
  ],
  notes: ["جميع التكاليف تقديرية ولم تُدعم بعروض أسعار.", "لم تُضف ضريبة أو نسبة مصاريف إدارية لعدم وجود اشتراط في الدليل."],
};

/** مسودات إجابات تجريبية حسب ترتيب الأسئلة */
export const DEMO_ANSWERS = [
  "«جاهز رقميًا» مشروع لمدة 12 شهرًا يمكّن 150 شابًا وشابة في منطقة الرياض من المهارات الرقمية الأساسية والتهيئة لسوق العمل. يجمع المشروع بين تدريب عملي على أدوات العمل الرقمي، وجلسات إرشاد مهني، ومبادرات تطوعية يطبق فيها المتدربون ما تعلموه لصالح جهات مجتمعية. يبني المشروع على خبرة الجمعية في برنامج «مهارتي» القائم منذ 2022.",
  "نقيس الأثر عبر: (1) اختبار قبلي وبعدي للمهارات الرقمية لكل متدرب، والمستهدف تحسن متوسط 20%. (2) متابعة هاتفية موثقة بعد 6 أشهر من التخرج لقياس نسبة الحاصلين على عمل أو تدريب منتهٍ بالتوظيف، والمستهدف 30%. (3) سجلات الحضور وساعات التطوع. وتُعد جهة تقييم متعاقدة تقريرًا نهائيًا.",
  "تدمج الجمعية المحتوى التدريبي ضمن برنامج «مهارتي» القائم بعد انتهاء الدعم، وتستمر مبادرات التطوع عبر برنامج «سواعد». تبقى المواد التدريبية والمنصة متاحة لدفعات لاحقة، ويواصل الخريجون المشاركة كمتطوعين ومرشدين للدفعات الجديدة.",
  "شراكة مقترحة مع شركة تقنية محلية لتوفير قاعة تدريب إضافية ومنصة تعلم بشكل عيني. لا يوجد اتفاق موقّع حتى الآن.",
];
