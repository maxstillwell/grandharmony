"use client";
import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salesAction } from "@/lib/sales/actions";
import type { Data, ManagementPlan, Shared } from "./types";
import { date } from "./forms";
import { Overview } from "./overview";
import { Inventory } from "./inventory";
import { Stages } from "./stages";
import { Import } from "./inventory-import";
import { Publishing } from "./publishing";
import { Settings } from "./settings";
import { Crm } from "./crm";
export function SalesWorkspace({
  data,
  projectId,
  projectName,
  projects = [],
  reviewPlan,
}: {
  data: Data;
  projectId: string;
  projectName: string;
  projects?: Array<{ id: string; name: string }>;
  reviewPlan?: ManagementPlan;
}) {
  const [tab, setTab] = useState("Overview");
  const [selectedUnitId, onSelectUnit] = useState<string | null>(null);
  const [crmLeadId, setCrmLeadId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const saving = useRef(false);
  const router = useRouter();
  const run = useCallback(
    async (operation: string, input: Record<string, unknown>) => {
      const reading = operation === "activity" || operation === "unitActivity";
      if (!reading && saving.current) return undefined;
      if (!reading) {
        saving.current = true;
        setPending(true);
        setMessage("");
        setFailed(false);
      }
      try {
        const result = await salesAction(projectId, operation, input);
        if (!result.ok) throw new Error(result.error);
        if (!reading)
          setMessage(
            operation === "import" && !input.commit
              ? "Import validated. Nothing has been saved."
              : "Saved successfully.",
          );
        if (!reading) startRefresh(() => router.refresh());
        return result.data;
      } catch (error) {
        setFailed(true);
        setMessage(
          error instanceof Error ? error.message : "The operation failed.",
        );
        return undefined;
      } finally {
        if (!reading) {
          saving.current = false;
          setPending(false);
        }
      }
    },
    [projectId, router],
  );
  const shared = {
    data,
    run,
    pending: pending || refreshing,
    projectId,
    mapEnabled: Boolean(reviewPlan),
    reviewPlan,
    selectedUnitId,
    onSelectUnit,
    feedback: { message, failed },
    onOpenLead: (id: string) => {
      setCrmLeadId(id);
      setTab("Leads / CRM");
    },
  };
  const tabs = [
    "Overview",
    "Inventory",
    ...(!data.agent ? ["Explorer / Map"] : []),
    ...(data.permissions["inventory.edit"] ? ["Stages", "Import"] : []),
    ...(data.publications.length || data.permissions["inventory.edit"]
      ? ["Publishing"]
      : []),
    ...(data.permissions["crm.view"] ? ["Leads / CRM"] : []),
    ...(data.permissions["audit.view"] ? ["Activity / Audit"] : []),
    ...(data.permissions["settings.edit"] ? ["Settings"] : []),
  ];
  return (
    <main className="portal-page">
      <div className="portal-page-inner">
        <header className="portal-page-title">
          <p className="portal-kicker">Grand Harmony / Sales Management</p>
          <h1>Sales Management</h1>
          <label className="mt-5 block max-w-sm text-xs">
            Sales project
            <select
              aria-label="Sales project"
              className="mt-2 block w-full rounded border border-[#d7d4cc] bg-white p-3 text-sm"
              value={projectId}
              disabled={pending || refreshing}
              onChange={(e) =>
                router.push(
                  `/portal/sales?project=${encodeURIComponent(e.target.value)}`,
                )
              }
            >
              {(projects.length
                ? projects
                : [{ id: projectId, name: projectName }]
              ).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <p className="portal-helper">
            Inventory, customer relationships and controlled publication.
          </p>
          <p className="portal-helper">
            Dates use Sydney time (AEST / AEDT). Saving inventory or prices does
            not publish them.
          </p>
        </header>
        <nav aria-label="Sales workspace" className="mb-6 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              className="portal-button"
              aria-pressed={tab === item}
              key={item}
              onClick={() => {
                setTab(item);
                setMessage("");
              }}
              disabled={pending || refreshing}
            >
              {item}
            </button>
          ))}
        </nav>
        {message && (
          <p role={failed ? "alert" : "status"} className="portal-card mb-5">
            {message}
          </p>
        )}
        {!data.settings && !data.agent && (
          <section className="portal-card">
            <h2>Set up the sales workspace</h2>
            <p className="portal-helper">
              An authorised project administrator must configure a public
              project key and planned capacity in Settings. No property records
              are generated.
            </p>
          </section>
        )}
        {tab === "Overview" && <Overview {...shared} />}
        {tab === "Inventory" && <Inventory {...shared} />}
        {tab === "Explorer / Map" && <Inventory {...shared} mapOnly />}
        {tab === "Stages" && <Stages {...shared} />}
        {tab === "Import" && <Import {...shared} />}
        {tab === "Publishing" && <Publishing {...shared} />}
        {tab === "Leads / CRM" && (
          <Crm {...shared} key={crmLeadId ?? "crm"} initialLeadId={crmLeadId} />
        )}
        {tab === "Settings" && <Settings {...shared} />}
        {tab === "Activity / Audit" && (
          <section className="portal-card">
            <h2>Inventory and publication history</h2>
            {data.history.length ? (
              <ol className="divide-y">
                {data.history.map((event) => (
                  <li className="py-4 text-sm" key={event.id}>
                    <strong>{event.action}</strong>
                    <p>
                      {date(event.createdAt)} ·{" "}
                      {event.actorUserId ?? "Website enquiry"}
                    </p>
                    <pre className="overflow-auto text-xs">
                      {JSON.stringify(event.details, null, 2)}
                    </pre>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="portal-empty">No recorded changes.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
