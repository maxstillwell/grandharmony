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

Use separate Neon branches/databases and separate Auth.js credentials for development, preview and production. Preview deployments use non-production demo or masked data and never share production write credentials. Store `DATABASE_URL`, direct migration URL, `AUTH_SECRET`, OAuth client secrets, storage keys and integration secrets in Vercel environment variables, scoped by environment. Never commit `.env` files, expose secret values to the client, or place secrets in model bundles. Rotate secrets on provider/personnel changes and record a production owner for every secret.

## Phase 2 implementation status

The repository now contains a Drizzle schema and migration for `users`, `roles`, `user_roles`, `projects`, `project_memberships`, `model_registry`, `model_versions`, `audit_logs`, plus the Auth.js account/session/verification-token tables. IDs are UUIDs and operational tables include creation/update timestamps. The migration seeds only the approved role vocabulary and the existing public 700 Project reference; it does not import people, financials, inventory, CRM data or documents.

Auth.js is configured for Google OAuth with JWT sessions. Login is fail-closed: a Google identity must match an active database user with a role and explicit project membership. An exception exists only for the one-time bootstrap identity supplied through Vercel environment variables, which can visit the protected initializer and create the first Super Admin. The initializer requires both the approved bootstrap email and a separate bootstrap token, records an audit event, assigns management access to active projects, and refuses once a Super Admin already exists.

Required Vercel environment variables are documented in `.env.example`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_TOKEN`. Configure them in Vercel only, separately for Production and Preview. Run `npm run db:migrate` only with the intended environment's database URL.
