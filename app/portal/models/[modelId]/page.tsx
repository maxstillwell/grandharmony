import { notFound } from "next/navigation";
import { ScenarioRunner } from "@/components/models/scenario-runner";
import { requirePortalAccess } from "@/lib/auth/guards";
import { getAccessibleModel, listAccessibleScenarios } from "@/lib/models/data";

export default async function ModelRunnerPage({ params }: { params: Promise<{ modelId: string }> }) {
  const access = await requirePortalAccess();
  const { modelId } = await params;
  const model = await getAccessibleModel(access, modelId);
  if (!model || model.adapterKey !== "scenario-state-test") notFound();
  const scenarios = await listAccessibleScenarios(access, model.id);
  const projectName = access.projects.find((project) => project.id === model.projectId)?.name ?? null;
  return <ScenarioRunner model={{ id: model.id, name: model.name, description: model.description, version: model.version, versionId: model.versionId, projectName, category: model.category }} initialScenarios={scenarios.map((scenario) => ({ id: scenario.id, name: scenario.name, notes: scenario.notes, state: scenario.state, revision: scenario.revision, updatedAt: scenario.updatedAt.toISOString(), modelVersionId: scenario.modelVersionId }))} />;
}
