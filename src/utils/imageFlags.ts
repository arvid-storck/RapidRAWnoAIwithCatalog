import { t as translate } from 'i18next';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'react-toastify';
import { Invokes, ImageFile } from '../components/ui/AppProperties';
import { useEditorStore } from '../store/useEditorStore';
import { useLibraryStore } from '../store/useLibraryStore';
import { useUIStore } from '../store/useUIStore';
import { refreshCatalog } from './catalog';

export type ImageFlag = 'pick' | 'reject' | null;
export const getImageFlag = (tags?: string[] | null): ImageFlag =>
  tags?.includes('flag:reject') ? 'reject' : tags?.includes('flag:pick') ? 'pick' : null;

// Serialize flag writes so rapid keyboard toggles cannot complete out of order.
let pending = Promise.resolve();
let queuedWrites = 0;
let writeId = 0;
const writes = new Map<string, { id: number; flag: ImageFlag }>();
const flagTags = (tags: string[] | null | undefined, flag: ImageFlag) => [
  ...(tags ?? []).filter((tag) => !tag.startsWith('flag:')),
  ...(flag ? [`flag:${flag}`] : []),
];

export function withPendingImageFlag(image: ImageFile): ImageFile {
  const write = writes.get(image.path);
  return write ? { ...image, tags: flagTags(image.tags, write.flag) } : image;
}
export function setImageFlag(flag: ImageFlag, paths?: string[], toggle = true) {
  const state = useLibraryStore.getState();
  const edited = useEditorStore.getState().selectedImage?.path;
  const selected =
    paths ??
    (edited && useUIStore.getState().activeView === 'editor'
      ? [edited]
      : state.multiSelectedPaths.length
        ? state.multiSelectedPaths
        : state.libraryActivePath
          ? [state.libraryActivePath]
          : []);
  if (!selected.length) return;
  const id = ++writeId;
  const previousFlags = Object.fromEntries(
    selected.map((path) => {
      const image = state.imageList.find((image) => image.path === path);
      return [path, image ? getImageFlag(image.tags) : (state.imageFlags[path] ?? null)];
    }),
  );
  const current =
    state.imageFlags[selected[0]] ?? getImageFlag(state.imageList.find((image) => image.path === selected[0])?.tags);
  const final = toggle && flag === current ? null : flag;
  selected.forEach((path) => writes.set(path, { id, flag: final }));
  const apply = (tags?: string[] | null) => [
    ...(tags ?? []).filter((tag) => !tag.startsWith('flag:')),
    ...(final ? [`flag:${final}`] : []),
  ];
  state.setLibrary({
    imageList: state.imageList.map((image) =>
      selected.includes(image.path) ? { ...image, tags: apply(image.tags) } : image,
    ),
    imageFlags: { ...state.imageFlags, ...Object.fromEntries(selected.map((path) => [path, final])) },
  });
  queuedWrites += 1;
  pending = pending
    .then(async () => {
      await invoke(Invokes.SetFlagForPaths, { paths: selected, flag: final });
      await invoke(Invokes.CatalogRefreshPaths, { paths: selected });
    })
    .catch((error) => {
      toast.error(translate('messages.imageFlags.could_not_save_flag', { value1: String(error) }));
      const rollback = selected.filter((path) => writes.get(path)?.id === id);
      useLibraryStore.getState().setLibrary((latest) => ({
        imageList: latest.imageList.map((image) =>
          rollback.includes(image.path) ? { ...image, tags: flagTags(image.tags, previousFlags[image.path]) } : image,
        ),
        imageFlags: {
          ...latest.imageFlags,
          ...Object.fromEntries(rollback.map((path) => [path, previousFlags[path]])),
        },
      }));
    })
    .finally(async () => {
      selected.forEach((path) => {
        if (writes.get(path)?.id === id) writes.delete(path);
      });
      queuedWrites -= 1;
      if (queuedWrites === 0)
        await refreshCatalog().catch((error) =>
          toast.error(translate('messages.imageFlags.could_not_refresh_flags', { value1: String(error) })),
        );
    });
  return pending;
}
