"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

export type PublicUnitStatus = "coming_soon" | "available" | "under_offer" | "reserved" | "under_contract" | "sold";
export type PublicUnit = {
  id: string;
  number: string;
  status: PublicUnitStatus;
  bedrooms: number | null;
  salesStage: string | null;
  buildingAreaSqm: number | null;
  landAreaSqm: number | null;
  priceDisplay: string | null;
};
export type UnitHotspot = {
  unitId: string;
  points: string; // SVG polygon points in the shared 1000 x 650 plan coordinate system
  labelX: number;
  labelY: number;
};
type Props = {
  units: PublicUnit[]; // MUST already be filtered to approved/published public inventory on the server
  hotspots: UnitHotspot[];
  planImageUrl?: string; // Approved site plan asset; never a private/internal drawing URL
  demo?: boolean;
};

const statuses: Record<PublicUnitStatus, { label: string; colour: string }> = {
  coming_soon: { label: "Coming Soon", colour: "#8a908c" },
  available: { label: "Available", colour: "#357358" },
  under_offer: { label: "Under Offer", colour: "#be9955" },
  reserved: { label: "Reserved", colour: "#be9955" },
  under_contract: { label: "Under Contract", colour: "#637d93" },
  sold: { label: "Sold", colour: "#929394" },
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function SitePlanExplorer({ units, hotspots, planImageUrl, demo = false }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [bedroomFilter, setBedroomFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const dragging = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const activeUnits = useMemo(() => units.filter((unit) =>
    (statusFilter === "all" || unit.status === statusFilter) &&
    (bedroomFilter === "all" || String(unit.bedrooms) === bedroomFilter) &&
    (stageFilter === "all" || unit.salesStage === stageFilter)
  ), [units, statusFilter, bedroomFilter, stageFilter]);
  const activeIds = useMemo(() => new Set(activeUnits.map((unit) => unit.id)), [activeUnits]);
  const unitsById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const selectedUnit = selected ? unitsById.get(selected) ?? null : null;
  const stages = [...new Set(units.map((unit) => unit.salesStage).filter((stage): stage is string => Boolean(stage)))].sort();
  const bedrooms = [...new Set(units.map((unit) => unit.bedrooms).filter((count): count is number => count !== null))].sort();
  const translateX = 500 * (1 - zoom) + pan.x;
  const translateY = 325 * (1 - zoom) + pan.y;

  function changeZoom(delta: number) {
    const next = clamp(Number((zoom + delta).toFixed(2)), 1, 4);
    setZoom(next);
    if (next === 1) setPan({ x: 0, y: 0 });
  }
  function startPan(event: ReactPointerEvent<SVGSVGElement>) {
    const target = event.target as Element;
    if (target.closest("[data-unit-hotspot]")) return;
    dragging.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function movePan(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragging.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const dx = (event.clientX - drag.x) * 1000 / bounds.width;
    const dy = (event.clientY - drag.y) * 650 / bounds.height;
    const limitX = (zoom - 1) * 500;
    const limitY = (zoom - 1) * 325;
    setPan({ x: clamp(drag.startX + dx, -limitX, limitX), y: clamp(drag.startY + dy, -limitY, limitY) });
  }
  function stopPan(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragging.current?.pointerId === event.pointerId) dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function reset() { setZoom(1); setPan({ x: 0, y: 0 }); setSelected(null); }

  return <section aria-label="Interactive property selector" className="space-y-5">
    {demo && <p role="note" className="border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">PROTOTYPE ONLY — ALL TEST UNIT POSITIONS AND STATUSES ARE FICTIONAL. NOT FOR BUYER USE.</p>}
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-xs">Availability
        <select aria-label="Filter availability" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 block min-w-36 rounded border border-stone-300 bg-white p-2">
          <option value="all">All statuses</option>{Object.entries(statuses).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
        </select>
      </label>
      <label className="text-xs">Bedrooms
        <select aria-label="Filter bedrooms" value={bedroomFilter} onChange={(event) => setBedroomFilter(event.target.value)} className="mt-1 block rounded border border-stone-300 bg-white p-2">
          <option value="all">All bedrooms</option>{bedrooms.map((value) => <option key={value} value={String(value)}>{value} bedrooms</option>)}
        </select>
      </label>
      <label className="text-xs">Sales stage
        <select aria-label="Filter sales stage" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="mt-1 block rounded border border-stone-300 bg-white p-2">
          <option value="all">All sales stages</option>{stages.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
        </select>
      </label>
      <span aria-live="polite" className="ml-auto text-sm text-stone-600">{activeUnits.length} matching homes</span>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-3">
        <div className="overflow-hidden rounded border border-stone-300 bg-[#eaeae6]">
          <svg viewBox="0 0 1000 650" className="block w-full" style={{ touchAction: "none" }} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={stopPan} onPointerCancel={stopPan} aria-label="Interactive site plan. Select an outlined home using pointer or keyboard.">
            <g transform={"translate(" + translateX + " " + translateY + ") scale(" + zoom + ")"}>
              {planImageUrl ? <image href={planImageUrl} x="0" y="0" width="1000" height="650" preserveAspectRatio="none" /> : <>
                <rect width="1000" height="650" fill="#e4e4df" />
                <path d="M0 200H1000M0 450H1000M150 0V650M500 0V650M850 0V650" stroke="#c9c9c2" strokeWidth="2" fill="none" />
                <text x="500" y="40" textAnchor="middle" fontSize="20" fill="#65655f">SITE PLAN ASSET REQUIRED</text>
              </>}
              {hotspots.map((hotspot) => {
                const unit = unitsById.get(hotspot.unitId);
                if (!unit || !activeIds.has(unit.id)) return null;
                const isSelected = selected === unit.id;
                return <g key={unit.id} data-unit-hotspot="true" role="button" tabIndex={0} aria-label={"Select " + unit.number + ", " + statuses[unit.status].label} aria-pressed={isSelected} onClick={() => setSelected(unit.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(unit.id); } }}>
                  <polygon points={hotspot.points} fill={statuses[unit.status].colour} fillOpacity={isSelected ? 0.72 : 0.38} stroke={isSelected ? "#101010" : "#fff"} strokeWidth={isSelected ? 5 : 2} vectorEffect="non-scaling-stroke" />
                  <text x={hotspot.labelX} y={hotspot.labelY} fontSize="15" fontWeight="700" textAnchor="middle" fill="#121212" stroke="#fff" strokeWidth="3" paintOrder="stroke" pointerEvents="none">{unit.number}</text>
                </g>;
              })}
            </g>
          </svg>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => changeZoom(0.3)} aria-label="Zoom in" className="border border-stone-300 px-4 py-2">+</button>
          <button type="button" onClick={() => changeZoom(-0.3)} aria-label="Zoom out" className="border border-stone-300 px-4 py-2">−</button>
          <button type="button" onClick={reset} className="border border-stone-300 px-4 py-2 text-sm">Reset view</button>
          <span className="ml-auto text-xs text-stone-500">{Math.round(zoom * 100)}% · Drag blank area to pan</span>
        </div>
      </div>
      <aside className="rounded border border-stone-300 bg-white p-5" aria-live="polite">
        {selectedUnit ? <>
          <p className="text-xs uppercase tracking-widest text-stone-500">Selected home</p>
          <h2 className="mt-3 text-2xl">{selectedUnit.number}</h2>
          <p className="mt-2 font-medium">{statuses[selectedUnit.status].label}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div><dt className="text-stone-500">Sales stage</dt><dd>{selectedUnit.salesStage ?? "Not published"}</dd></div>
            <div><dt className="text-stone-500">Bedrooms</dt><dd>{selectedUnit.bedrooms ?? "Not published"}</dd></div>
            <div><dt className="text-stone-500">Building area</dt><dd>{selectedUnit.buildingAreaSqm === null ? "Not published" : selectedUnit.buildingAreaSqm + " m²"}</dd></div>
            <div><dt className="text-stone-500">Land area</dt><dd>{selectedUnit.landAreaSqm === null ? "Not published" : selectedUnit.landAreaSqm + " m²"}</dd></div>
            <div><dt className="text-stone-500">Price</dt><dd>{selectedUnit.priceDisplay ?? "Price on Application"}</dd></div>
          </dl>
          <p className="mt-6 text-xs text-stone-500">Enquiry is enabled only after the approved sales contact and consent flow are configured.</p>
        </> : <p className="text-sm text-stone-600">Choose a highlighted home on the plan to view its published details.</p>}
      </aside>
    </div>
  </section>;
}
