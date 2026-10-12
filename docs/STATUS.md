# Status

## Phase 3A — implementation awaiting Neon migration and authenticated lifecycle test

Phase 2 remains deployed. Phase 3A adds a reusable Model Library and Scenario Management foundation, but is not yet deployed because the new scenario tables must be migrated and tested through an authenticated user.

### Completed in the working tree

- Drizzle ORM schema and generated migrations for users, roles, project memberships, model registry/versioning and audit logs, including a password-hash field.
- Auth.js credentials login with a fail-closed authorization check; no public registration or third-party social login exists.
- Server-side Portal and Super Admin guards, one-time protected password bootstrap, optional second Super Admin creation, role/project assignment actions and audit logging.
- Authenticated project workspace and model registry routes; existing `/demo/portal` remains untouched as an explicit demonstration.
- `.env.example`, migration scripts and Phase 2 architecture/roadmap documentation.
- Phase 3A Model Library filters, server-authorised Model Runner, private JSONB scenarios, Save, Save As, archive, revision snapshots, print stylesheet and test adapter.

### Verification

- ESLint passed
- TypeScript validation passed
- Production build passed with protected Portal, login, admin, Auth.js and project workspace routes.
- Database migration generation passed. The migration was applied from the authorised local Vercel environment and verified in Neon: `users`, `roles`, `projects`, `project_memberships`, `model_registry`, `model_versions` and `audit_logs` exist.
- Production deployment succeeded from commit `49adf3fbffcc4cfe3fd655430c272d06eee39368`: https://grandharmony.vercel.app
- Online smoke checks passed: `/`, `/login`, `/admin/initialize` and `/demo/portal` return 200; unauthenticated `/portal` is redirected server-side to `/login`.
- Phase 3A lint, TypeScript, production build, generated migration and Drizzle history check passed locally. An authenticated save/restore test is pending database migration and deployment.

### Known test environment limitation

The managed build environment does not permit binding a local port (`next dev` fails with `EPERM`), so desktop/mobile browser emulation cannot run locally. Responsive layouts were reviewed from their Tailwind breakpoints and production route smoke tests will be performed after deployment.

## Known limits

- Neon is connected to the Vercel project on its Free plan. It injects encrypted `GH_DATABASE_URL`/`GH_*` integration variables into Development, Preview and Production; the application now supports that connection name without copying a secret.
- `AUTH_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_TOKEN` are configured only in Vercel Production; no Google Cloud or OAuth Client is required.
- The initial Super Admin has not yet set a password. Complete the one-time protected setup at `/admin/initialize`, then verify a successful login and use `/admin` to create the optional second Super Admin.
- Phase 3A is intentionally not yet deployed. No real HTML model was found; only the non-financial test adapter will be seeded by the pending migration.
