import "server-only";
import { chromium, type Browser } from "playwright-core";
import { config } from "@/lib/env";

let browserPromise: Promise<Browser> | null = null;

async function browser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({ executablePath: config.pdf.chromiumPath, args: ["--no-sandbox"] }).catch((e) => {
      browserPromise = null;
      throw e;
    });
  }
  return browserPromise;
}

/** يحوّل HTML عربيًا إلى PDF عبر Chromium (تشكيل الحروف وRTL سليمان) */
export async function htmlToPdf(html: string, footerLabel: string): Promise<Buffer> {
  const b = await browser();
  const ctx = await b.newContext({ javaScriptEnabled: false });
  try {
    const page = await ctx.newPage();
    // منع أي طلب شبكي من المحتوى
    await page.route("**/*", (r) => (r.request().url().startsWith("data:") ? r.continue() : r.abort()));
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="width:100%;font-size:8px;color:#777;padding:0 16mm;display:flex;justify-content:space-between;font-family:sans-serif"><span>${footerLabel.replace(/[<>&]/g, "")}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await ctx.close();
  }
}
