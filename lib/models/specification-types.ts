import type { ModelState } from "./types";

export type SpecificationStatus = "确定" | "待定" | "可选";
export type SpecificationImage = { id?: string; url: string; label: string; source: string };
export type SpecificationSourceLink = { id?: string; url: string; label: string };
export type SpecificationItem = { id: string; item: string; spec: string; brand?: string; modelNumber?: string; notes?: string; status: SpecificationStatus; images: SpecificationImage[]; sourceLinks?: SpecificationSourceLink[] };
export type SpecificationSection = { id: string; title: string; items: SpecificationItem[] };
export type SpecificationState = { sections: SpecificationSection[] };

export function asSpecificationState(value: ModelState): SpecificationState {
  const state = structuredClone(value) as unknown as SpecificationState;
  return {
    sections: state.sections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({ ...item, brand: item.brand ?? "", modelNumber: item.modelNumber ?? "", notes: item.notes ?? "", sourceLinks: item.sourceLinks ?? [] })),
    })),
  };
}
