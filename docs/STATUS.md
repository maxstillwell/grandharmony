# Status

## Phase 1.5 — complete

This phase upgrades the production-quality corporate website and extends the safe Portal Demo without adding a database, authentication, CRM, private data or executable models.

### Completed

- Corporate website quality pass: responsive layout review, focus-visible navigation treatment, semantic metadata, Open Graph metadata, robots policy, sitemap and SVG favicon.
- Contact remains deliberately inactive and does not expose an unconfirmed email address.
- Portal Demo includes 700 Project workspace navigation, project selector, project overview, models and tools registry, recent demonstration activity, quick access and compact financial/planning placeholders.
- Every dashboard value is labelled as demo, placeholder or not integrated; there is no claim of live financial, inventory, CRM or model data.
- Future Neon/Auth.js/RBAC, project permissions, model integration, CRM publication and environment-isolation design is documented in `docs/architecture.md`.

### Verification

- ESLint passed
- TypeScript validation passed
- Production build passed
- Build generated `/`, `/portal`, `/demo/portal`, project detail, favicon, robots and sitemap routes successfully
- Source implementation commit: `813142e` (`feat: complete phase 1.5 quality and portal demo`)
- Release documentation commit: `116acc6` (`docs: record phase 1.5 verification plan`)
- Vercel production deployment: `https://grandharmony.vercel.app` — READY
- Production smoke test passed: `/`, `/projects/700-project`, `/portal`, `/demo/portal`, `/robots.txt`, `/sitemap.xml` and `/icon.svg` returned HTTP 200.

### Known test environment limitation

The managed build environment does not permit binding a local port (`next dev` fails with `EPERM`), so desktop/mobile browser emulation cannot run locally. Responsive layouts were reviewed from their Tailwind breakpoints and production route smoke tests will be performed after deployment.

## Known limits

- Placeholder Unsplash imagery must be replaced with approved licensed media before a final public launch.
- Official contact details and a secure enquiry provider are not configured.
- `/portal` contains no authentication or private data; `/demo/portal` is illustrative only.
- Neon, Auth.js, project permissions, models, documents, inventory and CRM remain design-only future work.
