"use client";
import { useMemo, useRef, useState } from "react";
import type { Shared } from "./types";
import { importColumns, parseImport } from "@/lib/sales/domain";
import styles from "./inventory.module.css";
export function Import({ projectId, data, run, pending }: Shared) {
  const [csv, setCsv] = useState("");
  const [validated, setValidated] = useState("");
  const [message, setMessage] = useState("");
  const [fileError, setFileError] = useState("");
  const generation = useRef(0);
  const preview = useMemo(() => {
    if (!csv) return { rows: [], error: "" };
    try {
      const rows = parseImport(csv);
      const existing = new Set(data.units.map((u) => u.number));
      const duplicates = rows.filter((u) => existing.has(u.number));
      if (duplicates.length)
        throw new Error(
          `Already recorded: ${duplicates.map((u) => u.number).join(", ")}. Import is add-only; edit existing records instead.`,
        );
      return { rows, error: "" };
    } catch (error) {
      return {
        rows: [],
        error: error instanceof Error ? error.message : "Invalid CSV.",
      };
    }
  }, [csv, data.units]);
  function change(value: string) {
    generation.current++;
    setCsv(value);
    setValidated("");
    setMessage("");
    setFileError("");
  }
  return (
    <section className="portal-card">
      <p className="portal-kicker">Inventory onboarding</p>
      <h2>Import approved inventory</h2>
      <p className="portal-helper">
        Add-only import. Existing records are never overwritten. All new records
        start unreleased and unpublished; prices, status and publication flags
        are deliberately excluded.
      </p>
      <a
        className="portal-button my-5"
        href={`/api/portal/projects/${projectId}/sales/export?kind=template`}
      >
        Download blank CSV template
      </a>
      <details className="mb-5 text-sm">
        <summary>Field mapping and accepted headers</summary>
        <p className="portal-helper">
          Use these exact column names in any order. Required: number and
          sourceDocument. Optional stage fields must contain the current project
          stage UUID, not a display name. Unknown columns are rejected.
        </p>
        <code className="mt-3 block break-words text-xs">
          {importColumns.join(", ")}
        </code>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            ["Construction", data.construction],
            ["Release", data.release],
          ].map(([name, stages]) => (
            <div key={String(name)}>
              <strong>{String(name)} stage IDs</strong>
              <ul>
                {(stages as typeof data.release).map((s) => (
                  <li key={s.id} className="break-all text-xs">
                    {s.name}: {s.id}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
      <label className="mb-5 block text-sm">
        Choose approved CSV
        <input
          className="mt-2 block max-w-full"
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            change("");
            if (!file) return;
            if (file.size > 250000) {
              setFileError(
                "CSV exceeds the 250 KB limit. No file has been loaded.",
              );
              return;
            }
            const version = generation.current;
            try {
              const source = await file.text();
              if (generation.current === version) change(source);
            } catch {
              if (generation.current === version)
                setFileError("The file could not be read.");
            }
          }}
        />
      </label>
      <label className="block text-sm">
        CSV contents
        <textarea
          aria-label="CSV contents"
          rows={8}
          className="mt-3 w-full rounded border p-3 font-mono text-xs"
          value={csv}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
        />
      </label>
      {(fileError || preview.error) && (
        <p className={styles.warning} role="alert">
          {fileError || preview.error}
        </p>
      )}
      {preview.rows.length > 0 && (
        <div className={styles.preview}>
          <p className="portal-helper">
            {preview.rows.length} structurally valid rows · server validation
            still required. Showing first 50 rows.
          </p>
          <table>
            <thead>
              <tr>
                <th>Unit</th>
                <th>Type</th>
                <th>Land m²</th>
                <th>Building m²</th>
                <th>Source reference</th>
                <th>Warnings</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 50).map((u) => (
                <tr key={u.number}>
                  <td>{u.number}</td>
                  <td>{u.housingType ?? "—"}</td>
                  <td>{u.landAreaSqm ?? "—"}</td>
                  <td>{u.buildingAreaSqm ?? "—"}</td>
                  <td>{u.sourceDocument}</td>
                  <td>{u.validationWarnings.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="my-5 flex flex-wrap gap-4">
        <button
          className="portal-button"
          disabled={
            pending || !preview.rows.length || !!preview.error || !!fileError
          }
          onClick={async () => {
            const version = generation.current;
            const result = await run("import", { csv });
            if (result && version === generation.current) {
              setValidated(csv);
              setMessage(
                "Server dry-run passed: project stages, duplicates and capacity checked. Nothing saved.",
              );
            }
          }}
        >
          Validate without saving
        </button>
        <button
          className="portal-button"
          disabled={
            pending ||
            !validated ||
            validated !== csv ||
            !!preview.error ||
            !!fileError
          }
          onClick={async () => {
            const result = await run("import", { csv, commit: true });
            if (result) {
              setValidated("");
              setMessage(
                "Import committed atomically. Records remain unpublished.",
              );
            }
          }}
        >
          Import validated rows
        </button>
      </div>
      {message && (
        <p role="status" className="portal-helper">
          {message}
        </p>
      )}
    </section>
  );
}
