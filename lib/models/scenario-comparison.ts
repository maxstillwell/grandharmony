import type { ModelState } from "./types";
import { asSpecificationState } from "./specification-types";

export type ComparisonScenario = { id: string; name: string; revision: number; modelVersionId: string | null; updatedAt: string; state: ModelState };
export type ComparisonRow = { group: string; label: string; left: string; right: string; changed: boolean };

const statusText: Record<string, string> = { 确定: "Confirmed", 待定: "Pending", 可选: "Optional" };
const formatValue = (value: unknown) => value === undefined || value === null || value === "" ? "—" : typeof value === "boolean" ? (value ? "Yes" : "No") : typeof value === "number" ? new Intl.NumberFormat("en-AU", { maximumFractionDigits: 4 }).format(value) : Array.isArray(value) ? value.length ? value.map((item) => typeof item === "object" && item ? JSON.stringify(item) : String(item)).join("; ") : "—" : String(value);

function specificationRows(leftState: ModelState, rightState: ModelState) {
  const left = asSpecificationState(leftState);
  const right = asSpecificationState(rightState);
  const rightSections = new Map(right.sections.map((section) => [section.id, section]));
  const rows: ComparisonRow[] = [];
  for (const leftSection of left.sections) {
    const rightSection = rightSections.get(leftSection.id);
    const rightItems = new Map((rightSection?.items ?? []).map((item) => [item.id, item]));
    const seen = new Set<string>();
    for (const leftItem of leftSection.items) {
      const rightItem = rightItems.get(leftItem.id);
      seen.add(leftItem.id);
      const fields: Array<[string, unknown, unknown]> = [["Item name", leftItem.item, rightItem?.item], ["Description", leftItem.spec, rightItem?.spec], ["Status", statusText[leftItem.status], rightItem ? statusText[rightItem.status] : undefined], ["Reference images", leftItem.images.map((image) => `${image.label} · ${image.url}`), rightItem?.images.map((image) => `${image.label} · ${image.url}`)]];
      for (const [field, a, b] of fields) { const leftValue = formatValue(a); const rightValue = formatValue(b); rows.push({ group: leftSection.title, label: `${leftItem.item} · ${field}`, left: leftValue, right: rightValue, changed: leftValue !== rightValue }); }
    }
    for (const item of rightSection?.items ?? []) if (!seen.has(item.id)) rows.push({ group: rightSection?.title ?? leftSection.title, label: `${item.item} · Item`, left: "Not present", right: "Added", changed: true });
  }
  for (const section of right.sections) if (!left.sections.some((item) => item.id === section.id)) rows.push({ group: section.title, label: "Section", left: "Not present", right: "Added", changed: true });
  return rows;
}

function flatten(value: unknown, prefix = "", rows: Array<[string, unknown]> = []): Array<[string, unknown]> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) flatten(nested, prefix ? `${prefix} / ${key}` : key, rows);
  } else {
    rows.push([prefix, value]);
  }
  return rows;
}

function financialRows(leftState: ModelState, rightState: ModelState) {
  const left = new Map(flatten(leftState));
  const right = new Map(flatten(rightState));
  const labels = new Set<string>();
  left.forEach((_, label) => labels.add(label));
  right.forEach((_, label) => labels.add(label));
  return Array.from(labels).map((label) => {
    const leftValue = formatValue(left.get(label)); const rightValue = formatValue(right.get(label));
    return { group: label.startsWith("__results") ? "Calculated results" : "Inputs & assumptions", label: label.replace(/^__results\s*\/\s*/, "").replaceAll("_", " "), left: leftValue, right: rightValue, changed: leftValue !== rightValue };
  });
}

export function compareScenarioStates(adapterKey: string | null, left: ModelState, right: ModelState) {
  return adapterKey === "interactive-specification-v1" ? specificationRows(left, right) : financialRows(left, right);
}
