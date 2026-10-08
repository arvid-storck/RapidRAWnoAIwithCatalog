import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/whiteBalance.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const exports = {};
runInNewContext(code, { exports });
const { resolveWhiteBalance, withKelvinWhiteBalance, kelvinSliderScale } = exports;
const asShot = { temperature: 5200, tint: 8 };
assert.equal(resolveWhiteBalance(asShot, { whiteBalance: null }), asShot);
assert.equal(resolveWhiteBalance(asShot, {}).temperature, 5200);
const result = withKelvinWhiteBalance({ exposure: 1 }, { temperature: 4500, tint: -12 });
assert.equal(result.exposure, 1);
assert.equal(result.whiteBalance.temperature, 4500);
assert.equal(result.whiteBalance.tint, -12);
const limited = withKelvinWhiteBalance({}, { temperature: 100000, tint: -999 }).whiteBalance;
assert.equal(limited.temperature, 50000);
assert.equal(limited.tint, -150);
const invalid = withKelvinWhiteBalance({}, { temperature: NaN, tint: Infinity }).whiteBalance;
assert.ok(Number.isFinite(invalid.temperature) && Number.isFinite(invalid.tint));
for (const kelvin of [2000, 4500, 6504, 25000, 50000]) {
  assert.ok(Math.abs(kelvinSliderScale.fromPosition(kelvinSliderScale.toPosition(kelvin)) - kelvin) < 1e-8);
}
console.log('White-balance frontend checks passed.');
