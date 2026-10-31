import {salesReport,type ReportFilter} from "./reporting";
import { parseBuyerImport } from "./crm-import";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { and, eq, desc, sql } from "drizzle-orm";
import type { PortalAccess } from "../auth/access";
import * as s from "../db/schema";
import type { SalesDb } from "./db";
import { assertSales, canSales } from "./permissions";
import { assertScope, demoUnit } from "./workspace-scope";
import { createSalesService, recordSalesEvent } from "./service";
import { createLifecycleService } from "./lifecycle-service";
import { amount, cents, identifier } from "./lifecycle-domain";
import { dateOrNull, decimal, record, text, csvExport } from "./domain";

function version(actual: number, input: unknown) {
  if (actual !== Number(input))
    throw Error("Record changed. Reload before saving.");
}
function percentage(input: unknown) {
  if (input == null || input === "") return null;
  const value = String(input);
  if (!/^(?:\d{1,3})(?:\.\d{1,4})?$/.test(value) || Number(value) > 100)
    throw Error(
      "Percentage must be between 0 and 100 with at most four decimals.",
    );
  return value;
}
function scale(input: string) {
  const [a, b = ""] = input.split(".");
  return BigInt(a) * 10000n + BigInt(b.padEnd(4, "0"));
}
export function commissionCalculation(
  price: string,
  agreement: {
    kind: string;
    rate: string | null;
    fixedAmount: string | null;
    gstTreatment: string;
    gstRate: string | null;
  },
) {
  const fee =
    agreement.kind === "fixed"
      ? cents(agreement.fixedAmount)
      : (cents(price) * scale(agreement.rate ?? "0") + 500000n) / 1000000n;
  if (fee < 0n) throw Error("Invalid commission amount.");
  const rate = agreement.gstRate ? scale(agreement.gstRate) : null;
  if (
    ["inclusive", "exclusive"].includes(agreement.gstTreatment) &&
    rate === null
  )
    throw Error("An explicit GST rate is required.");
  const gst =
    agreement.gstTreatment === "exclusive"
      ? (fee * rate! + 500000n) / 1000000n
      : agreement.gstTreatment === "inclusive"
        ? (fee * rate! + (1000000n + rate!) / 2n) / (1000000n + rate!)
        : null;
  return {
    estimatedAmount: amount(
      fee + (agreement.gstTreatment === "exclusive" ? gst! : 0n),
    ),
    gstAmount: gst === null ? null : amount(gst),
  };
}
export function createPlatformService(db: SalesDb, scopeKey = "real") {
  const where = (
    t: { projectId: AnyPgColumn; scopeKey: AnyPgColumn },
    pid: string,
  ) => and(eq(t.projectId, pid), eq(t.scopeKey, scopeKey));
  const audit = (
    tx: SalesDb,
    pid: string,
    access: PortalAccess,
    action: string,
    details: Record<string, unknown>,
    refs: { unitId?: string; leadId?: string } = {},
  ) =>
    recordSalesEvent(
      tx,
      pid,
      access.userId,
      `platform.${action}`,
      refs,
      details,
      scopeKey,
    );
  async function workspace(access: PortalAccess, pid: string) {
    assertScope(access, pid, scopeKey);
    assertSales(access, pid, "deals.view");
    const finance = canSales(access, pid, "prices.view");
    const agents = await db
      .select()
      .from(s.salesAgents)
      .where(where(s.salesAgents, pid));
    const agreements = finance
      ? await db
          .select()
          .from(s.salesCommissionAgreements)
          .where(where(s.salesCommissionAgreements, pid))
      : [];
    const commissions = finance
      ? await db
          .select()
          .from(s.salesCommissions)
          .where(where(s.salesCommissions, pid))
      : [];
    const cash = finance
      ? await db
          .select()
          .from(s.salesCashEntries)
          .where(where(s.salesCashEntries, pid))
          .orderBy(desc(s.salesCashEntries.createdAt))
      : [];
    const plans = await db
      .select()
      .from(s.salesReleasePlans)
      .where(where(s.salesReleasePlans, pid));
    const taskStates = await db
      .select()
      .from(s.salesTaskStates)
      .where(
        and(
          where(s.salesTaskStates, pid),
          eq(s.salesTaskStates.userId, access.userId),
        ),
      );
    return {
      agents,
      agreements,
      commissions,
      cash,
      plans: finance
        ? plans
        : plans.map((p) => ({ ...p, targetValue: null, pricingNote: null })),
      taskStates,
    };
  }
  async function execute(
    access: PortalAccess,
    pid: string,
    operation: string,
    input: unknown,
  ): Promise<unknown> {
    assertScope(access, pid, scopeKey);
    assertSales(access, pid, "deals.view");
    const r = record(input);
    if (operation === "reset") {
      if (scopeKey === "real" || r.confirm !== "RESET MY DEMO")
        throw Error(
          "Reset requires your own Demo mode and RESET MY DEMO confirmation.",
        );
      return db.transaction(async (tx) => {
        // Every scope mutation/reset takes this lock; reset cannot race a transaction insert.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${pid + ":" + scopeKey}))`,
        );
        for (const t of [
          s.salesResidenceMediaCurrent, s.salesResidenceMedia,
          s.salesTaskStates,
          s.salesCashEntries,
          s.salesCommissions,
          s.salesCommissionAgreements,
          s.salesAgents,
          s.salesContracts,
          s.salesReservations,
          s.salesOffers,
          s.salesBuyerProfiles,
          s.salesEvents,
          s.salesLeads,
          s.salesDemoUnitState,
          s.salesReleasePlans,
          s.salesLifecycleSettings,
        ])
          await tx.delete(t).where(where(t, pid));
        await audit(tx as unknown as SalesDb, pid, access, "demo.reset", {
          demo: true,
        });
        return true;
      });
    }
    if (operation === "task") {
      const taskKey = text(r.taskKey, 200, true)!,
        completedAt = r.complete === true ? new Date() : null,
        snoozedUntil = dateOrNull(r.snoozedUntil);
      await db
        .insert(s.salesTaskStates)
        .values({
          projectId: pid,
          scopeKey,
          userId: access.userId,
          taskKey,
          completedAt,
          snoozedUntil,
        })
        .onConflictDoUpdate({
          target: [
            s.salesTaskStates.projectId,
            s.salesTaskStates.scopeKey,
            s.salesTaskStates.userId,
            s.salesTaskStates.taskKey,
          ],
          set: { completedAt, snoozedUntil, updatedAt: new Date() },
        });
      return true;
    }
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${pid + ":" + scopeKey}))`,
      );
      const actor = { updatedByUserId: access.userId, updatedAt: new Date() },
        context = { projectId: pid, scopeKey };
      if (operation === "crmImport") {
        assertSales(access, pid, "crm.edit");
        assertSales(access, pid, "leads.assign");
        const rows = parseBuyerImport(r.csv),
          existing = await tx
            .select()
            .from(s.salesLeads)
            .where(where(s.salesLeads, pid)),
          emails = new Set(existing.map((l) => l.email.toLowerCase())),
          phones = new Set(
            existing
              .map((l) => (l.phone ?? "").replace(/[^0-9]/g, ""))
              .filter(Boolean),
          ),
          errors: string[] = [];
        rows.forEach((l, i) => {
          const email = l.email.toLowerCase(),
            phone = (l.phone ?? "").replace(/[^0-9]/g, "");
          if (emails.has(email) || (phone && phones.has(phone)))
            errors.push(
              `Row ${i + 2}: duplicate email or phone; update the existing buyer.`,
            );
          emails.add(email);
          if (phone) phones.add(phone);
        });
        if (r.commit !== true)
          return { count: rows.length, errors, committed: false };
        if (errors.length)
          throw Error(
            "Buyer import contains duplicates. Run validation and correct the CSV.",
          );
        for (const row of rows)
          await createSalesService(
            tx as unknown as SalesDb,
            scopeKey,
          ).createLead(access, pid, { ...row, consent: true });
        await audit(tx as unknown as SalesDb, pid, access, "crm.imported", {
          count: rows.length,
        });
        return { count: rows.length, errors: [], committed: true };
      }
      if (operation === "agent") {
        assertSales(access, pid, "leads.assign");
        const userId = identifier(r.userId)!;
        const [member] = await tx
          .select()
          .from(s.projectMemberships)
          .innerJoin(s.users, eq(s.users.id, s.projectMemberships.userId))
          .where(
            and(
              eq(s.projectMemberships.projectId, pid),
              eq(s.projectMemberships.userId, userId),
              eq(s.users.isActive, true),
            ),
          );
        if (!member)
          throw Error(
            "Choose an active existing project member. Identity and permissions remain managed in Administration.",
          );
        const values = {
          ...context,
          ...actor,
          userId,
          displayName: text(r.displayName, 200, true)!,
          company: text(r.company, 200),
          email: text(r.email, 254),
          phone: text(r.phone, 80),
          notes: text(r.notes, 4000),
        };
        const [old] = await tx
          .select()
          .from(s.salesAgents)
          .where(
            and(where(s.salesAgents, pid), eq(s.salesAgents.userId, userId)),
          )
          .for("update");
        if (old) version(old.revision, r.revision);
        const [saved] = old
          ? await tx
              .update(s.salesAgents)
              .set({ ...values, revision: old.revision + 1 })
              .where(eq(s.salesAgents.id, old.id))
              .returning()
          : await tx.insert(s.salesAgents).values(values).returning();
        await audit(tx as unknown as SalesDb, pid, access, "agent.saved", {
          id: saved.id,
        });
        return saved.id;
      }
      if (operation === "agreement") {
        assertSales(access, pid, "prices.edit");
        assertSales(access, pid, "deals.approve");
        const agentId = identifier(r.agentId)!;
        const [agent] = await tx
          .select()
          .from(s.salesAgents)
          .where(and(where(s.salesAgents, pid), eq(s.salesAgents.id, agentId)));
        if (!agent) throw Error("Agent is not in this workspace.");
        const kind = String(r.kind),
          rate = percentage(r.rate),
          fixedAmount = decimal(r.fixedAmount),
          gstTreatment = String(r.gstTreatment),
          gstRate = percentage(r.gstRate),
          payableMilestone = String(r.payableMilestone ?? "manual");
        if (
          !["fixed", "percentage"].includes(kind) ||
          !["unconfirmed", "inclusive", "exclusive", "not_applicable"].includes(
            gstTreatment,
          ) ||
          !["manual", "signed", "unconditional", "settled"].includes(
            payableMilestone,
          )
        )
          throw Error("Invalid commission agreement.");
        if (
          (kind === "fixed" && fixedAmount === null) ||
          (kind === "percentage" && rate === null)
        )
          throw Error(
            "Enter the agreed commission; no standard rate is assumed.",
          );
        commissionCalculation("0", {
          kind,
          rate,
          fixedAmount,
          gstTreatment,
          gstRate,
        });
        const [saved] = await tx
          .insert(s.salesCommissionAgreements)
          .values({
            ...context,
            ...actor,
            agentId,
            kind,
            rate: kind === "percentage" ? rate : null,
            fixedAmount: kind === "fixed" ? fixedAmount : null,
            gstTreatment,
            gstRate,
            payableMilestone,
            documentReference: text(r.documentReference, 1000),
            notes: text(r.notes, 4000),
          })
          .returning();
        await audit(
          tx as unknown as SalesDb,
          pid,
          access,
          "agreement.created",
          { id: saved.id, agentId },
        );
        return saved.id;
      }
      if (operation === "estimate") {
        assertSales(access, pid, "prices.edit");
        const agreementId = identifier(r.agreementId)!,
          contractId = identifier(r.contractId)!;
        const [a] = await tx
          .select()
          .from(s.salesCommissionAgreements)
          .where(
            and(
              where(s.salesCommissionAgreements, pid),
              eq(s.salesCommissionAgreements.id, agreementId),
            ),
          )
          .for("update");
        const [c] = await tx
          .select()
          .from(s.salesContracts)
          .where(
            and(
              where(s.salesContracts, pid),
              eq(s.salesContracts.id, contractId),
            ),
          )
          .for("update");
        if (
          !a ||
          !c ||
          !c.contractPrice ||
          ["cancelled", "terminated"].includes(c.status)
        )
          throw Error("Choose an active priced contract and scoped agreement.");
        const [agent] = await tx
          .select()
          .from(s.salesAgents)
          .where(eq(s.salesAgents.id, a.agentId));
        if (c.agentId !== agent.userId)
          throw Error(
            "Commission agent must match the contract selling agent.",
          );
        const [saved] = await tx
          .insert(s.salesCommissions)
          .values({
            ...context,
            ...actor,
            agentId: a.agentId,
            agreementId,
            contractId,
            ...commissionCalculation(c.contractPrice, a),
            basis: {
              contractPrice: c.contractPrice,
              contractRevision: c.revision,
              agreement: { ...a },
            },
          })
          .returning();
        await audit(
          tx as unknown as SalesDb,
          pid,
          access,
          "commission.estimated",
          { id: saved.id, contractId },
          { unitId: c.unitId, leadId: c.leadId },
        );
        return saved.id;
      }
      if (operation === "commission") {
        assertSales(access, pid, "prices.edit");
        const id = identifier(r.id)!,
          reason = text(r.reason, 1000, true)!;
        if (r.confirm !== true)
          throw Error("Explicit confirmation is required.");
        const [old] = await tx
          .select()
          .from(s.salesCommissions)
          .where(
            and(where(s.salesCommissions, pid), eq(s.salesCommissions.id, id)),
          )
          .for("update");
        if (!old) throw Error("Commission not found.");
        version(old.revision, r.revision);
        const status = String(r.status),
          patch: Partial<typeof s.salesCommissions.$inferInsert> = {
            ...actor,
            revision: old.revision + 1,
          };
        if (status === "approved") {
          assertSales(access, pid, "deals.approve");
          if (old.status !== "estimated")
            throw Error("Only an estimate can be approved.");
          const [c] = await tx
            .select()
            .from(s.salesContracts)
            .where(eq(s.salesContracts.id, old.contractId))
            .for("update");
          const [a] = await tx
            .select()
            .from(s.salesCommissionAgreements)
            .where(eq(s.salesCommissionAgreements.id, old.agreementId));
          const milestone = a.payableMilestone;
          if (
            ["draft", "cancelled", "terminated"].includes(c.status) ||
            cents(c.contractPrice) !== cents(String(old.basis.contractPrice))
          )
            throw Error(
              "Reconcile the estimate with the active registered contract.",
            );
          if (
            (milestone === "settled" && c.status !== "completed") ||
            (milestone === "unconditional" &&
              !["unconditional", "completed"].includes(c.status))
          )
            throw Error(
              "The agreed commission milestone has not been reached.",
            );
          if (a.gstTreatment === "unconfirmed")
            throw Error(
              "Confirm GST treatment before approving a commission obligation.",
            );
          patch.approvedAmount =
            decimal(r.approvedAmount) ?? old.estimatedAmount;
          patch.status = "approved";
        } else if (status === "paid") {
          assertSales(access, pid, "settlement.edit");
          if (!["approved", "part_paid"].includes(old.status))
            throw Error(
              "Only approved commission can record payment evidence.",
            );
          const paid = decimal(r.paidAmount),
            paidAt = dateOrNull(r.paidAt),
            reference = text(r.paymentReference, 1000, true)!;
          if (
            !paid ||
            !paidAt ||
            paidAt > new Date() ||
            cents(paid) <= cents(old.paidAmount) ||
            cents(paid) > cents(old.approvedAmount)
          )
            throw Error(
              "Enter increasing confirmed payments within the approved obligation.",
            );
          patch.paidAmount = paid;
          patch.paidAt = paidAt;
          patch.paymentReference = reference;
          patch.status =
            cents(paid) === cents(old.approvedAmount) ? "paid" : "part_paid";
        } else if (status === "cancelled") {
          assertSales(access, pid, "deals.approve");
          if (cents(old.paidAmount) > 0n)
            throw Error(
              "Paid commission needs reconciliation; payment history cannot be erased.",
            );
          patch.status = "cancelled";
        } else throw Error("Invalid commission transition.");
        await tx
          .update(s.salesCommissions)
          .set(patch)
          .where(eq(s.salesCommissions.id, id));
        await audit(
          tx as unknown as SalesDb,
          pid,
          access,
          "commission.updated",
          {
            id,
            from: old.status,
            to: patch.status,
            reason,
            before: old,
            after: patch,
          },
        );
        return id;
      }
      if (operation === "cashAdjustment") {
        assertSales(access, pid, "settlement.edit");
        assertSales(access, pid, "prices.edit");
        const id = identifier(r.id)!;
        if (r.confirm !== true)
          throw Error("Explicit correction confirmation is required.");
        const [c] = await tx
          .select()
          .from(s.salesContracts)
          .where(and(where(s.salesContracts, pid), eq(s.salesContracts.id, id)))
          .for("update");
        if (!c) throw Error("Contract not found.");
        version(c.revision, r.revision);
        const category = String(r.category);
        if (!["deposit", "settlement"].includes(category))
          throw Error("Invalid cash category.");
        const delta = cents(decimal(r.amount));
        if (
          delta === 0n ||
          !["increase", "decrease"].includes(String(r.direction))
        )
          throw Error("Enter a positive adjustment and direction.");
        const signed = r.direction === "decrease" ? -delta : delta,
          old =
            category === "deposit"
              ? cents(c.depositReceivedAmount)
              : cents(c.settlementReceivedAmount),
          next = old + signed,
          other =
            category === "deposit"
              ? cents(c.settlementReceivedAmount)
              : cents(c.depositReceivedAmount);
        if (next < 0n || next + other > cents(c.contractPrice))
          throw Error(
            "Correction would make confirmed cash negative or greater than the agreed contract value.",
          );
        const reason = text(r.reason, 2000, true)!,
          reference = text(r.reference, 1000, true)!,
          receivedAt = dateOrNull(r.receivedAt);
        if (!receivedAt || receivedAt > new Date())
          throw Error("A current or past evidence date is required.");
        await tx
          .insert(s.salesCashEntries)
          .values({
            ...context,
            contractId: id,
            category,
            amount: signed < 0n ? "-" + amount(-signed) : amount(signed),
            receivedAt,
            reference,
            reason,
            actorUserId: access.userId,
          });
        await tx
          .update(s.salesContracts)
          .set({
            ...actor,
            revision: c.revision + 1,
            ...(category === "deposit"
              ? {
                  depositReceivedAmount: amount(next),
                  depositReceivedAt: receivedAt,
                }
              : {
                  settlementReceivedAmount: amount(next),
                  settlementReceivedAt: receivedAt,
                }),
            receiptReference: reference,
          })
          .where(eq(s.salesContracts.id, id));
        await audit(
          tx as unknown as SalesDb,
          pid,
          access,
          "cash.adjusted",
          {
            contractId: id,
            category,
            direction: r.direction,
            amount: amount(delta),
            reason,
            reference,
          },
          { unitId: c.unitId, leadId: c.leadId },
        );
        return id;
      }
      if (operation === "amendContract") {
        assertSales(access, pid, "contracts.edit");
        assertSales(access, pid, "prices.edit");
        assertSales(access, pid, "deals.approve");
        const id = identifier(r.id)!;
        if (r.confirm !== true) throw Error("Confirm this recorded amendment.");
        const reason = text(r.reason, 2000, true)!;
        const [c] = await tx
          .select()
          .from(s.salesContracts)
          .where(and(where(s.salesContracts, pid), eq(s.salesContracts.id, id)))
          .for("update");
        if (!c) throw Error("Contract not found.");
        version(c.revision, r.revision);
        if (["completed", "cancelled", "terminated"].includes(c.status))
          throw Error("Closed contracts cannot be silently amended.");
        const contractPrice =
            r.contractPrice === undefined
              ? c.contractPrice
              : decimal(r.contractPrice),
          depositAmount =
            r.depositAmount === undefined
              ? c.depositAmount
              : decimal(r.depositAmount);
        if (
          !contractPrice ||
          cents(contractPrice) <= 0n ||
          cents(depositAmount) > cents(contractPrice) ||
          cents(c.depositReceivedAmount) + cents(c.settlementReceivedAmount) >
            cents(contractPrice)
        )
          throw Error(
            "Amended price cannot be below confirmed receipts or deposit target.",
          );
        const patch = {
          ...actor,
          contractPrice,
          depositAmount,
          depositPercentage: percentage(r.depositPercentage),
          depositDueAt: dateOrNull(r.depositDueAt),
          expectedSettlementAt: dateOrNull(r.expectedSettlementAt),
          financeCondition: text(r.financeCondition, 4000),
          otherConditions: text(r.otherConditions, 4000),
          solicitorName: text(r.solicitorName, 200),
          solicitorEmail: text(r.solicitorEmail, 254),
          solicitorPhone: text(r.solicitorPhone, 80),
          documentReference: text(r.documentReference, 1000, true)!,
          notes: text(r.notes, 4000),
          revision: c.revision + 1,
        };
        if (
          patch.expectedSettlementAt &&
          c.contractDate &&
          patch.expectedSettlementAt < c.contractDate
        )
          throw Error("Settlement cannot precede the contract.");
        if (c.status !== "draft") {
          if (scopeKey !== "real") {
            const u = await demoUnit(
              tx as unknown as SalesDb,
              access,
              pid,
              scopeKey,
              c.unitId,
            );
            await tx
              .update(s.salesDemoUnitState)
              .set({
                contractPrice,
                depositAmount,
                revision: u.revision + 1,
                updatedAt: new Date(),
              })
              .where(
                and(
                  where(s.salesDemoUnitState, pid),
                  eq(s.salesDemoUnitState.unitId, c.unitId),
                ),
              );
          } else {
            const [u] = await tx
              .select()
              .from(s.salesUnits)
              .where(eq(s.salesUnits.id, c.unitId))
              .for("update");
            const [p] = await tx
              .select()
              .from(s.salesPrivatePrices)
              .where(eq(s.salesPrivatePrices.unitId, c.unitId));
            if (cents(p?.contractPrice) !== cents(c.contractPrice))
              throw Error("Canonical contract price requires reconciliation.");
            await createSalesService(tx as unknown as SalesDb).savePrices(
              access,
              pid,
              c.unitId,
              u.revision,
              { ...p, contractPrice, depositAmount },
            );
          }
        }
        await tx
          .update(s.salesContracts)
          .set(patch)
          .where(eq(s.salesContracts.id, id));
        await audit(
          tx as unknown as SalesDb,
          pid,
          access,
          "contract.amended",
          { contractId: id, reason, before: c, after: patch },
          { unitId: c.unitId, leadId: c.leadId },
        );
        return id;
      }
      if (operation === "releasePlan") {
        assertSales(access, pid, "inventory.edit");
        if (r.targetValue !== undefined || r.pricingNote !== undefined)
          assertSales(access, pid, "prices.edit");
        const stageId = identifier(r.stageId)!;
        const [stage] = await tx
          .select()
          .from(s.salesReleaseStages)
          .where(
            and(
              eq(s.salesReleaseStages.projectId, pid),
              eq(s.salesReleaseStages.id, stageId),
            ),
          );
        if (!stage)
          throw Error("Choose an existing project sales release stage.");
        const [old] = await tx
          .select()
          .from(s.salesReleasePlans)
          .where(
            and(
              where(s.salesReleasePlans, pid),
              eq(s.salesReleasePlans.stageId, stageId),
            ),
          )
          .for("update");
        if (old) version(old.revision, r.revision);
        const targetUnits =
          r.targetUnits === "" || r.targetUnits == null
            ? null
            : Number(r.targetUnits);
        if (
          targetUnits !== null &&
          (!Number.isInteger(targetUnits) || targetUnits < 0)
        )
          throw Error("Invalid unit target.");
        const values = {
          ...context,
          ...actor,
          stageId,
          plannedAt: dateOrNull(r.plannedAt),
          targetUnits,
          targetValue:
            r.targetValue === undefined
              ? (old?.targetValue ?? null)
              : decimal(r.targetValue),
          pricingNote:
            r.pricingNote === undefined
              ? (old?.pricingNote ?? null)
              : text(r.pricingNote, 4000),
          revision: (old?.revision ?? 0) + 1,
        };
        await tx
          .insert(s.salesReleasePlans)
          .values(values)
          .onConflictDoUpdate({
            target: [
              s.salesReleasePlans.projectId,
              s.salesReleasePlans.scopeKey,
              s.salesReleasePlans.stageId,
            ],
            set: values,
          });
        await audit(tx as unknown as SalesDb, pid, access, "release.planned", {
          stageId,
          before: old ?? null,
          after: values,
        });
        return stageId;
      }
      throw Error("Unknown platform operation.");
    });
  }
  async function exportReport(access: PortalAccess, pid: string, kind: string, filters:Partial<ReportFilter>={}) {
    assertScope(access, pid, scopeKey);
    assertSales(access, pid, "deals.view");
    if (["inventory", "prices", "leads"].includes(kind))
      return createSalesService(db, scopeKey).exportCsv(access, pid, kind);
    if (["crmActivity", "leadSources"].includes(kind))
      assertSales(access, pid, "crm.export");
    else if (!["offers", "reservations"].includes(kind))
      assertSales(access, pid, "prices.view");
    const p = await workspace(access, pid),
      l = await createLifecycleService(db, scopeKey).workspace(access, pid);
    const data=await createSalesService(db,scopeKey).workspace(access,pid),filter:ReportFilter={from:filters.from??"",to:filters.to??"",stage:filters.stage??"",agent:filters.agent??""};
    for(const value of [filter.from,filter.to])if(value&&!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error("Invalid report date filter.");
    const report=salesReport(data,l,p,filter),ids=new Set(report.contracts.map(c=>c.id));
    let rows: Record<string, unknown>[];
    if(kind==="summary")rows=[{residences:report.units.length,askingValue:report.asking,contractedValue:report.summary.contracted,confirmedReceipts:report.summary.confirmedReceipts,outstandingDeposit:report.summary.outstandingDeposits,expectedSettlementBalance:report.summary.outstandingContractBalance,completedSettlements:report.summary.completed,averageContractPrice:report.averageContract}];
    else if(kind==="performance")rows=report.stageRevenue;
    else if(kind==="leadSources")rows=report.sources;
    else if(kind==="crmActivity"){
      const activity:Record<string,unknown>[]=[];
      for(const buyer of data.leads){if(filter.agent&&buyer.assignedAgentId!==filter.agent&&buyer.assignedStaffId!==filter.agent)continue;const entries=await createSalesService(db,scopeKey).leadActivity(access,pid,buyer.id);for(const e of entries){if(filter.from&&e.createdAt<new Date(filter.from+"T00:00:00Z"))continue;if(filter.to&&e.createdAt>=new Date(new Date(filter.to+"T00:00:00Z").getTime()+86400000))continue;activity.push({buyerId:buyer.id,buyer:buyer.name,action:e.action,actor:e.actorUserId,createdAt:e.createdAt,interactionType:e.details.interactionType??"",note:e.details.note??"",followUpAt:e.details.followUpAt??""});}}
      rows=activity;
    }
    else if (kind === "commissions") rows = p.commissions.filter(c=>ids.has(c.contractId));
    else if (kind === "agents") rows=report.agents;
    else if (kind === "cash") rows = p.cash.filter(c=>ids.has(c.contractId));
    else if (kind === "offers") rows = report.offers;
    else if (kind === "reservations") rows = report.reservations;
    else if (["contracts", "deposits", "settlements"].includes(kind)) rows = report.contracts;
    else throw Error("Choose an available report.");
    // Avoid nested/PII fields in generic reports. Contract register remains finance-only.
    const keys = rows.length
      ? Object.keys(rows[0]).filter((k) => !["basis", "scopeKey"].includes(k))
      : ["id"];
    return csvExport(
      rows.map((r) => ({
        ...r,
        transactionMode: scopeKey === "real" ? "REAL" : "DEMO",
      })),
      ["transactionMode", ...keys],
    );
  }
  return { workspace, execute, exportReport };
}
export type PlatformData = Awaited<
  ReturnType<ReturnType<typeof createPlatformService>["workspace"]>
>;
