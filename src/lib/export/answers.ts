import { checkLimit } from "@/lib/text-limits";
import { DEMO_EXPORT_NOTICE, metaLine, type ExportMeta, type ExportModel } from "./common";
import type { Snapshot } from "@/lib/domain/types";

export function answersText(x: ExportModel, s: Snapshot, m: ExportMeta) {
  const lines = [`إجابات نموذج الجهة — ${x.title}`, metaLine(m)];
  if (m.isDemo) lines.push(DEMO_EXPORT_NOTICE);
  lines.push("ملاحظة: عدّ الكلمات والأحرف تقريبي وقد يختلف عن بوابة الجهة.", "");
  s.questions.forEach((q, i) => {
    const content = q.answer?.content ?? "";
    const lim = checkLimit(content, q.limitType, q.limitValue);
    lines.push(`السؤال ${i + 1}: ${q.text}${q.mandatory ? " (إلزامي)" : " (اختياري)"}`);
    lines.push(q.limitType === "NONE" ? "الحد: بلا حد" : `الحد: ${q.limitValue} ${q.limitType === "WORDS" ? "كلمة" : "حرف"} — العدد الحالي: ${lim.count}`);
    lines.push("", content || "— لا توجد إجابة —", "", "────────────", "");
  });
  return "﻿" + lines.join("\r\n");
}
