import { requirePortalAccess } from "@/lib/auth/guards";
import { Workspace } from "@/components/portal/workspace";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePortalAccess();
  return <Workspace projects={access.projects} admin={access.role === "super_admin"}>{children}</Workspace>;
}
