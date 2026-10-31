# Residence media / revisions V1

The existing Sales Management workspace adds **Media / Revisions**. Authentication, project membership, canonical residence UUIDs, Demo scopes, RBAC and audit events are reused. This does not alter canonical inventory, asking prices or inventory publication snapshots.

## Workflow

1. Open `/portal/sales?project=44290fcb-17c7-4677-9053-d7402b10f863&mode=demo&tab=Media&residence=2` with existing authorised Portal access.
2. Select the canonical residence and **Load abstract test revisions**. The labelled rectangles are mechanics fixtures, not Unit 2 floor plans.
3. Inspect Ground Floor v2: source revisions A/B are compared side by side. Mark reviewed with evidence and explicit confirmation; approve the exact reviewed version separately.
4. Promote the approved version in Demo. This updates only a simulated `(project, own demo scope, residence, floor, slot)` pointer. Approve/promote First Floor, then restore Ground Floor v1: First Floor is retained.
5. Return to real business: Demo versions are absent. Existing Demo reset also clears its media versions/pointers; it never deletes canonical residences or prices.

Real mode supports URL registration and checked manifest import. Real public media promotion remains disabled by default for the unfinished sales presentation. Review and approval can be recorded internally; they do not publish inventory or media automatically. Unit 1 DESIGN CONFLICT blocks real approval. Existing `publication.approve` and `publication.publish` permissions govern their respective actions; draft access additionally requires `inventory.edit` and excludes external agents.

No upload storage or credentials are invented. Register an existing authorised versioned HTTPS asset URL on `SALES_MEDIA_ALLOWED_ORIGINS` (defaults: existing Grand Harmony and Golfview production origins). URLs with credentials/query fragments or non-presentation extensions are rejected. Private SVG previews avoid Next's public image proxy; sandboxed documents cannot execute scripts. Cross-origin previews remain subject to the source host's protection and embedding policies; the registered source link remains available.

## B deliverable adapter

B's original export/file/floor format is not prescribed. The Golfview offline A-side importer preserves original source bytes, names and dependencies with explicit floor/role mapping. Its `management-manifest.json` contains absolute protected preview URLs, hashes, source references and stable floor/slot identifiers. Paste that into **Import a checked asset manifest**, validate, then commit the returned digest. Exact canonical residence binding and existing prior-version revisions are rechecked transactionally. Unchanged entries create no duplicate version; imports create drafts only. One current asset per floor/slot is imported per package; historical versions remain in the register.

Source-aware change detection can provide `changeStatus` (`unchanged`, `changed`, `manual-review`) and `comparisonEvidence` through `media.register` / `media.importManifest`. Checksum comparisons establish byte equality only, never architectural correctness. Floor changes never replace unrelated residences/floors.

A future public promotion requires all of: explicit configuration enabling media release, reviewed/approved non-synthetic exact version, trusted non-private immutable URL, no design conflict, and inclusion of its canonical residence in the existing approved inventory snapshot. The public manifest is a whitelist, with no private prices, buyer records, source-document notes, or audit actors. Current pointers and inventories are separate operations.

## Migration 0008 and Production preservation

`0008_residence_media.sql` adds two empty tables, two trigger functions and two triggers. Composite constraints enforce canonical project/residence scope, floor/slot lineage, unique version numbers and approved-only matching current pointers. Source metadata and approved versions are immutable. Services use scope-level advisory locks, transactions and optimistic revisions for registration, checked import and promotion.

Applied to existing Neon project `shiny-tooth-37334133`, Production branch `br-royal-firefly-a7acoiq6`, database `neondb` on 31 October 2026. Recovery point recorded at **22:20:54.694 UTC**, WAL `0/27CA798`; existing PITR retention 21,600 seconds. No new branch/database/snapshot was created. Existing snapshot quota was already exhausted; recovery relies on the existing PITR window and rollback-safe additive transaction. Migration SHA-256: `4d5b418681db9732176496e3f9fced323c3d445949b93a6ea64474590454b029`.

Inside one transaction: target/journal preconditions, bounded locks/timeouts, preservation hashes before/after DDL, and migration journal insert. Post-verification at **22:22:50.492 UTC**: journal 9, new tables 2, triggers 2, real media versions 0, current pointers 0, Golfview residences 47, asking prices 47, publications 0, Unit 1 A-1C DESIGN CONFLICT retained. Hashes of all inventory, prices, CRM leads, publications and sales-project settings remained identical. No Production test-media records were inserted.

## Verification

Automated tests use all real migrations and actual services against isolated PGlite, including role/project checks, immutable sources, stale/concurrent revision conflicts, per-floor restore, approved-only pointer constraints, 47-unit/price preservation, safe public projection, default closed publication, Demo reset isolation and checked import dry-run/digest/unchanged semantics.

`scripts/sales-full-harness.mjs` is loopback-only; it renders the real SalesWorkspace and calls the real media services with isolated synthetic records. Its local fixture endpoints never ship in the application routes. Browser evidence lives in `docs/verification/sales-experience-v1`. These screenshots and tests are local component/service acceptance, not authenticated live Production acceptance. Execution proxy cannot CONNECT to Vercel deployment domains (403), and no existing authenticated browser session is available. No share link, credential or protection bypass was created.
