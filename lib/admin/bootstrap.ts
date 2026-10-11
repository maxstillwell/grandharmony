"use server";

import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { isBootstrapIdentity } from "@/lib/auth/access";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { auditLogs, projectMemberships, projects, roles, userRoles, users } from "@/lib/db/schema";

export async function initializeSuperAdmin(formData: FormData) {
  const session = await auth();
  const email = session?.user?.email;
  if (!await isBootstrapIdentity(email)) throw new Error("Bootstrap identity is not authorised.");
  if (formData.get("token") !== process.env.BOOTSTRAP_ADMIN_TOKEN) throw new Error("Invalid bootstrap token.");
  if (!isDatabaseConfigured()) throw new Error("Database is not configured.");
  const db = getDb();
  const superAdmin = await db.query.roles.findFirst({ where: eq(roles.name, "super_admin") });
  if (superAdmin) {
    const assignment = await db.query.userRoles.findFirst({ where: eq(userRoles.roleId, superAdmin.id) });
    if (assignment) throw new Error("A Super Admin already exists. Use the admin interface for further changes.");
  }
  const [role] = await db.insert(roles).values({ name: "super_admin", description: "Final authority for Grand Harmony operational data." }).onConflictDoNothing().returning();
  const roleRecord = role ?? await db.query.roles.findFirst({ where: eq(roles.name, "super_admin") });
  if (!roleRecord || !email) throw new Error("Could not establish the Super Admin role.");
  const [user] = await db.insert(users).values({ email, name: session.user?.name, image: session.user?.image, emailVerified: new Date(), isActive: true }).onConflictDoUpdate({ target: users.email, set: { name: session.user?.name, image: session.user?.image, updatedAt: new Date(), isActive: true } }).returning();
  const userRecord = user ?? await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!userRecord) throw new Error("Could not establish the Super Admin user.");
  await db.insert(userRoles).values({ userId: userRecord.id, roleId: roleRecord.id }).onConflictDoNothing();
  const activeProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.isActive, true));
  if (activeProjects.length) await db.insert(projectMemberships).values(activeProjects.map((project) => ({ projectId: project.id, userId: userRecord.id, role: "super_admin" as const, canManage: true }))).onConflictDoNothing();
  await db.insert(auditLogs).values({ actorUserId: userRecord.id, action: "bootstrap_super_admin", entityType: "user", entityId: userRecord.id, metadata: { source: "protected_bootstrap" } });
}
