import type { PortalAccess } from "../auth/access";

export const salesPermissions = [
  "inventory.view",
  "inventory.edit",
  "prices.view",
  "prices.edit",
  "publicPrices.edit",
  "status.edit",
  "crm.view",
  "crm.edit",
  "leads.assign",
  "publication.approve",
  "publication.publish",
  "audit.view",
  "settings.edit",
  "crm.export",
] as const;
export type SalesPermission = (typeof salesPermissions)[number];
const grants: Record<string, readonly SalesPermission[]> = {
  super_admin: salesPermissions,
  management: salesPermissions,
  project_manager: [
    "inventory.view",
    "inventory.edit",
    "publicPrices.edit",
    "status.edit",
    "crm.view",
    "crm.edit",
    "leads.assign",
    "audit.view",
    "crm.export",
  ],
  finance: ["inventory.view", "prices.view", "prices.edit", "audit.view"],
  sales_manager: [
    "inventory.view",
    "inventory.edit",
    "publicPrices.edit",
    "status.edit",
    "crm.view",
    "crm.edit",
    "leads.assign",
    "crm.export",
  ],
  external_agent: ["inventory.view", "crm.view", "crm.edit"],
};

// Project membership is mandatory, including for administrators. A global role
// cannot upgrade a restricted project assignment. canManage alone grants nothing.
export function canSales(
  access: PortalAccess,
  projectId: string,
  permission: SalesPermission,
) {
  const membership = access.projects.find((p) => p.id === projectId);
  if (!membership) return false;
  const assigned = access.roles ?? [access.role];
  return Boolean(
    grants[membership.membershipRole]?.includes(permission) &&
      assigned.some((role) => grants[role]?.includes(permission)),
  );
}
export function assertSales(
  access: PortalAccess,
  projectId: string,
  permission: SalesPermission,
) {
  if (!canSales(access, projectId, permission))
    throw new Error("Not authorised for this project or operation.");
}
export function isAgent(access: PortalAccess, projectId: string) {
  return (
    access.projects.find((p) => p.id === projectId)?.membershipRole ===
      "external_agent" ||
    (access.roles ?? [access.role]).every((role) => role === "external_agent")
  );
}
