export const fixtureHashes = {
  "unit02-first-change":
    "7b79aa19bc39847f18e6815d9223fa27d0136f9a30d96002fab74f5ec15e1a8a",
  a: "535a1c8eb1acebba36a237996ee955a6c6a436941a92dbd329decaa8de6afa76",
  b: "c647c3d6dc69bd65878ae957abeec3a830849a03d9c7cfaa73fa9039e11f6052",
} as const;
export const mediaKinds = [
  "floor-plan",
  "illustration",
  "presentation-board",
  "download",
  "context",
  "palette",
] as const;
export function mediaUrl(value: unknown, synthetic: boolean) {
  if (
    synthetic &&
    typeof value === "string" &&
    value.startsWith("fixture:") &&
    Object.hasOwn(fixtureHashes, value.slice(8))
  )
    return value;
  if (typeof value !== "string" || value.length > 2048)
    throw Error("A registered media URL is required.");
  const u = new URL(value);
  const origins = (
    process.env.SALES_MEDIA_ALLOWED_ORIGINS ??
    "https://www.grandharmony.com.au,https://golfview-maxstillwells-projects.vercel.app"
  ).split(",");
  if (
    u.protocol !== "https:" ||
    !origins.includes(u.origin) ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    !/\.(svg|png|jpe?g|webp|pdf)$/i.test(u.pathname) ||
    u.pathname.includes("\\") ||
    /[\u0000-\u001f]/.test(decodeURIComponent(u.pathname))
  )
    throw Error(
      "Use an allowed versioned storage origin and supported asset file, without query tokens.",
    );
  return u.href;
}
export function sourceComparison(
  previous: { sha256: string } | undefined,
  sha256: string,
  requested: unknown,
) {
  if (requested === "manual-review" || !previous) return "manual-review";
  const status = previous.sha256 === sha256 ? "unchanged" : "changed";
  if (requested && requested !== status)
    throw Error(
      "Declared comparison conflicts with the supplied checksums. Image/byte differences are not architectural verification.",
    );
  return status;
}
