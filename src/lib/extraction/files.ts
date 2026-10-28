import JSZip from "jszip";

// حدود معلنة ومتحقق منها على الخادم
export const FILE_LIMITS = {
  maxBytes: 15 * 1024 * 1024,
  maxLogoBytes: 2 * 1024 * 1024,
  maxPdfPages: 80,
  extractionTimeoutMs: 30_000,
  maxChunkChars: 1500,
};

export const ACCEPTED_DOCS_LABEL = "PDF نصي، DOCX، TXT، XLSX — حتى 15 ميجابايت و80 صفحة";
export const ACCEPTED_LOGO_LABEL = "PNG أو JPEG أو WEBP — حتى 2 ميجابايت (SVG غير مقبول)";

export type DetectedType = "pdf" | "docx" | "xlsx" | "txt" | "png" | "jpeg" | "webp";

export const MIME: Record<DetectedType, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain; charset=utf-8",
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** يكتشف النوع من محتوى الملف لا من الاسم أو نوع MIME المرسل */
export async function detectFileType(buf: Buffer): Promise<DetectedType | null> {
  if (buf.length < 4) return buf.length > 0 && isLikelyText(buf) ? "txt" : null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf[0] === 0x89 && buf.subarray(1, 4).toString("latin1") === "PNG") return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "webp";
  if (buf[0] === 0x50 && buf[1] === 0x4b) {
    try {
      const zip = await JSZip.loadAsync(buf);
      if (zip.file("word/document.xml")) return "docx";
      if (zip.file("xl/workbook.xml")) return "xlsx";
    } catch {
      return null;
    }
    return null;
  }
  return isLikelyText(buf) ? "txt" : null;
}

function isLikelyText(buf: Buffer) {
  if (buf.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

export function isImage(t: DetectedType) {
  return t === "png" || t === "jpeg" || t === "webp";
}

export function sanitizeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[\u0000-\u001f<>:"|?*]/g, "_").slice(0, 150) || "file";
}
