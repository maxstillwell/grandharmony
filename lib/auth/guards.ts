import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getPortalAccess, type PortalAccess } from "@/lib/auth/access";

export async function requirePortalAccess(): Promise<PortalAccess> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) redirect("/login?reason=signin_required");
  const access = await getPortalAccess(email);
  if (access) return access;
  redirect("/login?reason=unauthorized");
}

export async function requireSuperAdmin() {
  const access = await requirePortalAccess();
  if (access.role !== "super_admin") redirect("/portal?reason=admin_required");
  return access;
}
