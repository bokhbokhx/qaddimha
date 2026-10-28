// معالجة النص العربي المستخرج من PDF.

const PRESENTATION_FORMS = /[\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LTR_RUN = /[0-9A-Za-z@._%+\-\/:,]+(?:\s+[0-9A-Za-z@._%+\-\/:,]+)*/g;

/**
 * بعض ملفات PDF تخزن العربية بأشكال العرض وبترتيب بصري معكوس.
 * نعكس السطر، ثم نطبّع الأشكال (NFKC) فتعود الحروف وأزواج اللام ألف لترتيبها المنطقي،
 * ثم نعيد عكس المقاطع اللاتينية والأرقام ونقلب الأقواس.
 */
export function fixVisualArabic(line: string): string {
  if (!PRESENTATION_FORMS.test(line)) return line;
  const reversed = Array.from(line).reverse().join("").normalize("NFKC");
  return reversed
    .replace(LTR_RUN, (m) => Array.from(m).reverse().join(""))
    .replace(/[()[\]{}]/g, (c) => ({ "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{" })[c]!);
}


/** إزالة علامات الاتجاه، وتصحيح انعكاس «لا/لأ/لإ/لآ» بعد أداة التعريف الذي ينتج عن بعض الخطوط */
export function fixPopplerArabic(t: string): string {
  return t
    .replace(/[\u202A-\u202E\u200E\u200F\u2066-\u2069]/g, "")
    .replace(/ا([أإآا])ل/g, "ال$1")
    .replace(/[ \t]{2,}/g, " ");
}
