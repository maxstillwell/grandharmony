# 0006 owner review — not a Production migration approval

The current assignment says: **“Do NOT apply new schema migrations to Neon Production without explicit owner approval.”** Accordingly this release prepares/tests the migration and keeps transaction entry inactive. Earlier general migration authorisation does not override this specific instruction.

Review files: `drizzle/0006_sales_lifecycle.sql`, `drizzle/meta/0006_snapshot.json`, `lib/sales/lifecycle-service.ts` and `sales-lifecycle-v3.md`.

## Concrete schema change

- Adds `sales_buyer_profiles`, `sales_offers`, `sales_reservations`, `sales_contracts`, `sales_lifecycle_settings`.
- Adds a unique `(project_id,id)` lead index for composite references; the existing global lead primary key already ensures uniqueness.
- Protects cross-project/cross-buyer transaction links with composite foreign keys; one active reservation and one signed/unconditional contract per unit with partial unique indexes.
- Adds project/unit/status, offer buyer, profile project and expected-settlement indexes.
- Uses additive text-state checks instead of changing existing enums. Old inventory, lead and pricing columns are not altered; no records are seeded, imported, repriced, published or reclassified.
- Receipt/date/amount checks distinguish explicit evidence from missing information. All automation remains false; draft duration/fee have no default values or operational effect.

Creating the new lead index can briefly lock that existing table. Plan the approved operation accordingly. The isolated migration test populates the legacy schema with 47 units and prices, applies 0006, and verifies identical before/after records and empty new tables. Existing V2/CRM service tests continue to pass against the new schema.

## Decisions before activation

1. Approve the SQL and verify the current Production branch, schema/journal, retained restore window/recovery point and unchanged inventory/price/publication hashes.
2. Approve management roles allowed to accept/reject/sign/cancel; the implementation uses a management-role decision with explicit reason/confirmation, not mandatory different-person approval.
3. Approve transaction/inventory coupling. Current default is no inventory change; an operator may explicitly choose only an existing permitted step, atomically. Cancellation/release never assumes an inventory rollback.
4. Confirm reservation start/expiry/fee and offer-expiry handling. No duration, fee, auto cancellation or acceptance is active. Draft policy proposals do not apply rules.
5. Confirm whether unresolved Unit 1 design conflict should also prohibit internal transaction activation. Its existing public publication restriction is unchanged.
6. Decide amendment, cancellation reconciliation and refund/correction rules before using those financial edge cases. No existing agreed price is silently replaced, no confirmed receipt is silently reduced and cancellation does not imply a refund.

Only after explicit schema approval: apply the reviewed journal migration to the existing Neon Production main through the established authorised workflow, verify constraints/indexes and data hashes, then obtain approval for activation of the intended project. Production identifiers remain `shiny-tooth-37334133` / `br-royal-firefly-a7acoiq6`; Golfview is `44290fcb-17c7-4677-9053-d7402b10f863`.

Only after explicit activation approval: configure `SALES_LIFECYCLE_ENABLED=true` and `SALES_LIFECYCLE_PROJECT_IDS=44290fcb-17c7-4677-9053-d7402b10f863` on the existing project/Production environment, redeploy and complete owner-authenticated acceptance. No new project, database, credentials, public share or Preview environment is required.

## Rollback implications

The safe first response is to disable activation (flag false/remove the project UUID), retaining all transaction data and existing inventory/CRM functionality. Do not drop new tables or reverse financial records after use. A code rollback can leave the additive tables in place. Any data recovery/forward repair needs a reviewed recovery point and a separately authorised procedure; this document is not permission to perform a destructive rollback.
