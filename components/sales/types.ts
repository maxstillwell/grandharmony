import type { createSalesService } from "@/lib/sales/service";
export type Data = Awaited<
  ReturnType<ReturnType<typeof createSalesService>["workspace"]>
>;
export type Unit = Data["units"][number];
export type ManagementPlan =
  typeof import("@/assets/sales/golfview-review/plan.json");
export type Run = (
  operation: string,
  input: Record<string, unknown>,
) => Promise<unknown>;
export type Shared = {
  data: Data;
  run: Run;
  pending: boolean;
  projectId: string;
  mapEnabled?: boolean;
  reviewPlan?: ManagementPlan;
  selectedUnitId?: string | null;
  onSelectUnit?: (id: string | null) => void;
};
