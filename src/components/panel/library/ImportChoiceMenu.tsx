import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState } from 'react';
import { FileInput, FolderPlus } from 'lucide-react';

interface ImportChoiceMenuProps {
  onFiles(): void;
  onFolder(): void;
  iconOnly?: boolean;
  disabled?: boolean;
}

export default function ImportChoiceMenu({
  onFiles,
  onFolder,
  iconOnly = false,
  disabled = false,
}: ImportChoiceMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

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

  const choose = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label={iconOnly ? t('modals.importSettings.title') : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        data-tooltip={iconOnly ? t('modals.importSettings.title') : undefined}
        className={
          iconOnly
            ? 'p-1.5 rounded-md transition-colors text-text-secondary hover:bg-surface hover:text-text-primary disabled:opacity-40 disabled:cursor-not-allowed'
            : 'flex items-center justify-center gap-2 font-semibold py-2 px-4 rounded-md text-button-text text-md bg-accent disabled:opacity-50 disabled:cursor-not-allowed'
        }
        onClick={() => setOpen((value) => !value)}
      >
        {iconOnly ? <FileInput size={18} /> : t('modals.importSettings.title')}
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute right-0 z-50 min-w-52 rounded-md border border-border-color bg-surface p-1 shadow-lg ${iconOnly ? 'bottom-full mb-2' : 'top-full mt-2'}`}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            onClick={() => choose(onFiles)}
          >
            <FileInput size={16} /> {t('uiText.ImportChoiceMenu.import_files')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-secondary"
            onClick={() => choose(onFolder)}
          >
            <FolderPlus size={16} /> {t('uiText.ImportChoiceMenu.add_folder_to_catalog')}
          </button>
        </div>
      )}
    </div>
  );
}
