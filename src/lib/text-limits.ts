// التحقق البرمجي من حدود الكلمات والأحرف.
// طريقة الحساب معلنة للمستخدم، ولا نضمن تطابقها مع بوابة الجهة.

export const WORD_COUNT_METHOD =
  "تُحسب الكلمات بتقسيم النص على المسافات وعلامات السطر؛ الأرقام والكلمات الإنجليزية تُحسب كلمات، وعلامات الترقيم المنفصلة لا تُحسب.";
export const CHAR_COUNT_METHOD =
  "تُحسب الأحرف بعدد الرموز المرئية بما فيها المسافات وعلامات الترقيم، بعد إزالة المسافات الزائدة في البداية والنهاية.";

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((t) => t.length > 0 && /[\p{L}\p{N}]/u.test(t)).length;
}

export function countChars(text: string): number {
  return Array.from(text.trim().normalize("NFC")).length;
}

export type LimitType = "NONE" | "WORDS" | "CHARS";

export interface LimitCheck {
  count: number;
  limit: number | null;
  type: LimitType;
  withinLimit: boolean;
  method: string;
}

export function checkLimit(text: string, type: LimitType, limit: number | null | undefined): LimitCheck {
  if (type === "NONE" || !limit) {
    return { count: countWords(text), limit: null, type, withinLimit: true, method: WORD_COUNT_METHOD };
  }
  const count = type === "WORDS" ? countWords(text) : countChars(text);
  return {
    count,
    limit,
    type,
    withinLimit: count <= limit,
    method: type === "WORDS" ? WORD_COUNT_METHOD : CHAR_COUNT_METHOD,
  };
}
