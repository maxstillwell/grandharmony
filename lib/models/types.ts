export const modelCategories = ["financial_models", "sales_strategy", "development_feasibility", "investment_analysis", "property_management", "specifications", "other_tools"] as const;
export type ModelCategory = (typeof modelCategories)[number];

export type ModelState = Record<string, unknown>;

export type PrintData = {
  orientation: "portrait" | "landscape";
  sections: Array<{ heading: string; rows: Array<{ label: string; value: string }> }>;
};

export type ModelAdapter = {
  getState(): ModelState;
  setState(state: ModelState): void;
  validateState(state: ModelState): ModelState;
  getPrintData(state: ModelState): PrintData;
};
