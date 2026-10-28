import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import JSZip from "jszip";
import { beforeAll, describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { verifyPassword, hashPassword } = await import("@/lib/auth/password");
const M = await import("@/lib/services/members");
const P = await import("@/lib/services/passwords");
const { storeDocument } = await import("@/lib/services/documents");
const { projectDocx } = await import("@/lib/export/docx");
const { projectDocumentHtml } = await import("@/lib/export/html");
const { exportModel } = await import("@/lib/export/common");
const { readySnapshot } = await import("../fixtures");

let orgId: string, owner: { id: string }, other: { id: string };

beforeAll(async () => {
  owner = await db.user.create({ data: { email: `owner-${randomBytes(4).toString("hex")}@m.test`, name: "مالك", passwordHash: await hashPassword("old-password-123") } });
  other = await db.user.create({ data: { email: `inv-${randomBytes(4).toString("hex")}@m.test`, name: "مدعو", passwordHash: "x" } });
  orgId = (await db.organization.create({ data: { displayName: "جمعية الأعضاء", memberships: { create: { userId: owner.id, role: "OWNER" } }, profile: { create: {} } } })).id;
});

describe("الدعوات والأدوار", () => {
  it("الدعوة تُخزن بتجزئتها وتُقبل فقط بالبريد المطابق ومرة واحدة", async () => {
    const otherEmail = (await db.user.findUniqueOrThrow({ where: { id: other.id } })).email;
    const { token, invitation } = await M.createInvitation({ organizationId: orgId, invitedById: owner.id, email: otherEmail.toUpperCase(), role: "EDITOR" });
    expect(invitation.tokenHash).not.toBe(token);
    expect(invitation.email).toBe(otherEmail);
    await expect(M.acceptInvitation(token, owner.id)).rejects.toThrow(/موجهة إلى/);
    await M.acceptInvitation(token, other.id);
    expect((await db.membership.findFirstOrThrow({ where: { userId: other.id, organizationId: orgId } })).role).toBe("EDITOR");
    await expect(M.acceptInvitation(token, other.id)).rejects.toThrow(/غير صالحة/);
  });
  it("الدعوة الملغاة أو المنتهية لا تعمل", async () => {
    const { token, invitation } = await M.createInvitation({ organizationId: orgId, invitedById: owner.id, email: "x1@m.test", role: "VIEWER" });
    await M.revokeInvitation(orgId, invitation.id, owner.id);
    expect(await M.findInvitation(token)).toBeNull();
    const b = await M.createInvitation({ organizationId: orgId, invitedById: owner.id, email: "x2@m.test", role: "VIEWER" });
    await db.invitation.update({ where: { id: b.invitation.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await M.findInvitation(b.token)).toBeNull();
  });
  it("لا يمكن إزالة آخر مالك أو تخفيض دوره", async () => {
    const m = await db.membership.findFirstOrThrow({ where: { userId: owner.id, organizationId: orgId } });
    await expect(M.changeRole(orgId, m.id, "VIEWER", owner.id)).rejects.toThrow(/آخر مالك/);
    await expect(M.removeMember(orgId, m.id, owner.id)).rejects.toThrow(/آخر مالك/);
    const om = await db.membership.findFirstOrThrow({ where: { userId: other.id, organizationId: orgId } });
    await M.changeRole(orgId, om.id, "OWNER", owner.id);
    await M.changeRole(orgId, m.id, "VIEWER", owner.id);
    expect((await db.membership.findUniqueOrThrow({ where: { id: m.id } })).role).toBe("VIEWER");
  });
  it("لا يمكن إدارة عضو في جمعية أخرى", async () => {
    const foreign = await db.organization.create({ data: { displayName: "غريبة", memberships: { create: { userId: other.id, role: "OWNER" } } } });
    const fm = await db.membership.findFirstOrThrow({ where: { organizationId: foreign.id } });
    await expect(M.removeMember(orgId, fm.id, owner.id)).rejects.toThrow(/غير موجود/);
  });
});

describe("كلمات المرور", () => {
  it("التغيير يتطلب الكلمة الحالية وينهي الجلسات الأخرى", async () => {
    await db.session.createMany({ data: [{ id: "s-keep", userId: owner.id, expiresAt: new Date(Date.now() + 864e5) }, { id: "s-other", userId: owner.id, expiresAt: new Date(Date.now() + 864e5) }] });
    await expect(P.changePassword(owner.id, "s-keep", "wrong-password", "new-password-123")).rejects.toThrow(/غير صحيحة/);
    await expect(P.changePassword(owner.id, "s-keep", "old-password-123", "short")).rejects.toThrow(/10/);
    await P.changePassword(owner.id, "s-keep", "old-password-123", "new-password-123");
    expect(await db.session.findMany({ where: { userId: owner.id }, select: { id: true } })).toEqual([{ id: "s-keep" }]);
  });
  it("رمز إعادة التعيين لمرة واحدة ولا يكشف وجود الحساب", async () => {
    expect(await P.createPasswordReset("nobody@m.test")).toBeNull();
    const email = (await db.user.findUniqueOrThrow({ where: { id: owner.id } })).email;
    const r = (await P.createPasswordReset(email))!;
    await P.resetPassword(r.token, "reset-password-123");
    const u = await db.user.findUniqueOrThrow({ where: { id: owner.id } });
    expect(await verifyPassword("reset-password-123", u.passwordHash)).toBe(true);
    expect(await db.session.count({ where: { userId: owner.id } })).toBe(0);
    await expect(P.resetPassword(r.token, "another-password-1")).rejects.toThrow(/غير صالح/);
  });
});

describe("الهوية البصرية في المخرجات", () => {
  it("الشعار واللون الأساسي يظهران في PDF وDOCX", async () => {
    const logo = await readFile("samples/athar-logo-demo.png");
    const doc = await storeDocument({ organizationId: orgId, userId: owner.id, filename: "logo.png", data: logo, kind: "LOGO" });
    expect((await db.organizationProfile.findUniqueOrThrow({ where: { organizationId: orgId } })).logoDocumentId).toBe(doc.id);
    const meta = { revisionNumber: 1, revisionId: "rev1", revisionLabel: "", exportedAt: new Date(), isDraft: false, draftReason: null, isDemo: false, brand: { primary: "#7a1f5c", logo: { buffer: logo, type: "png" as const } } };
    const model = exportModel(readySnapshot());
    const html = projectDocumentHtml(model, meta);
    expect(html).toContain("#7a1f5c");
    expect(html).toContain("data:image/png;base64,");
    const zip = await JSZip.loadAsync(await projectDocx(model, meta));
    expect(Object.keys(zip.files).some((f) => f.startsWith("word/media/"))).toBe(true);
    expect(await zip.file("word/document.xml")!.async("string")).toContain("7A1F5C");
    // لون غير صالح لا يُحقن في CSS
    expect(projectDocumentHtml(model, { ...meta, brand: { primary: "red;}</style><script>", logo: null } })).not.toContain("<script>");
  });
});
