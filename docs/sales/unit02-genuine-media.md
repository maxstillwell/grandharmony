# Genuine Residence 02 media integration

This release registers Codex B's actual six assets against Golfview's existing canonical Residence 02 UUID `c6e15f16-e08b-4c66-af20-ae5cb015c660`, project `44290fcb-17c7-4677-9053-d7402b10f863`. Geometry identity remains `700:2`. No migration beyond existing 0008 is required.

## Source and assets

Owner-authorised Drive handoff `1PCBnxNi3VAb2M6ZGWE7OyxnlyiZutih1`, 13,754,303 bytes, SHA-256 `73c8852505e7a883409f8eb45f2b3ef1244084ba3e5f62b224a47ae45277cc86`. ZIP CRC and every one of its 57 manifest file sizes/hashes were verified. B source version: `DWG-20261009-R2-unit02-v1`.

| Floor / slot | Source identity | Original bytes |
|---|---|---:|
| Ground / floor-plan | ground / TP101, 9 October 2026 R2 | 238,498 |
| First / floor-plan | first / TP102, 9 October 2026 R2 | 538,157 |
| Second / floor-plan | second / TP103, 9 October 2026 R2 | 179,698 |
| Residence / perspective | IFC-derived cutout, illustrative finishes | 2,230,430 |
| Residence / A3 board | Supplied board image | 308,889 |
| Residence / A3 PDF | Original single landscape A3 PDF | 2,028,296 |

Total 5,523,968 bytes. The offline HTML application, raw source registry, IFC/DWG and standalone viewer are not served as a second application. There is no separate site-context illustration in this package; the existing masterplan/3D identity provides context. No artwork is fabricated for the other 46 residences.

Original registered URLs point to Golfview's protected exact-file endpoint. For Portal previews, identical checked bytes are mirrored under `assets/sales-media/golfview-unit02-v1`, outside `public/`. The authenticated `/api/portal/projects/[projectId]/sales/media/assets/[sha256]` handler requires existing Portal access, project membership, inventory-edit permission, non-agent role, matching real/own-Demo media record, allowlisted bundle entry and runtime content hash. Responses are private/no-store/noindex with scriptless sandboxing. A hash or URL alone grants no access.

## Actual Production registration

Existing authorised Neon connection: project `shiny-tooth-37334133`, main `br-royal-firefly-a7acoiq6`, database `neondb`. Pre-import recovery timestamp **2026-10-31 23:02:37.497 UTC**, WAL `0/2855A98`, within the existing PITR window. No branch, database, identity, credential or new infrastructure was created.

Because authenticated Portal browser access is unavailable, registration was a clearly audited **owner-authorised Neon maintenance import**, not a claimed Portal login. `scripts/sales-media/prepare-unit02-registration.cjs` ran the actual existing RBAC-checked media service and checked-manifest dry-run on disposable PGlite with verified target identity stubs (no Production prices or buyers). It exported only the actual service's media/event/audit INSERT statements, preserving service-assigned UUID associations. The connector then executed one atomic transaction with independent active maintainer/global-role/project-role verification, exact canonical residence/public-key checks, empty-target/version preconditions, locks/timeouts and before/after preservation hashes. Audit includes explicit `media.operator-import` provenance and identifies Codex A acting under the owner's authorisation; no identity or session was fabricated.

Manifest validation digest: `d896cfb9f2b6a9f1a5d98b259d88f8c82e3e2a0ce3fc55d722dd55ff43dd5bc3`. Applied at **23:16:50.983 UTC**. Six rows are version 1, `draft`, `synthetic=false`, real scope; no approval/public pointer was created. At **23:20:29.546 UTC**, verification retained 47 residences, 47 asking prices, Unit 1 A-1C DESIGN CONFLICT, zero public media pointers and zero inventory publications. Inventory, asking-price and CRM hashes match the pre-import baseline exactly.

Open `/portal/sales?project=44290fcb-17c7-4677-9053-d7402b10f863&tab=Media&residence=2` through existing login. This shows the genuine six real draft versions. `SALES_MEDIA_PUBLICATION_ENABLED` remains disabled; real artwork is not exposed through public sales manifests. Existing review/approve permissions remain enforced; no genuine material is claimed architect approved.

## Source-aware change workflow

B's unchanged `revision_engine.py` is integrated in Golfview with original source hashes, registry and tests. A's CLI adapter verifies stable residence/floor identity and registered millimetre source frames, invokes B's matcher and emits floor-level comparison evidence for the existing media service. No architectural input file is rewritten.

The controlled test deep-copies the genuine source registry, shifts one first-floor wall 150mm in memory, and runs B's matcher: **first changed; ground and second unchanged; manual review required**. A watermarked test SVG is isolated in Demo fixtures and cannot enter the real scope. This is not a genuine later design revision.

In the Portal's own Demo mode, select Residence 02 and **Load genuine Unit 02 + isolated source-change test**. It seeds the six unchanged source assets into the user's Demo scope and adds exactly one first-floor test version. Inspect First Floor v2 for original/test comparison and source fingerprints. Review, approve and simulate promotion using existing controls. Ground/Second Floor versions and any existing pointers are preserved; real media, inventory, prices and all public responses are unaffected. If a Demo already has media, use existing versions or the established reset for that user's Demo; no automatic reset occurs.

Browser evidence: `docs/verification/unit02-real`, using actual services and component UI against disposable PGlite. Automated tests additionally verify original asset hashes, canonical-binding rejection, authenticated private-response permission/scope checks, idempotent import, default-closed public projection and synthetic isolation.

## Review limitations

Artwork remains provisional, not approved as the final watercolor template. Area convention **229 m² + 23 m² balconies = 252 m²** requires architect/owner confirmation of the measurement basis; no canonical area field was rewritten. Room labels, orientation, illustrative finishes and PDF/IFC revision reconciliation retain B's source warnings. Stronger watercolor treatment, landscaping and colour presentation belong to the next B/owner visual review.

Production READY/SHA and existing deployment protection are checked through authenticated Vercel metadata. The execution proxy only permits package/Git destinations and rejects Production-domain CONNECT (403). Live authenticated browser acceptance therefore remains pending; no share link, new credential or protection bypass is created.
