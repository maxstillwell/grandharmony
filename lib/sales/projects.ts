import type { PortalAccess } from "@/lib/auth/access";
import { canSales, isAgent } from "./permissions";
// Marketing identity is separate from the existing project UUID and legacy slug.
export function isGolfview(project: { name: string; slug: string }) {
  return (
    /^(golfview|700(?:-project)?)$/i.test(project.slug) ||
    /^(700\s*project|golfview)$/i.test(project.name.trim())
  );
}
export function salesProjectName(project: { name: string; slug: string }) {
  return isGolfview(project) ? "Golfview" : project.name;
}
export function chooseSalesProject<
  T extends { id: string; name: string; slug: string },
>(projects: T[], requested?: string) {
  return requested
    ? projects.find((p) => p.id === requested)
    : (projects.find(isGolfview) ?? projects[0]);
}
export function canReviewSalesMap(access: PortalAccess, projectId: string) {
  const project = access.projects.find((p) => p.id === projectId);
  return Boolean(
    project &&
      isGolfview(project) &&
      !isAgent(access, projectId) &&
      canSales(access, projectId, "inventory.view"),
  );
}
