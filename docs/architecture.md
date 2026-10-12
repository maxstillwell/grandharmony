# Architecture

## Current Phase 1.5 boundary

Grand Harmony uses Next.js App Router, TypeScript strict mode, Tailwind CSS and reusable React components. Public project records are isolated in `lib/data/projects.ts`; they are approved public content, not an internal source of truth.

- `/` — corporate website
- `/projects/[slug]` — public project detail pages
- `/portal` — non-authenticated holding page
- `/demo/portal` — non-confidential visual demonstration only

No database, authentication provider, API, real model, CRM, client-side credential or private document exists in this phase. Authorisation must never rely on hiding navigation.

## Future platform design — not implemented

### Neon PostgreSQL

Use Neon PostgreSQL as the authoritative operational datastore through a server-only data access layer. Vercel request traffic uses a pooled `DATABASE_URL`; migrations use an optional direct connection. Use parameterised queries or a typed ORM, source-controlled migrations, encrypted transport, least-privilege roles, backups and audit-friendly timestamps. Browser code must never receive a connection string.

Future entities include `users`, `roles`, `project_memberships`, `projects`, `project_publications`, `inventory`, `price_scenarios`, `model_registry`, `documents`, `crm_contacts`, `crm_activities` and append-only `audit_events`. The developer owner role retains final server-side authority over projects, inventory, prices, publication and CRM administration.

### Auth.js and RBAC

Introduce Auth.js only after selecting an approved identity provider and access policy. Sessions must be secure, httpOnly and server-validated. Keep roles and project membership in server-side checks; do not trust a client-supplied project ID, role claim or hidden UI state.

- **Developer owner / administrator** — final authority for projects, inventory, prices, CRM, users and publication.
- **Investment director** — portfolio, acquisition and approved financial/model access.
- **Project manager** — assigned project workspace, planning, documents and controlled reporting.
- **Sales / CRM manager** — assigned inventory, approved pricing and CRM workflows.
- **External adviser** — explicit, time-bounded document or workspace access only.

Every protected request requires a verified session and a project-level permission check. Price publication, inventory changes, role changes and exports must produce immutable audit events.

### Project permissions

Use a many-to-many `project_memberships` table with project roles or granular permissions. Access is deny-by-default and scoped to an explicit project. Public content is copied through an approved `project_publications` workflow rather than read from internal project records.

### HTML models

Register future HTML/JS models in `model_registry` with owner, project, category, version, integrity metadata, status and access policy. Serve each through an authenticated isolated route or sandbox/iframe with a strict content security policy. Inputs, scenarios and exports require server-side authorisation and audit logging; models must not receive broad database credentials.

### Sales website and CRM

The public website reads only a curated publication surface: approved project summary, availability labels and approved media. CRM and inventory systems remain private. Future synchronisation should use audited integration services with explicit field mapping, idempotency and approval states; public pages must never expose leads, unapproved prices or private inventory notes.

### Environment isolation and secrets

Use separate Neon branches/databases and separate Auth.js secrets for development, preview and production. Preview deployments use non-production demo or masked data and never share production write credentials. Store `DATABASE_URL`, direct migration URL, `AUTH_SECRET`, bootstrap tokens, storage keys and integration secrets in Vercel environment variables, scoped by environment. Never commit `.env` files, expose secret values to the client, or place secrets in model bundles. Rotate secrets on provider/personnel changes and record a production owner for every secret.

## Phase 2 implementation status

The repository now contains a Drizzle schema and migrations for `users`, `roles`, `user_roles`, `projects`, `project_memberships`, `model_registry`, `model_versions`, `audit_logs`, plus the Auth.js account/session/verification-token tables. IDs are UUIDs and operational tables include creation/update timestamps. The `users.password_hash` field stores only a salted scrypt hash. The migration seeds only the approved role vocabulary and the existing public 700 Project reference; it does not import people, financials, inventory, CRM data or documents.

Auth.js is configured for first-party credential sessions with JWTs. There is no public registration and no Google OAuth dependency. Login is fail-closed: an active user must supply a valid password hash, hold a role and have explicit project membership. The one-time initializer only accepts the email supplied through Vercel environment variables, requires a separate bootstrap token and an 8-character minimum password, records an audit event, assigns management access to active projects, and refuses once a Super Admin already exists. An existing Super Admin can create the optional second Super Admin through the authenticated admin interface.

The Neon Marketplace integration is connected to the `grandharmony` Vercel project on the Free plan. It supplies encrypted `GH_DATABASE_URL` and related `GH_*` variables to Development, Preview and Production. The server accepts `GH_DATABASE_URL` directly, while `DATABASE_URL` remains an optional compatible alias for local development. Required remaining Vercel variables are documented in `.env.example`: `AUTH_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_TOKEN`. Configure them in Vercel only, separately for Production and Preview. After `vercel env pull .env.local --environment=production`, run `npm run db:migrate`; the script explicitly reads the downloaded `.env.local` file.

## Phase 3A — model scenarios

The Model Library uses `model_registry` for the stable model identity and `model_versions` for immutable version labels. `model_scenarios` stores the current private working state as JSONB, with its model version, optional project scope, creator/updater, archive state and monotonic revision number. Every create and save also writes a snapshot to `scenario_revisions`; revisions are never overwritten. Scenario access is checked server-side on every read, save and archive operation using the authenticated role and project membership. Super Admin and Management can manage scenarios in their authorised projects; Finance is limited to financial models, Project Manager to authorised project models, and External Agent is denied internal model access.

Models implement a platform adapter boundary: `getState()`, `setState(state)`, `validateState(state)` and `getPrintData()`. The platform validates serialisable state size before storage and never accepts database instructions from a model or iframe message. Future standalone HTML models should run inside a sandboxed iframe with an explicit origin allow-list and postMessage schema validation; the current test adapter is rendered directly only to prove scenario persistence without inventing business formulas. The runner’s print stylesheet removes portal controls and uses browser Print / Save as PDF; adapter print data declares portrait or landscape output.

## Phase 3B — approved HTML model integration

The owner supplied `Grand_Harmony_700_Feasibility.html`, which is registered under stable model key `700-development-feasibility`, project `700 Project`, category Development Feasibility, version `1.0.0`. The original asset is stored unchanged in a server-only dependency graph (`feasibility-source.ts`); its SHA-256 is `1fa29c486952f49cc64836b290c1d06a21919225ef152639a1ac5bdcb2a17d72`. Registration uses the existing schema, is idempotent and happens on the first authorised Super Admin library request. No schema migration or account/scenario deletion is needed.

An authenticated, project-authorised `/api/models/[modelId]/document` endpoint delivers this reviewed HTML with private/no-store headers. The original asset is excluded from public client bundles. The renderer uses a sandboxed srcdoc iframe with scripts and model confirmation dialogs only; it has no same-origin, popup, form, top navigation or network capability. Its opaque origin is exactly `null`: parent-side message validation additionally requires the exact iframe Window, cryptographically generated instance ID, model UUID, schema version and an allowed response type. The child verifies the exact parent origin and Window plus those identifiers and allowed request type. The parent uses `*` only when targeting this identified opaque-origin frame; no secret or session information is sent. No message is a database command.

The adapter captures the original complete state (`fields`, `gst`, `tax`, `finance`, dynamic `costs`) and computed results using the original `calculate()` function. Restore re-renders and recomputes; a result mismatch is rejected and the previous state is restored. Browser local saves/exports are replaced by the platform toolbar. No DOM-only input scraping is used. Numeric values retain the original JavaScript precision and are not reformatted before storage. The original model's own rounding and calculation limitations remain unchanged.

Scenario create/save and audit/revision writes now use Neon transactional batches. Revision uniqueness and an optimistic revision condition protect concurrent writes. An older-version scenario cannot overwrite its original in a newer version; Save As is required after explicit compatibility review. Model/scenario URL parameters and revision-history requests are checked on the server. Private scenario ownership and authorised administrative scope remain enforced.

For the next model, supply complete HTML/CSS/JS/assets and a version. Review dependencies and the full internal state, register a new immutable adapter/version, implement asynchronous getState/setState/validateState/getPrintData, add deterministic formula/state regression tests, and permit it in the authenticated document endpoint. Never auto-execute an arbitrary uploaded HTML or assume DOM fields represent all business state.

## Phase 3C — Portal-native presentation

The current **700 Development Feasibility model is fully Portal-native in the active runner**. It no longer displays an iframe or legacy standalone page. The audited original HTML remains unchanged as a reference, and the Phase 3B protected document endpoint/bridge remains available as compatibility infrastructure, not as the current presentation path. No current registered model requires an iframe for its active UI.

The native engine in `feasibility-engine.ts` copies the original `calculate()` body verbatim into a pure function with an explicit state argument. The numeric conversion helper and sensitivity price rounding remain unchanged. Original defaults are a server-loaded module and are supplied only to the authenticated runner; the client formula module contains no private scenario or default project financial data. `FeasibilityCanvas` exposes the same asynchronous state/print adapter contract, validates restore state and recalculated expected results, and renders controlled native forms, editable/dynamic cost rows, tax/GST/funding assumptions, outputs and sensitivity charts.

No model ID, adapter key, model version ID, schema or saved scenario shape is changed. Existing Phase 3B JSONB scenarios (including saved `__results`) are unpacked by the existing scenario runner and restored by the native adapter. Scenario actions, RBAC, private ownership, atomic revision writes and version/conflict checks are retained.

`ModelShell` is reusable presentation infrastructure independent of business formulas. The common runner owns save/open/rename/duplicate/history/archive/print and Focus controls. Native models own input/output components and pure state/calculation functions. View changes keep the canvas mounted so Sidebar, Focus and workspace tabs do not discard edits.

### Mandatory future import workflow

1. Audit original inputs, outputs, tables, chart logic, dependencies, formulas, internal state and complete save state.
2. Prefer Portal-native integration using reusable Portal forms/cards/tables/tabs. Use the isolated iframe bridge only for a documented temporary complexity constraint.
3. Register a stable ID, immutable calculation version, project scope, category and description.
4. Present inside the unified Shell. Discard legacy logo/header/font/skin/navigation; business logic and data structure are the assets.
5. Reuse the existing server-authorised scenario lifecycle and PDF output. Preserve prior version/state compatibility explicitly.
6. Compare every key result with the source model, test dynamic rows and JSON round-trip, and verify project/owner isolation. Mark browser checks that cannot be executed as Pending User Acceptance.
