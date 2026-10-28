import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { hashPassword, PASSWORD_MIN, verifyPassword } from "@/lib/auth/password";
import { sha } from "./members";

const RESET_MINUTES = 60;

export class PasswordError extends Error {}

function validate(pw: string) {
  if (pw.length < PASSWORD_MIN) throw new PasswordError(`كلمة المرور ${PASSWORD_MIN} أحرف على الأقل`);
  if (pw.length > 200) throw new PasswordError("كلمة المرور طويلة جدًا");
}

/** تغيير كلمة المرور يُنهي الجلسات الأخرى */
export async function changePassword(userId: string, currentSessionId: string, current: string, next: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new PasswordError("كلمة المرور الحالية غير صحيحة");
  validate(next);
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } }),
    db.session.deleteMany({ where: { userId, id: { not: currentSessionId } } }),
  ]);
  await audit({ userId, action: "user.password_change" });
}

/** يعيد الرمز إن وُجد الحساب، وnull إن لم يوجد — الواجهة تعرض الرسالة نفسها في الحالتين */
export async function createPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) return null;
  await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
  const token = randomBytes(24).toString("base64url");
  await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) } });
  await audit({ userId: user.id, action: "user.password_reset_request" });
  return { token, email: user.email };
}

export async function resetPassword(token: string, next: string) {
  validate(next);
  const t = await db.passwordResetToken.findUnique({ where: { tokenHash: sha(token) } });
  if (!t || t.usedAt || t.expiresAt < new Date()) throw new PasswordError("رابط إعادة التعيين غير صالح أو منتهٍ");
  await db.$transaction([
    db.user.update({ where: { id: t.userId }, data: { passwordHash: await hashPassword(next) } }),
    db.passwordResetToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: t.userId } }),
  ]);
  await audit({ userId: t.userId, action: "user.password_reset" });
}
