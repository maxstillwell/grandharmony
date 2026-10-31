# Sales platform — current development workflow

Work directly on `main`, validate and deploy through the existing Vercel Production project. The owner explicitly superseded the earlier staging/draft-PR gates. See `AGENTS.md`. No additional infrastructure is required.

## Database verification and release

- Existing Neon project: `shiny-tooth-37334133`, production branch `br-royal-firefly-a7acoiq6` (`main`), database `neondb`.
- Read-only inspection verified migrations 0000–0004 and their required tables, columns, indexes and constraints. Historical hashes for 0000/0002/0003/0004 match CRLF variants of the repository SQL; no migration records were rewritten and no old SQL was rerun.
- Production recovery snapshot before the additive migration: `snap-ancient-wave-a7v1nfac`, created 2026-10-31 03:00:20 UTC (14:00:20 Sydney). The project also has a six-hour history retention window. Restore is a recovery operation requiring deliberate operator review; normal application rollback does not drop sales tables.
- Applied `0005_sales_platform.sql` atomically to the production branch. SHA-256: `04dcdd4871fb7ecc992c540738bf9d10ea91ca08574dcc431702e941c0878684`. Postflight verified nine sales tables, checks, indexes, foreign keys, immutable snapshot trigger and the matching journal record. Existing user/project/model-scenario/website-revision row counts were unchanged.
- The existing 700 Project has sales key `golfview`, planned capacity 47, and enquiries disabled. No official units, prices or stages have been invented.

## Implemented behavior

Inventory, independent construction/release stages, exact-decimal prices, status history, source provenance/warnings, dry-run CSV imports and scoped exports are managed in the existing Portal. Project/global roles are checked on reads and mutations. External agents receive assigned CRM records and approved publication data only.

Drafts are immutable public projections. Preview, approval, publication and rollback are separate actions; publishing atomically changes the current snapshot pointer. Inventory edits never publish automatically. Private prices, CRM, source documents and internal notes stay outside the public contract.

The public endpoint is `/api/public/v1/sales/golfview`. Golfview consumes it on the server. Enquiries remain disabled until approved privacy wording, dedicated credentials and actual CRM persistence have been verified.

## Checks and recovery

Run lint, typecheck, tests and production build before pushing main. `npm run db:status` uses READ ONLY Neon transactions and reports raw hashes, CRLF equivalence and observed objects. It never applies migrations or repairs journal records.

For application rollback, redeploy the previous application commit while retaining additive sales tables and business records. For content rollback, restore a previous approved publication into a new approval-required revision. Use the recorded Neon snapshot/history only for a database incident, after assessing subsequent writes. Never reset or drop business data as a routine rollback.

Earlier feature/Preview work was stopped at the owner's workflow change. Its test records and credentials were not copied into production. Existing test/recovery branches remain untouched and are not release dependencies.

## Production transaction validation — 31 October 2026 (Sydney)

Owner-authorised synthetic inventory, exact-decimal private prices, CRM lead assignment/follow-up and activity CRUD passed against the existing production database. Assertions also verified stale revision rejection and the negative-price constraint. All synthetic writes were inside a deliberately rolled-back PL/pgSQL subtransaction, followed by outer transaction ROLLBACK. An independent subsequent connection confirmed inventory/leads/private prices/events/publications all remained at zero and enquiries stayed disabled. No users, existing business data or publication pointers were changed.

This verifies live SQL constraints and transaction behavior, not authenticated Portal/browser operations or the application's service-layer permission checks. Those remain covered by automated service tests and require a legitimate existing login for live UI acceptance. No session was forged or password reset.
