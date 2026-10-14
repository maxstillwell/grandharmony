import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modelRegistry, modelVersions } from "@/lib/db/schema";

// Idempotent registration of reviewed, user-supplied assets. No DDL or secrets.
export async function registerFeasibilityModel() {
  const db = getDb();
  const existing = await db.query.modelRegistry.findFirst({ where: eq(modelRegistry.modelKey, "700-development-feasibility") });
  if (existing) {
    await db.update(modelRegistry).set({ projectId: null, name: "Development Feasibility", category: "development_feasibility", description: "User-supplied interactive AUD feasibility model: development costs, GST, tax, financing and sensitivity analysis. Choose a project when saving a scenario. Assumptions require professional review.", status: "active", updatedAt: new Date() }).where(eq(modelRegistry.id, existing.id));
    const version = await db.query.modelVersions.findFirst({ where: eq(modelVersions.modelId, existing.id) });
    if (version) return;
  }
  await db.insert(modelRegistry).values({ modelKey: "700-development-feasibility", adapterKey: "700-feasibility-v1", projectId: null, name: "Development Feasibility", category: "development_feasibility", description: "User-supplied interactive AUD feasibility model: development costs, GST, tax, financing and sensitivity analysis. Choose a project when saving a scenario. Assumptions require professional review.", status: "active" }).onConflictDoNothing();
  const model = await db.query.modelRegistry.findFirst({ where: eq(modelRegistry.modelKey, "700-development-feasibility") });
  if (model) await db.insert(modelVersions).values({ modelId: model.id, version: "1.0.0", notes: "Original Grand_Harmony_700_Feasibility.html supplied by the owner. Original formulas preserved." }).onConflictDoNothing();
}

export async function registerSpecificationModel() {
  const db = getDb();
  await db.insert(modelRegistry).values({ modelKey: "interactive-specification", adapterKey: "interactive-specification-v1", projectId: null, name: "Interactive Specification", category: "specifications", description: "User-supplied editable schedule of finishes and inclusions. Choose a project when saving a scenario; item-level reference images and status controls are retained.", status: "active" }).onConflictDoNothing();
  const model = await db.query.modelRegistry.findFirst({ where: eq(modelRegistry.modelKey, "interactive-specification") });
  if (model) await db.insert(modelVersions).values({ modelId: model.id, version: "1.0.0", notes: "Portal-native integration of the owner-supplied 700 Project Interactive Specification. Original fields and reference-image data retained; legacy standalone styling is not used." }).onConflictDoNothing();
}

export async function registerPlatformModels() {
  const db = getDb();
  // The old generic state adapter was useful only for Phase 3 platform tests.
  // Archive it instead of deleting historical rows or audit evidence.
  await db.update(modelRegistry).set({ status: "archived", updatedAt: new Date() }).where(eq(modelRegistry.modelKey, "scenario-state-test"));
  await registerFeasibilityModel();
  await registerSpecificationModel();
}
