"use client";
import { useState } from "react";
import Image from "next/image";
import { BedDouble, Bath, CarFront, ImageIcon } from "lucide-react";
import type { Shared, Unit } from "./types";
import { nextUnitStatuses, unitStatuses } from "@/lib/sales/domain";
import {
  Area,
  Check,
  date,
  Field,
  formRecord,
  label,
  Select,
  options,
} from "./forms";
import { InventoryMap } from "./inventory-map";
import { money, statusPresentation } from "./inventory-status";
import styles from "./inventory.module.css";

export function Inventory(shared: Shared & { mapOnly?: boolean }) {
  const { data, projectId } = shared;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("number");
  const [construction, setConstruction] = useState("");
  const [release, setRelease] = useState("");
  const [publication, setPublication] = useState("");
  const [localSelected, setLocalSelected] = useState<string | null>(null);
  const selected = shared.selectedUnitId ?? localSelected;
  const setSelected = shared.onSelectUnit ?? setLocalSelected;
  const [editing, setEditing] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(Boolean(shared.mapOnly));
  const published = new Set(data.publicData?.units.map((u) => u.id) ?? []);
  const units = data.units
    .filter(
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
    )
    .sort((a, b) =>
      String(a[sort as "number" | "status"]).localeCompare(
        String(b[sort as "number" | "status"]),
        undefined,
        { numeric: true },
      ),
    );
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
              <button onClick={() => setEditing("new")}>Create unit</button>
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
          <label>
            Sort
            <select
              aria-label="Sort"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="number">Unit number</option>
              <option value="status">Sales status</option>
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
                {[
                  "Residence",
                  "Status",
                  "Stages",
                  "Publication",
                  "Public price draft",
                  ...(data.permissions["prices.view"]
                    ? ["Internal asking price"]
                    : []),
                  "Areas",
                  "Rooms",
                  "Tags",
                  "Actions",
                ].map((t) => (
                  <th scope="col" key={t}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr
                  key={u.id}
                  data-unit-row={u.id}
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
                        <small className={styles.muted}>
                          {u.housingType ?? "Type pending"}
                          {u.lot ? ` · Lot ${u.lot}` : ""}
                        </small>
                      </span>
                    </button>
                  </td>
                  <td>
                    <Status status={u.status} />
                  </td>
                  <td>
                    {data.release.find((s) => s.id === u.releaseStageId)
                      ?.name ?? "Release unassigned"}
                    <small className={styles.muted}>
                      {data.construction.find(
                        (s) => s.id === u.constructionStageId,
                      )?.name ?? "Construction unassigned"}
                    </small>
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
                  </td>
                  <td>
                    {u.publicPriceVisible && u.publicAskingPrice !== null
                      ? money(u.publicAskingPrice)
                      : "Price on application"}
                    <small className={styles.muted}>
                      {published.has(u.id)
                        ? `Live: ${data.publicData?.units.find((p) => p.id === u.id)?.priceDisplay ?? "Not published"}`
                        : "Not live"}
                    </small>
                  </td>
                  {data.permissions["prices.view"] && (
                    <td>
                      {money(
                        data.prices.find((p) => p.unitId === u.id)?.askingPrice,
                      )}
                      <small className={styles.muted}>Confidential</small>
                    </td>
                  )}
                  <td>
                    {u.landAreaSqm ?? "—"} m² land
                    <small className={styles.muted}>
                      {u.buildingAreaSqm ?? "—"} m² building
                    </small>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <BedDouble size={13} />
                      {u.bedrooms ?? "—"}
                      <Bath size={13} />
                      {u.bathrooms ?? "—"}
                      <CarFront size={13} />
                      {u.carSpaces ?? "—"}
                    </span>
                    <span className="sr-only">
                      Bedrooms, bathrooms and car spaces
                    </span>
                  </td>
                  <td>
                    {u.features.slice(0, 2).map((tag) => (
                      <span className={styles.tag} key={tag}>
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
                    <div className={styles.actions}>
                      <button
                        onClick={() => {
                          setSelected(u.id);
                          setEditing(u.id);
                        }}
                        aria-label={`Open residence ${u.number}`}
                      >
                        Open
                      </button>
                      <button
                        onClick={() => setSelected(u.id)}
                        aria-label={`Quick actions residence ${u.number}`}
                      >
                        Actions
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
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
                <button onClick={() => setEditing(active.id)}>
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
        <section
          className={`portal-card ${styles.detail}`}
          aria-label="Inventory editor"
        >
          <button
            className="portal-button mb-5"
            onClick={() => setEditing(null)}
          >
            Close unit
          </button>
          {unit || editing === "new" ? (
            <UnitEditor
              {...shared}
              unit={unit}
              onSaved={(id) => {
                setSelected(id);
                setEditing(id);
              }}
              key={`${editing}-${unit?.revision ?? 0}`}
            />
          ) : null}
        </section>
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
function UnitEditor({
  data,
  run,
  pending,
  unit,
  onSaved,
}: Shared & { unit?: Unit; onSaved: (id: string) => void }) {
  const prices = data.prices.find((p) => p.unitId === unit?.id);
  const id = unit ? { id: unit.id, revision: unit.revision } : {};
  return (
    <>
      <h2 className="mb-5">
        {unit
          ? `Residence ${unit.number} · revision ${unit.revision}`
          : "Create a real unit"}
      </h2>
      {data.permissions["inventory.edit"] && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await run("unit", {
              ...formRecord(e.currentTarget),
              ...id,
            });
            if (typeof saved === "string") onSaved(saved);
          }}
          className="space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["number", "Approved unit number"],
              ["lot", "Lot identifier"],
              ["housingType", "Housing type"],
              ["bedrooms", "Bedrooms"],
              ["bathrooms", "Bathrooms"],
              ["carSpaces", "Parking spaces"],
              ["floorLevels", "Floor levels"],
              ["landAreaSqm", "Land area (m²)"],
              ["buildingAreaSqm", "Building area (m²)"],
              ["internalAreaSqm", "Internal living (m²)"],
              ["outdoorAreaSqm", "Outdoor area (m²)"],
              ["totalAreaSqm", "Total area (m²)"],
            ].map(([key, title]) => (
              <Field
                key={key}
                name={key}
                label={title}
                value={unit?.[key as keyof Unit] as string | number | null}
                required={key === "number"}
                type={
                  ["number", "lot", "housingType"].includes(key)
                    ? "text"
                    : "number"
                }
                step={
                  [
                    "bedrooms",
                    "bathrooms",
                    "carSpaces",
                    "floorLevels",
                  ].includes(key)
                    ? "1"
                    : "0.01"
                }
              />
            ))}
            <Select
              name="constructionStageId"
              label="Construction stage"
              value={unit?.constructionStageId}
              options={[
                { value: "", label: "Unassigned" },
                ...data.construction.map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
              ]}
            />
            <Select
              name="releaseStageId"
              label="Sales release stage"
              value={unit?.releaseStageId}
              options={[
                { value: "", label: "Unassigned" },
                ...data.release.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <Field
            name="sourceDocument"
            label="Source document and approved revision reference"
            value={unit?.sourceDocument}
            required
          />
          <Area
            name="internalNotes"
            label="Internal notes — never published"
            value={unit?.internalNotes}
          />
          {(["features", "floorPlans", "media", "specifications"] as const).map(
            (key) => (
              <Area
                key={key}
                name={key}
                label={`${label(key)} — one per line${key !== "features" ? "; approved public HTTPS URLs only" : ""}`}
                value={unit?.[key].join("\n")}
              />
            ),
          )}
          <Check
            name="publicVisible"
            label="Include this unit in a future publication draft. Saving does not publish it."
            checked={unit?.publicVisible}
          />
          <button className="portal-button" disabled={pending}>
            Save inventory details
          </button>
        </form>
      )}
      {unit && !data.permissions["inventory.edit"] && (
        <dl className="space-y-3">
          {[
            "housingType",
            "bedrooms",
            "bathrooms",
            "carSpaces",
            "landAreaSqm",
            "buildingAreaSqm",
            "sourceDocument",
          ].map((key) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{String(unit[key as keyof Unit] ?? "Not recorded")}</dd>
            </div>
          ))}
        </dl>
      )}
      {unit &&
        data.permissions["status.edit"] &&
        nextUnitStatuses(unit.status).length > 0 && (
          <form
            className="mt-8 space-y-4 border-t pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void run("status", { ...formRecord(e.currentTarget), ...id });
            }}
          >
            <h3>Sales status · currently {label(unit.status)}</h3>
            <Select
              name="status"
              label="Requested status"
              value={nextUnitStatuses(unit.status)[0]}
              options={options(nextUnitStatuses(unit.status))}
            />
            <Field name="reason" label="Reason for transition" required />
            <button className="portal-button" disabled={pending}>
              Record status change
            </button>
          </form>
        )}
      {unit && data.permissions["publicPrices.edit"] && (
        <form
          className="mt-8 space-y-4 border-t pt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void run("publicPrice", { ...formRecord(e.currentTarget), ...id });
          }}
        >
          <h3>Public price draft · AUD</h3>
          <Field
            name="publicAskingPrice"
            label="Approved public asking price (decimal, no commas)"
            type="number"
            value={unit.publicAskingPrice}
          />
          <Check
            name="publicPriceVisible"
            label="Include this price in a future approved snapshot"
            checked={unit.publicPriceVisible}
          />
          <button className="portal-button" disabled={pending}>
            Save public price draft
          </button>
        </form>
      )}
      {unit && data.permissions["prices.view"] && (
        <section className="mt-8 border-t pt-6">
          <h3>Confidential prices · AUD</h3>
          <p className="portal-helper">
            Due dates use Sydney time (AEST / AEDT).
          </p>
          {data.permissions["prices.edit"] ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void run("prices", { ...formRecord(e.currentTarget), ...id });
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  "askingPrice",
                  "minimumPrice",
                  "contractPrice",
                  "depositAmount",
                  "settlementAmount",
                ].map((key) => (
                  <Field
                    key={key}
                    name={key}
                    label={
                      (
                        {
                          askingPrice: "Asking price",
                          minimumPrice: "Minimum price",
                          contractPrice: "Contract price",
                          depositAmount: "Deposit amount",
                          settlementAmount: "Settlement amount",
                        } as Record<string, string>
                      )[key]
                    }
                    type="number"
                    value={
                      prices?.[key as keyof typeof prices] as string | null
                    }
                  />
                ))}
                <Field
                  name="depositDueAt"
                  label="Deposit due"
                  type="datetime-local"
                  value={date(prices?.depositDueAt ?? null)}
                  instant={prices?.depositDueAt}
                />
                <Field
                  name="settlementDueAt"
                  label="Settlement due"
                  type="datetime-local"
                  value={date(prices?.settlementDueAt ?? null)}
                  instant={prices?.settlementDueAt}
                />
                <Select
                  name="gstTreatment"
                  label="GST treatment"
                  value={prices?.gstTreatment ?? "unconfirmed"}
                  options={options([
                    "unconfirmed",
                    "inclusive",
                    "exclusive",
                    "margin_scheme",
                    "not_applicable",
                  ])}
                />
              </div>
              <button className="portal-button" disabled={pending}>
                Save confidential prices
              </button>
            </form>
          ) : (
            <pre>{JSON.stringify(prices ?? {}, null, 2)}</pre>
          )}
        </section>
      )}
      {unit && (
        <details className="mt-6">
          <summary>Validation warnings and source provenance</summary>
          <ul>
            {unit.validationWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
          <pre className="overflow-auto text-xs">
            {JSON.stringify(unit.provenance, null, 2)}
          </pre>
        </details>
      )}
    </>
  );
}
