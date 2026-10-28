// إعدادات التشغيل — تُقرأ على الخادم فقط.
import "server-only";

export const config = {
  appEnv: process.env.APP_ENV ?? "development",
  isProduction: (process.env.APP_ENV ?? "development") === "production",
  storageDir: process.env.STORAGE_DIR ?? "./storage",
  ai: {
    // anthropic عند توفر المفتاح، وإلا demo
    provider: process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "demo"),
    model: process.env.AI_MODEL ?? "",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 90_000),
    maxRetries: Number(process.env.AI_MAX_RETRIES ?? 2),
    maxInputChars: Number(process.env.AI_MAX_INPUT_CHARS ?? 120_000),
    maxOutputTokens: Number(process.env.AI_MAX_OUTPUT_TOKENS ?? 16_000),
  },
  payments: {
    // simulated متاح خارج الإنتاج فقط
    mode: process.env.PAYMENTS_MODE ?? "simulated",
  },
  pdf: {
    chromiumPath: process.env.CHROMIUM_PATH || undefined,
  },
};

export function isDemoAI() {
  return config.ai.provider === "demo";
}

export function simulatedPaymentsAllowed() {
  return config.payments.mode === "simulated" && !config.isProduction;
}
