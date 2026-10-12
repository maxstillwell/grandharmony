import type { PortalAccess } from "@/lib/auth/access";

type ModelPermissionInput = { projectId: string | null; category: string; status: string };

export function canUseModel(access: PortalAccess, model: ModelPermissionInput) {
  return model.status === "active" && canViewModel(access, model);
}

export function canViewModel(access: PortalAccess, model: ModelPermissionInput) {
  if (access.role === "super_admin" || access.role === "management") return !model.projectId || access.projects.some((project) => project.id === model.projectId);
  if (access.role === "external_agent") return false;
  if (access.role === "finance" && model.category !== "financial_models") return false;
  if (access.role === "sales_manager" && model.category !== "sales_strategy") return false;
  return !model.projectId || access.projects.some((project) => project.id === model.projectId);
}

export function canManageScenario(access: PortalAccess, createdByUserId: string) {
  return access.role === "super_admin" || access.role === "management" || createdByUserId === access.userId;
}
