import { expect, test, type Page } from "@playwright/test";

// مسار كامل: دخول ← ملف جمعية ← منحة ← مراجعة استخراج ← أهلية ← فكرة ← مشروع ← ميزانية ← تعديل ← تحقق ← اعتماد ← شراء ← تصدير ← مراجعة خبير
const PASSWORD = "Demo#Qaddimha2026";

async function login(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

/** ينقر كل الأزرار المطابقة واحدًا تلو الآخر حتى تختفي */
async function clickAll(page: Page, name: string | RegExp) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name }).first()).toBeVisible();
  for (let i = 0; i < 40; i++) {
    const btn = page.getByRole("button", { name }).first();
    if (!(await btn.isVisible().catch(() => false))) return i;
    const before = await page.getByRole("button", { name }).count();
    await btn.click();
    await expect.poll(async () => page.getByRole("button", { name }).count(), { timeout: 30_000 }).toBeLessThan(before);
  }
  throw new Error("لم تختفِ الأزرار");
}

async function act(page: Page, name: string | RegExp) {
  await page.getByRole("button", { name }).first().click();
}

test("المسار الكامل للطلب", async ({ page, request }) => {
  await login(page, "owner@demo.qaddimha.test");
  await expect(page.getByRole("heading", { name: /مرحبًا/ })).toBeVisible();

  // ملف الجمعية: تأكيد معلومة مستخرجة + إكمال المستندات الناقصة من ملفات المثال
  await page.goto("/app/organization");
  await act(page, "تأكيد كما هي");
  await expect(page.getByText("تم الحفظ").first()).toBeVisible();
  await act(page, "أضف القوائم المالية التجريبية");
  await expect(page.getByRole("button", { name: "أضف القوائم المالية التجريبية" })).toHaveCount(0);
  await act(page, "أضف خطاب التعهد التجريبي");
  await expect(page.getByRole("button", { name: "أضف خطاب التعهد التجريبي" })).toHaveCount(0);

  // طلب جديد بالمنحة التجريبية
  await page.goto("/app/applications/new");
  await page.fill("#title", "طلب اختبار المسار الكامل");
  await page.getByRole("button", { name: "التالي: أضف فرصة التمويل" }).click();
  await page.getByRole("button", { name: "إنشاء الطلب" }).click();
  await page.waitForURL(/\/opportunity\?created=1/, { timeout: 90_000 });
  const appUrl = page.url().replace(/\/opportunity.*/, "");
  await expect(page.getByText("حُلل", { exact: true }).first()).toBeVisible();

  // تعارض بين مصدرين
  await act(page, "أضف التعميم التجريبي");
  await expect(page.getByRole("button", { name: "أضف التعميم التجريبي" })).toHaveCount(0);
  await expect(page.getByText("حُلل", { exact: true })).toHaveCount(2);

  // مراجعة الاستخراج
  await page.goto(`${appUrl}/extraction`);
  await expect(page.getByText(/تعارضات: 1/)).toBeVisible();
  await page.getByRole("button", { name: /^تأكيد \d+ معلومة مستخرجة$/ }).click();
  await expect(page.getByRole("button", { name: /^تأكيد \d+ معلومة مستخرجة$/ })).toHaveCount(0);
  await page.getByRole("button", { name: "اعتماد هذه القيمة" }).first().click();
  await expect(page.getByText(/تعارضات: 0/)).toBeVisible();

  // المدخلات المؤثرة
  await page.fill("#kp-b", "150");
  await page.fill("#kp-d", "12");
  await page.fill("#kp-r", "منطقة الرياض");
  await act(page, "حفظ وتحليل الأثر");
  await expect(page.getByRole("button", { name: "حفظ وتحليل الأثر" })).toHaveCount(0);

  // الأهلية: الشروط اليدوية تحتاج قرارًا مع دليل
  await page.goto(`${appUrl}/eligibility`);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "سجّل قرارك مع الدليل" }).first().click();
    await page.getByLabel("الدليل").fill("برنامج «مهارتي» للشباب منذ 2022 وفق التقرير السنوي (تجريبي)");
    await page.getByRole("button", { name: "حفظ", exact: true }).click();
    await expect(page.getByRole("button", { name: "سجّل قرارك مع الدليل" })).toHaveCount(1 - i);
  }
  await expect(page.getByText("أن تكون الجهة جمعية أهلية أو مؤسسة أهلية مسجلة")).toBeVisible();

  // الفكرة
  await page.goto(`${appUrl}/idea`);
  const fill = { "ii-problem": "فجوة المهارات الرقمية لدى الشباب الباحثين عن عمل", "ii-need_evidence": "استبيان الجمعية 2025 (تجريبي)", "ii-beneficiaries": "الشباب 18–29", "ii-beneficiary_count": "150", "ii-region": "منطقة الرياض", "ii-duration": "12" };
  for (const [id, v] of Object.entries(fill)) await page.fill(`#${id}`, v);
  await act(page, "حفظ المدخلات");
  await expect(page.getByText("تم الحفظ")).toBeVisible();
  await act(page, "اسأل المساعد");
  await expect(page.getByText("مسارات مقترحة")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "استخدم هذا المسار كملخص" }).first().click();
  await act(page, "اعتماد الملخص");
  await expect(page.getByText("اعتُمد ملخص الفكرة")).toBeVisible();

  // المشروع
  await page.goto(`${appUrl}/project`);
  await act(page, "أنشئ مسودة المشروع");
  await expect(page.getByText("مقترح من المساعد").first()).toBeVisible({ timeout: 60_000 });
  const problem = page.locator("textarea[id$='sec:problem']");
  await problem.fill("يواجه عدد من الشباب الباحثين عن عمل في منطقة الرياض فجوة في المهارات الرقمية. دليل الحاجة: استبيان الجمعية لعام 2025 على 400 مشارك (بيانات تجريبية).");
  await problem.blur();
  await expect(page.getByText("تم الحفظ تلقائيًا").first()).toBeVisible();
  await page.reload();
  await clickAll(page, /^اعتماد القسم$/);
  await clickAll(page, /^اعتماد$/);

  // الميزانية: اقتراح تقديري ثم معالجة البند المستبعد واعتماد البنود
  await page.goto(`${appUrl}/budget`);
  await act(page, "اقترح بنودًا تقديرية");
  await expect(page.getByText("بند مستبعد في شروط المنحة")).toBeVisible({ timeout: 60_000 });
  const row = page.getByRole("row", { name: /ضيافة ورش العمل/ });
  await row.getByRole("button", { name: "تعديل" }).click();
  await page.selectOption("#bl-src", "SELF");
  await act(page, "حفظ وإعادة الحساب");
  await expect(page.getByText("بند مستبعد في شروط المنحة")).toHaveCount(0);
  await act(page, "اعتماد كل البنود المعروضة");
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(page.getByText("بنود تقديرية")).toHaveCount(0);
  await expect(page.getByText("487,000.00 ر.س").first()).toBeVisible();

  // الإجابات
  await page.goto(`${appUrl}/answers`);
  await page.getByRole("button", { name: /أنشئ مسودات/ }).click();
  await expect(page.getByText("مسودة من المساعد").first()).toBeVisible({ timeout: 60_000 });
  await clickAll(page, /^اعتماد الإجابة$/);

  // تعديل مترابط: تغيير عدد المستفيدين
  await page.fill("#kp-b", "200");
  await act(page, "حفظ وتحليل الأثر");
  await expect(page.getByText("أقسام وُسمت «تحتاج مراجعة»")).toBeVisible();
  await page.goto(`${appUrl}/budget`);
  // مواد تدريبية: 200 × 200 = 40,000 (تُعاد فورًا)
  await expect(page.getByRole("row", { name: /مواد تدريبية/ })).toContainText("40,000.00");
  await page.goto(`${appUrl}/changes`);
  await clickAll(page, /^تطبيق المقترح$/);
  await page.goto(`${appUrl}/project`);
  await clickAll(page, /^اعتماد القسم$/);
  await clickAll(page, /^اعتماد$/);
  await page.goto(`${appUrl}/answers`);
  await clickAll(page, /^اعتماد الإجابة$/);

  // الجاهزية والاعتماد
  await page.goto(`${appUrl}/readiness`);
  await expect(page.getByText("جاهز للتقديم").first()).toBeVisible();
  await page.fill("#rev-label", "نسخة التقديم");
  await act(page, "اعتماد نسخة من الحالة الحالية");
  await expect(page.getByText(/وهي جاهزة للتقديم/)).toBeVisible();

  // الشراء التجريبي
  await page.goto(`${appUrl}/purchase`);
  await page.getByRole("button", { name: "إنشاء طلب شراء" }).first().click();
  await expect(page.getByText("محاكاة — لا يتم تحصيل مبلغ").first()).toBeVisible();
  await act(page, "محاكاة دفع ناجح");
  await expect(page.getByText(/مدفوع \(محاكاة/)).toBeVisible();

  // التصدير
  await page.goto(`${appUrl}/export`);
  await expect(page.getByText("النسخة جاهزة والحزمة مدفوعة")).toBeVisible();
  await page.getByRole("button", { name: /إنشاء ملفات النسخة/ }).click();
  await expect(page.getByRole("link", { name: "حزمة التقديم كاملة (ZIP)" })).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText("نهائي").first()).toBeVisible();
  const pdfHref = await page.getByRole("link", { name: "وثيقة المشروع (PDF)" }).first().getAttribute("href");
  const res = await page.request.get(pdfHref!);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
  // غير المصرح لا ينزل المخرجات
  const anon = await request.get(pdfHref!);
  expect(anon.status()).toBe(401);

  // مراجعة الخبير
  await page.goto(`${appUrl}/purchase`);
  await page.getByRole("button", { name: "إنشاء طلب شراء" }).first().click();
  await expect(page.getByRole("button", { name: "محاكاة دفع ناجح" })).toBeVisible();
  await act(page, "محاكاة دفع ناجح");
  await expect(page.getByRole("button", { name: "محاكاة دفع ناجح" })).toHaveCount(0);
  await page.goto(`${appUrl}/review`);
  await page.getByLabel(/أوافق على منح الخبير/).check();
  await act(page, "إرسال طلب المراجعة");
  await expect(page.getByText("بانتظار الإسناد")).toBeVisible();

  await login(page, "admin@demo.qaddimha.test");
  await page.goto("/ops");
  await page.getByRole("button", { name: /إسناد إلى/ }).first().click();
  await expect(page.getByRole("button", { name: /مسند إلى/ }).first()).toBeVisible();

  await login(page, "expert@demo.qaddimha.test");
  await page.getByRole("link", { name: "طلب اختبار المسار الكامل" }).first().click();
  await page.getByLabel("التعليق").fill("اقترح إضافة مصدر منشور لدليل الحاجة.");
  await act(page, /^إرسال$/);
  await expect(page.getByText("اقترح إضافة مصدر منشور")).toBeVisible();
  await act(page, "إنهاء المراجعة");
  await page.getByRole("dialog").getByRole("button", { name: "تأكيد" }).click();
  await expect(page.getByText("مكتمل")).toBeVisible();

  await login(page, "owner@demo.qaddimha.test");
  await page.goto(`${appUrl}/review`);
  await expect(page.getByText("اقترح إضافة مصدر منشور")).toBeVisible();
});

test("القارئ لا يرى أزرار التعديل ومستخدم جمعية أخرى لا يصل للطلب", async ({ page }) => {
  await login(page, "owner@demo.qaddimha.test");
  await page.goto("/app");
  const href = await page.getByRole("link", { name: "متابعة الطلب" }).first().getAttribute("href");
  await login(page, "viewer@demo.qaddimha.test");
  await page.goto(`${href}/project`);
  await expect(page.getByRole("button", { name: "اعتماد القسم" })).toHaveCount(0);
  await login(page, "other@demo.qaddimha.test");
  await page.goto(`${href}/project`);
  // مع البث قد يكون رمز الحالة 200، لكن المحتوى لا يُعرض إطلاقًا
  await expect(page.getByRole("heading", { name: "الصفحة غير موجودة" })).toBeVisible();
  await expect(page.getByText("طلب اختبار المسار الكامل")).toHaveCount(0);
  const exp = await page.request.get(`${href}/export`);
  expect(await exp.text()).not.toContain("الملخص التنفيذي");
});

test("دعوة عضو جديد وإعادة تعيين كلمة المرور", async ({ page }) => {
  await login(page, "owner@demo.qaddimha.test");
  await page.goto("/app/organization/members");
  const email = `editor-${Date.now()}@demo.qaddimha.test`;
  await page.fill("#inv-email", email);
  await page.selectOption("#inv-role", "EDITOR");
  await page.getByRole("button", { name: "إنشاء دعوة" }).click();
  const link = await page.locator("code").first().textContent();
  expect(link).toContain("/invite/");

  await page.context().clearCookies();
  await page.goto(new URL(link!).pathname);
  await expect(page.getByRole("heading", { name: /دعوة للانضمام/ })).toBeVisible();
  await page.fill("#name", "محرر جديد");
  await page.fill("#password", "Editor#Pass2026");
  await page.getByRole("button", { name: "إنشاء الحساب والانضمام" }).click();
  await page.waitForURL("**/app");
  await expect(page.getByText("محرر جديد · محرر")).toBeVisible();

  // نسيت كلمة المرور (رابط بيئة التطوير لغياب مزود البريد)
  await page.context().clearCookies();
  await page.goto("/forgot-password");
  await page.fill("#email", email);
  await page.getByRole("button", { name: "أرسل رابط إعادة التعيين" }).click();
  await page.getByRole("link", { name: "افتح رابط إعادة التعيين" }).click();
  await page.fill("#password", "Editor#New2026x");
  await page.fill("#confirm", "Editor#New2026x");
  await page.getByRole("button", { name: "حفظ كلمة المرور" }).click();
  await page.waitForURL(/\/login\?reset=1/);
  await page.fill("#email", email);
  await page.fill("#password", "Editor#New2026x");
  await page.click("button[type=submit]");
  await page.waitForURL("**/app");
});
