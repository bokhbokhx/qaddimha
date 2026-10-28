import "server-only";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import mammoth from "mammoth";
import ExcelJS from "exceljs";
import { FILE_LIMITS, type DetectedType } from "./files";

export interface Chunk {
  index: number;
  locator: string;
  text: string;
}

export class ExtractionError extends Error {
  constructor(public code: "SCANNED_PDF" | "TOO_MANY_PAGES" | "EMPTY" | "UNSUPPORTED" | "TIMEOUT" | "CORRUPT", message: string) {
    super(message);
  }
}

export const EXTRACTION_HELP: Record<ExtractionError["code"], string> = {
  SCANNED_PDF:
    "يبدو أن ملف PDF ممسوح ضوئيًا ولا يحتوي نصًا قابلًا للنسخ. لا تتوفر قراءة ضوئية (OCR) في هذه النسخة. الخيارات: ارفع نسخة نصية من الملف، أو ملف DOCX، أو الصق النص، أو أدخل البيانات يدويًا.",
  TOO_MANY_PAGES: `عدد الصفحات يتجاوز ${FILE_LIMITS.maxPdfPages} صفحة. قسّم الملف أو ارفع الأجزاء المهمة فقط.`,
  EMPTY: "لم نجد نصًا في الملف. تأكد من الملف أو أدخل البيانات يدويًا.",
  UNSUPPORTED: "نوع الملف غير مدعوم للاستخراج.",
  TIMEOUT: "استغرقت المعالجة وقتًا أطول من المسموح. جرّب ملفًا أصغر أو الصق النص.",
  CORRUPT: "تعذّرت قراءة الملف. قد يكون تالفًا أو محميًا بكلمة مرور.",
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new ExtractionError("TIMEOUT", EXTRACTION_HELP.TIMEOUT)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** يقسم نص صفحة/قسم إلى فقرات ثم مقاطع بحجم محدود مع مرجع دقيق */
export function chunkPages(pages: { label: string; text: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  for (const page of pages) {
    const paras = page.text.split(/\n\s*\n|\r?\n/).map((p) => p.replace(/[ \t]+/g, " ").trim()).filter(Boolean);
    let buf: string[] = [];
    let start = 1;
    const flush = (end: number) => {
      if (!buf.length) return;
      const range = start === end ? `فقرة ${start}` : `الفقرات ${start}–${end}`;
      chunks.push({ index: chunks.length, locator: `${page.label}، ${range}`, text: buf.join("\n") });
      buf = [];
    };
    paras.forEach((p, i) => {
      const n = i + 1;
      const size = buf.reduce((a, b) => a + b.length, 0);
      if (buf.length && size + p.length > FILE_LIMITS.maxChunkChars) {
        flush(n - 1);
        start = n;
      }
      if (!buf.length) start = n;
      buf.push(p.slice(0, FILE_LIMITS.maxChunkChars * 2));
    });
    flush(paras.length);
  }
  return chunks;
}

export async function extractText(buf: Buffer, type: DetectedType): Promise<{ chunks: Chunk[]; pageCount: number | null }> {
  return withTimeout(doExtract(buf, type), FILE_LIMITS.extractionTimeoutMs);
}

async function doExtract(buf: Buffer, type: DetectedType) {
  let pages: { label: string; text: string }[] = [];
  let pageCount: number | null = null;
  try {
    if (type === "pdf") {
      const { getDocumentProxy, extractText: pdfText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      pageCount = pdf.numPages;
      if (pdf.numPages > FILE_LIMITS.maxPdfPages) throw new ExtractionError("TOO_MANY_PAGES", EXTRACTION_HELP.TOO_MANY_PAGES);
      const viaPoppler = await pdftotextPages(buf);
      if (viaPoppler) {
        pages = viaPoppler.map((t, i) => ({ label: `صفحة ${i + 1}`, text: t }));
      } else {
        const { text } = await pdfText(pdf, { mergePages: false });
        pages = (text as string[]).map((t, i) => ({ label: `صفحة ${i + 1}`, text: t.split("\n").map(fixVisualArabic).join("\n") }));
      }
      const total = pages.reduce((a, p) => a + p.text.replace(/\s/g, "").length, 0);
      if (total < 20 * Math.max(1, pageCount)) throw new ExtractionError("SCANNED_PDF", EXTRACTION_HELP.SCANNED_PDF);
    } else if (type === "docx") {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      pages = [{ label: "المستند", text: value }];
    } else if (type === "txt") {
      pages = [{ label: "النص", text: buf.toString("utf8").replace(/^﻿/, "") }];
    } else if (type === "xlsx") {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
      wb.eachSheet((ws) => {
        const lines: string[] = [];
        ws.eachRow((row, rn) => {
          const vals = (row.values as unknown[]).slice(1).map(cellText).filter((v) => v !== "");
          if (vals.length) lines.push(`صف ${rn}: ${vals.join(" | ")}`);
        });
        pages.push({ label: `ورقة «${ws.name}»`, text: lines.join("\n") });
      });
    } else {
      throw new ExtractionError("UNSUPPORTED", EXTRACTION_HELP.UNSUPPORTED);
    }
  } catch (e) {
    if (e instanceof ExtractionError) throw e;
    throw new ExtractionError("CORRUPT", EXTRACTION_HELP.CORRUPT);
  }
  const chunks = chunkPages(pages);
  if (!chunks.length) throw new ExtractionError("EMPTY", EXTRACTION_HELP.EMPTY);
  return { chunks, pageCount };
}

function cellText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return String(o.result ?? "");
    if ("richText" in o && Array.isArray(o.richText)) return o.richText.map((r: { text: string }) => r.text).join("");
    if ("text" in o) return String(o.text);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
  }
  return String(v).trim();
}

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

/**
 * استخراج PDF عبر pdftotext (Poppler) إن توفر على الخادم — أدق ترتيبًا للعربية.
 * يعيد null إن لم يتوفر، فنستخدم pdf.js مع معالجة الترتيب البصري.
 */
async function pdftotextPages(buf: Buffer): Promise<string[] | null> {
  const dir = await mkdtemp(path.join(tmpdir(), "qd-"));
  const file = path.join(dir, "in.pdf");
  try {
    await writeFile(file, buf);
    const out = await new Promise<string | null>((resolve) => {
      execFile("pdftotext", ["-enc", "UTF-8", file, "-"], { timeout: 20_000, maxBuffer: 20 * 1024 * 1024 }, (err, stdout) =>
        resolve(err ? null : stdout),
      );
    });
    if (out == null) return null;
    return out
      .split("\f")
      .map((p) => fixPopplerArabic(p))
      .filter((p, i, arr) => p.trim() || i < arr.length - 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** إزالة علامات الاتجاه، وتصحيح انعكاس «لا/لأ/لإ/لآ» بعد أداة التعريف الذي ينتج عن بعض الخطوط */
export function fixPopplerArabic(t: string): string {
  return t
    .replace(/[\u202A-\u202E\u200E\u200F\u2066-\u2069]/g, "")
    .replace(/ا([أإآا])ل/g, "ال$1")
    .replace(/[ \t]{2,}/g, " ");
}
