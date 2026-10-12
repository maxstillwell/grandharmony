# Status

## Phase 3B — implementation complete; release verification in progress

Production: https://grandharmony.vercel.app

Phase 3A was accepted by the owner (Save, Save As, restore, history, archive and print). Phase 3B imports the supplied `Grand_Harmony_700_Feasibility.html` and creates the shared Portal workspace. Release commit and Vercel build status are recorded in Git/Vercel; final online evidence follows the deployment.

### Completed

- Shared dark sidebar with collapse/expand, persistent preference and narrow mobile rail across Portal routes.
- In-place Focus Mode, stable model toolbar and server-validated scenario URLs; no model opens a new window.
- Reviewed real model: `700-development-feasibility`, 700 Project, Development Feasibility, version 1.0.0. Original HTML and formulas are unchanged.
- Authenticated document endpoint and sandboxed iframe; validated origin, Window source, model ID, instance nonce, schema version and message type.
- Full-state adapter for numeric assumptions, toggles, financing and dynamic cost rows, with recomputed result comparison on restore.
- Existing Neon scenario tables reused; reviewed model registers idempotently on first Super Admin library access. No schema migration or manual database step is required.
- Save, Save As/Duplicate, rename via scenario name + Save, Open, URL restore/reload, recent revision history and Archive. Server validates state, version, project permissions, private ownership and expected revision.
- Atomic scenario/revision/audit writes. Cross-version overwrites and stale revisions are rejected.
- Print/PDF with scenario/project/version/date, inputs, recalculated results, sensitivity table/chart and A4 portrait/landscape controls.

### Verification

- Automated adapter tests: original SHA-256 match; fractional input/dynamic row JSON round-trip with identical calculation results; message origin/source/ID/schema/type rejection; malformed state rejection; role/project/private-owner denial.
- ESLint, TypeScript and local production build passed.
- Original model source confirmed absent from public `.next/static` assets.
- Existing production rollback candidate verified: `dpl_9FNfSsTFwLdmia2q8GCHQtxFKQij`, commit `89d2df66c25032e0d5b32f15e7de6272afeedff5`.

### Pending User Acceptance / limitations

- The owner’s authenticated browser session is required to verify new model registration, Save A / Save As B / re-login restore and database revision history end to end. Automated model-state checks do not constitute this online acceptance.
- Sidebar/focus browser interactions, Back/Forward unsaved-navigation handling and real PDF pagination require browser acceptance. Sidebar and Focus changes preserve the iframe instance in code.
- The supplied model uses JavaScript Number precision and existing financial simplifications. This integration preserves them; it does not certify accounting/tax assumptions or add decimal mathematics.
- The scenario-name field supports rename; Save As also supplies a duplicate name. Historical revisions are listed (20 most recent) and stored permanently; direct restoration of a historical revision is not added in this release.
- The initially proposed Sales Strategy HTML has not been supplied. The supplied Feasibility model is the one imported in this phase.

### Next step

Accept the deployed real-model flow, then supply the next complete HTML/CSS/JS/assets with its version and project scope. No automatic next phase.
