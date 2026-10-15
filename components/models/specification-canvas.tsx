"use client";
/* eslint-disable @next/next/no-img-element -- user-managed external reference URLs are deliberately not proxied or uploaded. */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Expand, ImagePlus, Plus, Trash2, X } from "lucide-react";
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
  const [preview, setPreview] = useState<{ url: string; label: string; item: string } | null>(null);
  const stateRef = useRef(state);
  const callbacks = useRef({ onReady, onChange });
  callbacks.current = { onReady, onChange };

  useEffect(() => { callbacks.current.onReady(snapshot(stateRef.current)); }, []);
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) { if (event.key === "Escape") setPreview(null); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
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
      <div className="specification-table-wrap"><table className="specification-table"><thead><tr><th>Item</th><th>Standard specification</th><th>Status</th><th className="no-print"><span className="sr-only">Actions</span></th></tr></thead><tbody>{section.items.map((item, itemIndex) => <ItemRows key={item.id} item={item} sectionIndex={sectionIndex} itemIndex={itemIndex} updateItem={updateItem} addImage={addImage} updateImage={updateImage} removeImage={removeImage} deleteItem={deleteItem} onPreview={setPreview} />)}</tbody></table></div>
    </section>)}
    {preview && <div className="specification-lightbox no-print" role="dialog" aria-modal="true" aria-label={preview.label || "Reference image"} onMouseDown={() => setPreview(null)}><div onMouseDown={event => event.stopPropagation()}><button type="button" className="portal-icon-button" aria-label="Close image preview" onClick={() => setPreview(null)}><X size={18} /></button><img src={preview.url} alt={preview.label || "Reference"} /><p>{preview.item}</p><span>{preview.label}</span></div></div>}
  </div>;
});

SpecificationCanvas.displayName = "SpecificationCanvas";

function ItemRows({ item, sectionIndex, itemIndex, updateItem, addImage, updateImage, removeImage, deleteItem, onPreview }: { item: SpecificationItem; sectionIndex: number; itemIndex: number; updateItem(section: number, item: number, patch: Partial<SpecificationItem>): void; addImage(section: number, item: number): void; updateImage(section: number, item: number, image: number, patch: Partial<SpecificationImage>): void; removeImage(section: number, item: number, image: number): void; deleteItem(section: number, item: number): void; onPreview(value: { url: string; label: string; item: string }): void }) {
  return <><tr className={`spec-row-${item.status}`}><td><input aria-label={`Item ${itemIndex + 1}`} value={item.item} onChange={event => updateItem(sectionIndex, itemIndex, { item: event.target.value })} /></td><td><textarea aria-label={`${item.item} specification`} value={item.spec} onChange={event => updateItem(sectionIndex, itemIndex, { spec: event.target.value })} rows={2} /></td><td><select aria-label={`${item.item} status`} value={item.status} onChange={event => updateItem(sectionIndex, itemIndex, { status: event.target.value as SpecificationItem["status"] })}>{statuses.map(status => <option key={status} value={status}>{status} · {statusLabel[status]}</option>)}</select><span className={`spec-status ${item.status === "确定" ? "confirmed" : item.status === "待定" ? "pending" : "optional"}`}>{statusLabel[item.status]}</span></td><td className="no-print"><button type="button" className="portal-icon-button" aria-label={`Delete ${item.item}`} onClick={() => deleteItem(sectionIndex, itemIndex)}><Trash2 size={14} /></button></td></tr><tr className="specification-item-media-row"><td colSpan={4}><div className="specification-item-media no-print"><button type="button" className="portal-button" onClick={() => addImage(sectionIndex, itemIndex)}><ImagePlus size={14} /> Add reference image</button>{item.images.map((image, imageIndex) => <article key={image.id ?? imageIndex}><button type="button" className="specification-image-preview" onClick={() => onPreview({ url: image.url, label: image.label, item: item.item })} aria-label={`Enlarge ${image.label || "reference image"}`}><img src={image.url} alt={image.label || "Reference"} /><span><Expand size={13} /> Enlarge</span></button><div><label>Label<input value={image.label} onChange={event => updateImage(sectionIndex, itemIndex, imageIndex, { label: event.target.value })} /></label><label>Image URL<input value={image.url} onChange={event => updateImage(sectionIndex, itemIndex, imageIndex, { url: event.target.value })} /></label><label>Source URL<input value={image.source} onChange={event => updateImage(sectionIndex, itemIndex, imageIndex, { source: event.target.value })} /></label><button type="button" className="text-xs text-[#8f554d] underline" onClick={() => removeImage(sectionIndex, itemIndex, imageIndex)}>Remove image</button></div></article>)}</div></td></tr></>;
}
