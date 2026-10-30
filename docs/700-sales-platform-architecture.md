# 700 Project Sales Platform — Architecture Decision Record V1 (2026-10-31)

## Baseline and verified facts
- Corporate repository: maxstillwell/grandharmony, main c91dfa7f2d5cedc5a644f2edf77bedd21cc82010; Vercel project grandharmony is production READY on the same commit.
- Next.js 15.5.9 / React 19.1.1 / TypeScript / Auth.js credentials JWT / Drizzle ORM / Neon PostgreSQL.
- Existing tables: users, roles, user_roles, projects, project_memberships, audit_logs; model_registry, model_versions, model_scenarios, scenario_revisions; website_revisions, website_media, website_publish_events; share-link tables introduced by migration 0004.
- Reuse project memberships, server guards, audit log, Interactive Specification scenario storage and website publishing workflow concepts. Do **not** assume migration 0004 is deployed. Live production schema not independently inspected.
- Existing website_media is metadata only, without upload pipeline. Existing project workspace states sales registers await integration. There are no inventory, lead, offer, contract or agent assignment tables in main.
- Live Vercel env variable **names** confirm Neon integration (GH_DATABASE_URL); no secret values were decrypted. Review credentials and grant the public site a separate, strictly read-only database role if using direct DB read.

## Target topology
1. Corporate Next.js repository and Vercel project: authenticated Portal, inventory CRUD, approval/publish, CRM and admin-only reports, Neon migrations.
2. Separate `maxstillwell/700-project-sales` repository and Vercel project (not yet created): independent sales branding, SSR public pages and public unit projection API. No management actions, secrets in client bundle, or privileged server routes.
3. One Neon PostgreSQL **database**, with distinct DB roles: corporate write role and sales-site SELECT-only role scoped to an explicit published-public projection or view. In particular, the sales-site DB role MUST NOT have SELECT on base inventory, leads, prices or audit tables. Alternatively use a narrow corporate public-read service with authenticated server-to-server access, rate limiting and a fixed DTO.
4. Versioned published snapshot, and atomic publish transaction. Publishing means copying approved, validated public DTO fields; unapproved records never appear in public data, even if they have an Available status.
5. Production public domain is undecided. Do not register or bind it without approval.

## Recommended additive data model
Every primary key is a UUID. `project_id` references existing projects. `unit_number` is project-scoped unique; internal `unit_id` never changes.
- `sales_stages`: project_id, code, name, sequence, release_window, publish_state. Keep distinct from `construction_stages` with separate table and foreign keys.
- `unit_types`: project_id, code, label, typical_layout metadata, version. Types are shared, unit-specific details can override.
- `sales_units`: project_id, unit_number, unit_type_id, sales_stage_id, construction_stage_id, availability_status, bedrooms, bathrooms, car_spaces, orientation, land_area_sqm, building_area_sqm, internal_notes, revision, updated_by. Add CHECK constraints for nonnegative measurements, valid statuses, unique(project_id,unit_number).
- `unit_private_prices`: unit_id, internal_floor_price, asking_price, price_notes, revision. No public DB grant.
- `unit_price_publications`: unit_id, public_mode (hidden / POA / guide / fixed), display_text, publication_revision and published_at. Only explicitly approved display fields enter public projection. Always log approval and prior state.
- `sales_publications`: project_id, revision, status, approved_by, published_at, immutable publication payload/version. `published_units`: publication_id, unit_id, public safe DTO, visibility, asset references. Restrict public read access to a separate view filtered by current published publication.
- `sales_unit_events`: unit_id, status_from, status_to, actor, reason, created_at. Use a transition service and transaction; editing an internal status does NOT automatically publish it.
- `sales_media`: project_id, unit_id nullable, object key, media_type, MIME, size, dimensions, checksum, rights/license, version, status, approved_by. Private staging keys must not be public.
- `sales_site_views`: project_id, view_id, image/media_id, source_image_width, source_image_height, projection metadata; `sales_unit_hotspots`: view_id, unit_id, normalized polygon coordinates, label coordinates, status. Require polygon verification for each 2D and each 3D angle.
- `sales_specification_releases`: project_id, source_scenario_id, source_revision, approved snapshot, published_at. Attach shared unit-type overrides and unit-specific exceptions. No direct public reads of model_scenarios.
- `sales_leads`: project_id, unit_id nullable, name, normalized email, phone, enquiry_type, source, campaign, privacy_policy_version, consent_marketing, consent_timestamp, assigned_agent_id, status; timestamps and retention rules.
- `sales_lead_events`, `sales_inspections`, `sales_offers`, `sales_contracts`, `sales_agent_assignments`: scoped ownership, limited visibility and immutable event trail where applicable. Sensitive PII only in private tables.
- Extend existing `audit_logs`, or add `sales_audit_events` with project and unit dimension, field-level safe before/after snapshots (avoid leaking client PII in metadata).

Use additive Drizzle migration files; inspect live migration journal, take backup, test on a Neon branch before any production migration. Never run `drizzle push` against production as an unreviewed shortcut.

## Publishing invariants
- `availability_status` and `publish_status` are independent: available does not mean public.
- Before publish: explicit owner approval for unit, price, floorplan, rights-cleared images and specifications; no draft or internal value in published DTO.
- Default is NOT published. Price defaults to hidden, never to a numeric guess.
- `published_units` must not include `unit_private_prices`, client, offer, contract, audit or internal notes. Public cache invalidation only after commit.
- Sale status changes need a controlled approval path and revalidation to avoid showing stale inventory.
- For enquiries, validate schema, rate limit, bot protection, privacy disclosures and consent; log source/UTM and secure server-side storage.

## Portal pages (existing authenticated app)
- `/portal/projects/[projectId]/sales`: summary and role-scoped metrics
- `.../sales/units`: 47-row inventory, import dry run, filters, bulk staged changes
- `.../sales/units/[unitId]`: attributes, floor plans, price, status, history and assigned stage
- `.../sales/stages`: independently manage sales vs construction phases
- `.../sales/media`: uploads, copyright, versions and hotspot calibration
- `.../sales/specifications`: controlled approved snapshots from Interactive Specification scenarios
- `.../sales/publishing`: changes-to-public diff, review, approval, audit, rollback to prior publication
- `.../sales/leads`: leads, permissions, follow-ups, inspections, offers, contracts
- `.../sales/agents`: assignments, scope, audit
- `.../sales/reports`: unit status pipeline and enquiry performance

## Sales website pages
- Home: architecture-led hero + project proposition
- Explore: 2D flat plan, 3D pre-rendered view and local-area modes
- Home details `/homes/[unitNumber]`: approved unit facts, Ground / First / Second floor plans, gallery, published specifications, brochure, enquiry
- Residences: filters and typologies
- Lifestyle / Local Area: evidence-backed amenities; authorised map
- Design & Inclusions: approved standard specification and upgrades
- Gallery, Downloads, Enquire, Privacy and legal notices
- Mobile: large tappable units, bottom detail sheet; desktop: side panel and synchronized selection. Accessible list-based alternative to a visual map.

## 2D/3D plan contract
- Plan image and SVG overlay share one canonical coordinate system; measured image dimensions and polygons must be delivered and calibrated against the final drawing.
- Store unit hotspots separately for each approved camera angle; all views map to the same immutable unit UUID.
- For early 3D, use fixed pre-rendered angles and a lightweight image swap/crossfade; defer real-time GLB rendering to a later documented use case.
- Asset supplier must deliver licensed original renders, camera viewpoints, layer/background options, resolution, unit ID mapping, geometry masks/polygons, web derivatives, and explicit resale/marketing rights. Require correction rounds and revision versioning.

## Role matrix — proposed, not an override of existing RBAC
- Super Admin: all functions including publish and managing access.
- Management: project read/edit, publish only if explicitly delegated by owner.
- Project Manager: assigned project/unit edits and assets, no approval to publish prices by default.
- Sales Manager: approved assigned project inventory/status and lead operations; no internal minimum pricing unless specifically granted.
- External Agent: only explicitly assigned leads and published units, expiration-based grants, no project-wide export.
- Finance: internal financial access according to existing role; no CRM PII by default.
All checks on the server (including Server Actions), anchored to verified project membership. `PortalAccess.role` currently selects the first role and is not an adequate multi-role permission model; explicitly evaluate safely before expanding permissions.

## Owner-controlled data and media
- Existing website_media is metadata only. Compare Cloudflare R2 and Vercel Blob on end-to-end costs, lifecycle rules, signed upload URL, CORS, CDN, deletion and outbound usage before activation. Use PostgreSQL for object metadata, not image/model binaries.
- Owner materials: signed-off Site Plan PDF + clean export; official Unit Schedule/lot areas; unit type and 3 floor plans; construction vs sales staging; presentation renders, stage statuses; approved price publication policy; brochure, specs approval; legal disclaimers; sales contact/email/telephone and privacy wording; GIS location verification; agency role matrix.

## Acceptance gates
0. Source and live state audit; migrations and Neon branches compared, security risks documented.
1. 47 official IDs exactly map to 47 validated unique polygons; no mismatched/hardcoded unit data; 2D touch/pointer/keyboard select, reset, zoom and responsive performance.
2. Portal CRUD and price/status stage edits authorized; full audit and version/revert; read-only public service cannot retrieve private rows/columns even via malformed input.
3. Controlled draft/preview/publish; published projection matches approved snapshot; no unapproved data leaks; public site reflects edits after approved publish.
4. 3D angle-specific click mapping and performance supported by licensed assets, same unit IDs.
5. 3-level floor plan and specification release matched by unit; absent values shown as unpublished, not fabricated.
6. CRM lead tracking, consent, deletion, anti-spam and agent isolation; backup/restore dry run; lint, TypeScript, build, automated API/security/e2e and mobile accessibility checks.

## Current development prototype
An isolated noindex demo lives at `/demo/700-explorer` in branch `feature/700-sales-platform-foundation`. All 47 geometries and statuses are deliberately labelled TEST and fictional; do not use the demo endpoint in public sales navigation. Production main and live Neon have not been changed by this branch.
