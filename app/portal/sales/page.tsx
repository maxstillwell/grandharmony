import {createResidenceMediaService} from "@/lib/sales/media-service";
import { createPlatformService } from "@/lib/sales/platform-service";
import { resolveSalesScope } from "@/lib/sales/workspace-scope";
import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/guards";
import { canSales } from "@/lib/sales/permissions";
import {
  canReviewSalesMap,
  chooseSalesProject,
  salesProjectName,
} from "@/lib/sales/projects";
import sourcePlan from "@/assets/sales/golfview-review/plan.json";
import { createSalesService } from "@/lib/sales/service";
import { getSalesDb } from "@/lib/sales/db";
import { SalesWorkspace } from "@/components/sales/workspace";
import { loadLifecycle } from "@/lib/sales/lifecycle-access";

export const metadata = { title: "Sales Management | Grand Harmony" };
export default async function SalesManagement({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; mode?: string; tab?:string; residence?:string }>;
}) {
  const access = await requirePortalAccess();
  const { project: requested, mode,tab,residence } = await searchParams;
  const projects = access.projects.filter((p) =>
    canSales(access, p.id, "inventory.view"),
  );
  const project = chooseSalesProject(projects, requested);
  if (!project) {
    if (requested) notFound();
    return (
      <main className="portal-page">
        <section className="portal-card">
          <h1>Sales Management</h1>
          <p className="portal-helper">
            No sales projects are assigned to your account. Ask an administrator
            to review project membership and sales permissions.
          </p>
        </section>
      </main>
    );
  }
  let data;
  let scopeKey = "real";
  try {
    scopeKey = await resolveSalesScope(
      getSalesDb(),
      access,
      project.id,
      mode === "demo",
    );
    data = await createSalesService(getSalesDb(), scopeKey).workspace(
      access,
      project.id,
    );
  } catch {
    return (
      <main className="portal-page">
        <section className="portal-card">
          <h1>Sales workspace unavailable</h1>
          <p className="portal-helper">
            The sales connection could not be verified. No changes were saved.
            Other Portal modules remain available.
          </p>
        </section>
      </main>
    );
  }
  return (
    <SalesWorkspace
      key={`${project.id}-${scopeKey}`}
      demo={scopeKey !== "real"}
      initialTab={tab==="Media"?"Media / Revisions":undefined}
      initialMediaNumber={residence}
      media={canSales(access,project.id,"inventory.edit")?await createResidenceMediaService(getSalesDb(),scopeKey).workspace(access,project.id):undefined}
      platform={
        canSales(access, project.id, "deals.view")
          ? await createPlatformService(getSalesDb(), scopeKey).workspace(
              access,
              project.id,
            )
          : undefined
      }
      data={data}
      lifecycle={await loadLifecycle(access, project.id, scopeKey)}
      projectId={project.id}
      projectName={salesProjectName(project)}
      reviewPlan={
        canReviewSalesMap(access, project.id) ? sourcePlan : undefined
      }
      projects={projects.map((p) => ({ id: p.id, name: salesProjectName(p) }))}
    />
  );
}
