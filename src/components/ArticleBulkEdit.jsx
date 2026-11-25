import React, { useMemo, useState } from 'react';
import { X } from './icons';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

// Massredigering av markerade artiklar (2026-11-24): ett rutnät där varje
// artikel går att ändra för sig, prisverktyg som fyller i utpriset (procent
// eller påslag på inköpspriset) och fält som sätter samma värde för alla.
// Inget sparas förrän Spara; ändrade fält markeras.
const UNITS = ['st', 'tim', 'h', 'm', 'm²', 'km', 'kg', 'l', 'dag', 'mån', 'utl'];
const num = (v) => {
  const s = String(v ?? '').replace(/\s/g, '').replace(',', '.');
  return s === '' ? '' : Number(s);
};
const fmtIn = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? '' : String(Math.round(Number(v) * 100) / 100).replace('.', ','));
const roundPrice = (v, mode) => (mode === 'krona' ? Math.round(v) : mode === 'nine' ? Math.max(0, Math.ceil(v / 10) * 10 - 1) : Math.round(v * 100) / 100);

// stockOf(a): nuvarande saldo för en vara, eller null (tjänst). Ändrat saldo
// sparas som en inventering med dagens datum (onSave får counts).
export default function ArticleBulkEdit({ items, keyOf, onSave, onClose, focusPrices = false, stockOf = () => null }) {
  const [rows, setRows] = useState(() => items.map(a => ({
    key: keyOf(a), orig: a,
    description: a.description || '', unitPrice: fmtIn(a.unitPrice), purchasePrice: fmtIn(a.purchasePrice),
    vatRate: String(a.vatRate ?? 25), unit: a.unit || 'st',
    qtyOrig: stockOf(a), qty: stockOf(a) == null ? '' : fmtIn(stockOf(a)),
  })));
  const hasStock = rows.some(r => r.qtyOrig != null);
  const [tool, setTool] = useState({ mode: 'percent', value: '', round: 'krona' });
  const [all, setAll] = useState({ vatRate: '', unit: '', supplier: '', location: '' });
  const units = useMemo(() => [...new Set([...UNITS, ...items.map(a => a.unit).filter(Boolean)])], [items]);

  const setRow = (key, patch) => setRows(rs => rs.map(r => (r.key === key ? { ...r, ...patch } : r)));
  const applyTool = () => {
    const v = num(tool.value);
    if (v === '' || !Number.isFinite(v)) return;
    setRows(rs => rs.map(r => {
      if (tool.mode === 'markup') {
        const c = num(r.purchasePrice);
        return c > 0 ? { ...r, unitPrice: fmtIn(roundPrice(c * (1 + v / 100), tool.round)) } : r;
      }
      if (tool.mode === 'set') return { ...r, unitPrice: fmtIn(roundPrice(v, tool.round)) };
      const p = num(r.unitPrice);
      return p > 0 ? { ...r, unitPrice: fmtIn(roundPrice(p * (1 + v / 100), tool.round)) } : r;
    }));
  };
  const applyAll = (field, value) => {
    setAll(a => ({ ...a, [field]: value }));
    if (value !== '' && (field === 'vatRate' || field === 'unit')) setRows(rs => rs.map(r => ({ ...r, [field]: value })));
  };

  const changed = (r, f) => {
    if (f === 'unitPrice' || f === 'purchasePrice') return num(r[f]) !== (r.orig[f] === '' || r.orig[f] == null ? '' : Number(r.orig[f]));
    if (f === 'vatRate') return Number(r.vatRate) !== Number(r.orig.vatRate ?? 25);
    if (f === 'qty') return r.qtyOrig != null && r.qty !== '' && num(r.qty) !== r.qtyOrig;
    if (f === 'unit') return r.unit !== (r.orig.unit || 'st');
    return r[f] !== (r.orig[f] || '');
  };
  const dirtyRows = rows.filter(r => ['description', 'unitPrice', 'purchasePrice', 'vatRate', 'unit', 'qty'].some(f => changed(r, f)));
  const dirtyCount = dirtyRows.length + (all.supplier !== '' || all.location !== '' ? rows.length - dirtyRows.length : 0);
  const invalid = rows.some(r => !r.description.trim() || (r.unitPrice !== '' && !Number.isFinite(num(r.unitPrice))) || (r.purchasePrice !== '' && !Number.isFinite(num(r.purchasePrice))) || (r.qty !== '' && !(num(r.qty) >= 0)));

  const save = () => {
    if (invalid) return;
    const patches = new Map(rows.map(r => [r.key, {
      description: r.description.trim(),
      unitPrice: num(r.unitPrice) === '' ? 0 : num(r.unitPrice),
      purchasePrice: num(r.purchasePrice),
      vatRate: Number(r.vatRate),
      unit: r.unit,
      ...(all.supplier !== '' ? { supplier: all.supplier.trim() } : {}),
      ...(all.location !== '' ? { location: all.location.trim() } : {}),
    }]));
    const counts = new Map(rows.filter(r => changed(r, 'qty')).map(r => [r.key, num(r.qty)]));
    onSave(patches, counts);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content abe" style={{ maxWidth: '980px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{t('artEdit.title', { n: rows.length })}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>

        <div className={`abe-tools${focusPrices ? ' focus' : ''}`}>
          <div className="abe-tool">
            <span className="abe-label">{t('artEdit.priceTool')}</span>
            <div className="abe-row">
              <select className="ws-input" value={tool.mode} onChange={e => setTool(x => ({ ...x, mode: e.target.value }))} aria-label={t('artEdit.priceTool')}>
                <option value="percent">{t('artEdit.modePercent')}</option>
                <option value="markup">{t('artEdit.modeMarkup')}</option>
                <option value="set">{t('artEdit.modeSet')}</option>
              </select>
              <div className="ws-input-suffix abe-val"><input className="ws-input" inputMode="decimal" autoFocus={focusPrices} value={tool.value} placeholder={tool.mode === 'set' ? '199' : tool.mode === 'markup' ? '60' : '5'} onChange={e => setTool(x => ({ ...x, value: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') applyTool(); }} /><span>{tool.mode === 'set' ? 'kr' : '%'}</span></div>
              <select className="ws-input" value={tool.round} onChange={e => setTool(x => ({ ...x, round: e.target.value }))} aria-label={t('artReg.rounding')}>
                <option value="krona">{t('artReg.roundKrona')}</option>
                <option value="nine">{t('pris.roundNine')}</option>
                <option value="ore">{t('artReg.roundOre')}</option>
              </select>
              <button type="button" className="agi-btn" onClick={applyTool} disabled={tool.value === ''}>{t('artEdit.fillPrices')}</button>
            </div>
          </div>
          <div className="abe-tool">
            <span className="abe-label">{t('artEdit.setAll')}</span>
            <div className="abe-row">
              <select className="ws-input" value={all.vatRate} onChange={e => applyAll('vatRate', e.target.value)} aria-label={t('ui.moms')}>
                <option value="">{t('ui.moms')}…</option>
                {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v} %</option>)}
              </select>
              <select className="ws-input" value={all.unit} onChange={e => applyAll('unit', e.target.value)} aria-label={t('ui.enhet')}>
                <option value="">{t('ui.enhet')}…</option>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
              <input className="ws-input" value={all.supplier} placeholder={t('artReg.supplier')} onChange={e => setAll(a => ({ ...a, supplier: e.target.value }))} />
              <input className="ws-input abe-loc" value={all.location} placeholder={t('lager.location')} onChange={e => setAll(a => ({ ...a, location: e.target.value }))} />
            </div>
          </div>
        </div>

        <div className="abe-grid-wrap">
          <table className="abe-grid">
            <thead>
              <tr>
                <th className="abe-c-num">{t('ui.artikelnr')}</th>
                <th>{t('ui.benamning')}</th>
                <th className="abe-c-money">{t('artReg.cost')}</th>
                <th className="abe-c-money">{t('artReg.price')}</th>
                <th className="abe-c-tg">{t('artReg.margin')}</th>
                <th className="abe-c-small">{t('ui.moms')}</th>
                <th className="abe-c-small">{t('ui.enhet')}</th>
                {hasStock && <th className="abe-c-money">{t('artReg.stock')}</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const p = num(r.unitPrice); const c = num(r.purchasePrice);
                const m = p > 0 && c > 0 ? ((p - c) / p) * 100 : null;
                return (
                  <tr key={r.key}>
                    <td className="abe-c-num">{r.orig.articleNumber || '–'}</td>
                    <td><input className={`ws-input${changed(r, 'description') ? ' abe-dirty' : ''}${!r.description.trim() ? ' abe-bad' : ''}`} value={r.description} onChange={e => setRow(r.key, { description: e.target.value })} aria-label={t('ui.benamning')} /></td>
                    <td><input className={`ws-input r${changed(r, 'purchasePrice') ? ' abe-dirty' : ''}`} inputMode="decimal" value={r.purchasePrice} onChange={e => setRow(r.key, { purchasePrice: e.target.value })} aria-label={t('artReg.cost')} /></td>
                    <td><input className={`ws-input r${changed(r, 'unitPrice') ? ' abe-dirty' : ''}`} inputMode="decimal" value={r.unitPrice} onChange={e => setRow(r.key, { unitPrice: e.target.value })} aria-label={t('artReg.price')} /></td>
                    <td className="abe-c-tg">{m == null ? '–' : <span className={`ar-tg${m < 20 ? ' low' : m >= 50 ? ' high' : ''}`}>{numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(m)} %</span>}</td>
                    <td>
                      <select className={`ws-input${changed(r, 'vatRate') ? ' abe-dirty' : ''}`} value={r.vatRate} onChange={e => setRow(r.key, { vatRate: e.target.value })} aria-label={t('ui.moms')}>
                        {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v} %</option>)}
                      </select>
                    </td>
                    <td>
                      <select className={`ws-input${changed(r, 'unit') ? ' abe-dirty' : ''}`} value={r.unit} onChange={e => setRow(r.key, { unit: e.target.value })} aria-label={t('ui.enhet')}>
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </td>
                    {hasStock && (
                      <td>{r.qtyOrig == null ? <span className="ar-muted">–</span> : <input className={`ws-input r${changed(r, 'qty') ? ' abe-dirty' : ''}`} inputMode="decimal" value={r.qty} onChange={e => setRow(r.key, { qty: e.target.value })} aria-label={t('artReg.stock')} />}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="modal-footer abe-foot">
          <span className="abe-count">{dirtyCount > 0 ? t('artEdit.changed', { n: dirtyCount }) : t('artEdit.noChanges')}</span>
          <button type="button" className="agi-btn" onClick={onClose}>{t('ui.avbryt')}</button>
          <button type="button" className="agi-btn primary" disabled={invalid || dirtyCount === 0} onClick={save}>{t('artEdit.save', { n: dirtyCount })}</button>
        </div>
      </div>
    </div>
  );
}
