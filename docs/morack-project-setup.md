# GOLFVIEW — frontend and backend setup

Official project name: GOLFVIEW. Internal reference: 700 Project (Vermont South).
Target structure: independent `maxstillwell/golfview` repository + independent Vercel project `golfview`; existing `maxstillwell/grandharmony` repository and its Portal; one Neon database with isolated public access.

## Provisioning as of 2026-10-31
- Vercel project **golfview** created: `prj_ZuNaTx1DaSBI6kk6IUSgMLKnfbDV`, Vercel team `team_uz00skMNo5QcnakBUYe8ZuVl`.
- Site is not deployed and the GitHub repo is not connected yet.
- GitHub connected tool supports commits to an existing repository but not repository creation; create a private GitHub repository named `golfview` under `maxstillwell`, then link it to the existing Vercel project. Do not create another Vercel project.
- Grand Harmony working branch: `feature/700-sales-platform-foundation`. Prototype: `app/demo/700-explorer/page.tsx` and `components/sales/site-plan-explorer.tsx`. Protected placeholder management route: `/portal/projects/[projectId]/sales`. Do not merge prototype test data into production sales inventory.
- Do not share production Neon write credentials with Golfview site. Grant only SELECT on published DTO/view using restricted DB role or adopt narrow read-only service; require an explicit publication approval event.
- No paid storage, custom domain, production data migrations or public sales launch authorised.

## Build order
1. Create GitHub `maxstillwell/golfview` repository; Next.js App Router foundation + UI and tests.
2. Link existing Vercel Golfview project to repo; enable branch previews, deployment protection and Node version with active stable Next.js compatibility.
3. Build public marketing shell and 2D explorer using segregated fixture data; later connect public published DTO only.
4. Review live Neon schema (including pending 0004 migration), create additive unit, stages, media, publishing and CRM migrations on a safe Neon branch.
5. Implement real inventory CRUD, sales permissions, audit, draft-preview-publish in Grand Harmony Portal.
6. Load official architect Plan and Unit Schedule with dry-run import and 47-unit uniqueness check; only thereafter publish approved content.
7. Integrate external 3D renders and approved brochures/specifications.

## Important constraints
- No fictional public pricing, areas, approved statuses, or land contours.
- Sales publishing and status update are distinct actions.
- Marketing consent is separate from submitting a sales enquiry.
- Real buyer enquiry form should remain disabled until privacy notice, spam controls and secure server-side handling are ready.
