"use client";
import { useEffect, useRef, useState } from "react";
import type { Shared } from "./types";
import type { LifecycleState } from "@/lib/sales/lifecycle-access";
import type { TransactionKind } from "@/lib/sales/lifecycle-service";
import {
  contractTransitions,
  offerTransitions,
  reservationTransitions,
  settlementSummary,
} from "@/lib/sales/lifecycle-domain";
import {
  Area,
  Check,
  Field,
  Select,
  formRecord,
  label,
  options,
  date,
} from "./forms";
import { displaySalesDate } from "@/lib/sales/dates";
import { money } from "./inventory-status";
import styles from "./inventory.module.css";
const transitions = {
  offer: offerTransitions,
  reservation: reservationTransitions,
  contract: contractTransitions,
};
export function LifecycleWorkspace({
  shared,
  state,
  area = "Deals",
  unitFilter,
  leadFilter,
}: {
  shared: Shared;
  state: LifecycleState;
  area?: string;
  unitFilter?: string | null;
  leadFilter?: string | null;
}) {
  const [kind, setKind] = useState<TransactionKind>(
      area === "Deals" ? "offer" : "contract",
    ),
    [selected, setSelected] = useState<string | null>(null),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const editor = useRef<HTMLElement>(null);
  useEffect(() => {
    if (selected && editor.current) {
      editor.current.scrollIntoView({ block: "start" });
      editor.current.focus({ preventScroll: true });
    }
  }, [selected, kind]);
  if (!state.enabled || !state.data)
    return (
      <section className="portal-card">
        <p className="portal-kicker">Sales lifecycle · Not active</p>
        <h2>{area}</h2>
        <p className="portal-helper">
          {state.reason ?? "Transaction entry is not activated."}
        </p>
        <p className="portal-helper">
          Existing inventory and CRM remain available. No offer, reservation,
          contract, receipt or automatic inventory change can be recorded here
          until activation is approved.
        </p>
      </section>
    );
  const data = state.data,
    table =
      kind === "offer"
        ? data.offers
        : kind === "reservation"
          ? data.reservations
          : data.contracts;
  const rows = table.filter(
    (r) =>
      (!unitFilter || r.unitId === unitFilter) &&
      (!leadFilter || r.leadId === leadFilter) &&
      (!status || r.status === status) &&
      `${shared.data.units.find((u) => u.id === r.unitId)?.number ?? ""} ${shared.data.leads.find((l) => l.id === r.leadId)?.name ?? ""} ${r.status}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const record = table.find((r) => r.id === selected),
    summary = settlementSummary(data.contracts);
  const canEdit =
    shared.data.permissions[
      kind === "contract" ? "contracts.edit" : "deals.edit"
    ];
  const openUnit = (id: string) => shared.onOpenUnit?.(id);
  return (
    <>
      {area === "Settlement Tracking" && (
        <section className="portal-card">
          <p className="portal-kicker">Confirmed facts, not cash forecasts</p>
          <h2>Settlement tracking</h2>
          <div className={styles.summary}>
            {[
              ["Signed / unconditional", summary.signed],
              ["Completed settlements", summary.completed],
              ["Overdue expected settlements", summary.overdueSettlements],
              ...(shared.data.permissions["prices.view"]
                ? [
                    ["Contracted · AUD", money(summary.contracted)],
                    [
                      "Confirmed receipts · AUD",
                      money(summary.confirmedReceipts),
                    ],
                    [
                      "Receipts on cancelled contracts · AUD",
                      money(summary.cancelledContractReceipts),
                    ],
                    [
                      "Outstanding deposits · AUD",
                      money(summary.outstandingDeposits),
                    ],
                    [
                      "Remaining contract balance · AUD",
                      money(summary.outstandingContractBalance),
                    ],
                  ]
                : []),
            ].map(([k, v]) => (
              <span key={String(k)}>
                <strong>{v}</strong>
                {k}
              </span>
            ))}
          </div>
          <p className="portal-helper">
            Draft offers are not contracted revenue. Signed contract values are
            not cash receipts. {summary.unconfirmedDepositTargets} deposit
            targets are unspecified. Dates, amounts and payments are never
            inferred; no banking or payment execution is connected. Receipts on
            cancelled contracts remain recorded; refunds are not inferred.
          </p>
        </section>
      )}
      <section className="portal-card">
        <div className={styles.toolbar}>
          <div>
            <p className="portal-kicker">Internal sales lifecycle</p>
            <h2>
              {kind === "offer"
                ? "Offers"
                : kind === "reservation"
                  ? "Reservations"
                  : "Contract register"}
            </h2>
          </div>
          <div className={styles.actions}>
            {area === "Deals" && (
              <>
                <button
                  aria-pressed={kind === "offer"}
                  onClick={() => {
                    setKind("offer");
                    setSelected(null);
                    setStatus("");
                  }}
                >
                  Offers
                </button>
                <button
                  aria-pressed={kind === "reservation"}
                  onClick={() => {
                    setKind("reservation");
                    setSelected(null);
                    setStatus("");
                  }}
                >
                  Reservations
                </button>
              </>
            )}
            {canEdit && area !== "Settlement Tracking" && (
              <button
                onClick={() => {
                  shared.clearFeedback?.();
                  setSelected("new");
                }}
              >
                New {kind} draft
              </button>
            )}
          </div>
        </div>
        {(unitFilter || leadFilter) && (
          <p className={styles.warning}>
            Filtered from a linked residence or buyer.{" "}
            <button
              className="underline"
              onClick={() => shared.onOpenLifecycle?.(area, null, null)}
            >
              Show all project records
            </button>
          </p>
        )}
        <div className={styles.filters}>
          <label>
            Find transaction
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Residence, buyer or status"
            />
          </label>
          <label>
            Transaction status
            <select
              aria-label="Transaction status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {Object.keys(transitions[kind]).map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                {[
                  "Residence",
                  "Buyer",
                  "Status",
                  kind === "offer"
                    ? "Offer · AUD"
                    : kind === "contract"
                      ? "Contract · AUD"
                      : "Start",
                  "Expiry / expected settlement",
                  "",
                ].map((x, i) => (
                  <th scope="col" key={i}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      className="underline"
                      onClick={() => openUnit(r.unitId)}
                    >
                      Residence{" "}
                      {shared.data.units.find((u) => u.id === r.unitId)
                        ?.number ?? "—"}
                    </button>
                  </td>
                  <td>
                    {shared.data.leads.find((l) => l.id === r.leadId)?.name ??
                      "Restricted buyer"}
                  </td>
                  <td>
                    <span className={styles.tag}>{label(r.status)}</span>
                  </td>
                  <td>
                    {"amount" in r
                      ? money(r.amount)
                      : "contractPrice" in r
                        ? shared.data.permissions["prices.view"]
                          ? money(r.contractPrice)
                          : "Restricted"
                        : displaySalesDate(r.startsAt)}
                  </td>
                  <td>
                    {"expectedSettlementAt" in r
                      ? displaySalesDate(r.expectedSettlementAt)
                      : displaySalesDate(r.expiresAt)}
                  </td>
                  <td>
                    <button
                      className="portal-button"
                      onClick={() => {
                        shared.clearFeedback?.();
                        setSelected(r.id);
                      }}
                    >
                      Open {kind}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <p className={styles.empty}>
              No {kind} records match. No transaction is created automatically.
            </p>
          )}
        </div>
      </section>
      {selected && (
        <section
          className="portal-card"
          aria-label="Transaction detail"
          ref={editor}
          tabIndex={-1}
        >
          <div className={styles.toolbar}>
            <h2>
              {selected === "new"
                ? `New ${kind} draft`
                : `${label(record?.status ?? "")} ${kind}`}
            </h2>
            <button className="portal-button" onClick={() => setSelected(null)}>
              Close transaction
            </button>
          </div>
          {shared.feedback?.message && (
            <p
              role={shared.feedback.failed ? "alert" : "status"}
              className={styles.warning}
            >
              {shared.feedback.message}
            </p>
          )}
          {record && (
            <>
              <p className="portal-helper">
                Residence{" "}
                {shared.data.units.find((u) => u.id === record.unitId)?.number}{" "}
                · Revision {record.revision}. Canonical inventory status:{" "}
                {label(
                  shared.data.units.find((u) => u.id === record.unitId)
                    ?.status ?? "unknown",
                )}
                . Public availability still requires separate publication
                approval.
              </p>
              <dl className={styles.facts}>
                {[
                  [
                    "Buyer",
                    shared.data.leads.find((l) => l.id === record.leadId)
                      ?.name ?? "Restricted buyer",
                  ],
                  [
                    "Assigned project member",
                    record.agentId
                      ? (shared.data.assignees.find(
                          (a) => a.id === record.agentId,
                        )?.name ?? "Assigned")
                      : "Unassigned",
                  ],
                  ...("amount" in record
                    ? [
                        ["Offer amount · AUD", money(record.amount)],
                        ["Offer date", displaySalesDate(record.offeredAt)],
                        ["Offer expiry", displaySalesDate(record.expiresAt)],
                      ]
                    : []),
                  ...("startsAt" in record
                    ? [
                        [
                          "Reservation start",
                          displaySalesDate(record.startsAt),
                        ],
                        [
                          "Reservation expiry",
                          displaySalesDate(record.expiresAt),
                        ],
                      ]
                    : []),
                  ...("contractDate" in record
                    ? [
                        [
                          "Contract date",
                          displaySalesDate(record.contractDate),
                        ],
                        [
                          "Expected settlement",
                          displaySalesDate(record.expectedSettlementAt),
                        ],
                        [
                          "Actual settlement",
                          displaySalesDate(record.actualSettlementAt),
                        ],
                        ...(shared.data.permissions["prices.view"]
                          ? [
                              [
                                "Agreed contract · AUD",
                                money(record.contractPrice),
                              ],
                              [
                                "Deposit target · AUD",
                                money(record.depositAmount),
                              ],
                              [
                                "Confirmed deposit received · AUD",
                                money(record.depositReceivedAmount),
                              ],
                              [
                                "Deposit received date",
                                displaySalesDate(record.depositReceivedAt),
                              ],
                              [
                                "Confirmed settlement received · AUD",
                                money(record.settlementReceivedAmount),
                              ],
                              [
                                "Settlement received date",
                                displaySalesDate(record.settlementReceivedAt),
                              ],
                            ]
                          : []),
                      ]
                    : []),
                ].map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              {"conditions" in record && record.conditions && (
                <p className="my-4 whitespace-pre-wrap text-sm">
                  <strong>Conditions: </strong>
                  {record.conditions}
                </p>
              )}
              <p className="whitespace-pre-wrap text-sm">
                {record.notes ?? "No notes recorded."}
              </p>
              {"documentReference" in record && record.documentReference && (
                <p className="portal-helper">
                  Private document reference: {record.documentReference}
                </p>
              )}
            </>
          )}
          {(selected === "new" || record?.status === "draft") && canEdit && (
            <TransactionEditor
              key={`${kind}-${selected}-${record?.revision ?? 0}`}
              shared={shared}
              state={state}
              kind={kind}
              record={record}
              onSaved={(id) => setSelected(id)}
            />
          )}
          {record &&
            (transitions[kind][record.status]?.length ?? 0) > 0 &&
            canEdit && (
              <TransitionForm
                key={`${record.id}-${record.revision}`}
                kind={kind}
                record={record}
                shared={shared}
              />
            )}
          {record &&
            kind === "contract" &&
            ["signed", "unconditional", "completed"].includes(record.status) &&
            shared.data.permissions["settlement.edit"] &&
            shared.data.permissions["prices.edit"] && (
              <form
                className="mt-6 space-y-4 border-t pt-5"
                key={`receipt-${record.id}-${record.revision}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void shared.run("lifecycle.receipt", {
                    ...formRecord(e.currentTarget),
                    id: record.id,
                    revision: record.revision,
                  });
                }}
              >
                <h3>Record confirmed receipt</h3>
                <p className="portal-helper">
                  Enter the cumulative amount actually received for this
                  category, not a promised payment. This records evidence only;
                  it does not execute payment or mark a settlement complete.
                </p>
                <Select
                  name="kind"
                  label="Receipt category"
                  options={options(["deposit", "settlement"])}
                />
                <Field
                  name="amount"
                  label="Total confirmed received · AUD"
                  type="number"
                  required
                />
                <Field
                  name="receivedAt"
                  label="Actual receipt date · Sydney"
                  type="datetime-local"
                  required
                />
                <Field
                  name="receiptReference"
                  label="Private receipt evidence reference"
                  required
                />
                <Check
                  name="confirm"
                  label="I confirm this money was actually received and the reference is accurate"
                  required
                />
                <button className="portal-button" disabled={shared.pending}>
                  Record receipt
                </button>
              </form>
            )}
          {record && shared.data.permissions["audit.view"] && (
            <section className="mt-6">
              <h3>Transaction timeline</h3>
              <ol className="divide-y">
                {data.history
                  .filter((e) => e.details.lifecycleId === record.id)
                  .map((e) => (
                    <li key={e.id} className="py-3 text-sm">
                      <strong>{e.action}</strong>
                      <p>{displaySalesDate(e.createdAt)}</p>
                      <pre className="overflow-auto text-xs">
                        {JSON.stringify(e.details, null, 2)}
                      </pre>
                    </li>
                  ))}
              </ol>
            </section>
          )}
        </section>
      )}
    </>
  );
}
// All references point to existing canonical UUIDs; document references are private text,
// never public uploads or legal documents generated by this application.
type EditorRecord =
  | NonNullable<LifecycleState["data"]>["offers"][number]
  | NonNullable<LifecycleState["data"]>["reservations"][number]
  | NonNullable<LifecycleState["data"]>["contracts"][number];
function TransactionEditor({
  shared,
  state,
  kind,
  record: existing,
  onSaved,
}: {
  shared: Shared;
  state: LifecycleState;
  kind: TransactionKind;
  record?: EditorRecord;
  onSaved: (id: string) => void;
}) {
  const [unitId, setUnitId] = useState(existing?.unitId ?? ""),
    [leadId, setLeadId] = useState(existing?.leadId ?? "");
  const value = (key: string) =>
    existing
      ? ((existing as unknown as Record<string, unknown>)[key] as
          | string
          | Date
          | null)
      : undefined;
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const result = await shared.run("lifecycle.save", {
          ...formRecord(e.currentTarget),
          kind,
          ...(existing ? { id: existing.id, revision: existing.revision } : {}),
        });
        if (typeof result === "string") onSaved(result);
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-xs">
          Residence
          <select
            aria-label="Transaction residence"
            className="mt-2 block w-full border p-3"
            name="unitId"
            value={unitId}
            required
            onChange={(e) => setUnitId(e.target.value)}
            disabled={Boolean(existing)}
          >
            <option value="">Select residence</option>
            {shared.data.units.map((u) => (
              <option key={u.id} value={u.id}>
                Residence {u.number}
              </option>
            ))}
          </select>
        </label>
        {existing && <input type="hidden" name="unitId" value={unitId} />}
        <label className="text-xs">
          Buyer
          <select
            aria-label="Transaction buyer"
            className="mt-2 block w-full border p-3"
            name="leadId"
            value={leadId}
            required
            onChange={(e) => setLeadId(e.target.value)}
            disabled={Boolean(existing)}
          >
            <option value="">Select authorised CRM lead</option>
            {shared.data.leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
            {existing && !shared.data.leads.some((l) => l.id === leadId) && (
              <option value={leadId}>Existing linked buyer</option>
            )}
          </select>
        </label>
        {existing && <input type="hidden" name="leadId" value={leadId} />}
        <Select
          name="agentId"
          disabled={!shared.data.permissions["leads.assign"]}
          label="Assigned project agent / staff"
          value={existing?.agentId}
          options={[
            { value: "", label: "Unassigned" },
            ...(existing?.agentId &&
            !shared.data.assignees.some((a) => a.id === existing.agentId)
              ? [
                  {
                    value: existing.agentId,
                    label: "Existing project assignee",
                  },
                ]
              : []),
            ...shared.data.assignees.map((a) => ({
              value: a.id,
              label: a.name ?? a.id,
            })),
          ]}
        />
        {!shared.data.permissions["leads.assign"] && (
          <input type="hidden" name="agentId" value={existing?.agentId ?? ""} />
        )}
        {kind === "offer" && (
          <>
            <Field
              name="amount"
              label="Explicit offer amount · AUD"
              type="number"
              value={value("amount") as string}
              required
            />
            <Field
              name="offeredAt"
              label="Offer date · Sydney"
              type="datetime-local"
              instant={value("offeredAt")}
              value={date(value("offeredAt") as Date | string | null)}
            />
            <Field
              name="expiresAt"
              label="Offer expiry · Sydney (optional)"
              type="datetime-local"
              instant={value("expiresAt")}
              value={date(value("expiresAt") as Date | string | null)}
            />
          </>
        )}
        {kind === "reservation" && (
          <>
            <Field
              name="startsAt"
              label="Reservation start · Sydney"
              type="datetime-local"
              instant={value("startsAt")}
              value={date(value("startsAt") as Date | string | null)}
            />
            <Field
              name="expiresAt"
              label="Reservation expiry · Sydney (optional)"
              type="datetime-local"
              instant={value("expiresAt")}
              value={date(value("expiresAt") as Date | string | null)}
            />
          </>
        )}
        {kind === "contract" && (
          <>
            <Field
              name="contractDate"
              label="Contract date · Sydney"
              type="datetime-local"
              instant={value("contractDate")}
              value={date(value("contractDate") as Date | string | null)}
            />
            <Field
              name="expectedSettlementAt"
              label="Expected settlement · Sydney"
              type="datetime-local"
              instant={value("expectedSettlementAt")}
              value={date(
                value("expectedSettlementAt") as Date | string | null,
              )}
            />
            {shared.data.permissions["prices.edit"] && (
              <>
                <Field
                  name="contractPrice"
                  label="Explicit agreed contract price · AUD"
                  type="number"
                  value={value("contractPrice") as string}
                />
                <Field
                  name="depositAmount"
                  label="Agreed deposit target · AUD (optional)"
                  type="number"
                  value={value("depositAmount") as string}
                />
              </>
            )}
          </>
        )}
        {kind !== "offer" && (
          <Select
            name="offerId"
            label="Related offer (optional)"
            value={value("offerId") as string}
            options={[
              { value: "", label: "No linked offer" },
              ...(state.data?.offers
                .filter((o) => o.unitId === unitId && o.leadId === leadId)
                .map((o) => ({
                  value: o.id,
                  label: `${label(o.status)} · ${shared.data.permissions["deals.view"] ? money(o.amount) : o.id}`,
                })) ?? []),
            ]}
          />
        )}
        {kind === "contract" && (
          <Select
            name="reservationId"
            label="Related reservation (optional)"
            value={value("reservationId") as string}
            options={[
              { value: "", label: "No linked reservation" },
              ...(state.data?.reservations
                .filter((o) => o.unitId === unitId && o.leadId === leadId)
                .map((o) => ({
                  value: o.id,
                  label: `${label(o.status)} · ${displaySalesDate(o.startsAt)}`,
                })) ?? []),
            ]}
          />
        )}
      </div>
      {kind === "offer" && (
        <Area
          name="conditions"
          label="Offer conditions"
          value={value("conditions") as string}
        />
      )}
      {kind !== "reservation" &&
        (kind !== "contract" || shared.data.permissions["prices.view"]) && (
          <Field
            name="documentReference"
            label="Private document / file reference"
            value={value("documentReference") as string}
          />
        )}
      {(kind !== "contract" || shared.data.permissions["prices.view"]) && (
        <Area
          name="notes"
          label="Internal transaction notes"
          value={existing?.notes}
        />
      )}
      <p className="portal-helper">
        Saving creates or updates a draft only. No acceptance, reservation
        activation, legal signature, payment or inventory status is inferred.
      </p>
      <button className="portal-button" disabled={shared.pending}>
        Save {kind} draft
      </button>
    </form>
  );
}
function TransitionForm({
  kind,
  record,
  shared,
}: {
  kind: TransactionKind;
  record: EditorRecord;
  shared: Shared;
}) {
  const choices = transitions[kind][record.status] ?? [],
    [to, setTo] = useState(choices[0] ?? ""),
    [sync, setSync] = useState(false);
  const approved = shared.data.permissions["deals.approve"];
  const forbidden =
    (kind === "offer" &&
      (["accepted", "rejected"].includes(to) || record.status === "accepted") &&
      !approved) ||
    (kind === "reservation" && to === "active" && !approved) ||
    (kind === "contract" &&
      (to !== "cancelled" || record.status !== "draft") &&
      !approved);
  const maySync =
    shared.data.permissions["status.edit"] &&
    ((kind === "reservation" && to === "active") ||
      (kind === "contract" &&
        ["signed", "unconditional", "completed"].includes(to)));
  return (
    <form
      className="mt-6 space-y-4 border-t pt-5"
      onSubmit={(e) => {
        e.preventDefault();
        void shared.run("lifecycle.transition", {
          ...formRecord(e.currentTarget),
          kind,
          id: record.id,
          revision: record.revision,
          unitRevision: shared.data.units.find((u) => u.id === record.unitId)
            ?.revision,
        });
      }}
    >
      <h3>Record a reviewed transition</h3>
      <label className="block text-xs">
        Requested transaction status
        <select
          className="mt-2 block w-full border p-3"
          name="status"
          aria-label="Requested transaction status"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setSync(false);
          }}
        >
          {choices.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>
      </label>
      <Field name="reason" label="Transition reason" required />
      {kind === "contract" && to === "completed" && (
        <Field
          name="actualSettlementAt"
          label="Actual settlement · Sydney"
          type="datetime-local"
          required
        />
      )}
      {forbidden && (
        <p role="note" className={styles.warning}>
          Developer management approval is required for this transition.
        </p>
      )}
      {maySync && (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="syncInventory"
            checked={sync}
            onChange={(e) => setSync(e.target.checked)}
          />
          Also record the corresponding inventory status. Only existing
          permitted status transitions can be applied.
        </label>
      )}
      <Check
        name="confirm"
        label="I confirm the transaction facts and have authority to record this change"
        required
      />
      <p className="portal-helper">
        Without the separate inventory choice, only this transaction changes.
        Public listings always require independent approval and publication.
        Signed contracts require entered price, date and evidence; this
        application does not create a legal agreement.
      </p>
      <button
        className="portal-button"
        disabled={shared.pending || Boolean(forbidden)}
      >
        Confirm transaction transition
      </button>
    </form>
  );
}
export function BuyerPreferences({
  shared,
  leadId,
}: {
  shared: Shared;
  leadId: string;
}) {
  const state = shared.lifecycle;
  if (!state?.enabled || !state.data || !shared.data.permissions["deals.view"])
    return null;
  const profile = state.data.profiles.find((p) => p.leadId === leadId);
  return (
    <section className="mt-6 border-t pt-5">
      <h3>Buyer preferences and next action</h3>
      {shared.data.permissions["crm.edit"] && (
        <form
          className="mt-4 space-y-4"
          key={`${leadId}-${profile?.revision ?? 0}`}
          onSubmit={(e) => {
            e.preventDefault();
            void shared.run("lifecycle.profile", {
              ...formRecord(e.currentTarget),
              leadId,
              revision: profile?.revision ?? 0,
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              name="preferredBedrooms"
              label="Preferred bedrooms (if supplied)"
              type="number"
              step="1"
              value={profile?.preferredBedrooms}
            />
            <Field
              name="budgetMin"
              label="Buyer budget minimum · AUD"
              type="number"
              value={profile?.budgetMin}
            />
            <Field
              name="budgetMax"
              label="Buyer budget maximum · AUD"
              type="number"
              value={profile?.budgetMax}
            />
          </div>
          <Area
            name="nextAction"
            label="Next action"
            value={profile?.nextAction}
          />
          <button className="portal-button" disabled={shared.pending}>
            Save buyer preferences
          </button>
        </form>
      )}
      <h3 className="mt-5">Linked offers</h3>
      {state.data.offers
        .filter((o) => o.leadId === leadId)
        .map((o) => (
          <div key={o.id} className="mt-3 text-sm">
            Residence {shared.data.units.find((u) => u.id === o.unitId)?.number}{" "}
            · {label(o.status)} · {money(o.amount)}{" "}
            <button
              className="underline"
              onClick={() => shared.onOpenLifecycle?.("Deals", null, leadId)}
            >
              Open buyer deals
            </button>
          </div>
        ))}
    </section>
  );
}
export function LifecyclePolicy({ shared }: { shared: Shared }) {
  const state = shared.lifecycle;
  if (!state?.enabled || !state.data)
    return (
      <section className="portal-card">
        <h2>Transaction policies · inactive</h2>
        <p className="portal-helper">
          No automatic reservation duration, fee, expiry cancellation or offer
          acceptance is enabled. Transaction activation requires owner approval.
        </p>
      </section>
    );
  const settings = state.data.settings;
  return (
    <section className="portal-card">
      <h2>Draft transaction policy</h2>
      <p className="portal-helper">
        Proposals only. These settings do not apply defaults, charge fees,
        accept offers or cancel reservations. Automation remains disabled.
      </p>
      <form
        className="mt-5 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void shared.run("lifecycle.policy", formRecord(e.currentTarget));
        }}
      >
        <Field
          name="proposedDurationHours"
          label="Proposed reservation duration · hours"
          type="number"
          step="1"
          value={settings?.proposedDurationHours}
        />
        <Field
          name="proposedReservationFee"
          label="Proposed reservation fee · AUD"
          type="number"
          value={settings?.proposedReservationFee}
        />
        <Area
          name="notes"
          label="Owner policy review notes"
          value={settings?.notes}
        />
        <button className="portal-button" disabled={shared.pending}>
          Save policy proposal
        </button>
      </form>
    </section>
  );
}
