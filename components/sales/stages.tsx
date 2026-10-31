"use client";
import { useState } from "react";
import type { Shared } from "./types";
import { Field, formRecord, label } from "./forms";
export function Stages({ data, run, pending }: Shared) {
  const [editing, setEditing] = useState<{
    kind: string;
    id?: string;
    code?: string;
    name?: string;
    sequence?: number;
  }>({ kind: "construction" });
  return (
    <>
      <section className="portal-card">
        <h2>Independent stage registers</h2>
        <p className="portal-helper">
          Construction and sales releases have separate assignments. Create the
          proposed two construction stages and four sales releases only when
          their names and allocations are confirmed.
        </p>
        {(
          [
            ["construction", data.construction],
            ["release", data.release],
          ] as const
        ).map(([kind, stages]) => (
          <div className="my-5" key={kind}>
            <h3>{label(kind)}</h3>
            {stages.map((stage) => (
              <div
                className="my-3 flex flex-wrap justify-between gap-3"
                key={stage.id}
              >
                <span>
                  {stage.code} · {stage.name} · Order {stage.sequence}
                </span>
                <button
                  className="portal-button"
                  onClick={() => setEditing({ kind, ...stage })}
                >
                  Edit
                </button>
              </div>
            ))}
            <button
              className="portal-button"
              onClick={() => setEditing({ kind })}
            >
              New {kind} stage
            </button>
          </div>
        ))}
      </section>
      <section className="portal-card">
        <form
          key={`${editing.kind}-${editing.id ?? "new"}`}
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const input = formRecord(e.currentTarget);
            const saved = await run("stage", {
              ...input,
              kind: editing.kind,
              ...(editing.id ? { id: editing.id } : {}),
            });
            if (typeof saved === "string") setEditing({ kind: editing.kind, id: saved,
              code: String(input.code), name: String(input.name), sequence: Number(input.sequence) });
          }}
        >
          <h2>
            {editing.id ? "Edit" : "Create"} {editing.kind} stage
          </h2>
          <Field name="code" label="Code" value={editing.code} required />
          <Field name="name" label="Name" value={editing.name} required />
          <Field
            name="sequence"
            label="Sort order"
            value={editing.sequence ?? 0}
            type="number"
            step="1"
          />
          <button className="portal-button" disabled={pending}>
            Save stage
          </button>
        </form>
      </section>
    </>
  );
}
