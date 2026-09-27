import React, { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, AlertTriangle, Check } from './icons';
import { t } from '../i18n';

function Backup({ accounts, verifications, onImport, onReset }) {
  const fileInputRef = useRef(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importError, setImportError] = useState('');

  const handleExport = () => {
    const dataStr = JSON.stringify({
      version: 1,
      exportDate: new Date().toISOString(),
      accounts,
      verifications
    }, null, 2);

    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bokforing_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        
        // Simple validation
        if (!data.accounts || !data.verifications) {
          throw new Error(t('ui.filen_saknar_kontoplan_eller_verifikationer'));
        }

        onImport(data.accounts, data.verifications);
        setImportSuccess(true);
        setImportError('');
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setImportError(t('ui.kunde_inte_lasa_in_filen', { message: err.message }));
        setImportSuccess(false);
      }
    };
    reader.readAsText(file);
    // Clear value to allow re-uploading same file
    e.target.value = '';
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <div className="header-container">
        <div>
          <h1 className="page-title">{t('ui.sakerhetskopia_import')}</h1>
          <p className="page-subtitle">{t('ui.hantera_och_skydda_din_bokforingsdata')}</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Export / Import Box */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>{t('ui.exportera_importera_data')}</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {t('ui.all_din_data_sparas_automatiskt_i_din_webblasare')}
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={handleExport}>
              <Download size={16} /> {t('ui.exportera_till_fil_json')}
            </button>
            
            <button className="btn btn-secondary" onClick={handleImportClick}>
              <Upload size={16} /> {t('ui.importera_fran_fil_json')}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".json"
              onChange={handleFileChange}
            />
          </div>

          {importSuccess && (
            <div className="success-box" style={{ marginTop: '1.25rem' }}>
              <Check size={16} />
              <span>{t('ui.datan_har_importerats_framgangsrikt')}</span>
            </div>
          )}

          {importError && (
            <div className="alert-box" style={{ marginTop: '1.25rem' }}>
              <AlertTriangle size={16} />
              <span>{importError}</span>
            </div>
          )}
        </div>

        {/* Danger zone / reset */}
        <div className="card" style={{ borderColor: 'rgba(244, 63, 94, 0.2)' }}>
          <h3 style={{ marginBottom: '0.5rem', fontWeight: 700, color: 'var(--danger)' }}>{t('ui.fara')}</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            {t('ui.detta_kommer_att_radera_alla_andringar_du_gjort')}
          </p>

          <button className="btn btn-danger" onClick={onReset}>
            <RotateCcw size={16} /> {t('ui.aterstall_systemet')}
          </button>
        </div>

      </div>
    </div>
  );
}

export default Backup;
