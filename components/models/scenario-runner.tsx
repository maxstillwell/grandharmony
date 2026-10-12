"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { archiveScenario, createScenario, saveScenario, getRevisionHistory } from "@/lib/models/actions";
import type { ModelState } from "@/lib/models/types";
import { FocusToggle } from "@/components/portal/workspace";
import { HtmlCanvas, type CanvasHandle, type CanvasSnapshot } from "./html-canvas";

type Scenario = { id: string; name: string; notes: string | null; state: ModelState; revision: number; updatedAt: string; modelVersionId: string | null };
type Model = { id: string; name: string; description: string; version: string | null; versionId: string | null; projectName: string | null; category: string; adapterKey: string | null };
const empty = { assumptionLabel: "", referenceValue: "", reviewNote: "" };
const buttonClass = "border border-[#D7D4CC] bg-white px-3 py-2 text-xs disabled:opacity-40";
function unpack(state: ModelState): CanvasSnapshot {
  const { __results, ...inputs } = state;
  return { state: inputs, results: (__results ?? {}) as Record<string, number> };
}

export function ScenarioRunner({ model, initialScenarios, initialScenarioId }: { model: Model; initialScenarios: Scenario[]; initialScenarioId?: string }) {
  const selected = initialScenarios.find(s => s.id === initialScenarioId);
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [scenarioId, setScenarioId] = useState<string | null>(selected?.id ?? null);
  const [name, setName] = useState(selected?.name ?? "");
  const [notes, setNotes] = useState(selected?.notes ?? "");
  const [state, setState] = useState<ModelState>(selected?.state ?? empty);
  const [saved, setSaved] = useState({ state: selected?.state ?? empty, name: selected?.name ?? "", notes: selected?.notes ?? "" });
  const [results, setResults] = useState<Record<string, number>>({});
  const [sensitivity, setSensitivity] = useState<Array<Record<string, number>>>([]);
  const [orientation, setOrientation] = useState("landscape");
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(model.adapterKey !== "700-feasibility-v1");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof getRevisionHistory>> | null>(null);
  const [pending, startTransition] = useTransition();
  const canvas = useRef<CanvasHandle>(null);
  const html = model.adapterKey === "700-feasibility-v1";
  const current = scenarios.find(s => s.id === scenarioId);
  const dirty = JSON.stringify({ state, name, notes }) !== JSON.stringify(saved);
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
      if (html) await canvas.current?.setState(unpack(next.state));
      const restoredState = html ? unpack(next.state).state : next.state;
      setScenarioId(next.id); setName(next.name); setNotes(next.notes ?? ""); setState(restoredState); setSaved({ state: restoredState, name: next.name, notes: next.notes ?? "" }); setHistory(null); url(next.id); setMessage("Scenario restored and calculation results verified.");
      if (html) { const snapshot = await canvas.current?.getState(); if (snapshot) setResults(snapshot.results); }
    } catch (error) { setMessage(String(error)); }
  }
  async function reset() {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    try {
      const snapshot = html ? await canvas.current?.reset() : null;
      const nextState = snapshot?.state ?? empty;
      setScenarioId(null); setName(""); setNotes(""); setState(nextState); setSaved({ state: nextState, name: "", notes: "" }); setResults(snapshot?.results ?? {}); setHistory(null); url(null);
    } catch (error) { setMessage(String(error)); }
  }
  function persist(copy = false) {
    let nextName = name.trim();
    if (copy) nextName = window.prompt("Name for the new scenario", nextName + " — copy")?.trim() ?? "";
    if (!nextName) { setMessage("Enter a scenario name before saving."); return; }
    startTransition(async () => {
      try {
        const snapshot = html ? await canvas.current?.getState() : null;
        const nextState = snapshot?.state ?? state;
        const persistedState = snapshot ? { ...nextState, __results: snapshot.results } : nextState;
        const payload = { modelId: model.id, modelVersionId: model.versionId, name: nextName, notes, state: persistedState };
        const result = copy || !scenarioId ? await createScenario(payload) : await saveScenario({ ...payload, scenarioId, expectedRevision: current?.revision ?? 0 });
        const next = { id: result.id, name: nextName, notes, state: persistedState, revision: result.revision, updatedAt: result.updatedAt, modelVersionId: result.modelVersionId };
        setScenarios(items => [next, ...items.filter(s => s.id !== next.id)]); setScenarioId(next.id); setName(nextName); setState(nextState); setSaved({ state: nextState, name: nextName, notes }); setHistory(null); url(next.id); setMessage(copy ? "Saved as a new scenario. Original preserved." : "Scenario saved.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Save failed."); }
    });
  }
  function loadHistory() { if (!scenarioId) return; startTransition(async () => { try { setHistory(await getRevisionHistory(model.id, scenarioId)); } catch (error) { setMessage(String(error)); } }); }
  function archive() { if (!scenarioId || !window.confirm("Archive this scenario?")) return; startTransition(async () => { try { await archiveScenario(model.id, scenarioId); setScenarios(items => items.filter(s => s.id !== scenarioId)); setScenarioId(null); url(null); setMessage("Scenario archived. State remains on screen; Save As to keep a copy."); } catch (error) { setMessage(String(error)); } }); }
  async function print() { try { if (html) { const snapshot = await canvas.current?.getPrintData(); if (snapshot) { setResults(snapshot.results); setState(snapshot.state); setSensitivity(snapshot.sensitivity ?? []); } } setTimeout(() => window.print(), 100); } catch (error) { setMessage(String(error)); } }
  async function modelReady(snapshot: CanvasSnapshot) {
    try { if (selected) { await canvas.current?.setState(unpack(selected.state)); const restored = await canvas.current?.getState(); if (restored) { setState(restored.state); setSaved({ state: restored.state, name: selected.name, notes: selected.notes ?? "" }); setResults(restored.results); } } else { setState(snapshot.state); setSaved({ state: snapshot.state, name: "", notes: "" }); setResults(snapshot.results); } setReady(true); } catch (error) { setMessage("Restore failed: " + String(error)); }
  }
  return <main className="bg-[#F8F8F6] text-[#121316]">
    <header className="model-toolbar no-print sticky top-0 z-20 border-b border-[#E2E0D9] bg-white px-4 py-3"><div className="flex flex-wrap items-center gap-2"><Link href="/portal/models" className={buttonClass}>← Library</Link><span className="mr-auto text-xs font-medium">{model.name} / {name || "New Scenario"} {dirty && <span className="ml-2 text-amber-800">Unsaved Changes</span>}</span><FocusToggle /><button className={buttonClass} disabled={pending || !ready} onClick={reset}>New</button><button className={buttonClass} disabled={pending || !ready} onClick={() => persist()}>Save</button><button className={buttonClass} disabled={pending || !ready} onClick={() => persist(true)}>Save As / Duplicate</button><select aria-label="Open scenario" className={buttonClass} disabled={pending || !ready} value={scenarioId ?? ""} onChange={event => { const next = scenarios.find(s => s.id === event.target.value); if (next) void restore(next); }}><option value="">Open Scenario</option>{scenarios.map(s => <option key={s.id} value={s.id}>{s.name} · r{s.revision}</option>)}</select><button className={buttonClass} disabled={!scenarioId || pending} onClick={loadHistory}>Revision History</button><button className={buttonClass} disabled={!ready} onClick={print}>Print / Save as PDF</button></div><p role="status" className="mt-2 text-xs text-[#6E6A5F]">{message || (ready ? "Private scenario · " + (dirty ? "Unsaved changes" : "Saved state") : "Loading model adapter…")}</p></header>
    <section className="model-editing no-print flex flex-wrap items-end gap-4 border-b border-[#E2E0D9] p-4"><label className="text-xs">Scenario name<input value={name} maxLength={120} onChange={event => setName(event.target.value)} className="ml-2 border p-2" /></label><label className="text-xs">Notes<input value={notes} maxLength={2000} onChange={event => setNotes(event.target.value)} className="ml-2 border p-2" /></label><span className="text-xs">{model.projectName ?? "General tool"} · v{model.version} · {current ? "Revision " + current.revision : "New"}</span>{scenarioId && <button disabled={pending} onClick={archive} className={buttonClass}>Archive</button>}</section>
    {history && <section className="no-print border-b bg-white p-5"><h2 className="text-sm font-medium">Recent Revision History</h2><ul className="mt-3 space-y-2 text-xs">{history.map(row => <li key={row.id}>Revision {row.revision} · {new Date(row.createdAt).toLocaleString("en-AU")} · {row.notes || "No notes"}</li>)}</ul></section>}
    {current?.modelVersionId && current.modelVersionId !== model.versionId && <p className="no-print bg-amber-50 p-4 text-sm">Older model version: review compatibility and use Save As. The original scenario is preserved.</p>}
    <style>{`@media print { @page { size: A4 ${orientation}; margin: 12mm; } }`}</style><div className="no-print flex justify-end px-4 py-2"><label className="text-xs">Print layout <select aria-label="Print orientation" className="ml-2 border p-1" value={orientation} onChange={event => setOrientation(event.target.value)}><option value="landscape">A4 Landscape</option><option value="portrait">A4 Portrait</option></select></label></div><div className="model-editing overflow-x-auto">{html ? <HtmlCanvas ref={canvas} modelId={model.id} onReady={modelReady} onChange={snapshot => { setState(snapshot.state); setResults(snapshot.results); }} /> : <section className="m-5 border bg-white p-6"><h1 className="display text-3xl">{model.name}</h1><p className="mt-2 text-sm">{model.description}</p>{Object.entries(state).map(([key, value]) => <label key={key} className="mt-5 block text-xs">{key}<input className="ml-3 border p-2" value={String(value)} onChange={event => setState(current => ({ ...current, [key]: event.target.value }))} /></label>)}</section>}</div>
    <section className="model-print p-4"><h1 className="text-2xl">{model.name}</h1><p>{name || "Unsaved scenario"} · {model.projectName} · Version {model.version} · {new Date().toLocaleString("en-AU")}</p><p className="my-3">{notes}</p><h2 className="mt-4 text-lg">Inputs and complete cost rows (AUD)</h2>{Object.entries(state).map(([section, value]) => <div key={section} className="my-3 break-inside-avoid"><h3>{section}</h3><pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(value, null, 2)}</pre></div>)}<h2 className="mt-4 text-lg">Recalculated results (AUD)</h2><table className="w-full text-sm"><tbody>{Object.entries(results).map(([key, value]) => <tr key={key}><td className="border-b p-2">{key}</td><td className="border-b p-2">{value.toLocaleString("en-AU", { maximumFractionDigits: 8 })}</td></tr>)}</tbody></table><h2 className="mt-5 text-lg">Sales price sensitivity</h2><table className="w-full text-sm"><thead><tr>{["Price", "Revenue", "Pre-tax profit", "After-tax profit"].map(label => <th key={label} className="border-b p-2 text-left">{label}</th>)}</tr></thead><tbody>{sensitivity.map(row => <tr key={row.price}>{[row.price, row.revenue, row.profit, row.after].map((value, i) => <td className="border-b p-2" key={i}>{value.toLocaleString("en-AU", { maximumFractionDigits: 2 })}</td>)}</tr>)}</tbody></table><div className="mt-5 flex items-end gap-3" style={{ height: 160 }}>{sensitivity.map(row => <div key={row.price} className="flex flex-1 flex-col items-center justify-end text-xs"><span>{(row.profit / 1000000).toFixed(2)}M</span><div style={{ width: "70%", height: Math.max(3, Math.abs(row.profit) / Math.max(1, ...sensitivity.map(item => Math.abs(item.profit))) * 100), background: row.profit >= 0 ? "#4c8497" : "#b16a60", printColorAdjust: "exact" }} /><span>{(row.price / 1000000).toFixed(2)}M</span></div>)}</div><p className="mt-5 text-xs">Original model assumptions require professional review. Scenario values reflect the supplied model formulas.</p></section>
  </main>;
}
