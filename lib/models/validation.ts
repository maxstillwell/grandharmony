import type { ModelState } from "./types";
import type { SpecificationStatus } from "./specification-types";

export function validateModelState(adapter: string | null, value: ModelState): ModelState {
  if (!value || typeof value !== "object" || Array.isArray(value) || JSON.stringify(value).length > 100000) throw new Error("Invalid or oversized model state.");
  if (adapter === "interactive-specification-v1") {
    const sections = value.sections;
    if (!Array.isArray(sections) || sections.length > 40) throw new Error("Invalid specification sections.");
    for (const section of sections) {
      if (!section || typeof section !== "object" || Array.isArray(section)) throw new Error("Invalid specification section.");
      const record = section as Record<string, unknown>;
      if (typeof record.id !== "string" || typeof record.title !== "string" || record.title.length > 180 || !Array.isArray(record.items) || record.items.length > 300) throw new Error("Invalid specification section.");
      for (const item of record.items) {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid specification item.");
        const entry = item as Record<string, unknown>;
        if (typeof entry.id !== "string" || typeof entry.item !== "string" || entry.item.length > 400 || typeof entry.spec !== "string" || entry.spec.length > 5000 || !["确定", "待定", "可选"].includes(entry.status as SpecificationStatus) || !Array.isArray(entry.images) || entry.images.length > 8) throw new Error("Invalid specification item.");
        for (const image of entry.images) {
          if (!image || typeof image !== "object" || Array.isArray(image)) throw new Error("Invalid reference image.");
          const media = image as Record<string, unknown>;
          if (typeof media.url !== "string" || !/^https:\/\//i.test(media.url) || media.url.length > 2000 || typeof media.label !== "string" || media.label.length > 300 || typeof media.source !== "string" || media.source.length > 2000) throw new Error("Invalid reference image.");
        }
      }
    }
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
