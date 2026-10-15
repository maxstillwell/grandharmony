"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePortalAccess } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { auditLogs, modelRegistry, modelScenarios, modelVersions, scenarioRevisions } from "@/lib/db/schema";
import { canManageScenarioOrShared, getAccessibleModel } from "@/lib/models/data";
import type { ModelState } from "@/lib/models/types";
import { validateModelState } from "./validation";
import { listScenarioRevisions } from "./data";
import { randomUUID } from "node:crypto";

type ScenarioInput = { modelId: string; modelVersionId: string | null; projectId?: string | null; name: string; notes?: string; state: ModelState };

function cleanText(value: string, label: string, maximum: number) {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maximum) throw new Error(`${label} is required and must be ${maximum} characters or fewer.`);
  return cleaned;
}

function validatedState(state: ModelState) {
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new Error("Model state is invalid.");
  const encoded = JSON.stringify(state);
  if (encoded.length > 100_000) throw new Error("Model state is too large to save.");
  return JSON.parse(encoded) as ModelState;
}

async function activeVersion(modelId: string) {
  return getDb().query.modelVersions.findFirst({ where: eq(modelVersions.modelId, modelId), orderBy: [desc(modelVersions.createdAt)] });
}

async function authorisedModel(modelId: string) {
  const access = await requirePortalAccess();
  const model = await getAccessibleModel(access, modelId);
  if (!model) throw new Error("This model is unavailable for your account.");
  return { access, model };
}

function scenarioProjectId(access: Awaited<ReturnType<typeof requirePortalAccess>>, model: { projectId: string | null }, requested: string | null | undefined) {
  if (model.projectId) {
    if (requested && requested !== model.projectId) throw new Error("This model is fixed to its registered project.");
    return model.projectId;
  }
  if (!requested) return null;
  if (access.role !== "super_admin" && !access.projects.some(project => project.id === requested)) throw new Error("You are not authorised for the selected project.");
  return requested;
}

function canAccessScenarioProject(access: Awaited<ReturnType<typeof requirePortalAccess>>, projectId: string | null) {
  return !projectId || access.role === "super_admin" || access.projects.some(project => project.id === projectId);
}

export async function createScenario(input: ScenarioInput) {
  const { access, model } = await authorisedModel(input.modelId);
  const name = cleanText(input.name, "Scenario name", 120);
  const notes = input.notes?.trim().slice(0, 2_000) || null;
  const state = validateModelState(model.adapterKey, validatedState(input.state));
  const projectId = scenarioProjectId(access, model, input.projectId);
  const version = await activeVersion(model.id);
  if (input.modelVersionId !== (version?.id ?? null)) throw new Error("Model version changed. Reload before creating a scenario.");
  const db = getDb();
  const scenarioId = randomUUID();
  const [created] = await db.batch([
    db.insert(modelScenarios).values({ id: scenarioId, modelId: model.id, modelVersionId: version?.id ?? null, projectId, name, notes, state, revision: 1, createdByUserId: access.userId, updatedByUserId: access.userId }).returning(),
    db.insert(scenarioRevisions).values({ scenarioId, revision: 1, modelVersionId: version?.id ?? null, state, notes, savedByUserId: access.userId }),
    db.insert(auditLogs).values({ actorUserId: access.userId, action: "create_model_scenario", entityType: "model_scenario", entityId: scenarioId, metadata: { modelId: model.id, modelVersionId: version?.id ?? null } }),
  ]);
  const scenario = created[0];
  if (!scenario) throw new Error("Scenario could not be created.");
  revalidatePath(`/portal/models/${model.id}`);
  revalidatePath("/portal/models");
  return { id: scenario.id, revision: 1, updatedAt: scenario.updatedAt.toISOString(), modelVersionId: version?.id ?? null };
}

export async function saveScenario(input: ScenarioInput & { scenarioId: string; expectedRevision: number }) {
  const { access, model } = await authorisedModel(input.modelId);
  const name = cleanText(input.name, "Scenario name", 120);
  const notes = input.notes?.trim().slice(0, 2_000) || null;
  const state = validateModelState(model.adapterKey, validatedState(input.state));
  const projectId = scenarioProjectId(access, model, input.projectId);
  const db = getDb();
  const scenario = await db.query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, input.scenarioId), eq(modelScenarios.modelId, model.id)) });
  if (!scenario || scenario.status !== "active" || !await canManageScenarioOrShared(access, scenario) || !canAccessScenarioProject(access, scenario.projectId)) throw new Error("This scenario is unavailable for editing.");
  if (input.expectedRevision !== scenario.revision) throw new Error("This scenario changed in another session. Reopen it or Save As before saving.");
  const version = await activeVersion(model.id);
  if (scenario.modelVersionId !== version?.id) throw new Error("This scenario belongs to an older model version. Save As a new scenario after reviewing compatibility; the original is preserved.");
  if (input.modelVersionId !== (version?.id ?? null)) throw new Error("Model version changed. Reload before saving.");
  const revision = scenario.revision + 1;
  const [updatedRows] = await db.batch([
    db.update(modelScenarios).set({ name, notes, state, projectId, revision, updatedByUserId: access.userId, updatedAt: new Date() }).where(and(eq(modelScenarios.id, scenario.id), eq(modelScenarios.revision, scenario.revision))).returning(),
    db.insert(scenarioRevisions).values({ scenarioId: scenario.id, revision, modelVersionId: scenario.modelVersionId, state, notes, savedByUserId: access.userId }),
    db.insert(auditLogs).values({ actorUserId: access.userId, action: "save_model_scenario", entityType: "model_scenario", entityId: scenario.id, metadata: { revision, modelId: model.id } }),
  ]);
  const updated = updatedRows[0];
  if (!updated) throw new Error("This scenario changed in another session. Reopen it before saving.");
  revalidatePath(`/portal/models/${model.id}`);
  return { id: scenario.id, revision, updatedAt: updated?.updatedAt.toISOString() ?? new Date().toISOString(), modelVersionId: version?.id ?? scenario.modelVersionId };
}

export async function getRevisionHistory(modelId: string, scenarioId: string) {
  const { access, model } = await authorisedModel(modelId);
  const scenario = await getDb().query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, scenarioId), eq(modelScenarios.modelId, model.id)) });
  if (!scenario || !await canManageScenarioOrShared(access, scenario) || !canAccessScenarioProject(access, scenario.projectId)) throw new Error("Scenario is unavailable.");
  const rows = await listScenarioRevisions(access, scenario.id);
  return rows.map(row => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

export async function archiveScenario(modelId: string, scenarioId: string) {
  const { access, model } = await authorisedModel(modelId);
  const db = getDb();
  const scenario = await db.query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, scenarioId), eq(modelScenarios.modelId, model.id)) });
  if (!scenario || !await canManageScenarioOrShared(access, scenario) || !canAccessScenarioProject(access, scenario.projectId)) throw new Error("This scenario is unavailable for archiving.");
  await db.update(modelScenarios).set({ status: "archived", updatedAt: new Date(), updatedByUserId: access.userId }).where(eq(modelScenarios.id, scenario.id));
  await db.insert(auditLogs).values({ actorUserId: access.userId, action: "archive_model_scenario", entityType: "model_scenario", entityId: scenario.id, metadata: { modelId } });
  revalidatePath(`/portal/models/${model.id}`);
  revalidatePath("/portal/models");
}
