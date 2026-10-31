import type { PortalAccess } from "../auth/access";
import { canSales } from "./permissions";
import {
  createLifecycleService,
  lifecycleEnabled,
  type LifecycleData,
} from "./lifecycle-service";
import { getSalesDb } from "./db";
export type LifecycleState = {
  enabled: boolean;
  data: LifecycleData | null;
  reason?: string;
};
export async function loadLifecycle(
  access: PortalAccess,
  projectId: string,
): Promise<LifecycleState> {
  if (!canSales(access, projectId, "deals.view"))
    return {
      enabled: false,
      data: null,
      reason: "Transaction access is restricted.",
    };
  if (!lifecycleEnabled(projectId))
    return {
      enabled: false,
      data: null,
      reason:
        "Transaction entry is not activated. Owner approval is required before enabling offers, reservations, contracts or receipts.",
    };
  try {
    return {
      enabled: true,
      data: await createLifecycleService(getSalesDb()).workspace(
        access,
        projectId,
      ),
    };
  } catch {
    return {
      enabled: false,
      data: null,
      reason:
        "Transaction workspace is unavailable. Existing inventory and CRM remain available; no transaction changes were saved.",
    };
  }
}
