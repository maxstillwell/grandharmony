export const SALES_TIME_ZONE = "Australia/Sydney";
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SALES_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
function wallTime(value: Date) {
  const parts = Object.fromEntries(formatter.formatToParts(value).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
export function salesDateInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? wallTime(date).slice(0, 16) : "";
}
export function parseSalesDate(value: unknown): Date | null {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error("Invalid date.");
  const local = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?::(\d{2}))?)?$/.exec(value);
  if (local) {
    const wall = `${local[1]}T${local[2] ?? "00:00"}:${local[3] ?? "00"}`;
    const guess = Date.parse(`${wall}Z`);
    if (!Number.isFinite(guess) || new Date(guess).toISOString().slice(0, 19) !== wall)
      throw new Error("Invalid date.");
    // Discover both offsets around a DST change, then require a unique instant.
    const offsets = new Set([-86400000, 0, 86400000].map(delta => {
      const sample = guess + delta;
      return Date.parse(`${wallTime(new Date(sample))}Z`) - sample;
    }));
    const matches = [...offsets].map(offset => new Date(guess - offset)).filter(date => wallTime(date) === wall);
    if (matches.length !== 1)
      throw new Error("This Sydney time is skipped or repeated by daylight saving. Choose another time or use an explicit UTC offset.");
    return matches[0];
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new Error("Invalid date. Include a time zone for an explicit timestamp.");
  if (new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) !== value.slice(0, 10) || Number(value.slice(11, 13)) > 23)
    throw new Error("Invalid date.");
  return new Date(value);
}
export function displaySalesDate(value: Date | string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-AU", { timeZone: SALES_TIME_ZONE, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
