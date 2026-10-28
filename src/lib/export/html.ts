import "server-only";
import { embeddedFontCss } from "./fonts";
import { DEMO_EXPORT_NOTICE, metaLine, type ExportMeta, type ExportModel } from "./common";
import { GROUP_LABEL } from "@/lib/domain/readiness";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const para = (s: string) => (s.trim() ? s.split(/\n+/).map((p) => `<p>${esc(p)}</p>`).join("") : `<p class="muted">— لم يُستكمل —</p>`);

function base(title: string, body: string, m: ExportMeta, extraCss = "") {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${embeddedFontCss()}
@page{size:A4;margin:18mm 16mm 20mm 16mm}
*{box-sizing:border-box}
body{font-family:'Plex',sans-serif;color:#1c2b25;font-size:11pt;line-height:1.75;margin:0}
h1{font-size:20pt;color:#0f3d2e;margin:0 0 6pt}
h2{font-size:14pt;color:#0f3d2e;border-bottom:1.5pt solid #b8903a;padding-bottom:3pt;margin:18pt 0 8pt;break-after:avoid}
h3{font-size:12pt;margin:12pt 0 4pt;break-after:avoid}
p{margin:0 0 6pt;text-align:justify}
.muted{color:#6b7a73}
.meta{font-size:9pt;color:#4b5b54;border:1pt solid #d9d2c3;background:#faf7f0;padding:6pt 8pt;border-radius:4pt;margin:8pt 0}
.demo{font-size:9pt;color:#7a5b12;background:#fbf3df;border:1pt solid #e7cf8f;padding:4pt 8pt;border-radius:4pt;margin:6pt 0}
table{width:100%;border-collapse:collapse;margin:6pt 0 10pt;font-size:9.5pt;break-inside:auto}
th,td{border:0.75pt solid #c9c2b2;padding:4pt 5pt;text-align:right;vertical-align:top}
th{background:#0f3d2e;color:#fff;font-weight:700}
tr{break-inside:avoid}
td.num{direction:ltr;text-align:left;white-space:nowrap;font-variant-numeric:tabular-nums}
.ltr{direction:ltr;unicode-bidi:isolate}
.watermark{position:fixed;top:40%;left:0;right:0;text-align:center;font-size:90pt;font-weight:700;color:rgba(184,144,58,.13);transform:rotate(-30deg);z-index:-1}
.cover{min-height:240mm;display:flex;flex-direction:column;justify-content:center;break-after:page}
.cover .org{font-size:13pt;color:#4b5b54}
.badge{display:inline-block;padding:1pt 6pt;border-radius:8pt;font-size:8.5pt;background:#e9efe9}
.badge.bad{background:#f7e3df;color:#8c2a1b}.badge.ok{background:#dcefe2;color:#14532d}.badge.warn{background:#fbf3df;color:#7a5b12}
${extraCss}
</style></head><body>${m.isDraft ? `<div class="watermark">مسودة</div>` : ""}${body}</body></html>`;
}

export function projectDocumentHtml(x: ExportModel, m: ExportMeta) {
  const body = `
<section class="cover">
  <div class="org">${esc(x.org)}</div>
  <h1>${esc(x.title)}</h1>
  <div>مقدم إلى: ${esc(x.funder)} — ${esc(x.grant)}</div>
  <div class="meta">${esc(metaLine(m))}</div>
  ${m.isDemo ? `<div class="demo">${DEMO_EXPORT_NOTICE}</div>` : ""}
  ${m.isDraft ? `<div class="demo">هذه نسخة مسودة: توجد ${x.readiness.blockers.length} عوائق لم تُعالج. لا تُستخدم للتقديم.</div>` : ""}
  <table><tbody>${x.params.map(([k, v]) => `<tr><th style="width:35%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>
</section>
${x.sections.map((s) => `<h2>${esc(s.label)}</h2>${para(s.content)}`).join("")}
<h2>خطة التنفيذ</h2>
<table><thead><tr><th>الرمز</th><th>النشاط</th><th>من شهر</th><th>إلى شهر</th><th>المسؤول</th><th>المخرجات</th></tr></thead><tbody>
${x.activities.map((a) => `<tr><td>${esc(a.code)}</td><td>${esc(a.name)}</td><td class="num">${a.startMonth}</td><td class="num">${a.endMonth}</td><td>${esc(a.responsible)}</td><td>${esc(a.outputs)}</td></tr>`).join("")}
</tbody></table>
<h2>مؤشرات القياس</h2>
<table><thead><tr><th>المؤشر</th><th>النوع</th><th>خط الأساس</th><th>المستهدف</th><th>طريقة القياس</th><th>النشاط</th></tr></thead><tbody>
${x.indicators.map((i) => `<tr><td>${esc(i.name)}</td><td>${i.typeLabel}</td><td>${esc(i.baseline ?? "غير متوفر")}</td><td>${esc(i.target)} ${esc(i.unit)}</td><td>${esc(i.method)}</td><td>${esc(i.activity)}</td></tr>`).join("")}
</tbody></table>
<h2>الشركاء</h2>
${x.partners.length ? `<table><thead><tr><th>الشريك</th><th>الحالة</th><th>الدور</th><th>المساهمة</th><th>القيمة المتبادلة</th></tr></thead><tbody>
${x.partners.map((p) => `<tr><td>${esc(p.name)}</td><td>${esc(p.statusLabel)}</td><td>${esc(p.role)}</td><td>${esc(p.inKindDescription)}</td><td>${esc(p.mutualValue)}</td></tr>`).join("")}
</tbody></table>` : `<p class="muted">لا يوجد شركاء.</p>`}
<h2>الميزانية</h2>
<table><thead><tr><th>البند</th><th>النشاط</th><th>الوحدة</th><th>الكمية</th><th>تكلفة الوحدة</th><th>الفترات</th><th>الإجمالي (ر.س)</th><th>المصدر</th><th>النوع</th></tr></thead><tbody>
${x.budgetRows.map((l) => `<tr><td>${esc(l.item)}<div class="muted" style="font-size:8pt">${esc(l.justification)}</div></td><td>${esc(l.activity)}</td><td>${esc(l.unit)}</td><td class="num">${l.qty}</td><td class="num">${l.unitCost}</td><td class="num">${l.calc === "RECURRING" ? l.periods : "—"}</td><td class="num">${l.total}</td><td>${l.source}</td><td>${l.contribution}</td></tr>`).join("")}
</tbody></table>
<table><tbody>${x.budget.map(([k, v]) => `<tr><th style="width:45%">${esc(k)}</th><td class="num">${esc(v)}</td></tr>`).join("")}</tbody></table>
<p class="muted" style="font-size:9pt">الصيغة: الإجمالي = الكمية × تكلفة الوحدة، وللبنود الدورية × عدد الفترات. المساهمة العينية تُحتسب في الإجمالي ولا تُخصم من التمويل النقدي.</p>
`;
  return base(x.title, body, m);
}

export function summaryHtml(x: ExportModel, m: ExportMeta) {
  const summary = x.sections.find((s) => s.key === "summary")?.content ?? "";
  const objectives = x.sections.find((s) => s.key === "objectives")?.content ?? "";
  const body = `
<h1 style="font-size:16pt">${esc(x.title)}</h1>
<div class="muted">${esc(x.org)} — ${esc(x.funder)}</div>
<div class="meta">${esc(metaLine(m))}</div>
${m.isDemo ? `<div class="demo">${DEMO_EXPORT_NOTICE}</div>` : ""}
<h2>الملخص التنفيذي</h2>${para(summary)}
<h2>الأهداف</h2>${para(objectives)}
<table><tbody>${[...x.params, ...x.budget.slice(0, 2)].map(([k, v]) => `<tr><th style="width:40%">${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>`;
  return base(`ملخص — ${x.title}`, body, m, "body{font-size:10pt;line-height:1.6} h2{margin:8pt 0 4pt}");
}

export function checklistHtml(x: ExportModel, m: ExportMeta) {
  const cls = (r: string) => (r === "مستوفى" ? "ok" : r === "غير مستوفى" ? "bad" : "warn");
  const body = `
<h1 style="font-size:16pt">قائمة المتطلبات والمرفقات</h1>
<div class="muted">${esc(x.title)} — ${esc(x.grant)}</div>
<div class="meta">${esc(metaLine(m))}</div>
${m.isDemo ? `<div class="demo">${DEMO_EXPORT_NOTICE}</div>` : ""}
<h2>الشروط</h2>
<table><thead><tr><th>الرمز</th><th>الشرط</th><th>الفئة</th><th>الإلزام</th><th>النتيجة</th><th>الدليل / الإجراء التالي</th><th>المصدر</th></tr></thead><tbody>
${x.requirements.map((r) => `<tr><td>${esc(r.code)}</td><td>${esc(r.text)}</td><td>${esc(r.category)}</td><td>${r.mandatory}</td><td><span class="badge ${cls(r.result)}">${r.result}</span></td><td>${esc(r.evidence)}${r.next ? `<div class="muted">${esc(r.next)}</div>` : ""}</td><td>${esc(r.source)}</td></tr>`).join("")}
</tbody></table>
<h2>المرفقات المتوفرة على المنصة</h2>
<table><thead><tr><th>الملف</th><th>الوصف</th><th>تاريخ الانتهاء</th></tr></thead><tbody>
${x.documents.map((d) => `<tr><td class="ltr">${esc(d.filename)}</td><td>${esc(d.label ?? "")}</td><td>${esc(d.expiresOn?.slice(0, 10) ?? "—")}</td></tr>`).join("")}
</tbody></table>
<h2>العوائق المتبقية (${x.readiness.blockers.length})</h2>
${x.readiness.blockers.length ? `<table><tbody>${x.readiness.blockers.map((b) => `<tr><td style="width:25%">${GROUP_LABEL[b.group]}</td><td>${esc(b.label)}</td><td>${esc(b.message)}</td></tr>`).join("")}</tbody></table>` : `<p>لا توجد عوائق.</p>`}
<p class="muted" style="font-size:9pt">${esc(x.readiness.formula)}</p>`;
  return base("قائمة المتطلبات", body, m);
}
