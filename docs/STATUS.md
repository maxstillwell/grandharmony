# Status

## Phase 2 — implementation awaiting migration and protected administrator setup

Phase 2 source implementation adds a fail-closed authentication, database and RBAC foundation. Neon is connected, but the migration and protected administrator setup still need completion before it can safely replace Production.

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
- Database migration generation passed. The Neon connection is present only as an encrypted Vercel integration variable; the managed workspace cannot retrieve it for a direct migration command, so the migration has not yet been run.
- Production deployment intentionally deferred pending external configuration and authentication security checks.

### Known test environment limitation

The managed build environment does not permit binding a local port (`next dev` fails with `EPERM`), so desktop/mobile browser emulation cannot run locally. Responsive layouts were reviewed from their Tailwind breakpoints and production route smoke tests will be performed after deployment.

## Known limits

- Neon is connected to the Vercel project on its Free plan. It injects encrypted `GH_DATABASE_URL`/`GH_*` integration variables into Development, Preview and Production; the application now supports that connection name without copying a secret.
- A database migration must still be executed through an authorised Neon/Vercel workflow and then verified before release.
- `AUTH_SECRET`, `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_TOKEN` have not been supplied through Vercel Environment Variables. No Google Cloud or OAuth Client is required.
- Current Production remains on the previously working Phase 1.5 release; it has not been changed by this Phase 2 code.
