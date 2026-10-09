import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const source = ts.createSourceFile('main.tsx', read('src/main.tsx'), ts.ScriptTarget.Latest, true);
const guard = source.statements.find(
  (statement) => ts.isIfStatement(statement) && statement.expression.getText(source) === 'import.meta.env.PROD',
);
assert.ok(guard, 'Production must disable frontend logging.');

for (const production of [true, false]) {
  let calls = 0;
  const methods = ['debug', 'info', 'log', 'warn', 'error'];
  const consoleStub = Object.fromEntries(methods.map((method) => [method, () => calls++]));
  const code = guard.getText(source).replace('import.meta.env.PROD', String(production));
  vm.runInNewContext(ts.transpile(code), { console: consoleStub });
  for (const method of methods) consoleStub[method]('test');
  assert.equal(calls, production ? 0 : methods.length, 'Debug console must remain usable; production must be silent.');
}

const native = read('src-tauri/src/lib.rs');
assert.match(native, /#\[cfg\(debug_assertions\)\]\s*mod logging;/);
assert.match(native, /#\[cfg\(debug_assertions\)\]\s*logging::initialize\(\);/);
assert.match(read('src-tauri/Cargo.toml'), /log = \{[^\n]*"release_max_level_off"/);
assert.doesNotMatch(native, /app_log_dir|app\.log|frontend_log|get_log_file_path|fern::/);
assert.doesNotMatch(read('src/components/panel/SettingsPanel.tsx'), /GetLogFilePath|logPath|settings\.data\.logs/);
assert.equal(fs.existsSync(path.join(root, 'src/utils/frontendLogBridge.ts')), false);
assert.doesNotMatch(read('src-tauri/src/logging.rs'), /std::fs|OpenOptions|File::|create_dir/);
console.log('Passed production silence, debug console, and file-log removal checks.');
