import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { projectMemberships, projects, roles, userRoles, users } from "@/lib/db/schema";

export type PortalAccess = { userId: string; email: string; name: string | null; role: string; projects: Array<{ id: string; name: string; slug: string; membershipRole: string; canManage: boolean }> };

export async function getPortalAccess(email: string): Promise<PortalAccess | null> {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!user?.isActive) return null;
  const assignedRoles = await db.select({ name: roles.name }).from(userRoles).innerJoin(roles, eq(userRoles.roleId, roles.id)).where(eq(userRoles.userId, user.id));
  if (!assignedRoles.length) return null;
  const memberships = await db.select({ id: projects.id, name: projects.name, slug: projects.slug, membershipRole: projectMemberships.role, canManage: projectMemberships.canManage }).from(projectMemberships).innerJoin(projects, eq(projectMemberships.projectId, projects.id)).where(and(eq(projectMemberships.userId, user.id), eq(projects.isActive, true)));
  return { userId: user.id, email: user.email, name: user.name, role: assignedRoles[0].name, projects: memberships };
}

export async function isBootstrapIdentity(email: string | null | undefined) {
  return Boolean(process.env.BOOTSTRAP_ADMIN_EMAIL && process.env.BOOTSTRAP_ADMIN_TOKEN && email && email.toLowerCase() === process.env.BOOTSTRAP_ADMIN_EMAIL.toLowerCase());
}
