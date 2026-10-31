export const rolePriority = ["super_admin", "management", "project_manager", "finance", "sales_manager", "external_agent"] as const;

export function effectiveRole(assigned: readonly string[]): string | null {
  return rolePriority.find(role => assigned.includes(role)) ?? null;
}
