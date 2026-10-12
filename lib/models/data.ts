import { and, desc, eq, inArray } from "drizzle-orm";
import type { PortalAccess } from "@/lib/auth/access";
import { getDb } from "@/lib/db";
import { modelRegistry, modelScenarios, modelVersions, scenarioRevisions } from "@/lib/db/schema";
import { canManageScenario, canUseModel, canViewModel } from "@/lib/models/permissions";
import { registerFeasibilityModel } from "./register";

export type LibraryModel = {
  id: string;
  modelKey: string | null;
  adapterKey: string | null;
  projectId: string | null;
  name: string;
  category: string;
  description: string;
  status: "not_integrated" | "active" | "archived";
  updatedAt: Date;
  versionId: string | null;
  version: string | null;
};

export async function listAccessibleModels(access: PortalAccess) {
  if (access.role === "super_admin") await registerFeasibilityModel();
  const rows = await getDb().select({ id: modelRegistry.id, modelKey: modelRegistry.modelKey, adapterKey: modelRegistry.adapterKey, projectId: modelRegistry.projectId, name: modelRegistry.name, category: modelRegistry.category, description: modelRegistry.description, status: modelRegistry.status, updatedAt: modelRegistry.updatedAt, versionId: modelVersions.id, version: modelVersions.version }).from(modelRegistry).leftJoin(modelVersions, eq(modelVersions.modelId, modelRegistry.id)).orderBy(desc(modelVersions.createdAt));
  const newest = new Map<string, LibraryModel>();
  for (const model of rows as LibraryModel[]) {
    const previous = newest.get(model.id);
    if (!previous) newest.set(model.id, model);
  }
  return [...newest.values()].filter((model) => canViewModel(access, model));
}

export async function getAccessibleModel(access: PortalAccess, modelId: string) {
  const models = await listAccessibleModels(access);
  const model = models.find((item) => item.id === modelId) ?? null;
  return model && canUseModel(access, model) ? model : null;
}

export async function listAccessibleScenarios(access: PortalAccess, modelId: string) {
  if (!await getAccessibleModel(access, modelId)) return [];
  const rows = await getDb().select({ id: modelScenarios.id, name: modelScenarios.name, notes: modelScenarios.notes, state: modelScenarios.state, revision: modelScenarios.revision, status: modelScenarios.status, modelVersionId: modelScenarios.modelVersionId, projectId: modelScenarios.projectId, createdByUserId: modelScenarios.createdByUserId, createdAt: modelScenarios.createdAt, updatedAt: modelScenarios.updatedAt }).from(modelScenarios).where(and(eq(modelScenarios.modelId, modelId), eq(modelScenarios.status, "active"))).orderBy(desc(modelScenarios.updatedAt));
  return rows.filter((scenario) => canManageScenario(access, scenario.createdByUserId));
}

export async function listScenarioRevisions(access: PortalAccess, scenarioId: string) {
  const scenario = await getDb().query.modelScenarios.findFirst({ where: eq(modelScenarios.id, scenarioId) });
  if (!scenario || !await getAccessibleModel(access, scenario.modelId) || !canManageScenario(access, scenario.createdByUserId)) return [];
  return getDb().select({ id: scenarioRevisions.id, revision: scenarioRevisions.revision, createdAt: scenarioRevisions.createdAt, savedByUserId: scenarioRevisions.savedByUserId, notes: scenarioRevisions.notes }).from(scenarioRevisions).where(eq(scenarioRevisions.scenarioId, scenarioId)).orderBy(desc(scenarioRevisions.revision)).limit(20);
}

export async function scenarioModelsForAccess(access: PortalAccess, scenarioIds: string[]) {
  if (!scenarioIds.length) return [];
  const rows = await getDb().select({ id: modelScenarios.id, modelId: modelScenarios.modelId }).from(modelScenarios).where(inArray(modelScenarios.id, scenarioIds));
  const accessible = await listAccessibleModels(access);
  const ids = new Set(accessible.map((model) => model.id));
  return rows.filter((row) => ids.has(row.modelId));
}
