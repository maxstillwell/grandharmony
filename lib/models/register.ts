import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { modelRegistry, modelVersions, projects } from "@/lib/db/schema";

// Idempotent registration of this reviewed, user-supplied asset. No DDL or secrets.
export async function registerFeasibilityModel() {
  const db = getDb();
  const project = await db.query.projects.findFirst({ where: eq(projects.slug, "700-project") });
  if (!project) return;
  const existing = await db.query.modelRegistry.findFirst({ where: eq(modelRegistry.modelKey, "700-development-feasibility") });
  if (existing) {
    const version = await db.query.modelVersions.findFirst({ where: eq(modelVersions.modelId, existing.id) });
    if (version) return;
  }
  await db.insert(modelRegistry).values({ modelKey: "700-development-feasibility", adapterKey: "700-feasibility-v1", projectId: project.id, name: "700 Project · Development Feasibility", category: "development_feasibility", description: "User-supplied interactive AUD feasibility model: development costs, GST, tax, financing and sensitivity analysis. Assumptions require professional review.", status: "active" }).onConflictDoNothing();
  const model = await db.query.modelRegistry.findFirst({ where: eq(modelRegistry.modelKey, "700-development-feasibility") });
  if (model) await db.insert(modelVersions).values({ modelId: model.id, version: "1.0.0", notes: "Original Grand_Harmony_700_Feasibility.html supplied by the owner. Original formulas preserved." }).onConflictDoNothing();
}
