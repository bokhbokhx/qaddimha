import "server-only";
import ExcelJS from "exceljs";
import { halalasToNumberString } from "@/lib/money";
import { DEMO_EXPORT_NOTICE, metaLine, type ExportMeta, type ExportModel } from "./common";

import { safeText } from "./xlsx-safe";

export { safeText };

export async function budgetXlsx(x: ExportModel, m: ExportMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "قدمها";
  const ws = wb.addWorksheet("الميزانية", { views: [{ rightToLeft: true, state: "frozen", ySplit: 5 }] });
  ws.getCell("A1").value = safeText(x.title);
  ws.getCell("A1").font = { bold: true, size: 14 };
  ws.getCell("A2").value = safeText(metaLine(m));
  ws.getCell("A3").value = m.isDemo ? DEMO_EXPORT_NOTICE : m.isDraft ? "مسودة — لم تكتمل الجاهزية" : "";
  ws.getCell("A3").font = { color: { argb: "FF8C2A1B" }, bold: true };

  const headers = ["البند", "مركز التكلفة", "النشاط", "الوحدة", "الكمية", "تكلفة الوحدة (ر.س)", "طريقة الحساب", "عدد الفترات", "الإجمالي (ر.س)", "مصدر التمويل", "نوع المساهمة", "الشريك", "مبرر التكلفة"];
  const hr = ws.getRow(5);
  headers.forEach((t, i) => {
    const c = hr.getCell(i + 1);
    c.value = t;
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F3D2E" } };
    c.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
  });
  const first = 6;
  x.budgetRows.forEach((l, idx) => {
    const r = ws.getRow(first + idx);
    const rn = first + idx;
    r.getCell(1).value = safeText(l.item);
    r.getCell(2).value = safeText(l.costCenter);
    r.getCell(3).value = safeText(l.activity);
    r.getCell(4).value = safeText(l.unit);
    r.getCell(5).value = Number(l.qty);
    r.getCell(6).value = Number(halalasToNumberString(BigInt(l.unitCostHalalas)));
    r.getCell(7).value = l.calc === "RECURRING" ? "دوري" : "مرة واحدة";
    r.getCell(8).value = l.calc === "RECURRING" ? l.periods : 1;
    // الصيغة تمنع احتساب المدة مرتين: البنود لمرة واحدة فتراتها 1 دائمًا
    r.getCell(9).value = { formula: `ROUND(E${rn}*F${rn}*H${rn},2)`, result: Number(halalasToNumberString(BigInt(l.totalHalalas))) };
    r.getCell(10).value = l.source;
    r.getCell(11).value = l.contribution;
    r.getCell(12).value = safeText(l.partner);
    r.getCell(13).value = safeText(l.justification);
    [6, 9].forEach((c) => (r.getCell(c).numFmt = "#,##0.00"));
  });
  const last = first + Math.max(0, x.budgetRows.length - 1);
  const sr = last + 2;
  const range = (col: string) => `${col}${first}:${col}${last}`;
  // القيم المخزنة مسبقًا تُحسب بالهللة من نفس البنود، والصيغ تعيد حسابها في Excel
  const sumOf = (pred: (l: (typeof x.budgetRows)[number]) => boolean) =>
    Number(halalasToNumberString(x.budgetRows.filter(pred).reduce((a, l) => a + BigInt(l.totalHalalas), 0n)));
  const sums: [string, string, number][] = [
    ["إجمالي المشروع", `SUM(${range("I")})`, sumOf(() => true)],
    ["المطلوب من المانح", `SUMIFS(${range("I")},${range("J")},"المانح")`, sumOf((l) => l.fundingSource === "DONOR")],
    ["المساهمة الذاتية النقدية", `SUMIFS(${range("I")},${range("J")},"الجمعية",${range("K")},"نقدي")`, sumOf((l) => l.fundingSource === "SELF" && l.contributionType === "CASH")],
    ["المساهمة الذاتية العينية", `SUMIFS(${range("I")},${range("J")},"الجمعية",${range("K")},"عيني")`, sumOf((l) => l.fundingSource === "SELF" && l.contributionType === "IN_KIND")],
    ["مساهمات الشركاء النقدية", `SUMIFS(${range("I")},${range("J")},"شريك",${range("K")},"نقدي")`, sumOf((l) => l.fundingSource === "PARTNER" && l.contributionType === "CASH")],
    ["مساهمات الشركاء العينية", `SUMIFS(${range("I")},${range("J")},"شريك",${range("K")},"عيني")`, sumOf((l) => l.fundingSource === "PARTNER" && l.contributionType === "IN_KIND")],
  ];
  sums.forEach(([label, formula, result], i) => {
    const r = ws.getRow(sr + i);
    r.getCell(8).value = label;
    r.getCell(8).font = { bold: true };
    r.getCell(9).value = x.budgetRows.length ? { formula, result } : 0;
    r.getCell(9).numFmt = "#,##0.00";
    r.getCell(9).font = { bold: true };
  });
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  ws.columns.forEach((c, i) => (c.width = [28, 16, 10, 10, 10, 16, 12, 11, 16, 13, 12, 18, 40][i] ?? 12));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
