const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("700 explorer is explicitly non-public and all inventory is demo-only", () => {
  const page = fs.readFileSync("app/demo/700-explorer/page.tsx", "utf8");
  const component = fs.readFileSync("components/sales/site-plan-explorer.tsx", "utf8");
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /NOT FOR SALES/);
  assert.match(page, /Array.from\(\{ length: 47 \}/);
  assert.match(component, /PROTOTYPE ONLY/);
  assert.match(component, /unitsById = useMemo/);
  assert.match(component, /data-unit-hotspot/);
  assert.match(component, /aria-label=/);
  assert.doesNotMatch(page, /1,2[0-9]{2},000|1\.2[0-9]M/);
});

test("the interactive component accepts public projection only", () => {
  const component = fs.readFileSync("components/sales/site-plan-explorer.tsx", "utf8");
  assert.doesNotMatch(component, /internalPrice|askingPrice|clientEmail|agentNotes|floorPrice/);
  assert.match(component, /priceDisplay: string \| null/);
  assert.match(component, /selectedUnit\.priceDisplay \?\? "Price on Application"/);
});
