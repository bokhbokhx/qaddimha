import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readSession } from "@/lib/auth/session";
import { storage } from "@/lib/storage";
import { contentDisposition } from "@/lib/http";


/** تنزيل مصرح: عضو الجمعية، أو خبير مُسند لمراجعة شاركت الجمعية هذا المستند فيها */
export async function GET(req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const { id } = await ctx.params;
  const s = await readSession();
  if (!s) return new NextResponse("غير مصرح", { status: 401 });
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new NextResponse("غير موجود", { status: 404 });
  const member = await db.membership.findUnique({ where: { userId_organizationId: { userId: s.userId, organizationId: doc.organizationId } } });
  let allowed = !!member;
  if (!allowed && s.user.platformRole === "EXPERT") {
    allowed = !!(await db.reviewRequest.findFirst({ where: { expertUserId: s.userId, sharedDocIds: { has: doc.id } } }));
  }
  if (!allowed) return new NextResponse("غير موجود", { status: 404 });
  const data = await storage.get(doc.storageKey);
  const inline = new URL(req.url).searchParams.get("inline") === "1" && doc.mimeType.startsWith("image/");
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": contentDisposition(doc.filename, inline),
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
