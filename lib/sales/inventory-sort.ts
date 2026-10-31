import { unitStatuses, type UnitStatus } from "./domain";

export type InventorySortKey =
  | "number"
  | "status"
  | "releaseStageId"
  | "housingType"
  | "bedrooms"
  | "bathrooms"
  | "carSpaces"
  | "buildingAreaSqm"
  | "landAreaSqm"
  | "advertisingPrice"
  | "internalPrice"
  | "contractPrice"
  | "features"
  | "transactionStatus";
export type InventorySort = {
  key: InventorySortKey;
  direction: "asc" | "desc";
};
type Row = {
  id: string;
  number: string;
  status: UnitStatus;
  releaseStageId: string | null;
  housingType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  carSpaces: number | null;
  buildingAreaSqm: string | null;
  landAreaSqm: string | null;
  publicAskingPrice: string | null;
  features: string[];
  transactionStatus?: string;
};
type Price = {
  unitId: string;
  askingPrice: string | null;
  contractPrice: string | null;
};
const collator = new Intl.Collator("en-AU", {
  numeric: true,
  sensitivity: "base",
});
// Compare exact DB decimals without rounding currency or sorting formatted labels.
function cents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function sortInventory<T extends Row>(
  rows: T[],
  sort: InventorySort,
  stages: Array<{ id: string; sequence: number }>,
  prices: Price[],
) {
  const stageOrder = new Map(stages.map((s) => [s.id, s.sequence]));
  const privatePrices = new Map(prices.map((p) => [p.unitId, p]));
  const decimalKeys = new Set<InventorySortKey>([
    "buildingAreaSqm",
    "landAreaSqm",
    "advertisingPrice",
    "internalPrice",
    "contractPrice",
  ]);
  const value = (u: T): string | number | null => {
    switch (sort.key) {
      case "status":
        return unitStatuses.indexOf(u.status);
      case "releaseStageId":
        return u.releaseStageId
          ? (stageOrder.get(u.releaseStageId) ?? null)
          : null;
      case "advertisingPrice":
        return u.publicAskingPrice;
      case "internalPrice":
        return privatePrices.get(u.id)?.askingPrice ?? null;
      case "contractPrice":
        return privatePrices.get(u.id)?.contractPrice ?? null;
      case "features":
        return u.features.length
          ? [...u.features].sort(collator.compare).join(", ")
          : null;
      default:
        return u[sort.key] ?? null;
    }
  };
  return [...rows].sort((a, b) => {
    const x = value(a),
      y = value(b);
    // Missing values stay last in both directions; ties always use residence order.
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    let result = 0;
    if (x !== null && y !== null) {
      if (decimalKeys.has(sort.key)) {
        const l = cents(String(x)),
          r = cents(String(y));
        result = l < r ? -1 : l > r ? 1 : 0;
      } else if (typeof x === "number" && typeof y === "number") result = x - y;
      else result = collator.compare(String(x), String(y));
    }
    return (
      (sort.direction === "desc" ? -result : result) ||
      collator.compare(a.number, b.number) ||
      collator.compare(a.id, b.id)
    );
  });
}
