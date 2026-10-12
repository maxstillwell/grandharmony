import { notFound } from "next/navigation";
import { ScenarioRunner } from "@/components/models/scenario-runner";
import { requirePortalAccess } from "@/lib/auth/guards";
import { getAccessibleModel, listAccessibleScenarios } from "@/lib/models/data";
import { feasibilityDefaults } from "@/lib/models/feasibility-defaults";

export default async function ModelRunnerPage({ params, searchParams }: { params: Promise<{ modelId: string }>; searchParams: Promise<{ scenario?: string }> }) {
  const access = await requirePortalAccess();
  const { modelId } = await params;
  const model = await getAccessibleModel(access, modelId);
  if (!model || !["scenario-state-test", "700-feasibility-v1"].includes(model.adapterKey ?? "")) notFound();
  const scenarios = await listAccessibleScenarios(access, model.id);
  const { scenario } = await searchParams;
  if (scenario && !scenarios.some(item => item.id === scenario)) notFound();
  const projectName = access.projects.find((project) => project.id === model.projectId)?.name ?? null;
  return <ScenarioRunner key={model.id} defaults={model.adapterKey === "700-feasibility-v1" ? feasibilityDefaults : undefined} initialScenarioId={scenario} model={{ id: model.id, name: model.name, description: model.description, version: model.version, versionId: model.versionId, projectName, category: model.category, adapterKey: model.adapterKey }} initialScenarios={scenarios.map((scenario) => ({ id: scenario.id, name: scenario.name, notes: scenario.notes, state: scenario.state, revision: scenario.revision, updatedAt: scenario.updatedAt.toISOString(), modelVersionId: scenario.modelVersionId }))} />;
}
