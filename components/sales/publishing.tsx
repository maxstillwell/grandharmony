"use client";
import { useState } from "react";
import type { Shared } from "./types";
export function Publishing({ data, run, pending }: Shared) {
  const [selected, setSelected] = useState<string | null>(null);
  const publication = data.publications.find((p) => p.id === selected);
  return (
    <section className="portal-card">
      <h2>Draft → preview → approve → publish</h2>
      <p className="portal-helper">
        Inventory edits never change the live publication. A draft is immutable
        and its approval is tied to the exact preview digest. Rollback creates a
        new draft that must be approved and published.
      </p>
      {data.permissions["inventory.edit"] && (
        <button
          className="portal-button my-5"
          disabled={pending || !data.settings}
          onClick={async () => { const id = await run("draft", {}); if (typeof id === "string") setSelected(id); }}
        >
          Create draft and preview
        </button>
      )}
      <ul className="divide-y">
        {data.publications.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-3 py-4"
          >
            <span>
              Revision {p.revision} · {p.status} · {p.snapshot.units.length}{" "}
              units
            </span>
            <div className="flex gap-3">
              <button
                className="portal-button"
                onClick={() => setSelected(p.id)}
                aria-pressed={selected === p.id}
              >
                Preview
              </button>
              {p.publishedAt && data.permissions["publication.publish"] && (
                <button
                  className="portal-button"
                  disabled={pending}
                  onClick={async () => { const id = await run("draft", { restoreId: p.id }); if (typeof id === "string") setSelected(id); }}
                >
                  Restore to new draft
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {publication && (
        <div className="mt-6">
          <h3>Exact public payload · revision {publication.revision}</h3>
          <pre className="my-5 max-h-[36rem] overflow-auto rounded border p-4 text-xs">
            {JSON.stringify(publication.snapshot, null, 2)}
          </pre>
          <p className="break-all text-xs">SHA-256: {publication.digest}</p>
          <p className="my-4 text-xs">
            Approved by {publication.approvedByUserId ?? "Nobody"} · Published
            by {publication.publishedByUserId ?? "Nobody"}
          </p>
          <div className="flex flex-wrap gap-3">
            {publication.status === "draft" &&
              data.permissions["publication.approve"] && (
                <button
                  className="portal-button"
                  disabled={pending}
                  onClick={() =>
                    run("approve", {
                      id: publication.id,
                      digest: publication.digest,
                    })
                  }
                >
                  Approve this exact payload and assets
                </button>
              )}
            {publication.status === "approved" &&
              data.permissions["publication.publish"] && (
                <button
                  className="portal-button"
                  disabled={pending}
                  onClick={() => run("publish", { id: publication.id })}
                >
                  Publish approved revision
                </button>
              )}
          </div>
        </div>
      )}
    </section>
  );
}
