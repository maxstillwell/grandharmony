import { amount, cents, settlementSummary } from "./lifecycle-domain";
import type { Data } from "../../components/sales/types";
import type { LifecycleData } from "./lifecycle-service";
import type { PlatformData } from "./platform-service";
export type ReportFilter = {
  from: string;
  to: string;
  stage: string;
  agent: string;
};
export function salesReport(
  data: Data,
  life: LifecycleData,
  platform: PlatformData,
  filter: ReportFilter,
) {
  const units = data.units.filter(
      (u) =>
        !filter.stage ||
        u.releaseStageId === filter.stage ||
        u.constructionStageId === filter.stage,
    ),
    ids = new Set(units.map((u) => u.id));
  const matches = (r: {
    unitId: string;
    agentId?: string | null;
    createdAt: Date;
  }) =>
    ids.has(r.unitId) &&
    (!filter.agent || r.agentId === filter.agent) &&
    (!filter.from ||
      new Date(r.createdAt) >= new Date(filter.from + "T00:00:00Z")) &&
    (!filter.to ||
      new Date(r.createdAt) <
        new Date(new Date(filter.to + "T00:00:00Z").getTime() + 86400000));
  const contracts = life.contracts.filter(matches),
    offers = life.offers.filter(matches),
    reservations = life.reservations.filter(matches),
    active = contracts.filter((c) =>
      ["signed", "conditional", "unconditional", "completed"].includes(
        c.status,
      ),
    );
  const total = (rows: { contractPrice: string | null }[]) =>
    amount(rows.reduce((n, r) => n + cents(r.contractPrice), 0n));
  const stageRevenue = [
    ...data.construction.map((s) => ({ ...s, kind: "Construction" })),
    ...data.release.map((s) => ({ ...s, kind: "Sales release" })),
  ].map((s) => {
    const unitIds = new Set(
      units
        .filter((u) =>
          s.kind === "Construction"
            ? u.constructionStageId === s.id
            : u.releaseStageId === s.id,
        )
        .map((u) => u.id),
    );
    const sales = active.filter((c) => unitIds.has(c.unitId));
    return {
      id: s.id,
      name: s.name,
      kind: s.kind,
      units: unitIds.size,
      contracts: sales.length,
      value: total(sales),
    };
  });
  const agents = platform.agents
    .filter((a) => !filter.agent || a.userId === filter.agent)
    .map((a) => {
      const sales = active.filter((c) => c.agentId === a.userId),
        buyers = data.leads.filter(
          (l) =>
            l.assignedAgentId === a.userId || l.assignedStaffId === a.userId,
        );
      return {
        id: a.id,
        name: a.displayName,
        company: a.company,
        buyers: buyers.length,
        residenceIds: [
          ...new Set([
            ...buyers.flatMap((b) => b.unitIds),
            ...offers
              .filter((o) => o.agentId === a.userId)
              .map((o) => o.unitId),
            ...sales.map((c) => c.unitId),
          ]),
        ].filter((id) => ids.has(id)),
        offers: offers.filter((o) => o.agentId === a.userId).length,
        contracts: sales.length,
        value: total(sales),
      };
    });
  const sources = [...new Set(data.leads.map((l) => l.source))].map(
    (source) => {
      const buyers = data.leads.filter(
        (l) =>
          l.source === source &&
          (!filter.agent ||
            l.assignedAgentId === filter.agent ||
            l.assignedStaffId === filter.agent),
      );
      return {
        source,
        leads: buyers.length,
        qualified: buyers.filter((l) =>
          [
            "qualified",
            "inspection_arranged",
            "negotiating",
            "converted",
          ].includes(l.status),
        ).length,
        converted: buyers.filter((l) => active.some((c) => c.leadId === l.id))
          .length,
      };
    },
  );
  return {
    units,
    contracts,
    offers,
    reservations,
    active,
    stageRevenue,
    agents,
    sources,
    asking: amount(
      data.prices
        .filter((p) => ids.has(p.unitId))
        .reduce((n, p) => n + cents(p.askingPrice), 0n),
    ),
    summary: settlementSummary(contracts),
    velocity30Days: active.filter(
      (c) =>
        c.contractDate &&
        new Date(c.contractDate).getTime() >= Date.now() - 30 * 86400000 &&
        new Date(c.contractDate).getTime() <= Date.now(),
    ).length,
    monthlySales: [
      ...new Set(
        active.map((c) =>
          new Date(c.contractDate ?? c.createdAt).toISOString().slice(0, 7),
        ),
      ),
    ]
      .sort()
      .map((month) => ({
        month,
        contracts: active.filter((c) =>
          new Date(c.contractDate ?? c.createdAt)
            .toISOString()
            .startsWith(month),
        ).length,
      })),
    averageContract: active.length
      ? amount(
          active.reduce((n, c) => n + cents(c.contractPrice), 0n) /
            BigInt(active.length),
        )
      : null,
    pipeline: amount(
      offers
        .filter((o) => ["submitted", "accepted"].includes(o.status))
        .reduce((n, o) => n + cents(o.amount), 0n),
    ),
  };
}
export function salesTasks(
  data: Data,
  life: LifecycleData,
  finance: boolean,
  now = new Date(),
) {
  const tasks: Array<{
    key: string;
    title: string;
    due: Date | null;
    area: string;
    unitId?: string;
    leadId?: string;
  }> = [];
  for (const l of data.leads)
    if (l.followUpAt && !["lost", "archived", "converted"].includes(l.status))
      tasks.push({
        key: `lead:${l.id}:${new Date(l.followUpAt).toISOString()}`,
        title: `Follow up · ${l.name}`,
        due: new Date(l.followUpAt),
        area: "Leads / CRM",
        leadId: l.id,
      });
  for (const o of life.offers)
    if (o.status === "submitted")
      tasks.push({
        key: `offer:${o.id}:${o.revision}`,
        title: `Offer awaiting decision${o.expiresAt && new Date(o.expiresAt) < now ? " · EXPIRED (manual decision required)" : ""}`,
        due: o.expiresAt ? new Date(o.expiresAt) : null,
        area: "Deals",
        unitId: o.unitId,
        leadId: o.leadId,
      });
  for (const r of life.reservations)
    if (r.status === "active" && r.expiresAt)
      tasks.push({
        key: `hold:${r.id}:${r.revision}`,
        title: "Reservation expiry · manual release required",
        due: new Date(r.expiresAt),
        area: "Deals",
        unitId: r.unitId,
        leadId: r.leadId,
      });
  for (const c of life.contracts)
    if (["signed", "conditional", "unconditional"].includes(c.status)) {
      if (finance && cents(c.depositAmount) > cents(c.depositReceivedAmount))
        tasks.push({
          key: `deposit:${c.id}:${c.revision}`,
          title: "Deposit outstanding",
          due: c.depositDueAt ? new Date(c.depositDueAt) : null,
          area: "Settlement Tracking",
          unitId: c.unitId,
          leadId: c.leadId,
        });
      if (c.expectedSettlementAt)
        tasks.push({
          key: `settle:${c.id}:${c.revision}`,
          title: "Settlement milestone",
          due: new Date(c.expectedSettlementAt),
          area: "Contracts",
          unitId: c.unitId,
          leadId: c.leadId,
        });
    }
  return tasks.sort(
    (a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity),
  );
}
