import type { ModelState } from "./types";

export function validateModelState(adapter: string | null, value: ModelState): ModelState {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 100000) throw new Error("Invalid or oversized model state.");
  if (adapter === "scenario-state-test") {
    for (const key of ["assumptionLabel", "referenceValue", "reviewNote"]) if (typeof value[key] !== "string") throw new Error("Invalid test model state.");
    return value;
  }
  if (adapter !== "700-feasibility-v1") throw new Error("This model has no approved state adapter.");
  if (value.__results !== undefined) {
    if (!value.__results || typeof value.__results !== "object" || Array.isArray(value.__results) || Object.values(value.__results).some(number => typeof number !== "number" || !Number.isFinite(number))) throw new Error("Invalid saved calculation results.");
  }
  const keys: Record<string, string[]> = { fields: ["units", "price", "sold", "land", "stamp", "marketing", "contingency", "build", "holdRent", "holdWeeks", "holdOperating"], gst: ["margin", "landConsideration", "gstRate", "marketingGst"], tax: ["loss", "lossUsable", "taxRate"], finance: ["loan", "rate", "years", "averageDraw"] };
  for (const [section, names] of Object.entries(keys)) {
    const record = value[section];
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Missing ${section} assumptions.`);
    for (const key of names) { const field = (record as Record<string, unknown>)[key]; if (!(typeof field === "number" && Number.isFinite(field)) && !(["margin", "marketingGst", "lossUsable"].includes(key) && typeof field === "boolean")) throw new Error(`Invalid ${section}.${key}.`); }
  }
  if (!Array.isArray(value.costs) || value.costs.length > 500) throw new Error("Invalid cost rows.");
  for (const row of value.costs) {
    if (!row || typeof row !== "object" || typeof row.name !== "string" || typeof row.group !== "string" || /[<>]/.test(row.group) || typeof row.amount !== "number" || !Number.isFinite(row.amount) || typeof row.credit !== "boolean" || !["gross", "net", "free"].includes(row.mode)) throw new Error("Invalid cost row.");
  }
  return value;
}
