"use client";

import { useEffect, useState, useTransition } from "react";
import { createSpecificationShareLink, revokeSpecificationShareLink } from "@/lib/models/share-actions";

type ShareLink = { id: string; status: "active" | "revoked"; expiresAt: string; createdAt: string };

export function SpecificationSharePanel({ modelId, scenarioId, links, available }: { modelId: string; scenarioId: string | null; links: ShareLink[]; available: boolean }) {
  const [items, setItems] = useState(links);
  const [days, setDays] = useState("30");
  const [message, setMessage] = useState("");
  const [newUrl, setNewUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => { setItems(links); setNewUrl(null); setMessage(""); }, [scenarioId, links]);
  if (!scenarioId) return null;
  const activeScenarioId = scenarioId;
  if (!available) return <p className="no-print text-xs text-[#8f554d]">External collaboration links will be available after the pending database migration.</p>;
  function create() {
    startTransition(async () => {
      try {
        const link = await createSpecificationShareLink({ modelId, scenarioId: activeScenarioId, expiresInDays: Number(days) });
        const url = `${window.location.origin}/share/${link.token}`;
        setNewUrl(url);
        setItems((current) => [{ id: link.id, status: "active", expiresAt: link.expiresAt, createdAt: new Date().toISOString() }, ...current]);
        setMessage("New external collaboration link created. Copy it now; the raw link is intentionally not shown again.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create the collaboration link."); }
    });
  }
  function copy() {
    if (!newUrl) return;
    void navigator.clipboard.writeText(newUrl).then(() => setMessage("Collaboration link copied.")).catch(() => setMessage("Copy the link manually from the field."));
  }
  function revoke(id: string) {
    startTransition(async () => {
      try {
        await revokeSpecificationShareLink({ modelId, scenarioId: activeScenarioId, shareLinkId: id });
        setItems((current) => current.map((item) => item.id === id ? { ...item, status: "revoked" } : item));
        setMessage("Collaboration link revoked. It can no longer be opened or saved.");
      } catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke the collaboration link."); }
    });
  }
  return <aside className="specification-share-panel no-print"><div><p className="portal-kicker">External collaboration</p><h2>Share this scenario</h2><p>Recipients can edit and save their own separate scenario without a Portal login. They cannot overwrite this source scenario.</p></div><div className="flex flex-wrap items-end gap-2"><label>Expires in<select value={days} disabled={pending} onChange={(event) => setDays(event.target.value)}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label><button type="button" className="portal-button" disabled={pending} onClick={create}>Create secure link</button></div>{newUrl && <div className="specification-share-url"><input aria-label="New collaboration link" value={newUrl} readOnly /><button type="button" className="portal-button" onClick={copy}>Copy</button></div>}<ul>{items.map((item) => <li key={item.id}><span>{item.status === "active" ? `Active until ${new Date(item.expiresAt).toLocaleDateString("en-AU")}` : "Revoked"}</span>{item.status === "active" && <button type="button" disabled={pending} onClick={() => revoke(item.id)}>Revoke</button>}</li>)}</ul>{message && <p role="status">{message}</p>}</aside>;
}
