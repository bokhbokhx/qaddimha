import { execSync } from "node:child_process";
import { rmSync } from "node:fs";

// قاعدة بيانات اختبار مستقلة تُنشأ من الصفر في كل تشغيل
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://qaddimha:qaddimha_dev@localhost:5432/qaddimha_test";
  const name = url.split("/").pop()!;
  if (!/test|e2e/.test(name)) throw new Error("اسم قاعدة الاختبار يجب أن يحتوي test");
  const admin = url.replace(/\/[^/]+$/, "/postgres");
  execSync(`psql "${admin}" -q -c 'DROP DATABASE IF EXISTS "${name}" WITH (FORCE);' -c 'CREATE DATABASE "${name}";'`, { stdio: "inherit" });
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
  rmSync("./storage-test", { recursive: true, force: true });
}
