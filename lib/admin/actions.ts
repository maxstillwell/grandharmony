"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getDb } from "@/lib/db";
import { auditLogs, projectMemberships, roles, userRoles, users } from "@/lib/db/schema";

export async function setUserActive(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId"));
  const isActive = formData.get("isActive") === "true";
  if (userId === admin.userId && !isActive) throw new Error("A Super Admin cannot deactivate their own account.");
  const db = getDb();
  await db.update(users).set({ isActive, updatedAt: new Date() }).where(eq(users.id, userId));
  await db.insert(auditLogs).values({ actorUserId: admin.userId, action: isActive ? "activate_user" : "deactivate_user", entityType: "user", entityId: userId });
  revalidatePath("/admin");
}

export async function assignUserRole(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId"));
  const roleId = String(formData.get("roleId"));
  const db = getDb();
  const role = await db.query.roles.findFirst({ where: eq(roles.id, roleId) });
  if (!role) throw new Error("Role not found.");
  await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
  await db.insert(auditLogs).values({ actorUserId: admin.userId, action: "assign_role", entityType: "user_role", entityId: userId, metadata: { role: role.name } });
  revalidatePath("/admin");
}

export async function grantProjectAccess(formData: FormData) {
  const admin = await requireSuperAdmin();
  const userId = String(formData.get("userId"));
  const projectId = String(formData.get("projectId"));
  const role = formData.get("role") as "management" | "project_manager" | "finance" | "sales_manager" | "external_agent" | "super_admin";
  const canManage = formData.get("canManage") === "true";
  const db = getDb();
  await db.insert(projectMemberships).values({ userId, projectId, role, canManage }).onConflictDoUpdate({ target: [projectMemberships.projectId, projectMemberships.userId], set: { role, canManage, updatedAt: new Date() } });
  await db.insert(auditLogs).values({ actorUserId: admin.userId, action: "grant_project_access", entityType: "project_membership", entityId: projectId, metadata: { userId, role, canManage } });
  revalidatePath("/admin");
}
