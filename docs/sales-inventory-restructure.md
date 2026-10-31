# Sales Management and linked inventory — 31 October 2026

Sales Management is a top-level authorised Portal module at `/portal/sales`. Its project selector lists only memberships with `inventory.view`; Golfview is the default when assigned. Existing `/portal/projects/[id]/sales` links authenticate, check project access and redirect to the new route. The existing project UUID and `700-project` slug remain unchanged; only the sales-facing identity is normalised to Golfview. Other Portal/project features retain their identity and behaviour.

## Implemented UI

- Overview: project selector, all working-status counts, live/unpublished metrics, construction/release summaries, recent non-CRM audit events and existing permitted finance/CRM summaries.
- Inventory: searchable table, status/construction/release/publication filters, natural sorting, approved media thumbnail/fallback, status colours, type/lot, both stages, live snapshot versus next-draft visibility, public price draft and actual live price, confidential asking price only with `prices.view`, land/building areas, room counts, feature tags, edit and quick actions. Bounded scrolling and sticky headers keep longer inventories usable.
- Existing full editor preserves source references, stage assignment, room/area fields, tags, approved media/floor-plan URLs, internal notes, provenance, separate public/private pricing and valid status transitions with reasons and revision locking.
- Quick status and next-draft inclusion/exclusion use existing protected server operations. They never directly publish or remove a live listing. Publishing retains separate draft, approval and release permissions.
- Leads / CRM, Activity / Audit, stages, import, publishing and settings sit in the same top-level sales workspace with their existing permission boundaries.

## One inventory, linked map

Table, filters, quick actions and map consume the same `workspace.units` result, keyed by actual unit UUID. Selection is held once by the workspace and survives Inventory/Explorer tab changes. A confirmed update refreshes the authorised server data; status colours and rows update from that result. No browser-side duplicate inventory is persisted, and no live business records were generated for this feature.

The management map consumes **unchanged** Codex B V3 2D `plan.json` and `masterplan.svg` from Golfview commit `539e93c45f0dd81f1dc7c02d1c7d83abdbc262c5`. These are versioned geometry references, not a second inventory dataset. Drawing numbers match inventory `number` exactly; unmatched, missing and filtered regions stay neutral and non-selectable. No lot position/type/availability is inferred. No B component, geometry, SVG or mapping was independently modified, and the Golfview repository remains unchanged.

The SVG is outside `public` and served at `/api/portal/sales/[projectId]/drawing` with authentication, Golfview project membership, intersected sales permissions, external-agent exclusion, private/no-store and noindex. Geometry JSON is imported only by the authenticated server page and passed only to authorised internal members; it is **not** imported into a public client chunk. Next output tracing includes the SVG for its protected function. Draft geometry is not part of a public inventory API or public asset path.

Persistent warning: source-derived unapproved regions, not legal lot boundaries. PDF/IFC reconciliation, Unit 1 classification and Unit 20 upper-region 3D binding remain unresolved. Internal map colours are working states, not approved public sales availability. Golfview's protected 3D review remains separate and unchanged.

## Import/export

The existing add-only importer now has a visible exact-header mapping contract, downloadable blank template, project stage UUID references, local validation and row preview, duplicate detection within the file and against loaded records, invalid/forbidden column rejection, size/read errors and a separate server dry-run step. The server rechecks stages, duplicates and capacity under a transaction. Editing/replacing the file invalidates validation; commit remains disabled until a successful dry-run of that exact text. Commit revalidates atomically. New records stay unreleased/unpublished and price-free. No final inventory spreadsheet was supplied or imported into production.

CSV export retains its permission, project scoping, confidentiality and formula-escaping controls. Import deliberately does not accept private prices, live status or publication flags.

## Acceptance scope and remaining gaps

Lint, TypeScript, all 43 automated tests, production build, 9 component browser flows and 8 local production HTTP checks pass. Verification records/screenshots are under `sales-inventory-verification/`. UI browser tests use actual components in a disposable loopback harness with **synthetic** records and mock actions, not an authenticated Production session. Service tests run against PGlite with real transactions/RBAC/revisions/publications, not Neon. Local production-build checks separately verify anonymous login redirects and absent public drawing paths. Authenticated live owner-session acceptance remains pending; do not create share links, credentials or bypass protection to claim it passed.

No migration, Neon write, real import, live publication or buyer enquiry activation was required. Golfview Website V2 and its 3D integration remain at the existing commit.

Further source/model work: dedicated frontage and orientation fields, price-guide mode and any additional sales statuses such as explicit EOI/under-offer require a separately validated additive domain/schema extension. This round preserves existing protected status transitions and supports numeric public prices or price-on-application through existing controls. No missing attributes or prices were fabricated. B/source approval and owner acceptance remain required before using draft drawings as final sales material.
