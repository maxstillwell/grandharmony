"use client";
import type { Shared, Unit } from "./types";
import { nextUnitStatuses } from "@/lib/sales/domain";
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
export function UnitEditor({
  data,
  run,
  pending,
  unit,
  onSaved,
  section = "all",
}: Shared & {
  unit?: Unit;
  onSaved: (id: string) => void;
  section?: "all" | "status" | "pricing";
}) {
  const prices = data.prices.find((p) => p.unitId === unit?.id);
  const id = unit ? { id: unit.id, revision: unit.revision } : {};
  return (
    <>
      <h2 className="mb-5">
        {unit
          ? `Residence ${unit.number} · revision ${unit.revision}`
          : "Create a real unit"}
      </h2>
      {section === "all" && data.permissions["inventory.edit"] && (
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
      {section === "all" && unit && !data.permissions["inventory.edit"] && (
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
      {(section === "all" || section === "status") &&
        unit &&
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
      {(section === "all" || section === "pricing") &&
        unit &&
        data.permissions["publicPrices.edit"] && (
          <form
            className="mt-8 space-y-4 border-t pt-6"
            onSubmit={(e) => {
              e.preventDefault();
              void run("publicPrice", {
                ...formRecord(e.currentTarget),
                ...id,
              });
            }}
          >
            <h3>Advertising price draft · AUD</h3>
            <Field
              name="publicAskingPrice"
              label="Draft advertising price (decimal, no commas)"
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
      {(section === "all" || section === "pricing") &&
        unit &&
        data.permissions["prices.view"] && (
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
                            askingPrice: "Internal asking price",
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
