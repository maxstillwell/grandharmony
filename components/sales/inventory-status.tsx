import type { UnitStatus } from "@/lib/sales/domain";
export const statusPresentation: Record<
  UnitStatus,
  { label: string; colour: string }
> = {
  not_released: { label: "Coming soon", colour: "#8b9189" },
  available: { label: "Available", colour: "#477c62" },
  on_hold: { label: "On hold", colour: "#bd914b" },
  reserved: { label: "Reserved", colour: "#b28653" },
  contract_issued: { label: "Contract issued", colour: "#8180a1" },
  contract_signed: { label: "Under contract", colour: "#667f95" },
  unconditional: { label: "Unconditional", colour: "#597388" },
  settled: { label: "Sold · settled", colour: "#6c7169" },
  withdrawn: { label: "Withheld", colour: "#8b7c75" },
};
export function money(value: string | null | undefined) {
  return value == null || value === ""
    ? "—"
    : new Intl.NumberFormat("en-AU", {
        style: "currency",
        currency: "AUD",
        maximumFractionDigits: 2,
      }).format(Number(value));
}
