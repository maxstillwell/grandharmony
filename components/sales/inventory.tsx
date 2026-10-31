"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { ImageIcon } from "lucide-react";
import type { Shared, Unit } from "./types";
import { nextUnitStatuses, unitStatuses } from "@/lib/sales/domain";
import { Field, formRecord, label, Select } from "./forms";
import { InventoryActions, type ResidenceView } from "./inventory-actions";
import { ResidencePanel } from "./residence-panel";
import {
  sortInventory,
  type InventorySort,
  type InventorySortKey,
} from "@/lib/sales/inventory-sort";
import { InventoryMap } from "./inventory-map";
import { money, statusPresentation } from "./inventory-status";
import styles from "./inventory.module.css";

export function Inventory(shared: Shared & { mapOnly?: boolean }) {
  const { data, projectId } = shared;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<InventorySort>({
    key: "number",
    direction: "asc",
  });
  const [panelView, setPanelView] = useState<ResidenceView>("details");
  const [construction, setConstruction] = useState("");
  const [release, setRelease] = useState("");
  const [publication, setPublication] = useState("");
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = shared.selectedUnitId ?? localSelected;
  const setSelected = shared.onSelectUnit ?? setLocalSelected;
  const [editing, setEditing] = useState<string | null>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  const [showMap, setShowMap] = useState(Boolean(shared.mapOnly));
  const published = new Set(data.publicData?.units.map((u) => u.id) ?? []);
  const filtered = data.units.filter(
    (u) =>
      `${u.number} ${u.lot ?? ""} ${u.housingType ?? ""} ${u.features.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || u.status === status) &&
      (!construction || u.constructionStageId === construction) &&
      (!release || u.releaseStageId === release) &&
      (!publication ||
        (publication === "published"
          ? published.has(u.id)
          : publication === "unpublished"
            ? !published.has(u.id)
            : u.publicVisible)),
  );
  const units = sortInventory(
    filtered,
    sort,
    data.release,
    data.permissions["prices.view"] ? data.prices : [],
  );
  const columns: Array<{
    title: string;
    key?: InventorySortKey;
    numeric?: boolean;
  }> = [
    { title: "Residence", key: "number" },
    { title: "Status", key: "status" },
    { title: "Release Stage", key: "releaseStageId" },
    { title: "Type", key: "housingType" },
    { title: "Beds", key: "bedrooms", numeric: true },
    { title: "Baths", key: "bathrooms", numeric: true },
    { title: "Cars", key: "carSpaces", numeric: true },
    { title: "Building Area", key: "buildingAreaSqm", numeric: true },
    { title: "Land Area", key: "landAreaSqm", numeric: true },
    { title: "Advertising Price", key: "advertisingPrice", numeric: true },
    ...(data.permissions["prices.view"]
      ? [
          {
            title: "Internal Price",
            key: "internalPrice" as const,
            numeric: true,
          },
          {
            title: "Contract Price",
            key: "contractPrice" as const,
            numeric: true,
          },
        ]
      : []),
    { title: "Tags", key: "features" },
    { title: "Publication" },
    { title: "Open" },
    { title: "Actions" },
  ];
  const changeSort = (key: InventorySortKey) =>
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  const openResidence = (id: string, view: ResidenceView) => {
    panelOpener.current = document.activeElement as HTMLElement;
    setSelected(id);
    setEditing(id);
    setPanelView(view);
    setShowMap(true);
  };
  const closeResidence = () => {
    setEditing(null);
    const opener = panelOpener.current;
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  };
  const unit = data.units.find((u) => u.id === editing);
  const active = data.units.find((u) => u.id === selected);
  const reset = () => {
    setSearch("");
    setStatus("");
    setConstruction("");
    setRelease("");
    setPublication("");
  };
  return (
    <>
      <section className="portal-card">
        <div className={styles.toolbar}>
          <div>
            <p className="portal-kicker">Sales operations</p>
            <h2>
              {shared.mapOnly ? "Explorer / inventory link" : "Inventory"}
            </h2>
          </div>
          <div className={styles.actions}>
            <button
              aria-pressed={showMap}
              onClick={() => setShowMap((v) => !v)}
            >
              {showMap ? "Hide linked map" : "Show linked map"}
            </button>
            {data.permissions["inventory.edit"] && (
              <button
                onClick={() => {
                  panelOpener.current = document.activeElement as HTMLElement;
                  setEditing("new");
                  setPanelView("edit");
                }}
              >
                Create unit
              </button>
            )}
            {data.units.length > 0 && (
              <a
                className="portal-button"
                href={`/api/portal/projects/${projectId}/sales/export`}
              >
                Export inventory CSV
              </a>
            )}
          </div>
        </div>
        <div className={styles.summary}>
          <span>
            <strong>{data.units.length}</strong>Recorded homes
          </span>
          <span>
            <strong>
              {data.units.filter((u) => published.has(u.id)).length}
            </strong>
            Currently published
          </span>
          <span>
            <strong>{data.units.filter((u) => u.publicVisible).length}</strong>
            Included in next draft
          </span>
          <span>
            <strong>{units.length}</strong>Matching filters
          </span>
        </div>
        <div className={styles.filters}>
          <label>
            Search units
            <input
              value={search}
              placeholder="Unit, lot, type or tag"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            Status
            <select
              aria-label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {unitStatuses.map((s) => (
                <option value={s} key={s}>
                  {statusPresentation[s].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Construction
            <select
              aria-label="Construction"
              value={construction}
              onChange={(e) => setConstruction(e.target.value)}
            >
              <option value="">All stages</option>
              {data.construction.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Sales release
            <select
              aria-label="Sales release"
              value={release}
              onChange={(e) => setRelease(e.target.value)}
            >
              <option value="">All releases</option>
              {data.release.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Publication
            <select
              aria-label="Publication"
              value={publication}
              onChange={(e) => setPublication(e.target.value)}
            >
              <option value="">All publication states</option>
              <option value="published">Currently published</option>
              <option value="unpublished">Not currently published</option>
              <option value="draft">Included in next draft</option>
            </select>
          </label>
        </div>
        <p className="portal-helper mb-4">
          Internal working inventory · AUD. Saved changes appear here and on the
          linked map after confirmation. Public Golfview changes only after an
          approved snapshot is published.
        </p>
        {showMap && (
          <InventoryMap
            key={projectId}
            units={units}
            selected={selected}
            onSelect={setSelected}
            projectId={projectId}
            enabled={Boolean(shared.mapEnabled) && !data.agent}
            plan={shared.reviewPlan}
          />
        )}
        <div
          className={styles.tableWrap}
          tabIndex={0}
          aria-label="Scrollable inventory table"
        >
          <table className={styles.table}>
            <caption className="sr-only">
              Project inventory and publication state. Select a unit to
              highlight its map region.
            </caption>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    scope="col"
                    key={c.title}
                    className={c.numeric ? styles.numeric : undefined}
                    aria-sort={
                      c.key
                        ? sort.key === c.key
                          ? sort.direction === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {c.key ? (
                      <button
                        className={styles.sortHeading}
                        onClick={() => changeSort(c.key!)}
                        aria-label={`${c.title}, sort ${sort.key === c.key && sort.direction === "asc" ? "descending" : "ascending"}`}
                      >
                        {c.title}
                        <span aria-hidden="true">
                          {sort.key === c.key
                            ? sort.direction === "asc"
                              ? "↑"
                              : "↓"
                            : "↕"}
                        </span>
                      </button>
                    ) : (
                      c.title
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const price = data.prices.find((p) => p.unitId === u.id);
                return (
                  <tr
                    key={u.id}
                    data-unit-row={u.id}
                    data-number={u.number}
                    data-selected={selected === u.id}
                  >
                    <td>
                      <button
                        className={styles.unitButton}
                        aria-label={`Select residence ${u.number}`}
                        aria-pressed={selected === u.id}
                        onClick={() => setSelected(u.id)}
                      >
                        <Thumbnail url={u.media[0]} number={u.number} />
                        <span>
                          {u.number}
                          {u.lot && (
                            <small className={styles.muted}>Lot {u.lot}</small>
                          )}
                        </span>
                      </button>
                    </td>
                    <td>
                      <Status status={u.status} />
                    </td>
                    <td>
                      {data.release.find((s) => s.id === u.releaseStageId)
                        ?.name ?? "—"}
                      <small className={styles.muted}>
                        {data.construction.find(
                          (s) => s.id === u.constructionStageId,
                        )?.name ?? "Construction unassigned"}
                      </small>
                    </td>
                    <td>{u.housingType ?? "—"}</td>
                    <td className={styles.numeric}>{u.bedrooms ?? "—"}</td>
                    <td className={styles.numeric}>{u.bathrooms ?? "—"}</td>
                    <td className={styles.numeric}>{u.carSpaces ?? "—"}</td>
                    <td className={`${styles.numeric} ${styles.building}`}>
                      {u.buildingAreaSqm === null
                        ? "—"
                        : `${u.buildingAreaSqm} m²`}
                    </td>
                    <td className={styles.numeric}>
                      {u.landAreaSqm === null ? "—" : `${u.landAreaSqm} m²`}
                    </td>
                    <td className={`${styles.numeric} ${styles.price}`}>
                      {money(u.publicAskingPrice)}
                      <small className={styles.muted}>
                        Draft ·{" "}
                        {u.publicPriceVisible
                          ? "Included in next price draft"
                          : "Not set for publication"}
                      </small>
                      {published.has(u.id) && (
                        <small className={styles.muted}>
                          Live:{" "}
                          {data.publicData?.units.find((p) => p.id === u.id)
                            ?.priceDisplay ?? "—"}
                        </small>
                      )}
                    </td>
                    {data.permissions["prices.view"] && (
                      <>
                        <td className={`${styles.numeric} ${styles.price}`}>
                          {money(price?.askingPrice)}
                          <small className={styles.muted}>Confidential</small>
                        </td>
                        <td className={`${styles.numeric} ${styles.price}`}>
                          {money(price?.contractPrice)}
                          <small className={styles.muted}>
                            Confidential · agreed only
                          </small>
                        </td>
                      </>
                    )}
                    <td>
                      {u.features.slice(0, 2).map((tag, i) => (
                        <span key={`${tag}-${i}`} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                      {u.features.length > 2 && (
                        <span className={styles.tag}>
                          +{u.features.length - 2}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={styles.tag}>
                        {published.has(u.id) ? "Live snapshot" : "Unpublished"}
                      </span>
                      <small className={styles.muted}>
                        {u.publicVisible
                          ? "Included in next draft"
                          : "Excluded from next draft"}
                      </small>
                      {u.validationWarnings.some((w) =>
                        w.includes("DESIGN CONFLICT"),
                      ) && (
                        <span className={styles.conflict}>DESIGN CONFLICT</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="portal-button"
                        aria-label={`Open residence ${u.number}`}
                        onClick={() => openResidence(u.id, "details")}
                      >
                        Open
                      </button>
                    </td>
                    <td>
                      <InventoryActions
                        unit={u}
                        permissions={data.permissions}
                        onAction={(view) => openResidence(u.id, view)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!units.length && (
            <div className={styles.empty}>
              {data.units.length
                ? "No units match these filters."
                : "No authoritative inventory has been entered. Import an approved source list or create a verified record."}
              <div className="mt-3">
                <button className="portal-button" onClick={reset}>
                  Reset filters
                </button>
              </div>
            </div>
          )}
        </div>
        {!data.units.length && Boolean(data.publicData?.units.length) && (
          <ul className="mt-5">
            {data.publicData?.units.map((u) => (
              <li key={u.id}>
                {u.number} · {label(u.status)} ·{" "}
                {u.priceDisplay ?? "Price not published"}
              </li>
            ))}
          </ul>
        )}
        {active && (
          <section
            className={styles.quick}
            key={`${active.id}-${active.revision}`}
            aria-label="Selected inventory actions"
          >
            <div className={styles.toolbar}>
              <div>
                <h3>Residence {active.number}</h3>
                <Status status={active.status} />
              </div>
              <div className={styles.actions}>
                <button onClick={() => openResidence(active.id, "edit")}>
                  Edit full record
                </button>
                <button onClick={() => setSelected(null)}>
                  Clear selection
                </button>
              </div>
            </div>
            <p className="portal-helper">
              Revision {active.revision} ·{" "}
              {published.has(active.id)
                ? "Present in live snapshot"
                : "Not published"}
              .{" "}
              {active.floorPlans[0] && (
                <a
                  href={active.floorPlans[0]}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open approved floor plan ↗
                </a>
              )}
            </p>
            {data.permissions["status.edit"] &&
              nextUnitStatuses(active.status).length > 0 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void shared.run("status", {
                      ...formRecord(e.currentTarget),
                      id: active.id,
                      revision: active.revision,
                    });
                  }}
                >
                  <Select
                    name="status"
                    label="Quick status update"
                    options={nextUnitStatuses(active.status).map((s) => ({
                      value: s,
                      label: statusPresentation[s].label,
                    }))}
                  />
                  <Field name="reason" label="Reason for transition" required />
                  <button className="portal-button" disabled={shared.pending}>
                    Save status
                  </button>
                </form>
              )}
            {data.permissions["inventory.edit"] && (
              <div className="mt-4">
                <button
                  className="portal-button"
                  disabled={shared.pending}
                  onClick={() => {
                    void shared.run("unit", {
                      ...active,
                      publicVisible: !active.publicVisible,
                    });
                  }}
                >
                  {active.publicVisible
                    ? "Exclude from next draft"
                    : "Include in next draft"}
                </button>
                <p className="portal-helper">
                  This does not publish or remove a live listing. Use Publishing
                  for review, approval and release.
                </p>
              </div>
            )}
          </section>
        )}
      </section>
      {editing && (
        <ResidencePanel
          key={`${editing}-${panelView}`}
          shared={shared}
          unit={unit}
          initialView={panelView}
          onClose={closeResidence}
          onSaved={(id) => {
            setSelected(id);
            setEditing(id);
          }}
        />
      )}
    </>
  );
}
function Status({ status }: { status: Unit["status"] }) {
  const s = statusPresentation[status];
  return (
    <span className={styles.status}>
      <i className={styles.dot} style={{ background: s.colour }} />
      {s.label}
    </span>
  );
}
function Thumbnail({ url, number }: { url?: string; number: string }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <Image
      className={styles.thumb}
      src={url}
      alt={`Residence ${number} reference`}
      width={38}
      height={38}
      unoptimized
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={styles.thumb} aria-hidden="true">
      <ImageIcon size={16} />
    </span>
  );
}
