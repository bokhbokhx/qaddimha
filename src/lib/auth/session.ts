import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { config } from "@/lib/env";

export const SESSION_COOKIE = "qaddimha_session";
const SESSION_DAYS = 14;

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** ينشئ جلسة: الرمز العشوائي في كعكة HttpOnly، وتجزئته فقط في قاعدة البيانات. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const membership = await db.membership.findFirst({ where: { userId }, orderBy: { createdAt: "asc" } });
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db.session.create({
    data: { id: hashToken(token), userId, expiresAt, activeOrganizationId: membership?.organizationId ?? null },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

export async function readSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, platformRole: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}
