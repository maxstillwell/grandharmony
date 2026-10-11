# Status

## Phase 2 — deployed; first administrator initialization pending

Phase 2 source implementation adds a fail-closed authentication, database and RBAC foundation. Neon is connected, the migration has been verified, the required protected administrator variables exist in Production, and the authenticated Portal has been deployed.

### Completed in the working tree

- Drizzle ORM schema and generated migrations for users, roles, project memberships, model registry/versioning and audit logs, including a password-hash field.
- Auth.js credentials login with a fail-closed authorization check; no public registration or third-party social login exists.
- Server-side Portal and Super Admin guards, one-time protected password bootstrap, optional second Super Admin creation, role/project assignment actions and audit logging.
- Authenticated project workspace and model registry routes; existing `/demo/portal` remains untouched as an explicit demonstration.
- `.env.example`, migration scripts and Phase 2 architecture/roadmap documentation.

### Verification

- ESLint passed
- TypeScript validation passed
- Production build passed with protected Portal, login, admin, Auth.js and project workspace routes.
- Database migration generation passed. The migration was applied from the authorised local Vercel environment and verified in Neon: `users`, `roles`, `projects`, `project_memberships`, `model_registry`, `model_versions` and `audit_logs` exist.
- Production deployment succeeded from commit `49adf3fbffcc4cfe3fd655430c272d06eee39368`: https://grandharmony.vercel.app
- Online smoke checks passed: `/`, `/login`, `/admin/initialize` and `/demo/portal` return 200; unauthenticated `/portal` is redirected server-side to `/login`.

### Known test environment limitation

The managed build environment does not permit binding a local port (`next dev` fails with `EPERM`), so desktop/mobile browser emulation cannot run locally. Responsive layouts were reviewed from their Tailwind breakpoints and production route smoke tests will be performed after deployment.

## Known limits

- Neon is connected to the Vercel project on its Free plan. It injects encrypted `GH_DATABASE_URL`/`GH_*` integration variables into Development, Preview and Production; the application now supports that connection name without copying a secret.
- `AUTH_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_TOKEN` are configured only in Vercel Production; no Google Cloud or OAuth Client is required.
- The initial Super Admin has not yet set a password. Complete the one-time protected setup at `/admin/initialize`, then verify a successful login and use `/admin` to create the optional second Super Admin.
