import "server-only";
import { createHash } from "node:crypto";
import type { DocumentKind } from "@prisma/client";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { FILE_LIMITS, MIME, detectFileType, isImage, sanitizeFilename } from "@/lib/extraction/files";
import { EXTRACTION_HELP, ExtractionError, extractText } from "@/lib/extraction/text";

export class UploadError extends Error {}

export async function storeDocument(args: {
  organizationId: string;
  userId: string;
  filename: string;
  data: Buffer;
  kind: DocumentKind;
  label?: string | null;
  opportunityId?: string | null;
  expiresOn?: Date | null;
}) {
  const type = await detectFileType(args.data);
  if (!type) throw new UploadError("نوع الملف غير مدعوم. المقبول: PDF نصي، DOCX، TXT، XLSX، وصور PNG/JPEG/WEBP للشعار.");
  if (args.kind === "LOGO") {
    if (!isImage(type)) throw new UploadError("الشعار يجب أن يكون PNG أو JPEG أو WEBP. لا نقبل SVG لأسباب أمنية.");
    if (args.data.length > FILE_LIMITS.maxLogoBytes) throw new UploadError("حجم الشعار يتجاوز 2 ميجابايت.");
  } else {
    if (isImage(type)) throw new UploadError("الصور مقبولة للشعار فقط. لا تتوفر قراءة ضوئية (OCR) للمستندات المصورة.");
    if (args.data.length > FILE_LIMITS.maxBytes) throw new UploadError("حجم الملف يتجاوز 15 ميجابايت.");
  }
  const sha256 = createHash("sha256").update(args.data).digest("hex");
  const storageKey = await storage.put(args.organizationId.slice(0, 24).toLowerCase(), args.data, type);
  const doc = await db.document.create({
    data: {
      organizationId: args.organizationId,
      opportunityId: args.opportunityId ?? null,
      kind: args.kind,
      label: args.label ?? null,
      filename: sanitizeFilename(args.filename),
      mimeType: MIME[type],
      size: args.data.length,
      storageKey,
      sha256,
      uploadedById: args.userId,
      expiresOn: args.expiresOn ?? null,
      status: isImage(type) ? "EXTRACTED" : "UPLOADED",
    },
  });
  await audit({ organizationId: args.organizationId, userId: args.userId, action: "document.upload", targetType: "Document", targetId: doc.id });
  if (args.kind === "LOGO") {
    await db.organizationProfile.upsert({ where: { organizationId: args.organizationId }, create: { organizationId: args.organizationId, logoDocumentId: doc.id }, update: { logoDocumentId: doc.id } });
  }
  if (!isImage(type)) await extractDocumentText(doc.id, args.data);
  return db.document.findUniqueOrThrow({ where: { id: doc.id } });
}

/** استخراج النص وتقسيمه. الفشل يُسجَّل بوضوح ولا يحذف الملف. */
export async function extractDocumentText(documentId: string, data?: Buffer) {
  const doc = await db.document.update({ where: { id: documentId }, data: { status: "EXTRACTING", extractionError: null } });
  try {
    const buf = data ?? (await storage.get(doc.storageKey));
    const type = await detectFileType(buf);
    if (!type) throw new ExtractionError("UNSUPPORTED", EXTRACTION_HELP.UNSUPPORTED);
    const { chunks, pageCount } = await extractText(buf, type);
    await db.$transaction([
      db.documentChunk.deleteMany({ where: { documentId } }),
      db.documentChunk.createMany({ data: chunks.map((c) => ({ documentId, index: c.index, locator: c.locator, text: c.text })) }),
      db.document.update({ where: { id: documentId }, data: { status: "EXTRACTED", pageCount } }),
    ]);
  } catch (e) {
    const msg = e instanceof ExtractionError ? e.message : EXTRACTION_HELP.CORRUPT;
    await db.document.update({ where: { id: documentId }, data: { status: "FAILED", extractionError: msg } });
  }
}

/**
 * حذف مستند مع مشتقاته (المقاطع ونتائج الاستخراج تُحذف تتابعيًا).
 * المعلومات المؤكدة في الملف تبقى لكن يُزال ربطها بالمستند ويُشار إلى ذلك في المصدر.
 */
export async function deleteDocument(documentId: string, userId: string) {
  const doc = await db.document.findUniqueOrThrow({ where: { id: documentId } });
  await db.$transaction([
    db.fact.updateMany({ where: { sourceDocId: documentId }, data: { sourceDocId: null, sourceLocator: "مستند محذوف", sourceExcerpt: null } }),
    db.requirementAssessment.updateMany({ where: { evidenceDocId: documentId }, data: { evidenceDocId: null } }),
    db.partner.updateMany({ where: { evidenceDocId: documentId }, data: { evidenceDocId: null } }),
    db.organizationProfile.updateMany({ where: { logoDocumentId: documentId }, data: { logoDocumentId: null } }),
    db.document.delete({ where: { id: documentId } }),
  ]);
  await storage.remove(doc.storageKey);
  await audit({ organizationId: doc.organizationId, userId, action: "document.delete", targetType: "Document", targetId: documentId });
}

export async function getChunks(documentIds: string[], organizationId: string) {
  // عزل: لا نسترجع إلا مستندات هذه الجمعية
  const docs = await db.document.findMany({
    where: { id: { in: documentIds }, organizationId },
    include: { chunks: { orderBy: { index: "asc" } } },
  });
  return docs;
}
