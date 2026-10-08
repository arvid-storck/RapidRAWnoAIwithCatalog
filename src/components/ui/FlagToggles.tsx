import { Flag, FlagOff } from 'lucide-react';
import { useLibraryStore } from '../../store/useLibraryStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useUIStore } from '../../store/useUIStore';
import { getImageFlag, setImageFlag } from '../../utils/imageFlags';

export default function FlagToggles() {
  const edited = useEditorStore((s) => s.selectedImage?.path);
  const state = useLibraryStore();
  const inEditor = useUIStore((s) => s.activeView === 'editor');
  const paths =
    edited && inEditor
      ? [edited]
      : state.multiSelectedPaths.length
        ? state.multiSelectedPaths
        : state.libraryActivePath
          ? [state.libraryActivePath]
          : [];
  const flag =
    state.imageFlags[paths[0]] ?? getImageFlag(state.imageList.find((image) => image.path === paths[0])?.tags);
  return (
    <div className="flex gap-1">
      {(['pick', 'reject'] as const).map((value) => (
        <button
          key={value}
          disabled={!paths.length}
          aria-label={value === 'pick' ? 'Pick (P)' : 'Reject (X)'}
          aria-pressed={flag === value}
          data-tooltip={value === 'pick' ? 'Pick (P)' : 'Reject (X)'}
          className={`p-1 rounded disabled:opacity-40 ${flag === value ? 'bg-accent text-button-text' : 'text-text-secondary hover:bg-surface'}`}
          onClick={() => setImageFlag(value, paths)}
        >
          {value === 'pick' ? <Flag size={18} /> : <FlagOff size={18} />}
        </button>
      ))}
    </div>
  );
}
