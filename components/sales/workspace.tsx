"use client";
import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { salesAction } from "@/lib/sales/actions";
import type { Data, Shared } from "./types";
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
}: {
  data: Data;
  projectId: string;
  projectName: string;
}) {
  const [tab, setTab] = useState("Overview");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const saving = useRef(false);
  const router = useRouter();
  const run = useCallback(async (operation: string, input: Record<string, unknown>) => {
    const reading = operation === "activity";
    if (!reading && saving.current) return undefined;
    if (!reading) { saving.current = true; setPending(true); setMessage(""); setFailed(false); }
    try {
      const result = await salesAction(projectId, operation, input);
      if (!result.ok) throw new Error(result.error);
      if (!reading) setMessage(
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
      if (!reading) { saving.current = false; setPending(false); }
    }
  }, [projectId, router]);
  const shared = { data, run, pending: pending || refreshing, projectId };
  const tabs = [
    "Overview",
    "Inventory",
    ...(data.permissions["inventory.edit"] ? ["Stages", "Import"] : []),
    ...(data.publications.length || data.permissions["inventory.edit"]
      ? ["Publishing"]
      : []),
    ...(data.permissions["crm.view"] ? ["CRM"] : []),
    ...(data.permissions["audit.view"] ? ["History"] : []),
    ...(data.permissions["settings.edit"] ? ["Settings"] : []),
  ];
  return (
    <main className="portal-page">
      <div className="portal-page-inner">
        <header className="portal-page-title">
          <Link className="portal-button mb-4" href={`/portal/projects/${projectId}`}>← Project workspace</Link>
          <p className="portal-kicker">Grand Harmony / {projectName}</p>
          <h1>Sales Management</h1>
          <p className="portal-helper">
            Inventory, customer relationships and controlled publication.
          </p>
          <p className="portal-helper">Dates use Sydney time (AEST / AEDT). Saving inventory or prices does not publish them.</p>
        </header>
        <nav aria-label="Sales workspace" className="mb-6 flex flex-wrap gap-2">
          {tabs.map((item) => (
            <button
              className="portal-button"
              aria-pressed={tab === item}
              key={item}
              onClick={() => { setTab(item); setMessage(""); }}
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
        {tab === "Stages" && <Stages {...shared} />}
        {tab === "Import" && <Import {...shared} />}
        {tab === "Publishing" && <Publishing {...shared} />}
        {tab === "CRM" && <Crm {...shared} />}
        {tab === "Settings" && <Settings {...shared} />}
        {tab === "History" && (
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
