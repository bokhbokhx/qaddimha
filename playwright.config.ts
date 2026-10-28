import { defineConfig } from "@playwright/test";

// اختبار المسار الكامل. يتطلب قاعدة بيانات مهيأة ببيانات تجريبية (npm run db:reset).
export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : undefined,
    screenshot: "only-on-failure",
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: "npm run start -- -p 3100", url: "http://localhost:3100/api/health", reuseExistingServer: true, timeout: 120_000 },
});
