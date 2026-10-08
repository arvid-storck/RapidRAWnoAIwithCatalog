import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import Switch from '../ui/Switch';
import { FILENAME_VARIABLES } from '../ui/ExportImportProperties';
import Text from '../ui/Text';
import { TextVariants } from '../../types/typography';

interface ImportSettingsModalProps {
  fileCount: number;
  isOpen: boolean;
  onClose(): void;
  onSave(settings: any): void;
}

export default function ImportSettingsModal({ fileCount, isOpen, onClose, onSave }: ImportSettingsModalProps) {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [show, setShow] = useState(false);

  const [filenameTemplate, setFilenameTemplate] = useState('{original_filename}');
  const [organizeByDate, setOrganizeByDate] = useState(false);
  const [dateFolderFormat, setDateFolderFormat] = useState('YYYY/MM-DD');
  const [importMode, setImportMode] = useState<'copy' | 'move' | 'inPlace'>('copy');
  const filenameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setImportMode('copy');
      setIsMounted(true);
      const timer = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
      const timer = setTimeout(() => {
        setIsMounted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSave = useCallback(() => {
    let finalFilenameTemplate = filenameTemplate;
    if (
      fileCount > 1 &&
      !filenameTemplate.includes('{sequence}') &&
      !filenameTemplate.includes('{original_filename}')
    ) {
      finalFilenameTemplate = `${filenameTemplate}_{sequence}`;
    }

    onSave({
      filenameTemplate: finalFilenameTemplate,
      organizeByDate,
      dateFolderFormat,
      importMode,
      deleteAfterImport: importMode === 'move',
    });
    onClose();
  }, [onSave, onClose, filenameTemplate, organizeByDate, dateFolderFormat, importMode, fileCount]);

  const handleKeyDown = useCallback(
    (e: any) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleSave, onClose],
  );

  const handleVariableClick = (variable: string) => {
    if (!filenameInputRef.current) {
      return;
    }
    const input = filenameInputRef.current;
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = input.value;
    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
    setFilenameTemplate(newValue);
    setTimeout(() => {
      input.focus();
      const newCursorPos = start + variable.length;
      input.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  if (!isMounted) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className={`fixed inset-0 flex items-center justify-center z-50 bg-black/30 backdrop-blur-xs transition-opacity duration-300 ease-in-out ${
        show ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={onClose}
      role="dialog"
    >
      <div
        className={`bg-surface rounded-lg shadow-xl p-6 w-full max-w-lg transform transition-all duration-300 ease-out ${
          show ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 -translate-y-4'
        }`}
        onClick={(e: any) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <Text variant={TextVariants.title} className="mb-4">
          {t('modals.importSettings.title')}
        </Text>

        <div className="space-y-8 text-sm">
          <div>
            <Text variant={TextVariants.heading} className="block mb-2">
              {t('uiText.ImportSettingsModal.import_method')}
            </Text>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                className={`rounded-md border p-3 text-left transition-colors ${
                  importMode === 'copy'
                    ? 'border-accent bg-accent/10 text-text-primary'
                    : 'border-border-color bg-bg-primary text-text-secondary hover:bg-card-active'
                }`}
                onClick={() => setImportMode('copy')}
              >
                <span className="block font-semibold">{t('uiText.ImportSettingsModal.copy_files')}</span>
                <span className="mt-1 block text-xs opacity-75">
                  {t('uiText.ImportSettingsModal.copy_to_the_pc_and_keep_the_originals')}
                </span>
              </button>
              <button
                className={`rounded-md border p-3 text-left transition-colors ${
                  importMode === 'inPlace'
                    ? 'border-accent bg-accent/10 text-text-primary'
                    : 'border-border-color bg-bg-primary text-text-secondary hover:bg-card-active'
                }`}
                onClick={() => setImportMode('inPlace')}
              >
                <span className="block font-semibold">
                  {t('uiText.ImportSettingsModal.import_at_existing_location')}
                </span>
                <span className="mt-1 block text-xs opacity-75">
                  {t('uiText.ImportSettingsModal.index_the_files_without_copying_or_moving_them')}
                </span>
              </button>
              <button
                className={`rounded-md border p-3 text-left transition-colors ${
                  importMode === 'move'
                    ? 'border-accent bg-accent/10 text-text-primary'
                    : 'border-border-color bg-bg-primary text-text-secondary hover:bg-card-active'
                }`}
                onClick={() => setImportMode('move')}
              >
                <span className="block font-semibold">{t('uiText.ImportSettingsModal.move_files')}</span>
                <span className="mt-1 block text-xs opacity-75">
                  {t('uiText.ImportSettingsModal.copy_to_this_folder_then_remove_the_originals')}
                </span>
              </button>
            </div>
          </div>

          {importMode !== 'inPlace' && (
            <div>
              <Text variant={TextVariants.heading} className="block mb-2">
                {t('modals.importSettings.fileNaming')}
              </Text>
              <input
                autoFocus
                className="w-full bg-bg-primary border border-surface rounded-md p-2 text-sm text-text-primary focus:ring-accent focus:border-accent"
                onChange={(e: any) => setFilenameTemplate(e.target.value)}
                ref={filenameInputRef}
                type="text"
                value={filenameTemplate}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {FILENAME_VARIABLES.map((variable: string) => (
                  <button
                    className="px-2 py-1 bg-surface text-text-secondary text-xs rounded-md hover:bg-card-active transition-colors"
                    key={variable}
                    onClick={() => handleVariableClick(variable)}
                  >
                    {variable}
                  </button>
                ))}
              </div>
            </div>
          )}

          {importMode !== 'inPlace' && (
            <div>
              <Text variant={TextVariants.heading} className="block mb-2">
                {t('modals.importSettings.folderOrganization')}
              </Text>
              <Switch
                label={t('uiText.ImportSettingsModal.use_custom_folder_structure')}
                checked={organizeByDate}
                onChange={setOrganizeByDate}
              />
              {organizeByDate && (
                <div className="mt-2">
                  <Text variant={TextVariants.label} className="block mb-1">
                    {t('uiText.ImportSettingsModal.folder_structure')}
                  </Text>
                  <input
                    className="w-full bg-bg-primary border border-surface rounded-md p-2 text-sm text-text-primary focus:ring-accent focus:border-accent"
                    onChange={(e: any) => setDateFolderFormat(e.target.value)}
                    placeholder={t('modals.importSettings.dateFormatPlaceholder')}
                    type="text"
                    value={dateFolderFormat}
                  />
                  <Text variant={TextVariants.small} className="mt-1">
                    {t('uiText.ImportSettingsModal.available_date_variables_yyyy_mm_and_dd_example_yyyy_mm_dd')}
                  </Text>
                </div>
              )}
            </div>
          )}

          <div>
            <Text variant={TextVariants.heading} className="block mb-2">
              {t('modals.importSettings.sourceFiles')}
            </Text>
            {importMode === 'move' ? (
              <Text variant={TextVariants.small} className="mt-1">
                {t('modals.importSettings.deleteWarning')}
              </Text>
            ) : importMode === 'copy' ? (
              <Text variant={TextVariants.small} className="mt-1">
                {t(
                  'uiText.ImportSettingsModal.original_files_remain_on_the_source_device_copies_are_added_to_the_catalog',
                )}
              </Text>
            ) : (
              <Text variant={TextVariants.small} className="mt-1">
                {t(
                  'uiText.ImportSettingsModal.files_remain_in_their_current_folders_their_parent_folders_are_added_to_the_catalog_index',
                )}
              </Text>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8">
          <button
            className="px-4 py-2 rounded-md text-text-secondary hover:bg-surface transition-colors"
            onClick={onClose}
          >
            {t('modals.importSettings.cancel')}
          </button>
          <button
            className="px-4 py-2 rounded-md bg-accent shadow-shiny text-button-text font-semibold hover:bg-accent-hover transition-colors"
            onClick={handleSave}
          >
            {t('modals.importSettings.startImport')}
          </button>
        </div>
      </div>
    </div>
  );
}
