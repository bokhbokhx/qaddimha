import { describe, expect, it } from "vitest";
import { checkLimit, countChars, countWords } from "@/lib/text-limits";
import { safeText } from "@/lib/export/xlsx-safe";
import { fixPopplerArabic } from "@/lib/extraction/arabic";
import { preciseLocator } from "@/lib/extraction/locate";
import { chunkPages } from "@/lib/extraction/chunk";

describe("حدود الإجابات", () => {
  it("يعد الكلمات العربية والإنجليزية والأرقام ويتجاهل علامات الترقيم المنفصلة", () => {
    expect(countWords("تمكين 150 شابًا — في Riyadh .")).toBe(5);
    expect(countChars("  أهلا بك ")).toBe(7);
  });
  it("يكشف تجاوز الحد", () => {
    expect(checkLimit("واحد اثنان ثلاثة", "WORDS", 2).withinLimit).toBe(false);
    expect(checkLimit("واحد اثنان", "WORDS", 2).withinLimit).toBe(true);
    expect(checkLimit("abcdef", "CHARS", 5)).toMatchObject({ count: 6, withinLimit: false });
    expect(checkLimit("نص طويل", "NONE", null).withinLimit).toBe(true);
  });
});

describe("التصدير والاستخراج", () => {
  it("يمنع حقن الصيغ في Excel", () => {
    expect(safeText("=HYPERLINK(\"x\")")).toBe("'=HYPERLINK(\"x\")");
    expect(safeText("+1")).toBe("'+1");
    expect(safeText("@SUM")).toBe("'@SUM");
    expect(safeText("بند عادي")).toBe("بند عادي");
  });
  it("يصحح انعكاس لام ألف بعد أداة التعريف ويزيل علامات الاتجاه", () => {
    expect(fixPopplerArabic("‫تاريخ االنتهاء‬")).toBe("تاريخ الانتهاء");
    expect(fixPopplerArabic("األرقام")).toBe("الأرقام");
    expect(fixPopplerArabic("إلى")).toBe("إلى");
  });
  it("يقسم النص ويحدد موضع الفقرة بدقة", () => {
    const chunks = chunkPages([{ label: "صفحة 1", text: "أولًا\nالشرط الأول\nالشرط الثاني" }]);
    expect(chunks[0].locator).toBe("صفحة 1، الفقرات 1–3");
    expect(preciseLocator(chunks, "الشرط الثاني")).toBe("صفحة 1، فقرة 3");
    expect(preciseLocator(chunks, "غير موجود")).toBeNull();
  });
});
