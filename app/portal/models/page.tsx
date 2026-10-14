import Link from "next/link";
import { requirePortalAccess } from "@/lib/auth/guards";
import { listAccessibleModels, listAccessibleScenarios } from "@/lib/models/data";
import { modelCategories } from "@/lib/models/types";
import { ArrowUpRight, Layers3 } from "lucide-react";

const labels: Record<string, string> = { financial_models: "Financial Models", sales_strategy: "Sales Strategy", development_feasibility: "Development Feasibility", investment_analysis: "Investment Analysis", property_management: "Property Management", specifications: "Specifications", other_tools: "Other Tools" };

export default async function ModelLibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; project?: string }> }) {
  const access = await requirePortalAccess();
  const filters = await searchParams;
  const models = await listAccessibleModels(access);
  const query = filters.q?.trim().toLowerCase() ?? "";
  const filtered = models.filter(model => (!query || `${model.name} ${model.description} ${model.modelKey ?? ""}`.toLowerCase().includes(query)) && (!filters.category || model.category === filters.category) && (!filters.project || model.projectId === filters.project));
  const scenarioLists = await Promise.all(filtered.map(async model => [model.id, await listAccessibleScenarios(access, model.id)] as const));
  const counts = new Map(scenarioLists.map(([id, list]) => [id, list.length]));
  return <main className="portal-page"><div className="portal-page-inner">
    <header className="portal-page-title"><p className="portal-kicker">Grand Harmony / Analysis workspace</p><h1>Model Library.</h1><p>A considered collection of tools. Explore assumptions, compare possibilities and keep your analysis in one place.</p><div className="portal-page-stats"><span><strong>{models.length}</strong>Available models</span><span><strong>{access.projects.length}</strong>Authorised projects</span><span><strong>{scenarioLists.reduce((sum, [, list]) => sum + list.length, 0)}</strong>Saved scenarios</span></div><svg className="portal-line-motif" width="210" height="70" viewBox="0 0 210 70" aria-hidden="true"><path d="M5 53h82c24 0 25-34 50-34h63M35 63h61c27 0 31-34 54-34h50" fill="none" stroke="currentColor" strokeWidth=".7" /></svg></header>
    <form className="library-filters"><input aria-label="Search models" name="q" defaultValue={filters.q} placeholder="Search models or descriptions" /><select aria-label="Model category" name="category" defaultValue={filters.category ?? ""}><option value="">All categories</option>{modelCategories.map(category => <option value={category} key={category}>{labels[category]}</option>)}</select><select aria-label="Project scope" name="project" defaultValue={filters.project ?? ""}><option value="">All projects / general tools</option>{access.projects.map(project => <option value={project.id} key={project.id}>{project.name}</option>)}</select><button className="portal-button">Apply filters</button></form>
    <section className="model-library-grid" aria-label="Available models">{filtered.map(model => {
      const project = access.projects.find(item => item.id === model.projectId);
      const native = model.adapterKey === "700-feasibility-v1" || model.adapterKey === "interactive-specification-v1";
      const canOpen = model.status === "active" && native;
      return <article className="library-model-card" key={model.id}><div className="flex items-center justify-between gap-3"><span className="portal-badge">{labels[model.category] ?? model.category}</span><Layers3 size={19} className="text-[#b4ab94]" /></div><h2>{model.name}</h2><p>{model.description}</p><dl><div><dt>Project</dt><dd>{project?.name ?? "General tool"}</dd></div><div><dt>Version / presentation</dt><dd>{model.version ?? "—"} · {native ? "Portal Native" : "Pending integration"}</dd></div><div><dt>Last updated</dt><dd>{model.updatedAt.toLocaleDateString("en-AU")}</dd></div><div><dt>Private scenarios</dt><dd>{counts.get(model.id) ?? 0} saved</dd></div></dl><footer>{canOpen ? <Link className="portal-button" href={`/portal/models/${model.id}`}>Open workspace <ArrowUpRight size={13} /></Link> : <span className="portal-badge">{model.status.replaceAll("_", " ")}</span>}<a className="portal-button" href="#saved-scenarios">View scenarios</a></footer><p className="mt-4 text-[9px] text-[#a0a28c]">ID · {model.modelKey ?? model.id}</p></article>;
    })}</section>{!filtered.length && <p className="portal-empty">No models match your current access and filters.</p>}
    <section id="saved-scenarios" className="portal-card mt-8"><div className="portal-section-title"><div><p className="portal-kicker">Your analysis archive</p><h2>Saved Scenarios</h2></div><Link className="portal-button" href="/portal">Project Overview →</Link></div><p className="portal-helper">Only scenarios within your authorised scope are displayed.</p><div>{scenarioLists.flatMap(([modelId, list]) => list.map(scenario => <Link key={scenario.id} href={`/portal/models/${modelId}?scenario=${scenario.id}`} className="flex flex-wrap justify-between gap-3 border-b border-[#e7e4dc] py-4 text-xs"><span>{scenario.name}<small className="ml-3 text-[#929580]">{filtered.find(model => model.id === modelId)?.name}</small></span><span className="text-[#8b8f78]">Revision {scenario.revision} · {scenario.updatedAt.toLocaleDateString("en-AU")} · Open →</span></Link>))}</div></section>
  </div></main>;
}
