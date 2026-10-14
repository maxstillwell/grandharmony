import type { ModelState } from "./types";

export type SpecificationStatus = "确定" | "待定" | "可选";
export type SpecificationImage = { id?: string; url: string; label: string; source: string };
export type SpecificationItem = { id: string; item: string; spec: string; status: SpecificationStatus; images: SpecificationImage[] };
export type SpecificationSection = { id: string; title: string; items: SpecificationItem[] };
export type SpecificationState = { sections: SpecificationSection[] };

export function asSpecificationState(value: ModelState): SpecificationState {
  const state = value as unknown as SpecificationState;
  return structuredClone(state);
}
