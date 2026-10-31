import { notFound, redirect } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/guards";
import { canSales } from "@/lib/sales/permissions";
export default async function LegacySales({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const access = await requirePortalAccess();
  const { projectId } = await params;
  if (!canSales(access, projectId, "inventory.view")) notFound();
  redirect(`/portal/sales?project=${encodeURIComponent(projectId)}`);
}
