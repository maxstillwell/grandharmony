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
  searchParams: Promise<{ project?: string }>;
}) {
  const access = await requirePortalAccess();
  const { project: requested } = await searchParams;
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
  try {
    data = await createSalesService(getSalesDb()).workspace(access, project.id);
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
      key={project.id}
      data={data}
      lifecycle={await loadLifecycle(access, project.id)}
      projectId={project.id}
      projectName={salesProjectName(project)}
      reviewPlan={
        canReviewSalesMap(access, project.id) ? sourcePlan : undefined
      }
      projects={projects.map((p) => ({ id: p.id, name: salesProjectName(p) }))}
    />
  );
}
