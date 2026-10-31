"use client";
import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { nextUnitStatuses } from "@/lib/sales/domain";
import type { Data, Shared, Unit } from "./types";
import type { ResidenceView } from "./inventory-actions";
import { UnitEditor } from "./unit-editor";
import { money, statusPresentation } from "./inventory-status";
import { displaySalesDate } from "@/lib/sales/dates";
import styles from "./inventory.module.css";
export function ResidencePanel({
  shared,
  unit,
  initialView,
  onClose,
  onSaved,
}: {
  shared: Shared;
  unit?: Unit;
  initialView: ResidenceView;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [view, setView] = useState(initialView),
    dialog = useRef<HTMLDialogElement>(null),
    title = useId();
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const [unitEvents, setUnitEvents] = useState<Data["history"] | null>(null);
  const unitId = unit?.id,
    unitRevision = unit?.revision,
    canReadAudit = shared.data.permissions["audit.view"],
    run = shared.run;
  useEffect(() => {
    if (view !== "activity" || !unitId || !canReadAudit) return;
    let current = true;
    setUnitEvents(null);
    void run("unitActivity", { id: unitId }).then((result) => {
      if (current) setUnitEvents(Array.isArray(result) ? result : []);
    });
    return () => {
      current = false;
    };
  }, [view, unitId, unitRevision, canReadAudit, run]);
  const { data } = shared,
    prices = data.prices.find((p) => p.unitId === unit?.id),
    live = data.publicData?.units.find((u) => u.id === unit?.id);
  const area = (v: string | null) => (v === null ? "—" : `${v} m²`);
  const events = data.history.filter((e) => e.unitId === unit?.id),
    leads = data.leads.filter((l) => unit && l.unitIds.includes(unit.id));
  const tabs: Array<readonly [ResidenceView, string]> = [
    ["details", "Details"],
    ...(data.permissions["inventory.edit"] ? [["edit", "Edit"] as const] : []),
    ...(data.permissions["status.edit"] ? [["status", "Status"] as const] : []),
    ...(data.permissions["prices.view"] || data.permissions["publicPrices.edit"]
      ? [["pricing", "Pricing"] as const]
      : []),
    ...(data.permissions["audit.view"]
      ? [["activity", "Activity"] as const]
      : []),
    ...(data.permissions["crm.view"] ? [["crm", "CRM leads"] as const] : []),
  ];
  return (
    <dialog
      className={styles.panel}
      ref={dialog}
      aria-labelledby={title}
      onCancel={onClose}
      onClose={onClose}
    >
      <header className={styles.panelHeader}>
        <div>
          <p className="portal-kicker">
            Sales Management ·{" "}
            {unit ? `Revision ${unit.revision}` : "New record"}
          </p>
          <h2 id={title}>
            {unit ? `Residence ${unit.number}` : "Create residence"}
          </h2>
          <p>
            {unit?.housingType ?? "Type pending"}
            {unit ? ` · ${statusPresentation[unit.status].label}` : ""}
          </p>
        </div>
        <button
          autoFocus
          className="portal-button"
          aria-label="Close residence panel"
          onClick={onClose}
        >
          Close ×
        </button>
      </header>
      <div className={styles.panelBody}>
        {unit && (
          <nav
            aria-label="Residence detail sections"
            className={styles.panelTabs}
          >
            {tabs.map(([key, text]) => (
              <button
                key={key}
                aria-pressed={view === key}
                onClick={() => setView(key)}
              >
                {text}
              </button>
            ))}
          </nav>
        )}
        {shared.feedback?.message && (
          <p
            role={shared.feedback.failed ? "alert" : "status"}
            className={styles.warning}
          >
            {shared.feedback.message}
          </p>
        )}
        {unit?.validationWarnings.map((w) => (
          <p key={w} className={styles.warning}>
            {w}
          </p>
        ))}
        {unit && view === "details" && (
          <>
            <dl className={styles.facts}>
              {[
                ["Residence", unit.number],
                ["Type", unit.housingType],
                ["Sales status", statusPresentation[unit.status].label],
                [
                  "Release stage",
                  data.release.find((s) => s.id === unit.releaseStageId)?.name,
                ],
                [
                  "Construction stage",
                  data.construction.find(
                    (s) => s.id === unit.constructionStageId,
                  )?.name,
                ],
                ["Beds", unit.bedrooms],
                ["Baths", unit.bathrooms],
                ["Cars", unit.carSpaces],
                ["Building area", area(unit.buildingAreaSqm)],
                ["Land area", area(unit.landAreaSqm)],
                ["Advertising price · draft", money(unit.publicAskingPrice)],
                ["Advertising price · live", live?.priceDisplay ?? "—"],
                ...(data.permissions["prices.view"]
                  ? [
                      [
                        "Internal price · confidential",
                        money(prices?.askingPrice),
                      ],
                      [
                        "Contract price · confidential",
                        money(prices?.contractPrice),
                      ],
                    ]
                  : []),
                [
                  "Publication",
                  live ? "Present in published snapshot" : "Unpublished",
                ],
                ["Next draft", unit.publicVisible ? "Included" : "Excluded"],
              ].map(([key, value]) => (
                <div key={String(key)}>
                  <dt>{key}</dt>
                  <dd>{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="portal-helper">
              Advertising prices are drafts. Saving inventory or prices never
              publishes a listing. Contract prices are recorded only for genuine
              agreed transactions.
            </p>
            {shared.data.permissions["deals.view"] && (
              <section className="mt-6">
                <h3>Offers, reservations and contracts</h3>
                {shared.lifecycle?.enabled && shared.lifecycle.data ? (
                  <>
                    <p className="portal-helper">
                      {
                        shared.lifecycle.data.offers.filter(
                          (r) => r.unitId === unit.id,
                        ).length
                      }{" "}
                      offers ·{" "}
                      {
                        shared.lifecycle.data.reservations.filter(
                          (r) => r.unitId === unit.id && r.status === "active",
                        ).length
                      }{" "}
                      active reservations ·{" "}
                      {
                        shared.lifecycle.data.contracts.filter(
                          (r) => r.unitId === unit.id,
                        ).length
                      }{" "}
                      contract records.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="portal-button"
                        onClick={() => {
                          onClose();
                          shared.onOpenLifecycle?.("Deals", unit.id, null);
                        }}
                      >
                        Open residence deals
                      </button>
                      <button
                        className="portal-button"
                        onClick={() => {
                          onClose();
                          shared.onOpenLifecycle?.("Contracts", unit.id, null);
                        }}
                      >
                        Open residence contracts
                      </button>
                      <button
                        className="portal-button"
                        onClick={() => {
                          onClose();
                          shared.onOpenLifecycle?.(
                            "Settlement Tracking",
                            unit.id,
                            null,
                          );
                        }}
                      >
                        Settlement progress
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="portal-helper">
                    Transaction entry is not activated. Inventory, CRM and
                    publication controls remain independent.
                  </p>
                )}
              </section>
            )}
            <h3 className="mt-6">Features and internal notes</h3>
            <p>{unit.features.join(" · ") || "—"}</p>
            <p className="mt-3 whitespace-pre-wrap">
              {unit.internalNotes ?? "—"}
            </p>
            <h3 className="mt-6">Approved plans and images</h3>
            {!unit.floorPlans.length && !unit.media.length && (
              <p className="portal-helper">
                No approved plans or images have been linked.
              </p>
            )}
            <ul>
              {unit.floorPlans.map((url, i) => (
                <li key={url}>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    Floor plan {i + 1} ↗
                  </a>
                </li>
              ))}
            </ul>
            <div className={styles.panelImages}>
              {unit.media.map((url, i) => (
                <a
                  key={url}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Image
                    src={url}
                    alt={`Residence ${unit.number} approved reference ${i + 1}`}
                    width={600}
                    height={400}
                    unoptimized
                  />
                </a>
              ))}
            </div>
            {data.permissions["crm.view"] && (
              <section className="mt-6">
                <h3>Associated CRM leads</h3>
                <p className="portal-helper">
                  {leads.length} authorised linked leads.
                </p>
                <button
                  className="portal-button"
                  onClick={() => setView("crm")}
                >
                  View linked CRM leads
                </button>
              </section>
            )}
            {data.permissions["audit.view"] && (
              <section className="mt-6">
                <h3>Activity and edit history</h3>
                <p className="portal-helper">
                  {events.length} events in the loaded project history.
                </p>
                <button
                  className="portal-button"
                  onClick={() => setView("activity")}
                >
                  View residence activity
                </button>
              </section>
            )}
          </>
        )}
        {unit &&
          view === "status" &&
          nextUnitStatuses(unit.status).length === 0 && (
            <p className="portal-helper">
              This status has no permitted next transition.
            </p>
          )}
        {(!unit || ["edit", "status", "pricing"].includes(view)) && (
          <UnitEditor
            {...shared}
            unit={unit}
            onSaved={onSaved}
            section={
              view === "pricing"
                ? "pricing"
                : view === "status"
                  ? "status"
                  : "all"
            }
            key={`${unit?.id ?? "new"}-${unit?.revision ?? 0}-${view}`}
          />
        )}
        {unit && view === "activity" && data.permissions["audit.view"] && (
          <section>
            <h3>Residence activity</h3>
            <p className="portal-helper">
              Latest 200 events for this residence; CRM notes have separate
              access controls.
            </p>
            {unitEvents === null ? (
              <p role="status">Loading residence activity…</p>
            ) : unitEvents.length ? (
              <ol className="divide-y">
                {unitEvents.map((e) => (
                  <li className="py-4 text-sm" key={e.id}>
                    <strong>{e.action}</strong>
                    <p>{displaySalesDate(e.createdAt)}</p>
                    <pre className="mt-2 overflow-auto text-xs">
                      {JSON.stringify(e.details, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            ) : (
              <p>No recorded events for this residence.</p>
            )}
          </section>
        )}
        {unit && view === "crm" && data.permissions["crm.view"] && (
          <section>
            <h3>Linked CRM leads</h3>
            {leads.length ? (
              <ul>
                {leads.map((l) => (
                  <li key={l.id} className="my-4">
                    <strong>{l.name}</strong>
                    <p className="portal-helper">
                      {l.status.replaceAll("_", " ")} · Follow-up{" "}
                      {displaySalesDate(l.followUpAt)}
                    </p>
                    {shared.onOpenLead && (
                      <button
                        className="portal-button"
                        onClick={() => {
                          onClose();
                          shared.onOpenLead?.(l.id);
                        }}
                      >
                        Open lead in CRM
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="portal-helper">
                No authorised CRM leads are linked to this residence.
              </p>
            )}
          </section>
        )}
      </div>
    </dialog>
  );
}
