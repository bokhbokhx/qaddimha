import { FILE_LIMITS } from "./files";

export interface Chunk {
  index: number;
  locator: string;
  text: string;
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

