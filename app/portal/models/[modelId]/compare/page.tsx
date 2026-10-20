import { notFound } from "next/navigation";
import { ScenarioComparison } from "@/components/models/scenario-comparison";
import { requirePortalAccess } from "@/lib/auth/guards";
import { getAccessibleModel, listAccessibleScenarios } from "@/lib/models/data";

export default async function ScenarioComparisonPage({ params }: { params: Promise<{ modelId: string }> }) {
  const access = await requirePortalAccess();
  const { modelId } = await params;
  const model = await getAccessibleModel(access, modelId);
  if (!model || !["700-feasibility-v1", "interactive-specification-v1"].includes(model.adapterKey ?? "")) notFound();
  const scenarios = await listAccessibleScenarios(access, model.id);
  return <ScenarioComparison modelId={model.id} modelName={model.name} adapterKey={model.adapterKey} scenarios={scenarios.map((scenario) => ({ id: scenario.id, name: scenario.name, revision: scenario.revision, modelVersionId: scenario.modelVersionId, updatedAt: scenario.updatedAt.toISOString(), state: scenario.state }))} />;
}
