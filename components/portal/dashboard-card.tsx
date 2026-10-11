import type { ReactNode } from "react";

type DashboardCardProps = {
  label: string;
  value: string;
  detail: string;
  tone?: "neutral" | "positive" | "warning";
  children?: ReactNode;
};

export function DashboardCard({ label, value, detail, tone = "neutral", children }: DashboardCardProps) {
  const toneClass = tone === "positive" ? "text-[#2E5A44]" : tone === "warning" ? "text-[#9A6A27]" : "text-[#6E6A5F]";
  return <section className="border border-[#EBE8E1] bg-white p-5"><p className="mono text-[10px] uppercase tracking-[.1em] text-[#6E6A5F]">{label}</p><p className="mono mt-4 text-2xl font-medium tracking-[-.04em] text-[#121316]">{value}</p><p className={`mono mt-2 text-[10px] ${toneClass}`}>{detail}</p>{children}</section>;
}
