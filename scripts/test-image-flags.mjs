import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Run the real flag action with in-memory stores and IPC, never the user's files.
const calls = [];
const errors = [];
let refreshes = 0;
let fail = false;
let view = 'library';
const state = {
  imageList: [
    { path: 'a', tags: ['user:Travel'] },
    { path: 'b', tags: [] },
  ],
  imageFlags: {},
  multiSelectedPaths: ['a', 'b'],
  libraryActivePath: 'a',
  setLibrary(updater) {
    Object.assign(this, typeof updater === 'function' ? updater(this) : updater);
  },
};
const mocks = {
  i18next: { t: (key) => key },
  '@tauri-apps/api/core': {
    invoke: async (command, args) => {
      calls.push([command, args]);
      if (fail && command === 'flag') throw new Error('Test write failure');
    },
  },
  'react-toastify': { toast: { error: (error) => errors.push(error) } },
  '../components/ui/AppProperties': { Invokes: { SetFlagForPaths: 'flag', CatalogRefreshPaths: 'index' } },
  '../store/useEditorStore': { useEditorStore: { getState: () => ({ selectedImage: { path: 'hidden-editor' } }) } },
  '../store/useLibraryStore': { useLibraryStore: { getState: () => state } },
  '../store/useUIStore': { useUIStore: { getState: () => ({ activeView: view }) } },
  './catalog': {
    refreshCatalog: async () => {
      refreshes++;
    },
  },
};
const source = fs.readFileSync(new URL('../src/utils/imageFlags.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, {
  exports,
  require: (id) => {
    assert.ok(id in mocks, id);
    return mocks[id];
  },
  console,
});

exports.setImageFlag('pick');
const last = exports.setImageFlag('reject');
assert.equal(exports.getImageFlag(state.imageList[0].tags), 'reject');
assert.equal(exports.getImageFlag(exports.withPendingImageFlag({ path: 'a', tags: [] }).tags), 'reject');
await last;
assert.equal(refreshes, 1, 'Refresh only after queued writes finish');
assert.deepEqual(JSON.parse(JSON.stringify(calls.filter(([command]) => command === 'flag'))), [
  ['flag', { paths: ['a', 'b'], flag: 'pick' }],
  ['flag', { paths: ['a', 'b'], flag: 'reject' }],
]);
assert.ok(state.imageList[0].tags.includes('user:Travel'));
await exports.setImageFlag('reject');
assert.equal(exports.getImageFlag(state.imageList[0].tags), null, 'Repeated flag toggles off');

fail = true;
await exports.setImageFlag('pick');
assert.equal(exports.getImageFlag(state.imageList[0].tags), null, 'Failed writes roll back');
assert.equal(errors.length, 1);
fail = false;
await exports.setImageFlag('pick', ['a']);
assert.equal(exports.getImageFlag(state.imageList[0].tags), 'pick', 'Queue survives failed write');
assert.equal(exports.getImageFlag(state.imageList[1].tags), null);
view = 'editor';
await exports.setImageFlag('reject');
assert.equal(calls.filter(([command]) => command === 'flag').at(-1)[1].paths[0], 'hidden-editor');
await exports.setImageFlag(null, ['a'], false);
assert.equal(exports.getImageFlag(state.imageList[0].tags), null, 'Clear flag');
console.log('Passed flag multi-selection, scope, queue, pending overlay, toggle, clear and failure-recovery tests.');
