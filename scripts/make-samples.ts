// يولّد ملفات المثال التجريبية في samples/ — تُشغَّل مرة وتُحفظ الملفات في المستودع
// (بصماتها تُستخدم لتعرّف الوضع التجريبي عليها).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { chromium } from "playwright-core";
import {
  FINANCIALS_TEXT, GRANT_GUIDE_PARAGRAPHS, GRANT_UPDATE_TEXT, LICENSE_TEXT, ORG_PROFILE_PARAGRAPHS, PLEDGE_TEXT, SAMPLE_FILES,
} from "../src/lib/demo/content";

const out = (f: string) => path.join(process.cwd(), "samples", f);

async function docx(paragraphs: string[]) {
  const doc = new Document({
    creator: "qaddimha-samples",
    sections: [{ children: paragraphs.map((t) => new Paragraph({ bidirectional: true, children: [new TextRun({ text: t, rightToLeft: true, font: "Arial" })] })) }],
  });
  const buf = await Packer.toBuffer(doc);
  // تثبيت تواريخ الإنشاء ليست ضرورية: الملفات تُولد مرة واحدة وتُحفظ
  return buf;
}

async function main() {
  writeFileSync(out(SAMPLE_FILES.grantGuide), await docx(GRANT_GUIDE_PARAGRAPHS));
  writeFileSync(out(SAMPLE_FILES.orgProfile), await docx(ORG_PROFILE_PARAGRAPHS));
  writeFileSync(out(SAMPLE_FILES.grantUpdate), GRANT_UPDATE_TEXT, "utf8");

  const b = await chromium.launch();
  const page = await b.newPage();
  const fontDir = path.join(process.cwd(), "node_modules/@fontsource/ibm-plex-sans-arabic/files");
  const fontCss = `@font-face{font-family:P;src:url(file://${fontDir}/ibm-plex-sans-arabic-arabic-400-normal.woff2)}`;
  for (const [file, lines] of [
    [SAMPLE_FILES.license, LICENSE_TEXT],
    [SAMPLE_FILES.financials, FINANCIALS_TEXT],
    [SAMPLE_FILES.pledge, PLEDGE_TEXT],
  ] as const) {
    await page.setContent(`<html dir="rtl" lang="ar"><style>${fontCss}body{font-family:P,sans-serif;font-size:16pt;padding:30mm}</style>${lines.map((l) => `<p>${l}</p>`).join("")}</html>`, { waitUntil: "load" });
    writeFileSync(out(file), await page.pdf({ format: "A4" }));
  }
  await page.setViewportSize({ width: 256, height: 256 });
  await page.setContent(`<html><body style="margin:0"><div style="width:256px;height:256px;background:#0f3d2e;display:flex;align-items:center;justify-content:center;font-family:P"><style>${fontCss}</style><span style="color:#d6b25e;font:700 120px P">أثر</span></div></body></html>`, { waitUntil: "load" });
  writeFileSync(out(SAMPLE_FILES.logo), await page.screenshot({ omitBackground: false }));
  await b.close();
  console.log("samples written");
}

main();
