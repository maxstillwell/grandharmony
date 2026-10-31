"use client";
import { useEffect, useState } from "react";
import type { Data, Shared } from "./types";
import { leadStatuses } from "@/lib/sales/domain";
import { displaySalesDate } from "@/lib/sales/dates";
import { BuyerPreferences } from "./lifecycle";
import { UnitChoices } from "./unit-choices";
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
export function Crm({
  data,
  run,
  pending,
  projectId,
  initialLeadId = null,
  ...sharedExtra
}: Shared & { initialLeadId?: string | null }) {
  const [buyerCsv, setBuyerCsv] = useState("");
  const [importResult, setImportResult] = useState<{
    count: number;
    errors: string[];
    committed: boolean;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [followFilter, setFollowFilter] = useState("");
  const [sort, setSort] = useState("updated");
  const [selected, setSelected] = useState<string | null>(initialLeadId);
  const [activity, setActivity] = useState<Data["history"] | null>(null);
  const leads = data.leads.filter(
    (l) =>
      `${l.name} ${l.email} ${l.phone ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || l.status === status) &&
      (!followFilter ||
        (followFilter === "due"
          ? l.followUpAt &&
            new Date(l.followUpAt) <= new Date() &&
            !["converted", "lost", "archived"].includes(l.status)
          : followFilter === "scheduled"
            ? Boolean(l.followUpAt)
            : !l.followUpAt)),
  );
  leads.sort((a, b) =>
    sort === "name"
      ? a.name.localeCompare(b.name)
      : sort === "followup"
        ? (a.followUpAt ? new Date(a.followUpAt).getTime() : Infinity) -
            (b.followUpAt ? new Date(b.followUpAt).getTime() : Infinity) ||
          a.name.localeCompare(b.name)
        : (b.updatedAt ? new Date(b.updatedAt).getTime() : 0) -
          (a.updatedAt ? new Date(a.updatedAt).getTime() : 0),
  );
  const lead = data.leads.find((l) => l.id === selected);
  const leadId = lead?.id,
    leadRevision = lead?.revision;
  useEffect(() => {
    if (!leadId) {
      setActivity(null);
      return;
    }
    let current = true;
    setActivity(null);
    void run("activity", { id: leadId }).then((result) => {
      if (current) setActivity(Array.isArray(result) ? result : []);
    });
    return () => {
      current = false;
    };
  }, [leadId, leadRevision, run]);
  return (
    <>
      <section className="portal-card">
        <div className="flex flex-wrap justify-between gap-3">
          <h2>Developer-owned CRM</h2>
          {data.permissions["crm.export"] && (
            <a
              className="portal-button"
              href={`/api/portal/projects/${projectId}/sales/export?kind=leads${sharedExtra.demo ? "&mode=demo" : ""}`}
            >
              Export authorised CRM CSV
            </a>
          )}
        </div>
        <div className="my-5 flex flex-wrap gap-4">
          <label className="text-xs">
            Search
            <input
              className="ml-3 border p-3"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="text-xs">
            Status
            <select
              className="ml-3 border p-3"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All leads</option>
              {leadStatuses.map((s) => (
                <option key={s} value={s}>
                  {label(s)}
                </option>
              ))}
            </select>
          </label>
          {data.permissions["leads.assign"] && (
            <button
              className="portal-button"
              onClick={() => setSelected("new")}
            >
              Create consented lead
            </button>
          )}
        </div>
        <div className="mb-5 flex flex-wrap gap-4">
          <label className="text-xs">
            Follow-up filter
            <select
              aria-label="Follow-up filter"
              className="ml-2 border p-2"
              value={followFilter}
              onChange={(e) => setFollowFilter(e.target.value)}
            >
              <option value="">All follow-ups</option>
              <option value="due">Due / overdue</option>
              <option value="scheduled">Scheduled</option>
              <option value="missing">No follow-up scheduled</option>
            </select>
          </label>
          <label className="text-xs">
            Lead order
            <select
              aria-label="Lead order"
              className="ml-2 border p-2"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="updated">Recently updated</option>
              <option value="followup">Follow-up soonest</option>
              <option value="name">Buyer name</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  "Name",
                  "Contact",
                  "Source / assigned agent",
                  "Status",
                  "Follow-up",
                  "",
                ].map((h, i) => (
                  <th className="p-3" key={i}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr className="border-t" key={l.id}>
                  <td className="p-3">{l.name}</td>
                  <td>
                    {l.email}
                    <br />
                    {l.phone}
                  </td>
                  <td>
                    {l.source}
                    <small className="block text-xs">
                      {data.assignees.find((a) => a.id === l.assignedAgentId)
                        ?.name ??
                        (l.assignedAgentId ? "Assigned agent" : "Unassigned")}
                    </small>
                  </td>
                  <td>{label(l.status)}</td>
                  <td>
                    {displaySalesDate(l.followUpAt)}{" "}
                    <span className="text-xs">
                      {l.followUpAt ? "Sydney" : ""}
                    </span>
                  </td>
                  <td>
                    <button
                      className="portal-button"
                      onClick={() => setSelected(l.id)}
                    >
                      Open lead
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!leads.length && (
          <p className="portal-empty">No leads in your authorised scope.</p>
        )}
      </section>
      {data.permissions["leads.assign"] && sharedExtra.lifecycle?.enabled && (
        <details className="portal-card">
          <summary className="cursor-pointer">
            Import consented buyers · validate before saving
          </summary>
          <p className="portal-helper">
            Adds new buyers only; duplicate emails or phones must be resolved in
            CRM. Maximum 100 rows. Consent must be evidenced; do not infer it.
          </p>
          <p className="my-3 overflow-auto text-xs">
            name,email,phone,source,message,privacyVersion,consent,marketingConsent,contactPreference
          </p>
          <textarea
            aria-label="Buyer import CSV"
            className="my-3 w-full border p-3"
            rows={6}
            value={buyerCsv}
            onChange={(e) => {
              setBuyerCsv(e.target.value);
              setImportResult(null);
            }}
          />
          <button
            className="portal-button"
            disabled={pending || !buyerCsv}
            onClick={async () => {
              const r = await run("platform.crmImport", {
                csv: buyerCsv,
                commit: false,
              });
              if (r && typeof r === "object")
                setImportResult(r as typeof importResult);
            }}
          >
            Validate buyer CSV
          </button>
          {importResult && (
            <div role="status">
              <p>
                {importResult.count} rows · {importResult.errors.length} errors
                · {importResult.committed ? "Imported" : "Not saved"}
              </p>
              {importResult.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
              {!importResult.errors.length && !importResult.committed && (
                <button
                  className="portal-button"
                  disabled={pending}
                  onClick={async () => {
                    const r = await run("platform.crmImport", {
                      csv: buyerCsv,
                      commit: true,
                    });
                    if (r && typeof r === "object")
                      setImportResult(r as typeof importResult);
                  }}
                >
                  Confirm validated buyer import
                </button>
              )}
            </div>
          )}
        </details>
      )}
      {selected && (
        <section className="portal-card">
          <button
            className="portal-button mb-5"
            onClick={() => setSelected(null)}
          >
            Close lead
          </button>
          {lead ? (
            <>
              <h2>{lead.name}</h2>
              <p className="my-3 whitespace-pre-wrap text-sm">{lead.message}</p>
              <p className="text-xs">
                Source: {lead.source} · Privacy {lead.privacyVersion} accepted{" "}
                {displaySalesDate(lead.consentAt)} Sydney · Marketing:{" "}
                {lead.marketingConsent ? "Yes" : "No"} · Preferred contact:{" "}
                {lead.contactPreference}
              </p>
              <div className="my-4 flex flex-wrap gap-2">
                {lead.unitIds.map((id) => {
                  const unit = data.units.find((u) => u.id === id);
                  return unit && sharedExtra.onOpenUnit ? (
                    <button
                      className="portal-button"
                      key={id}
                      onClick={() => sharedExtra.onOpenUnit?.(id)}
                    >
                      Open Residence {unit.number}
                    </button>
                  ) : null;
                })}
              </div>
              <BuyerPreferences
                shared={{ data, run, pending, projectId, ...sharedExtra }}
                leadId={lead.id}
              />
              {data.permissions["crm.edit"] && (
                <form
                  key={`${lead.id}-${lead.revision}`}
                  className="my-5 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run("lead", {
                      ...formRecord(e.currentTarget),
                      id: lead.id,
                      revision: lead.revision,
                    });
                  }}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field
                      name="name"
                      label="Buyer name"
                      value={lead.name}
                      required
                    />
                    <Field
                      name="email"
                      label="Email"
                      type="email"
                      value={lead.email}
                      required
                    />
                    <Field name="phone" label="Phone" value={lead.phone} />
                    <Field
                      name="source"
                      label="Lead source"
                      value={lead.source}
                      required
                    />
                  </div>
                  <Select
                    name="interactionType"
                    label="Contact record type"
                    options={options([
                      "note",
                      "call",
                      "meeting",
                      "email_record",
                      "qualification",
                    ])}
                  />
                  <Select
                    name="status"
                    label="Lead status"
                    value={lead.status}
                    options={options(leadStatuses)}
                  />
                  <Field
                    name="followUpAt"
                    label="Next follow-up · Sydney time (AEST / AEDT)"
                    value={date(lead.followUpAt)}
                    instant={lead.followUpAt}
                    type="datetime-local"
                  />
                  {data.permissions["leads.assign"] && (
                    <>
                      <Select
                        name="assignedAgentId"
                        label="Assigned external agent"
                        value={lead.assignedAgentId}
                        options={[
                          { value: "", label: "Unassigned" },
                          ...data.assignees
                            .filter((m) => m.role === "external_agent")
                            .map((m) => ({
                              value: m.id,
                              label: m.name ?? m.id,
                            })),
                        ]}
                      />
                      <Select
                        name="assignedStaffId"
                        label="Assigned internal staff"
                        value={lead.assignedStaffId}
                        options={[
                          { value: "", label: "Unassigned" },
                          ...data.assignees
                            .filter((m) => m.role !== "external_agent")
                            .map((m) => ({
                              value: m.id,
                              label: m.name ?? m.id,
                            })),
                        ]}
                      />
                      <UnitChoices units={data.units} selected={lead.unitIds} />
                    </>
                  )}
                  <Area name="note" label="Interaction / follow-up note" />
                  <button className="portal-button" disabled={pending}>
                    Save activity
                  </button>
                </form>
              )}
              <h3>Activity history</h3>
              {activity === null ? (
                <p role="status">Loading activity…</p>
              ) : activity.length ? (
                <ol className="mt-4 max-h-96 divide-y overflow-auto">
                  {activity.map((event) => (
                    <li className="space-y-2 py-4 text-sm" key={event.id}>
                      <strong>
                        {label(
                          String(
                            event.details.interactionType ?? event.action,
                          ).replaceAll(".", " "),
                        )}
                      </strong>
                      <p className="text-xs">
                        {displaySalesDate(event.createdAt)} Sydney
                      </p>
                      {typeof event.details.from === "string" &&
                        typeof event.details.to === "string" && (
                          <p>
                            {label(event.details.from)} →{" "}
                            {label(event.details.to)}
                          </p>
                        )}
                      {typeof event.details.note === "string" && (
                        <p className="whitespace-pre-wrap">
                          {event.details.note}
                        </p>
                      )}
                      {typeof event.details.followUpAt === "string" && (
                        <p>
                          Follow-up:{" "}
                          {displaySalesDate(event.details.followUpAt)} Sydney
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="portal-empty">
                  No activity available for this lead.
                </p>
              )}
            </>
          ) : selected === "new" ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const saved = await run("lead", formRecord(e.currentTarget));
                if (typeof saved === "string") {
                  setSelected(saved);
                  setActivity(null);
                }
              }}
            >
              <h2>Create consented enquiry</h2>
              <Field name="name" label="Customer name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Phone (optional)" />
              <Field name="source" label="Lead source" value="portal" />
              <Area name="message" label="Enquiry" required />
              <UnitChoices units={data.units} />
              <Field
                name="privacyVersion"
                label="Privacy notice version acknowledged by customer"
                value={data.settings?.privacyVersion}
                required
              />
              <Select
                name="contactPreference"
                label="Contact preference"
                value="email"
                options={options(["email", "phone"])}
              />
              <Check
                name="consent"
                label="Customer acknowledged the privacy notice and agreed to enquiry handling"
                required
              />
              <Check
                name="marketingConsent"
                label="Customer separately opted into marketing"
              />
              <button className="portal-button" disabled={pending}>
                Store lead
              </button>
            </form>
          ) : null}
        </section>
      )}
    </>
  );
}
