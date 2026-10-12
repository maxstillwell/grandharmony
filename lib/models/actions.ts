"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePortalAccess } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { auditLogs, modelRegistry, modelScenarios, modelVersions, scenarioRevisions } from "@/lib/db/schema";
import { getAccessibleModel } from "@/lib/models/data";
import { canManageScenario } from "@/lib/models/permissions";
import type { ModelState } from "@/lib/models/types";

type ScenarioInput = { modelId: string; name: string; notes?: string; state: ModelState };

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

export async function createScenario(input: ScenarioInput) {
  const { access, model } = await authorisedModel(input.modelId);
  const name = cleanText(input.name, "Scenario name", 120);
  const notes = input.notes?.trim().slice(0, 2_000) || null;
  const state = validatedState(input.state);
  const version = await activeVersion(model.id);
  const db = getDb();
  const [scenario] = await db.insert(modelScenarios).values({ modelId: model.id, modelVersionId: version?.id ?? null, projectId: model.projectId, name, notes, state, revision: 1, createdByUserId: access.userId, updatedByUserId: access.userId }).returning();
  if (!scenario) throw new Error("Scenario could not be created.");
  await db.insert(scenarioRevisions).values({ scenarioId: scenario.id, revision: 1, modelVersionId: version?.id ?? null, state, notes, savedByUserId: access.userId });
  await db.insert(auditLogs).values({ actorUserId: access.userId, action: "create_model_scenario", entityType: "model_scenario", entityId: scenario.id, metadata: { modelId: model.id, modelVersionId: version?.id ?? null } });
  revalidatePath(`/portal/models/${model.id}`);
  revalidatePath("/portal/models");
  return { id: scenario.id, revision: 1, updatedAt: scenario.updatedAt.toISOString(), modelVersionId: version?.id ?? null };
}

export async function saveScenario(input: ScenarioInput & { scenarioId: string }) {
  const { access, model } = await authorisedModel(input.modelId);
  const name = cleanText(input.name, "Scenario name", 120);
  const notes = input.notes?.trim().slice(0, 2_000) || null;
  const state = validatedState(input.state);
  const db = getDb();
  const scenario = await db.query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, input.scenarioId), eq(modelScenarios.modelId, model.id)) });
  if (!scenario || scenario.status !== "active" || !canManageScenario(access, scenario.createdByUserId)) throw new Error("This scenario is unavailable for editing.");
  const version = await activeVersion(model.id);
  const revision = scenario.revision + 1;
  const [updated] = await db.update(modelScenarios).set({ name, notes, state, revision, modelVersionId: version?.id ?? scenario.modelVersionId, updatedByUserId: access.userId, updatedAt: new Date() }).where(eq(modelScenarios.id, scenario.id)).returning();
  await db.insert(scenarioRevisions).values({ scenarioId: scenario.id, revision, modelVersionId: version?.id ?? scenario.modelVersionId, state, notes, savedByUserId: access.userId });
  await db.insert(auditLogs).values({ actorUserId: access.userId, action: "save_model_scenario", entityType: "model_scenario", entityId: scenario.id, metadata: { revision, modelId: model.id } });
  revalidatePath(`/portal/models/${model.id}`);
  return { id: scenario.id, revision, updatedAt: updated?.updatedAt.toISOString() ?? new Date().toISOString(), modelVersionId: version?.id ?? scenario.modelVersionId };
}

export async function archiveScenario(modelId: string, scenarioId: string) {
  const { access, model } = await authorisedModel(modelId);
  const db = getDb();
  const scenario = await db.query.modelScenarios.findFirst({ where: and(eq(modelScenarios.id, scenarioId), eq(modelScenarios.modelId, model.id)) });
  if (!scenario || !canManageScenario(access, scenario.createdByUserId)) throw new Error("This scenario is unavailable for archiving.");
  await db.update(modelScenarios).set({ status: "archived", updatedAt: new Date(), updatedByUserId: access.userId }).where(eq(modelScenarios.id, scenario.id));
  await db.insert(auditLogs).values({ actorUserId: access.userId, action: "archive_model_scenario", entityType: "model_scenario", entityId: scenario.id, metadata: { modelId } });
  revalidatePath(`/portal/models/${model.id}`);
  revalidatePath("/portal/models");
}
