export const unitStatuses = [
  "not_released",
  "available",
  "on_hold",
  "reserved",
  "contract_issued",
  "contract_signed",
  "unconditional",
  "settled",
  "withdrawn",
] as const;
export type UnitStatus = (typeof unitStatuses)[number];
export const leadStatuses = [
  "new",
  "contact_attempted",
  "contacted",
  "qualified",
  "inspection_arranged",
  "negotiating",
  "converted",
  "lost",
  "archived",
] as const;
const transitions: Record<UnitStatus, readonly UnitStatus[]> = {
  not_released: ["available", "withdrawn"],
  available: ["on_hold", "reserved", "withdrawn"],
  on_hold: ["available", "reserved", "withdrawn"],
  reserved: ["available", "contract_issued", "withdrawn"],
  contract_issued: ["reserved", "contract_signed", "withdrawn"],
  contract_signed: ["unconditional", "withdrawn"],
  unconditional: ["settled", "withdrawn"],
  settled: [],
  withdrawn: ["not_released"],
};
export function assertTransition(
  from: UnitStatus,
  to: string,
  reason: string,
): asserts to is UnitStatus {
  if (
    !transitions[from]?.includes(to as UnitStatus) ||
    !reason.trim() ||
    reason.length > 1000
  )
    throw new Error("Invalid sales transition or missing reason.");
}
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    uuidPattern.test(value) &&
    !value.startsWith("00000000-0000-4000-8000-")
  );
}
export function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected an object.");
  return input as Record<string, unknown>;
}
export function text(
  value: unknown,
  max: number,
  required = false,
): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error("A required value is missing.");
    return null;
  }
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)
  )
    throw new Error("Invalid text value.");
  const result = value.trim();
  if (required && !result) throw new Error("A required value is blank.");
  return result || null;
}
// Decimal strings stay decimal strings from form/API to PostgreSQL and export.
export function decimal(value: unknown, integerDigits = 12): string | null {
  if (value === "" || value === null || value === undefined) return null;
  if (
    typeof value !== "string" ||
    !new RegExp(`^(0|[1-9]\\d{0,${integerDigits - 1}})(\\.\\d{1,2})?$`).test(
      value,
    )
  )
    throw new Error(
      "Use a nonnegative decimal string with at most two decimal places.",
    );
  const [whole, fraction = ""] = value.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}
function count(value: unknown): number | null {
  if (value === "" || value === null || value === undefined) return null;
  const result =
    typeof value === "string" && /^\d{1,2}$/.test(value)
      ? Number(value)
      : value;
  if (
    typeof result !== "number" ||
    !Number.isInteger(result) ||
    result < 0 ||
    result > 99
  )
    throw new Error("Invalid room or floor count.");
  return result;
}
function idOrNull(value: unknown) {
  if (value === "" || value == null) return null;
  if (!validId(value)) throw new Error("Invalid identifier.");
  return value;
}
export function publicUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048)
    throw new Error("Invalid approved asset URL.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)
  )
    throw new Error(
      "Approved assets need a public HTTPS URL without signed queries or credentials.",
    );
  return url.href;
}
function stringList(value: unknown, urls = false) {
  if (value == null || value === "") return [];
  if (!Array.isArray(value) || value.length > 30)
    throw new Error("Invalid reference list.");
  return value.map((item) => (urls ? publicUrl(item) : text(item, 300, true)!));
}
export function validateUnit(input: unknown) {
  const row = record(input);
  const number = text(row.number, 40, true)!.toUpperCase();
  if (number.startsWith("TEST-") || /[\r\n]/.test(number))
    throw new Error("Fictional test numbers cannot enter inventory.");
  return {
    number,
    lot: text(row.lot, 80),
    housingType: text(row.housingType, 120),
    bedrooms: count(row.bedrooms),
    bathrooms: count(row.bathrooms),
    carSpaces: count(row.carSpaces),
    floorLevels: count(row.floorLevels),
    landAreaSqm: decimal(row.landAreaSqm, 10),
    buildingAreaSqm: decimal(row.buildingAreaSqm, 10),
    internalAreaSqm: decimal(row.internalAreaSqm, 10),
    outdoorAreaSqm: decimal(row.outdoorAreaSqm, 10),
    totalAreaSqm: decimal(row.totalAreaSqm, 10),
    constructionStageId: idOrNull(row.constructionStageId),
    releaseStageId: idOrNull(row.releaseStageId),
    internalNotes: text(row.internalNotes, 5000),
    features: stringList(row.features),
    floorPlans: stringList(row.floorPlans, true),
    media: stringList(row.media, true),
    specifications: stringList(row.specifications, true),
    sourceDocument: text(row.sourceDocument, 1000, true)!,
    validationWarnings: [
      ...(!row.housingType ? ["Housing type has not been supplied."] : []),
      ...(row.bedrooms == null || row.bedrooms === "" ? ["Bedroom count has not been supplied."] : []),
      ...(!row.landAreaSqm || !row.buildingAreaSqm ? ["Land or building area has not been supplied."] : []),
      ...(!Array.isArray(row.floorPlans) || !row.floorPlans.length ? ["Approved floor-plan references are pending."] : []),
    ],
    publicVisible: row.publicVisible === true,
  };
}
export function validatePrices(input: unknown) {
  const row = record(input);
  const gst = text(row.gstTreatment, 30) ?? "unconfirmed";
  if (
    ![
      "unconfirmed",
      "inclusive",
      "exclusive",
      "margin_scheme",
      "not_applicable",
    ].includes(gst)
  )
    throw new Error("Invalid GST treatment.");
  return {
    askingPrice: decimal(row.askingPrice),
    minimumPrice: decimal(row.minimumPrice),
    contractPrice: decimal(row.contractPrice),
    depositAmount: decimal(row.depositAmount),
    settlementAmount: decimal(row.settlementAmount),
    currency: "AUD",
    gstTreatment: gst,
    depositDueAt: dateOrNull(row.depositDueAt),
    settlementDueAt: dateOrNull(row.settlementDueAt),
  };
}
export function dateOrNull(value: unknown) {
  if (!value) return null;
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  )
    throw new Error("Invalid date.");
  return new Date(value);
}
export function validateEnquiry(input: unknown) {
  const row = record(input);
  const email = text(row.email, 254, true)!.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  const phone = text(row.phone, 40);
  if (phone && !/^[+\d ()-]{6,40}$/.test(phone))
    throw new Error("Invalid telephone number.");
  if (row.consent !== true || row.website)
    throw new Error(
      "Consent is required and the enquiry must pass spam checks.",
    );
  const unitIds = row.unitIds ?? [];
  if (!Array.isArray(unitIds) || unitIds.length > 10 || !unitIds.every(validId))
    throw new Error("Invalid interested units.");
  const preference = text(row.contactPreference, 20) ?? "email";
  if (
    !["email", "phone"].includes(preference) ||
    (preference === "phone" && !phone)
  )
    throw new Error("Invalid contact preference.");
  return {
    name: text(row.name, 120, true)!,
    email,
    phone,
    message: text(row.message, 4000, true)!,
    unitIds: [...new Set(unitIds)] as string[],
    privacyVersion: text(row.privacyVersion, 100, true)!,
    marketingConsent: row.marketingConsent === true,
    contactPreference: preference,
  };
}

export type PublicUnit = {
  id: string;
  number: string;
  housingType: string | null;
  status:
    | "coming_soon"
    | "available"
    | "under_offer"
    | "reserved"
    | "under_contract"
    | "sold";
  bedrooms: number | null;
  bathrooms: number | null;
  carSpaces: number | null;
  floorLevels: number | null;
  salesStage: string | null;
  constructionStage: string | null;
  landAreaSqm: string | null;
  buildingAreaSqm: string | null;
  internalAreaSqm: string | null;
  outdoorAreaSqm: string | null;
  totalAreaSqm: string | null;
  priceDisplay: string | null;
  features: string[];
  floorPlans: string[];
  media: string[];
  specifications: string[];
};
export type PublicSnapshot = {
  contractVersion: 1;
  projectKey: string;
  revision: number;
  units: PublicUnit[];
};
type SnapshotUnit = ReturnType<typeof validateUnit> & {
  id: string;
  status: UnitStatus;
  publicAskingPrice: string | null;
  publicPriceVisible: boolean;
  salesStage?: string | null;
  constructionStage?: string | null;
};
const availability: Partial<Record<UnitStatus, PublicUnit["status"]>> = {
  not_released: "coming_soon",
  available: "available",
  on_hold: "under_offer",
  reserved: "reserved",
  contract_issued: "under_contract",
  contract_signed: "under_contract",
  unconditional: "sold",
  settled: "sold",
};
export function audDisplay(amount: string) {
  const checked = decimal(amount)!;
  const [whole, cents] = checked.split(".");
  return `AUD $${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${cents === "00" ? "" : `.${cents}`}`;
}
export function makeSnapshot(
  projectKey: string,
  revision: number,
  input: SnapshotUnit[],
): PublicSnapshot {
  const units = input
    .filter((u) => u.publicVisible && availability[u.status])
    .map((u) => {
      if (!validId(u.id)) throw new Error("Invalid public unit identifier.");
      const checked = validateUnit(u);
      return {
        id: u.id,
        number: checked.number,
        housingType: checked.housingType,
        status: availability[u.status]!,
        bedrooms: checked.bedrooms,
        bathrooms: checked.bathrooms,
        carSpaces: checked.carSpaces,
        floorLevels: checked.floorLevels,
        salesStage: u.salesStage ?? null,
        constructionStage: u.constructionStage ?? null,
        landAreaSqm: checked.landAreaSqm,
        buildingAreaSqm: checked.buildingAreaSqm,
        internalAreaSqm: checked.internalAreaSqm,
        outdoorAreaSqm: checked.outdoorAreaSqm,
        totalAreaSqm: checked.totalAreaSqm,
        priceDisplay:
          u.publicPriceVisible && u.publicAskingPrice !== null
            ? audDisplay(u.publicAskingPrice)
            : null,
        features: checked.features,
        floorPlans: checked.floorPlans,
        media: checked.media,
        specifications: checked.specifications,
      };
    })
    .sort((a, b) => a.number.localeCompare(b.number));
  return { contractVersion: 1, projectKey, revision, units };
}
export function csvExport(rows: Record<string, unknown>[], columns: string[]) {
  const cell = (value: unknown) => {
    const raw =
      value == null
        ? ""
        : Array.isArray(value)
          ? value.join(" | ")
          : String(value);
    return `"${(/^[=+\-@\t\r\n]/.test(raw) ? "'" : "") + raw.replaceAll('"', '""')}"`;
  };
  return [
    columns.map(cell).join(","),
    ...rows.map((row) => columns.map((key) => cell(row[key])).join(",")),
  ].join("\r\n");
}
export const importColumns = [
  "number",
  "lot",
  "housingType",
  "bedrooms",
  "bathrooms",
  "carSpaces",
  "floorLevels",
  "landAreaSqm",
  "buildingAreaSqm",
  "internalAreaSqm",
  "outdoorAreaSqm",
  "totalAreaSqm",
  "constructionStageId",
  "releaseStageId",
  "sourceDocument",
];
export function parseImport(csv: string) {
  if (typeof csv !== "string" || csv.length > 250000)
    throw new Error("CSV is too large.");
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i <= source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (quoted || !cell) quoted = !quoted;
      else throw new Error("Malformed CSV quote.");
    } else if (
      !quoted &&
      (char === "," || char === "\n" || char === undefined)
    ) {
      row.push(cell);
      cell = "";
      if (char !== ",") {
        if (row.some((x) => x.trim())) rows.push(row);
        row = [];
      }
    } else if (char !== undefined) cell += char;
  }
  if (quoted || rows.length < 2 || rows.length > 10001)
    throw new Error("CSV must contain a header and valid data rows.");
  const header = rows.shift()!.map((x) => x.trim());
  if (
    new Set(header).size !== header.length ||
    !["number", "sourceDocument"].every((key) => header.includes(key)) ||
    header.some((key) => !importColumns.includes(key))
  )
    throw new Error(
      "Use the inventory template headers; prices and publication flags cannot be imported.",
    );
  const result = rows.map((cells, index) => {
    if (cells.length !== header.length)
      throw new Error(`CSV row ${index + 2} has the wrong column count.`);
    return validateUnit(
      Object.fromEntries(header.map((key, i) => [key, cells[i].trim()])),
    );
  });
  if (new Set(result.map((u) => u.number)).size !== result.length)
    throw new Error("Duplicate unit numbers in import.");
  return result;
}
