import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/guards";

export const metadata = { title: "Golfview Sales Management | Grand Harmony" };

export default async function GolfviewSalesManagement({ params }: { params: Promise<{ projectId: string }> }) {
  const access = await requirePortalAccess();
  const { projectId } = await params;
  const project = access.projects.find((item) => item.id === projectId);
  if (!project || project.slug !== "700-project") notFound();
  // Deliberately do not read financial models or expose private inventory:
  // live sales schema, real unit schedule and sales authorisation remain pending.
  if (!["super_admin", "management", "project_manager", "sales_manager"].includes(access.role)) notFound();
  return <main className="portal-page"><div className="portal-page-inner">
    <header className="portal-page-title">
      <p className="portal-kicker">Grand Harmony / Golfview</p>
      <h1>Sales Management</h1>
      <p>700 Project · Inventory, publishing and customer management workspace.</p>
    </header>
    <section className="portal-card">
      <p className="portal-kicker">Foundation only</p>
      <h2>Inventory &amp; publishing</h2>
      <p className="portal-helper">The canonical 47-unit inventory is not yet imported. No sales prices, customer records or statuses are fabricated. Editable inventory and controlled publishing activate only after the reviewed Neon migration and project-specific permissions are in place.</p>
      <p className="portal-helper">The isolated 2D prototype currently uses clearly marked test geometry and is not a live sales channel.</p>
      <div className="mt-5"><Link className="portal-button" href="/demo/700-explorer">Open 2D test explorer →</Link></div>
    </section>
  </div></main>;
}
