import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/guards";
import { canSales } from "@/lib/sales/permissions";
import { createSalesService } from "@/lib/sales/service";
import { getSalesDb } from "@/lib/sales/db";
import { SalesWorkspace } from "@/components/sales/workspace";

export const metadata = { title: "Golfview Sales Management | Grand Harmony" };

export default async function GolfviewSalesManagement({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const access = await requirePortalAccess();
  const { projectId } = await params;
  const project = access.projects.find((item) => item.id === projectId);
  if (!project || !canSales(access, projectId, "inventory.view")) notFound();
  let data;
  try {
    data = await createSalesService(getSalesDb()).workspace(access, projectId);
  } catch {
    return (
      <main className="portal-page">
        <section className="portal-card">
          <h1>Sales workspace is not ready</h1>
          <p>
            The database connection or additive sales migration has not been
            verified. Existing Portal modules remain independent. Ask an
            administrator to inspect migration status before enabling this
            workspace.
          </p>
        </section>
      </main>
    );
  }
  return (
    <SalesWorkspace
      data={data}
      projectId={projectId}
      projectName={project.name}
    />
  );
}
