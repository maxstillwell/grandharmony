# Status

## Phase 3C — implemented; production release verification pending

Production: https://grandharmony.vercel.app

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
- Deployment commit/build and online smoke results will be recorded after the cloud release.

### Pending User Acceptance

- Refined visual appearance at desktop/tablet/mobile, Sidebar/Focus interactions, native browser input editing, database-backed save/reopen and actual PDF pagination require the owner's authenticated browser acceptance.
- Automated formula/state tests confirm mathematical compatibility; they do not claim a live authenticated browser/database lifecycle test.
- The source model retains its original JavaScript Number precision and financial/tax assumptions; those assumptions are not certified by this UI change.

### Next step

Review the deployed Portal-native workspace. No new model files are needed for the current Feasibility model. Future models should include complete source/assets, version and project scope for the documented audit/native-integration process. Stop after Phase 3C.
