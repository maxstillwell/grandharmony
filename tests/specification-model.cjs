const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
const { specificationDefaults } = require('../lib/models/specification-defaults.ts');
const { validateModelState } = require('../lib/models/validation.ts');

test('owner specification imports as editable item-level reference state', () => {
  const state = structuredClone(specificationDefaults);
  assert.equal(state.sections.length, 8);
  assert.ok(state.sections.every(section => section.items.length > 0));
  assert.equal(state.sections[0].items[0].images.length, 1);
  assert.equal(validateModelState('interactive-specification-v1', state), state);
});

test('specification status and reference image validation reject unsafe state', () => {
  const state = structuredClone(specificationDefaults);
  state.sections[0].items[0].status = 'unknown';
  assert.throws(() => validateModelState('interactive-specification-v1', state));
  state.sections[0].items[0].status = '确定';
  state.sections[0].items[0].images[0].url = 'http://unsafe.example/image.jpg';
  assert.throws(() => validateModelState('interactive-specification-v1', state));
});

test('generic model scenarios carry a project association and legacy test model stays hidden', () => {
  const actions = fs.readFileSync('lib/models/actions.ts', 'utf8');
  const data = fs.readFileSync('lib/models/data.ts', 'utf8');
  const registry = fs.readFileSync('lib/models/register.ts', 'utf8');
  assert.match(actions, /const projectId = scenarioProjectId\(access, model, input\.projectId\)/);
  assert.match(actions, /projectId, name, notes, state/);
  assert.match(actions, /not authorised for the selected project/);
  assert.match(data, /model\.modelKey !== "scenario-state-test"/);
  assert.match(registry, /interactive-specification/);
  assert.match(registry, /status: "archived"/);
});
