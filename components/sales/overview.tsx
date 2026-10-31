"use client";
import type { Shared } from "./types";
import { date, label } from "./forms";
import { statusPresentation } from "./inventory-status";
import { displaySalesDate } from "@/lib/sales/dates";
export function Overview({ data }: Shared) {
  if (data.agent)
    return (
      <section className="portal-card">
        <h2>Your assigned sales workspace</h2>
        <p className="portal-helper">
          Published homes: {data.publicData?.units.length ?? 0} · Assigned
          enquiries: {data.leads.length}. Internal inventory and project totals
          are restricted.
        </p>
      </section>
    );
  const count = (...statuses: string[]) =>
    data.units.filter((u) => statuses.includes(u.status)).length;
  const metrics = [
    ["Actual inventory", data.units.length],
    ["Available", count("available")],
    ["Reserved", count("reserved")],
    [
      "Contracted",
      count("contract_issued", "contract_signed", "unconditional"),
    ],
    ["Settled", count("settled")],
    ["Unreleased", count("not_released")],
    ["Released", data.units.length - count("not_released", "withdrawn")],
    ["Currently published", data.publicData?.units.length ?? 0],
    [
      "Not published",
      data.units.filter(
        (u) => !data.publicData?.units.some((p) => p.id === u.id),
      ).length,
    ],
  ];
  return (
    <>
      <section className="portal-card">
        <h2>Inventory by status</h2>
        <div className="mt-4 flex flex-wrap gap-5">
          {Object.entries(statusPresentation).map(([key, item]) => (
            <div key={key} className="text-xs">
              <span
                className="mr-2 inline-block h-2 w-2 rounded-full"
                style={{ background: item.colour }}
              />
              {item.label}
              <strong className="mt-2 block text-xl font-medium">
                {count(key)}
              </strong>
            </div>
          ))}
        </div>
      </section>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map(([name, value]) => (
          <section className="portal-card" key={String(name)}>
            <p className="portal-kicker">{name}</p>
            <p className="text-3xl">{value}</p>
          </section>
        ))}
      </div>
      {!data.units.length && (
        <p className="portal-card">
          No approved inventory has been entered. Planned capacity is{" "}
          {data.settings?.expectedUnits ?? "not configured"}; this is a planning
          figure, not a count of actual homes.
        </p>
      )}
      <section className="portal-card">
        <h2>Sales progress</h2>
        <p className="portal-helper">
          {count("unconditional", "settled")} unconditional or settled of{" "}
          {data.units.length} recorded units.
        </p>
        <progress
          className="mt-4 w-full"
          max={data.units.length || 1}
          value={count("unconditional", "settled")}
          aria-label="Unconditional and settled sales progress"
        />
      </section>
      {data.permissions["audit.view"] && (
        <section className="portal-card">
          <h2>Recent activity</h2>
          {data.history.length ? (
            <ol className="mt-4 divide-y">
              {data.history.slice(0, 5).map((event) => (
                <li key={event.id} className="py-3 text-sm">
                  <strong>{label(event.action)}</strong>
                  <span className="ml-3 text-xs text-[#737b65]">
                    {displaySalesDate(event.createdAt)}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="portal-helper">No recorded sales changes.</p>
          )}
        </section>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {(
          [
            ["Construction stages", data.construction, "constructionStageId"],
            ["Sales release stages", data.release, "releaseStageId"],
          ] as const
        ).map(([title, stages, key]) => (
          <section className="portal-card" key={title}>
            <h2>{title}</h2>
            <ul className="mt-4 space-y-3">
              {stages.map((stage) => (
                <li key={stage.id}>
                  {stage.name}:{" "}
                  {data.units.filter((u) => u[key] === stage.id).length}
                </li>
              ))}
              <li>Unassigned: {data.units.filter((u) => !u[key]).length}</li>
            </ul>
          </section>
        ))}
      </div>
      {data.permissions["crm.view"] && (
        <section className="portal-card">
          <h2>Enquiries and follow-ups</h2>
          <p className="portal-helper">
            New enquiries: {data.leads.filter((l) => l.status === "new").length}{" "}
            · Due follow-ups:{" "}
            {
              data.leads.filter(
                (l) =>
                  l.followUpAt &&
                  new Date(l.followUpAt) <= new Date() &&
                  !["converted", "lost", "archived"].includes(l.status),
              ).length
            }
          </p>
        </section>
      )}
      {data.permissions["prices.view"] && (
        <section className="portal-card">
          <h2>Financial totals · AUD</h2>
          <p className="portal-helper">
            Exact database decimal totals, grouped by recorded GST treatment.
            These figures do not calculate tax advice or infer missing prices.
          </p>
          {data.financeReport.map((row) => (
            <p key={row.gstTreatment} className="mt-3 text-sm">
              {label(row.gstTreatment)} — Contracts: {row.contractTotalAud};
              Deposits: {row.depositTotalAud}; Settlement:{" "}
              {row.settlementTotalAud}
            </p>
          ))}
        </section>
      )}
    </>
  );
}
