"use client";
/* eslint-disable @next/next/no-img-element -- print reports retain user-managed reference URLs without proxying media. */

import Link from "next/link";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { archiveScenario, createScenario, saveScenario, getRevisionHistory } from "@/lib/models/actions";
import type { ModelState } from "@/lib/models/types";
import { FocusToggle } from "@/components/portal/workspace";
import type { CanvasHandle, CanvasSnapshot } from "./html-canvas";
import { FeasibilityCanvas } from "./feasibility-canvas";
import { SpecificationCanvas } from "./specification-canvas";
import { SpecificationSharePanel } from "./specification-share-panel";
import { ModelShell } from "./model-shell";

type Scenario = { id: string; name: string; notes: string | null; state: ModelState; revision: number; updatedAt: string; modelVersionId: string | null; projectId: string | null };
type Model = { id: string; name: string; description: string; version: string | null; versionId: string | null; projectId: string | null; projectName: string | null; category: string; adapterKey: string | null };
const empty = { assumptionLabel: "", referenceValue: "", reviewNote: "" };
const buttonClass = "portal-button";
const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const number = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 });
const inputGroups = [
  { section: "fields", title: "Development & sales assumptions", fields: [["units", "Total dwellings", "dwellings"], ["sold", "Dwellings sold", "dwellings"], ["price", "Average sale price (incl. GST)", "AUD"], ["land", "Historic land purchase", "AUD"], ["stamp", "Stamp duty", "AUD"], ["build", "Building contract (incl. GST)", "AUD"], ["marketing", "Sales & marketing", "%"], ["contingency", "Construction contingency", "%"], ["holdRent", "Retained home weekly rent", "AUD"], ["holdWeeks", "Annual letting weeks", "weeks"], ["holdOperating", "Retained home operating cost", "%"]] },
  { section: "gst", title: "GST assumptions", fields: [["landConsideration", "Margin Scheme land consideration", "AUD"], ["gstRate", "GST rate", "%"], ["margin", "Margin Scheme applied", "Yes / No"], ["marketingGst", "Marketing input tax credit", "Yes / No"]] },
  { section: "tax", title: "Company tax assumptions", fields: [["loss", "Carried-forward tax losses", "AUD"], ["lossUsable", "Tax losses usable", "Yes / No"], ["taxRate", "Company tax rate", "%"]] },
  { section: "finance", title: "Finance assumptions", fields: [["loan", "Loan principal at settlement", "AUD"], ["rate", "Annual interest rate", "%"], ["years", "Interest period", "years"], ["averageDraw", "Average drawdown", "%"]] },
] as const;
const resultLabels: Record<string, string> = { revenue: "Sales revenue", gstOut: "GST on sales", buildInput: "Construction input GST", marketingInput: "Marketing input GST", otherInput: "Other input GST", netGst: "Net GST payable", construction: "Construction cost", marketing: "Sales & marketing cost", otherGross: "Other costs (gross)", otherNet: "Other costs (net of GST credits)", interest: "Finance interest", netCost: "Total net cost", profit: "Pre-tax profit", usedLoss: "Tax losses applied", tax: "Company tax", after: "After-tax profit", cash: "Settlement cash", retained: "Retained dwellings", rental: "Annual retained-home rental" };
type PrintSnapshot = { state: ModelState; results: Record<string, number>; sensitivity: Array<Record<string, number>> };
function valueForPrint(value: unknown, unit: string) {
  if (unit === "Yes / No") return value ? "Yes" : "No";
  const numeric = Number(value) || 0;
  if (unit === "AUD") return money.format(numeric);
  return `${number.format(numeric)}${unit === "%" ? "%" : unit ? ` ${unit}` : ""}`;
}
function unpack(state: ModelState): CanvasSnapshot {
  const { __results, ...inputs } = state;
  return { state: inputs, results: (__results ?? {}) as Record<string, number> };
}

export function ScenarioRunner({ model, initialScenarios, initialScenarioId, defaults, projects, shareLinks, shareLinksAvailable }: { model: Model; initialScenarios: Scenario[]; initialScenarioId?: string; defaults?: ModelState; projects: Array<{ id: string; name: string }>; shareLinks?: Record<string, Array<{ id: string; status: "active" | "revoked"; expiresAt: string; createdAt: string }>>; shareLinksAvailable?: boolean }) {
  const selected = initialScenarios.find(s => s.id === initialScenarioId);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [scenarioId, setScenarioId] = useState<string | null>(selected?.id ?? null);
  const [name, setName] = useState(selected?.name ?? "");
  const [notes, setNotes] = useState(selected?.notes ?? "");
  const [projectId, setProjectId] = useState(selected?.projectId ?? model.projectId ?? "");
  const [state, setState] = useState<ModelState>(selected?.state ?? empty);
  const [saved, setSaved] = useState({ state: selected?.state ?? empty, name: selected?.name ?? "", notes: selected?.notes ?? "", projectId: selected?.projectId ?? model.projectId ?? "" });
  const [results, setResults] = useState<Record<string, number>>({});
  const [sensitivity, setSensitivity] = useState<Array<Record<string, number>>>([]);
  const [orientation, setOrientation] = useState("landscape");
  const [printedAt, setPrintedAt] = useState("");
  const [printSnapshot, setPrintSnapshot] = useState<PrintSnapshot | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState("workspace");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getRevisionHistory>> | null>(null);
  const [pending, startTransition] = useTransition();
  const canvas = useRef<CanvasHandle>(null);
  const canvasModel = ["700-feasibility-v1", "interactive-specification-v1"].includes(model.adapterKey ?? "");
  const feasibility = model.adapterKey === "700-feasibility-v1";
  const activeProjectName = model.projectName ?? projects.find(project => project.id === projectId)?.name ?? null;
  const current = scenarios.find(s => s.id === scenarioId);
  const dirty = JSON.stringify({ state, name, notes, projectId }) !== JSON.stringify(saved);
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;
  const actionRef = useRef(pending); actionRef.current = pending;
  useEffect(() => {
    function unload(event: BeforeUnloadEvent) { if (dirtyRef.current || actionRef.current) { event.preventDefault(); event.returnValue = ""; } }
    function click(event: MouseEvent) {
      const anchor = (event.target as Element).closest("a[href]");
      if (anchor && (dirtyRef.current || actionRef.current) && !window.confirm("Unsaved changes. Leave this model?")) { event.preventDefault(); event.stopPropagation(); }
    }
    function back() { if (dirtyRef.current && !window.confirm("Unsaved changes. Leave this model?")) window.history.forward(); }
    window.addEventListener("beforeunload", unload); document.addEventListener("click", click, true); window.addEventListener("popstate", back);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", click, true); window.removeEventListener("popstate", back); };
  }, []);
  function url(id: string | null) { window.history.replaceState(null, "", id ? "?scenario=" + id : window.location.pathname); }
  async function restore(next: Scenario) {
    if (dirty && !window.confirm("Discard unsaved changes and open this scenario?")) return;
    try {
      if (canvasModel) await canvas.current?.setState(feasibility ? unpack(next.state) : { state: next.state, results: {} });
      const restoredState = feasibility ? unpack(next.state).state : next.state;
      const restoredProjectId = next.projectId ?? model.projectId ?? "";
      setScenarioId(next.id); setName(next.name); setNotes(next.notes ?? ""); setProjectId(restoredProjectId); setState(restoredState); setSaved({ state: restoredState, name: next.name, notes: next.notes ?? "", projectId: restoredProjectId }); setHistory(null); url(next.id); setMessage(feasibility ? "Scenario restored and calculation results verified." : "Scenario restored.");
      setWorkspaceTab("workspace");
      if (canvasModel) { const snapshot = await canvas.current?.getState(); if (snapshot) setResults(snapshot.results); }
    } catch (error) { setMessage(String(error)); }
  }
  async function reset() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    try {
      const snapshot = canvasModel ? await canvas.current?.reset() : null;
      const nextState = snapshot?.state ?? empty;
      setScenarioId(null); setName(""); setNotes(""); setProjectId(model.projectId ?? ""); setState(nextState); setSaved({ state: nextState, name: "", notes: "", projectId: model.projectId ?? "" }); setResults(snapshot?.results ?? {}); setHistory(null); url(null);
    } catch (error) { setMessage(String(error)); }
  }
  function persist(copy = false) {
    let nextName = name.trim();
    if (copy) nextName = window.prompt("Name for the new scenario", nextName + " — copy")?.trim() ?? "";
    if (!nextName) { setMessage("Enter a scenario name before saving."); return; }
    startTransition(async () => {
      try {
        const snapshot = canvasModel ? await canvas.current?.getState() : null;
        const nextState = snapshot?.state ?? state;
        const persistedState = snapshot ? { ...nextState, __results: snapshot.results } : nextState;
        const payload = { modelId: model.id, modelVersionId: model.versionId, projectId: projectId || null, name: nextName, notes, state: persistedState };
        const result = copy || !scenarioId ? await createScenario(payload) : await saveScenario({ ...payload, scenarioId, expectedRevision: current?.revision ?? 0 });
        const next = { id: result.id, name: nextName, notes, state: persistedState, revision: result.revision, updatedAt: result.updatedAt, modelVersionId: result.modelVersionId, projectId: projectId || null };
        setScenarios(items => [next, ...items.filter(s => s.id !== next.id)]); setScenarioId(next.id); setName(nextName); setState(nextState); setSaved({ state: nextState, name: nextName, notes, projectId }); setHistory(null); url(next.id); setMessage(copy ? "Saved as a new scenario. Original preserved." : "Scenario saved.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed."); }
    });
  }
  function loadHistory() { if (!scenarioId) return; startTransition(async () => { try { setHistory(await getRevisionHistory(model.id, scenarioId)); setWorkspaceTab("history"); } catch (error) { setMessage(String(error)); } }); }
  function archive() { if (!scenarioId || !window.confirm("Archive this scenario?")) return; startTransition(async () => { try { await archiveScenario(model.id, scenarioId); setScenarios(items => items.filter(s => s.id !== scenarioId)); setScenarioId(null); url(null); setMessage("Scenario archived. State remains on screen; Save As to keep a copy."); } catch (error) { setMessage(String(error)); } }); }
  async function print() {
    try {
      const printed = canvasModel ? await canvas.current?.getPrintData() : null;
      const next = printed ?? { state, results, sensitivity };
      setResults(next.results); setState(next.state); setSensitivity(next.sensitivity ?? []);
      setPrintSnapshot({ state: next.state, results: next.results, sensitivity: next.sensitivity ?? [] });
      setPrintedAt(new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }));
      setTimeout(() => window.print(), 160);
    } catch (error) { setMessage(String(error)); }
  }
  async function modelReady(snapshot: CanvasSnapshot) {
    try { if (selected) { await canvas.current?.setState(feasibility ? unpack(selected.state) : { state: selected.state, results: {} }); const restored = await canvas.current?.getState(); if (restored) { setState(restored.state); setSaved({ state: restored.state, name: selected.name, notes: selected.notes ?? "", projectId: selected.projectId ?? model.projectId ?? "" }); setResults(restored.results); } } else { setState(snapshot.state); setSaved({ state: snapshot.state, name: "", notes: "", projectId: model.projectId ?? "" }); setResults(snapshot.results); } setReady(true); } catch (error) { setMessage("Restore failed: " + String(error)); }
  }
  return <ModelShell title={model.name} project={activeProjectName} version={model.version}><main className="model-runner-surface">
    <header className="model-toolbar no-print sticky top-0 z-20 border-b border-[#E2E0D9] bg-white px-4 py-3"><div className="flex flex-wrap items-center gap-2"><Link href="/portal/models" className={buttonClass}>← Library</Link><span className="mr-auto text-xs font-medium">{model.name} · v{model.version} / {name || "New Scenario"} {dirty && <span className="ml-2 text-amber-800">Unsaved Changes</span>}</span><FocusToggle /><button className={buttonClass} disabled={pending || !ready} onClick={reset}>New</button><button className={buttonClass} disabled={pending || !ready} onClick={() => persist()}>Save</button><button className={buttonClass} disabled={pending || !ready} onClick={() => persist(true)}>Save As / Duplicate</button><select aria-label="Open scenario" className={buttonClass} disabled={pending || !ready} value={scenarioId ?? ""} onChange={event => { const next = scenarios.find(s => s.id === event.target.value); if (next) void restore(next); }}><option value="">Open Scenario</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name} · r{s.revision}</option>)}</select><Link className={buttonClass} aria-disabled={scenarios.length < 2} tabIndex={scenarios.length < 2 ? -1 : undefined} href={scenarios.length >= 2 ? `/portal/models/${model.id}/compare` : `/portal/models/${model.id}`}>Compare scenarios</Link><button className={buttonClass} disabled={!scenarioId || pending} onClick={loadHistory}>Revision History</button><button className={buttonClass} disabled={!ready} onClick={print}>Print / Save as PDF</button></div><p role="status" className="mt-2 text-xs text-[#6E6A5F]">{message || (ready ? "Private scenario · " + (dirty ? "Unsaved changes" : "Saved state") : "Loading model adapter…")}</p></header>
    <section className="model-editing no-print flex flex-wrap items-end gap-4 border-b border-[#E2E0D9] p-4"><label className="text-xs">Scenario name<input value={name} maxLength={120} onChange={event => setName(event.target.value)} className="ml-2 border p-2" /></label>{!model.projectId && <label className="text-xs">For which project?<select value={projectId} onChange={event => setProjectId(event.target.value)} className="ml-2 border p-2"><option value="">General / not assigned</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}<label className="text-xs">Notes<input value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} className="ml-2 border p-2" /></label><span className="text-xs">{activeProjectName ?? "General tool"} · v{model.version} · {current ? "Revision " + current.revision : "New"}</span>{scenarioId && <button disabled={pending} onClick={archive} className={buttonClass}>Archive</button>}</section>
    {model.adapterKey === "interactive-specification-v1" && <div className="px-4 pt-4"><SpecificationSharePanel modelId={model.id} scenarioId={scenarioId} links={scenarioId ? shareLinks?.[scenarioId] ?? [] : []} available={shareLinksAvailable ?? false} /></div>}
    <div className="model-workspace-tabs no-print" role="tablist" aria-label="Workspace view"><button role="tab" aria-selected={workspaceTab === "workspace"} onClick={() => setWorkspaceTab("workspace")}>Model Workspace</button><button role="tab" aria-selected={workspaceTab === "scenarios"} onClick={() => setWorkspaceTab("scenarios")}>Scenario Library · {scenarios.length}</button><button role="tab" aria-selected={workspaceTab === "history"} disabled={!scenarioId} onClick={loadHistory}>Revision History</button></div>{workspaceTab === "scenarios" && <section className="portal-card no-print mx-5 mt-5"><p className="portal-kicker">Private saved scenarios</p><h2>Scenario Library</h2>{scenarios.map(item => <button key={item.id} onClick={() => restore(item)} className="flex w-full items-center justify-between border-b border-[#e7e4dc] py-4 text-left text-xs"><span>{item.name}</span><span>Revision {item.revision} · Open →</span></button>)}{!scenarios.length && <p className="portal-helper">Save your first scenario to begin this library.</p>}</section>}{workspaceTab === "history" && history && <section className="no-print border-b bg-white p-5"><h2 className="text-sm font-medium">Recent Revision History</h2><ul className="mt-3 space-y-2 text-xs">{history.map(row => <li key={row.id}>Revision {row.revision} · {new Date(row.createdAt).toLocaleString("en-AU")} · {row.notes || "No notes"}</li>)}</ul></section>}
    {current?.modelVersionId && current.modelVersionId !== model.versionId && <p className="no-print bg-amber-50 p-4 text-sm">Older model version: review compatibility and use Save As. The original scenario is preserved.</p>}
    <style>{`@media print { @page { size: A4 ${orientation}; margin: 12mm; } }`}</style><div className="no-print flex justify-end px-4 py-2"><label className="text-xs">Print layout <select aria-label="Print orientation" className="ml-2 border p-1" value={orientation} onChange={event => setOrientation(event.target.value)}><option value="landscape">A4 Landscape</option><option value="portrait">A4 Portrait</option></select></label></div><div className={`model-editing overflow-x-auto ${workspaceTab !== "workspace" ? "hidden" : ""}`}>{feasibility ? <FeasibilityCanvas ref={canvas} defaults={defaults ?? empty} onReady={modelReady} onChange={snapshot => { setState(snapshot.state); setResults(snapshot.results); }} /> : model.adapterKey === "interactive-specification-v1" ? <SpecificationCanvas ref={canvas} onReady={modelReady} onChange={snapshot => { setState(snapshot.state); setResults(snapshot.results); }} /> : null}</div>
    {feasibility ? <PrintReport model={{ ...model, projectName: activeProjectName }} name={name} notes={notes} printedAt={printedAt} snapshot={printSnapshot ?? { state, results, sensitivity }} /> : <SpecificationPrintReport model={model} projectName={activeProjectName} name={name} notes={notes} printedAt={printedAt} state={(printSnapshot?.state ?? state) as ModelState} />}
  </main></ModelShell>;
}

function PrintReport({ model, name, notes, printedAt, snapshot }: { model: Model; name: string; notes: string; printedAt: string; snapshot: PrintSnapshot }) {
  const reportState = snapshot.state as Record<string, Record<string, unknown> | Array<Record<string, unknown>>>;
  const reportResults = snapshot.results;
  const reportSensitivity = snapshot.sensitivity;
  const costRows = Array.isArray(reportState.costs) ? reportState.costs : [];
  const primaryMetrics = [["Sales revenue", reportResults.revenue], ["Pre-tax profit", reportResults.profit], ["After-tax profit", reportResults.after], ["Settlement cash", reportResults.cash]] as const;
  const maxProfit = Math.max(1, ...reportSensitivity.map(row => Math.abs(Number(row.profit) || 0)));
  return <section className="model-print print-report">
    <header className="print-report-cover"><div><p className="print-overline">Grand Harmony · Internal model report</p><h1>700 Project<br /><em>Development Feasibility</em></h1><p className="print-report-subtitle">A scenario-based management analysis prepared within the Grand Harmony Portal.</p></div><dl><div><dt>Scenario</dt><dd>{name || "Unsaved scenario"}</dd></div><div><dt>Project</dt><dd>{model.projectName || "General tool"}</dd></div><div><dt>Model version</dt><dd>{model.version || "—"}</dd></div><div><dt>Prepared</dt><dd>{printedAt || "—"}</dd></div></dl></header>
    {notes && <aside className="print-report-notes"><span>Scenario notes</span><p>{notes}</p></aside>}
    <section className="print-report-section print-results"><div className="print-section-heading"><p className="print-overline">Executive summary</p><h2>Key calculated outcomes</h2></div><div className="print-metric-grid">{primaryMetrics.map(([label, value]) => <article key={label}><p>{label}</p><strong>{money.format(Number(value) || 0)}</strong><span>Calculated AUD</span></article>)}</div><table className="print-table print-bridge"><tbody>{["netGst", "construction", "marketing", "otherNet", "interest", "netCost", "usedLoss", "tax", "retained", "rental"].map(key => <tr key={key}><th>{resultLabels[key]}</th><td>{key === "retained" ? number.format(reportResults[key] || 0) : money.format(reportResults[key] || 0)}</td></tr>)}</tbody></table></section>
    <section className="print-report-section print-assumptions"><div className="print-section-heading"><p className="print-overline">Inputs</p><h2>Scenario assumptions</h2></div><div className="print-input-groups">{inputGroups.map(group => { const values = reportState[group.section] as Record<string, unknown> | undefined; return <article key={group.section}><h3>{group.title}</h3><dl>{group.fields.map(([key, label, unit]) => <div key={key}><dt>{label}</dt><dd>{valueForPrint(values?.[key], unit)}</dd></div>)}</dl></article>; })}</div></section>
    <section className="print-report-section print-costs"><div className="print-section-heading"><p className="print-overline">Cost register</p><h2>Development costs</h2></div><table className="print-table"><thead><tr><th>Cost item</th><th>Category</th><th>GST basis</th><th>Input credit</th><th>Amount (AUD)</th></tr></thead><tbody>{costRows.map((row, index) => <tr key={`${String(row.name)}-${index}`}><td>{String(row.name || "Untitled cost")}</td><td>{String(row.group || "—")}</td><td>{row.mode === "gross" ? "Gross incl. GST" : row.mode === "net" ? "Net excl. GST" : "GST not applicable"}</td><td>{row.credit ? "Eligible" : "Not eligible"}</td><td>{money.format(Number(row.amount) || 0)}</td></tr>)}</tbody></table></section>
    <section className="print-report-section print-sensitivity"><div className="print-section-heading"><p className="print-overline">Sensitivity</p><h2>Sales price range</h2></div><div className="print-sensitivity-chart">{reportSensitivity.map(row => <div key={row.price}><strong>{(Number(row.profit || 0) / 1000000).toFixed(1)}M</strong><i style={{ height: `${Math.max(5, Math.abs(Number(row.profit) || 0) / maxProfit * 106)}px`, background: Number(row.profit) >= 0 ? "#83806d" : "#a87970" }} /><span>{(Number(row.price || 0) / 1000000).toFixed(2)}M</span></div>)}</div><table className="print-table"><thead><tr><th>Unit price</th><th>Sales revenue</th><th>Pre-tax profit</th><th>After-tax profit</th></tr></thead><tbody>{reportSensitivity.map(row => <tr key={row.price}><td>{money.format(Number(row.price) || 0)}</td><td>{money.format(Number(row.revenue) || 0)}</td><td>{money.format(Number(row.profit) || 0)}</td><td>{money.format(Number(row.after) || 0)}</td></tr>)}</tbody></table></section>
    <footer className="print-report-footer"><span>Grand Harmony · Thoughtful Investment. Enduring Value.</span><span>Internal decision-support model · Subject to professional review</span></footer>
  </section>;
}

function SpecificationPrintReport({ model, projectName, name, notes, printedAt, state }: { model: Model; projectName: string | null; name: string; notes: string; printedAt: string; state: ModelState }) {
  const sections = Array.isArray(state.sections) ? state.sections as Array<{ id: string; title: string; items: Array<{ id: string; item: string; spec: string; status: string; images: Array<{ id?: string; url: string; label: string }> }> }> : [];
  return <section className="model-print specification-print-report">
    <header className="print-report-cover"><div><p className="print-overline">Grand Harmony · Internal specification report</p><h1>{model.name}</h1><p className="print-report-subtitle">A controlled schedule of finishes and inclusions prepared within the Grand Harmony Portal.</p></div><dl><div><dt>Scenario</dt><dd>{name || "Unsaved scenario"}</dd></div><div><dt>For project</dt><dd>{projectName || "General tool"}</dd></div><div><dt>Model version</dt><dd>{model.version || "—"}</dd></div><div><dt>Prepared</dt><dd>{printedAt || "—"}</dd></div></dl></header>
    {notes && <aside className="print-report-notes"><span>Scenario notes</span><p>{notes}</p></aside>}
    <section className="print-report-section"><div className="print-section-heading"><p className="print-overline">Schedule</p><h2>Finishes & inclusions</h2></div>{sections.map((section, index) => <article className="specification-print-section" key={section.id}><h3>{String(index + 1).padStart(2, "0")} · {section.title}</h3><table className="print-table"><thead><tr><th>Item</th><th>Description</th><th>Status</th></tr></thead><tbody>{section.items.map(item => <Fragment key={item.id}><tr className={`spec-row-${item.status}`}><td>{item.item}</td><td>{item.spec}</td><td>{item.status === "确定" ? "Confirmed / 确定" : item.status === "待定" ? "To confirm / 待定" : "Optional / 可选"}</td></tr>{item.images.length > 0 && <tr className="specification-print-media-row"><td colSpan={3}><div>{item.images.map((image, imageIndex) => <figure className="specification-print-image" key={`${item.id}-${image.id ?? imageIndex}`}><img src={image.url} alt={image.label || "Reference"} /><figcaption><strong>{item.item}</strong><span>{image.label}</span></figcaption></figure>)}</div></td></tr>}</Fragment>)}</tbody></table></article>)}</section>
    <footer className="print-report-footer"><span>Grand Harmony · Thoughtful Investment. Enduring Value.</span><span>Reference images are illustrative only; specifications remain subject to final approval.</span></footer>
  </section>;
}
