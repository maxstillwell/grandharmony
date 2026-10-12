"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { archiveScenario, createScenario, saveScenario } from "@/lib/models/actions";
import type { ModelState, PrintData } from "@/lib/models/types";

type Scenario = { id: string; name: string; notes: string | null; state: ModelState; revision: number; updatedAt: string; modelVersionId: string | null };
type Model = { id: string; name: string; description: string; version: string | null; versionId: string | null; projectName: string | null; category: string };

const initialState = { assumptionLabel: "", referenceValue: "", reviewNote: "" };

function normalizeState(state: ModelState) {
  return {
    assumptionLabel: typeof state.assumptionLabel === "string" ? state.assumptionLabel : "",
    referenceValue: typeof state.referenceValue === "string" ? state.referenceValue : "",
    reviewNote: typeof state.reviewNote === "string" ? state.reviewNote : "",
  };
}

function printData(state: ReturnType<typeof normalizeState>): PrintData {
  return { orientation: "portrait", sections: [{ heading: "Saved model state", rows: [{ label: "Assumption label", value: state.assumptionLabel || "—" }, { label: "Reference value", value: state.referenceValue || "—" }, { label: "Review note", value: state.reviewNote || "—" }] }] };
}

export function ScenarioRunner({ model, initialScenarios }: { model: Model; initialScenarios: Scenario[] }) {
  const [scenarios, setScenarios] = useState(initialScenarios);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [notes, setNotes] = useState("");
  const [state, setState] = useState(initialState);
  const [savedState, setSavedState] = useState(initialState);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dirty = JSON.stringify(state) !== JSON.stringify(savedState);
  const currentScenario = scenarios.find((scenario) => scenario.id === scenarioId) ?? null;
  const data = useMemo(() => printData(state), [state]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function openScenario(id: string) {
    const next = scenarios.find((scenario) => scenario.id === id);
    if (!next) return;
    if (dirty && !window.confirm("You have unsaved changes. Open another scenario anyway?")) return;
    const nextState = normalizeState(next.state);
    setScenarioId(next.id); setScenarioName(next.name); setNotes(next.notes ?? ""); setState(nextState); setSavedState(nextState); setFeedback(`Opened ${next.name}.`);
  }

  function newScenario() {
    if (dirty && !window.confirm("You have unsaved changes. Start a new scenario anyway?")) return;
    setScenarioId(null); setScenarioName(""); setNotes(""); setState(initialState); setSavedState(initialState); setFeedback("New private scenario. Enter a name before saving.");
  }

  function updateField(field: keyof typeof initialState, value: string) { setState((current) => ({ ...current, [field]: value })); }

  function persist(asCopy = false) {
    if (!scenarioName.trim()) { setFeedback("Enter a Scenario Name before saving."); return; }
    const payload = { modelId: model.id, name: scenarioName, notes, state };
    startTransition(async () => {
      try {
        const saved = asCopy || !scenarioId ? await createScenario(payload) : await saveScenario({ ...payload, scenarioId });
        const next: Scenario = { id: saved.id, name: scenarioName.trim(), notes: notes.trim() || null, state, revision: saved.revision, updatedAt: saved.updatedAt, modelVersionId: saved.modelVersionId };
        setScenarios((current) => [next, ...current.filter((scenario) => scenario.id !== next.id)]);
        setScenarioId(next.id); setSavedState(state); setFeedback(asCopy ? "Saved as a new private scenario." : "Scenario saved.");
      } catch (error) { setFeedback(error instanceof Error ? error.message : "Scenario could not be saved."); }
    });
  }

  function archiveCurrent() {
    if (!scenarioId || !window.confirm("Archive this scenario? It will no longer appear in the active list.")) return;
    startTransition(async () => {
      try {
        await archiveScenario(model.id, scenarioId);
        setScenarios((current) => current.filter((scenario) => scenario.id !== scenarioId));
        newScenario(); setFeedback("Scenario archived.");
      } catch (error) { setFeedback(error instanceof Error ? error.message : "Scenario could not be archived."); }
    });
  }

  return <main className="min-h-screen bg-[#F8F8F6] text-[#121316]">
    <header className="no-print border-b border-[#E2E0D9] bg-white px-5 py-4 sm:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4"><Link href="/portal/models" className="mono text-[10px] tracking-[.12em] underline">← BACK TO LIBRARY</Link><div className="flex flex-wrap gap-2"><button onClick={newScenario} className="border border-[#121316] px-3 py-2 text-xs">New Scenario</button><label className="border border-[#E2E0D9] bg-white px-3 py-2 text-xs">Open <select aria-label="Open scenario" value={scenarioId ?? ""} onChange={(event) => event.target.value && openScenario(event.target.value)} className="ml-2 bg-transparent"><option value="">Choose saved scenario</option>{scenarios.map((scenario) => <option value={scenario.id} key={scenario.id}>{scenario.name} · r{scenario.revision}</option>)}</select></label><button onClick={() => persist(false)} disabled={isPending} className="bg-[#121316] px-3 py-2 text-xs text-white disabled:opacity-50">Save</button><button onClick={() => persist(true)} disabled={isPending} className="border border-[#121316] px-3 py-2 text-xs disabled:opacity-50">Save As</button><button onClick={() => window.print()} className="border border-[#121316] px-3 py-2 text-xs">Print / PDF</button></div></div></header>
    <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8"><section className="print-header border-b border-[#E2E0D9] pb-6"><p className="eyebrow">Model runner · {model.category.replaceAll("_", " ")}</p><h1 className="display mt-2 text-4xl">{model.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5C5E64]">{model.description}</p><div className="mono mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-[#6E6A5F]"><span>MODEL ID · {model.id}</span><span>VERSION · {model.version ?? "No version"}</span><span>PROJECT · {model.projectName ?? "General tool"}</span><span>PRINTED · {new Date().toLocaleDateString("en-AU")}</span></div></section>
      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_320px]"><section className="border border-[#E2E0D9] bg-white p-5 sm:p-7"><p className="eyebrow">Test adapter</p><h2 className="mt-2 text-xl font-medium">State save and restore test</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[#5C5E64]">This is a framework validation adapter only. It contains no financial formulas, project data or decision output. A real HTML model can later supply its own adapter while using the same scenario platform.</p><div className="mt-8 grid gap-5 sm:grid-cols-2"><label className="block text-xs font-medium">Assumption label<input value={state.assumptionLabel} onChange={(event) => updateField("assumptionLabel", event.target.value)} className="mt-2 w-full border border-[#D7D4CC] px-3 py-2 text-sm" placeholder="e.g. Base review" /></label><label className="block text-xs font-medium">Reference value<input value={state.referenceValue} onChange={(event) => updateField("referenceValue", event.target.value)} className="mt-2 w-full border border-[#D7D4CC] px-3 py-2 text-sm" placeholder="Non-financial reference" /></label></div><label className="mt-5 block text-xs font-medium">Review note<textarea value={state.reviewNote} onChange={(event) => updateField("reviewNote", event.target.value)} className="mt-2 min-h-36 w-full border border-[#D7D4CC] px-3 py-2 text-sm" placeholder="State restored through the test adapter…" /></label><div className="mt-8 border-t border-[#E2E0D9] pt-5"><p className="eyebrow">Print data preview</p>{data.sections.map((section) => <div className="mt-3" key={section.heading}><h3 className="text-sm font-medium">{section.heading}</h3><dl className="mt-2 grid gap-px border border-[#E2E0D9] bg-[#E2E0D9] sm:grid-cols-3">{section.rows.map((row) => <div className="bg-[#F8F8F6] p-3" key={row.label}><dt className="mono text-[10px] text-[#6E6A5F]">{row.label}</dt><dd className="mt-1 text-sm">{row.value}</dd></div>)}</dl></div>)}</div></section>
        <aside className="no-print h-fit border border-[#E2E0D9] bg-white p-5"><p className="eyebrow">Scenario</p><label className="mt-5 block text-xs font-medium">Scenario name<input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} className="mt-2 w-full border border-[#D7D4CC] px-3 py-2 text-sm" placeholder="Required on first save" /></label><label className="mt-4 block text-xs font-medium">Notes<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-24 w-full border border-[#D7D4CC] px-3 py-2 text-sm" placeholder="Private notes" /></label><div className="mt-5 border-t border-[#E2E0D9] pt-4 text-xs leading-5 text-[#5C5E64]"><p>{scenarioId ? `Revision ${currentScenario?.revision ?? "—"}` : "Unsaved private scenario"}</p><p>{dirty ? "Unsaved changes" : "All changes saved"}</p>{currentScenario?.modelVersionId && currentScenario.modelVersionId !== model.versionId ? <p className="mt-3 border border-[#9A6A27]/50 bg-[#F6D6A4]/30 p-2 text-[#6A4717]">This scenario was saved with a different model version. Review its state before saving again.</p> : null}</div>{feedback ? <p role="status" className="mt-5 border border-[#D7D4CC] bg-[#F8F8F6] p-3 text-xs leading-5">{feedback}</p> : null}{scenarioId ? <button onClick={archiveCurrent} disabled={isPending} className="mt-5 text-xs text-[#6A4717] underline disabled:opacity-50">Archive scenario</button> : null}</aside>
      </div></div></main>;
}
