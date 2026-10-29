import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // التطبيق ديناميكي ومصادق بالكامل؛ نستخدم نموذج العرض الديناميكي التقليدي (بدون Cache Components)
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["playwright-core", "exceljs", "mammoth", "unpdf", "bcryptjs", "docx", "jszip"],
  experimental: {
    // نطاقات Codespaces للتجربة؛ أضف نطاق الإنتاج عبر وكيل عكسي يمرر x-forwarded-host
    serverActions: { bodySizeLimit: "2mb", allowedOrigins: ["*.app.github.dev"] },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
