import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { projectMemberships, projects, roles, userRoles, users } from "@/lib/db/schema";
import { effectiveRole } from "./roles";

export type PortalAccess = { userId: string; email: string; name: string | null; role: string; roles?: string[]; projects: Array<{ id: string; name: string; slug: string; membershipRole: string; canManage: boolean }> };

export async function getPortalAccess(email: string): Promise<PortalAccess | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user?.isActive) return null;
  const assignedRoles = await db.select({ name: roles.name }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, user.id));
  const roleNames = assignedRoles.map(item => item.name);
  const role = effectiveRole(roleNames);
  if (!role) return null;
  const memberships = await db.select({ id: projects.id, name: projects.name, slug: projects.slug, membershipRole: projectMemberships.role, canManage: projectMemberships.canManage }).from(projectMemberships).innerJoin(projects, eq(projectMemberships.projectId, projects.id)).where(and(eq(projectMemberships.userId, user.id), eq(projects.isActive, true)));
  return { userId: user.id, email: user.email, name: user.name, role, roles: roleNames, projects: memberships };
}

export function isBootstrapSetupConfigured() {
  return Boolean(process.env.AUTH_SECRET && process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_TOKEN);
}
