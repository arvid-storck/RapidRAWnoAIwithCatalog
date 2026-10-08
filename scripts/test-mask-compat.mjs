import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/adjustments.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(code, {
  exports,
  require: (name) => {
    if (name === 'uuid') return { v4: () => 'generated-id' };
    if (name.endsWith('/Masks')) return { Mask: { Brush: 'brush' }, SubMaskMode: { Additive: 'additive' } };
    throw new Error(`Unexpected import: ${name}`);
  },
});
const legacy = {
  id: 'legacy',
  type: 'quick-selection',
  visible: false,
  opacity: 42,
  mode: 'subtractive',
  parameters: { lines: [{ tool: 'brush', brushSize: 12, points: [{ x: 5, y: 6 }] }] },
};
const normal = { ...legacy, id: 'normal', type: 'brush' };
const original = { masks: [{ id: 'container', subMasks: [legacy, normal], adjustments: { exposure: 1 } }] };
const result = exports.normalizeLoadedAdjustments(original);
const [converted, unchanged] = result.masks[0].subMasks;
assert.equal(converted.type, 'brush');
assert.equal(converted.id, legacy.id);
assert.equal(converted.opacity, 42);
assert.equal(converted.visible, false);
assert.equal(converted.mode, 'subtractive');
assert.equal(converted.parameters, legacy.parameters);
assert.equal(unchanged.type, 'brush');
assert.equal(result.masks[0].adjustments.exposure, 1);
assert.equal(legacy.type, 'quick-selection', 'normalization must not mutate loaded data');
console.log('Legacy mask brush compatibility checks passed.');
