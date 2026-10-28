// تحديد موضع دقيق (رقم الفقرة) لمقتطف داخل المقاطع المستخرجة.

export function preciseLocator(chunks: { locator: string; text: string }[], excerpt: string | null | undefined): string | null {
  if (!excerpt) return null;
  const needle = excerpt.trim();
  for (const c of chunks) {
    const lines = c.text.split("\n");
    const idx = lines.findIndex((l) => l.includes(needle));
    if (idx === -1) continue;
    const m = c.locator.match(/^(.*?)، (?:فقرة (\d+)|الفقرات (\d+)–(\d+))$/);
    if (!m) return c.locator;
    const start = Number(m[2] ?? m[3]);
    return `${m[1]}، فقرة ${start + idx}`;
  }
  // المقتطف قد يمتد على أكثر من سطر
  return chunks.find((c) => c.text.replace(/\n/g, " ").includes(needle))?.locator ?? null;
}
