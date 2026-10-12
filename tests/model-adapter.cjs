const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { feasibilitySource } = require('../lib/models/feasibility-source.ts');
const { feasibilityDocument } = require('../lib/models/html-adapter.ts');
const { validateModelState } = require('../lib/models/validation.ts');
const { canUseModel, canManageScenario } = require('../lib/models/permissions.ts');

function modelContext(html) {
  const sent = [], listeners = {};
  const nodes = new Map();
  const parent = { postMessage(message) { sent.push(message); } };
  const context = vm.createContext({ structuredClone, Intl, console, setTimeout, clearTimeout, parent, localStorage: { getItem() { return null; } }, ResizeObserver: class { observe() {} }, document: { body: {}, documentElement: { scrollHeight: 2000 }, addEventListener() {}, getElementById(id) { if (!nodes.has(id)) nodes.set(id, { innerHTML: '', textContent: '', closest() { return { style: {} }; } }); return nodes.get(id); } }, window: { addEventListener(type, callback) { listeners[type] = callback; } } });
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(match[1], context);
  return { context, sent, listeners, parent };
}

test('user-supplied original HTML remains byte-for-byte unchanged', () => {
  assert.equal(crypto.createHash('sha256').update(feasibilitySource).digest('hex'), '1fa29c486952f49cc64836b290c1d06a21919225ef152639a1ac5bdcb2a17d72');
});
test('complete state round-trip preserves fractional assumptions and dynamic cost rows', () => {
  const { context } = modelContext(feasibilitySource);
  vm.runInContext("state.fields.price=1234567.89; state.gst.margin=false; state.tax.lossUsable=false; state.finance.loan=4123456.78; state.costs.push({name:'Custom',group:'Custom',amount:12345.67,mode:'net',credit:true}); state.costs.splice(1,1);", context);
  const before = JSON.parse(vm.runInContext('JSON.stringify(calculate())', context));
  const state = JSON.parse(vm.runInContext('JSON.stringify(state)', context));
  validateModelState('700-feasibility-v1', state);
  context.saved = JSON.parse(JSON.stringify(state));
  vm.runInContext('state=structuredClone(initial); state=saved; renderInputs(); renderCosts(); update()', context);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(calculate())', context)), before);
});
test('adapter rejects wrong origin, source, instance, model, schema and type', async () => {
  const { listeners, parent, sent } = modelContext(feasibilityDocument('model-1', 'nonce-1', 'https://grandharmony.vercel.app'));
  const correct = { source: parent, origin: 'https://grandharmony.vercel.app', data: { modelId: 'model-1', instanceId: 'nonce-1', schemaVersion: 1, requestId: 'r1', type: 'GET_STATE' } };
  const count = sent.length;
  for (const invalid of [{ ...correct, origin: 'https://evil.test' }, { ...correct, source: {} }, ...[{ instanceId: 'wrong' }, { modelId: 'wrong' }, { schemaVersion: 2 }, { type: 'WRITE_DATABASE' }].map(change => ({ ...correct, data: { ...correct.data, ...change } }))]) await listeners.message(invalid);
  assert.equal(sent.length, count);
  await listeners.message(correct);
  assert.equal(sent.at(-1).type, 'RESPONSE');
  const saved = sent.at(-1).payload;
  await listeners.message({ ...correct, data: { ...correct.data, type: 'SET_STATE', payload: saved } });
  assert.equal(sent.at(-1).type, 'RESPONSE');
  await listeners.message({ ...correct, data: { ...correct.data, type: 'SET_STATE', payload: { ...saved, results: { ...saved.results, profit: saved.results.profit + 1000 } } } });
  assert.equal(sent.at(-1).type, 'ERROR');
});
test('server rejects malformed state and unsafe dynamic row markup', () => {
  const { context } = modelContext(feasibilitySource);
  const state = JSON.parse(vm.runInContext('JSON.stringify(state)', context));
  state.costs[0].group = '<img src=x>';
  assert.throws(() => validateModelState('700-feasibility-v1', state));
  assert.throws(() => validateModelState('700-feasibility-v1', {}));
});
test('financial model and private scenario permissions deny external and unassigned users', () => {
  const model = { projectId: '700', category: 'development_feasibility', status: 'active' };
  assert.equal(canUseModel({ role: 'external_agent', projects: [{ id: '700' }] }, model), false);
  assert.equal(canUseModel({ role: 'project_manager', projects: [] }, model), false);
  assert.equal(canUseModel({ role: 'finance', projects: [{ id: '700' }] }, model), true);
  assert.equal(canManageScenario({ role: 'finance', userId: 'alice' }, 'bob'), false);
});
