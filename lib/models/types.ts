export const modelCategories = ["financial_models", "sales_strategy", "development_feasibility", "investment_analysis", "property_management", "specifications", "other_tools"] as const;
export type ModelCategory = (typeof modelCategories)[number];

export type ModelState = Record<string, unknown>;

export type PrintData = {
  orientation: "portrait" | "landscape";
  sections: Array<{ heading: string; rows: Array<{ label: string; value: string }> }>;
};

export type ModelAdapter<TState = ModelState> = {
  getState(): Promise<TState>;
  setState(state: TState): Promise<void>;
  validateState(state: TState): Promise<boolean>;
  getPrintData?(): Promise<unknown>;
};
