import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SlidersHorizontal } from 'lucide-react';
import { useUIStore } from '../../store/useUIStore';
import type { UiVisibility } from '../ui/AppProperties';

const panels: Array<{
  key: keyof Pick<UiVisibility, 'topPanel' | 'bottomPanel' | 'filmstrip' | 'leftPanel' | 'rightPanel'>;
  label: string;
}> = [
  { key: 'topPanel', label: 'workspace.panels.topPanel' },
  { key: 'bottomPanel', label: 'workspace.panels.bottomPanel' },
  { key: 'filmstrip', label: 'workspace.panels.filmstrip' },
  { key: 'leftPanel', label: 'workspace.panels.leftPanel' },
  { key: 'rightPanel', label: 'workspace.panels.rightPanel' },
];

export default function PanelVisibilityMenu() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const uiVisibility = useUIStore((state) => state.uiVisibility);
  const activeView = useUIStore((state) => state.activeView);
  const setUI = useUIStore((state) => state.setUI);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={container} className="absolute bottom-2 right-0 z-40">
      <button
        type="button"
        aria-label={t('workspace.panels.toggle')}
        title={t('workspace.panels.toggle')}
        aria-expanded={open}
        aria-haspopup="menu"
        className="rounded-l-md border border-r-0 border-border-color bg-surface p-1.5 text-text-primary shadow-md hover:bg-card-active"
        onClick={() => setOpen((value) => !value)}
      >
        <SlidersHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-0 right-full mr-2 min-w-40 rounded-md border border-border-color bg-surface p-2 shadow-lg"
        >
          <div className="px-2 pb-1 text-xs font-semibold text-text-secondary">{t('workspace.panels.heading')}</div>
          {panels
            .filter(({ key }) => key !== 'filmstrip' || activeView === 'editor')
            .map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-bg-secondary"
              >
                <input
                  type="checkbox"
                  checked={uiVisibility[key]}
                  onChange={() =>
                    setUI((state) => {
                      const isOpening = !state.uiVisibility[key];
                      return {
                        uiVisibility: { ...state.uiVisibility, [key]: isOpening },
                        ...(key === 'leftPanel' && isOpening && state.leftPanelWidth < 250
                          ? { leftPanelWidth: 350 }
                          : {}),
                        ...(key === 'rightPanel' && isOpening && state.rightPanelWidth < 250
                          ? { rightPanelWidth: 350 }
                          : {}),
                      };
                    })
                  }
                />
                {t(label as any)}
              </label>
            ))}
        </div>
      )}
    </div>
  );
}
