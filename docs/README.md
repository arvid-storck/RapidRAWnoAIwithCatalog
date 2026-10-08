# RapidRAW code map

This is a maintainer's map of the current source tree. It covers hand-maintained
application files; it does not enumerate third-party packages, generated build
output, every image asset, or every translation key. Read this alongside the
user-facing [root README](../README.md) and the separate [changelog](CHANGELOG.md).
This document describes the current implementation, not its development history.

## Current editing implementation

Export-setting presets and crop aspect-ratio choices are independent features.
The composition guide is Rule of Thirds; `O` toggles it on/off.

### Pick and Reject flags

`P` picks, `X` rejects, and `U` clears flags on
selected images. The bottom bar has toggles; thumbnails/list/filmstrip show badges
and dim rejects. Catalog flag filters combine with metadata filters and smart groups.
Flags are mutually exclusive internal `flag:pick`/`flag:reject` sidecar tags; SQLite
rebuilds the flag column from those tags. Flagging does not delete a source file.
`node scripts/test-image-flags.mjs` checks selection scope, queued writes, toggling,
clear, pending-page overlays and error rollback with in-memory stores/IPC only.

### Adjustment panels and curves

Adjustment panel customization is accessible in Settings → Customization only. Drag handles reorder sections and tool groups; eye buttons hide them.
Section/tool collapse state and layout are saved in `adjustmentLayout`. Hiding a
control does not bypass its processing; the existing section enable/disable control
remains separate. Startup migrates saved `adjustmentVisibility` preferences into
the current layout when `adjustmentLayout` is absent.
Shift/Alt slows curve dragging to one fifth; inactive channels show colored curves
and parametric reference markers.

### Guided filtering and export profiles

Guided-filter coefficients are built from log luminance/dark-channel statistics at
bounded resolution, cached with the GPU input, and sampled across render tiles.
Clarity, structure, dehaze and tonal detail recovery use them in preview and export.
Gaussian blur serves sharpening/glow/halation where needed. JPEG/PNG
encoders embed the bundled CC0 sRGB profile even when EXIF preservation is off;
other export formats do not embed ICC profiles. Thumbnail disk cache
keys include the renderer revision; mismatched renders are regenerated on demand.

### Kelvin white balance and area sampling

White balance uses a `whiteBalance: { temperature, tint }` adjustment
object (or `null` for camera/default balance), including masks. Standalone relative
`temperature`/`tint` fields are ignored by the renderer and discarded by frontend
adjustment normalization; they are not converted to Kelvin. `src/utils/whiteBalance.ts`
defines UI limits and logarithmic Kelvin slider scaling. `Color.tsx` displays Kelvin
and tint; `ImageCanvas.tsx` maps clicked/dragged regions through crop, orientation,
flips and perspective into original-image coordinates.

`src-tauri/src/white_balance.rs` converts camera matrices/neutral coefficients into
as-shot Kelvin/tint and computes Bradford LMS adaptation. Its bounded metadata cache
is keyed by path, modification time and file length. `raw_processing.rs` reads the
camera white without developing another image. `LoadedImage` carries the reference
white through preview, thumbnails and export. The `sample_white_balance` command
checks the requested image path, averages linear original pixels in a quadrilateral
on a blocking worker, and caps work at 262144 samples. It rejects invalid/dark samples.
Frontend session/generation guards discard stale picks when switching images/tools.
Run `cargo test --lib white_balance` in `src-tauri` for numerical and area-sampling tests.
Run `node scripts/test-white-balance.mjs` for frontend defaults, limits and slider scaling.

### Brush interactions

`ImageCanvas.tsx` keeps active Clone/Heal stroke points in local refs. A Konva
line previews the unfinished stroke; release commits one sidecar mask update.
Changing the image or active mask cancels an unfinished stroke. Normal Brush/Flow
masks retain live previews. Image processing and thumbnail invalidation follow
the normal adjustment path.

Legacy `quick-selection` sidecar masks load as ordinary Brush masks, retaining
their painted strokes, opacity and combination mode. The frontend normalizes
the old type; native mask dispatch accepts it as a brush for direct sidecar loads.
There is no selection-refinement implementation or associated UI. Old refined
contours cannot be reproduced; they now use the stored brush shape.
`node scripts/test-mask-compat.mjs` checks that frontend normalization preserves
strokes, IDs, visibility, opacity and blend mode without mutating loaded data.
The native `legacy_brush_tests` test verifies the same bitmap as an ordinary brush.

### Workspace panel layout

`LibraryView.tsx` and `EditorView.tsx` each own one `PanelVisibilityMenu` within
their central workspace; it never belongs to the catalog's right filter column.
`BottomBar.tsx` reserves space to the right of its action icons for this control,
which stays accessible when the bottom bar is hidden. Import is available in the
bottom bar and empty-library prompt, not the library header.

The library's flex chain uses `min-h-0` and clips the grid to its allotted viewport.
`LibraryGrid.tsx` gives react-window a 100%-height flex viewport instead of feeding
the previously measured pixel height back into layout. Its ResizeObserver only
tracks width for row layout. The bottom bar is non-shrinking and has its own
stacking level, so toggling it does not leave thumbnails covering it.

### Catalog panels, paging and smart groups

`CatalogPanel.tsx` renders capture-date years/months/days and the recursive album
hierarchy. Groups use persisted `expandedAlbumGroups`; creating a group expands
it and its parent. The saved panel ID `folderTree` is retained only as a workspace
compatibility identifier for `Panel.Catalog`, not a filesystem browser.

`useCatalog.ts`, mounted by App, initializes and loads the catalog independently
of panel visibility. Search is debounced and stale query replies are discarded.
`catalog_query_page` returns bounded rows and a filtered SQL count from one SQLite
read transaction. The shared filter builder ensures the page and count match;
the header shows page X of Y, match count and catalog total. Empty results show
page 1 of 1. When results shrink, an out-of-range page is clamped and reloaded.
Ordinary albums do not expose catalog page navigation.

Right-click a smart group → Edit filters opens the filter panel and loads its
criteria into a draft. Saving updates that group's ID in the existing hierarchy
instead of creating another group. Cancel editing leaves the stored group
unchanged. Legacy single-value filters are normalized by `normalizeCatalogFilter`;
`updateSmartGroup` updates nested smart groups without changing their placement.

The header has no Refresh button. Catalog folders → Rescan folders incrementally
checks disk changes; internal refreshes only reload index/facet data. GUI export
and external editor round trips remain; there is no headless batch-export command.

## Application overview

This is a customized RapidRAW build focused on local photo management and
non-destructive RAW editing.

- SQLite indexes the local photo library.
- Original photos remain on the filesystem; edits are stored separately.
- RAW development and image processing run locally.
- Model-based processing is used for noise reduction.

## How the parts fit together

```text
src/main.tsx -> src/App.tsx -> views/panels -> hooks and Zustand stores
                                      |
                                      v
                        Tauri invoke / event listeners
                                      |
                                      v
                  src-tauri/src/lib.rs -> Rust modules
                                      |
                       files, sidecars, SQLite, RAW engine
```

The React frontend owns presentation and temporary UI state. Rust owns disk
I/O, image decoding/rendering, export, and the SQLite catalog. Shared command
names and frontend data contracts live in `src/components/ui/AppProperties.tsx`;
Tauri command registration is near the end of `src-tauri/src/lib.rs`.

The catalog database is a rebuildable index, not the source of the photos or
edits. Photos stay at their paths, and sidecar/XMP data remains separate. The
catalog view queries bounded pages instead of loading every RAW file.

Thumbnail requests and caches are bounded. Removing a catalog entry is separate
from deleting its source file. File operations synchronize the catalog index.
See [catalog-focused-build.md](catalog-focused-build.md) for query/loading details.

Catalog filters are combined in SQLite, while
`src/utils/catalog.ts` retains the active image's optimistic rating when a new
rating removes it from the filtered page. Opening a video catalog entry launches
the system player; videos do not enter the image editor or thumbnail decoder.
RAW development has one path: `raw_processing.rs` uses the linked rawler crate
and hands pixels to `image_loader.rs` in memory. No external RAW component or
temporary transfer image is involved. `highlight_recovery.rs` applies the
user setting after development; Linear RAW Processing is controlled by the
persistent `linear_raw_mode` setting. Clone/Heal strokes live in sidecar mask adjustments and
are composited during image rendering without modifying the source file.

## Where to edit common features

| Task | Start here | Then check |
| --- | --- | --- |
| Catalog search, filters, dates, albums, smart groups | `src/components/panel/library/CatalogFilterPanel.tsx`, `src/utils/catalog.ts` | `src/store/useLibraryStore.ts`, `src-tauri/src/catalog.rs` |
| Import, copy/move, duplicate policy | `src/components/modals/ImportSettingsModal.tsx`, `src/components/panel/library/ImportChoiceMenu.tsx` | `src/hooks/useFileOperations.ts`, `src-tauri/src/file_management.rs`, `src-tauri/src/catalog.rs` |
| Video import and system-player opening | `src/hooks/useFileOperations.ts`, `src/hooks/useAppNavigation.ts`, `src/utils/mediaTypes.ts` | `src-tauri/src/formats.rs`, `src-tauri/src/catalog.rs`, `src/components/panel/library/LibraryItems.tsx` |
| Thumbnails and large-library performance | `src/hooks/useThumbnails.ts`, `src/components/panel/library/LibraryGrid.tsx` | `src-tauri/src/image_loader.rs`, `src-tauri/src/cache_utils.rs`, `src-tauri/src/catalog.rs` |
| Editor adjustment or preview | `src/components/panel/Editor.tsx`, `src/components/adjustments/` | `src/hooks/useImageProcessing.ts`, `src-tauri/src/image_processing.rs`, `src-tauri/src/gpu_processing.rs` |
| Clone/Heal spot removal | `src/components/panel/right/MasksPanel.tsx`, `src/components/panel/editor/ImageCanvas.tsx` | `src/utils/maskUtils.ts`, `src-tauri/src/spot_removal.rs`, `src-tauri/src/image_loader.rs` |
| Highlight Recovery | `src/components/panel/SettingsPanel.tsx` | `src-tauri/src/app_settings.rs`, `src-tauri/src/image_loader.rs`, `src-tauri/src/highlight_recovery.rs` |
| Noise reduction | `src/components/modals/DenoiseModal.tsx` | `src-tauri/src/denoising.rs`, `src-tauri/src/ai_processing.rs` |
| RAW dependency update | `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | `src-tauri/src/raw_processing.rs`, `src-tauri/src/exif_processing.rs`; rebuild the app |
| Lens profile update | `src/components/panel/SettingsPanel.tsx` | `src-tauri/src/component_updates.rs`, `src-tauri/src/lens_correction.rs` |
| TIFF bit depth and export metadata | `src/components/panel/right/ExportPanel.tsx`, `src/hooks/useExportSettings.ts` | `src-tauri/src/export_processing.rs`, `src-tauri/src/exif_processing.rs` |
| Keyboard shortcuts and Info-panel restoration | `src/hooks/useKeyboardShortcuts.ts` | `src/store/useUIStore.ts`, `src/components/panel/PanelVisibilityMenu.tsx` |
| Zoom and panel visibility | `src/components/panel/SettingsPanel.tsx`, `src/components/panel/PanelVisibilityMenu.tsx` | `src/utils/zoom.ts`, `src/store/useUIStore.ts`, `src-tauri/src/app_settings.rs` |
| Portable data and ZIP | `scripts/build-portable.ps1` | `src-tauri/src/portable_paths.rs`, `src-tauri/tauri.conf.json` |
| UI text | `src/i18n/locales/en.json` | `src/i18n/index.ts`, `i18next.config.ts`; this tree includes English only |

## Root and build files

| File or directory | Responsibility |
| --- | --- |
| `package.json` / `package-lock.json` | Frontend dependencies and npm commands / locked versions. |
| `index.html` | Vite's HTML entry point. |
| `vite.config.mjs` | Frontend bundling and dev-server configuration. |
| `tsconfig.json` | TypeScript compiler settings. |
| `eslint.config.js` | Lint rules. |
| `.prettierrc` / `.prettierignore` | Formatter rules and exclusions. |
| `.gitignore` | Generated/local paths excluded from version control. |
| `i18next.config.ts` | Translation extraction/check configuration. |
| `src-tauri/Cargo.toml` / `Cargo.lock` | Rust dependencies / locked versions, including the linked rawler source revision. |
| `src-tauri/rust-toolchain.toml` | Rust toolchain selection. |
| `src-tauri/build.rs` | Build-time resource/dependency preparation. |
| `src-tauri/tauri.conf.json` | Main Tauri app/build configuration. |
| `src-tauri/tauri.linux.conf.json` / `tauri.macos.conf.json` | Platform-specific Tauri overrides. |
| `src-tauri/capabilities/` | Tauri permissions. |
| `src-tauri/icons/` | App icons. |
| `src-tauri/lensfun_db/` | Bundled lens profiles; separately updatable at runtime. |
| `src-tauri/resources/` | Bundled runtime resources, LUTs, licenses, and native libraries. |
| `public/` | Optional static assets copied by Vite; currently empty. No splash-image assets are required. |
| `data/` | Linux desktop entry and AppStream metadata; not the user's catalog database. |
| `packaging/` | Linux/Flatpak and dependency-source packaging metadata. |

### Scripts and existing docs

| File | Responsibility |
| --- | --- |
| `scripts/build-portable.ps1` | Builds and packages a portable Windows ZIP without overwriting an existing output folder. |
| `scripts/clean.mjs` | Removes explicit generated build paths; `--dependencies` also removes node_modules and downloaded ONNX runtime files, with project-boundary and symlink checks. |
| `scripts/test-catalog.mjs` | In-memory catalog paging/count/stale-reply, smart-filter editing and album-group creation checks. |
| `scripts/test-image-flags.mjs` | In-memory flag selection, write queue and rollback regression checks. |
| `scripts/test-white-balance.mjs` | Frontend white-balance defaults, bounds and Kelvin slider scaling checks. |
| `docs/README.md` | Source-file map and technical overview (this document). |
| `docs/catalog-focused-build.md` | Catalog filtering, paging, cache and validation notes. |

## Frontend files (`src/`)

### Entry, state, and navigation

| File | Responsibility |
| --- | --- |
| `main.tsx` | Starts React and installs the frontend log bridge. |
| `App.tsx` | Composes the application shell, views, global panels, events, and interactions. |
| `styles.css` | Global styles and theme-related CSS. |
| `window/TitleBar.tsx` | Custom window title bar. |
| `store/useEditorStore.ts` | Selected image, adjustments, editor state, undo/copy state. |
| `store/useLibraryStore.ts` | Library images, catalog mode, filters, pages, albums, selection; default sort is capture date ascending, with saved preferences restored at startup. |
| `store/useProcessStore.ts` | Long-running process/progress state. |
| `store/useSettingsStore.ts` | Loaded application settings and settings updates. |
| `store/useUIStore.ts` | Active view, panel layout/visibility, dialogs, UI state; discards unsupported panel identifiers from saved layouts. |
| `components/views/LibraryView.tsx` | Library/catalog layout, grid, bottom bar, filter panel. |
| `components/views/EditorView.tsx` | Editor layout, side panels, toolbar, filmstrip. |
| `components/managers/ImageLoaderManager.tsx` | Mounts the image-loading hook without rendering UI. |
| `components/managers/ImageProcessingManager.tsx` | Mounts the image-processing hook and passes render job refs. |
| `context/ContextMenuContext.tsx` | Context-menu provider and menu actions. |
| `context/TaggingSubMenu.tsx` | Tag actions inside image context menus. |

### Hooks

| File | Responsibility |
| --- | --- |
| `hooks/useAppContextMenus.ts` | App-level context-menu construction. |
| `hooks/useAppInitialization.ts` | Loads settings, workspace and startup state. |
| `hooks/useCatalog.ts` | Catalog initialization, debounced paged loading and sort-page reset independent of panel visibility. |
| `hooks/useAppNavigation.ts` | Switches between library/editor and opens catalog videos in the system player. |
| `hooks/useEditorActions.ts` | Editor commands such as zoom and adjustment actions. |
| `hooks/useExportSettings.ts` | Export option state and defaults. |
| `hooks/useExternalEditSession.ts` | Round-trip editing with another application. |
| `hooks/useFileOperations.ts` | Frontend file, folder, import, rename, and delete actions. |
| `hooks/useImageLoader.ts` | Requests image data and coordinates loading. |
| `hooks/useImageProcessing.ts` | Requests rendered previews/processing from Rust. |
| `hooks/useImageRenderSize.ts` | Computes render dimensions for the editor. |
| `hooks/useKeyboardShortcuts.ts` | Application keyboard bindings. |
| `hooks/useLibraryActions.ts` | Library selection, rating, tag, album, and catalog actions. |
| `hooks/useOsPlatform.ts` | OS detection for UI choices. |
| `hooks/useProductivityActions.ts` | Higher-level batch/productivity actions. |
| `hooks/useSortedLibrary.ts` | Non-catalog sorting, grouping, and filtering. Catalog mode is paged in Rust. |
| `hooks/useTauriListeners.ts` | Subscribes to backend events and progress notifications. |
| `hooks/useThumbnails.ts` | Thumbnail request batching and cache coordination. |
| `hooks/useWaveformControls.ts` | Waveform display controls. |

### Library and editor panels

| File | Responsibility |
| --- | --- |
| `components/panel/MainLibrary.tsx` | Main library header and image grid host; sort, display, size and layout selects share theme-aware styling. |
| `components/panel/BottomBar.tsx` | Rating/copy/export controls, zoom, and optional filmstrip. |
| `components/panel/Filmstrip.tsx` | Scrollable editor thumbnail strip. |
| `components/panel/Editor.tsx` | Editor canvas, interactions, render requests, and toolbar integration. |
| `components/panel/SettingsPanel.tsx` | Settings categories and controls, including zoom/update actions. |
| `components/panel/PanelSwitcher.tsx` | Switches active editor side panel. |
| `components/panel/PanelVisibilityMenu.tsx` | Shows/hides top, bottom, side, and filmstrip panels. |
| `components/panel/SidePanelArea.tsx` | Dockable/resizable editor side panels. |
| `components/panel/library/CatalogFilterPanel.tsx` | Multi-select facets, smart-group draft/save controls and catalog-folder management. |
| `components/panel/library/ImportChoiceMenu.tsx` | Import file/folder choice. |
| `components/panel/library/LibraryGrid.tsx` | Image grid/list container and virtualization behavior. |
| `components/panel/library/LibraryItems.tsx` | Individual thumbnail/list item rendering. |
| `components/panel/editor/EditorToolbar.tsx` | Editor top toolbar actions and image information. |
| `components/panel/editor/ExifIcons.tsx` | Reusable EXIF symbols. |
| `components/panel/editor/ImageCanvas.tsx` | Image canvas display and interaction layer. |
| `components/panel/editor/overlays/CompositionOverlays.tsx` | Rule of Thirds SVG guide; accepts only off/thirds modes. |
| `components/panel/editor/Waveform.tsx` | Image waveform visualization. |
| `components/panel/right/ControlsPanel.tsx` | Main adjustment controls. |
| `components/panel/right/CropPanel.tsx` | Crop, straighten, and geometry controls. |
| `components/panel/right/ExportPanel.tsx` | Export configuration, including 8/16-bit TIFF, and action. |
| `components/panel/library/CatalogPanel.tsx` | Capture-date tree and recursive albums, groups and smart groups. |
| `components/panel/right/Masks.tsx` | Mask editing UI pieces. |
| `components/panel/right/MasksPanel.tsx` | Mask list and controls. |
| `components/panel/right/MetadataPanel.tsx` | EXIF/file metadata display. |

### Adjustments and dialogs

| File | Responsibility |
| --- | --- |
| `components/adjustments/Basic.tsx` | Basic tone and exposure controls. |
| `components/adjustments/Color.tsx` | Color adjustment controls. |
| `components/adjustments/Curves.tsx` | Tone/color curve controls. |
| `components/adjustments/AdjustmentSubSection.tsx` | Persistent collapsible tool groups; UI-only visibility. |
| `components/panel/right/AdjustmentSectionsSubMenu.tsx` | Drag ordering, visibility and reset for sections/tools. |
| `components/adjustments/Details.tsx` | Sharpening and detail controls. |
| `components/adjustments/Effects.tsx` | Effects and finishing controls. |
| `components/modals/AppModals.tsx` | Mounts application dialogs from UI state. |
| `components/modals/CollageModal.tsx` | Collage creation. |
| `components/modals/ConfirmModal.tsx` | Shared confirmation dialog. |
| `components/modals/CopyPasteSettingsModal.tsx` | Chooses adjustment types to copy/paste. |
| `components/modals/CreateFolderModal.tsx` | Folder creation dialog. |
| `components/modals/CullingModal.tsx` | Culling workflow dialog. |
| `components/modals/DenoiseModal.tsx` | Noise-reduction dialog. |
| `components/modals/FocusStackModal.tsx` | Focus-stacking dialog. |
| `components/modals/HdrModal.tsx` | HDR merge dialog. |
| `components/modals/ImportSettingsModal.tsx` | Import source/destination, copy/move, and folder structure choices. |
| `components/modals/NegativeConversionModal.tsx` | Film negative conversion dialog. |
| `components/modals/PanoramaModal.tsx` | Panorama stitching dialog. |
| `components/modals/RenameFileModal.tsx` | File rename dialog. |
| `components/modals/RenameFolderModal.tsx` | Folder rename dialog. |

### Reusable UI and frontend utilities

| File | Responsibility |
| --- | --- |
| `components/ui/AppProperties.tsx` | Shared frontend types, enums, and Tauri command names. |
| `components/ui/Button.tsx` | Shared button. |
| `components/ui/CollapsibleSection.tsx` | Expandable settings/control section. |
| `components/ui/ColorWheel.tsx` | Color-wheel control. |
| `components/ui/DepthRangePicker.tsx` | Depth-range selection control. |
| `components/ui/Dropdown.tsx` | Shared dropdown/select control. |
| `components/ui/ExportImportProperties.tsx` | Shared export/import data definitions. |
| `components/ui/ExportPresetsList.tsx` | Export preset list. |
| `components/ui/ExternalEditBar.tsx` | External-edit session banner/actions. |
| `components/ui/GlobalTooltip.tsx` | Shared tooltip display. |
| `components/ui/ImagePicker.tsx` | Image selection control. |
| `components/ui/Input.tsx` | Shared input. |
| `components/ui/LUTControl.tsx` | LUT selection and strength control. |
| `components/ui/Resizer.tsx` | Draggable panel divider. |
| `components/ui/Slider.tsx` | Shared slider. |
| `components/ui/FlagToggles.tsx` | Bottom-bar Pick/Reject toggles for editor/library selections. |
| `utils/imageFlags.ts` | Flag selection, optimistic state and serialized sidecar/index writes. |
| `components/ui/Switch.tsx` | Shared toggle switch. |
| `components/ui/Text.tsx` | Typography wrapper. |
| `types/typography.ts` | Text variants/color/weight types. |
| `utils/adjustments.ts` | Adjustment defaults, color labels, and conversion helpers. |
| `utils/catalog.ts` | Catalog IPC helpers, page loading, refresh, request handling, and preserving the edited image's visible rating when it leaves an active filter. |
| `utils/CollageVariants.tsx` | Collage layout definitions/icons. |
| `utils/cropUtils.ts` | Crop geometry helpers. |
| `utils/frontendLogBridge.ts` | Forwards frontend errors/logs into application logging. |
| `utils/imageGrouping.ts` | Grouping related images and expanding group selections. |
| `utils/ImageLRUCache.ts` | Frontend image LRU cache. |
| `utils/keyboardUtils.ts` | Shortcut definitions, parsing, and normalization. |
| `utils/maskUtils.ts` | Mask conversion and helper functions. |
| `utils/mediaTypes.ts` | Frontend video-path recognition used to keep videos out of the image editor and thumbnail pipeline. |
| `utils/themes.ts` | Theme definitions. |
| `utils/zoom.ts` | Zoom constants and constraints. |
| `utils/whiteBalance.ts` | Kelvin/tint types and limits, default resolution and logarithmic temperature slider scaling. |

### Localization and miscellaneous frontend files

| File | Responsibility |
| --- | --- |
| `i18n/index.ts` | Initializes i18next and registers locale bundles. |
| `i18n/check-runtime.mjs` | Checks translation keys used at runtime. |
| `i18n/update_translations.py` | Legacy one-off script for zoom-click strings; skips absent locale files. Prefer the npm extraction/check commands for current maintenance. |
| `i18n/locales/en.json` | English source strings. |
| `@types/i18next.d.ts` | TypeScript declarations for translation keys. |

## Rust backend files (`src-tauri/src/`)

| File | Responsibility |
| --- | --- |
| `main.rs` | Native executable entry point; calls `rapidraw_lib::run()`. |
| `lib.rs` | Tauri setup, command implementations/registration and application wiring. |
| `adjustment_utils.rs` | Shared adjustment-processing helpers. |
| `ai_processing.rs` | Model-backed noise reduction and remaining compatibility types. |
| `app_settings.rs` | Persistent settings schema, defaults, loading/saving, workspace defaults. |
| `app_state.rs` | Shared native application state and caches. |
| `cache_utils.rs` | Image/render cache keys and cache containers. |
| `catalog.rs` | SQLite schema/index, catalog folders, metadata facets, filtering, albums/smart groups, paged queries. |
| `component_updates.rs` | Downloads Lensfun profile updates. |
| `culling.rs` | Image culling analysis/actions. |
| `denoising.rs` | Noise-reduction algorithms and save/batch flows. |
| `exif_processing.rs` | EXIF extraction and sidecar reading/writing. |
| `export_processing.rs` | Export formats and output encoding, including true 8/16-bit TIFF. |
| `file_management.rs` | Filesystem operations, import/move/copy, sidecars, and path handling. |
| `focus_stacking.rs` | Focus-stack processing. |
| `formats.rs` | Supported image, RAW, and video-format recognition. |
| `gpu_processing.rs` | GPU render pipeline and shader integration. |
| `shaders/guided.wgsl` | GPU log-statistics, box filtering and guided coefficient passes. |
| `../icc/sRGB-v2-magic.icc`, `../icc/README.md` | Embedded export profile and CC0 attribution. |
| `guided_perspective.rs` | Guided perspective correction. |
| `hdr_deghosting.rs` | HDR input alignment/deghosting. |
| `image_loader.rs` | Image decoding/loading, in-process RAW dispatch, Highlight Recovery, and composite preview support. |
| `highlight_recovery.rs` | Adjustable highlight recovery applied after RAW development. |
| `raw_processing.rs` | In-process rawler development, Linear RAW modes, and RAW orientation. |
| `white_balance.rs` | Camera white-balance metadata, Kelvin/tint conversion, cached references and Bradford adaptation. |
| `multi_exposure.rs` | Canon in-camera multi-exposure white-balance handling used by RAW development. |
| `image_processing.rs` | Core adjustment pipeline, geometry, color, masks, histogram/waveform data. |
| `launch_request.rs` | File/open and external editor round-trip requests; no CLI batch export. |
| `lens_blur.rs` | Lens/portrait blur processing. |
| `lens_correction.rs` | Lensfun lookup and optical corrections. |
| `lut_processing.rs` | LUT parsing/application. |
| `mask_generation.rs` | Mask definitions/generation with legacy type aliases for sidecar compatibility. |
| `negative_conversion.rs` | Film-negative conversion. |
| `panorama_stitching.rs` | Panorama commands and stitching workflow. |
| `panorama_utils/mod.rs` | Panorama utility module exports. |
| `panorama_utils/processing.rs` | Panorama image-processing helpers. |
| `panorama_utils/stitching.rs` | Panorama matching/stitching helpers. |
| `portable_paths.rs` | Portable marker detection and app-data/config paths. |
| `spot_removal.rs` | Non-destructive source-based Clone and Heal compositing for mask strokes. |
| `tagging.rs` | Per-image tag add/remove and sidecar synchronization. |
| `tagging_utils/mod.rs` | Tagging helper module exports. |
| `tagging_utils/candidates.rs` | Candidate tag handling helpers. |
| `tagging_utils/hierarchy.rs` | Tag hierarchy helpers. |
| `window_customizer.rs` | Window/webview customization. |
| `shaders/blur.wgsl` | GPU blur shader. |
| `shaders/display.wgsl` | GPU display shader. |
| `shaders/flare.wgsl` | GPU flare shader. |
| `shaders/shader.wgsl` | Main GPU image-processing shader. |

## Updating the RAW engine

From the project root, updating rawler in the source code only requires:

```powershell
cargo update --manifest-path src-tauri/Cargo.toml -p rawler
```

`Cargo.toml` points to upstream rawler and `Cargo.lock` records the selected
revision. Keep the updated lockfile. Rebuild RapidRAW normally afterward.
If upstream changes its API, adapt `raw_processing.rs` (development/orientation)
and `exif_processing.rs` (metadata). `image_loader.rs` receives decoded pixels
directly in memory without external processes or temporary images.
`multi_exposure.rs` and `highlight_recovery.rs` provide additional processing.
Linear RAW Processing and Highlight Recovery are persisted in `app_settings.rs`.

## Development checks

```powershell
npm run typecheck
npm run lint
npm run i18n:check
npm run i18n:lint
node scripts/test-catalog.mjs
node scripts/test-image-flags.mjs
node scripts/test-white-balance.mjs
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Run `npm ci` first if dependencies were cleaned. Frontend build, TypeScript,
translation validation and native tests are separate checks.

The optimized debug profile disables incremental application codegen to avoid
stale anonymous LLVM symbols in cross-crate `image_hasher` code when linking the
Windows executable (`LNK2019` followed by `LNK1120`). Dependency artifacts remain
cached; this does not change runtime optimization or the release profile.
Do not override this with `CARGO_INCREMENTAL=1` when reproducing the linker issue.
Native library tests do not verify all code pulled into the desktop executable:
also run `cargo build --manifest-path src-tauri/Cargo.toml --bin RapidRAW` to
check debug linking, and `npm run tauri -- build --no-bundle` to verify the
production executable with its embedded frontend.

The native app uses Windows/macOS/Linux icons referenced by Tauri and the
Linux packaging icon. Desktop builds do not require mobile/scaffold icons or
libgphoto2. Existing user preset files are independent of application source files.

### Dependency and distribution size

- Shell and filesystem plugins are not registered: application file/process
  operations run in Rust. `tauri-plugin-fs` still arrives transitively through
  the dialog plugin, whose filesystem scope integration is optional.
- Frontend icons use Lucide. Process/file operations use native Rust commands;
  futures crates are transitive dependencies rather than a direct dependency.
- Tokio explicitly requests its multithreaded runtime, synchronization and
  timers. Networking features needed by HTTPS dependencies remain transitive.
- Imageproc enables Rayon without text rendering or FFT hashing.
  Separate image hashing and supported codecs have their own dependencies.
- Sysinfo retains disk and system/memory queries, but not unused user, network
  and component sensors. Reqwest retains JSON/HTTPS but not unused multipart.
- ORT uses the verified ONNX runtime supplied by `build.rs`; its
  automatic binary download/copy features are disabled. Standard, ndarray and
  tracing support remain. The runtime-load regression test checks the native
  library can still initialize without downloading the denoising model.
- Release uses speed optimization, LTO and symbol stripping, with unwinding
  retained for panics.
- Portable packaging excludes Linux/macOS ONNX runtimes from the Windows ZIP
  while preserving other resources/licenses. It reports EXE, folder and ZIP
  sizes. Compiler caches, npm dependencies, `.pdb` and `.rlib` files are not
  included in the portable package.

`npm run clean` removes build caches, not application functionality. It does
not make an existing EXE smaller. Export portable output before cleaning;
use a fresh output directory rather than overwriting portable user data.
`npm run clean:deep` adds `node_modules` and the explicit runtime files
`src-tauri/resources/onnxruntime.dll`, `libonnxruntime.so` and
`libonnxruntime.dylib` to cleanup. It leaves other resources and reference folders
untouched. `build.rs` downloads the required platform runtime if it is absent.
Both commands support `-- --dry-run` to list existing cleanup targets without deletion.

Package sizes depend on the toolchain, dependency versions and bundled resources.
Use the portable script's size report for the build being distributed.
Interactive UI and real-camera regression checks are separate from automated tests.
