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
  demo?: boolean;
  data: Data;
  run: Run;
  pending: boolean;
  projectId: string;
  mapEnabled?: boolean;
  reviewPlan?: ManagementPlan;
  selectedUnitId?: string | null;
  onSelectUnit?: (id: string | null) => void;
  feedback?: { message: string; failed: boolean };
  clearFeedback?: () => void;
  lifecycle?: import("@/lib/sales/lifecycle-access").LifecycleState;
  onOpenLifecycle?: (
    area: string,
    unitId?: string | null,
    leadId?: string | null,
  ) => void;
  onOpenUnit?: (id: string) => void;
  openUnitId?: string | null;
  onClearOpenUnit?: () => void;
  onOpenLead?: (id: string) => void;
};
