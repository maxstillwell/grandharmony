# Status

## Phase 4A — deployed with safe fallback; migration and Blob authorisation pending

Production: https://grandharmony.vercel.app

Feature commit: `33a42c3f2c2c994cac2b86da11d3f48e68c444b5`.
Vercel deployment: `dpl_BwaVek4XB52apmhUPu83xg6LMrDF` (READY; Production domains assigned).

### Completed in source

- Public corporate website redesigned to the approved architectural/quiet-luxury direction, including the required Hero, About, Experience, Construction Expertise, Expertise, Team, Selected Developments, Contact and footer sections.
- Hero supports controlled image/video mode, poster fallback, muted looping inline video, responsive crop, reduced-motion behaviour, text alignment and overlay presets.
- Added Super Admin-only Website Management at `/portal/website`, including private structured draft creation/editing, protected preview, explicit publish and restore-to-new-draft workflows.
- Added versioned public content schema, metadata-only media registry and publishing/audit event tables in safe additive migration `drizzle/0003_sudden_proteus.sql`.
- Public pages read only the latest published revision and safely fall back to reviewed source content if website tables are unavailable. Internal project data is never automatically published.
- Existing models, scenarios, auth, RBAC and project access code are untouched.

### Verification completed locally

- ESLint, TypeScript, production build and `git diff --check` passed.
- Generated migration is additive; it does not alter or delete existing model, scenario, project, user or Auth.js tables.
- Vercel cloud build for the feature commit reached READY. Public `/` returned HTTP 200 and rendered the approved Hero statement. Unauthenticated `/portal/website` and `/portal/models` resolved to the existing sign-in requirement.

### Blockers / pending owner action

- The execution environment has no direct Neon migration credential. Apply `drizzle/0003_sudden_proteus.sql` (or run `npm run db:migrate` in the already linked repository with the production Vercel environment) before Website Management can read/write its tables. Until then public production stays on the safe fallback website.
- No Vercel Blob store/token is connected to the Grand Harmony Vercel project. Upload, replacement, media inspection and deletion are intentionally disabled. Connect an approved Blob Store (confirming any pricing/authorisation in Vercel) to enable the hardened upload route in the next narrowly scoped update.
- Authenticated browser tests for draft isolation, publish/rollback and actual media/video upload require owner acceptance after the migration/storage setup. No unverified claim is made for these flows.

### Next step

Apply the additive website migration, then open `/portal/website` as Super Admin, create a draft, preview it and publish. Stop after Phase 4A; do not begin financial models or CRM work.

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
