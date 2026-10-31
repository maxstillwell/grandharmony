import { assertScope, demoUnit } from "./workspace-scope";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { PortalAccess } from "../auth/access";
import * as s from "../db/schema";
import type { SalesDb } from "./db";
import { assertSales, canSales, isAgent } from "./permissions";
import { createSalesService, recordSalesEvent } from "./service";
import { dateOrNull, decimal, record, text, validId } from "./domain";
import {
  assertLifecycleTransition,
  cents,
  contractInput,
  contractTransitions,
  identifier,
  offerInput,
  offerTransitions,
  positive,
  reservationInput,
  reservationTransitions,
} from "./lifecycle-domain";

type Tx = Parameters<Parameters<SalesDb["transaction"]>[0]>[0];
const tables = {
  offer: s.salesOffers,
  reservation: s.salesReservations,
  contract: s.salesContracts,
};
export type TransactionKind = keyof typeof tables;
export function lifecycleEnabled(projectId: string) {
  return (
    process.env.SALES_LIFECYCLE_ENABLED === "true" &&
    (process.env.SALES_LIFECYCLE_PROJECT_IDS ?? "")
      .split(",")
      .map((s) => s.trim())
      .includes(projectId)
  );
}
async function member(tx: Tx, projectId: string, id: string | null) {
  if (!id) return;
  const [m] = await tx
    .select({ id: s.users.id })
    .from(s.projectMemberships)
    .innerJoin(s.users, eq(s.users.id, s.projectMemberships.userId))
    .where(
      and(
        eq(s.projectMemberships.projectId, projectId),
        eq(s.projectMemberships.userId, id),
        eq(s.users.isActive, true),
      ),
    );
  if (!m) throw Error("Assignee must be an active member of this project.");
}
async function linked(
  tx: Tx,
  projectId: string,
  unitId: string,
  leadId: string,
  agentId: string | null,
  scopeKey = "real",
  access?: PortalAccess,
) {
  const [unit] = await tx
    .select()
    .from(s.salesUnits)
    .where(
      and(eq(s.salesUnits.projectId, projectId), eq(s.salesUnits.id, unitId)),
    )
    .for("update");
  const [lead] = await tx
    .select()
    .from(s.salesLeads)
    .where(
      and(
        eq(s.salesLeads.projectId, projectId),
        eq(s.salesLeads.scopeKey, scopeKey),
        eq(s.salesLeads.id, leadId),
      ),
    );
  if (!unit || !lead)
    throw Error("Residence and buyer must belong to this project.");
  await member(tx, projectId, agentId);
  return scopeKey !== "real" && access
    ? await demoUnit(
        tx as unknown as SalesDb,
        access,
        projectId,
        scopeKey,
        unitId,
      )
    : unit;
}
async function reference(
  tx: Tx,
  projectId: string,
  id: string | null,
  kind: "offer" | "reservation",
  unitId: string,
  leadId: string,
  scopeKey = "real",
) {
  if (!id) return;
  const t = tables[kind];
  const [r] = await tx
    .select()
    .from(t)
    .where(
      and(eq(t.projectId, projectId), eq(t.scopeKey, scopeKey), eq(t.id, id)),
    );
  if (!r || r.unitId !== unitId || r.leadId !== leadId)
    throw Error("Related transaction belongs to another residence or buyer.");
}
async function audit(
  tx: Tx,
  projectId: string,
  actor: string,
  kind: string,
  id: string,
  unitId: string | null,
  leadId: string | null,
  details: Record<string, unknown> = {},
  scopeKey = "real",
) {
  await recordSalesEvent(
    tx,
    projectId,
    actor,
    `lifecycle.${kind}`,
    { ...(unitId ? { unitId } : {}), ...(leadId ? { leadId } : {}) },
    { lifecycleId: id, ...details },
    scopeKey,
  );
}
function expected(current: number, value: unknown) {
  if (!Number.isInteger(Number(value)) || Number(value) !== current)
    throw Error("Record changed. Reload before saving.");
}
export function createLifecycleService(db: SalesDb, scopeKey = "real") {
  const scopedAudit: typeof audit = (tx, p, a, k, id, u, l, details = {}) =>
    audit(tx, p, a, k, id, u, l, details, scopeKey);
  return {
    async workspace(access: PortalAccess, projectId: string) {
      assertScope(access, projectId, scopeKey);
      assertSales(access, projectId, "deals.view");
      if (isAgent(access, projectId))
        throw Error("Internal transaction access only.");
      const offers = await db
        .select()
        .from(s.salesOffers)
        .where(
          and(
            eq(s.salesOffers.projectId, projectId),
            eq(s.salesOffers.scopeKey, scopeKey),
          ),
        )
        .orderBy(desc(s.salesOffers.updatedAt));
      const reservations = await db
        .select()
        .from(s.salesReservations)
        .where(
          and(
            eq(s.salesReservations.projectId, projectId),
            eq(s.salesReservations.scopeKey, scopeKey),
          ),
        )
        .orderBy(desc(s.salesReservations.updatedAt));
      const raw = await db
        .select()
        .from(s.salesContracts)
        .where(
          and(
            eq(s.salesContracts.projectId, projectId),
            eq(s.salesContracts.scopeKey, scopeKey),
          ),
        )
        .orderBy(desc(s.salesContracts.updatedAt));
      const contracts = canSales(access, projectId, "prices.view")
        ? raw
        : raw.map((r) => ({
            ...r,
            contractPrice: null,
            depositAmount: null,
            depositReceivedAmount: null,
            settlementReceivedAmount: null,
            notes: null,
            documentReference: null,
            receiptReference: null,
            depositPercentage: null,
            depositDueAt: null,
            financeCondition: null,
            otherConditions: null,
            solicitorName: null,
            solicitorEmail: null,
            solicitorPhone: null,
          }));
      const profiles = canSales(access, projectId, "crm.view")
        ? await db
            .select()
            .from(s.salesBuyerProfiles)
            .where(
              and(
                eq(s.salesBuyerProfiles.projectId, projectId),
                eq(s.salesBuyerProfiles.scopeKey, scopeKey),
              ),
            )
        : [];
      const [settings] = await db
        .select()
        .from(s.salesLifecycleSettings)
        .where(
          and(
            eq(s.salesLifecycleSettings.projectId, projectId),
            eq(s.salesLifecycleSettings.scopeKey, scopeKey),
          ),
        );
      const history = canSales(access, projectId, "audit.view")
        ? await db
            .select()
            .from(s.salesEvents)
            .where(
              and(
                and(
                  eq(s.salesEvents.projectId, projectId),
                  eq(s.salesEvents.scopeKey, scopeKey),
                ),
                sql`${s.salesEvents.action} like 'lifecycle.%'`,
              ),
            )
            .orderBy(desc(s.salesEvents.createdAt))
            .limit(300)
        : [];
      return {
        offers,
        reservations,
        contracts,
        profiles,
        settings: settings ?? null,
        history: canSales(access, projectId, "prices.view")
          ? history
          : history.map((e) =>
              e.action.startsWith("lifecycle.contract.")
                ? {
                    ...e,
                    details: {
                      lifecycleId: e.details.lifecycleId,
                      from: e.details.from,
                      to: e.details.to,
                      revision: e.details.revision,
                    },
                  }
                : e,
            ),
      };
    },
    async save(
      access: PortalAccess,
      projectId: string,
      kind: TransactionKind,
      input: unknown,
    ) {
      assertSales(
        access,
        projectId,
        kind === "contract" ? "contracts.edit" : "deals.edit",
      );
      assertScope(access, projectId, scopeKey);
      const row = record(input),
        t = tables[kind];
      return db.transaction(async (tx) => {
        if (scopeKey !== "real")
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${projectId + ":" + scopeKey}))`,
          );
        const previous = row.id
          ? (
              await tx
                .select()
                .from(t)
                .where(
                  and(
                    and(eq(t.projectId, projectId), eq(t.scopeKey, scopeKey)),
                    eq(t.id, identifier(row.id)!),
                  ),
                )
                .for("update")
            )[0]
          : undefined;
        if (row.id && !previous)
          throw Error("Transaction was not found in this project.");
        if (previous) {
          expected(previous.revision, row.revision);
          if (previous.status !== "draft")
            throw Error(
              "Only drafts can be edited. Use a recorded transition or receipt.",
            );
        }
        const parsed =
          kind === "offer"
            ? offerInput(row)
            : kind === "reservation"
              ? reservationInput(row)
              : contractInput(row);
        if (parsed.agentId !== (previous?.agentId ?? null))
          assertSales(access, projectId, "leads.assign");
        if (
          previous &&
          (parsed.unitId !== previous.unitId ||
            parsed.leadId !== previous.leadId)
        )
          throw Error(
            "Existing transaction buyer and residence cannot be reassigned.",
          );
        await linked(
          tx,
          projectId,
          parsed.unitId,
          parsed.leadId,
          parsed.agentId,
          scopeKey,
          access,
        );
        if (kind !== "offer")
          await reference(
            tx,
            projectId,
            (parsed as ReturnType<typeof reservationInput>).offerId,
            "offer",
            parsed.unitId,
            parsed.leadId,
            scopeKey,
          );
        if (kind === "contract") {
          const c = parsed as ReturnType<typeof contractInput>,
            old = previous as typeof s.salesContracts.$inferSelect | undefined;
          await reference(
            tx,
            projectId,
            c.reservationId,
            "reservation",
            c.unitId,
            c.leadId,
            scopeKey,
          );
          if (
            row.contractPrice !== undefined ||
            row.depositAmount !== undefined
          ) {
            assertSales(access, projectId, "prices.edit");
          }
          if (old) {
            if (row.contractPrice === undefined)
              c.contractPrice = old.contractPrice;
            if (row.depositAmount === undefined)
              c.depositAmount = old.depositAmount;
          }
          if (!canSales(access, projectId, "prices.view")) {
            if (row.documentReference || row.notes)
              throw Error("Private contract details require financial access.");
            c.documentReference = old?.documentReference ?? null;
            c.notes = old?.notes ?? null;
            c.depositPercentage = old?.depositPercentage ?? null;
            c.depositDueAt = old?.depositDueAt ?? null;
            c.financeCondition = old?.financeCondition ?? null;
            c.otherConditions = old?.otherConditions ?? null;
            c.solicitorName = old?.solicitorName ?? null;
            c.solicitorEmail = old?.solicitorEmail ?? null;
            c.solicitorPhone = old?.solicitorPhone ?? null;
          }
          if (
            c.contractPrice &&
            c.depositAmount &&
            cents(c.depositAmount) > cents(c.contractPrice)
          )
            throw Error("Deposit exceeds contract price.");
        }
        const values = {
          ...parsed,
          projectId,
          scopeKey,
          updatedByUserId: access.userId,
        };
        let id: string;
        if (previous) {
          await tx
            .update(t)
            .set({
              ...values,
              revision: previous.revision + 1,
              updatedAt: new Date(),
            })
            .where(eq(t.id, previous.id));
          id = previous.id;
        } else {
          id = (
            await tx
              .insert(t)
              .values({
                ...values,
                createdByUserId: access.userId,
              } as typeof s.salesOffers.$inferInsert)
              .returning({ id: t.id })
          )[0].id;
        }
        await scopedAudit(
          tx,
          projectId,
          access.userId,
          `${kind}.${previous ? "edited" : "created"}`,
          id,
          parsed.unitId,
          parsed.leadId,
          { revision: (previous?.revision ?? 0) + 1 },
        );
        return id;
      });
    },
    async transition(
      access: PortalAccess,
      projectId: string,
      kind: TransactionKind,
      id: string,
      input: unknown,
    ) {
      assertScope(access, projectId, scopeKey);
      const row = record(input),
        to = String(row.status),
        t = tables[kind];
      assertSales(
        access,
        projectId,
        kind === "contract" ? "contracts.edit" : "deals.edit",
      );
      return db.transaction(async (tx) => {
        if (scopeKey !== "real")
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${projectId + ":" + scopeKey}))`,
          );
        const [r] = await tx
          .select()
          .from(t)
          .where(
            and(
              and(eq(t.projectId, projectId), eq(t.scopeKey, scopeKey)),
              eq(t.id, identifier(id)!),
            ),
          )
          .for("update");
        if (!r) throw Error("Transaction not found.");
        expected(r.revision, row.revision);
        assertLifecycleTransition(
          r.status,
          to,
          kind === "offer"
            ? offerTransitions
            : kind === "reservation"
              ? reservationTransitions
              : contractTransitions,
          row,
        );
        if (kind === "reservation" && to === "expired") {
          const expiry = (r as typeof s.salesReservations.$inferSelect)
            .expiresAt;
          if (!expiry || expiry > new Date())
            throw Error(
              "Reservation cannot be marked expired before its recorded expiry. Use a manual cancellation or release instead.",
            );
        }
        const unit = await linked(
          tx,
          projectId,
          r.unitId,
          r.leadId,
          r.agentId,
          scopeKey,
          access,
        );
        const approval =
          (kind === "offer" &&
            (["accepted", "rejected"].includes(to) ||
              r.status === "accepted")) ||
          (kind === "reservation" && to === "active") ||
          (kind === "contract" && (to !== "cancelled" || r.status !== "draft"));
        if (approval) assertSales(access, projectId, "deals.approve");
        if (
          kind === "offer" &&
          to === "submitted" &&
          !(r as typeof s.salesOffers.$inferSelect).offeredAt
        )
          throw Error("Offer date is required before submission.");
        if (
          (kind === "offer" && to === "accepted") ||
          (kind === "reservation" && to === "active")
        ) {
          if (
            !["not_released", "available", "on_hold", "reserved"].includes(
              unit.status,
            )
          )
            throw Error(
              "Inventory status does not permit a new offer acceptance or hold.",
            );
          if (
            (
              await tx
                .select({ id: s.salesContracts.id })
                .from(s.salesContracts)
                .where(
                  and(
                    and(
                      eq(s.salesContracts.projectId, projectId),
                      eq(s.salesContracts.scopeKey, scopeKey),
                    ),
                    eq(s.salesContracts.unitId, r.unitId),
                    inArray(s.salesContracts.status, [
                      "signed",
                      "conditional",
                      "unconditional",
                    ]),
                  ),
                )
            ).length
          )
            throw Error("An active contract already exists.");
          const active = await tx
            .select()
            .from(s.salesReservations)
            .where(
              and(
                and(
                  eq(s.salesReservations.projectId, projectId),
                  eq(s.salesReservations.scopeKey, scopeKey),
                ),
                eq(s.salesReservations.unitId, r.unitId),
                eq(s.salesReservations.status, "active"),
              ),
            );
          if (
            active.some((a) =>
              kind === "reservation" ? a.id !== id : a.leadId !== r.leadId,
            )
          )
            throw Error("Conflicting active reservation.");
        }
        if (
          kind === "reservation" &&
          to === "active" &&
          !(r as typeof s.salesReservations.$inferSelect).startsAt
        )
          throw Error(
            "Enter an explicit reservation start; no duration or expiry is assumed.",
          );
        if (kind === "contract" && to === "signed") {
          const c = r as typeof s.salesContracts.$inferSelect;
          if (
            !c.contractDate ||
            !c.contractPrice ||
            cents(c.contractPrice) <= 0n ||
            !c.documentReference
          )
            throw Error(
              "Contract date, explicit agreed price and private document reference are required.",
            );
          if (c.contractDate > new Date())
            throw Error("A future contract cannot be recorded as signed.");
          if (["settled", "withdrawn"].includes(unit.status))
            throw Error("Inventory status does not permit contract signing.");
          const conflicting = await tx
            .select()
            .from(s.salesReservations)
            .where(
              and(
                and(
                  eq(s.salesReservations.projectId, projectId),
                  eq(s.salesReservations.scopeKey, scopeKey),
                ),
                eq(s.salesReservations.unitId, r.unitId),
                eq(s.salesReservations.status, "active"),
              ),
            );
          if (conflicting.some((a) => a.leadId !== r.leadId))
            throw Error("Another buyer has an active reservation.");
          assertSales(access, projectId, "prices.edit");
          if (scopeKey !== "real") {
            const current = await demoUnit(
              tx as unknown as SalesDb,
              access,
              projectId,
              scopeKey,
              unit.id,
            );
            expected(current.revision, row.unitRevision);
            if (current.contractPrice !== null)
              throw Error(
                "An existing demo contract price needs reconciliation.",
              );
            await tx
              .update(s.salesDemoUnitState)
              .set({
                contractPrice: c.contractPrice,
                depositAmount: c.depositAmount,
                revision: current.revision + 1,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(s.salesDemoUnitState.projectId, projectId),
                  eq(s.salesDemoUnitState.scopeKey, scopeKey),
                  eq(s.salesDemoUnitState.unitId, unit.id),
                ),
              );
          } else {
            const [privatePrices] = await tx
              .select()
              .from(s.salesPrivatePrices)
              .where(eq(s.salesPrivatePrices.unitId, unit.id));
            if (
              privatePrices?.contractPrice !== null &&
              privatePrices?.contractPrice !== undefined
            )
              throw Error(
                "Existing canonical contract price requires reconciliation before registering another contract.",
              );
            if (
              privatePrices?.depositAmount &&
              privatePrices.depositAmount !== c.depositAmount
            )
              throw Error(
                "Existing deposit target must be reconciled before signing.",
              );
            expected(unit.revision, row.unitRevision);
            await createSalesService(tx as unknown as SalesDb).savePrices(
              access,
              projectId,
              unit.id,
              unit.revision,
              {
                ...privatePrices,
                contractPrice: c.contractPrice,
                depositAmount: c.depositAmount,
              },
            );
          }
        }
        let actualSettlementAt: Date | null | undefined;
        if (kind === "contract" && to === "completed") {
          actualSettlementAt = dateOrNull(row.actualSettlementAt);
          if (!actualSettlementAt || actualSettlementAt > new Date())
            throw Error(
              "Actual settlement date is required and cannot be in the future.",
            );
          const c = r as typeof s.salesContracts.$inferSelect;
          if (c.contractDate && actualSettlementAt < c.contractDate)
            throw Error("Settlement cannot precede contract date.");
        }
        // Inventory changes are a separate, explicit operator choice, never an automatic rule.
        if (row.syncInventory === true) {
          const target =
            kind === "reservation" && to === "active"
              ? "reserved"
              : kind === "contract" && to === "signed"
                ? "contract_signed"
                : kind === "contract" && to === "unconditional"
                  ? "unconditional"
                  : kind === "contract" && to === "completed"
                    ? "settled"
                    : null;
          if (!target)
            throw Error(
              "No automatic inventory mapping for this action. Use the inventory workflow.",
            );
          const revision =
            kind === "contract" && to === "signed"
              ? unit.revision + 1
              : unit.revision;
          expected(unit.revision, row.unitRevision);
          await createSalesService(
            tx as unknown as SalesDb,
            scopeKey,
          ).changeStatus(
            access,
            projectId,
            unit.id,
            revision,
            target,
            String(row.reason),
          );
        }
        await tx
          .update(t)
          .set({
            status: to,
            revision: r.revision + 1,
            updatedAt: new Date(),
            updatedByUserId: access.userId,
            ...(actualSettlementAt ? { actualSettlementAt } : {}),
            ...(kind === "contract" && to === "unconditional"
              ? { unconditionalAt: new Date() }
              : {}),
          })
          .where(eq(t.id, id));
        await scopedAudit(
          tx,
          projectId,
          access.userId,
          `${kind}.status`,
          id,
          r.unitId,
          r.leadId,
          {
            from: r.status,
            to,
            reason: String(row.reason),
            revision: r.revision + 1,
          },
        );
        return id;
      });
    },
    async receipt(
      access: PortalAccess,
      projectId: string,
      id: string,
      input: unknown,
    ) {
      assertScope(access, projectId, scopeKey);
      assertSales(access, projectId, "settlement.edit");
      assertSales(access, projectId, "prices.edit");
      const row = record(input);
      if (row.confirm !== true)
        throw Error("Confirm the receipt was actually received.");
      const value = positive(row.amount)!,
        receivedAt = dateOrNull(row.receivedAt),
        receiptReference = text(row.receiptReference, 1000, true);
      if (!receivedAt) throw Error("Actual receipt date is required.");
      if (!["deposit", "settlement"].includes(String(row.kind)))
        throw Error("Invalid receipt kind.");
      return db.transaction(async (tx) => {
        if (scopeKey !== "real")
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${projectId + ":" + scopeKey}))`,
          );
        const [c] = await tx
          .select()
          .from(s.salesContracts)
          .where(
            and(
              and(
                eq(s.salesContracts.projectId, projectId),
                eq(s.salesContracts.scopeKey, scopeKey),
              ),
              eq(s.salesContracts.id, identifier(id)!),
            ),
          )
          .for("update");
        if (
          !c ||
          !["signed", "conditional", "unconditional", "completed"].includes(
            c.status,
          )
        )
          throw Error("Receipts require a recorded signed contract.");
        expected(c.revision, row.revision);
        if (receivedAt > new Date())
          throw Error("A future payment cannot be recorded as received.");
        const deposit =
            row.kind === "deposit" ? value : c.depositReceivedAmount,
          settlement =
            row.kind === "settlement" ? value : c.settlementReceivedAmount;
        if (cents(deposit) + cents(settlement) > cents(c.contractPrice))
          throw Error("Confirmed receipts exceed the recorded contract price.");
        if (
          cents(value) <
          cents(
            row.kind === "deposit"
              ? c.depositReceivedAmount
              : c.settlementReceivedAmount,
          )
        )
          throw Error(
            "Receipt totals cannot be reduced through this workflow. Record a separate approved correction.",
          );
        const oldTotal =
          row.kind === "deposit"
            ? c.depositReceivedAmount
            : c.settlementReceivedAmount;
        const delta = cents(value) - cents(oldTotal);
        if (delta > 0n)
          await tx.insert(s.salesCashEntries).values({
            projectId,
            scopeKey,
            contractId: id,
            category: String(row.kind),
            amount: `${delta / 100n}.${String(delta % 100n).padStart(2, "0")}`,
            receivedAt,
            reference: receiptReference!,
            reason: "Confirmed receipt recorded",
            actorUserId: access.userId,
          });
        await tx
          .update(s.salesContracts)
          .set({
            ...(row.kind === "deposit"
              ? { depositReceivedAmount: value, depositReceivedAt: receivedAt }
              : {
                  settlementReceivedAmount: value,
                  settlementReceivedAt: receivedAt,
                }),
            receiptReference,
            revision: c.revision + 1,
            updatedAt: new Date(),
            updatedByUserId: access.userId,
          })
          .where(eq(s.salesContracts.id, id));
        await scopedAudit(
          tx,
          projectId,
          access.userId,
          "contract.receipt",
          id,
          c.unitId,
          c.leadId,
          {
            kind: String(row.kind),
            revision: c.revision + 1,
            receipt: {
              total: value,
              receivedAt: receivedAt.toISOString(),
              reference: receiptReference,
            },
          },
        );
        return id;
      });
    },
    async buyerProfile(
      access: PortalAccess,
      projectId: string,
      input: unknown,
    ) {
      assertScope(access, projectId, scopeKey);
      assertSales(access, projectId, "crm.edit");
      assertSales(access, projectId, "deals.view");
      const r = record(input),
        leadId = identifier(r.leadId)!;
      const budgetMin = decimal(r.budgetMin),
        budgetMax = decimal(r.budgetMax),
        preferredBedrooms =
          r.preferredBedrooms === "" || r.preferredBedrooms == null
            ? null
            : Number(r.preferredBedrooms);
      if (
        preferredBedrooms !== null &&
        (!Number.isInteger(preferredBedrooms) ||
          preferredBedrooms < 0 ||
          preferredBedrooms > 99)
      )
        throw Error("Invalid bedroom preference.");
      if (budgetMin && budgetMax && cents(budgetMin) > cents(budgetMax))
        throw Error("Budget range is reversed.");
      return db.transaction(async (tx) => {
        if (scopeKey !== "real")
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${projectId + ":" + scopeKey}))`,
          );
        const [lead] = await tx
          .select()
          .from(s.salesLeads)
          .where(
            and(
              and(
                eq(s.salesLeads.projectId, projectId),
                eq(s.salesLeads.scopeKey, scopeKey),
              ),
              eq(s.salesLeads.id, leadId),
            ),
          )
          .for("update");
        if (!lead) throw Error("Buyer is not in this project.");
        const [old] = await tx
          .select()
          .from(s.salesBuyerProfiles)
          .where(eq(s.salesBuyerProfiles.leadId, leadId));
        if (old) expected(old.revision, r.revision);
        else if (r.revision && Number(r.revision) !== 0)
          throw Error("Profile changed. Reload.");
        await tx
          .insert(s.salesBuyerProfiles)
          .values({
            projectId,
            scopeKey,
            leadId,
            budgetMin,
            budgetMax,
            preferredBedrooms,
            preferredTypes: String(r.preferredTypes ?? "")
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean)
              .slice(0, 20),
            nextAction: text(r.nextAction, 2000),
            updatedByUserId: access.userId,
          })
          .onConflictDoUpdate({
            target: s.salesBuyerProfiles.leadId,
            set: {
              budgetMin,
              budgetMax,
              preferredBedrooms,
              preferredTypes: String(r.preferredTypes ?? "")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 20),
              nextAction: text(r.nextAction, 2000),
              revision: (old?.revision ?? 0) + 1,
              updatedByUserId: access.userId,
              updatedAt: new Date(),
            },
          });
        await scopedAudit(
          tx,
          projectId,
          access.userId,
          "buyer.preferences",
          leadId,
          null,
          leadId,
        );
        return leadId;
      });
    },
    async policy(access: PortalAccess, projectId: string, input: unknown) {
      assertScope(access, projectId, scopeKey);
      assertSales(access, projectId, "settings.edit");
      const r = record(input);
      if (r.automationEnabled === true)
        throw Error("Automated reservation or offer rules are not approved.");
      const hours =
        r.proposedDurationHours === "" || r.proposedDurationHours == null
          ? null
          : Number(r.proposedDurationHours);
      if (hours !== null && (!Number.isInteger(hours) || hours <= 0))
        throw Error("Invalid draft duration.");
      const values = {
        proposedDurationHours: hours,
        proposedReservationFee: decimal(r.proposedReservationFee),
        automationEnabled: false,
        notes: text(r.notes, 2000),
        updatedByUserId: access.userId,
      };
      return db.transaction(async (tx) => {
        if (scopeKey !== "real")
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${projectId + ":" + scopeKey}))`,
          );
        await tx
          .select({ id: s.projects.id })
          .from(s.projects)
          .where(eq(s.projects.id, projectId))
          .for("update");
        await tx
          .insert(s.salesLifecycleSettings)
          .values({ projectId, scopeKey, ...values })
          .onConflictDoUpdate({
            target: [
              s.salesLifecycleSettings.projectId,
              s.salesLifecycleSettings.scopeKey,
            ],
            set: { ...values, updatedAt: new Date() },
          });
        await scopedAudit(
          tx,
          projectId,
          access.userId,
          "settings.draft",
          projectId,
          null,
          null,
        );
      });
    },
  };
}
export type LifecycleData = Awaited<
  ReturnType<ReturnType<typeof createLifecycleService>["workspace"]>
>;
