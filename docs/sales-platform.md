# Sales platform implementation and release gates

## Scope and architecture

The existing Grand Harmony Portal remains the owner of inventory, confidential prices and CRM. The existing Golfview application consumes only a v1 publication API on its server. It has no Neon connection or business-table credential. No production records, stages, prices or architectural geometry are seeded.

The branch started at `5aa1750bc081a9f3a89c02c32fc41649fedcfd6a` and contains current production main `c91dfa7f2d5cedc5a644f2edf77bedd21cc82010`. Original model adapters, corporate content and Website Management remain in place. Global role selection now uses a deterministic priority. Sales and model permissions also enforce the project membership role, preventing a global finance/management role from upgrading an external-agent project assignment.

Sales writes use `lib/sales/db.ts`, a Neon WebSocket Pool and the Drizzle transactional driver, against the **same** `DATABASE_URL`/`GH_DATABASE_URL`. Existing modules retain their original database driver. The existing HTTP driver does not implement interactive `transaction()`; do not substitute it for the sales transaction connection.

## Implemented vertical slices

- Project-scoped inventory creation/editing with optimistic revisions, original source provenance, stored validation warnings, decimal areas, room counts and approved public asset references.
- Separate construction and sales release registers. Two construction stages and four releases can be configured independently. Stage names/allocations are not invented.
- Planned-capacity enforcement (set 47 for Golfview), project-scoped unique numbers, rejection of fictional TEST identifiers, blank CSV template, add-only dry-run/import, atomic capacity/duplicate validation and CSV export.
- Validated status transitions, reason, actor and timestamp history. No status edit changes the public website.
- Separate confidential pricing table: asking/minimum/contract/deposit/settlement amounts, due dates, AUD and GST treatment. Amounts remain decimal strings; financial totals are computed using PostgreSQL numeric sums. Public asking price and its inclusion flag have a separate permission and approval path.
- Immutable publication payloads: draft, exact JSON preview, canonical SHA-256 approval, atomic current-publication pointer, actor history and rollback by creating a new approval-required revision. The database trigger also prevents payload mutation. Ordinary inventory saves cannot publish.
- Project- and assignment-scoped CRM, customer contact preferences, privacy/marketing consent, unit links, internal/external assignments, notes, interaction history, follow-up dates, search/filter and authorised export. Reassignment preserves the developer-owned record and all previous activity.
- Public v1 GET and dedicated token-authenticated enquiry POST; stored consent, honeypot validation and PostgreSQL-backed five-per-15-minute client limits. The token grants ingestion only. No email service is required for durable storage.
- Functional Sales Management UI under `/portal/projects/[projectId]/sales`, linked from the existing project workspace. Missing schema/connection produces a clear readiness state, not fabricated inventory.

## Permission boundaries

Both a recognised global role and an appropriate active-project membership are required. `canManage` alone never grants sales privileges.

| Project role | Inventory edit/status | Confidential prices | CRM | Approve/publish |
| --- | --- | --- | --- | --- |
| super_admin, management | Yes | View/edit | View/edit/assign/export | Yes |
| project_manager | Yes | No | View/edit/assign/export | No |
| sales_manager | Yes | No | View/edit/assign/export | No |
| finance | Read only | View/edit | No | No |
| external_agent | Published snapshot only | No | Assigned records only; no reassignment/export | No |

Project/sales managers may edit a **draft public price**, which still requires publisher approval before disclosure. External agents cannot load internal units, publication drafts, source provenance or confidential prices. Shared audit metadata omits customer text and price values; lead activity is available only through the lead's authorisation scope.

## Public contract and enquiry channel

`GET /api/public/v1/sales/{publicKey}` returns `contractVersion`, `projectKey`, `revision`, approved `units` and enquiry privacy configuration. Missing publications return zero units. A failed connection/missing schema returns a safe empty envelope with HTTP 503. Neither case returns draft inventory.

Public fields are explicitly projected: stable unit UUID, display number, approved type/status/specifications, independent stage labels, presentation price and approved asset references. Private prices, CRM, notes, source documents and user IDs never enter snapshots.

`POST /api/public/v1/sales/{publicKey}/enquiries` requires a dedicated bearer credential of at least 32 characters plus a server-derived client hash. Golfview's same-origin `/api/enquiries` proxy validates the request, derives the HMAC client key from Vercel's forwarded client address, and forwards only known form fields. The backend validates again and stores the lead/activity/audit in one transaction. A shared fallback limit applies when a trusted client address is unavailable. Marketing consent is separate and defaults to false.

Never enable enquiries until the owner's full project privacy notice is approved, the matching token is configured in both existing projects, and the complete storage path is verified. No CAPTCHA, email, storage or CRM subscription has been installed.

## Migration state — production NOT verified

`0000` through `0004_handy_morlun.sql` were preserved unchanged. Presence in Git is **not** evidence of application to Neon. The execution environment has no `DATABASE_URL`, `GH_DATABASE_URL` or Auth.js credentials, and no Neon connector. Therefore live schema, migration journal and the suspected 0004 discrepancy remain unverified. No production SQL or data change has been made.

New migration: `drizzle/0005_sales_platform.sql`, with `0005_snapshot.json` and a new journal entry. It creates nine sales tables and three sales enums, plus indexes, checks, foreign keys and an immutable-payload trigger. It contains no drop, truncate or modification to existing Portal tables. Unique indexes deliberately precede composite foreign keys; the generated default order failed PostgreSQL validation and was corrected.

The complete migration chain was applied to an ephemeral in-memory PostgreSQL engine (PGlite) for integration tests. This is test storage only, not another hosted or authoritative database. Neon driver connectivity and a real Neon branch rehearsal remain unverified.

Run `npm run db:status` with a controlled existing-database connection. This command is read-only: it reports observed tables/columns and compares migration file hashes with `drizzle.__drizzle_migrations`. It does not automatically repair missing journal entries or partially applied SQL. Missing credentials cause exit 2, explicitly unverified.

Before release:

1. Obtain controlled access to the existing Neon project and inspect the live schema/journal, especially 0004 and its two share tables. Permit the selected existing Neon host in the development environment network policy if needed.
2. Resolve any schema/journal mismatch with evidence; do not blindly mark 0004 applied or rerun it against existing objects.
3. Confirm a Neon restore point/recovery procedure and rehearse the reviewed additive migration against an isolated branch of the existing project. Do not provision another database.
4. Apply the exact reviewed migration only after these checks. Record its SHA-256, execution time, database branch and postflight result. `npm run db:migrate` remains the existing migration command; never use an unreviewed `drizzle push` shortcut.
5. Verify real Auth.js roles/memberships and authenticated desktop/mobile operations with test accounts, then release the backend branch. Do not merge until migration/compatibility checks pass.
6. Configure a sales project on the existing 700 Project record: planned count 47, independently confirmed stages, public key `golfview`. Import only an approved Unit Schedule, then preview/approve/publish explicitly.
7. Configure Golfview's `GOLFVIEW_PUBLIC_DATA_URL` to the released HTTPS v1 endpoint. Configure matching ingestion credentials directly in the existing Vercel projects, then verify enquiry persistence and privacy before enabling the form.

Recovery: leave existing Portal data intact. If the application release fails, redeploy the previous application commit and keep the additive sales schema/data for diagnosis. If publication content needs reverting, use the approval-required snapshot rollback. Do not roll back by dropping sales tables or deleting buyer records. Backup restore and Neon branch recovery require operator verification before production migration; they have not been exercised here.

## Verification and limits

Supported commands: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run db:status`.

Automated coverage includes actual PostgreSQL migrations/constraints, 47-unit import, independent stages, optimistic concurrency, permission and project isolation, status workflow/history, confidential price exclusion, approval/digest/rollback, transactional audit-failure recovery, agent reassignment, consent/rate limits and the **actual public route handlers** reading approved snapshots and persisting enquiries.

Local production HTTP checks verify unauthenticated Portal/CRM export redirects, denied ingestion without the token, missing-schema safe responses, and Golfview's disabled form, same-origin policy and test-route 404s. No authenticated production account, browser automation or live Neon connection was available. A successful build/preview does not establish live CRM operation. Frontend integration must remain fail-closed until the release gates above are met.
