import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { storage } from "@/lib/storage";
import { contentDisposition } from "@/lib/http";

const MIME: Record<string, string> = {
  PDF: "application/pdf", CHECKLIST_PDF: "application/pdf", SUMMARY_PDF: "application/pdf",
  DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ANSWERS_TXT: "text/plain; charset=utf-8", ZIP: "application/zip",
};

export async function GET(_req: Request, ctx: RouteContext<"/api/exports/[id]">) {
  const { id } = await ctx.params;
  const s = await readSession();
  if (!s) return new NextResponse("غير مصرح", { status: 401 });
  const exp = await db.export.findUnique({ where: { id }, include: { application: { select: { organizationId: true } } } });
  if (!exp) return new NextResponse("غير موجود", { status: 404 });
  const member = await db.membership.findUnique({ where: { userId_organizationId: { userId: s.userId, organizationId: exp.application.organizationId } } });
  if (!member) return new NextResponse("غير موجود", { status: 404 });
  const data = await storage.get(exp.storageKey);
  return new NextResponse(new Uint8Array(data), {
    headers: { "Content-Type": MIME[exp.format], "Content-Disposition": contentDisposition(exp.filename), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
