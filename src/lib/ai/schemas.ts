import { z } from "zod";

// مخرجات منظمة لكل مهمة — يُتحقق منها قبل الحفظ.

const sourceRef = {
  locator: z.string().nullable().describe("موضع المعلومة في المصدر، مثل «صفحة 2، فقرة 3». null إن لم يتوفر"),
  excerpt: z.string().nullable().describe("مقتطف حرفي قصير من المصدر يدعم القيمة"),
};

export const ExtractedField = z.object({
  key: z.string(),
  text: z.string().nullable().describe("القيمة النصية للحقول النصية"),
  items: z.array(z.string()).nullable().describe("قائمة القيم للحقول من نوع قائمة"),
  results: z
    .array(z.object({ text: z.string(), source: z.string().nullable(), period: z.string().nullable() }))
    .nullable()
    .describe("للنتائج السابقة فقط"),
  ...sourceRef,
});
export type ExtractedField = z.infer<typeof ExtractedField>;

export const OrgExtractionSchema = z.object({
  fields: z.array(ExtractedField),
  notes: z.array(z.string()).describe("ملاحظات للمستخدم، مثل معلومات غير واضحة"),
});
export type OrgExtraction = z.infer<typeof OrgExtractionSchema>;

export const RequirementOut = z.object({
  code: z.string(),
  category: z.enum(["ORG_ELIGIBILITY", "PROJECT_FIT", "DOCUMENT", "BUDGET", "SUBMISSION"]),
  text: z.string(),
  mandatory: z.boolean(),
  rule: z.enum(["MANUAL", "ENTITY_TYPE", "REGION", "TARGET_GROUP", "DOCUMENT_PRESENT", "BUDGET_CAP", "DURATION_MAX", "COFUNDING_MIN", "EXCLUDED_COSTS"]),
  params: z.object({
    allowed: z.array(z.string()).nullable(),
    maxSar: z.number().nullable(),
    maxMonths: z.number().nullable(),
    minPct: z.number().nullable(),
    countInKind: z.boolean().nullable(),
    documentKind: z.string().nullable(),
    labelKeyword: z.string().nullable(),
    keywords: z.array(z.string()).nullable(),
  }),
  ...sourceRef,
});
export type RequirementOut = z.infer<typeof RequirementOut>;

export const QuestionOut = z.object({
  text: z.string(),
  type: z.enum(["TEXT", "NUMBER", "CHOICE", "ATTACHMENT"]),
  mandatory: z.boolean(),
  limitType: z.enum(["NONE", "WORDS", "CHARS"]),
  limitValue: z.number().nullable(),
  linkedSections: z.array(z.string()),
  locator: z.string().nullable(),
});

export const OpportunityExtractionSchema = z.object({
  fields: z.array(ExtractedField),
  requirements: z.array(RequirementOut),
  questions: z.array(QuestionOut),
  conflicts: z.array(
    z.object({
      key: z.string(),
      values: z.array(z.object({ value: z.string(), locator: z.string().nullable(), excerpt: z.string().nullable(), documentName: z.string().nullable() })),
    }),
  ),
  notes: z.array(z.string()),
});
export type OpportunityExtraction = z.infer<typeof OpportunityExtractionSchema>;

export const IdeaTurnSchema = z.object({
  reply: z.string().describe("رد قصير وواضح للمستخدم"),
  questions: z.array(z.string()).describe("دفعة قصيرة من 1–3 أسئلة محددة"),
  understood: z.array(z.object({ key: z.string(), label: z.string(), value: z.string() })).describe("ما فهمه المساعد من المستخدم ليصححه"),
  ideaOptions: z
    .array(z.object({ title: z.string(), rationale: z.string(), assumptions: z.array(z.string()), requirements: z.array(z.string()) }))
    .describe("2–3 مسارات عند الحاجة فقط، وإلا قائمة فارغة"),
  ideaSummary: z.string().nullable(),
  outOfScopeWarning: z.string().nullable(),
});
export type IdeaTurn = z.infer<typeof IdeaTurnSchema>;

export const DraftProjectSchema = z.object({
  sections: z.array(z.object({ key: z.string(), content: z.string(), isEstimate: z.boolean() })),
  activities: z.array(
    z.object({ code: z.string(), name: z.string(), description: z.string(), startMonth: z.number(), endMonth: z.number(), responsible: z.string(), outputs: z.string() }),
  ),
  indicators: z.array(
    z.object({
      name: z.string(), type: z.enum(["OUTPUT", "OUTCOME"]), baseline: z.string().nullable(), target: z.string(),
      unit: z.string(), method: z.string(), activityCode: z.string().nullable(), isEstimate: z.boolean(),
    }),
  ),
  partners: z.array(z.object({ name: z.string(), partnerType: z.string(), role: z.string(), tasks: z.string(), mutualValue: z.string(), inKindDescription: z.string() })),
});
export type DraftProject = z.infer<typeof DraftProjectSchema>;

export const BudgetSuggestionSchema = z.object({
  lines: z.array(
    z.object({
      item: z.string(), costCenter: z.string(), activityCode: z.string().nullable(), unit: z.string(),
      quantity: z.string().describe("رقم عشري حتى 3 خانات كنص"), unitCostSar: z.string().describe("مبلغ بالريال حتى خانتين كنص"),
      calc: z.enum(["ONE_TIME", "RECURRING"]), periods: z.number(),
      fundingSource: z.enum(["DONOR", "SELF", "PARTNER"]), contributionType: z.enum(["CASH", "IN_KIND"]),
      justification: z.string(), periodsFollowDuration: z.boolean(), quantityFollowsBeneficiaries: z.boolean(),
    }),
  ),
  notes: z.array(z.string()),
});
export type BudgetSuggestion = z.infer<typeof BudgetSuggestionSchema>;

export const DraftAnswersSchema = z.object({
  answers: z.array(z.object({ questionId: z.string(), content: z.string() })),
});
export type DraftAnswers = z.infer<typeof DraftAnswersSchema>;

export const ConsistencySchema = z.object({
  issues: z.array(z.object({ severity: z.enum(["blocker", "warning"]), message: z.string(), sectionKey: z.string().nullable() })),
});
export type ConsistencyOut = z.infer<typeof ConsistencySchema>;

export const ImpactRewriteSchema = z.object({
  proposals: z.array(z.object({ targetType: z.enum(["SECTION", "ANSWER"]), targetId: z.string(), after: z.string(), explanation: z.string() })),
});
export type ImpactRewrite = z.infer<typeof ImpactRewriteSchema>;
