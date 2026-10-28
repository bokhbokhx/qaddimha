import "server-only";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, Packer, PageBreak, PageNumber, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, WidthType,
} from "docx";
import { brandColor, DEMO_EXPORT_NOTICE, metaLine, type ExportMeta, type ExportModel } from "./common";

const FONT = "IBM Plex Sans Arabic";


function run(text: string, o: { bold?: boolean; size?: number; color?: string } = {}) {
  return new TextRun({ text, rightToLeft: true, bold: o.bold, boldComplexScript: o.bold, size: o.size ?? 22, sizeComplexScript: o.size ?? 22, color: o.color, font: FONT });
}

function p(text: string, o: { bold?: boolean; size?: number; color?: string; spacingAfter?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({ bidirectional: true, alignment: o.align ?? AlignmentType.START, spacing: { after: o.spacingAfter ?? 120 }, children: [run(text, o)] });
}

function h(text: string, level: 1 | 2, color: string) {
  return new Paragraph({
    bidirectional: true,
    spacing: { before: level === 1 ? 0 : 300, after: 120 },
    keepNext: true,
    border: level === 2 ? { bottom: { style: BorderStyle.SINGLE, size: 8, color: "B8903A", space: 2 } } : undefined,
    children: [run(text, { bold: true, size: level === 1 ? 40 : 28, color })],
  });
}

function table(headers: string[], rows: string[][], color: string) {
  const cell = (t: string, head = false) =>
    new TableCell({
      shading: head ? { type: ShadingType.CLEAR, fill: color, color: "auto" } : undefined,
      children: t.split("\n").map((line) => new Paragraph({ bidirectional: true, children: [run(line, { size: 18, bold: head, color: head ? "FFFFFF" : undefined })] })),
    });
  return new Table({
    visuallyRightToLeft: true,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      ...(headers.length ? [new TableRow({ tableHeader: true, children: headers.map((x) => cell(x, true)) })] : []),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((x) => cell(x)) })),
    ],
  });
}

export async function projectDocx(x: ExportModel, m: ExportMeta): Promise<Buffer> {
  const C = brandColor(m).slice(1).toUpperCase();
  const children: (Paragraph | Table)[] = [];
  const logo = m.brand?.logo;
  // Word لا يدعم WEBP؛ نكتفي بالشعار في PDF عندها
  if (logo && logo.type !== "webp") {
    children.push(new Paragraph({ bidirectional: true, children: [new ImageRun({ type: logo.type, data: logo.buffer, transformation: { width: 90, height: 90 } })] }));
  }
  children.push(
    p(x.org, { size: 26, color: "4B5B54" }),
    h(x.title, 1, C),
    p(`مقدم إلى: ${x.funder} — ${x.grant}`),
    p(metaLine(m), { size: 18, color: "4B5B54" }),
  );
  if (m.isDemo) children.push(p(DEMO_EXPORT_NOTICE, { size: 18, color: "7A5B12", bold: true }));
  if (m.isDraft) children.push(p(`مسودة — توجد ${x.readiness.blockers.length} عوائق لم تُعالج. لا تُستخدم للتقديم.`, { bold: true, color: "8C2A1B" }));
  children.push(table([], x.params.map(([k, v]) => [k, v]), C));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (const s of x.sections) {
    children.push(h(s.label, 2, C));
    const lines = s.content.trim() ? s.content.split(/\n+/) : ["— لم يُستكمل —"];
    for (const line of lines) children.push(p(line));
  }
  children.push(h("خطة التنفيذ", 2, C));
  children.push(table(["الرمز", "النشاط", "من شهر", "إلى شهر", "المسؤول", "المخرجات"], x.activities.map((a) => [a.code, a.name, String(a.startMonth), String(a.endMonth), a.responsible, a.outputs]), C));
  children.push(h("مؤشرات القياس", 2, C));
  children.push(table(["المؤشر", "النوع", "خط الأساس", "المستهدف", "طريقة القياس", "النشاط"], x.indicators.map((i) => [i.name, i.typeLabel, i.baseline ?? "غير متوفر", `${i.target} ${i.unit}`, i.method, i.activity]), C));
  children.push(h("الشركاء", 2, C));
  children.push(x.partners.length ? table(["الشريك", "الحالة", "الدور", "المساهمة", "القيمة المتبادلة"], x.partners.map((pp) => [pp.name, pp.statusLabel, pp.role, pp.inKindDescription, pp.mutualValue]), C) : p("لا يوجد شركاء."));
  children.push(h("الميزانية", 2, C));
  children.push(table(["البند", "النشاط", "الوحدة", "الكمية", "تكلفة الوحدة", "الفترات", "الإجمالي (ر.س)", "المصدر", "النوع"], x.budgetRows.map((l) => [l.item, l.activity, l.unit, l.qty, l.unitCost, l.calc === "RECURRING" ? String(l.periods) : "—", l.total, l.source, l.contribution]), C));
  children.push(table([], x.budget.map(([k, v]) => [k, v]), C));
  children.push(p("الصيغة: الإجمالي = الكمية × تكلفة الوحدة، وللبنود الدورية × عدد الفترات.", { size: 18, color: "4B5B54" }));

  const doc = new Document({
    creator: "قدمها",
    title: x.title,
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 900, right: 900 } } },
        headers: { default: new Header({ children: [p(m.isDraft ? "مسودة — " + x.title : x.title, { size: 16, color: "6B7A73" })] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                bidirectional: true,
                alignment: AlignmentType.CENTER,
                children: [run(`النسخة ${m.revisionNumber} — صفحة `, { size: 16 }), new TextRun({ children: [PageNumber.CURRENT], size: 16 }), run(" من ", { size: 16 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16 })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
