import { validateEnquiry } from "./domain";
export const buyerImportColumns = [
  "name",
  "email",
  "phone",
  "source",
  "message",
  "privacyVersion",
  "consent",
  "marketingConsent",
  "contactPreference",
];
export function parseBuyerImport(csv: unknown) {
  if (typeof csv !== "string" || csv.length > 100000)
    throw Error("Buyer CSV is too large.");
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
      else throw Error("Malformed CSV quote.");
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
  if (quoted || rows.length < 2 || rows.length > 101)
    throw Error("Import between 1 and 100 buyers using the template.");
  const header = rows.shift()!.map((x) => x.trim());
  if (
    new Set(header).size !== header.length ||
    header.length !== buyerImportColumns.length ||
    header.some((k) => !buyerImportColumns.includes(k))
  )
    throw Error("Use all buyer template columns.");
  return rows.map((cells, i) => {
    if (cells.length !== header.length)
      throw Error(`Buyer CSV row ${i + 2} has the wrong column count.`);
    const r = Object.fromEntries(header.map((k, j) => [k, cells[j].trim()]));
    if (
      !["true", "false"].includes(r.consent) ||
      !["true", "false"].includes(r.marketingConsent)
    )
      throw Error(
        `Row ${i + 2}: consent columns must be explicit true / false.`,
      );
    return {
      ...validateEnquiry({
        ...r,
        consent: r.consent === "true",
        marketingConsent: r.marketingConsent === "true",
        unitIds: [],
      }),
      source: r.source || "portal",
    };
  });
}
