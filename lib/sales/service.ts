import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { PortalAccess } from "../auth/access";
import * as s from "../db/schema";
import type { SalesDb } from "./db";
import { assertSales, canSales, isAgent } from "./permissions";
import {
  assertTransition,
  csvExport,
  dateOrNull,
  decimal,
  leadStatuses,
  makeSnapshot,
  parseImport,
  record,
  text,
  validId,
  validateEnquiry,
  validatePrices,
  validateUnit,
  type PublicSnapshot,
} from "./domain";

type Tx = Parameters<Parameters<SalesDb["transaction"]>[0]>[0];
type Context = SalesDb | Tx;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
const digest = (snapshot: PublicSnapshot) =>
  createHash("sha256").update(canonical(snapshot)).digest("hex");
const scope = (projectId: string, id: string) =>
  and(eq(s.salesUnits.projectId, projectId), eq(s.salesUnits.id, id));
function revision(value: number) {
  if (!Number.isInteger(value) || value < 1)
    throw new Error("A valid record revision is required.");
}
async function event(
  db: Context,
  projectId: string,
  actor: string | null,
  action: string,
  refs: { unitId?: string; leadId?: string; publicationId?: string } = {},
  details: Record<string, unknown> = {},
) {
  await db
    .insert(s.salesEvents)
    .values({ projectId, actorUserId: actor, action, ...refs, details });
  // Keep PII and confidential price values out of the shared audit log.
  await db
    .insert(s.auditLogs)
    .values({
      actorUserId: actor,
      action: `sales.${action}`,
      entityType: refs.leadId
        ? "sales_lead"
        : refs.publicationId
          ? "sales_publication"
          : "sales_unit",
      entityId: refs.unitId ?? refs.leadId ?? refs.publicationId ?? projectId,
      metadata: { projectId },
    });
}
async function config(db: Context, projectId: string) {
  const [row] = await db
    .select()
    .from(s.salesProjects)
    .where(eq(s.salesProjects.projectId, projectId))
    .for("update");
  if (!row) throw new Error("Configure this sales project first.");
  return row;
}
async function unitForUpdate(
  db: Context,
  projectId: string,
  id: string,
  expected: number,
) {
  revision(expected);
  const [row] = await db
    .select()
    .from(s.salesUnits)
    .where(scope(projectId, id))
    .for("update");
  if (!row || row.revision !== expected)
    throw new Error("Unit changed or was not found. Reload before saving.");
  return row;
}
async function verifyStages(
  db: Context,
  projectId: string,
  units: Array<{
    constructionStageId: string | null;
    releaseStageId: string | null;
  }>,
) {
  const construction = await db
    .select()
    .from(s.salesConstructionStages)
    .where(eq(s.salesConstructionStages.projectId, projectId));
  const release = await db
    .select()
    .from(s.salesReleaseStages)
    .where(eq(s.salesReleaseStages.projectId, projectId));
  for (const unit of units)
    if (
      (unit.constructionStageId &&
        !construction.some((x) => x.id === unit.constructionStageId)) ||
      (unit.releaseStageId &&
        !release.some((x) => x.id === unit.releaseStageId))
    )
      throw new Error("Stage belongs to another project or no longer exists.");
}

export function createSalesService(db: SalesDb) {
  return {
    async configure(access: PortalAccess, projectId: string, input: unknown) {
      assertSales(access, projectId, "settings.edit");
      const row = record(input);
      const publicKey = text(row.publicKey, 80, true)!;
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(publicKey))
        throw new Error("Use a lowercase project key.");
      const expectedUnits =
        row.expectedUnits === "" || row.expectedUnits == null
          ? null
          : Number(row.expectedUnits);
      if (
        expectedUnits !== null &&
        (!Number.isInteger(expectedUnits) ||
          expectedUnits < 1 ||
          expectedUnits > 10000)
      )
        throw new Error("Invalid planned capacity.");
      const privacyVersion = text(row.privacyVersion, 100),
        privacyNotice = text(row.privacyNotice, 10000);
      const enquiriesEnabled = row.enquiriesEnabled === true;
      if (
        enquiriesEnabled &&
        (!privacyVersion || !privacyNotice || privacyNotice.length < 200)
      )
        throw new Error(
          "Approve a full project privacy notice and policy version before enabling enquiries.",
        );
      return db.transaction(async (tx) => {
        await tx
          .select({ id: s.projects.id })
          .from(s.projects)
          .where(eq(s.projects.id, projectId))
          .for("update");
        const [previous] = await tx
          .select()
          .from(s.salesProjects)
          .where(eq(s.salesProjects.projectId, projectId));
        if (
          previous?.publishedPublicationId &&
          previous.publicKey !== publicKey
        )
          throw new Error("Published project keys cannot be changed.");
        const existing = await tx
          .select({ id: s.salesUnits.id })
          .from(s.salesUnits)
          .where(eq(s.salesUnits.projectId, projectId));
        if (expectedUnits !== null && existing.length > expectedUnits)
          throw new Error("Capacity is below the actual inventory count.");
        await tx
          .insert(s.salesProjects)
          .values({
            projectId,
            publicKey,
            expectedUnits,
            privacyVersion,
            privacyNotice,
            enquiriesEnabled,
          })
          .onConflictDoUpdate({
            target: s.salesProjects.projectId,
            set: {
              publicKey,
              expectedUnits,
              privacyVersion,
              privacyNotice,
              enquiriesEnabled,
              updatedAt: new Date(),
            },
          });
        await event(tx, projectId, access.userId, "settings.updated");
      });
    },
    async saveStage(access: PortalAccess, projectId: string, input: unknown) {
      assertSales(access, projectId, "inventory.edit");
      const row = record(input);
      if (!["construction", "release"].includes(String(row.kind)))
        throw new Error("Choose a stage type.");
      const table =
        row.kind === "construction"
          ? s.salesConstructionStages
          : s.salesReleaseStages;
      const values = {
        code: text(row.code, 40, true)!,
        name: text(row.name, 120, true)!,
        sequence: Number(row.sequence ?? 0),
        updatedAt: new Date(),
      };
      if (
        !Number.isInteger(values.sequence) ||
        values.sequence < 0 ||
        values.sequence > 10000
      )
        throw new Error("Invalid stage order.");
      return db.transaction(async (tx) => {
        await config(tx, projectId);
        let stageId: string;
        if (row.id) {
          if (!validId(row.id)) throw new Error("Invalid stage.");
          const [saved] = await tx
            .update(table)
            .set(values)
            .where(and(eq(table.projectId, projectId), eq(table.id, row.id)))
            .returning();
          if (!saved) throw new Error("Stage was not found in this project.");
          stageId = saved.id;
        } else {
          const [saved] = await tx.insert(table).values({ projectId, ...values }).returning({ id: table.id });
          stageId = saved.id;
        }
        await event(tx, projectId, access.userId, `stage.${row.kind}.saved`, {}, { stageId });
        return stageId;
      });
    },
    async saveUnit(
      access: PortalAccess,
      projectId: string,
      input: unknown,
      id?: string,
      expected?: number,
    ) {
      assertSales(access, projectId, "inventory.edit");
      const checked = validateUnit(input);
      return db.transaction(async (tx) => {
        const settings = await config(tx, projectId);
        await verifyStages(tx, projectId, [checked]);
        const now = new Date();
        let result;
        if (id) {
          const previous = await unitForUpdate(tx, projectId, id, expected!);
          [result] = await tx
            .update(s.salesUnits)
            .set({
              ...checked,
              revision: previous.revision + 1,
              provenance: [
                ...previous.provenance,
                {
                  source: checked.sourceDocument,
                  actor: access.userId,
                  recordedAt: now.toISOString(),
                },
              ],
              updatedByUserId: access.userId,
              updatedAt: now,
            })
            .where(scope(projectId, id))
            .returning();
          await event(
            tx,
            projectId,
            access.userId,
            "unit.updated",
            { unitId: id },
            {
              revision: result.revision,
              fields: Object.keys(checked).filter(
                (key) =>
                  JSON.stringify(previous[key as keyof typeof previous]) !==
                  JSON.stringify(checked[key as keyof typeof checked]),
              ),
            },
          );
        } else {
          const units = await tx
            .select({ id: s.salesUnits.id })
            .from(s.salesUnits)
            .where(eq(s.salesUnits.projectId, projectId));
          if (
            settings.expectedUnits !== null &&
            units.length >= settings.expectedUnits
          )
            throw new Error("Planned inventory capacity reached.");
          [result] = await tx
            .insert(s.salesUnits)
            .values({
              projectId,
              ...checked,
              updatedByUserId: access.userId,
              provenance: [
                {
                  source: checked.sourceDocument,
                  actor: access.userId,
                  recordedAt: now.toISOString(),
                },
              ],
            })
            .returning();
          await event(tx, projectId, access.userId, "unit.created", {
            unitId: result.id,
          });
        }
        return result.id;
      });
    },
    async importInventory(
      access: PortalAccess,
      projectId: string,
      csv: string,
      commit = false,
    ) {
      assertSales(access, projectId, "inventory.edit");
      const checked = parseImport(csv);
      return db.transaction(async (tx) => {
        const settings = await config(tx, projectId);
        await verifyStages(tx, projectId, checked);
        const existing = await tx
          .select({ number: s.salesUnits.number })
          .from(s.salesUnits)
          .where(eq(s.salesUnits.projectId, projectId));
        if (
          checked.some((unit) =>
            existing.some((row) => row.number === unit.number),
          )
        )
          throw new Error(
            "Import contains an existing unit number. Use unit editing to preserve its provenance.",
          );
        if (
          settings.expectedUnits !== null &&
          existing.length + checked.length > settings.expectedUnits
        )
          throw new Error("Import exceeds the planned inventory capacity.");
        if (commit) {
          const rows = await tx
            .insert(s.salesUnits)
            .values(
              checked.map((unit) => ({
                ...unit,
                projectId,
                updatedByUserId: access.userId,
                provenance: [
                  {
                    source: unit.sourceDocument,
                    actor: access.userId,
                    recordedAt: new Date().toISOString(),
                  },
                ],
              })),
            )
            .returning({ id: s.salesUnits.id });
          for (const row of rows)
            await event(tx, projectId, access.userId, "unit.imported", {
              unitId: row.id,
            });
        }
        return { count: checked.length, units: checked, committed: commit };
      });
    },
    async changeStatus(
      access: PortalAccess,
      projectId: string,
      id: string,
      expected: number,
      status: string,
      reason: string,
    ) {
      assertSales(access, projectId, "status.edit");
      await db.transaction(async (tx) => {
        await config(tx, projectId);
        const unit = await unitForUpdate(tx, projectId, id, expected);
        assertTransition(unit.status, status, reason);
        await tx
          .update(s.salesUnits)
          .set({
            status,
            statusChangedAt: new Date(),
            updatedAt: new Date(),
            revision: unit.revision + 1,
            updatedByUserId: access.userId,
          })
          .where(scope(projectId, id));
        await event(
          tx,
          projectId,
          access.userId,
          "unit.status",
          { unitId: id },
          {
            from: unit.status,
            to: status,
            reason,
            revision: unit.revision + 1,
          },
        );
      });
    },
    async savePrices(
      access: PortalAccess,
      projectId: string,
      id: string,
      expected: number,
      input: unknown,
      publicPrice = false,
    ) {
      assertSales(
        access,
        projectId,
        publicPrice ? "publicPrices.edit" : "prices.edit",
      );
      const row = record(input);
      await db.transaction(async (tx) => {
        await config(tx, projectId);
        const unit = await unitForUpdate(tx, projectId, id, expected);
        if (publicPrice)
          await tx
            .update(s.salesUnits)
            .set({
              publicAskingPrice: decimal(row.publicAskingPrice),
              publicPriceVisible: row.publicPriceVisible === true,
            })
            .where(scope(projectId, id));
        else {
          const checked = validatePrices(row);
          await tx
            .insert(s.salesPrivatePrices)
            .values({ unitId: id, ...checked })
            .onConflictDoUpdate({
              target: s.salesPrivatePrices.unitId,
              set: { ...checked, updatedAt: new Date() },
            });
        }
        await tx
          .update(s.salesUnits)
          .set({
            revision: unit.revision + 1,
            updatedAt: new Date(),
            updatedByUserId: access.userId,
          })
          .where(scope(projectId, id));
        await event(
          tx,
          projectId,
          access.userId,
          publicPrice ? "unit.public_price_draft" : "unit.private_prices",
          { unitId: id },
          { revision: unit.revision + 1 },
        );
      });
    },
    async createDraft(
      access: PortalAccess,
      projectId: string,
      restoreId?: string,
    ) {
      assertSales(access, projectId, "inventory.edit");
      if (restoreId) assertSales(access, projectId, "publication.publish");
      return db.transaction(async (tx) => {
        const settings = await config(tx, projectId);
        let snapshot: PublicSnapshot;
        if (restoreId) {
          const [old] = await tx
            .select()
            .from(s.salesPublications)
            .where(
              and(
                eq(s.salesPublications.projectId, projectId),
                eq(s.salesPublications.id, restoreId),
              ),
            );
          if (
            !old?.approvedAt ||
            !old.publishedAt ||
            digest(old.snapshot) !== old.digest
          )
            throw new Error(
              "Only an intact previously published revision can be restored.",
            );
          snapshot = { ...old.snapshot, revision: settings.nextRevision };
        } else {
          const units = await tx
            .select()
            .from(s.salesUnits)
            .where(eq(s.salesUnits.projectId, projectId));
          const construction = await tx
            .select()
            .from(s.salesConstructionStages)
            .where(eq(s.salesConstructionStages.projectId, projectId));
          const release = await tx
            .select()
            .from(s.salesReleaseStages)
            .where(eq(s.salesReleaseStages.projectId, projectId));
          snapshot = makeSnapshot(
            settings.publicKey,
            settings.nextRevision,
            units.map((unit) => ({
              ...unit,
              salesStage: release.find((x) => x.id === unit.releaseStageId)
                ?.name,
              constructionStage: construction.find(
                (x) => x.id === unit.constructionStageId,
              )?.name,
            })),
          );
        }
        const [created] = await tx
          .insert(s.salesPublications)
          .values({
            projectId,
            revision: settings.nextRevision,
            snapshot,
            digest: digest(snapshot),
            createdByUserId: access.userId,
            restoredFromId: restoreId ?? null,
          })
          .returning();
        await tx
          .update(s.salesProjects)
          .set({ nextRevision: settings.nextRevision + 1 })
          .where(eq(s.salesProjects.projectId, projectId));
        await event(
          tx,
          projectId,
          access.userId,
          restoreId ? "publication.rollback_draft" : "publication.draft",
          { publicationId: created.id },
          { source: restoreId ?? null },
        );
        return created.id;
      });
    },
    async approve(
      access: PortalAccess,
      projectId: string,
      id: string,
      expectedDigest: string,
    ) {
      assertSales(access, projectId, "publication.approve");
      await db.transaction(async (tx) => {
        await config(tx, projectId);
        const [draft] = await tx
          .select()
          .from(s.salesPublications)
          .where(
            and(
              eq(s.salesPublications.id, id),
              eq(s.salesPublications.projectId, projectId),
            ),
          )
          .for("update");
        if (
          !draft ||
          draft.status !== "draft" ||
          draft.digest !== expectedDigest ||
          digest(draft.snapshot) !== draft.digest
        )
          throw new Error("Preview no longer matches the draft.");
        await tx
          .update(s.salesPublications)
          .set({
            status: "approved",
            approvedAt: new Date(),
            approvedByUserId: access.userId,
          })
          .where(eq(s.salesPublications.id, id));
        await event(tx, projectId, access.userId, "publication.approved", {
          publicationId: id,
        });
      });
    },
    async publish(access: PortalAccess, projectId: string, id: string) {
      assertSales(access, projectId, "publication.publish");
      await db.transaction(async (tx) => {
        const settings = await config(tx, projectId);
        const [approved] = await tx
          .select()
          .from(s.salesPublications)
          .where(
            and(
              eq(s.salesPublications.projectId, projectId),
              eq(s.salesPublications.id, id),
            ),
          )
          .for("update");
        if (
          !approved ||
          approved.status !== "approved" ||
          !approved.approvedAt ||
          !approved.approvedByUserId ||
          digest(approved.snapshot) !== approved.digest
        )
          throw new Error("An intact approved snapshot is required.");
        if (settings.publishedPublicationId)
          await tx
            .update(s.salesPublications)
            .set({ status: "archived" })
            .where(eq(s.salesPublications.id, settings.publishedPublicationId));
        await tx
          .update(s.salesPublications)
          .set({
            status: "published",
            publishedAt: new Date(),
            publishedByUserId: access.userId,
          })
          .where(eq(s.salesPublications.id, id));
        await tx
          .update(s.salesProjects)
          .set({ publishedPublicationId: id, updatedAt: new Date() })
          .where(eq(s.salesProjects.projectId, projectId));
        await event(
          tx,
          projectId,
          access.userId,
          approved.restoredFromId
            ? "publication.rolled_back"
            : "publication.published",
          { publicationId: id },
          { source: approved.restoredFromId },
        );
      });
    },
    async publicInventory(key: string) {
      const empty = {
        contractVersion: 1 as const,
        projectKey: key,
        revision: 0,
        units: [] as PublicSnapshot["units"],
        enquiry: {
          enabled: false,
          privacyVersion: null as string | null,
          privacyNotice: null as string | null,
        },
      };
      if (!/^[a-z0-9-]{1,80}$/.test(key)) return empty;
      const [settings] = await db
        .select()
        .from(s.salesProjects)
        .where(eq(s.salesProjects.publicKey, key));
      if (!settings) return empty;
      const [publication] = settings.publishedPublicationId
        ? await db
            .select()
            .from(s.salesPublications)
            .where(
              and(
                eq(s.salesPublications.id, settings.publishedPublicationId),
                eq(s.salesPublications.projectId, settings.projectId),
                eq(s.salesPublications.status, "published"),
              ),
            )
        : [];
      if (
        settings.publishedPublicationId &&
        (!publication?.approvedAt ||
          !publication.publishedAt ||
          digest(publication.snapshot) !== publication.digest)
      )
        throw new Error("Published snapshot integrity check failed.");
      return {
        ...(publication?.snapshot ?? empty),
        enquiry: {
          enabled: Boolean(
            settings.enquiriesEnabled &&
              settings.privacyVersion &&
              settings.privacyNotice,
          ),
          privacyVersion: settings.privacyVersion,
          privacyNotice: settings.privacyNotice,
        },
      };
    },
    async createLead(
      access: PortalAccess | null,
      projectId: string,
      input: unknown,
      clientHash?: string,
    ) {
      if (access) {
        assertSales(access, projectId, "crm.edit");
        if (isAgent(access, projectId))
          throw new Error("Agents cannot create unassigned project leads.");
      }
      const checked = validateEnquiry(input);
      return db.transaction(async (tx) => {
        const settings = await config(tx, projectId);
        if (!access) {
          if (
            !settings.enquiriesEnabled ||
            !settings.privacyNotice ||
            checked.privacyVersion !== settings.privacyVersion ||
            !clientHash ||
            !/^[a-f0-9]{64}$/.test(clientHash)
          )
            throw new Error(
              "Enquiries are not enabled or the privacy policy changed.",
            );
          const publicData = settings.publishedPublicationId
            ? await tx
                .select({ snapshot: s.salesPublications.snapshot })
                .from(s.salesPublications)
                .where(
                  and(
                    eq(s.salesPublications.projectId, projectId),
                    eq(s.salesPublications.id, settings.publishedPublicationId),
                    eq(s.salesPublications.status, "published"),
                  ),
                )
            : [];
          if (
            checked.unitIds.some(
              (id) =>
                !publicData[0]?.snapshot.units.some((unit) => unit.id === id),
            )
          )
            throw new Error("Interested residence is no longer published.");
          const bucket = Math.floor(Date.now() / 900000);
          const key = createHash("sha256")
            .update(`${projectId}:${clientHash}`)
            .digest("hex");
          const [limit] = await tx
            .select()
            .from(s.salesRateLimits)
            .where(eq(s.salesRateLimits.key, key))
            .for("update");
          if (limit?.bucket === bucket && limit.count >= 5)
            throw new Error("Too many enquiries. Please try again later.");
          await tx
            .insert(s.salesRateLimits)
            .values({
              key,
              bucket,
              count: 1,
              expiresAt: new Date(Date.now() + 900000),
            })
            .onConflictDoUpdate({
              target: s.salesRateLimits.key,
              set: {
                bucket,
                count: limit?.bucket === bucket ? limit.count + 1 : 1,
                expiresAt: new Date(Date.now() + 900000),
              },
            });
          await tx
            .delete(s.salesRateLimits)
            .where(lt(s.salesRateLimits.expiresAt, new Date()));
        } else if (checked.unitIds.length) {
          const units = await tx
            .select({ id: s.salesUnits.id })
            .from(s.salesUnits)
            .where(
              and(
                eq(s.salesUnits.projectId, projectId),
                inArray(s.salesUnits.id, checked.unitIds),
              ),
            );
          if (units.length !== checked.unitIds.length)
            throw new Error("Interested units must belong to this project.");
        }
        const [lead] = await tx
          .insert(s.salesLeads)
          .values({
            projectId,
            ...checked,
            source: access ? "portal" : "golfview",
            consentAt: new Date(),
          })
          .returning({ id: s.salesLeads.id });
        await event(tx, projectId, access?.userId ?? null, "lead.created", {
          leadId: lead.id,
        });
        return lead.id;
      });
    },
    async updateLead(
      access: PortalAccess,
      projectId: string,
      id: string,
      expected: number,
      input: unknown,
    ) {
      assertSales(access, projectId, "crm.edit");
      revision(expected);
      const row = record(input);
      if (!leadStatuses.includes(row.status as (typeof leadStatuses)[number]))
        throw new Error("Invalid lead status.");
      return db.transaction(async (tx) => {
        const [lead] = await tx
          .select()
          .from(s.salesLeads)
          .where(
            and(eq(s.salesLeads.projectId, projectId), eq(s.salesLeads.id, id)),
          )
          .for("update");
        if (
          !lead ||
          lead.revision !== expected ||
          (isAgent(access, projectId) &&
            lead.assignedAgentId !== access.userId &&
            lead.assignedStaffId !== access.userId)
        )
          throw new Error("Lead changed or is not assigned to you.");
        const assignedAgentId =
          row.assignedAgentId === undefined
            ? lead.assignedAgentId
            : text(row.assignedAgentId, 36);
        const assignedStaffId =
          row.assignedStaffId === undefined
            ? lead.assignedStaffId
            : text(row.assignedStaffId, 36);
        if (
          assignedAgentId !== lead.assignedAgentId ||
          assignedStaffId !== lead.assignedStaffId
        ) {
          assertSales(access, projectId, "leads.assign");
          for (const [assignee, agent] of [
            [assignedAgentId, true],
            [assignedStaffId, false],
          ] as const)
            if (assignee) {
              if (!validId(assignee)) throw new Error("Invalid assignee.");
              const [member] = await tx
                .select({ role: s.projectMemberships.role })
                .from(s.projectMemberships)
                .innerJoin(s.users, eq(s.users.id, s.projectMemberships.userId))
                .where(
                  and(
                    eq(s.projectMemberships.projectId, projectId),
                    eq(s.projectMemberships.userId, assignee),
                    eq(s.users.isActive, true),
                  ),
                );
              if (!member || (member.role === "external_agent") !== agent)
                throw new Error(
                  "Assignee must be an active project member of the appropriate type.",
                );
            }
        }
        const followUpAt =
          row.followUpAt === undefined
            ? lead.followUpAt
            : dateOrNull(row.followUpAt);
        let unitIds = lead.unitIds;
        if (row.unitIds !== undefined) {
          assertSales(access, projectId, "leads.assign");
          if (
            !Array.isArray(row.unitIds) ||
            row.unitIds.length > 10 ||
            !row.unitIds.every(validId)
          )
            throw new Error("Invalid interested units.");
          unitIds = [...new Set(row.unitIds)] as string[];
          const units = unitIds.length
            ? await tx
                .select({ id: s.salesUnits.id })
                .from(s.salesUnits)
                .where(
                  and(
                    eq(s.salesUnits.projectId, projectId),
                    inArray(s.salesUnits.id, unitIds),
                  ),
                )
            : [];
          if (units.length !== unitIds.length)
            throw new Error("Interested units must belong to this project.");
        }
        const note = text(row.note, 4000);
        await tx
          .update(s.salesLeads)
          .set({
            status: row.status as typeof lead.status,
            assignedAgentId,
            assignedStaffId,
            unitIds,
            followUpAt,
            revision: lead.revision + 1,
            updatedAt: new Date(),
          })
          .where(eq(s.salesLeads.id, id));
        await event(
          tx,
          projectId,
          access.userId,
          "lead.updated",
          { leadId: id },
          {
            from: lead.status,
            to: row.status,
            assignedAgentId,
            assignedStaffId,
            unitIds,
            followUpAt: followUpAt?.toISOString() ?? null,
            ...(note ? { note } : {}),
          },
        );
      });
    },
    async leadActivity(access: PortalAccess, projectId: string, id: string) {
      assertSales(access, projectId, "crm.view");
      const [lead] = await db
        .select({
          assignedAgentId: s.salesLeads.assignedAgentId,
          assignedStaffId: s.salesLeads.assignedStaffId,
        })
        .from(s.salesLeads)
        .where(
          and(eq(s.salesLeads.projectId, projectId), eq(s.salesLeads.id, id)),
        );
      if (
        !lead ||
        (isAgent(access, projectId) &&
          lead.assignedAgentId !== access.userId &&
          lead.assignedStaffId !== access.userId)
      )
        throw new Error("Lead is not accessible.");
      return db
        .select()
        .from(s.salesEvents)
        .where(
          and(
            eq(s.salesEvents.projectId, projectId),
            eq(s.salesEvents.leadId, id),
          ),
        )
        .orderBy(desc(s.salesEvents.createdAt));
    },
    async workspace(access: PortalAccess, projectId: string) {
      assertSales(access, projectId, "inventory.view");
      const [settings] = await db
        .select()
        .from(s.salesProjects)
        .where(eq(s.salesProjects.projectId, projectId));
      const units = isAgent(access, projectId)
        ? []
        : await db
            .select()
            .from(s.salesUnits)
            .where(eq(s.salesUnits.projectId, projectId))
            .orderBy(asc(s.salesUnits.number));
      const publications = !isAgent(access, projectId)
        ? await db
            .select()
            .from(s.salesPublications)
            .where(eq(s.salesPublications.projectId, projectId))
            .orderBy(desc(s.salesPublications.revision))
            .limit(50)
        : [];
      const leadScope = and(
        eq(s.salesLeads.projectId, projectId),
        isAgent(access, projectId)
          ? or(
              eq(s.salesLeads.assignedAgentId, access.userId),
              eq(s.salesLeads.assignedStaffId, access.userId),
            )
          : undefined,
      );
      const leads = canSales(access, projectId, "crm.view")
        ? await db
            .select()
            .from(s.salesLeads)
            .where(leadScope)
            .orderBy(desc(s.salesLeads.updatedAt))
        : [];
      const prices = canSales(access, projectId, "prices.view")
        ? await db
            .select({
              unitId: s.salesPrivatePrices.unitId,
              askingPrice: s.salesPrivatePrices.askingPrice,
              minimumPrice: s.salesPrivatePrices.minimumPrice,
              contractPrice: s.salesPrivatePrices.contractPrice,
              depositAmount: s.salesPrivatePrices.depositAmount,
              settlementAmount: s.salesPrivatePrices.settlementAmount,
              gstTreatment: s.salesPrivatePrices.gstTreatment,
              depositDueAt: s.salesPrivatePrices.depositDueAt,
              settlementDueAt: s.salesPrivatePrices.settlementDueAt,
            })
            .from(s.salesPrivatePrices)
            .innerJoin(
              s.salesUnits,
              eq(s.salesUnits.id, s.salesPrivatePrices.unitId),
            )
            .where(eq(s.salesUnits.projectId, projectId))
        : [];
      const financeReport = canSales(access, projectId, "prices.view")
        ? await db
            .select({
              gstTreatment: s.salesPrivatePrices.gstTreatment,
              contractTotalAud: sql<string>`coalesce(sum(${s.salesPrivatePrices.contractPrice}),0)::text`,
              depositTotalAud: sql<string>`coalesce(sum(${s.salesPrivatePrices.depositAmount}),0)::text`,
              settlementTotalAud: sql<string>`coalesce(sum(${s.salesPrivatePrices.settlementAmount}),0)::text`,
            })
            .from(s.salesPrivatePrices)
            .innerJoin(
              s.salesUnits,
              eq(s.salesUnits.id, s.salesPrivatePrices.unitId),
            )
            .where(eq(s.salesUnits.projectId, projectId))
            .groupBy(s.salesPrivatePrices.gstTreatment)
        : [];
      const construction = !isAgent(access, projectId)
        ? await db
            .select()
            .from(s.salesConstructionStages)
            .where(eq(s.salesConstructionStages.projectId, projectId))
            .orderBy(asc(s.salesConstructionStages.sequence))
        : [];
      const release = !isAgent(access, projectId)
        ? await db
            .select()
            .from(s.salesReleaseStages)
            .where(eq(s.salesReleaseStages.projectId, projectId))
            .orderBy(asc(s.salesReleaseStages.sequence))
        : [];
      const history = canSales(access, projectId, "audit.view")
        ? await db
            .select()
            .from(s.salesEvents)
            .where(
              and(
                eq(s.salesEvents.projectId, projectId),
                sql`${s.salesEvents.leadId} is null`,
              ),
            )
            .orderBy(desc(s.salesEvents.createdAt))
            .limit(200)
        : [];
      const assignees = canSales(access, projectId, "leads.assign")
        ? await db
            .select({
              id: s.users.id,
              name: s.users.name,
              role: s.projectMemberships.role,
            })
            .from(s.projectMemberships)
            .innerJoin(s.users, eq(s.users.id, s.projectMemberships.userId))
            .where(
              and(
                eq(s.projectMemberships.projectId, projectId),
                eq(s.users.isActive, true),
              ),
            )
        : [];
      const publicData = settings
        ? await this.publicInventory(settings.publicKey)
        : null;
      return {
        agent: isAgent(access, projectId),
        settings: isAgent(access, projectId) ? null : (settings ?? null),
        assignees,
        units,
        publications,
        leads,
        prices,
        financeReport,
        construction,
        release,
        history,
        publicData,
        permissions: Object.fromEntries(
          [
            "inventory.edit",
            "prices.view",
            "prices.edit",
            "publicPrices.edit",
            "status.edit",
            "crm.view",
            "crm.edit",
            "leads.assign",
            "publication.approve",
            "publication.publish",
            "audit.view",
            "settings.edit",
            "crm.export",
          ].map((permission) => [
            permission,
            canSales(
              access,
              projectId,
              permission as Parameters<typeof canSales>[2],
            ),
          ]),
        ),
      };
    },
    async exportCsv(access: PortalAccess, projectId: string, kind: string) {
      if (kind === "leads") assertSales(access, projectId, "crm.export");
      else assertSales(access, projectId, "inventory.view");
      if (isAgent(access, projectId))
        throw new Error("Agents cannot export project registers.");
      const workspace = await this.workspace(access, projectId);
      if (kind === "leads")
        return csvExport(workspace.leads, [
          "id",
          "name",
          "email",
          "phone",
          "status",
          "source",
          "assignedAgentId",
          "assignedStaffId",
          "followUpAt",
          "privacyVersion",
          "consentAt",
          "marketingConsent",
        ]);
      if (kind === "prices") {
        assertSales(access, projectId, "prices.view");
        return csvExport(workspace.prices, [
          "unitId",
          "askingPrice",
          "minimumPrice",
          "contractPrice",
          "depositAmount",
          "settlementAmount",
          "gstTreatment",
          "depositDueAt",
          "settlementDueAt",
        ]);
      }
      return csvExport(workspace.units, [
        "id",
        "number",
        "lot",
        "housingType",
        "status",
        "bedrooms",
        "bathrooms",
        "carSpaces",
        "landAreaSqm",
        "buildingAreaSqm",
        "constructionStageId",
        "releaseStageId",
        "publicVisible",
        "revision",
        "sourceDocument",
      ]);
    },
  };
}
