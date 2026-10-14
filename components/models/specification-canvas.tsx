"use client";
/* eslint-disable @next/next/no-img-element -- user-managed external reference URLs are deliberately not proxied or uploaded. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImagePlus, Plus, Trash2 } from "lucide-react";
import type { CanvasHandle, CanvasSnapshot } from "./html-canvas";
import { specificationDefaults } from "@/lib/models/specification-defaults";
import { asSpecificationState, type SpecificationImage, type SpecificationItem, type SpecificationState } from "@/lib/models/specification-types";
import { validateModelState } from "@/lib/models/validation";
import type { ModelState } from "@/lib/models/types";

const statuses = ["确定", "待定", "可选"] as const;
const statusLabel = { 确定: "Confirmed", 待定: "To confirm", 可选: "Optional" };
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const snapshot = (state: SpecificationState): CanvasSnapshot => ({ state: state as unknown as ModelState, results: {} });

export const SpecificationCanvas = forwardRef<CanvasHandle, { onReady(value: CanvasSnapshot): void; onChange(value: CanvasSnapshot): void }>(({ onReady, onChange }, ref) => {
  const [state, setState] = useState<SpecificationState>(() => structuredClone(specificationDefaults));
  const stateRef = useRef(state);
  const callbacks = useRef({ onReady, onChange });
  callbacks.current = { onReady, onChange };

  useEffect(() => { callbacks.current.onReady(snapshot(stateRef.current)); }, []);
  function change(next: SpecificationState) { stateRef.current = next; setState(next); callbacks.current.onChange(snapshot(next)); }
  function updateItem(sectionIndex: number, itemIndex: number, patch: Partial<SpecificationItem>) {
    change({ ...state, sections: state.sections.map((section, index) => index !== sectionIndex ? section : { ...section, items: section.items.map((item, innerIndex) => innerIndex === itemIndex ? { ...item, ...patch } : item) }) });
  }
  function addItem(sectionIndex: number) {
    change({ ...state, sections: state.sections.map((section, index) => index !== sectionIndex ? section : { ...section, items: [...section.items, { id: makeId("item"), item: "New item", spec: "To be confirmed", status: "待定", images: [] }] }) });
  }
  function deleteItem(sectionIndex: number, itemIndex: number) {
    change({ ...state, sections: state.sections.map((section, index) => index !== sectionIndex ? section : { ...section, items: section.items.filter((_, innerIndex) => innerIndex !== itemIndex) }) });
  }
  function addImage(sectionIndex: number, itemIndex: number) {
    const url = window.prompt("Reference image HTTPS URL");
    if (!url) return;
    if (!/^https:\/\//i.test(url)) { window.alert("Please provide an HTTPS image URL."); return; }
    const label = window.prompt("Image label", "Reference image") ?? "Reference image";
    const source = window.prompt("Image source URL", url) ?? url;
    if (!/^https:\/\//i.test(source)) { window.alert("Please provide an HTTPS source URL."); return; }
    const current = state.sections[sectionIndex]?.items[itemIndex];
    if (!current) return;
    updateItem(sectionIndex, itemIndex, { images: [...current.images, { id: makeId("image"), url, label, source }] });
  }
  function updateImage(sectionIndex: number, itemIndex: number, imageIndex: number, patch: Partial<SpecificationImage>) {
    const current = state.sections[sectionIndex]?.items[itemIndex];
    if (!current) return;
    updateItem(sectionIndex, itemIndex, { images: current.images.map((image, index) => index === imageIndex ? { ...image, ...patch } : image) });
  }
  function removeImage(sectionIndex: number, itemIndex: number, imageIndex: number) {
    const current = state.sections[sectionIndex]?.items[itemIndex];
    if (!current) return;
    updateItem(sectionIndex, itemIndex, { images: current.images.filter((_, index) => index !== imageIndex) });
  }
  useImperativeHandle(ref, () => ({
    async getState() { return snapshot(stateRef.current); },
    async validateState(value) { try { validateModelState("interactive-specification-v1", value.state); return true; } catch { return false; } },
    async setState(value) { validateModelState("interactive-specification-v1", value.state); const next = asSpecificationState(value.state); stateRef.current = next; setState(next); },
    async reset() { const next = structuredClone(specificationDefaults); stateRef.current = next; setState(next); return snapshot(next); },
    async getPrintData() { return snapshot(stateRef.current); },
  }));
  return <div className="specification-canvas">
    <div className="specification-legend no-print"><span className="spec-status confirmed">Confirmed / 确定</span><span className="spec-status pending">To confirm / 待定</span><span className="spec-status optional">Optional / 可选</span><p>Reference images belong to an individual item and are included in the print report when present.</p></div>
    {state.sections.map((section, sectionIndex) => <section className="specification-section" key={section.id}>
      <header><div><p className="portal-kicker">{String(sectionIndex + 1).padStart(2, "0")}</p><input aria-label={`Section ${sectionIndex + 1} title`} value={section.title} onChange={event => change({ ...state, sections: state.sections.map((row, index) => index === sectionIndex ? { ...row, title: event.target.value } : row) })} /></div><button type="button" className="portal-button no-print" onClick={() => addItem(sectionIndex)}><Plus size={14} /> Add item</button></header>
      <div className="specification-table-wrap"><table className="specification-table"><thead><tr><th>Item</th><th>Standard specification</th><th>Status</th><th className="no-print"><span className="sr-only">Actions</span></th></tr></thead><tbody>{section.items.map((item, itemIndex) => <tr key={item.id} className={`spec-row-${item.status}`}><td><input aria-label={`${section.title} item`} value={item.item} onChange={event => updateItem(sectionIndex, itemIndex, { item: event.target.value })} /></td><td><textarea aria-label={`${item.item} specification`} value={item.spec} onChange={event => updateItem(sectionIndex, itemIndex, { spec: event.target.value })} rows={2} /></td><td><select aria-label={`${item.item} status`} value={item.status} onChange={event => updateItem(sectionIndex, itemIndex, { status: event.target.value as SpecificationItem["status"] })}>{statuses.map(status => <option key={status} value={status}>{status} · {statusLabel[status]}</option>)}</select><span className={`spec-status ${item.status === "确定" ? "confirmed" : item.status === "待定" ? "pending" : "optional"}`}>{statusLabel[item.status]}</span></td><td className="no-print"><button type="button" className="portal-icon-button" aria-label={`Delete ${item.item}`} onClick={() => deleteItem(sectionIndex, itemIndex)}><Trash2 size={14} /></button></td></tr>)}</tbody></table></div>
      <div className="specification-item-images no-print">{section.items.map((item, itemIndex) => <div key={item.id} className="specification-image-editor"><div><strong>{item.item || "Unnamed item"}</strong><button type="button" className="portal-button" onClick={() => addImage(sectionIndex, itemIndex)}><ImagePlus size={14} /> Add reference image</button></div>{item.images.map((image, imageIndex) => <article key={image.id ?? imageIndex}><img src={image.url} alt={image.label || "Reference"} /><div><label>Label<input value={image.label} onChange={event => updateImage(sectionIndex, itemIndex, imageIndex, { label: event.target.value })} /></label><label>Image URL<input value={image.url} onChange={event => updateImage(sectionIndex, itemIndex, imageIndex, { url: event.target.value })} /></label><label>Source URL<input value={image.source} onChange={event => updateImage(sectionIndex, itemIndex, imageIndex, { source: event.target.value })} /></label><button type="button" className="text-xs text-[#8f554d] underline" onClick={() => removeImage(sectionIndex, itemIndex, imageIndex)}>Remove image</button></div></article>)}</div>)}</div>
      <div className="specification-print-images">{section.items.flatMap(item => item.images.map((image, index) => <figure key={`${item.id}-${image.id ?? index}`}><img src={image.url} alt={image.label || "Reference"} /><figcaption><strong>{item.item}</strong><span>{image.label}</span></figcaption></figure>))}</div>
    </section>)}
  </div>;
});

SpecificationCanvas.displayName = "SpecificationCanvas";
