const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { compareScenarioStates } = require('../lib/models/scenario-comparison.ts');
const { asSpecificationState } = require('../lib/models/specification-types.ts');

test('legacy specification state gains optional item fields without data loss', () => {
  const state = { sections: [{ id: 's', title: 'Kitchen', items: [{ id: 'i', item: 'Oven', spec: 'Electric', status: '待定', images: [] }] }] };
  const normalized = asSpecificationState(state);
  assert.equal(normalized.sections[0].items[0].brand, '');
  assert.deepEqual(normalized.sections[0].items[0].sourceLinks, []);
  assert.equal(normalized.sections[0].items[0].spec, 'Electric');
});

test('specification comparison reports the streamlined item, description, status and media changes', () => {
  const a = { sections: [{ id: 's', title: 'Kitchen', items: [{ id: 'i', item: 'Oven', spec: 'Electric', brand: 'Brand A', modelNumber: 'A1', notes: '', status: '待定', images: [], sourceLinks: [] }] }] };
  const b = { sections: [{ id: 's', title: 'Kitchen', items: [{ id: 'i', item: 'Oven', spec: 'Induction', brand: 'Brand B', modelNumber: 'B2', notes: 'Confirm finish', status: '确定', images: [{ url: 'https://example.test/oven.jpg', label: 'Oven', source: 'https://example.test' }], sourceLinks: [{ url: 'https://example.test/spec', label: 'Specification' }] }] }] };
  const rows = compareScenarioStates('interactive-specification-v1', a, b);
  assert.ok(rows.some((row) => row.label === 'Oven · Status' && row.changed));
  assert.ok(rows.some((row) => row.label === 'Oven · Reference images' && row.changed));
  assert.ok(!rows.some((row) => row.label === 'Oven · Brand'));
});

test('financial comparison separates inputs from stored calculation results', () => {
  const rows = compareScenarioStates('700-feasibility-v1', { fields: { price: 1 }, __results: { profit: 2 } }, { fields: { price: 3 }, __results: { profit: 4 } });
  assert.ok(rows.some((row) => row.group === 'Inputs & assumptions' && row.changed));
  assert.ok(rows.some((row) => row.group === 'Calculated results' && row.changed));
});

test('comparison page flags a model-version mismatch instead of silently treating it as compatible', () => {
  const component = fs.readFileSync('components/models/scenario-comparison.tsx', 'utf8');
  assert.match(component, /left\?\.modelVersionId === right\?\.modelVersionId/);
  assert.match(component, /Compatibility review required/);
});
