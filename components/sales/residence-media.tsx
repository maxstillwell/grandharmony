/* eslint-disable @next/next/no-img-element -- authenticated SVG previews cannot use public image optimisation */
"use client";
import { useState } from "react";
import type { Shared } from "./types";
import type { ResidenceMediaData } from "@/lib/sales/media-service";
import { fixtureHashes, mediaKinds } from "@/lib/sales/media-domain";
import { Field, Area, Select, Check, formRecord, options } from "./forms";
function Preview({
  url,
  title,
  mime,
}: {
  url: string;
  title: string;
  mime: string;
}) {
  const [error, setError] = useState(false);
  return (
    <figure className="min-w-0 border p-3">
      <figcaption className="mb-3 text-xs">{title}</figcaption>
      {["application/pdf", "image/svg+xml"].includes(mime) ? (
        <iframe
          title={title}
          onLoad={(e) => {
            if (mime === "image/svg+xml") {
              try {
                const svg = e.currentTarget.contentDocument?.documentElement;
                if (svg?.tagName.toLowerCase() === "svg") {
                  svg.setAttribute("width", "100%");
                  svg.setAttribute("height", "100%");
                }
              } catch {
                /* Cross-origin preview remains sandboxed. */
              }
            }
          }}
          src={url}
          sandbox="allow-same-origin"
          className="h-80 w-full"
          loading="lazy"
        />
      ) : error ? (
        <p>Preview could not load in this session.</p>
      ) : (
        <img
          src={url}
          alt={title}
          className="max-h-96 w-full object-contain"
          loading="lazy"
          onError={() => setError(true)}
        />
      )}
      <a
        className="mt-3 block text-xs underline"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open registered source ↗
      </a>
    </figure>
  );
}
function SourceEvidence({
  value,
  sha256,
}: {
  value: string | null;
  sha256: string;
}) {
  let data: Record<string, unknown> | null = null;
  try {
    const parsed = JSON.parse(value ?? "null");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      data = parsed;
  } catch {
    /* Free-form reviewer evidence remains supported. */
  }
  return (
    <div className="my-4 text-sm">
      {data ? (
        <>
          <p>
            <strong>
              {data.testOnly
                ? "Controlled source-change test"
                : "Registered source evidence"}
            </strong>{" "}
            ·{" "}
            {data.requiresManualReview || data.status === "manual-review"
              ? "Manual review required"
              : "Source result requires reviewer interpretation"}{" "}
            · Not architectural approval.
          </p>
          <dl className="my-3 grid gap-2 md:grid-cols-2">
            {[
              "sourceVersion",
              "candidateVersion",
              "floorId",
              "status",
              "geometryChanged",
            ]
              .filter((k) => data![k] !== undefined)
              .map((k) => (
                <div key={k}>
                  <dt className="text-xs text-stone-500">
                    {
                      (
                        {
                          sourceVersion: "Original source",
                          candidateVersion: "Candidate source",
                          floorId: "Floor",
                          status: "Matching result",
                          geometryChanged: "Geometry changed",
                        } as Record<string, string>
                      )[k]
                    }
                  </dt>
                  <dd>{String(data![k])}</dd>
                </div>
              ))}
          </dl>
          {typeof data.note === "string" && <p>{data.note}</p>}
        </>
      ) : (
        <p>
          {value ??
            "No previous architectural source supplied; checksum identity alone is not architectural verification."}
        </p>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer">
          Source integrity / matching evidence
        </summary>
        <p className="break-all">SHA-256 {sha256}</p>
        {data && (
          <pre className="whitespace-pre-wrap break-all text-xs">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </details>
    </div>
  );
}
export function ResidenceMediaWorkspace({
  shared,
  media,
  initialNumber,
}: {
  shared: Shared;
  media: ResidenceMediaData;
  initialNumber?: string;
}) {
  const { data, run, pending, demo } = shared;
  const [packageJSON, setPackageJSON] = useState(""),
    [validation, setValidation] = useState<{
      count: number;
      digest: string;
      committed: boolean;
      changes: Array<{ floorId: string; slot: string; unchanged: boolean }>;
    } | null>(null);
  const [unitId, setUnitId] = useState(
      data.units.find((u) => Number(u.number) === Number(initialNumber))?.id ??
        data.units[0]?.id ??
        "",
    ),
    [selected, setSelected] = useState("");
  const versions = media.versions.filter((v) => v.unitId === unitId),
    version = versions.find((v) => v.id === selected) ?? versions[0],
    previous = media.versions.find((v) => v.id === version?.previousId),
    current = media.current.find(
      (c) =>
        c.unitId === version?.unitId &&
        c.floorId === version?.floorId &&
        c.slot === version?.slot,
    );
  return (
    <div className="min-w-0 max-w-full [overflow-wrap:anywhere]">
      <section className="portal-card">
        <h2>Residence media & revisions</h2>
        <p className="portal-helper">
          Canonical residences; independent versions per floor and media slot.
          Byte changes are not architectural verification. No upload storage is
          configured: register an existing authorised asset URL. Source IFC/DWG
          documents are not sales media.
        </p>
        <label className="my-4 block text-xs">
          Media residence
          <select
            className="mt-2 block w-full border p-3"
            aria-label="Media residence"
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              setSelected("");
            }}
          >
            {data.units.map((u) => (
              <option key={u.id} value={u.id}>
                Residence {u.number} · {u.housingType ?? "Type not supplied"}
              </option>
            ))}
          </select>
        </label>
        <p className="portal-helper">
          {demo
            ? "DEMO MEDIA — isolated test versions and simulated current pointers, excluded from every public response."
            : media.publicPublicationEnabled
              ? "Public promotion additionally requires the residence in the approved inventory snapshot."
              : "Public media release is disabled. Reviewed/approved versions stay internal until the sales presentation is ready."}
        </p>
        {demo && (
          <button
            className="portal-button"
            disabled={pending || Boolean(versions.length) || !unitId}
            onClick={() => void run("media.seedDemo", { unitId })}
          >
            Load abstract test revisions
          </button>
        )}
        {demo &&
          media.sourceSampleAvailable &&
          Number(data.units.find((u) => u.id === unitId)?.number) === 2 && (
            <button
              className="portal-button"
              disabled={pending || Boolean(versions.length)}
              onClick={() => void run("media.seedUnit02Demo", { unitId })}
            >
              Load genuine Unit 02 + isolated source-change test
            </button>
          )}
        <div className="my-5 overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm [overflow-wrap:normal]">
            <thead>
              <tr>
                {[
                  "Floor / slot",
                  "Version / source",
                  "Change",
                  "Review",
                  "Publication",
                  "",
                ].map((h) => (
                  <th className="p-3" key={h}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr className="border-t" key={v.id}>
                  <td className="p-3">
                    {v.floorLabel}
                    <small className="block">{v.slot}</small>
                  </td>
                  <td>
                    v{v.versionNumber} · {v.sourceRevision}
                    <small className="block">
                      {v.synthetic
                        ? "SYNTHETIC TEST — NOT ARCHITECTURE"
                        : v.title}
                    </small>
                  </td>
                  <td>{v.changeStatus}</td>
                  <td>{v.status}</td>
                  <td>
                    {media.current.some((c) => c.mediaId === v.id)
                      ? demo
                        ? "Simulated current"
                        : "Current public"
                      : "Not current"}
                  </td>
                  <td>
                    <button
                      className="portal-button"
                      onClick={() => setSelected(v.id)}
                    >
                      Inspect version {v.versionNumber} · {v.floorId}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!versions.length && (
          <p className="portal-empty">
            No residence media registered. Genuine Unit 2 artwork is still
            pending; no substitute plan is supplied.
          </p>
        )}
      </section>
      {version && (
        <section className="portal-card">
          <h2>
            {version.floorLabel} · version {version.versionNumber}
          </h2>
          <p className="portal-helper">
            {version.synthetic
              ? "SYNTHETIC ADAPTER TEST — NOT PROJECT ARCHITECTURE. "
              : ""}
            Source: {version.sourceDocument} · {version.sourceRevision}.
          </p>
          <SourceEvidence
            value={version.comparisonEvidence}
            sha256={version.sha256}
          />
          <div className="my-5 grid gap-4 md:grid-cols-2">
            {previous && (
              <Preview
                key={previous.id}
                url={previous.previewUrl}
                mime={previous.mime}
                title={`Before · ${previous.sourceRevision}`}
              />
            )}
            <Preview
              key={version.id}
              url={version.previewUrl}
              mime={version.mime}
              title={`After · ${version.sourceRevision}`}
            />
          </div>
          {["draft", "reviewed"].includes(version.status) && (
            <form
              className="space-y-4"
              key={`${version.id}-${version.revision}`}
              onSubmit={(e) => {
                e.preventDefault();
                const r = formRecord(e.currentTarget);
                void run("media." + r.action, {
                  ...r,
                  id: version.id,
                  revision: version.revision,
                });
              }}
            >
              <Select
                name="action"
                label="Media decision"
                options={[
                  ...(version.status === "draft"
                    ? [{ value: "review", label: "Mark reviewed" }]
                    : data.permissions["publication.approve"]
                      ? [
                          {
                            value: "approve",
                            label: "Approve this exact version",
                          },
                        ]
                      : []),
                  { value: "reject", label: "Reject / require replacement" },
                ]}
              />
              <Area
                name="evidence"
                label="Review evidence / architectural approval reference"
                required
              />
              <Check
                name="confirm"
                label="Confirm review authority and the exact residence, floor and version"
                required
              />
              <button className="portal-button" disabled={pending}>
                Record media decision
              </button>
            </form>
          )}
          {version.status === "approved" &&
            data.permissions["publication.publish"] && (
              <form
                className="mt-5 space-y-4 border-t pt-5"
                key={`publish-${version.id}-${current?.revision}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  void run("media.publish", {
                    ...formRecord(e.currentTarget),
                    id: version.id,
                    revision: version.revision,
                    currentRevision: current?.revision ?? 0,
                  });
                }}
              >
                <p>
                  Current version:{" "}
                  {current
                    ? `v${media.versions.find((v) => v.id === current.mediaId)?.versionNumber}`
                    : "None"}
                  . Only this residence/floor/slot changes. Selecting an older
                  approved version restores it without altering other assets.
                </p>
                <Area
                  name="evidence"
                  label="Promotion / restore reason"
                  required
                />
                <Check
                  name="confirm"
                  label={
                    demo
                      ? "Confirm simulated promotion only; never publish this fixture"
                      : "Confirm promotion of this reviewed, approved sales asset"
                  }
                  required
                />
                <button
                  className="portal-button"
                  disabled={pending || !media.publicPublicationEnabled}
                >
                  {media.publicPublicationEnabled
                    ? "Promote / restore selected version"
                    : "Public promotion unavailable — internal review only"}
                </button>
              </form>
            )}
        </section>
      )}
      <details className="portal-card">
        <summary className="cursor-pointer">
          Import a checked asset manifest
        </summary>
        <p className="portal-helper">
          Use the A-side adapter output after inspecting B&apos;s actual
          package. All entries must match this canonical residence; unchanged
          checksums/revisions are skipped. This never promotes or publishes
          inventory.
        </p>
        <textarea
          className="my-4 w-full border p-3"
          rows={8}
          aria-label="Media package manifest JSON"
          value={packageJSON}
          onChange={(e) => {
            setPackageJSON(e.target.value);
            setValidation(null);
          }}
        />
        <button
          className="portal-button"
          disabled={pending || !packageJSON}
          onClick={async () => {
            const result = await run("media.importManifest", {
              unitId,
              manifest: packageJSON,
              commit: false,
            });
            if (result) setValidation(result as typeof validation);
          }}
        >
          Validate asset manifest
        </button>
        {validation && (
          <div role="status">
            <p>
              {validation.count} assets ·{" "}
              {validation.changes.filter((c) => c.unchanged).length} unchanged ·{" "}
              {validation.committed
                ? "Draft versions imported"
                : "Nothing saved"}
            </p>
            {!validation.committed && (
              <button
                className="portal-button"
                disabled={pending}
                onClick={async () => {
                  const result = await run("media.importManifest", {
                    unitId,
                    manifest: packageJSON,
                    digest: validation.digest,
                    commit: true,
                  });
                  if (result) setValidation(result as typeof validation);
                }}
              >
                Commit validated draft media
              </button>
            )}
          </div>
        )}
      </details>
      <details className="portal-card">
        <summary className="cursor-pointer">
          Register a new media version
        </summary>
        <form
          className="mt-5 grid gap-4 md:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const r = formRecord(e.currentTarget),
              old = versions
                .filter((v) => v.floorId === r.floorId && v.slot === r.slot)
                .sort((a, b) => b.versionNumber - a.versionNumber)[0];
            void run("media.register", {
              ...r,
              unitId,
              previousId: old?.id ?? null,
            });
          }}
        >
          <Field
            name="floorId"
            label="Stable floor ID (explicit source mapping)"
            required
          />
          <Field name="floorLabel" label="Floor display name" required />
          <Field
            name="sourceFloorId"
            label="Original source floor identifier"
          />
          <Field name="slot" label="Media slot ID (e.g. floor-plan)" required />
          <Select
            name="kind"
            label="Media kind"
            options={options(mediaKinds)}
          />
          <Field name="title" label="Asset title" required />
          <Field
            name="url"
            label="Registered versioned storage URL"
            type="url"
            required
          />
          <Select
            name="mime"
            label="Asset MIME"
            options={options([
              "image/svg+xml",
              "image/png",
              "image/jpeg",
              "image/webp",
              "application/pdf",
            ])}
          />
          <Field
            name="sha256"
            label="SHA-256 supplied by checked package"
            required
          />
          <Field
            name="bytes"
            label="Byte size (optional)"
            type="number"
            step="1"
          />
          <Field
            name="sourceRevision"
            label="Source document revision"
            required
          />
          <Field
            name="sourceDocument"
            label="Source document reference"
            required
          />
          <Select
            name="changeStatus"
            label="Comparison result (checksum only or manual review)"
            options={options(["manual-review", "changed", "unchanged"])}
          />
          <Area
            name="comparisonEvidence"
            label="Source-aware detector / reviewer evidence"
          />
          <p className="portal-helper">
            Existing approved versions are immutable. This registers a draft;
            review and approval are separate. B&apos;s original floor/file names
            are retained through the explicit adapter mapping.
          </p>
          <button className="portal-button" disabled={pending || !unitId}>
            Register draft media version
          </button>
        </form>
      </details>
      <p className="portal-helper">
        Test fixture checksums: A {fixtureHashes.a.slice(0, 12)}… / B{" "}
        {fixtureHashes.b.slice(0, 12)}…. These identify abstract mechanics
        fixtures, never Golfview architectural plans.
      </p>
    </div>
  );
}
