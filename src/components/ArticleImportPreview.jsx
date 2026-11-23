import React, { useMemo, useState } from 'react';
import { X, Search } from './icons';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

// Förhandsvisning av en artikelimport (2026-11-23): visar varje rad, om den
// blir ny eller uppdaterar en befintlig artikel (samma artikelnummer), och
// låter en bocka ur rader innan något sparas. Inget ändras förrän Importera.
const fmtKr = (v) => `${numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)} kr`;
const key = (a) => (a.articleNumber || '').trim().toLowerCase();

export default function ArticleImportPreview({ fileName, imported, skippedInactive = 0, existing = [], onConfirm, onCancel }) {
  const rows = useMemo(() => {
    const byNumber = new Map(existing.filter(a => key(a)).map(a => [key(a), a]));
    return imported.map((a, i) => ({ i, a, update: Boolean(key(a) && byNumber.has(key(a))) }));
  }, [imported, existing]);
  const [picked, setPicked] = useState(() => new Set(rows.map(r => r.i)));
  const [updateExisting, setUpdateExisting] = useState(true);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => `${r.a.articleNumber || ''} ${r.a.description}`.toLowerCase().includes(s)) : rows;
  }, [rows, q]);

  const active = rows.filter(r => picked.has(r.i) && (updateExisting || !r.update));
  const newCount = active.filter(r => !r.update).length;
  const updCount = active.filter(r => r.update).length;
  const allShownPicked = shown.length > 0 && shown.every(r => picked.has(r.i));
  const toggle = (i) => setPicked(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const toggleShown = () => setPicked(prev => {
    const n = new Set(prev);
    shown.forEach(r => (allShownPicked ? n.delete(r.i) : n.add(r.i)));
    return n;
  });
  const vatCounts = active.reduce((m, r) => { m[r.a.vatRate] = (m[r.a.vatRate] || 0) + 1; return m; }, {});

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content aip" style={{ maxWidth: '860px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t('articleImport.title')}</span>
          <button type="button" className="modal-close" onClick={onCancel} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <p className="aip-lead">
          {t('articleImport.lead', { file: fileName, count: rows.length })}
          {skippedInactive > 0 && ` ${t('articleImport.skipped', { count: skippedInactive })}`}
        </p>

        <div className="aip-stats">
          <div><strong>{newCount}</strong><span>{t('articleImport.new')}</span></div>
          <div><strong>{updCount}</strong><span>{t('articleImport.updated')}</span></div>
          <div className="aip-vat">
            {Object.entries(vatCounts).sort((a, b) => b[0] - a[0]).map(([rate, n]) => <span key={rate}>{rate} %: {n}</span>)}
            <small>{t('articleImport.vatHint')}</small>
          </div>
        </div>

        <div className="aip-tools">
          <span className="aip-search"><Search size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t('articleImport.search')} /></span>
          {rows.some(r => r.update) && (
            <label className="aip-check"><input type="checkbox" checked={updateExisting} onChange={e => setUpdateExisting(e.target.checked)} /> {t('articleImport.updateExisting')}</label>
          )}
        </div>

        <div className="aip-table-wrap">
          <table className="aip-table">
            <thead>
              <tr>
                <th className="aip-cb"><input type="checkbox" checked={allShownPicked} onChange={toggleShown} aria-label={t('articleImport.all')} /></th>
                <th>{t('articleImport.number')}</th>
                <th>{t('articleImport.name')}</th>
                <th className="num">{t('articleImport.price')}</th>
                <th className="num">{t('articleImport.vat')}</th>
                <th>{t('articleImport.status')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ i, a, update }) => {
                const off = !picked.has(i) || (update && !updateExisting);
                return (
                  <tr key={i} className={off ? 'off' : ''} onClick={() => toggle(i)}>
                    <td className="aip-cb"><input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} onClick={e => e.stopPropagation()} aria-label={a.description} /></td>
                    <td className="aip-num">{a.articleNumber}</td>
                    <td>{a.description}<small>{a.type === 'vara' ? t('articleImport.goods') : t('articleImport.service')}{a.unit ? ` · ${a.unit}` : ''}</small></td>
                    <td className="num">{fmtKr(a.unitPrice)}</td>
                    <td className="num">{a.vatRate} %</td>
                    <td><span className={`aip-pill ${update ? 'upd' : 'new'}`}>{update ? t('articleImport.pillUpdate') : t('articleImport.pillNew')}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="aip-foot">
          <button type="button" className="emp-btn" onClick={onCancel}>{t('ui.avbryt')}</button>
          <button type="button" className="emp-btn primary" disabled={active.length === 0} onClick={() => onConfirm(active.map(r => r.a))}>
            {t('articleImport.confirm', { count: active.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
