"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SpecificationCanvas } from "@/components/models/specification-canvas";
import type { CanvasHandle, CanvasSnapshot } from "@/components/models/html-canvas";
import { saveSharedSpecificationScenario } from "@/lib/models/share-actions";
import type { ModelState } from "@/lib/models/types";

type SharedSpecification = {
  expiresAt: string;
  sourceScenario: { id: string; name: string; state: ModelState };
  model: { id: string; name: string };
  guestScenario: { id: string; name: string; state: ModelState; revision: number; contributorName: string; contributorEmail: string | null } | null;
};

export function SharedSpecificationRunner({ token, shared }: { token: string; shared: SharedSpecification }) {
  const canvas = useRef<CanvasHandle>(null);
  const loaded = useRef(false);
  const [scenarioName, setScenarioName] = useState(shared.guestScenario?.name ?? `${shared.sourceScenario.name} — review`);
  const [contributorName, setContributorName] = useState(shared.guestScenario?.contributorName ?? "");
  const [contributorEmail, setContributorEmail] = useState(shared.guestScenario?.contributorEmail ?? "");
  const [savedState, setSavedState] = useState<ModelState>(shared.guestScenario?.state ?? shared.sourceScenario.state);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = useRef(false);
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) { if (dirty.current || pending) { event.preventDefault(); event.returnValue = ""; } }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [pending]);
  async function onReady(_snapshot: CanvasSnapshot) {
    if (loaded.current) return;
    loaded.current = true;
    await canvas.current?.setState({ state: shared.guestScenario?.state ?? shared.sourceScenario.state, results: {} });
    setReady(true);
  }
  function save() {
    startTransition(async () => {
      try {
        const snapshot = await canvas.current?.getState();
        if (!snapshot) throw new Error("The specification is still loading.");
        const result = await saveSharedSpecificationScenario({ token, scenarioName, contributorName, contributorEmail, state: snapshot.state });
        setSavedState(snapshot.state);
        dirty.current = false;
        setMessage(result.created ? "Your separate scenario has been saved. You can continue editing this copy." : `Your scenario has been updated (revision ${result.revision}).`);
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save your scenario."); }
    });
  }
  function print() { window.print(); }
  return <main className="shared-specification"><header className="shared-specification-header"><div><p>Grand Harmony · controlled external collaboration</p><h1>{shared.model.name}</h1><span>Source scenario: {shared.sourceScenario.name}</span></div><div><span>Link expires {new Date(shared.expiresAt).toLocaleDateString("en-AU")}</span><button type="button" className="portal-button no-print" onClick={print}>Print / Save as PDF</button></div></header><section className="shared-specification-intro no-print"><div><p className="portal-kicker">Your independent working copy</p><h2>Edit, then save your own scenario</h2><p>Your changes are saved as a separate scenario for the Grand Harmony team to review. They do not overwrite the source scenario.</p></div><div className="shared-specification-form"><label>Your name<input value={contributorName} maxLength={120} onChange={(event) => { setContributorName(event.target.value); dirty.current = true; }} /></label><label>Email <small>optional</small><input type="email" value={contributorEmail} maxLength={320} onChange={(event) => { setContributorEmail(event.target.value); dirty.current = true; }} /></label><label>Scenario name<input value={scenarioName} maxLength={120} onChange={(event) => { setScenarioName(event.target.value); dirty.current = true; }} /></label><button type="button" className="portal-button shared-save" disabled={!ready || pending} onClick={save}>{pending ? "Saving…" : "Save my scenario"}</button></div>{message && <p role="status" className="shared-specification-message">{message}</p>}</section><section className="shared-specification-workspace"><SpecificationCanvas ref={canvas} onReady={onReady} onChange={(snapshot) => { if (JSON.stringify(snapshot.state) !== JSON.stringify(savedState)) dirty.current = true; }} /></section><footer>Grand Harmony · Reference images and specifications remain subject to final project approval.</footer></main>;
}
