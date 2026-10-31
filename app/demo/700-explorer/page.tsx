import type { Metadata } from "next";
import { SitePlanExplorer, type PublicUnit, type UnitHotspot, type PublicUnitStatus } from "@/components/sales/site-plan-explorer";

export const metadata: Metadata = { title: "700 Site Plan Interaction Prototype - NOT FOR SALES", robots: { index: false, follow: false } };

// This page exists only as a development harness. Geometry, availability and
// unit numbers below are invented and must NEVER be used as published inventory.
const testStatuses: PublicUnitStatus[] = ["available", "coming_soon", "under_offer", "reserved", "under_contract", "sold"];
const testUnits: PublicUnit[] = Array.from({ length: 47 }, (_, index) => ({
  id: "TEST-UNIT-" + String(index + 1).padStart(2, "0"),
  number: "TEST-" + String(index + 1).padStart(2, "0"),
  status: testStatuses[index % testStatuses.length],
  bedrooms: index % 5 === 0 ? 3 : 4,
  salesStage: "TEST STAGE " + String.fromCharCode(65 + Math.floor(index / 12)),
  buildingAreaSqm: null,
  landAreaSqm: null,
  priceDisplay: null,
}));
const testHotspots: UnitHotspot[] = testUnits.map((unit, index) => {
  const column = index % 10;
  const row = Math.floor(index / 10);
  const x = 45 + column * 92;
  const y = 86 + row * 105;
  return { unitId: unit.id, points: [[x, y], [x + 74, y], [x + 74, y + 78], [x, y + 78]].map((point) => point.join(",")).join(" "), labelX: x + 37, labelY: y + 42 };
});
export default function PrototypePage() {
  return <main className="mx-auto min-h-screen max-w-7xl space-y-7 bg-[#faf9f6] px-4 py-12 text-[#20201f] sm:px-8">
    <header><p className="text-xs uppercase tracking-widest">Grand Harmony / Engineering prototype</p><h1 className="mt-2 text-4xl">Golfview — 2D Explorer Test</h1><p className="mt-3 text-sm text-stone-600">Interactive engine proof of concept. This is NOT the actual Vermont South site layout or live inventory. Genuine architect plans and the approved Unit Schedule are still required.</p></header>
    <SitePlanExplorer demo units={testUnits} hotspots={testHotspots} />
  </main>;
}
