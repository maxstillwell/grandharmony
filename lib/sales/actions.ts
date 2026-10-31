"use server";

import { requirePortalAccess } from "../auth/guards";
import { getSalesDb } from "./db";
import { createSalesService } from "./service";
import { record, validId } from "./domain";
import {
  createLifecycleService,
  lifecycleEnabled,
  type TransactionKind,
} from "./lifecycle-service";
import { revalidatePath } from "next/cache";

export async function salesAction(
  projectId: string,
  operation: string,
  input: unknown,
) {
  const access = await requirePortalAccess();
  if (!validId(projectId)) return { ok: false, error: "Invalid project." };
  try {
    if (operation.startsWith("lifecycle.")) {
      if (!lifecycleEnabled(projectId))
        return {
          ok: false,
          error: "Transaction entry is not activated for this project.",
        };
      const lifecycle = createLifecycleService(getSalesDb()),
        row = record(input);
      const kind = String(row.kind) as TransactionKind;
      if (
        ["lifecycle.save", "lifecycle.transition"].includes(operation) &&
        !["offer", "reservation", "contract"].includes(kind)
      )
        throw new Error("Invalid transaction kind.");
      const data =
        operation === "lifecycle.save"
          ? await lifecycle.save(access, projectId, kind, row)
          : operation === "lifecycle.transition"
            ? await lifecycle.transition(
                access,
                projectId,
                kind,
                String(row.id),
                row,
              )
            : operation === "lifecycle.receipt"
              ? await lifecycle.receipt(access, projectId, String(row.id), row)
              : operation === "lifecycle.profile"
                ? await lifecycle.buyerProfile(access, projectId, row)
                : operation === "lifecycle.policy"
                  ? await lifecycle.policy(access, projectId, row)
                  : undefined;
      if (data === undefined && operation !== "lifecycle.policy")
        throw new Error("Unknown transaction operation.");
      revalidatePath("/portal/sales");
      return { ok: true, data: data ?? true };
    }
    const service = createSalesService(getSalesDb());
    const row = record(input);
    let data: unknown;
    switch (operation) {
      case "configure":
        if (
          row.enquiriesEnabled &&
          (process.env.GOLFVIEW_ENQUIRY_TOKEN?.length ?? 0) < 32
        )
          throw new Error(
            "Configure the server-to-server enquiry token before enabling submissions.",
          );
        data = await service.configure(access, projectId, row);
        break;
      case "stage":
        data = await service.saveStage(access, projectId, row);
        break;
      case "unit":
        data = await service.saveUnit(
          access,
          projectId,
          row,
          typeof row.id === "string" ? row.id : undefined,
          Number(row.revision),
        );
        break;
      case "import":
        data = await service.importInventory(
          access,
          projectId,
          String(row.csv ?? ""),
          row.commit === true,
        );
        break;
      case "status":
        data = await service.changeStatus(
          access,
          projectId,
          String(row.id),
          Number(row.revision),
          String(row.status),
          String(row.reason ?? ""),
        );
        break;
      case "prices":
      case "publicPrice":
        data = await service.savePrices(
          access,
          projectId,
          String(row.id),
          Number(row.revision),
          row,
          operation === "publicPrice",
        );
        break;
      case "draft":
        data = await service.createDraft(
          access,
          projectId,
          typeof row.restoreId === "string" ? row.restoreId : undefined,
        );
        break;
      case "approve":
        data = await service.approve(
          access,
          projectId,
          String(row.id),
          String(row.digest),
        );
        break;
      case "publish":
        data = await service.publish(access, projectId, String(row.id));
        break;
      case "lead":
        data = row.id
          ? await service.updateLead(
              access,
              projectId,
              String(row.id),
              Number(row.revision),
              row,
            )
          : await service.createLead(access, projectId, row);
        break;
      case "activity":
        data = await service.leadActivity(access, projectId, String(row.id));
        break;
      case "unitActivity":
        data = await service.unitActivity(access, projectId, String(row.id));
        break;
      default:
        throw new Error("Unknown operation.");
    }
    if (operation !== "activity" && operation !== "unitActivity") {
      revalidatePath(`/portal/projects/${projectId}/sales`);
      revalidatePath("/portal/sales");
    }
    return { ok: true, data };
  } catch (error) {
    // Driver errors contain SQL and parameter values. Never send those to clients.
    const message = error instanceof Error ? error.message : "";
    const safe =
      message &&
      !/query:|insert into|select |update |params:|password|postgres|connection/i.test(
        message,
      );
    return {
      ok: false,
      error: safe
        ? message.slice(0, 250)
        : "The operation could not be completed. Check record uniqueness and migration readiness.",
    };
  }
}
