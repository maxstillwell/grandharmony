# Status

## Phase 2 — implementation blocked on Neon and Google OAuth configuration

Phase 2 source implementation adds a fail-closed authentication, database and RBAC foundation. It is not deployed because the required Neon database and Google OAuth configuration have not been authorised/configured.

### Completed in the working tree

- Drizzle ORM schema and generated migration for users, roles, project memberships, model registry/versioning and audit logs, including Auth.js tables.
- Auth.js Google OAuth route with a fail-closed sign-in callback; missing database/OAuth configuration grants no access.
- Server-side Portal and Super Admin guards, one-time protected administrator bootstrap, role/project assignment actions and audit logging.
- Authenticated project workspace and model registry routes; existing `/demo/portal` remains untouched as an explicit demonstration.
- `.env.example`, migration scripts and Phase 2 architecture/roadmap documentation.

### Verification

- ESLint passed
- TypeScript validation passed
- Production build passed with protected Portal, login, admin, Auth.js and project workspace routes.
- Database migration generation passed; migration was not run because no database is configured.
- Production deployment intentionally deferred pending external configuration and authentication security checks.

### Known test environment limitation

The managed build environment does not permit binding a local port (`next dev` fails with `EPERM`), so desktop/mobile browser emulation cannot run locally. Responsive layouts were reviewed from their Tailwind breakpoints and production route smoke tests will be performed after deployment.

## Known limits

- No Neon integration, `DATABASE_URL` or other project environment variables exist on Vercel yet.
- Neon Free Plan/region setup requires user completion because the available plan identifier and Marketplace account authorisation could not be safely determined by the CLI.
- Google OAuth Client ID/Secret, redirect URI and protected bootstrap values have not been supplied through Vercel Environment Variables.
- Current Production remains on the previously working Phase 1.5 release; it has not been changed by this Phase 2 code.
