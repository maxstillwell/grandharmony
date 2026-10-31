"use client";
import { useState, type ReactNode } from "react";
import type { Shared } from "./types";
import type { PlatformData } from "@/lib/sales/platform-service";
import {
  salesReport,
  salesTasks,
  type ReportFilter,
} from "@/lib/sales/reporting";
import {
  Field,
  Select,
  Area,
  Check,
  formRecord,
  date,
  label,
  options,
} from "./forms";
import { money } from "./inventory-status";
import { displaySalesDate } from "@/lib/sales/dates";
import { amount, cents } from "@/lib/sales/lifecycle-domain";
function Editor({
  title,
  children,
  onSave,
  pending,
}: {
  title: string;
  children: ReactNode;
  onSave: (r: Record<string, unknown>) => void;
  pending: boolean;
}) {
  return (
    <details className="portal-card mb-5">
      <summary className="cursor-pointer font-medium">{title}</summary>
      <form
        className="mt-5 grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(formRecord(e.currentTarget));
        }}
      >
        <fieldset disabled={pending} className="contents">
          {children}
          <button className="portal-button md:col-span-2">
            Save {title.toLowerCase()}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
function Register({
  columns,
  rows,
}: {
  columns: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th className="p-3" key={c}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr className="border-t" key={i}>
              {row.map((v, j) => (
                <td className="p-3 align-top" key={j}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <p className="portal-empty">No records in this transaction mode.</p>
      )}
    </div>
  );
}
export function PlatformWorkspace({
  shared,
  p,
  area,
}: {
  shared: Shared;
  p: PlatformData;
  area: string;
}) {
  const { data, lifecycle, run, pending, demo, projectId } = shared,
    life = lifecycle?.data;
  const [filter, setFilter] = useState<ReportFilter>({
      from: "",
      to: "",
      stage: "",
      agent: "",
    }),
    [search, setSearch] = useState("");
  if (!life)
    return (
      <section className="portal-card">
        <h2>{area}</h2>
        <p className="portal-helper">
          Transaction services are unavailable or your role does not permit
          access.
        </p>
      </section>
    );
  const finance = Boolean(data.permissions["prices.view"]),
    manage = Boolean(data.permissions["leads.assign"]),
    financialEdit = Boolean(data.permissions["prices.edit"]),
    approve = Boolean(data.permissions["deals.approve"]),
    settlement = Boolean(data.permissions["settlement.edit"]);
  const report = salesReport(data, life, p, filter),
    agentOptions = p.agents.map((a) => ({ value: a.id, label: a.displayName })),
    contractOptions = life.contracts.map((c) => ({
      value: c.id,
      label: `Residence ${data.units.find((u) => u.id === c.unitId)?.number ?? "?"} · ${data.leads.find((l) => l.id === c.leadId)?.name ?? "Buyer restricted"} · ${label(c.status)}`,
    }));
  const save = (op: string, r: Record<string, unknown>) => {
    void run(`platform.${op}`, r);
  };
  const modeQuery =
    (demo ? "&mode=demo" : "") + "&" + new URLSearchParams(filter).toString();
  const exportLink = (kind: string, title: string) => (
    <a
      className="portal-button"
      href={`/api/portal/projects/${projectId}/sales/export?kind=${kind}${modeQuery}`}
    >
      {title} CSV
    </a>
  );
  if (area === "Agents")
    return (
      <>
        <section className="portal-card">
          <h2>Sales agents & project team</h2>
          <p className="portal-helper">
            Profiles use existing authorised project identities. Project access
            and permissions are managed in Administration.
          </p>
          <p className="portal-helper">
            A Super Admin can manage existing project memberships through
            Administration; agent profiles do not grant access.
          </p>
          <Register
            columns={[
              "Agent / company",
              "Contact",
              "Assigned buyers",
              "Associated residences",
              "Offers",
              "Contracts",
              "Contracted value",
            ]}
            rows={report.agents.map((a) => {
              const profile = p.agents.find((x) => x.id === a.id)!;
              return [
                <span key={a.id}>
                  {a.name}
                  <small className="block">{a.company}</small>
                </span>,
                <span key="contact">
                  {profile.email}
                  <br />
                  {profile.phone}
                </span>,
                a.buyers,
                <div className="flex flex-wrap gap-2" key="residences">
                  {a.residenceIds.map((id) => (
                    <button
                      key={id}
                      className="underline"
                      onClick={() => shared.onOpenUnit?.(id)}
                    >
                      Residence {data.units.find((u) => u.id === id)?.number}
                    </button>
                  ))}
                </div>,
                a.offers,
                a.contracts,
                finance ? money(a.value) : "Restricted",
              ];
            })}
          />
        </section>
        {manage &&
          data.assignees.some(
            (a) => !p.agents.some((p) => p.userId === a.id),
          ) && (
            <Editor
              title="Agent profile"
              pending={pending}
              onSave={(r) => {
                const old = p.agents.find((a) => a.userId === r.userId);
                save("agent", { ...r, revision: old?.revision });
              }}
            >
              <Select
                name="userId"
                label="Existing project member"
                options={[
                  { value: "", label: "Choose a member" },
                  ...data.assignees
                    .filter((a) => !p.agents.some((p) => p.userId === a.id))
                    .map((a) => ({
                      value: a.id,
                      label: a.name ?? a.id,
                    })),
                ]}
              />
              <Field name="displayName" label="Display name" required />
              <Field name="company" label="Agency / company" />
              <Field name="email" label="Contact email" type="email" />
              <Field name="phone" label="Phone" />
              <Area name="notes" label="Internal profile notes" />
            </Editor>
          )}
        {manage &&
          p.agents.map((a) => (
            <Editor
              key={`${a.id}-${a.revision}`}
              title={`Edit agent profile · ${a.displayName}`}
              pending={pending}
              onSave={(r) =>
                save("agent", { ...r, userId: a.userId, revision: a.revision })
              }
            >
              <Field
                name="displayName"
                label="Display name"
                value={a.displayName}
                required
              />
              <Field
                name="company"
                label="Agency / company"
                value={a.company}
              />
              <Field
                name="email"
                label="Contact email"
                type="email"
                value={a.email}
              />
              <Field name="phone" label="Phone" value={a.phone} />
              <Area
                name="notes"
                label="Internal profile notes"
                value={a.notes}
              />
            </Editor>
          ))}
      </>
    );
  if (area === "Commissions")
    return (
      <>
        <section className="portal-card">
          <h2>Commission register</h2>
          <p className="portal-helper">
            Estimates, approved obligations and confirmed payment evidence are
            separate. No payments are executed. Rates and GST are explicitly
            configured per agreement.
          </p>
          {finance ? (
            <>
              {exportLink("commissions", "Commission report")}
              <Register
                columns={[
                  "Agent",
                  "Contract",
                  "Estimate incl. configured GST",
                  "GST component",
                  "Approved",
                  "Confirmed paid",
                  "Status",
                ]}
                rows={p.commissions.map((c) => [
                  p.agents.find((a) => a.id === c.agentId)?.displayName ??
                    "Agent",
                  contractOptions.find((o) => o.value === c.contractId)?.label,
                  money(c.estimatedAmount),
                  money(c.gstAmount),
                  money(c.approvedAmount),
                  money(c.paidAmount),
                  label(c.status),
                ])}
              />
            </>
          ) : (
            <p>
              Financial information is restricted to authorised developer /
              finance roles.
            </p>
          )}
        </section>
        {financialEdit && approve && (
          <Editor
            title="Commission agreement"
            pending={pending}
            onSave={(r) => save("agreement", r)}
          >
            <Select name="agentId" label="Agent" options={agentOptions} />
            <Select
              name="kind"
              label="Commission basis"
              options={options(["percentage", "fixed"])}
            />
            <Field
              name="rate"
              label="Agreed percentage · no default"
              type="number"
              step="0.0001"
            />
            <Field
              name="fixedAmount"
              label="Agreed fixed amount · AUD"
              type="number"
            />
            <Select
              name="gstTreatment"
              label="GST treatment"
              options={options([
                "unconfirmed",
                "inclusive",
                "exclusive",
                "not_applicable",
              ])}
            />
            <Field
              name="gstRate"
              label="Explicit GST percentage (inclusive / exclusive)"
              type="number"
              step="0.0001"
            />
            <Select
              name="payableMilestone"
              label="Earliest approval milestone"
              options={options([
                "manual",
                "signed",
                "unconditional",
                "settled",
              ])}
            />
            <Field
              name="documentReference"
              label="Agreement document reference"
            />
            <Area name="notes" label="Agreement notes" />
          </Editor>
        )}
        {financialEdit && (
          <Editor
            title="Contract commission estimate"
            pending={pending}
            onSave={(r) => save("estimate", r)}
          >
            <Select
              name="contractId"
              label="Contract"
              options={contractOptions}
            />
            <Select
              name="agreementId"
              label="Explicit agreement"
              options={p.agreements.map((a) => ({
                value: a.id,
                label: `${p.agents.find((x) => x.id === a.agentId)?.displayName ?? "Agent"} · ${a.kind === "percentage" ? a.rate + "%" : money(a.fixedAmount)} · ${a.gstTreatment}`,
              }))}
            />
          </Editor>
        )}
        {finance &&
          p.commissions
            .filter(
              (c) =>
                (c.status === "estimated" && approve) ||
                (["approved", "part_paid"].includes(c.status) && settlement) ||
                (approve &&
                  c.status !== "cancelled" &&
                  cents(c.paidAmount) === 0n),
            )
            .map((c) => (
              <Editor
                key={`${c.id}-${c.revision}`}
                title={`Commission decision · ${p.agents.find((a) => a.id === c.agentId)?.displayName ?? "Agent"} · ${label(c.status)}`}
                pending={pending}
                onSave={(r) =>
                  save("commission", { ...r, id: c.id, revision: c.revision })
                }
              >
                <Select
                  name="status"
                  label="Action"
                  options={[
                    ...(approve && c.status === "estimated"
                      ? [{ value: "approved", label: "Approve obligation" }]
                      : []),
                    ...(settlement &&
                    ["approved", "part_paid"].includes(c.status)
                      ? [
                          {
                            value: "paid",
                            label: "Record cumulative confirmed payment",
                          },
                        ]
                      : []),
                    ...(approve && cents(c.paidAmount) === 0n
                      ? [
                          {
                            value: "cancelled",
                            label: "Cancel unpaid obligation",
                          },
                        ]
                      : []),
                  ]}
                />
                <Field
                  name="approvedAmount"
                  label="Approved obligation · AUD"
                  type="number"
                  value={c.estimatedAmount}
                />
                <Field
                  name="paidAmount"
                  label="Cumulative confirmed payment · AUD"
                  type="number"
                  value={c.paidAmount}
                />
                <Field
                  name="paidAt"
                  label="Payment evidence date · Sydney"
                  type="datetime-local"
                />
                <Field
                  name="paymentReference"
                  label="Payment evidence reference"
                />
                <Area name="reason" label="Reason" required />
                <Check
                  name="confirm"
                  label="Confirm this internal evidence / decision; no bank payment will be sent"
                  required
                />
              </Editor>
            ))}
      </>
    );
  if (area === "Finance tools")
    return (
      <>
        <section className="portal-card">
          <h2>Contract amendments & cash evidence</h2>
          <p className="portal-helper">
            Receipt corrections append signed adjustments to the immutable
            ledger. Existing receipts are never silently overwritten. No bank
            payments or refunds are executed.
          </p>
          {finance && exportLink("cash", "Cash ledger")}
          <Register
            columns={[
              "Evidence date",
              "Contract",
              "Category",
              "AUD change",
              "Reference",
              "Reason",
            ]}
            rows={p.cash.map((c) => [
              displaySalesDate(c.receivedAt),
              contractOptions.find((o) => o.value === c.contractId)?.label,
              label(c.category),
              money(c.amount),
              c.reference,
              c.reason,
            ])}
          />
        </section>
        {financialEdit && settlement && (
          <Editor
            title="Receipt correction"
            pending={pending}
            onSave={(r) => {
              const c = life.contracts.find((c) => c.id === r.id);
              save("cashAdjustment", { ...r, revision: c?.revision });
            }}
          >
            <Select name="id" label="Contract" options={contractOptions} />
            <Select
              name="category"
              label="Cash category"
              options={options(["deposit", "settlement"])}
            />
            <Select
              name="direction"
              label="Adjustment direction"
              options={options(["decrease", "increase"])}
            />
            <Field
              name="amount"
              label="Adjustment amount · AUD"
              type="number"
              required
            />
            <Field
              name="receivedAt"
              label="Evidence date · Sydney"
              type="datetime-local"
              required
            />
            <Field
              name="reference"
              label="Correction evidence reference"
              required
            />
            <Area name="reason" label="Correction reason" required />
            <Check
              name="confirm"
              label="Confirm auditable adjustment; no refund or transfer is executed"
              required
            />
          </Editor>
        )}
        {financialEdit &&
          approve &&
          life.contracts
            .filter(
              (c) =>
                !["completed", "cancelled", "terminated"].includes(c.status),
            )
            .map((c) => (
              <Editor
                key={`${c.id}-${c.revision}`}
                title={`Amend contract · Residence ${data.units.find((u) => u.id === c.unitId)?.number ?? "?"}`}
                pending={pending}
                onSave={(r) =>
                  save("amendContract", {
                    ...r,
                    id: c.id,
                    revision: c.revision,
                  })
                }
              >
                <Field
                  name="contractPrice"
                  label="Agreed contract price · AUD"
                  type="number"
                  value={c.contractPrice}
                  required
                />
                <Field
                  name="depositAmount"
                  label="Agreed deposit target · AUD"
                  type="number"
                  value={c.depositAmount}
                />
                <Field
                  name="depositPercentage"
                  label="Agreed deposit percentage"
                  type="number"
                  value={c.depositPercentage}
                />
                <Field
                  name="depositDueAt"
                  label="Deposit due · Sydney"
                  type="datetime-local"
                  value={date(c.depositDueAt)}
                  instant={c.depositDueAt}
                />
                <Field
                  name="expectedSettlementAt"
                  label="Expected settlement · Sydney"
                  type="datetime-local"
                  value={date(c.expectedSettlementAt)}
                  instant={c.expectedSettlementAt}
                />
                <Field
                  name="solicitorName"
                  label="Solicitor / conveyancer"
                  value={c.solicitorName}
                />
                <Field
                  name="solicitorEmail"
                  label="Solicitor email"
                  type="email"
                  value={c.solicitorEmail}
                />
                <Field
                  name="solicitorPhone"
                  label="Solicitor phone"
                  value={c.solicitorPhone}
                />
                <Area
                  name="financeCondition"
                  label="Finance condition"
                  value={c.financeCondition}
                />
                <Area
                  name="otherConditions"
                  label="Other conditions"
                  value={c.otherConditions}
                />
                <Field
                  name="documentReference"
                  label="Amendment document reference"
                  value={c.documentReference}
                  required
                />
                <Area
                  name="notes"
                  label="Private contract notes"
                  value={c.notes}
                />
                <Area name="reason" label="Amendment reason" required />
                <Check
                  name="confirm"
                  label="Confirm recorded amendment and preserve audit history"
                  required
                />
              </Editor>
            ))}
      </>
    );
  if (area === "Tasks") {
    const tasks = salesTasks(data, life, finance),
      states = p.taskStates;
    return (
      <section className="portal-card">
        <h2>Tasks & reminders</h2>
        <p className="portal-helper">
          Internal reminders only. Expiry requires an authorised manual
          decision; no customer email or SMS is sent. Completion applies to your
          personal task list.
        </p>
        <Field name="search" label="Search tasks">
          <input
            className="border p-3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
        <Register
          columns={["Task", "Due · Sydney", "State", "Actions"]}
          rows={tasks
            .filter((t) => t.title.toLowerCase().includes(search.toLowerCase()))
            .map((t) => {
              const state = states.find((s) => s.taskKey === t.key);
              return [
                t.title,
                displaySalesDate(t.due),
                state?.completedAt
                  ? "Completed"
                  : state?.snoozedUntil &&
                      new Date(state.snoozedUntil) > new Date()
                    ? "Snoozed"
                    : t.due && t.due < new Date()
                      ? "Due / overdue"
                      : "Upcoming",
                <div className="flex flex-wrap gap-2" key={t.key}>
                  <button
                    className="portal-button"
                    onClick={() =>
                      t.leadId && t.area === "Leads / CRM"
                        ? shared.onOpenLead?.(t.leadId)
                        : shared.onOpenLifecycle?.(t.area, t.unitId, t.leadId)
                    }
                  >
                    Open record
                  </button>
                  <button
                    className="portal-button"
                    disabled={pending}
                    onClick={() =>
                      save("task", {
                        taskKey: t.key,
                        complete: !state?.completedAt,
                      })
                    }
                  >
                    {state?.completedAt ? "Reopen" : "Complete"}
                  </button>
                  <button
                    className="portal-button"
                    disabled={pending}
                    onClick={() =>
                      save("task", {
                        taskKey: t.key,
                        snoozedUntil: new Date(
                          Date.now() + 86400000,
                        ).toISOString(),
                      })
                    }
                  >
                    Snooze 1 day
                  </button>
                </div>,
              ];
            })}
        />
      </section>
    );
  }
  if (area === "Release planning")
    return (
      <>
        <section className="portal-card">
          <h2>Sales release planning</h2>
          <p className="portal-helper">
            Construction and sales release stages remain distinct. Plans do not
            release or publish residences automatically.
          </p>
          <Register
            columns={[
              "Release",
              "Assigned residences",
              "Available",
              "Reserved",
              "Contracted / settled",
              "Planned date",
              "Target units / value",
            ]}
            rows={data.release.map((s) => {
              const units = data.units.filter((u) => u.releaseStageId === s.id),
                plan = p.plans.find((p) => p.stageId === s.id);
              return [
                s.name,
                units.length,
                units.filter((u) => u.status === "available").length,
                life.reservations.filter(
                  (r) =>
                    r.status === "active" &&
                    units.some((u) => u.id === r.unitId),
                ).length,
                life.contracts.filter(
                  (c) =>
                    [
                      "signed",
                      "conditional",
                      "unconditional",
                      "completed",
                    ].includes(c.status) &&
                    units.some((u) => u.id === c.unitId),
                ).length,
                displaySalesDate(plan?.plannedAt),
                `${plan?.targetUnits ?? "Not set"} / ${finance ? money(plan?.targetValue) : "Restricted"}`,
              ];
            })}
          />
        </section>
        {data.permissions["inventory.edit"] &&
          data.release.map((s) => {
            const plan = p.plans.find((p) => p.stageId === s.id);
            return (
              <Editor
                key={`${s.id}-${plan?.revision}`}
                title={`Release plan · ${s.name}`}
                pending={pending}
                onSave={(r) =>
                  save("releasePlan", {
                    ...r,
                    stageId: s.id,
                    revision: plan?.revision,
                  })
                }
              >
                <Field
                  name="plannedAt"
                  label="Planned release · Sydney"
                  type="datetime-local"
                  value={date(plan?.plannedAt)}
                  instant={plan?.plannedAt}
                />
                <Field
                  name="targetUnits"
                  label="Target residences (optional)"
                  type="number"
                  step="1"
                  value={plan?.targetUnits}
                />
                {finance && (
                  <Field
                    name="targetValue"
                    label="Internal target value · AUD"
                    type="number"
                    value={plan?.targetValue}
                  />
                )}
                {finance && (
                  <Area
                    name="pricingNote"
                    label="Release pricing / planning notes"
                    value={plan?.pricingNote}
                  />
                )}
              </Editor>
            );
          })}
      </>
    );
  const financeMetrics = [
    ["Total asking value (not cash)", report.asking],
    ["Contracted sale value", report.summary.contracted],
    ["Confirmed cash received", report.summary.confirmedReceipts],
    ["Deposits expected", report.summary.depositsExpected],
    ["Deposits confirmed received", report.summary.depositsConfirmed],
    ["Settlement cash confirmed received", report.summary.settlementConfirmed],
    ["Outstanding deposit", report.summary.outstandingDeposits],
    [
      "Expected remaining settlement proceeds",
      report.summary.outstandingContractBalance,
    ],
    ["Average contracted price", report.averageContract],
    ["Submitted / accepted offer pipeline", report.pipeline],
  ];
  return (
    <>
      <section className="portal-card sales-report">
        <div className="flex flex-wrap justify-between gap-3">
          <h2>
            {area === "Analytics"
              ? "Sales executive dashboard"
              : "Reports & exports"}{" "}
            · {demo ? "DEMO" : "REAL"}
          </h2>
          <button className="portal-button" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
        <p className="portal-helper">
          Filters apply to dashboard tables. Date filters use transaction
          creation date (UTC). Transaction CSV exports use these filters.
          Inventory, price and buyer CSV exports contain the complete authorised
          project register for this mode. Asking value is inventory context; it
          is not revenue or cash.
        </p>
        <div className="my-5 grid gap-4 md:grid-cols-4">
          <Field name="from" label="Created from · UTC" type="date">
            <input
              className="w-full border p-3"
              type="date"
              value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })}
            />
          </Field>
          <Field name="to" label="Created through · UTC" type="date">
            <input
              className="w-full border p-3"
              type="date"
              value={filter.to}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })}
            />
          </Field>
          <Field name="stage" label="Construction / release">
            <select
              className="w-full border p-3"
              value={filter.stage}
              onChange={(e) => setFilter({ ...filter, stage: e.target.value })}
            >
              <option value="">All stages</option>
              {[...data.construction, ...data.release].map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field name="agent" label="Agent">
            <select
              className="w-full border p-3"
              value={filter.agent}
              onChange={(e) => setFilter({ ...filter, agent: e.target.value })}
            >
              <option value="">All agents</option>
              {data.assignees.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name ?? a.id}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            ["Residences", report.units.length],
            [
              "Available",
              report.units.filter((u) => u.status === "available").length,
            ],
            [
              "Active reservations",
              report.reservations.filter((r) => r.status === "active").length,
            ],
            [
              "Under offer",
              new Set(
                report.offers
                  .filter((o) => ["submitted", "accepted"].includes(o.status))
                  .map((o) => o.unitId),
              ).size,
            ],
            [
              "Contracted residences",
              new Set(report.active.map((c) => c.unitId)).size,
            ],
            [
              "Settled",
              report.active.filter((c) => c.status === "completed").length,
            ],
            ["Sales in last 30 days · contract date", report.velocity30Days],
            ["Overdue settlements", report.summary.overdueSettlements],
            [
              "Follow-up workload",
              salesTasks(data, life, finance).filter(
                (t) => t.area === "Leads / CRM",
              ).length,
            ],
          ].map(([title, value]) => (
            <div className="border p-4" key={String(title)}>
              <p className="text-xs">{title}</p>
              <p className="mt-2 text-2xl">{value}</p>
            </div>
          ))}
          {finance &&
            financeMetrics.map(([title, value]) => (
              <div className="col-span-2 border p-4 sm:col-span-1" key={title}>
                <p className="text-xs">{title}</p>
                <p className="mt-2 text-xl">{money(value)}</p>
              </div>
            ))}
        </div>
        <div className="my-6">
          <h3>Sales progress · active contracts / selected residences</h3>
          <progress
            className="mt-3 w-full"
            value={new Set(report.active.map((c) => c.unitId)).size}
            max={Math.max(1, report.units.length)}
          />
          <p className="text-xs">
            {new Set(report.active.map((c) => c.unitId)).size} /{" "}
            {report.units.length}
          </p>
        </div>
        <h3>Monthly signed sales · contract date</h3>
        <div className="my-5 space-y-3">
          {report.monthlySales.length ? (
            report.monthlySales.map((m) => (
              <div key={m.month}>
                <span className="text-xs">
                  {m.month} · {m.contracts} contracts
                </span>
                <progress
                  className="block w-full"
                  max={Math.max(
                    1,
                    ...report.monthlySales.map((m) => m.contracts),
                  )}
                  value={m.contracts}
                />
              </div>
            ))
          ) : (
            <p className="portal-empty">No signed sales in this filter.</p>
          )}
        </div>
        <h3>Construction & release performance</h3>
        <Register
          columns={[
            "Stage",
            "Kind",
            "Residences",
            "Contracts",
            "Contracted value",
          ]}
          rows={report.stageRevenue.map((s) => [
            s.name,
            s.kind,
            s.units,
            s.contracts,
            finance ? money(s.value) : "Restricted",
          ])}
        />
        <h3 className="mt-6">Agent performance</h3>
        <Register
          columns={[
            "Agent",
            "Buyers",
            "Offers",
            "Contracts",
            "Contracted value",
          ]}
          rows={report.agents.map((a) => [
            a.name,
            a.buyers,
            a.offers,
            a.contracts,
            finance ? money(a.value) : "Restricted",
          ])}
        />
        {data.permissions["crm.view"] && (
          <>
            <h3 className="mt-6">Lead sources</h3>
            <Register
              columns={["Source", "Buyers", "Qualified", "Contracted buyers"]}
              rows={report.sources.map((s) => [
                s.source,
                s.leads,
                s.qualified,
                s.converted,
              ])}
            />
          </>
        )}
        <h3 className="mt-6">Settlement schedule</h3>
        <Register
          columns={[
            "Residence",
            "Contract status",
            "Expected settlement",
            "Contracted value",
            "Confirmed cash",
            "Balance",
          ]}
          rows={report.contracts.map((c) => [
            <button
              className="underline"
              key={c.id}
              onClick={() => shared.onOpenUnit?.(c.unitId)}
            >
              {data.units.find((u) => u.id === c.unitId)?.number}
            </button>,
            label(c.status),
            displaySalesDate(c.expectedSettlementAt),
            finance ? money(c.contractPrice) : "Restricted",
            finance
              ? money(
                  amount(
                    cents(c.depositReceivedAmount) +
                      cents(c.settlementReceivedAmount),
                  ),
                )
              : "Restricted",
            finance
              ? money(
                  amount(
                    cents(c.contractPrice) -
                      cents(c.depositReceivedAmount) -
                      cents(c.settlementReceivedAmount),
                  ),
                )
              : "Restricted",
          ])}
        />
      </section>
      <section className="portal-card">
        <h2>Authorised reports · {demo ? "DEMO" : "REAL"}</h2>
        <div className="my-5 flex flex-wrap gap-3">
          {exportLink("inventory", "Inventory / availability")}
          {data.permissions["crm.export"] && (
            <>
              {exportLink("leads", "Buyer register")}
              {exportLink("crmActivity", "CRM activity")}
              {exportLink("leadSources", "Lead source conversion")}
            </>
          )}
          {exportLink("offers", "Offer register")}
          {exportLink("reservations", "Reservations")}
          {finance && (
            <>
              {exportLink("summary", "Project sales summary")}
              {exportLink("performance", "Sales performance by stage")}
              {exportLink("prices", "Private price list")}
              {exportLink("contracts", "Contract register")}
              {exportLink("deposits", "Deposit report")}
              {exportLink("settlements", "Settlement schedule")}
              {exportLink("agents", "Agent performance")}
              {exportLink("commissions", "Commissions")}
              {exportLink("cash", "Confirmed cash")}
            </>
          )}
        </div>
      </section>
      {demo && (
        <Editor
          title="Reset my Demo transactions"
          pending={pending}
          onSave={(r) => save("reset", { confirm: r.resetPhrase })}
        >
          <p>
            Deletes only your simulated buyers, transactions and demo state.
            Real inventory, prices, publications and other users’ workspaces
            remain unchanged.
          </p>
          <Field name="resetPhrase" label="Type RESET MY DEMO" required />
        </Editor>
      )}
    </>
  );
}
