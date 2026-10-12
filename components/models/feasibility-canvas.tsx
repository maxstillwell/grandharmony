"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { calculateFeasibility, asFeasibilityState, sensitivityFor, fieldSpecs, type FeasibilityState } from "@/lib/models/feasibility-engine";
import { validateModelState } from "@/lib/models/validation";
import type { ModelState } from "@/lib/models/types";
import type { CanvasHandle, CanvasSnapshot } from "./html-canvas";
import { Plus, X, ArrowUpRight, CircleHelp } from "lucide-react";

const currency = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
const tabs = ["Inputs", "Results", "Charts", "Assumptions", "Model Info"];
function snapshot(state: FeasibilityState): CanvasSnapshot { return { state: state as unknown as ModelState, results: calculateFeasibility(state), sensitivity: sensitivityFor(state) }; }

export const FeasibilityCanvas = forwardRef<CanvasHandle, { defaults: ModelState; onReady(value: CanvasSnapshot): void; onChange(value: CanvasSnapshot): void }>(({ defaults, onReady, onChange }, ref) => {
  const [state, setState] = useState<FeasibilityState>(() => structuredClone(asFeasibilityState(defaults)));
  const [tab, setTab] = useState("Inputs");
  const stateRef = useRef(state);
  const callbacks = useRef({ onReady, onChange }); callbacks.current = { onReady, onChange };
  const results = calculateFeasibility(state);
  const sensitivity = sensitivityFor(state);
  useEffect(() => { callbacks.current.onReady(snapshot(stateRef.current)); }, []);
  function change(next: FeasibilityState) { stateRef.current = next; setState(next); callbacks.current.onChange(snapshot(next)); }
  useImperativeHandle(ref, () => ({
    async getState() { return snapshot(stateRef.current); },
    async validateState(value) { try { validateModelState("700-feasibility-v1", value.state); return true; } catch { return false; } },
    async setState(value) {
      validateModelState("700-feasibility-v1", value.state);
      const next = structuredClone(asFeasibilityState(value.state));
      const calculated = calculateFeasibility(next) as Record<string, number>;
      for (const [key, expected] of Object.entries(value.results)) if (typeof expected === "number" && (!Number.isFinite(calculated[key]) || Math.abs(calculated[key] - expected) > Math.max(1e-7, Math.abs(expected) * 1e-12))) throw new Error("Restored calculation mismatch: " + key);
      stateRef.current = next; setState(next);
    },
    async reset() { const next = structuredClone(asFeasibilityState(defaults)); stateRef.current = next; setState(next); return snapshot(next); },
    async getPrintData() { return snapshot(stateRef.current); },
  }));
  function field(section: string, key: string, value: number | boolean) {
    const group = state[section as "fields" | "gst" | "tax" | "finance"];
    change({ ...state, [section]: { ...group, [key]: value } });
  }
  function cost(index: number, update: Partial<FeasibilityState["costs"][number]>) {
    change({ ...state, costs: state.costs.map((row, i) => i === index ? { ...row, ...update } : row) });
  }
  const fields = (section: string) => <div className="native-field-grid">{fieldSpecs[section].map(([key, label, unit]) => <label key={key} className="portal-field"><span>{label}<small>{unit}</small></span><input type="number" step="any" value={Number(state[section as "fields" | "gst" | "tax" | "finance"][key])} onChange={event => field(section, key, Number(event.target.value) || 0)} /></label>)}</div>;
  const toggle = (section: "gst" | "tax", key: string, label: string) => <label className="portal-toggle"><input type="checkbox" checked={Boolean(state[section][key])} onChange={event => field(section, key, event.target.checked)} />{label}</label>;
  const metrics = [["Sales revenue", results.revenue], ["Pre-tax profit", results.profit], ["After-tax profit", results.after], ["Settlement cash", results.cash]] as const;
  return <div className="native-model-grid">
    <nav className="native-model-nav" aria-label="Model sections"><p className="portal-kicker">Analysis sections</p>{tabs.map((item, i) => <button key={item} onClick={() => setTab(item)} aria-current={tab === item ? "page" : undefined}><span>0{i + 1}</span>{item}<ArrowUpRight size={13} /></button>)}<div className="native-model-caption">700 Project<br /><span>DEVELOPMENT FEASIBILITY</span></div></nav>
    <div className="native-model-main">
      <div className="native-metrics">{metrics.map(([label, value]) => <article key={label}><p className="portal-kicker">{label}</p><strong>{currency(value)}</strong><span>Calculated · AUD</span></article>)}</div>
      {tab === "Inputs" && <><section className="portal-card"><div className="portal-section-title"><div><p className="portal-kicker">01 / Sales & development</p><h2>Project assumptions</h2></div><span className="portal-badge">LIVE INPUTS</span></div>{fields("fields")}{toggle("gst", "marketingGst", "营销费视为含 GST，且进项税可抵扣")}</section><section className="portal-card"><div className="portal-section-title"><div><p className="portal-kicker">02 / Cost register</p><h2>Development costs</h2></div><button className="portal-button" onClick={() => change({ ...state, costs: [...state.costs, { name: "新增费用", amount: 0, mode: "gross", credit: true, group: "自定义" }] })}><Plus size={14} />Add cost</button></div><p className="portal-helper">已发生费用采用原模型调整口径；待核预算保持原始输入。金额口径与进项税资格需按实际税票确认。</p><div className="portal-table-scroll"><table className="portal-table native-cost-table"><thead><tr><th>Cost item</th><th>Amount · AUD</th><th>GST basis</th><th>Input credit</th><th><span className="sr-only">Remove</span></th></tr></thead><tbody>{state.costs.map((row, i) => <tr key={i}><td><input aria-label={"Cost item " + (i + 1)} value={row.name} onChange={event => cost(i, { name: event.target.value })} /><small>{row.group}</small></td><td><input aria-label={"Amount " + (i + 1)} type="number" step="any" value={row.amount} onChange={event => cost(i, { amount: Number(event.target.value) || 0 })} /></td><td><select aria-label={"GST basis " + (i + 1)} value={row.mode} onChange={event => cost(i, { mode: event.target.value as "gross" | "net" | "free" })}><option value="gross">含 GST</option><option value="net">不含 GST</option><option value="free">GST 不适用</option></select></td><td><input aria-label={"Input tax credit " + (i + 1)} type="checkbox" checked={row.credit} onChange={event => cost(i, { credit: event.target.checked })} /></td><td><button className="portal-icon-button" aria-label={"Remove cost " + (i + 1)} onClick={() => change({ ...state, costs: state.costs.filter((_, index) => index !== i) })}><X size={14} /></button></td></tr>)}</tbody></table></div></section></>}
      {tab === "Results" && <section className="portal-card"><p className="portal-kicker">Calculated outputs</p><h2>Profit & cash-flow bridge</h2><table className="portal-table mt-5"><tbody>{Object.entries(results).map(([key, value]) => <tr key={key}><td>{key}</td><td>{["sold", "share", "retained"].includes(key) ? value.toLocaleString("en-AU", { maximumFractionDigits: 8 }) : currency(value)}</td></tr>)}</tbody></table><p className="portal-helper">贷款本金属于资金来源和偿还，不再次计入利润成本。简化现金回笼不等于逐月现金流。</p></section>}
      {tab === "Charts" && <section className="portal-card"><p className="portal-kicker">Sales price sensitivity</p><h2>Scenario range</h2><div className="native-chart">{sensitivity.map(row => <div key={row.price}><strong>{(row.profit / 1000000).toFixed(1)}M</strong><i style={{ height: Math.max(2, Math.abs(row.profit) / Math.max(1, ...sensitivity.map(item => Math.abs(item.profit))) * 140), background: row.profit >= 0 ? "#9f9986" : "#ad7c70" }} /><small>{(row.price / 1000000).toFixed(2)}M</small></div>)}</div><div className="portal-table-scroll"><table className="portal-table"><thead><tr><th>Unit price</th><th>Revenue</th><th>Pre-tax</th><th>After-tax</th></tr></thead><tbody>{sensitivity.map(row => <tr key={row.price}>{[row.price, row.revenue, row.profit, row.after].map((value, i) => <td key={i}>{currency(value)}</td>)}</tr>)}</tbody></table></div></section>}
      {tab === "Assumptions" && <><section className="portal-card"><p className="portal-kicker">GST / independent calculation</p><h2>GST assumptions</h2>{fields("gst")}{toggle("gst", "margin", "使用 Margin Scheme")}<p className="portal-helper">土地取得对价不自动含印花税；Margin Scheme 适用资格及费用抵扣须核实。</p></section><section className="portal-card"><p className="portal-kicker">Company tax</p><h2>Tax assumptions</h2>{fields("tax")}{toggle("tax", "lossUsable", "假设税务亏损可使用")}<p className="portal-helper">税务亏损须满足法定条件，25% 税率适用性需确认。</p></section><section className="portal-card"><p className="portal-kicker">Funding</p><h2>Finance assumptions</h2>{fields("finance")}<p className="portal-helper">原模型按平均借款余额 × 年利率 × 年数估算利息。</p></section></>}
      {tab === "Model Info" && <section className="portal-card"><p className="portal-kicker">Model provenance</p><h2>700 Development Feasibility</h2><p className="portal-helper">Portal-native interface · Original calculation engine v1.0.0. Inputs, dynamic rows, GST, tax, financing and sensitivity calculations preserve the supplied model logic. Display changes do not change the saved state structure.</p><p className="portal-helper">初步管理可行性分析，非会计师税务意见。尚未包含完整月度提款、土地持有税或持有策略的时间价值。</p></section>}
    </div>
    <aside className="native-summary"><section className="portal-card"><p className="portal-kicker">Quick summary</p><h2>At a glance</h2>{[["Net GST", results.netGst], ["Company tax", results.tax], ["Finance interest", results.interest], ["Net cash", results.cash]].map(([label, value]) => <div className="native-summary-row" key={label}><span>{label}</span><strong>{currency(Number(value))}</strong></div>)}<div className="native-summary-foot"><span>Retained homes</span><strong>{results.retained}</strong></div></section><section className="portal-card native-review-note"><CircleHelp size={18} /><p className="portal-kicker">Review required</p><p>请核实已发生费用的 GST 口径、待核设计预算、Margin Scheme 资格、税务亏损与融资结算时间表。</p><span>Original assumptions · professional review</span></section></aside>
  </div>;
});
FeasibilityCanvas.displayName = "FeasibilityCanvas";
