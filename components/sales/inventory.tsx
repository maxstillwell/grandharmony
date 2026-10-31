"use client";
import { useState } from "react";
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
export function Inventory(shared: Shared) {
  const { data, projectId } = shared;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("number");
  const [construction, setConstruction] = useState("");
  const [release, setRelease] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const units = data.units
    .filter(
      (u) =>
        `${u.number} ${u.lot ?? ""} ${u.housingType ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!status || u.status === status) &&
        (!construction || u.constructionStageId === construction) &&
        (!release || u.releaseStageId === release),
    )
    .sort((a, b) =>
      String(a[sort as "number" | "status"]).localeCompare(
        String(b[sort as "number" | "status"]),
        undefined,
        { numeric: true },
      ),
    );
  const unit = data.units.find((u) => u.id === selected);
  return (
    <>
      <section className="portal-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2>Inventory</h2>
          <div className="flex gap-3">
            {data.permissions["inventory.edit"] && (
              <button
                className="portal-button"
                onClick={() => setSelected("new")}
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
        <div className="my-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs">
            Search units
            <input
              className="mt-2 w-full border p-3"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Status
            <select
              className="mt-2 w-full border p-3"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {unitStatuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Construction
            <select
              className="mt-2 w-full border p-3"
              value={construction}
              onChange={(e) => setConstruction(e.target.value)}
            >
              <option value="">All stages</option>
              {data.construction.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Sales release
            <select
              className="mt-2 w-full border p-3"
              value={release}
              onChange={(e) => setRelease(e.target.value)}
            >
              <option value="">All releases</option>
              {data.release.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            Sort
            <select
              className="mt-2 w-full border p-3"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="number">Unit number</option>
              <option value="status">Sales status</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Unit",
                  "Type",
                  "Status",
                  "Construction",
                  "Release",
                  "Public draft",
                  "",
                ].map((t, i) => (
                  <th className="p-3" key={i}>
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => (
                <tr className="border-t" key={u.id}>
                  <td className="p-3">{u.number}</td>
                  <td>{u.housingType ?? "—"}</td>
                  <td>{label(u.status)}</td>
                  <td>
                    {data.construction.find(
                      (s) => s.id === u.constructionStageId,
                    )?.name ?? "Unassigned"}
                  </td>
                  <td>
                    {data.release.find((s) => s.id === u.releaseStageId)
                      ?.name ?? "Unassigned"}
                  </td>
                  <td>
                    {u.publicVisible ? "Included in next draft" : "Excluded"}
                  </td>
                  <td>
                    <button
                      className="portal-button"
                      onClick={() => setSelected(u.id)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!units.length && (
          <p className="portal-empty">
            No internal units match. External agents can see only the current
            approved publication below.
          </p>
        )}
        {!data.units.length && Boolean(data.publicData?.units.length) && (
          <ul>
            {data.publicData?.units.map((u) => (
              <li key={u.id}>
                {u.number} · {label(u.status)} ·{" "}
                {u.priceDisplay ?? "Price not published"}
              </li>
            ))}
          </ul>
        )}
      </section>
      {selected && (
        <section className="portal-card">
          <button
            className="portal-button mb-5"
            onClick={() => setSelected(null)}
          >
            Close unit
          </button>
          {unit || selected === "new" ? (
            <UnitEditor
              {...shared}
              unit={unit}
              onSaved={setSelected}
              key={`${selected}-${unit?.revision ?? 0}`}
            />
          ) : null}
        </section>
      )}
    </>
  );
}
function UnitEditor({ data, run, pending, unit, onSaved }: Shared & { unit?: Unit; onSaved: (id: string) => void }) {
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
            const saved = await run("unit", { ...formRecord(e.currentTarget), ...id });
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
              type={["number", "lot", "housingType"].includes(key) ? "text" : "number"}
              step={["bedrooms", "bathrooms", "carSpaces", "floorLevels"].includes(key) ? "1" : "0.01"}
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
      {unit && data.permissions["status.edit"] && nextUnitStatuses(unit.status).length > 0 && (
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
          <p className="portal-helper">Due dates use Sydney time (AEST / AEDT).</p>
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
                    label={({ askingPrice: "Asking price", minimumPrice: "Minimum price", contractPrice: "Contract price", depositAmount: "Deposit amount", settlementAmount: "Settlement amount" } as Record<string, string>)[key]}
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
          <ul>{unit.validationWarnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
          <pre className="overflow-auto text-xs">
            {JSON.stringify(unit.provenance, null, 2)}
          </pre>
        </details>
      )}
    </>
  );
}
