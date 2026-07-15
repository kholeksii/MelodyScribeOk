import React, { useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { clearAutosave } from '../services/autosave';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useProjectFileActions } from '../hooks/useProjectFileActions';
import { useExportActions } from '../hooks/useExportActions';
import { Menu, MenuItem } from './ui/Menu';
import { BottomSheet } from './ui/BottomSheet';
import { MeterChip } from './MeterChip';
import { MetadataChip } from './MetadataChip';
import { ThemeSegmented } from './ThemeSegmented';
import { ThemeToggle } from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { VersionBadge } from './VersionBadge';
import { fullVersion } from '../version';
import { useT, instrumentLabel } from '../i18n';

interface EditorHeaderProps {
  onOpenShortcuts: () => void;
}

const rowClass =
  'flex min-h-[48px] w-full items-center gap-3.5 rounded-md px-3 text-left text-sm text-ink transition hover:bg-paper-dark disabled:cursor-not-allowed disabled:opacity-40';

/** Responsive top bar (SPEC.md §4): one row on desktop, a collapsed summary
 * chip + ⋯ menu on tablet, two thin rows + a full ⋯ sheet on phone. */
export const EditorHeader: React.FC<EditorHeaderProps> = ({ onOpenShortcuts }) => {
  const t = useT();
  const isTabletUp = useMediaQuery('(min-width: 640px)');
  const isDesktopUp = useMediaQuery('(min-width: 1024px)');
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const { metadata, undo, redo, canUndo, canRedo, setNotes, setMetadata, setAudioFileId } = useProjectStore();
  const {
    canSave,
    handleSave,
    handleOpenClick,
    handleOpenFile,
    openFileRef,
  } = useProjectFileActions();
  const { canExport, handleExportPDF, handleExportMusicXML, handleImportMusicXML, fileInputRef } =
    useExportActions();

  const handleNewTranscription = () => {
    setNotes([]);
    setMetadata(null);
    setAudioFileId(null);
    clearAutosave();
  };

  const handlePhoneBack = () => {
    if (window.confirm(t('newProjectConfirm'))) handleNewTranscription();
  };

  const fileMenuItems: MenuItem[] = [
    { key: 'open', icon: '📂', label: t('open'), kbd: '⌘O', onSelect: handleOpenClick },
    {
      key: 'importXml',
      icon: '⬇',
      label: t('importMusicXmlLabel'),
      onSelect: () => fileInputRef.current?.click(),
    },
    { key: 'new', icon: '✨', label: t('newProject'), onSelect: handleNewTranscription },
  ];

  const exportMenuItems: MenuItem[] = [
    {
      key: 'pdf',
      icon: '📄',
      label: t('exportPdf'),
      kbd: '⌘E',
      onSelect: handleExportPDF,
      disabled: !canExport,
    },
    {
      key: 'musicxml',
      icon: '🎼',
      label: 'MusicXML',
      onSelect: handleExportMusicXML,
      disabled: !canExport,
    },
  ];

  const hiddenInputs = (
    <>
      <input ref={openFileRef} type="file" accept=".melody" className="hidden" onChange={handleOpenFile} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".musicxml,.xml,.mxl"
        className="hidden"
        onChange={handleImportMusicXML}
      />
    </>
  );

  const undoRedo = (
    <div className="flex items-center gap-1">
      <button onClick={undo} disabled={!canUndo()} title={t('undoTitle')} className="btn-ghost" aria-label={t('undo')}>
        ↩
      </button>
      <button onClick={redo} disabled={!canRedo()} title={t('redoTitle')} className="btn-ghost" aria-label={t('redo')}>
        ↪
      </button>
    </div>
  );

  if (isDesktopUp) {
    const chips = metadata
      ? [instrumentLabel(metadata.instrument, t), `♩ = ${metadata.tempo}`, metadata.key]
      : [];
    return (
      <header className="sticky top-0 z-30 border-b border-ink-soft/15 bg-paper-dark/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 lg:px-8">
          <div className="flex shrink-0 items-baseline gap-2">
            <h1 className="text-xl font-bold text-ink">MelodyScribe</h1>
            <VersionBadge />
          </div>
          <input
            value={metadata?.title ?? ''}
            onChange={(e) => metadata && setMetadata({ ...metadata, title: e.target.value })}
            aria-label={t('projectTitle')}
            placeholder={t('untitled')}
            className="input-field w-44 font-heading"
          />
          <div className="flex items-center gap-1.5">
            {chips.map((chip) => (
              <span
                key={chip}
                className="whitespace-nowrap rounded-full border border-ink-soft/20 bg-surface/60 px-2.5 py-0.5 text-xs text-ink-soft"
              >
                {chip}
              </span>
            ))}
            <MeterChip />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {undoRedo}
            <button onClick={handleSave} disabled={!canSave} title={t('saveTitle')} className="btn-ghost">
              💾 {t('save')}
            </button>
            <div className="relative">
              <button
                onClick={() => setFileMenuOpen((v) => !v)}
                title={t('fileMenuTitle')}
                aria-haspopup="menu"
                aria-expanded={fileMenuOpen}
                className="btn-ghost"
              >
                {t('fileMenu')} ▾
              </button>
              <Menu
                open={fileMenuOpen}
                onClose={() => setFileMenuOpen(false)}
                anchorLabel={t('fileMenuTitle')}
                items={fileMenuItems}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                title={t('exportMenuTitle')}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                className="btn-ghost"
              >
                {t('exportMenu')} ▾
              </button>
              <Menu
                open={exportMenuOpen}
                onClose={() => setExportMenuOpen(false)}
                anchorLabel={t('exportMenuTitle')}
                items={exportMenuItems}
              />
            </div>
            <button
              onClick={onOpenShortcuts}
              title={t('shortcutsHintTitle')}
              aria-label={t('shortcutsTitle')}
              className="btn-ghost"
            >
              ?
            </button>
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
          {hiddenInputs}
        </div>
      </header>
    );
  }

  if (isTabletUp) {
    return (
      <header className="sticky top-0 z-30 border-b border-ink-soft/15 bg-paper-dark/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6">
          <input
            value={metadata?.title ?? ''}
            onChange={(e) => metadata && setMetadata({ ...metadata, title: e.target.value })}
            aria-label={t('projectTitle')}
            placeholder={t('untitled')}
            className="input-field max-w-[200px] font-heading"
          />
          <MetadataChip />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {undoRedo}
            <button
              onClick={handleSave}
              disabled={!canSave}
              title={t('saveTitle')}
              className="btn-ghost"
              aria-label={t('save')}
            >
              💾
            </button>
            <div className="relative">
              <button
                onClick={() => setFileMenuOpen((v) => !v)}
                title={t('fileMenuTitle')}
                aria-haspopup="menu"
                aria-expanded={fileMenuOpen}
                className="btn-ghost"
              >
                {t('fileMenu')} ▾
              </button>
              <Menu
                open={fileMenuOpen}
                onClose={() => setFileMenuOpen(false)}
                anchorLabel={t('fileMenuTitle')}
                items={fileMenuItems}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                title={t('exportMenuTitle')}
                aria-haspopup="menu"
                aria-expanded={exportMenuOpen}
                className="btn-ghost"
              >
                {t('exportMenu')} ▾
              </button>
              <Menu
                open={exportMenuOpen}
                onClose={() => setExportMenuOpen(false)}
                anchorLabel={t('exportMenuTitle')}
                items={exportMenuItems}
              />
            </div>
            <div className="relative">
              <button
                onClick={() => setMoreOpen((v) => !v)}
                title={t('moreMenuTitle')}
                aria-label={t('moreMenuTitle')}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className="btn-ghost"
              >
                ⋯
              </button>
              {moreOpen && (
                <div
                  role="dialog"
                  aria-label={t('moreMenuTitle')}
                  className="absolute right-0 top-full z-40 mt-1 w-56 space-y-3 rounded-lg border border-ink-soft/15 bg-surface p-3 shadow-lg"
                >
                  <button
                    onClick={() => {
                      setMoreOpen(false);
                      onOpenShortcuts();
                    }}
                    className={rowClass}
                  >
                    <span className="w-6 flex-none text-center">⌨️</span>
                    <span className="flex-1">{t('shortcutsTitle')}</span>
                    <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
                      ?
                    </span>
                  </button>
                  <ThemeSegmented />
                  <LanguageSwitcher />
                </div>
              )}
            </div>
          </div>
          {hiddenInputs}
        </div>
      </header>
    );
  }

  // Phone: two thin rows + a full-featured overflow sheet
  return (
    <header className="sticky top-0 z-30 border-b border-ink-soft/15 bg-paper-dark/95 shadow-sm backdrop-blur">
      <div className="flex items-center gap-2 px-3 py-2">
        <button onClick={handlePhoneBack} title={t('newProjectTitle')} className="btn-ghost" aria-label={t('newProject')}>
          ←
        </button>
        <input
          value={metadata?.title ?? ''}
          onChange={(e) => metadata && setMetadata({ ...metadata, title: e.target.value })}
          aria-label={t('projectTitle')}
          placeholder={t('untitled')}
          className="input-field min-w-0 flex-1 font-heading"
        />
        <button
          onClick={() => setMoreOpen(true)}
          title={t('moreMenuTitle')}
          aria-label={t('moreMenuTitle')}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className="btn-ghost"
        >
          ⋯
        </button>
      </div>
      <div className="flex items-center gap-2 px-3 pb-2">
        <MetadataChip />
        <span className="text-xs text-ink-soft/70">· {t('autosaved')}</span>
      </div>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('moreMenuTitle')}>
        <button
          onClick={() => {
            setMoreOpen(false);
            handleSave();
          }}
          disabled={!canSave}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">💾</span>
          <span className="flex-1">{t('save')}</span>
          <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
            ⌘S
          </span>
        </button>
        <button
          onClick={() => {
            setMoreOpen(false);
            handleOpenClick();
          }}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">📂</span>
          <span className="flex-1">{t('open')}</span>
          <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
            ⌘O
          </span>
        </button>
        <button
          onClick={() => {
            setMoreOpen(false);
            fileInputRef.current?.click();
          }}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">⬇</span>
          <span className="flex-1">{t('importMusicXmlLabel')}</span>
        </button>
        <button
          onClick={() => {
            setMoreOpen(false);
            handleExportPDF();
          }}
          disabled={!canExport}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">📄</span>
          <span className="flex-1">{t('exportPdf')}</span>
          <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
            ⌘E
          </span>
        </button>
        <button
          onClick={() => {
            setMoreOpen(false);
            handleExportMusicXML();
          }}
          disabled={!canExport}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">🎼</span>
          <span className="flex-1">MusicXML</span>
        </button>
        <button
          onClick={() => {
            setMoreOpen(false);
            handleNewTranscription();
          }}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">✨</span>
          <span className="flex-1">{t('newProject')}</span>
        </button>
        <button
          onClick={() => {
            setMoreOpen(false);
            onOpenShortcuts();
          }}
          className={rowClass}
        >
          <span className="w-6 flex-none text-center">⌨️</span>
          <span className="flex-1">{t('shortcutsTitle')}</span>
          <span className="rounded border border-ink-soft/30 bg-paper-dark px-1.5 py-0.5 font-mono text-xs text-ink-soft">
            ?
          </span>
        </button>
        <div className="px-3 py-2">
          <ThemeSegmented />
        </div>
        <div className="px-3 pb-2">
          <LanguageSwitcher />
        </div>
        <div className="border-t border-ink-soft/10 px-3 py-2 text-xs text-ink-soft/70">
          {t('version')}: {fullVersion}
        </div>
      </BottomSheet>
      {hiddenInputs}
    </header>
  );
};
