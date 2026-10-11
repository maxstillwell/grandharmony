"use server";

import { timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { isBootstrapSetupConfigured } from "@/lib/auth/access";
import { hashPassword } from "@/lib/auth/password";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { auditLogs, projectMemberships, projects, roles, userRoles, users } from "@/lib/db/schema";

function safeEqual(value: string, expected: string | undefined) {
  if (!expected) return false;
  const valueBuffer = Buffer.from(value);
  const expectedBuffer = Buffer.from(expected);
  return valueBuffer.length === expectedBuffer.length && timingSafeEqual(valueBuffer, expectedBuffer);
}

export async function initializeSuperAdmin(formData: FormData) {
  if (!isBootstrapSetupConfigured() || !isDatabaseConfigured()) throw new Error("Administrator setup is unavailable.");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const token = String(formData.get("token") ?? "");
  if (email !== process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase()) throw new Error("Invalid setup details.");
  if (!safeEqual(token, process.env.BOOTSTRAP_ADMIN_TOKEN)) throw new Error("Invalid setup details.");
  if (password !== confirmPassword) throw new Error("Passwords do not match.");

  const db = getDb();
  const superAdmin = await db.query.roles.findFirst({ where: eq(roles.name, "super_admin") });
  if (superAdmin) {
    const assignment = await db.query.userRoles.findFirst({ where: eq(userRoles.roleId, superAdmin.id) });
    if (assignment) throw new Error("A Super Admin already exists. Use the admin interface for further changes.");
  }
  const [role] = await db.insert(roles).values({ name: "super_admin", description: "Final authority for Grand Harmony operational data." }).onConflictDoNothing().returning();
  const roleRecord = role ?? await db.query.roles.findFirst({ where: eq(roles.name, "super_admin") });
  if (!roleRecord) throw new Error("Could not establish the Super Admin role.");
  const passwordHash = hashPassword(password);
  const [user] = await db.insert(users).values({ email, passwordHash, emailVerified: new Date(), isActive: true }).onConflictDoUpdate({ target: users.email, set: { passwordHash, updatedAt: new Date(), isActive: true } }).returning();
  const userRecord = user ?? await db.query.users.findFirst({ where: eq(users.email, email) });
  if (!userRecord) throw new Error("Could not establish the Super Admin user.");
  await db.insert(userRoles).values({ userId: userRecord.id, roleId: roleRecord.id }).onConflictDoNothing();
  const activeProjects = await db.select({ id: projects.id }).from(projects).where(eq(projects.isActive, true));
  if (activeProjects.length) await db.insert(projectMemberships).values(activeProjects.map((project) => ({ projectId: project.id, userId: userRecord.id, role: "super_admin" as const, canManage: true }))).onConflictDoNothing();
  await db.insert(auditLogs).values({ actorUserId: userRecord.id, action: "bootstrap_super_admin", entityType: "user", entityId: userRecord.id, metadata: { source: "protected_password_bootstrap" } });
  redirect("/login?initialized=1");
}
