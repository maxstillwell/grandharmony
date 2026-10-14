# Roadmap

## Phase 1 — foundation complete

- Corporate website and public project detail pattern
- Safe portal holding page and non-confidential UI demonstration
- Architectural Capital visual system and baseline documentation

## Phase 1.5 — complete

- Corporate responsive-quality pass, semantic metadata, sitemap, robots policy and SVG favicon
- Improved keyboard focus treatment and explicit inactive contact path
- 700 Project dashboard demo, workspace navigation, project selector, model library, activity feed, quick access and compact placeholder registers
- Future Neon PostgreSQL, Auth.js, RBAC, model, CRM and environment-isolation architecture documented

## Phase 2 — deployed; operational initialization pending

- Drizzle schema, repeatable migrations, fail-closed Auth.js credentials login, server-side RBAC guards, protected password bootstrap and admin access-management interface are implemented in source.
- Neon Marketplace is connected on the Free plan and supplies encrypted `GH_DATABASE_URL` variables to Vercel.
- Public registration and third-party social login are intentionally excluded. The first Super Admin must be created through the one-time protected bootstrap; an existing Super Admin can create the optional second administrator.
- Neon migration and protected bootstrap variables are configured. Production is deployed; complete the one-time Super Admin setup and login verification before giving any other users access.

## Phase 3A — user accepted

- Reusable Model Library, server-authorised Model Runner, JSONB scenario storage, revision history, archive actions, unsaved-change warning and browser print framework are implemented in source.
- A `Scenario State Test Model` is the only seeded model. It explicitly contains no financial formula or business data and validates saving, reopening, Save As and print flows.
- The owner confirmed Save, Save As, restore, revision history, archive and print acceptance in the Phase 3B instructions.

## Phase 3B — unified workspace and real feasibility model

- Shared persisted collapsible Sidebar, in-place Focus Mode, guarded scenario URLs and stable model toolbar.
- Reviewed 700 Development Feasibility HTML integrated with a sandboxed, message-validated full-state adapter and recomputation checks.
- Existing scenario database reused; registration is automatic and idempotent, requiring no manual migration.
- Automated formula/state, message-security and permission regressions pass. Authenticated online Save/Save As/reload, collapse/focus interactions and actual PDF layout remain Pending User Acceptance.
- Further models and broad version migrations await the next owner instruction.

## Phase 3C — Portal visual refinement and native model standard

- Warm-white Portal visual system with restrained stone accents, editorial headings and very faint abstract line details applied to Model Library, Model Runner and Project Workspace.
- Reusable Model Shell and workspace/scenario/history tabs; Sidebar persistence and in-place Focus remain.
- 700 Development Feasibility is now rendered by native Portal inputs, editable costs, results, assumptions and chart components. Its original calculation body, data structure and scenario versions remain compatible.
- Six regression tests pass, including exact original/native output comparison across 64 assumption combinations and their sensitivity ranges.
- No database migration, deletion or new dependency is required.
- Final production visual/browser acceptance remains with the owner. Do not begin another phase without instruction.

## Phase 4A — corporate redesign and Website Management

- Redesigned public corporate home around the approved “Built on Experience. Driven by Vision.” architecture-led hero, approved company copy, experience, construction, expertise, team, selected-development and verified-contact-safe sections.
- Added a Super Admin-only `/portal/website` module and protected `/portal/website/preview` draft preview. Structured Hero, copy, visibility, Team and Development gallery fields are versioned as a private website draft.
- Added safe revision/publish/restore schema and server-side publish actions. Published public content is revalidated without a code deployment; drafts are not public.
- Added a media metadata registry schema. Vercel Blob upload/replacement/deletion remains blocked until an owner explicitly connects a Blob Store and provides the integration environment variable; this avoids an unapproved paid storage activation.
- The `0003_sudden_proteus.sql` migration must be applied to Neon before the authenticated management UI becomes operational. Existing public fallback and all Portal/model tables remain unaffected.

## Phase 4A.2 — Website Management acceptance and usability

- Reorganise Website Management into clear Portal-native modules: Overview, Hero, Page Content, Team, Developments, and Preview & Publish.
- Keep the draft → preview → publish → restore flow private until an explicit publish action. Show a real version/status summary, explicit success/failure feedback and browser-exit unsaved-change protection.
- Permit only approved existing static images for public Team/Development cards while Blob remains intentionally disconnected; image upload and arbitrary external media URLs remain unavailable.
- Verify the Super Admin server guard, transactional publish/cache invalidation and existing model regression tests. Final authenticated browser acceptance remains an owner task because no administrator credential is used by automation.

## Model Library — generic tools and specifications

- Retire the Phase 3 generic Scenario State Test Model from the active Model Library without deleting historical/audit rows.
- Register Development Feasibility and Interactive Specification as general reusable library tools; associate a selected project with each saved scenario rather than permanently attaching the model to a project.
- Render the owner-supplied Interactive Specification as a Portal-native schedule. Each item supports Confirmed, To confirm or Optional status and item-level reference images that print in the generated report.
- Keep image uploads out of scope without Blob. HTTPS reference URLs are user-provided internal working references and remain subject to licensing and final project approval.

## Later Phase 2 work — deferred

- Controlled public-content publishing workflow and model registry operations
- Secure documents, real financial models, inventory, CRM and sales integrations
- Contact submission service after a secure provider and official contact channel are approved
- Replace temporary Unsplash images with approved licensed imagery
