export const TIMEZONE = "Asia/Riyadh";

const dateTimeFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateFmt.format(typeof d === "string" ? new Date(d) : d);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("ar-SA-u-nu-latn").format(n);
}
