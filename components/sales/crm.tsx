"use client";
import { useState } from "react";
import type { Shared } from "./types";
import { leadStatuses } from "@/lib/sales/domain";
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
export function Crm({ data, run, pending, projectId }: Shared) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [activity, setActivity] = useState("");
  const leads = data.leads.filter(
    (l) =>
      `${l.name} ${l.email} ${l.phone ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (!status || l.status === status),
  );
  const lead = data.leads.find((l) => l.id === selected);
  return (
    <>
      <section className="portal-card">
        <div className="flex flex-wrap justify-between gap-3">
          <h2>Developer-owned CRM</h2>
          {data.permissions["crm.export"] && (
            <a
              className="portal-button"
              href={`/api/portal/projects/${projectId}/sales/export?kind=leads`}
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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {["Name", "Contact", "Status", "Follow-up", ""].map((h, i) => (
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
                  <td>{label(l.status)}</td>
                  <td>{date(l.followUpAt) || "Not scheduled"}</td>
                  <td>
                    <button
                      className="portal-button"
                      onClick={async () => {
                        setSelected(l.id);
                        setActivity("");
                        const result = await run("activity", { id: l.id });
                        if (result)
                          setActivity(JSON.stringify(result, null, 2));
                      }}
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
                {date(lead.consentAt)} · Marketing:{" "}
                {lead.marketingConsent ? "Yes" : "No"} · Preferred contact:{" "}
                {lead.contactPreference}
              </p>
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
                  <Select
                    name="status"
                    label="Lead status"
                    value={lead.status}
                    options={options(leadStatuses)}
                  />
                  <Field
                    name="followUpAt"
                    label="Next follow-up"
                    value={date(lead.followUpAt)}
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
                      <Area
                        name="unitIds"
                        label="Interested unit IDs, one per line"
                        value={lead.unitIds.join("\n")}
                      />
                    </>
                  )}
                  <Area name="note" label="Interaction / follow-up note" />
                  <button className="portal-button" disabled={pending}>
                    Save activity
                  </button>
                </form>
              )}
              <h3>Activity history</h3>
              <button
                className="portal-button my-3"
                disabled={pending}
                onClick={async () =>
                  setActivity(
                    JSON.stringify(
                      await run("activity", { id: lead.id }),
                      null,
                      2,
                    ),
                  )
                }
              >
                Refresh activity
              </button>
              <pre className="max-h-96 overflow-auto text-xs">{activity}</pre>
            </>
          ) : selected === "new" ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const saved = await run("lead", formRecord(e.currentTarget));
                if (typeof saved === "string") { setSelected(saved); setActivity(""); }
              }}
            >
              <h2>Create consented enquiry</h2>
              <Field name="name" label="Customer name" required />
              <Field name="email" label="Email" type="email" required />
              <Field name="phone" label="Phone (optional)" />
              <Area name="message" label="Enquiry" required />
              <Area
                name="unitIds"
                label="Interested unit IDs, one per line (optional)"
              />
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
