import "server-only";
import JSZip from "jszip";
import type { ExportFormat } from "@prisma/client";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { audit } from "@/lib/audit";
import { computeReadiness } from "@/lib/domain/readiness";
import { exportModel, type ExportMeta } from "@/lib/export/common";
import { checklistHtml, projectDocumentHtml, summaryHtml } from "@/lib/export/html";
import { htmlToPdf } from "@/lib/export/pdf";
import { projectDocx } from "@/lib/export/docx";
import { budgetXlsx } from "@/lib/export/xlsx";
import { answersText } from "@/lib/export/answers";
import { getRevisionSnapshot } from "./revisions";
import { isPackagePaid } from "./payments";

const FILES: { format: ExportFormat; name: string; ext: string }[] = [
  { format: "PDF", name: "وثيقة-المشروع", ext: "pdf" },
  { format: "DOCX", name: "وثيقة-المشروع", ext: "docx" },
  { format: "XLSX", name: "الميزانية", ext: "xlsx" },
  { format: "ANSWERS_TXT", name: "إجابات-النموذج", ext: "txt" },
  { format: "CHECKLIST_PDF", name: "قائمة-المتطلبات", ext: "pdf" },
  { format: "SUMMARY_PDF", name: "الملخص-التنفيذي", ext: "pdf" },
];

/**
 * تُنشأ كل الصيغ من لقطة نسخة معتمدة واحدة — لا إعادة توليد مستقلة لكل صيغة.
 */
export async function generateExportPackage(applicationId: string, revisionId: string, userId: string) {
  const rev = await db.revision.findFirst({ where: { id: revisionId, applicationId, isApproved: true } });
  if (!rev) throw new Error("التصدير متاح من نسخة معتمدة فقط. اعتمد نسخة أولًا.");
  const s = getRevisionSnapshot(rev);
  const model = exportModel(s);
  const readiness = computeReadiness(s);
  const paid = await isPackagePaid(applicationId);
  const isDraft = !readiness.ready || !paid;
  const meta: ExportMeta = {
    revisionNumber: rev.number,
    revisionId: rev.id,
    revisionLabel: rev.label,
    exportedAt: new Date(),
    isDraft,
    draftReason: !readiness.ready ? `توجد ${readiness.blockers.length} عوائق` : !paid ? "معاينة قبل شراء الحزمة" : null,
    isDemo: s.organization.isDemo || s.opportunity.isDemo,
  };
  const footer = `Rev ${rev.number}${isDraft ? " — DRAFT" : ""}`;
  const buffers: Record<string, Buffer> = {
    PDF: await htmlToPdf(projectDocumentHtml(model, meta), footer),
    DOCX: await projectDocx(model, meta),
    XLSX: await budgetXlsx(model, meta),
    ANSWERS_TXT: Buffer.from(answersText(model, s, meta), "utf8"),
    CHECKLIST_PDF: await htmlToPdf(checklistHtml(model, meta), footer),
    SUMMARY_PDF: await htmlToPdf(summaryHtml(model, meta), footer),
  };
  const suffix = `-ن${rev.number}${isDraft ? "-مسودة" : ""}`;
  const zip = new JSZip();
  const created = [];
  for (const f of FILES) {
    const filename = `${f.name}${suffix}.${f.ext}`;
    zip.file(filename, buffers[f.format]);
    const key = await storage.put("exports", buffers[f.format], f.ext);
    created.push(await db.export.create({ data: { applicationId, revisionId: rev.id, format: f.format, storageKey: key, filename, isDraft, createdById: userId } }));
  }
  const zbuf = await zip.generateAsync({ type: "nodebuffer" });
  const zkey = await storage.put("exports", zbuf, "zip");
  created.push(await db.export.create({ data: { applicationId, revisionId: rev.id, format: "ZIP", storageKey: zkey, filename: `حزمة-التقديم${suffix}.zip`, isDraft, createdById: userId } }));
  const app = await db.application.findUniqueOrThrow({ where: { id: applicationId }, select: { organizationId: true } });
  await audit({ organizationId: app.organizationId, userId, action: "export.generate", targetType: "Revision", targetId: rev.id });
  return { exports: created, isDraft, meta };
}
