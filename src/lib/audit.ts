import { db } from "@/lib/db";

/** يسجل العمليات المهمة دون محتوى حساس */
export async function audit(e: { organizationId?: string | null; userId?: string | null; action: string; targetType?: string; targetId?: string }) {
  try {
    await db.auditLog.create({ data: { ...e, organizationId: e.organizationId ?? null, userId: e.userId ?? null } });
  } catch {
    // لا نوقف العملية بسبب فشل السجل
  }
}
