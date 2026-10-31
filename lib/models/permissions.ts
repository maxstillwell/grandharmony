import type { PortalAccess } from "@/lib/auth/access";

type ModelPermissionInput = { projectId: string | null; category: string; status: string };

export function canUseModel(access: PortalAccess, model: ModelPermissionInput) {
  return model.status === "active" && canViewModel(access, model);
}

export function canViewModel(access: PortalAccess, model: ModelPermissionInput) {
  const allows = (role: string) => {
    if (role === "external_agent") return false;
    if (role === "finance") return ["financial_models", "development_feasibility", "investment_analysis"].includes(model.category);
    if (role === "sales_manager") return model.category === "sales_strategy";
    return ["super_admin", "management", "project_manager"].includes(role);
  };
  if (!(access.roles ?? [access.role]).some(allows)) return false;
  if (!model.projectId) return true;
  const project = access.projects.find(item => item.id === model.projectId);
  return Boolean(project && allows(project.membershipRole));
}

export function canManageScenario(access: PortalAccess, createdByUserId: string) {
  return access.role === "super_admin" || access.role === "management" || createdByUserId === access.userId;
}
