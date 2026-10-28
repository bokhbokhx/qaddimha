// بيانات تطوير تجريبية — جميع الأسماء والجهات وهمية. لا تُشغَّل في الإنتاج.
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEMO_ORG_NAME, SAMPLE_FILES, SAMPLE_LABELS } from "../src/lib/demo/content";
import { ORG_EXTRACTION } from "../src/lib/demo/fixtures";
import { extractDocumentText } from "../src/lib/services/documents";
import { preciseLocator } from "../src/lib/extraction/locate";

const db = new PrismaClient();
export const DEMO_PASSWORD = "Demo#Qaddimha2026";

if ((process.env.APP_ENV ?? "development") === "production") {
  console.error("رفض: لا تُنشأ حسابات تجريبية في الإنتاج");
  process.exit(1);
}

const storageDir = path.resolve(process.env.STORAGE_DIR ?? "./storage");

async function storeSample(organizationId: string, userId: string, key: keyof typeof SAMPLE_FILES, kind: Prisma.DocumentCreateInput["kind"], extra: Partial<Prisma.DocumentUncheckedCreateInput> = {}) {
  const buf = await readFile(path.join(process.cwd(), "samples", SAMPLE_FILES[key]));
  const ext = SAMPLE_FILES[key].split(".").pop()!;
  const storageKey = `${organizationId.slice(0, 24).toLowerCase()}/${randomBytes(16).toString("hex")}.${ext}`;
  await mkdir(path.dirname(path.join(storageDir, storageKey)), { recursive: true });
  await writeFile(path.join(storageDir, storageKey), buf);
  const mime: Record<string, string> = {
    pdf: "application/pdf", png: "image/png", txt: "text/plain; charset=utf-8",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  return db.document.create({
    data: {
      organizationId, kind, label: SAMPLE_LABELS[key], filename: SAMPLE_FILES[key], mimeType: mime[ext], size: buf.length, storageKey,
      sha256: createHash("sha256").update(buf).digest("hex"), uploadedById: userId, status: kind === "LOGO" ? "EXTRACTED" : "UPLOADED", ...extra,
    },
  });
}

async function main() {
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const mk = (email: string, name: string, platformRole: "USER" | "EXPERT" | "ADMIN" = "USER") =>
    db.user.upsert({ where: { email }, update: {}, create: { email, name, passwordHash: hash, platformRole } });

  const owner = await mk("owner@demo.qaddimha.test", "مالك تجريبي");
  const viewer = await mk("viewer@demo.qaddimha.test", "قارئ تجريبي");
  const other = await mk("other@demo.qaddimha.test", "مستخدم جمعية أخرى");
  await mk("expert@demo.qaddimha.test", "خبير تجريبي", "EXPERT");
  await mk("admin@demo.qaddimha.test", "مشغل المنصة التجريبي", "ADMIN");

  if (await db.organization.findFirst({ where: { displayName: DEMO_ORG_NAME } })) {
    console.log("البيانات التجريبية موجودة مسبقًا");
    return;
  }

  const org = await db.organization.create({
    data: {
      displayName: DEMO_ORG_NAME, isDemo: true,
      memberships: { create: [{ userId: owner.id, role: "OWNER" }, { userId: viewer.id, role: "VIEWER" }] },
      profile: { create: { version: 1, primaryColor: "#0f3d2e", secondaryColor: "#d6b25e" } },
    },
  });
  await db.organization.create({
    data: { displayName: "جمعية أخرى للاختبار (تجريبية)", isDemo: true, memberships: { create: [{ userId: other.id, role: "OWNER" }] }, profile: { create: {} } },
  });

  // الملف التعريفي التجريبي: تُحفظ المقاطع كما تستخرجها المنصة لاحقًا (تُعاد معالجتها عند التشغيل عبر seed:extract)
  const profileDoc = await storeSample(org.id, owner.id, "orgProfile", "ORG_PROFILE_DECK");
  await storeSample(org.id, owner.id, "license", "ORG_LICENSE", { expiresOn: new Date("2027-12-31T00:00:00Z") });
  const logo = await storeSample(org.id, owner.id, "logo", "LOGO");
  // نفس مسار الاستخراج المستخدم في التطبيق
  await extractDocumentText(profileDoc.id);
  const chunks = await db.documentChunk.findMany({ where: { documentId: profileDoc.id } });
  const lic = await db.document.findFirstOrThrow({ where: { organizationId: org.id, kind: "ORG_LICENSE" } });
  await extractDocumentText(lic.id);
  await db.organizationProfile.update({ where: { organizationId: org.id }, data: { logoDocumentId: logo.id } });

  // حقائق: بعضها مؤكد، بعضها مستخرج يحتاج تأكيدًا، وبعضها ناقص
  const confirmed = new Set(["legal_name", "entity_type", "registration_number", "mission", "specializations", "geographic_scope", "target_groups", "contact_email"]);
  for (const fld of ORG_EXTRACTION.fields) {
    const value = fld.results ?? fld.items ?? fld.text;
    await db.fact.create({
      data: {
        organizationId: org.id, scope: "ORG_PROFILE", scopeRef: "org", key: fld.key, value: value as Prisma.InputJsonValue,
        status: confirmed.has(fld.key) ? "CONFIRMED" : "EXTRACTED_UNCONFIRMED", sourceType: "DOCUMENT",
        sourceDocId: profileDoc.id, sourceLocator: preciseLocator(chunks, fld.excerpt), sourceExcerpt: fld.excerpt,
        confirmedById: confirmed.has(fld.key) ? owner.id : null, confirmedAt: confirmed.has(fld.key) ? new Date() : null,
      },
    });
  }
  for (const key of ["supervising_body", "contact_phone"]) {
    await db.fact.create({ data: { organizationId: org.id, scope: "ORG_PROFILE", scopeRef: "org", key, status: "MISSING", sourceType: "USER" } });
  }
  console.log("تم إنشاء البيانات التجريبية. كلمة المرور لجميع الحسابات:", DEMO_PASSWORD);
}

main().finally(() => db.$disconnect());
