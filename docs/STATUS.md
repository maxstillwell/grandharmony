# Status

## Sales platform development branch

Phase 2 implementation is on `feature/golfview-sales-platform`, including inventory, independent stages, private prices, controlled publications, CRM and public/enquiry API handlers. See [implementation and release gates](sales-platform.md).

Production Neon schema/migration state (including 0004), live authenticated sales operation and production backend release remain unverified. No production migration or merge is claimed. The approved public inventory stays empty until owner data is supplied and explicitly published.

## Phase 3D — Model Management & Scenario Comparison

### Completed in source

- Added a server-authorised Scenario Comparison page for each active Portal-native model. It compares two saved scenarios from the same model, highlights changed values, supports differences-only display, warns when model versions differ and prints a Grand Harmony comparison report.
- Financial comparisons separate saved assumptions from stored calculation results. Interactive Specification comparisons cover Item, Description, Status and reference images.
- Restored Interactive Specification to a compact editor: Item, Description, Status and reference images with each image's Source URL. Add/delete/reorder, status filtering and an outstanding-decision count remain. The eight original sections and all saved item data remain compatible; optional metadata is retained but not shown.
- Model Library now supports update-date ordering in addition to model/category/project filtering. General tools remain reusable rather than permanently fixed to a project.

### Verification completed locally

- ESLint, TypeScript, production build, `git diff --check`, existing model calculation/permission regressions, Website Management regression tests and the new scenario-comparison compatibility tests pass.
- Legacy Interactive Specification state is explicitly tested: old eight-section items open with empty optional Brand/Model/Notes/source-link values while preserving their existing name, description, status and image data.
- Authenticated browser acceptance for comparison selection, print/PDF pagination and actual saved legacy scenarios remains pending because no administrator session is used in automation.

## Controlled external specification collaboration — migration pending

### Completed in source

- Added controlled sharing for the Portal-native **Interactive Specification** only. An authorised user can create a 7/30/90-day collaboration link from a saved scenario, copy it once, inspect its status and revoke it in the Model Runner.
- The recipient uses a polished `/share/[token]` workspace without Portal login. They can change the specification and, on first save, supply their own name, optional email and Scenario name. The server creates a separate Scenario rather than changing the owner’s source; later saves are bound to that browser’s secure HttpOnly session cookie.
- The scenario owner can see the separate collaborator Scenario in the ordinary Scenario Library. Super Admin/Management behaviour remains unchanged; project scope and model permissions remain server-checked.
- Added safe additive Drizzle migration `0004_handy_morlun.sql` for `scenario_share_links` and `scenario_share_sessions`. Raw share/session tokens are never stored: Neon receives SHA-256 hashes only. There is no Blob, new paid service or public Portal access.

### Verification completed locally

- ESLint, TypeScript and Production Build pass. The collaboration regression test verifies token hashing, per-link cookie scope, expiry/revocation enforcement points, and that the migration has no destructive statements.
- The migration has **not** been run against Production from this environment because database credentials are not available here. Until the owner runs `npm run db:migrate` in the Vercel-linked repository, the existing Specification runner continues working and shows that collaboration links await the migration.

### Pending user acceptance

- After migration: create a saved Interactive Specification scenario, create a link, edit/save it from a separate browser profile, then confirm the separately named Scenario appears in the owner’s Scenario Library. Also confirm Revoke makes the link unavailable. No production administrator credential or scenario data was used for automation.

## Interactive Specification — Portal-native generic model

Feature commit: `8d21ff0167c65ebf7a48489a06672c62c7053f91`.
Production deployment: `dpl_2f73C4Q3QkZ3HHeiVtiSCXZspVA1` (READY; production domains assigned).

### Completed in source

- Retired the active Scenario State Test Model from the Library. It is hidden immediately and archived idempotently for Super Admins without deleting historical scenarios or audit rows.
- Changed Development Feasibility from a project-fixed model entry to the generic **Development Feasibility** tool. Existing saved scenarios keep their project association; new scenarios choose their project independently.
- Added the general **Interactive Specification** model (category: Specifications, version 1.0.0), rebuilt from the owner-supplied Schedule of Finishes & Inclusions source data. It retains all eight supplied sections and their editable items.
- Added per-item Confirmed / To confirm / Optional status, individual HTTPS reference images with labels/source references, Save/Save As/restore/history/archive and a Portal-native A4 print/PDF report.
- Server-side scenario save/update validates the selected project against access, validates specification state and image URLs, and prevents an unauthorised scenario association from being read, edited or archived.

### Verification completed

- ESLint, TypeScript, production build, `git diff --check`, existing model/website regression tests and the new Interactive Specification state/policy test passed.
- Vercel Production build reached READY for `8d21ff0`. Online checks returned HTTP 200 for `/`; unauthenticated `/portal/models` resolved to the existing login page. No model state was exposed.
- No database migration is required; model registration and legacy-test archival are idempotent application actions.
- Authenticated browser acceptance for creating an Interactive Specification scenario, assigning a project, saving/reopening and reviewing print/PDF pagination remains pending. No administrator password or production scenario data is used for automation.

## Phase 4A.2 — Website Management usability and acceptance safeguards

Feature commit: `c94df83ab3fb194de819e932f133c7ffff47a668`.
Production deployment: `dpl_3NEoW6JZ1NJBu4fvzKn1dfqG8jJX` (READY; `grandharmony.vercel.app`, `grandharmony.com.au` and `www.grandharmony.com.au` assigned).

### Completed in source

- Reorganised Super Admin Website Management into a Portal-native workspace with Overview, Hero, Page Content, Team, Developments and Preview & Publish modules. The Portal Sidebar remains in place and no editor opens a new window.
- Added an honest status overview for Published Version, Last Published Date, Draft Changes, Hero Media Status, Media Upload Status and Website Content Status. It reports only revision/content state—no simulated operational metrics.
- Hero editing now clearly supports headline, subtitle, alignment and overlay settings. Image / Video mode remains visible as a future interface, while the approved static Hero image is safely locked until approved media storage exists.
- Page copy is editable for About, Experience, Construction Expertise, Expertise, Team introduction, Selected Developments introduction and Contact. Development and Team entries support ordering and explicit publish state; no placeholder people or internal projects are created.
- Added a controlled selection of already approved static image assets for Team/Development cards. Arbitrary image URLs and all uploads remain unavailable without Blob; image-free cards are fully supported.
- Added unsaved-change browser-exit protection, clear draft/publish failure messages, private preview access and published-version restore-to-draft history. Restore remains non-destructive until a Super Admin explicitly publishes the resulting draft.
- Hardened server-side validation: only valid structured content, the approved static Hero and approved static gallery assets may be persisted; all save/publish/restore operations continue to require the Super Admin guard. Publishing remains transactional and revalidates public pages.

### Verification completed

- ESLint, TypeScript, production build, `git diff --check`, the Website Management policy/RBAC regression test and existing model adapter regression test passed.
- Vercel Production build reached READY for `c94df83`. Online smoke checks returned HTTP 200 for `/`; unauthenticated `/portal/website` resolved to the existing login page, rather than exposing Website Management.
- Production Neon migration was previously verified by the owner: `website_revisions`, `website_media` and `website_publish_events` exist. This phase does not change the database schema or touch existing accounts, projects or scenarios.
- Authenticated browser acceptance is intentionally pending: an actual Super Admin must perform Draft → Preview → Publish → Restore using their own session. No password or production session was requested or used, and no test copy has been published to the live website.

## Phase 4A.1 — Website Management database migration applied; no-Blob activation deployed

Production: https://grandharmony.vercel.app

Feature commit: `33a42c3f2c2c994cac2b86da11d3f48e68c444b5`.
Vercel deployment: `dpl_BwaVek4XB52apmhUPu83xg6LMrDF` (READY; Production domains assigned).

Phase 4A.1 no-Blob feature commit: `0c14ab15e8b64b88ca856ce86d594124fac13c2d`.
Production verification deployment: `dpl_Hp6TPjBg485diLMGCxsFMCpxdc3X` (READY; Production domains assigned).

### Completed in source

- Public corporate website redesigned to the approved architectural/quiet-luxury direction, including the required Hero, About, Experience, Construction Expertise, Expertise, Team, Selected Developments, Contact and footer sections.
- Hero supports controlled image/video mode, poster fallback, muted looping inline video, responsive crop, reduced-motion behaviour, text alignment and overlay presets.
- Added Super Admin-only Website Management at `/portal/website`, including private structured draft creation/editing, protected preview, explicit publish and restore-to-new-draft workflows.
- Added versioned public content schema, metadata-only media registry and publishing/audit event tables in safe additive migration `drizzle/0003_sudden_proteus.sql`.
- Public pages read only the latest published revision and safely fall back to reviewed source content if website tables are unavailable. Internal project data is never automatically published.
- Existing models, scenarios, auth, RBAC and project access code are untouched.
- Website Management no longer accepts arbitrary media URLs when Blob is unavailable. Hero remains on its approved static image; text, controlled alignment/overlay, section copy, Team, Developments, display order and publish state remain independently editable after the website migration. The Media Library explicitly states: `Media uploads are not enabled yet.`

### Verification completed locally

- ESLint, TypeScript, production build and `git diff --check` passed.
- Generated migration is additive; it does not alter or delete existing model, scenario, project, user or Auth.js tables.
- Vercel cloud build for the feature commit reached READY. Public `/` returned HTTP 200 and rendered the approved Hero statement. Unauthenticated `/portal/website` and `/portal/models` resolved to the existing sign-in requirement.

### Migration verification

- Production Vercel environment inspection confirms the existing Neon integration is scoped to Grand Harmony. The migration is the additive Drizzle file `drizzle/0003_sudden_proteus.sql`; it creates only `website_revisions`, `website_media`, `website_publish_events` and their enums/indexes/foreign keys. It contains no `DROP`, `TRUNCATE`, `ALTER` of existing tables, reset or `db:push` operation.
- The owner ran `npm run db:migrate` from the Vercel-linked production repository after syncing the migration. Neon Primary was verified to contain all three expected tables. Existing initial migrations remain intact.
- No Vercel Blob store/token is connected to the Grand Harmony Vercel project. Upload, replacement, media inspection and deletion are intentionally disabled. Connect an approved Blob Store (confirming any pricing/authorisation in Vercel) to enable the hardened upload route in the next narrowly scoped update.
- Authenticated browser tests for draft isolation, publish/rollback and actual media/video upload require owner acceptance after the migration/storage setup. No unverified claim is made for these flows.

### Next step

Open `/portal/website` as Super Admin, create a draft, preview it and publish. The authenticated Draft → Preview → Publish → Restore browser acceptance remains pending because it cannot be performed without an administrator session. Stop after Phase 4A.1; do not begin financial models or CRM work.

## Phase 3C — deployed; visual/native browser acceptance pending

Production: https://grandharmony.vercel.app

Feature release commit: `ec0932ad71661c84ee1291230a7f455282055ef6`.
Vercel deployment: `dpl_3Gs2VzL38rmbFK7KXEfXwa6sVsQ7` (READY, Production domains assigned).

### Completed

- Portal Library `/portal/models`, Model Runner `/portal/models/[modelId]` and Project Workspace `/portal/projects/[projectId]` use the refined warm-white/charcoal/stone visual system.
- Extremely subtle thin-line motifs and editorial headings; modern sans-serif UI, quiet active states and shared cards/forms/tables/summary panels.
- Reusable Portal-native Model Shell with breadcrumb/project/version context, stable save toolbar, workspace/scenario/history views and wide model canvas.
- Existing dark collapsible Sidebar, persisted collapse preference and in-place Focus Mode retain their state/layout behaviour. Views keep the canvas mounted.
- **700 Development Feasibility is Portal-native**: the active page renders native inputs, dynamic cost rows, results, assumptions, summary and sensitivity charts. It no longer renders the standalone HTML layout.
- Original calculate body copied verbatim into the pure native engine; original HTML retained intact for reference.
- Existing model/adapter/version IDs, Neon schema and saved Scenario JSONB structure preserved; no migration or data deletion.
- Save, Save As, restore, rename, duplicate, archive, history and Print/PDF use the existing platform lifecycle.
- Design and architecture formally require importing logic/data rather than legacy standalone presentation. The older bridge is retained as compatibility infrastructure; no currently active model needs it.

### Verification

- ESLint, TypeScript and Production Build passed.
- Six model/security tests passed. Native/original calculation parity covers 64 combinations of price, sold/retained units, marketing, contingencies, GST schemes/credits, tax losses, financing and dynamic cost rows, plus JSON restore and sensitivity prices.
- Original asset SHA-256 remains identical.
- No heavy dependency added.
- Vercel cloud Production Build succeeded. Online checks: `/` returned 200; unauthenticated Model Library and Runner resolved to `/login`; model document endpoint returned 401. No unauthorised model data was returned.

### Pending User Acceptance

- Refined visual appearance at desktop/tablet/mobile, Sidebar/Focus interactions, native browser input editing, database-backed save/reopen and actual PDF pagination require the owner's authenticated browser acceptance.
- Automated formula/state tests confirm mathematical compatibility; they do not claim a live authenticated browser/database lifecycle test.
- The source model retains its original JavaScript Number precision and financial/tax assumptions; those assumptions are not certified by this UI change.

### Next step

Review the deployed Portal-native workspace. No new model files are needed for the current Feasibility model. Future models should include complete source/assets, version and project scope for the documented audit/native-integration process. Stop after Phase 3C.
