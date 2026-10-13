import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const load = (file, modules = {}) => {
  const exports = {};
  vm.runInNewContext(ts.transpile(read(file), { module: ts.ModuleKind.CommonJS }), {
    exports,
    require: (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return exports;
};
const { resizeZoomViewport } = load('src/utils/zoom.ts');
const first = { containerWidth: 1000, containerHeight: 700, width: 1000, height: 500, offsetX: 0, offsetY: 100 };
const second = { containerWidth: 600, containerHeight: 500, width: 600, height: 300, offsetX: 0, offsetY: 100 };
const original = { scale: 2, positionX: -200, positionY: -300 };
const resized = resizeZoomViewport(first, second, original, 8);
assert.ok(Math.abs(resized.scale * second.width - original.scale * first.width) < 1e-9);
const restored = resizeZoomViewport(
  second,
  first,
  { scale: resized.scale, positionX: resized.x, positionY: resized.y },
  8,
);
assert.ok(Math.abs(restored.x - original.positionX) < 1e-9);
assert.ok(Math.abs(restored.y - original.positionY) < 1e-9);
assert.equal(restored.scale, original.scale);

let states = [],
  cursor = 0;
const react = {
  useState(initial) {
    const index = cursor++;
    states[index] = typeof initial === 'function' ? initial() : initial;
    return [
      states[index],
      (next) => {
        states[index] = typeof next === 'function' ? next(states[index]) : next;
      },
    ];
  },
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
};
const { useExportSettings } = load('src/hooks/useExportSettings.ts', {
  react,
  '../components/ui/ExportImportProperties': {
    WatermarkAnchor: { BottomRight: 'bottom-right' },
    FILE_FORMATS: [{ id: 'jpeg' }, { id: 'png' }, { id: 'tiff' }],
  },
});
const draft = useExportSettings();
draft.setFileFormat('png');
draft.setPngBitDepth(16);
draft.setJpegQuality(72);
draft.setResizeValue(1234);
draft.setFilenameTemplate('session-test');
draft.setStripGps(false);
states = [];
cursor = 0;
const reopened = useExportSettings();
assert.equal(reopened.fileFormat, 'png');
assert.equal(reopened.pngBitDepth, 16);
assert.equal(reopened.jpegQuality, 72);
assert.equal(reopened.resizeValue, 1234);
assert.equal(reopened.filenameTemplate, 'session-test');
assert.equal(reopened.stripGps, false);
reopened.handleApplyPreset({ ...reopened.currentSettingsObject, fileFormat: 'cube', pngBitDepth: 4 });
states = [];
cursor = 0;
const migrated = useExportSettings();
assert.equal(migrated.fileFormat, 'jpeg');
assert.equal(migrated.pngBitDepth, 8);
assert.doesNotMatch(read('src/App.tsx'), /COMPACT_EDITOR_MAX_WIDTH|useCompactPanels|compactEditorPanel/);
assert.doesNotMatch(read('src/components/panel/right/MetadataPanel.tsx'), /openstreetmap|<iframe/);
assert.match(read('src/components/panel/right/MetadataPanel.tsx'), /<details key=\{selectedImage.path\}/);
assert.match(read('src/hooks/useImageProcessing.ts'), /targetResolution:/);
assert.match(read('src-tauri/src/lib.rs'), /target_dim.hash\(&mut geometry_hasher\)/);
assert.equal(JSON.parse(read('src-tauri/tauri.conf.json')).productName, 'SlowRAW');
console.log('Passed viewport focus/scale round-trip, export remount persistence, metadata, crop and branding checks.');
