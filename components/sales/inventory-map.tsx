"use client";
import { useState } from "react";
import type { ManagementPlan, Unit } from "./types";
import { statusPresentation } from "./inventory-status";
import styles from "./inventory.module.css";

// B's geometry and SVG are consumed unchanged; no inferred footprints or second inventory.
export function InventoryMap({
  units,
  selected,
  onSelect,
  projectId,
  enabled,
  plan,
}: {
  units: Unit[];
  selected: string | null;
  onSelect: (id: string) => void;
  projectId: string;
  enabled: boolean;
  plan?: ManagementPlan;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  if (!enabled || !plan)
    return (
      <section className={styles.map}>
        <h3>Project map</h3>
        <p className="portal-helper">
          No source-verified unit mapping has been linked for this project. Use
          the inventory table; no positions are inferred.
        </p>
      </section>
    );
  const byNumber = new Map(units.map((u) => [u.number, u]));
  const mapped = new Set(plan.geometry.map((g) => g.unitNumber));
  return (
    <section className={styles.map} aria-label="Linked inventory map">
      <div className={styles.toolbar}>
        <h3>Golfview · linked inventory map</h3>
        <div className={styles.actions}>
          <button
            onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
            aria-label="Enlarge inventory map"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
            aria-label="Reduce inventory map"
          >
            −
          </button>
          <button onClick={() => setZoom(1)}>Fit map</button>
        </div>
      </div>
      <p className={styles.warning}>
        UNAPPROVED — Internal architectural review. Source-derived selection
        regions, not legal lot boundaries. PDF/IFC reconciliation, Unit 1
        classification and Unit 20 upper-region 3D binding remain unresolved.
        Colours show internal working status, not published sales availability.
      </p>
      {failed ? (
        <p role="alert">
          Review drawing unavailable. Use the inventory table; map selection is
          disabled.
        </p>
      ) : (
        <div
          className={styles.mapViewport}
          tabIndex={0}
          aria-label="Scrollable inventory map"
        >
          <svg
            viewBox={`0 0 ${plan.width} ${plan.height}`}
            style={{ width: `${zoom * 100}%` }}
            aria-label="Draft Golfview unit selection map"
          >
            <image
              href={`/api/portal/sales/${projectId}/drawing`}
              width={plan.width}
              height={plan.height}
              onLoad={() => setLoaded(true)}
              onError={() => {
                setFailed(true);
                setLoaded(false);
              }}
            />
            {loaded &&
              plan.geometry.map((g) => {
                const unit = byNumber.get(g.unitNumber);
                const colour = unit
                  ? statusPresentation[unit.status].colour
                  : "#b8bcb2";
                const active = unit?.id === selected;
                const path = [g.polygon, ...g.additionalPolygons]
                  .map((poly) => `M${poly.map((p) => p.join(",")).join("L")}Z`)
                  .join(" ");
                return (
                  <g key={g.unitKey}>
                    <path
                      d={path}
                      fill={colour}
                      fillOpacity={active ? 0.8 : unit ? 0.5 : 0.15}
                      stroke={active ? "#17291f" : "#fff"}
                      strokeWidth={active ? 5 : 2}
                      vectorEffect="non-scaling-stroke"
                      role={unit ? "button" : undefined}
                      tabIndex={unit ? 0 : undefined}
                      aria-label={
                        unit
                          ? `Map residence ${unit.number}, ${statusPresentation[unit.status].label}`
                          : undefined
                      }
                      aria-pressed={unit ? active : undefined}
                      onClick={() => unit && onSelect(unit.id)}
                      onKeyDown={(e) => {
                        if (unit && (e.key === "Enter" || e.key === " ")) {
                          e.preventDefault();
                          onSelect(unit.id);
                        }
                      }}
                      data-map-unit={unit?.id}
                    />
                    <text
                      x={g.labelPosition[0]}
                      y={g.labelPosition[1]}
                      fontSize="16"
                      fontWeight="600"
                      textAnchor="middle"
                      fill="#17291f"
                      stroke="white"
                      strokeWidth="3"
                      paintOrder="stroke"
                      pointerEvents="none"
                    >
                      {g.unitNumber}
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>
      )}
      <div className={styles.legend}>
        {Object.entries(statusPresentation).map(([k, v]) => (
          <span key={k}>
            <i className={styles.dot} style={{ background: v.colour }} />{" "}
            {v.label}
          </span>
        ))}
        <span>
          Unrecorded / filtered regions are neutral and cannot be selected.
        </span>
      </div>
      <p className="portal-helper">
        Table and map use the same record IDs and internal status.{" "}
        {units.filter((u) => !mapped.has(u.number)).length} matching records
        have no exact drawing-number mapping. No numbers are guessed.
      </p>
    </section>
  );
}
