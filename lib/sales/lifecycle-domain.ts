import { decimal, dateOrNull, text, validId, record } from "./domain";
export const offerTransitions: Record<string, readonly string[]> = {
  draft: ["submitted", "withdrawn"],
  submitted: ["accepted", "rejected", "withdrawn"],
  accepted: ["withdrawn"],
  rejected: [],
  withdrawn: [],
};
export const reservationTransitions: Record<string, readonly string[]> = {
  draft: ["active", "cancelled"],
  active: ["cancelled", "released", "expired"],
  cancelled: [],
  released: [],
  expired: [],
};
export const contractTransitions: Record<string, readonly string[]> = {
  draft: ["signed", "cancelled"],
  signed: ["unconditional", "cancelled"],
  unconditional: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
export function cents(value: string | null | undefined) {
  if (!value) return 0n;
  const [whole, frac = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(frac.padEnd(2, "0"));
}
export function amount(value: bigint) {
  return `${value / 100n}.${String(value % 100n).padStart(2, "0")}`;
}
export function positive(value: unknown, required = true) {
  const d = decimal(value);
  if ((required && d === null) || (d !== null && cents(d) <= 0n))
    throw Error("Enter an explicit positive AUD amount.");
  return d;
}
export function identifier(value: unknown, optional = false) {
  if (optional && (value == null || value === "")) return null;
  if (!validId(value)) throw Error("Invalid linked record.");
  return value;
}
function orderedDates(start: Date | null, end: Date | null) {
  if (start && end && end <= start)
    throw Error("Expiry must follow the start date.");
}
export function offerInput(input: unknown) {
  const r = record(input);
  const offeredAt = dateOrNull(r.offeredAt),
    expiresAt = dateOrNull(r.expiresAt);
  orderedDates(offeredAt, expiresAt);
  return {
    unitId: identifier(r.unitId)!,
    leadId: identifier(r.leadId)!,
    agentId: identifier(r.agentId, true),
    amount: positive(r.amount)!,
    offeredAt,
    expiresAt,
    conditions: text(r.conditions, 4000),
    notes: text(r.notes, 4000),
    documentReference: text(r.documentReference, 1000),
  };
}
export function reservationInput(input: unknown) {
  const r = record(input);
  const startsAt = dateOrNull(r.startsAt),
    expiresAt = dateOrNull(r.expiresAt);
  orderedDates(startsAt, expiresAt);
  return {
    unitId: identifier(r.unitId)!,
    leadId: identifier(r.leadId)!,
    agentId: identifier(r.agentId, true),
    offerId: identifier(r.offerId, true),
    startsAt,
    expiresAt,
    notes: text(r.notes, 4000),
  };
}
export function contractInput(input: unknown) {
  const r = record(input);
  const contractDate = dateOrNull(r.contractDate),
    expectedSettlementAt = dateOrNull(r.expectedSettlementAt),
    actualSettlementAt = dateOrNull(r.actualSettlementAt);
  if (
    contractDate &&
    expectedSettlementAt &&
    expectedSettlementAt < contractDate
  )
    throw Error("Settlement cannot precede the contract date.");
  if (contractDate && actualSettlementAt && actualSettlementAt < contractDate)
    throw Error("Actual settlement cannot precede the contract date.");
  const contractPrice = positive(r.contractPrice, false),
    depositAmount = decimal(r.depositAmount);
  if (
    contractPrice &&
    depositAmount &&
    cents(depositAmount) > cents(contractPrice)
  )
    throw Error("Deposit exceeds the recorded contract price.");
  return {
    unitId: identifier(r.unitId)!,
    leadId: identifier(r.leadId)!,
    agentId: identifier(r.agentId, true),
    offerId: identifier(r.offerId, true),
    reservationId: identifier(r.reservationId, true),
    contractDate,
    expectedSettlementAt,
    actualSettlementAt,
    contractPrice,
    depositAmount,
    documentReference: text(r.documentReference, 1000),
    notes: text(r.notes, 4000),
  };
}
export function assertLifecycleTransition(
  from: string,
  to: string,
  map: Record<string, readonly string[]>,
  input: Record<string, unknown>,
) {
  if (
    !map[from]?.includes(to) ||
    input.confirm !== true ||
    !text(input.reason, 1000, true)
  )
    throw Error(
      "A permitted transition, explicit confirmation and reason are required.",
    );
}
export type ContractRow = {
  status: string;
  contractPrice: string | null;
  depositAmount: string | null;
  depositReceivedAmount: string | null;
  settlementReceivedAmount: string | null;
  expectedSettlementAt: Date | string | null;
  actualSettlementAt: Date | string | null;
};
export function settlementSummary(rows: ContractRow[], now = new Date()) {
  const active = rows.filter((r) =>
    ["signed", "unconditional", "completed"].includes(r.status),
  );
  let contracted = 0n,
    receipts = 0n,
    cancelledReceipts = 0n,
    depositsDue = 0n,
    balance = 0n;
  let unspecifiedDeposits = 0,
    overdue = 0;
  for (const r of rows) {
    const cash =
      cents(r.depositReceivedAmount) + cents(r.settlementReceivedAmount);
    receipts += cash;
    if (r.status === "cancelled") cancelledReceipts += cash;
  }
  for (const r of active) {
    const price = cents(r.contractPrice),
      deposit = cents(r.depositReceivedAmount),
      settlement = cents(r.settlementReceivedAmount);
    contracted += price;
    balance += price - deposit - settlement;
    if (r.depositAmount === null) unspecifiedDeposits++;
    else
      depositsDue +=
        cents(r.depositAmount) > deposit
          ? cents(r.depositAmount) - deposit
          : 0n;
    if (
      r.status !== "completed" &&
      r.expectedSettlementAt &&
      new Date(r.expectedSettlementAt) < now
    )
      overdue++;
  }
  return {
    contracted: amount(contracted),
    confirmedReceipts: amount(receipts),
    cancelledContractReceipts: amount(cancelledReceipts),
    outstandingDeposits: amount(depositsDue),
    unconfirmedDepositTargets: unspecifiedDeposits,
    outstandingContractBalance: amount(balance),
    overdueSettlements: overdue,
    completed: active.filter((r) => r.status === "completed").length,
    signed: active.filter((r) => r.status !== "completed").length,
  };
}
