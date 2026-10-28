import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AuthError, requireApplication, requireOrg } from "@/lib/auth/guard";
import { rateLimit } from "@/lib/rate-limit";
import { storeDocument, UploadError } from "@/lib/services/documents";
import { FILE_LIMITS } from "@/lib/extraction/files";

const Kind = z.enum(["ORG_DOC", "ORG_LICENSE", "ORG_FINANCIAL", "ORG_PROFILE_DECK", "LOGO", "GRANT_GUIDE", "GRANT_FORM", "BUDGET_SHEET", "PARTNER_EVIDENCE", "OTHER"]);

/** رفع مستند: يتحقق الخادم من النوع الفعلي والحجم، ومن تبعية الطلب للجمعية */
export async function POST(req: Request) {
  try {
    const ctx = await requireOrg("EDITOR");
    if (!rateLimit(`upload:${ctx.user.id}`, 30, 10 * 60_000)) return NextResponse.json({ error: "عمليات رفع كثيرة. حاول بعد قليل." }, { status: 429 });
    const len = Number(req.headers.get("content-length") ?? 0);
    if (len > FILE_LIMITS.maxBytes + 1024 * 1024) return NextResponse.json({ error: "حجم الملف يتجاوز 15 ميجابايت." }, { status: 413 });
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "لم يُرفق ملف" }, { status: 400 });
    const kind = Kind.parse(form.get("kind"));
    let opportunityId: string | null = null;
    let orgId = ctx.orgId;
    const applicationId = form.get("applicationId");
    if (typeof applicationId === "string" && applicationId) {
      const a = await requireApplication(applicationId, "EDITOR");
      orgId = a.orgId;
      if (kind === "GRANT_GUIDE" || kind === "GRANT_FORM") {
        opportunityId = (await db.application.findUniqueOrThrow({ where: { id: applicationId } })).opportunityId;
      }
    }
    const expires = form.get("expiresOn");
    const doc = await storeDocument({
      organizationId: orgId, userId: ctx.user.id, filename: file.name, data: Buffer.from(await file.arrayBuffer()), kind,
      label: (form.get("label") as string | null)?.slice(0, 200) || null, opportunityId,
      expiresOn: typeof expires === "string" && /^\d{4}-\d{2}-\d{2}$/.test(expires) ? new Date(`${expires}T00:00:00+03:00`) : null,
    });
    return NextResponse.json({ id: doc.id, status: doc.status, extractionError: doc.extractionError });
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof UploadError) return NextResponse.json({ error: e.message }, { status: 400 });
    if (e instanceof z.ZodError) return NextResponse.json({ error: "نوع المستند غير صالح" }, { status: 400 });
    console.error("[upload]", e instanceof Error ? e.name : "unknown");
    return NextResponse.json({ error: "تعذر رفع الملف" }, { status: 500 });
  }
}
