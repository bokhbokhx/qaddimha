import "server-only";
import { config } from "@/lib/env";

// واجهة إرسال بريد قابلة للاستبدال. لا يوجد مزود بريد مفعّل في هذه النسخة:
// في التطوير تُكتب الرسالة في سجل الخادم ويُعرض الرابط في الواجهة موسومًا «بيئة التطوير فقط».
export interface Mailer {
  configured: boolean;
  send(msg: { to: string; subject: string; text: string }): Promise<void>;
}

class DevConsoleMailer implements Mailer {
  configured = false;
  async send(msg: { to: string; subject: string; text: string }) {
    if (config.isProduction) {
      console.warn("[mailer] لا يوجد مزود بريد مهيأ؛ لم تُرسل الرسالة");
      return;
    }
    console.info(`[mailer:dev] إلى ${msg.to} — ${msg.subject}\n${msg.text}`);
  }
}

export const mailer: Mailer = new DevConsoleMailer();

/** هل يُسمح بعرض روابط الرموز في الواجهة (بيئة التطوير فقط، عند غياب مزود بريد) */
export function showDevLinks() {
  return !config.isProduction && !mailer.configured;
}

/** عنوان التطبيق للروابط: من الإعداد APP_BASE_URL، وإلا من عنوان الطلب الحالي */
export async function appBaseUrl() {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
