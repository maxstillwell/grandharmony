"use client";
import { useState } from "react";
import type { Shared } from "./types";
export function Import({ projectId, run, pending }: Shared) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState("");
  const [validated, setValidated] = useState("");
  return (
    <section className="portal-card">
      <h2>Approved inventory import</h2>
      <p className="portal-helper">
        Add-only CSV import; existing records are never overwritten. A
        source-document reference is required for every row. Private prices,
        sales statuses and publication flags cannot be imported.
      </p>
      <a
        className="portal-button my-5"
        href={`/api/portal/projects/${projectId}/sales/export?kind=template`}
      >
        Download blank CSV template
      </a>
      <label className="mb-5 block text-sm">
        Choose approved CSV
        <input
          className="block"
          type="file"
          accept=".csv,text/csv"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file && file.size <= 250000) {
              setCsv(await file.text());
              setValidated("");
              setPreview("");
            }
          }}
        />
      </label>
      <label className="block text-sm">
        CSV contents
        <textarea
          rows={10}
          className="mt-3 w-full border p-3 font-mono text-xs"
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value);
            setValidated("");
            setPreview("");
          }}
        />
      </label>
      <div className="my-5 flex gap-4">
        <button
          className="portal-button"
          disabled={pending || !csv}
          onClick={async () => {
            const result = await run("import", { csv });
            if (result) {
              setPreview(JSON.stringify(result, null, 2));
              setValidated(csv);
            }
          }}
        >
          Validate without saving
        </button>
        <button
          className="portal-button"
          disabled={pending || !validated || validated !== csv}
          onClick={async () => {
            const result = await run("import", { csv, commit: true });
            if (result) {
              setValidated("");
              setPreview("Import committed atomically.");
            }
          }}
        >
          Import validated rows
        </button>
      </div>
      <pre className="max-h-96 overflow-auto text-xs">{preview}</pre>
    </section>
  );
}
