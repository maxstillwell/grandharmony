import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPortalAccess, isBootstrapIdentity, type PortalAccess } from "@/lib/auth/access";

export async function requirePortalAccess(): Promise<PortalAccess> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login?reason=signin_required");
  const access = await getPortalAccess(email);
  if (access) return access;
  if (await isBootstrapIdentity(email)) redirect("/admin/initialize");
  redirect("/login?reason=unauthorized");
}

export async function requireSuperAdmin() {
  const access = await requirePortalAccess();
  if (access.role !== "super_admin") redirect("/portal?reason=admin_required");
  return access;
}
