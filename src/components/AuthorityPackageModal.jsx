import React, { useMemo, useState } from 'react';
import { X, Download, FileText, FileSpreadsheet, Folder, BookOpen, CheckCircle2, AlertTriangle } from './icons';
import { t } from '../i18n';
import { fiscalYearChoices } from '../utils/excelExport';
import { companyFiscalYearSetting, fiscalYearBounds } from '../utils/reportCalculations';
import { collectUnderlag } from '../utils/underlagExport';
import { downloadAuthorityPackage } from '../utils/authorityPackage';

// Underlag till Skatteverket eller revisor (2026-11-23): välj år, ladda ner
// ett paket med allt (utils/authorityPackage.js). Kunden skickar det själv.
export default function AuthorityPackageModal({ company, accounts, verifications, documents, lookups, onClose }) {
  const years = useMemo(() => fiscalYearChoices(verifications, companyFiscalYearSetting(company), fiscalYearBounds), [verifications, company]);
  const [yearFrom, setYearFrom] = useState(years[0]?.from || 'all');
  const choice = yearFrom === 'all' ? null : years.find(y => y.from === yearFrom) || null;
  const range = choice ? { from: choice.from, to: choice.to } : null;
  const missing = useMemo(() => collectUnderlag(verifications, range).index.filter(r => r.status === 'Saknar underlag').length, [verifications, range?.from]); // eslint-disable-line react-hooks/exhaustive-deps
  const [state, setState] = useState(null); // null | { done, total } | { result } | { error }
  const busy = Boolean(state && !state.result && !state.error);

  const download = async () => {
    setState({ done: 0, total: 0 });
    try {
      const result = await downloadAuthorityPackage({
        company, accounts, verifications, documents, lookups, range,
        label: choice ? choice.label.replace('/', '-') : 'alla',
        onProgress: (done, total) => setState({ done, total }),
      });
      setState({ result });
    } catch (e) {
      console.error(e);
      setState({ error: true });
    }
  };

  const contents = [
    { icon: FileText, title: t('authorityPackage.readme'), text: t('authorityPackage.readmeText') },
    { icon: BookOpen, title: t('authorityPackage.sie'), text: t('authorityPackage.sieText') },
    { icon: FileSpreadsheet, title: t('authorityPackage.list'), text: t('authorityPackage.listText') },
    { icon: Folder, title: t('authorityPackage.underlag'), text: t('authorityPackage.underlagText') },
  ];

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal-content ap-modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t('authorityPackage.title')}</span>
          <button type="button" className="modal-close" onClick={onClose} disabled={busy} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <p className="ap-lead">{t('authorityPackage.lead')}</p>

        {years.length === 0 ? (
          <p className="ap-lead">{t('authorityPackage.empty')}</p>
        ) : (
          <>
            <label className="ap-label" htmlFor="ap-year">{t('authorityPackage.year')}</label>
            <select id="ap-year" className="ap-select" value={yearFrom} disabled={busy} onChange={e => { setYearFrom(e.target.value); setState(null); }}>
              {years.map(y => <option key={y.from} value={y.from}>{t('ui.excel_rakenskapsar', { year: y.label })}</option>)}
              <option value="all">{t('ui.excel_hela_bokforingen')}</option>
            </select>

            <ul className="ap-list">
              {contents.map(c => (
                <li key={c.title}>
                  <span className="ap-ic" aria-hidden="true"><c.icon size={17} /></span>
                  <div><strong>{c.title}</strong><small>{c.text}</small></div>
                </li>
              ))}
            </ul>

            {missing > 0 && !state?.result && (
              <div className="ap-note"><AlertTriangle size={15} /> {t('authorityPackage.missing', { count: missing })}</div>
            )}
            {state?.result && (
              <div className="ap-done"><CheckCircle2 size={16} /> {t('authorityPackage.done', { files: state.result.fileCount, vers: state.result.verificationCount })}{state.result.failed ? ` ${t('authorityPackage.failed', { count: state.result.failed })}` : ''}</div>
            )}
            {state?.error && <div className="ap-note">{t('authorityPackage.error')}</div>}

            <div className="ap-foot">
              <button type="button" className="emp-btn" onClick={onClose} disabled={busy}>{state?.result ? t('ui.stang') : t('ui.avbryt')}</button>
              <button type="button" className="emp-btn primary" onClick={download} disabled={busy}>
                <Download size={16} /> {busy ? (state.total ? t('authorityPackage.fetching', { done: state.done, total: state.total }) : t('authorityPackage.building')) : t('authorityPackage.download')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
