import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // التطبيق ديناميكي ومصادق بالكامل؛ نستخدم نموذج العرض الديناميكي التقليدي (بدون Cache Components)
  cacheComponents: false,
  poweredByHeader: false,
  serverExternalPackages: ["playwright-core", "exceljs", "mammoth", "unpdf", "bcryptjs", "docx", "jszip"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
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
