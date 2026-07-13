import React from 'react';
import { useProjectFileActions } from '../../hooks/useProjectFileActions';
import { useT } from '../../i18n';

export const Toolbar: React.FC = () => {
  const t = useT();
  const { canSave, handleSave, handleOpenClick, handleOpenFile, openFileRef } =
    useProjectFileActions();

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleSave} disabled={!canSave} className="btn-secondary" title={t('saveTitle')}>
        {t('save')}
      </button>
      <button onClick={handleOpenClick} className="btn-secondary" title={t('openTitle')}>
        {t('open')}
      </button>
      <input
        ref={openFileRef}
        type="file"
        accept=".melody"
        className="hidden"
        onChange={handleOpenFile}
      />
    </div>
  );
};

export default Toolbar;
