import { and, eq } from "drizzle-orm";
import type { PortalAccess } from "../auth/access";
import type { SalesDb } from "./db";
import * as s from "../db/schema";
import { assertSales, canSales, isAgent } from "./permissions";
import { assertTransition } from "./domain";
export function assertScope(
  access: PortalAccess,
  projectId: string,
  scopeKey: string,
) {
  assertSales(access, projectId, "inventory.view");
  if (scopeKey === "real") return;
  if (
    scopeKey !== `demo:${access.userId}` ||
    isAgent(access, projectId) ||
    !canSales(access, projectId, "deals.view")
  )
    throw Error("This demonstration workspace is not authorised.");
}
export async function resolveSalesScope(
  db: SalesDb,
  access: PortalAccess,
  projectId: string,
  demo = false,
) {
  const key = demo ? `demo:${access.userId}` : "real";
  assertScope(access, projectId, key);
  await db
    .insert(s.salesWorkspaces)
    .values({
      projectId,
      scopeKey: key,
      kind: demo ? "demo" : "real",
      name: demo ? "Demo transactions" : "Real business",
      createdByUserId: demo ? access.userId : null,
    })
    .onConflictDoNothing({
      target: [s.salesWorkspaces.projectId, s.salesWorkspaces.scopeKey],
    });
  return key;
}
export async function demoUnit(
  tx: SalesDb,
  access: PortalAccess,
  projectId: string,
  scopeKey: string,
  id: string,
) {
  assertScope(access, projectId, scopeKey);
  if (scopeKey === "real")
    throw Error("Demo inventory updates require a demonstration workspace.");
  const [u] = await tx
    .select()
    .from(s.salesUnits)
    .where(and(eq(s.salesUnits.projectId, projectId), eq(s.salesUnits.id, id)))
    .for("update");
  if (!u) throw Error("Residence not found.");
  await tx
    .insert(s.salesDemoUnitState)
    .values({
      projectId,
      scopeKey,
      unitId: id,
      status: u.status,
      revision: u.revision,
    })
    .onConflictDoNothing();
  const [state] = await tx
    .select()
    .from(s.salesDemoUnitState)
    .where(
      and(
        eq(s.salesDemoUnitState.projectId, projectId),
        eq(s.salesDemoUnitState.scopeKey, scopeKey),
        eq(s.salesDemoUnitState.unitId, id),
      ),
    )
    .for("update");
  return {
    ...u,
    status: state.status,
    revision: state.revision,
    contractPrice: state.contractPrice,
    depositAmount: state.depositAmount,
  };
}
export async function changeDemoStatus(
  tx: SalesDb,
  access: PortalAccess,
  projectId: string,
  scopeKey: string,
  id: string,
  revision: number,
  status: string,
  reason: string,
) {
  assertSales(access, projectId, "status.edit");
  const u = await demoUnit(tx, access, projectId, scopeKey, id);
  if (u.revision !== revision) throw Error("Demo inventory changed. Reload.");
  assertTransition(u.status, status, reason);
  await tx
    .update(s.salesDemoUnitState)
    .set({ status, revision: u.revision + 1, updatedAt: new Date() })
    .where(
      and(
        eq(s.salesDemoUnitState.projectId, projectId),
        eq(s.salesDemoUnitState.scopeKey, scopeKey),
        eq(s.salesDemoUnitState.unitId, id),
      ),
    );
}
