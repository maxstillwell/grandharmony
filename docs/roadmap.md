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

## Phase 2 — implementation awaiting protected setup

- Drizzle schema, repeatable migrations, fail-closed Auth.js credentials login, server-side RBAC guards, protected password bootstrap and admin access-management interface are implemented in source.
- Neon Marketplace is connected on the Free plan and supplies encrypted `GH_DATABASE_URL` variables to Vercel.
- Public registration and third-party social login are intentionally excluded. The first Super Admin must be created through the one-time protected bootstrap; an existing Super Admin can create the optional second administrator.
- Do not deploy the authenticated portal until the Neon migration and protected bootstrap variables are configured and security-tested.

## Later Phase 2 work — deferred

- Controlled public-content publishing workflow and model registry operations
- Secure documents, real financial models, inventory, CRM and sales integrations
- Contact submission service after a secure provider and official contact channel are approved
- Replace temporary Unsplash images with approved licensed imagery
