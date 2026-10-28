import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUserPage } from "@/lib/auth/guard";

/** سياق الصفحات المصادقة: المستخدم والجمعية النشطة وعضويته فيها */
export async function orgPageContext() {
  const { user, activeOrganizationId } = await requireUserPage();
  if (user.platformRole === "EXPERT") redirect("/expert");
  const memberships = await db.membership.findMany({ where: { userId: user.id }, include: { organization: true }, orderBy: { createdAt: "asc" } });
  if (!memberships.length) {
    if (user.platformRole === "ADMIN") redirect("/ops");
    redirect("/no-organization");
  }
  const membership = memberships.find((m) => m.organizationId === activeOrganizationId) ?? memberships[0];
  return { user, memberships, membership, org: membership.organization, orgId: membership.organizationId, canEdit: membership.role !== "VIEWER", isOwner: membership.role === "OWNER" };
}

/** سياق صفحات الطلب: يتحقق من العضوية في جمعية الطلب على الخادم */
export async function appPageContext(applicationId: string) {
  const { notFound } = await import("next/navigation");
  const { user } = await requireUserPage();
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: { opportunity: true, organization: true },
  });
  if (!app) notFound();
  const membership = await db.membership.findUnique({ where: { userId_organizationId: { userId: user.id, organizationId: app!.organizationId } } });
  if (!membership) notFound();
  return { user, app: app!, membership: membership!, canEdit: membership!.role !== "VIEWER", isOwner: membership!.role === "OWNER" };
}
