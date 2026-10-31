import { requirePortalAccess } from "@/lib/auth/guards";
import { Workspace } from "@/components/portal/workspace";
import { canSales } from "@/lib/sales/permissions";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requirePortalAccess();
  return (
    <Workspace
      projects={access.projects}
      admin={access.role === "super_admin"}
      sales={access.projects.some((p) =>
        canSales(access, p.id, "inventory.view"),
      )}
    >
      {children}
    </Workspace>
  );
}
