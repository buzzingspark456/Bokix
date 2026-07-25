import React, { useRef, useState } from 'react';
import { Download, Upload, RotateCcw, AlertTriangle, Check } from 'lucide-react';

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
          throw new Error('Filen saknar kontoplan eller verifikationer.');
        }

        onImport(data.accounts, data.verifications);
        setImportSuccess(true);
        setImportError('');
        setTimeout(() => setImportSuccess(false), 3000);
      } catch (err) {
        setImportError(`Kunde inte läsa in filen: ${err.message}`);
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
          <h1 className="page-title">Säkerhetskopia & Import</h1>
          <p className="page-subtitle">Hantera och skydda din bokföringsdata</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Export / Import Box */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>Exportera & Importera data</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            All din data sparas automatiskt i din webbläsares lokala minne (localStorage). För säkerhets skull rekommenderas att regelbundet ladda ner en säkerhetskopia.
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-primary" onClick={handleExport}>
              <Download size={16} /> Exportera till fil (.json)
            </button>
            
            <button className="btn btn-secondary" onClick={handleImportClick}>
              <Upload size={16} /> Importera från fil (.json)
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
              <span>Datan har importerats framgångsrikt!</span>
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
          <h3 style={{ marginBottom: '0.5rem', fontWeight: 700, color: 'var(--danger)' }}>Fara</h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
            Detta kommer att radera alla ändringar du gjort och återställa systemet med demonstrationsdatan.
          </p>

          <button className="btn btn-danger" onClick={onReset}>
            <RotateCcw size={16} /> Återställ systemet
          </button>
        </div>

      </div>
    </div>
  );
}

export default Backup;
