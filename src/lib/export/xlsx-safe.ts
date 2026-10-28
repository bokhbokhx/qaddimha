/** منع حقن الصيغ في الخلايا النصية (CSV/Excel formula injection) */
export function safeText(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

