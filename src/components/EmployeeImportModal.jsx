import React, { useRef, useState } from 'react';
import { X, Download, Upload, Check } from './icons';
import { Notice } from './SkattekontoImportModal';
import { downloadCsv } from '../utils/csvRegister';
import { csvToEmployees, employeeTemplateCsv } from '../utils/employeeCsv';
import { BRAND } from '../utils/brandColors';
import { t } from '../i18n';

// Importera anställda från en CSV-fil (utils/employeeCsv.js). Två steg:
// välj fil (med mall att ladda ner), sedan förhandsvisning där rader med
// fel visas med radnummer och inte följer med. Finns personnumret redan
// uppdateras den anställda i stället för att läggas till igen.

const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' };
const primaryBtn = (enabled) => ({ padding: '9px 18px', background: enabled ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' });

export default function EmployeeImportModal({ employees = [], onImport, onClose }) {
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');

  const existing = new Set(employees.map(e => String(e.ssn || '').replace(/\D/g, '')).filter(Boolean));
  const ok = (rows || []).filter(r => r.errors.length === 0);
  const bad = (rows || []).filter(r => r.errors.length > 0);
  const updates = ok.filter(r => existing.has(r.employee.ssn.replace(/\D/g, ''))).length;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = csvToEmployees(String(ev.target.result || ''));
        if (parsed.length === 0) throw new Error(t('employeeImport.noRows'));
        setRows(parsed);
        setFileName(file.name);
      } catch (err) {
        setRows(null);
        setError(err.message);
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '680px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t('employeeImport.title')}</span>
          <button className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>

        <input type="file" ref={fileRef} accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />
        {error && <Notice tone="red">{error}</Notice>}

        {!rows ? (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('employeeImport.intro')}</p>
            <ul style={{ margin: '0 0 16px', paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              <li>{t('employeeImport.ruleRequired')}</li>
              <li>{t('employeeImport.ruleTaxTable')}</li>
              <li>{t('employeeImport.ruleUpdate')}</li>
            </ul>
            <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={() => downloadCsv('anstallda-mall.csv', employeeTemplateCsv())}>
                <Download size={14} /> {t('employeeImport.template')}
              </button>
              <button type="button" style={primaryBtn(true)} onClick={() => fileRef.current?.click()}>
                <Upload size={14} /> {t('employeeImport.chooseFile')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {t('employeeImport.summary', { file: fileName, ok: ok.length, bad: bad.length, updates })}
            </p>
            {bad.length > 0 && (
              <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '12px', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                {bad.map(r => (
                  <div key={r.line} style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)', fontSize: '12.5px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t('employeeImport.rowLabel', { line: r.line, name: r.name })}</div>
                    {r.errors.map((e, i) => <div key={i} style={{ color: 'var(--status-red-text)' }}>{e}</div>)}
                  </div>
                ))}
              </div>
            )}
            {bad.length > 0 && ok.length > 0 && <Notice tone="amber">{t('employeeImport.partial')}</Notice>}
            {ok.some(r => r.needsTaxTable) && <Notice tone="amber">{t('employeeImport.needsTaxTable', { n: ok.filter(r => r.needsTaxTable).length })}</Notice>}
            <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" style={btn} onClick={() => fileRef.current?.click()}>{t('employeeImport.otherFile')}</button>
              <button type="button" disabled={ok.length === 0} style={primaryBtn(ok.length > 0)} onClick={() => onImport(ok)}>
                <Check size={14} /> {t('employeeImport.import', { n: ok.length })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
