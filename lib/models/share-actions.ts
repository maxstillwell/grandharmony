"use server";

import { and, desc, eq, gt, inArray, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requirePortalAccess } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { auditLogs, modelRegistry, modelScenarios, scenarioRevisions, scenarioShareLinks, scenarioShareSessions, users } from "@/lib/db/schema";
import { getAccessibleModel } from "@/lib/models/data";
import { canManageScenario } from "@/lib/models/permissions";
import type { ModelState } from "@/lib/models/types";
import { validateModelState } from "@/lib/models/validation";
import { hashShareSecret, newShareSecret, shareSessionCookieName } from "./share-security";

const unavailable = "This collaboration link is unavailable.";

function clean(value: string, label: string, maximum: number) {
  const output = value.trim();
  if (!output || output.length > maximum) throw new Error(`${label} is required and must be ${maximum} characters or fewer.`);
  return output;
}

function validEmail(value: string | undefined) {
  const output = value?.trim().toLowerCase() || null;
  if (output && (!/^\S+@\S+\.\S+$/.test(output) || output.length > 320)) throw new Error("Enter a valid email address or leave it blank.");
  return output;
}

async function managedSpecificationScenario(modelId: string, scenarioId: string) {
  const access = await requirePortalAccess();
  const model = await getAccessibleModel(access, modelId);
  if (!model || model.adapterKey !== "interactive-specification-v1") throw new Error("This specification model is unavailable.");
  const scenario = await getDb().query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, scenarioId), eq(modelScenarios.modelId, model.id)) });
  const allowedProject = !scenario?.projectId || access.role === "super_admin" || access.projects.some((project) => project.id === scenario.projectId);
  if (!scenario || scenario.status !== "active" || !allowedProject || !canManageScenario(access, scenario.createdByUserId)) throw new Error("This scenario is unavailable for sharing.");
  return { access, model, scenario };
}

export async function createSpecificationShareLink(input: { modelId: string; scenarioId: string; expiresInDays: number }) {
  const { access, scenario } = await managedSpecificationScenario(input.modelId, input.scenarioId);
  const days = Math.max(1, Math.min(90, Math.floor(input.expiresInDays)));
  const token = newShareSecret();
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const [row] = await getDb().batch([
    getDb().insert(scenarioShareLinks).values({ scenarioId: scenario.id, tokenHash: hashShareSecret(token), expiresAt, createdByUserId: access.userId }).returning(),
    getDb().insert(auditLogs).values({ actorUserId: access.userId, action: "create_specification_share_link", entityType: "model_scenario", entityId: scenario.id, metadata: { expiresAt: expiresAt.toISOString() } }),
  ]);
  const link = row[0];
  if (!link) throw new Error("The collaboration link could not be created.");
  return { id: link.id, token, expiresAt: expiresAt.toISOString() };
}

export async function revokeSpecificationShareLink(input: { modelId: string; scenarioId: string; shareLinkId: string }) {
  const { access, scenario } = await managedSpecificationScenario(input.modelId, input.scenarioId);
  const [updated] = await getDb().update(scenarioShareLinks).set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() }).where(and(eq(scenarioShareLinks.id, input.shareLinkId), eq(scenarioShareLinks.scenarioId, scenario.id), eq(scenarioShareLinks.status, "active"))).returning({ id: scenarioShareLinks.id });
  if (!updated) throw new Error("This collaboration link is already unavailable.");
  await getDb().insert(auditLogs).values({ actorUserId: access.userId, action: "revoke_specification_share_link", entityType: "model_scenario", entityId: scenario.id, metadata: { shareLinkId: input.shareLinkId } });
  revalidatePath(`/portal/models/${input.modelId}`);
}

export async function listSpecificationShareLinks(modelId: string, scenarioIds: string[]) {
  const access = await requirePortalAccess();
  const model = await getAccessibleModel(access, modelId);
  if (!model || model.adapterKey !== "interactive-specification-v1" || !scenarioIds.length) return {} as Record<string, Array<{ id: string; status: "active" | "revoked"; expiresAt: string; createdAt: string }>>;
  const scenarios = await getDb().select({ id: modelScenarios.id, createdByUserId: modelScenarios.createdByUserId, projectId: modelScenarios.projectId }).from(modelScenarios).where(and(eq(modelScenarios.modelId, model.id), inArray(modelScenarios.id, scenarioIds)));
  const allowed = scenarios.filter((scenario) => canManageScenario(access, scenario.createdByUserId) && (!scenario.projectId || access.role === "super_admin" || access.projects.some((project) => project.id === scenario.projectId))).map((scenario) => scenario.id);
  if (!allowed.length) return {};
  const links = await getDb().select({ id: scenarioShareLinks.id, scenarioId: scenarioShareLinks.scenarioId, status: scenarioShareLinks.status, expiresAt: scenarioShareLinks.expiresAt, createdAt: scenarioShareLinks.createdAt }).from(scenarioShareLinks).where(inArray(scenarioShareLinks.scenarioId, allowed)).orderBy(desc(scenarioShareLinks.createdAt));
  return links.reduce<Record<string, Array<{ id: string; status: "active" | "revoked"; expiresAt: string; createdAt: string }>>>((grouped, link) => {
    (grouped[link.scenarioId] ??= []).push({ ...link, expiresAt: link.expiresAt.toISOString(), createdAt: link.createdAt.toISOString() });
    return grouped;
  }, {});
}

async function sharedSource(token: string) {
  const link = await getDb().query.scenarioShareLinks.findFirst({ where: eq(scenarioShareLinks.tokenHash, hashShareSecret(token)) });
  if (!link || link.status !== "active" || link.expiresAt <= new Date()) return null;
  const scenario = await getDb().query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, link.scenarioId), eq(modelScenarios.status, "active")) });
  if (!scenario) return null;
  const model = await getDb().query.modelRegistry.findFirst({ where: eq(modelRegistry.id, scenario.modelId) });
  if (!model || model.status !== "active" || model.adapterKey !== "interactive-specification-v1") return null;
  return { link, scenario, model };
}

async function existingSharedSession(linkId: string) {
  const jar = await cookies();
  const value = jar.get(shareSessionCookieName(linkId))?.value;
  if (!value) return null;
  return getDb().query.scenarioShareSessions.findFirst({ where: and(eq(scenarioShareSessions.shareLinkId, linkId), eq(scenarioShareSessions.sessionHash, hashShareSecret(value))) });
}

export async function getSharedSpecification(token: string) {
  const source = await sharedSource(token);
  if (!source) return null;
  const session = await existingSharedSession(source.link.id);
  const guestScenario = session?.scenarioId ? await getDb().query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, session.scenarioId), eq(modelScenarios.status, "active")) }) : null;
  if (session) await getDb().update(scenarioShareSessions).set({ lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(scenarioShareSessions.id, session.id));
  return {
    expiresAt: source.link.expiresAt.toISOString(),
    sourceScenario: { id: source.scenario.id, name: source.scenario.name, state: source.scenario.state },
    model: { id: source.model.id, name: source.model.name },
    guestScenario: guestScenario && session ? { id: guestScenario.id, name: guestScenario.name, state: guestScenario.state, revision: guestScenario.revision, contributorName: session.contributorName, contributorEmail: session.contributorEmail } : null,
  };
}

export async function saveSharedSpecificationScenario(input: { token: string; scenarioName: string; contributorName: string; contributorEmail?: string; state: ModelState }) {
  const source = await sharedSource(input.token);
  if (!source) throw new Error(unavailable);
  const state = validateModelState(source.model.adapterKey, input.state);
  const scenarioName = clean(input.scenarioName, "Scenario name", 120);
  const contributorName = clean(input.contributorName, "Your name", 120);
  const contributorEmail = validEmail(input.contributorEmail);
  const db = getDb();
  const session = await existingSharedSession(source.link.id);
  if (session?.scenarioId) {
    const current = await db.query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, session.scenarioId), eq(modelScenarios.modelId, source.model.id), eq(modelScenarios.status, "active")) });
    if (!current || current.createdByUserId !== session.contributorUserId) throw new Error(unavailable);
    const revision = current.revision + 1;
    const [rows] = await db.batch([
      db.update(modelScenarios).set({ name: scenarioName, state, revision, updatedAt: new Date(), updatedByUserId: session.contributorUserId }).where(and(eq(modelScenarios.id, current.id), eq(modelScenarios.revision, current.revision))).returning({ id: modelScenarios.id, updatedAt: modelScenarios.updatedAt }),
      db.insert(scenarioRevisions).values({ scenarioId: current.id, revision, modelVersionId: current.modelVersionId, state, notes: "External collaboration save", savedByUserId: session.contributorUserId }),
      db.update(scenarioShareSessions).set({ contributorName, contributorEmail, lastSeenAt: new Date(), updatedAt: new Date() }).where(eq(scenarioShareSessions.id, session.id)),
      db.insert(auditLogs).values({ actorUserId: session.contributorUserId, action: "save_shared_specification_scenario", entityType: "model_scenario", entityId: current.id, metadata: { shareLinkId: source.link.id, revision } }),
    ]);
    if (!rows[0]) throw new Error("This scenario changed elsewhere. Reload the shared link before saving.");
    revalidatePath(`/portal/models/${source.model.id}`);
    return { id: current.id, revision, created: false };
  }
  const contributorId = randomUUID();
  const shareSessionId = randomUUID();
  const scenarioId = randomUUID();
  const browserSecret = newShareSecret();
  await db.batch([
    db.insert(users).values({ id: contributorId, email: `share-${contributorId}@guest.grandharmony.invalid`, name: contributorName, isActive: false }),
    db.insert(modelScenarios).values({ id: scenarioId, modelId: source.scenario.modelId, modelVersionId: source.scenario.modelVersionId, projectId: source.scenario.projectId, name: scenarioName, notes: "Created through controlled external collaboration", state, revision: 1, createdByUserId: contributorId, updatedByUserId: contributorId }),
    db.insert(scenarioRevisions).values({ scenarioId, revision: 1, modelVersionId: source.scenario.modelVersionId, state, notes: "External collaboration save", savedByUserId: contributorId }),
    db.insert(scenarioShareSessions).values({ id: shareSessionId, shareLinkId: source.link.id, sessionHash: hashShareSecret(browserSecret), contributorUserId: contributorId, contributorName, contributorEmail, scenarioId }),
    db.insert(auditLogs).values({ actorUserId: contributorId, action: "create_shared_specification_scenario", entityType: "model_scenario", entityId: scenarioId, metadata: { shareLinkId: source.link.id } }),
  ]);
  const jar = await cookies();
  jar.set(shareSessionCookieName(source.link.id), browserSecret, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: source.link.expiresAt, path: "/share" });
  revalidatePath(`/portal/models/${source.model.id}`);
  return { id: scenarioId, revision: 1, created: true };
}
