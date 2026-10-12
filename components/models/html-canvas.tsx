"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ModelState } from "@/lib/models/types";
import { validateModelState } from "@/lib/models/validation";

export type CanvasSnapshot = { state: ModelState; results: Record<string, number>; sensitivity?: Array<Record<string, number>> };
export type CanvasHandle = { getState(): Promise<CanvasSnapshot>; setState(state: CanvasSnapshot): Promise<void>; validateState(state: CanvasSnapshot): Promise<boolean>; reset(): Promise<CanvasSnapshot>; getPrintData(): Promise<CanvasSnapshot> };

export const HtmlCanvas = forwardRef<CanvasHandle, { modelId: string; onChange(snapshot: CanvasSnapshot): void; onReady(snapshot: CanvasSnapshot): void }>(({ modelId, onChange, onReady }, ref) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(1900);
  const [origin, setOrigin] = useState("");
  const [instanceId, setInstanceId] = useState("");
  const [modelDocument, setModelDocument] = useState("");
  const [loadError, setLoadError] = useState("");
  const pending = useRef(new Map<string, { resolve(value: CanvasSnapshot): void; reject(reason: Error): void; timer: ReturnType<typeof setTimeout> }>());
  const handlers = useRef({ onChange, onReady }); handlers.current = { onChange, onReady };
  useEffect(() => { setOrigin(window.location.origin); setInstanceId(crypto.randomUUID()); }, []);
  useEffect(() => {
    if (!instanceId || !origin) return;
    const controller = new AbortController();
    fetch(`/api/models/${modelId}/document?instance=${instanceId}`, { signal: controller.signal, cache: "no-store", credentials: "same-origin" }).then(async response => {
      if (!response.ok || response.redirected) throw new Error("Model access denied or session expired.");
      setModelDocument(await response.text());
    }).catch(error => { if (!controller.signal.aborted) setLoadError(String(error)); });
    return () => controller.abort();
  }, [instanceId, modelId, origin]);
  useEffect(() => {
    function message(event: MessageEvent) {
      const msg = event.data;
      // sandbox without allow-same-origin deliberately uses the opaque 'null' origin.
      if (event.origin !== "null" || event.source !== frame.current?.contentWindow || !msg || msg.modelId !== modelId || msg.instanceId !== instanceId || msg.schemaVersion !== 1 || !["READY", "CHANGED", "RESIZE", "RESPONSE", "ERROR"].includes(msg.type)) return;
      if (msg.type === "RESIZE") { if (Number.isFinite(msg.payload)) setHeight(Math.min(30000, Math.max(600, msg.payload))); return; }
      if (msg.type === "RESPONSE" || msg.type === "ERROR") { const request = pending.current.get(msg.requestId); if (!request) return; clearTimeout(request.timer); pending.current.delete(msg.requestId); if (msg.type === "ERROR") request.reject(new Error(String(msg.payload))); else request.resolve(msg.payload); return; }
      try { validateModelState("700-feasibility-v1", msg.payload.state); if (msg.type === "READY") handlers.current.onReady(msg.payload); else handlers.current.onChange(msg.payload); } catch {}
    }
    window.addEventListener("message", message);
    const requests = pending.current;
    return () => { window.removeEventListener("message", message); for (const request of requests.values()) { clearTimeout(request.timer); request.reject(new Error("Model closed.")); } requests.clear(); };
  }, [modelId, instanceId]);
  function request(type: string, payload?: CanvasSnapshot): Promise<CanvasSnapshot> {
    return new Promise((resolve, reject) => {
      if (!frame.current?.contentWindow) { reject(new Error("Model is loading.")); return; }
      const requestId = crypto.randomUUID();
      const timer = setTimeout(() => { pending.current.delete(requestId); reject(new Error("Model adapter timed out.")); }, 10000);
      pending.current.set(requestId, { resolve, reject, timer });
      frame.current.contentWindow.postMessage({ modelId, instanceId, schemaVersion: 1, requestId, type, payload }, "*");
    });
  }
  useImperativeHandle(ref, () => ({ getState: () => request("GET_STATE"), setState: async (value) => { validateModelState("700-feasibility-v1", value.state); await request("SET_STATE", value); }, validateState: async (value) => { try { validateModelState("700-feasibility-v1", value.state); return Boolean(await request("VALIDATE_STATE", value)); } catch { return false; } }, reset: () => request("RESET"), getPrintData: () => request("GET_PRINT_DATA") }));
  if (loadError) return <p role="alert" className="p-5 text-sm text-red-800">{loadError}</p>;
  return <iframe ref={frame} title="700 Development Feasibility model" sandbox="allow-scripts allow-modals" referrerPolicy="no-referrer" srcDoc={modelDocument} style={{ height }} className="w-full min-w-0 border-0" />;
});
HtmlCanvas.displayName = "HtmlCanvas";
