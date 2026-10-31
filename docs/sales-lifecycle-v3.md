# Activation update

0006 is now owner-authorised and applied to Production. Golfview internal lifecycle activation is configured. All existing inventory/private prices remain unchanged. The original gated-foundation report below is historical; it no longer requests migration approval. Automation and public publishing remain separate and inactive.

# Sales Management V3 — implemented foundation, inactive Production transactions

V2 was completed first at `04ea5cc324589f679457013807517e6c5e44af9c`: sortable independent inventory/price columns, functional modal Open/Actions, RBAC and map synchronisation. V3 retains those functions and the original 47 residences/private prices.

## Live without a migration

Existing Inventory, Map, CRM, pricing, releases, audit, publication and settings remain on the existing schema. CRM now supports follow-up due/scheduled/unscheduled filters and ordering, source/agent context, and direct buyer-to-residence navigation that opens the existing detail modal and map selection. The top-level project selector remains unchanged. Pricing / Releases reuses the existing stage editor; Publishing remains a separate approval workflow.

Transaction navigation and an explicit inactive state are safe to release. Without activation flags, the server page does not query any new table and transaction actions return before opening a database connection. No fabricated zero transaction counts or test records are presented as Production facts. External agents receive no lifecycle payload or navigation; their existing assigned CRM access remains unchanged.

## Implemented and verified on isolated PGlite; gated in Production

- **Offers:** project/unit/buyer/agent references, explicit AUD amount and dates, optional expiry, conditions, private document reference and notes; multiple historical offers; draft/submitted/accepted/rejected/withdrawn transitions; management acceptance/rejection with confirmation and reason. No automatic signed contract or inventory sale.
- **Reservations:** drafts, explicit start/optional expiry, agent, buyer, optional matching offer, notes, active/cancelled/released/expired states, per-unit conflict prevention and database uniqueness. No default duration/fee or automatic expiry/cancellation. Cancellation does not silently release inventory.
- **Contracts:** separate draft/register, explicit price/date/document evidence, deposit target, expected/actual settlement dates, agent, buyer, related offer/hold, notes and lifecycle history. Signing requires management approval, financial edit permission, confirmation and current inventory revision. It uses the existing confidential pricing service, preserving asking/minimum/GST/due-date values. Existing canonical contract/deposit amounts require reconciliation before replacement. No asking-to-contract copying and no generated legal agreements.
- **Receipts/settlement:** cumulative confirmed deposit and settlement receipts with actual dates and private evidence; exact decimal totals; contractual amounts separated from cash; outstanding known deposit targets and contract balances; unknown targets identified; overdue expected settlements and explicit completion. Receipts cannot exceed the entered contract total or be reduced by this workflow. Cancelled-contract receipts remain recorded; no refunds are inferred. No banking/payment execution or unapproved cash forecast.
- **Buyer preferences:** supplied bedroom/budget range/next action with record revisions; existing CRM contact/consent/agent and multi-unit interest remain canonical. Buyer offers link to Deals; residence details link back to scoped offers/contracts/settlement.
- **Draft policy proposals:** optional duration/fee proposal and review notes; neither is used as an operational default. Automation is false in both application and database constraints.

Every mutation reuses project membership/role intersections, explicit action permissions, canonical inventory UUIDs, revisions, transactions and the existing audit writer. An optional, separately selected inventory synchronisation uses only the existing valid status transitions. An invalid step rolls back transaction state, prices, revisions and audit together. Public Golfview availability still changes only through its separate snapshot approval/publication process; buyer enquiries remain disabled.

Transaction records and internal inventory have deliberately distinct states. Recording an offer, hold or signed-document fact does not imply authority to change inventory or public availability. Operators must explicitly select an allowed inventory step or complete it in Inventory. This coupling policy requires owner review before activation.

## Privacy and roles

No new identities or authentication are introduced. New capabilities extend the existing `canSales` role/membership intersection:

| Existing role | Transaction capability |
| --- | --- |
| Super Admin / management | Drafts, management transitions, financial register/receipts, policy proposals |
| Project manager / sales manager | Offers/holds and nonfinancial contract draft metadata; management approval still required; confidential developer/contract values excluded |
| Finance | Financial register preparation and confirmed receipt tracking; no management acceptance/signature approval or automatic CRM access |
| External agent | No V3 access by default; existing assigned lead access only |

Server responses redact confidential contract amounts, private contract notes/document/receipt references from users without price access. Blind metadata edits preserve redacted fields. Agent reassignment requires existing assignment permission. Shared audit logs contain identifiers, not private amounts. Protected lifecycle events hold receipt evidence; core CRM activity explicitly excludes lifecycle events so assigned external agents cannot retrieve receipt/contract data through the old lead endpoint. Public APIs and ordinary inventory exports remain unchanged.

## Migration and activation

`drizzle/0006_sales_lifecycle.sql` prepares five additive tables: buyer profiles, offers, reservations, contracts and draft policies. It adds same-project/matching-unit-and-buyer foreign keys, date/amount/state checks, one-active-hold/contract indexes and project/buyer/settlement indexes. No existing business rows or columns are rewritten. The ORM snapshot registers the new table/column model; hand-authored SQL additionally governs composite integrity checks/partial indexes and must remain part of migration review. Do not use destructive schema push.

**This migration has not been applied to Neon Production.** The owner explicitly withheld Production schema approval in this assignment. See `sales-lifecycle-0006-review.md` for the concrete review/activation checklist. All business mutation entry points require both `SALES_LIFECYCLE_ENABLED=true` and the project UUID in `SALES_LIFECYCLE_PROJECT_IDS`; neither is configured for Production. No activation or reservation automation was performed.

## Verification and limits

Evidence/screenshots under `sales-v3-verification/` come from a loopback browser application invoking the actual services on isolated PGlite, clearly labelled synthetic. The harness/API/reset exist only in a disposable temporary app generated by `scripts/sales-lifecycle-harness.mjs`; no test route is deployed in the production app. Tests cover offers, conflict/cancellation, signatures, receipt/date/amount validation, settlement, CRM associations, record/project/role isolation, audit privacy, default-off writes, atomic rollback and a populated 47-record migration preservation case. V2 sorting/pricing/Open/Actions and original inventory/import regressions also run.

Authenticated live browser acceptance remains pending; no share links, new access credentials or authentication bypass were used. Refund/correction ledgers, legal-document signing/upload/storage, banking, automatic expiry, maker/checker dual approval, and payment forecasts are not activated. Transactions require approved schema and activation policy first. The current contract cancellation path retains canonical historical financial values; reconciliation/amendment/refund rules require owner decisions rather than silent overwrites.
