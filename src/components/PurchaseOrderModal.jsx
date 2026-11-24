import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, Download, Send, Truck, Check } from './icons';
import { t as tr } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import { poStatus, poTotal, rowRemaining } from '../utils/purchaseOrders';
import { downloadPurchaseOrderPdf } from '../utils/purchaseOrderPdf';
import { confirmDialog } from './shared/ConfirmDialog';

// En inköpsorder (2026-11-23): utkast som går att ändra, sedan skickad till
// leverantören (PDF + mejl), och mottagen helt eller delvis. Mottaget blir
// inleveranser i lagret (Inventory.jsx gör själva sparandet).
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0))} kr`;
const fmtQty = (v) => numberFormat('sv-SE', { maximumFractionDigits: 2 }).format(Number(v) || 0);
const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;
const todayIso = () => new Date().toISOString().slice(0, 10);
const rowKey = () => `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export const PO_STATUS_PILL = { draft: 'neutral', ordered: 'info', partial: 'warn', received: 'ok', cancelled: 'late' };

export default function PurchaseOrderModal({ initial, goods, company, suppliers = [], onSave, onReceive, onDelete, onClose }) {
  const [po, setPo] = useState(initial);
  const status = poStatus(po);
  const editable = status === 'draft';
  const [recvDate, setRecvDate] = useState(todayIso());
  const [recv, setRecv] = useState(() => Object.fromEntries((initial.rows || []).map(r => [r.key, String(rowRemaining(r) || '')])));
  const [error, setError] = useState('');
  const byId = useMemo(() => new Map(goods.map(g => [g.id, g])), [goods]);
  const unitOf = (id) => byId.get(id)?.unit || tr('ui.st');

  const setRow = (key, patch) => setPo(p => ({ ...p, rows: p.rows.map(r => {
    if (r.key !== key) return r;
    const next = { ...r, ...patch };
    if (patch.articleId !== undefined && patch.articleId !== r.articleId) {
      const g = byId.get(patch.articleId);
      next.unitCost = g?.purchasePrice ?? '';
      next.unit = g?.unit || 'st';
      next.description = g?.description || '';
    }
    return next;
  }) }));
  const lines = (po.rows || []).filter(r => r.articleId || r.qty !== '');
  const validate = () => {
    if (!String(po.supplier || '').trim()) return tr('po.errSupplier');
    if (lines.length === 0) return tr('po.errRows');
    if (lines.some(r => !r.articleId || !(num(r.qty) > 0))) return tr('po.errRow');
    return '';
  };
  const clean = (p) => ({ ...p, supplier: String(p.supplier || '').trim(), rows: lines.map(r => ({ ...r, qty: num(r.qty), unitCost: num(r.unitCost), received: num(r.received) })) });

  const saveDraft = () => { const e = validate(); if (e) return setError(e); onSave(clean(po)); onClose(); };
  const markOrdered = (alsoMail) => {
    const e = validate(); if (e) return setError(e);
    const next = clean({ ...po, ordered: true, sentAt: new Date().toISOString() });
    onSave(next);
    if (alsoMail) {
      downloadPurchaseOrderPdf({ company, po: next, articles: goods });
      const body = [
        tr('po.mailHello'), '',
        tr('po.mailIntro', { number: next.number }), '',
        ...next.rows.map(r => `${byId.get(r.articleId)?.articleNumber ? `${byId.get(r.articleId).articleNumber} ` : ''}${byId.get(r.articleId)?.description || r.description}: ${fmtQty(r.qty)} ${unitOf(r.articleId)}`),
        '', next.expectedDate ? tr('po.mailWhen', { date: next.expectedDate }) : '', tr('po.mailThanks'), company?.name || '',
      ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
      window.location.href = `mailto:${encodeURIComponent(po.supplierEmail || '')}?subject=${encodeURIComponent(`${tr('po.title')} ${next.number}${company?.name ? ` · ${company.name}` : ''}`)}&body=${encodeURIComponent(body)}`;
    }
    onClose();
  };
  const receive = () => {
    const amounts = Object.fromEntries(Object.entries(recv).map(([k, v]) => [k, num(v)]));
    if (!Object.values(amounts).some(v => v > 0)) return setError(tr('po.errReceive'));
    onReceive(po, { date: recvDate, amounts });
    onClose();
  };

  const total = poTotal({ rows: lines.map(r => ({ qty: num(r.qty), unitCost: num(r.unitCost) })) });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content po-modal" style={{ maxWidth: '780px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{tr('po.title')} {po.number}</h2>
            <p className="wsp-sub"><span className={`agi-pill ${PO_STATUS_PILL[status]}`}>{tr(`po.status_${status}`)}</span>{po.sentAt ? ` ${tr('po.sentOn', { date: po.sentAt.slice(0, 10) })}` : ''}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={tr('ui.stang')}><X size={18} /></button>
        </div>

        <div className="po-meta">
          <div className="po-field po-supplier">
            <label className="ws-label" htmlFor="po-sup">{tr('po.supplier')}</label>
            {editable ? (
              <>
                <input id="po-sup" className="ws-input" list="po-suppliers" value={po.supplier || ''} onChange={e => setPo(p => ({ ...p, supplier: e.target.value }))} placeholder={tr('po.supplierPlaceholder')} />
                <datalist id="po-suppliers">{suppliers.map(s => <option key={s} value={s} />)}</datalist>
              </>
            ) : <div className="po-static">{po.supplier}</div>}
          </div>
          <div className="po-field">
            <label className="ws-label" htmlFor="po-date">{tr('po.date')}</label>
            {editable ? <input id="po-date" type="date" className="ws-input" value={po.date} onChange={e => setPo(p => ({ ...p, date: e.target.value }))} /> : <div className="po-static">{po.date}</div>}
          </div>
          <div className="po-field">
            <label className="ws-label" htmlFor="po-exp">{tr('po.expected')}</label>
            {editable || status === 'ordered' || status === 'partial'
              ? <input id="po-exp" type="date" className="ws-input" value={po.expectedDate || ''} onChange={e => { const v = e.target.value; setPo(p => ({ ...p, expectedDate: v })); if (!editable) onSave({ ...po, expectedDate: v }); }} />
              : <div className="po-static">{po.expectedDate || '–'}</div>}
          </div>
          {editable && (
            <div className="po-field">
              <label className="ws-label" htmlFor="po-mail">{tr('po.supplierEmail')}</label>
              <input id="po-mail" type="email" className="ws-input" value={po.supplierEmail || ''} onChange={e => setPo(p => ({ ...p, supplierEmail: e.target.value }))} placeholder="order@leverantor.se" />
            </div>
          )}
        </div>

        <div className="lg-dl-rows po-rows">
          <div className={`lg-dl-row head${editable ? '' : ' po-recv'}`} aria-hidden="true">
            <span>{tr('ui.vara')}</span>
            {editable ? <><span className="r">{tr('lager.colQty')}</span><span className="r">{tr('lager.colCost')}</span><span className="r">{tr('lager.colSum')}</span><span /></>
              : <><span className="r">{tr('po.ordered')}</span><span className="r">{tr('po.received')}</span><span className="r">{status === 'received' || status === 'cancelled' ? '' : tr('po.receiveNow')}</span><span /></>}
          </div>
          {(editable ? po.rows : lines).map(r => {
            const g = byId.get(r.articleId);
            return editable ? (
              <div key={r.key} className="lg-dl-row">
                <select className="ws-input" value={r.articleId} onChange={e => setRow(r.key, { articleId: e.target.value })} aria-label={tr('ui.vara')}>
                  <option value="">{tr('lager.pickGood')}</option>
                  {goods.map(x => <option key={x.id} value={x.id}>{x.articleNumber ? `${x.articleNumber} · ` : ''}{x.description}</option>)}
                </select>
                <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder="0" value={r.qty} onChange={e => setRow(r.key, { qty: e.target.value })} aria-label={tr('lager.colQty')} /><span>{r.articleId ? unitOf(r.articleId) : ''}</span></div>
                <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder="0" value={r.unitCost} onChange={e => setRow(r.key, { unitCost: e.target.value })} aria-label={tr('lager.colCost')} /><span>kr</span></div>
                <span className="r lg-dl-sum">{num(r.qty) > 0 ? fmtKr(num(r.qty) * num(r.unitCost)) : ''}</span>
                <button type="button" className="ws-icon-btn" aria-label={tr('ui.ta_bort')} onClick={() => setPo(p => ({ ...p, rows: p.rows.length > 1 ? p.rows.filter(x => x.key !== r.key) : [{ key: rowKey(), articleId: '', qty: '', unitCost: '' }] }))}><Trash2 size={14} /></button>
              </div>
            ) : (
              <div key={r.key} className="lg-dl-row po-recv">
                <span className="lg-move-name" style={{ cursor: 'default' }}><strong>{g?.description || r.description}</strong><small>{[g?.articleNumber, `${fmt(r.unitCost)} kr/${unitOf(r.articleId)}`].filter(Boolean).join(' · ')}</small></span>
                <span className="r">{fmtQty(r.qty)} {unitOf(r.articleId)}</span>
                <span className={`r${num(r.received) >= num(r.qty) ? ' po-done' : ''}`}>{num(r.received) >= num(r.qty) ? <><Check size={13} /> {fmtQty(r.received)}</> : fmtQty(r.received)}</span>
                {status === 'received' || status === 'cancelled' || rowRemaining(r) === 0 ? <span /> : (
                  <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" value={recv[r.key] ?? ''} onChange={e => setRecv(v => ({ ...v, [r.key]: e.target.value }))} aria-label={`${tr('po.receiveNow')} ${g?.description || ''}`} /><span>{unitOf(r.articleId)}</span></div>
                )}
                <span />
              </div>
            );
          })}
        </div>

        <div className="lg-dl-foot">
          {editable ? <button type="button" className="agi-btn" onClick={() => setPo(p => ({ ...p, rows: [...p.rows, { key: rowKey(), articleId: '', qty: '', unitCost: '' }] }))}><Plus size={14} /> {tr('lager.addRow')}</button> : <span />}
          <span>{tr('po.total')} <b>{fmtKr(total)}</b></span>
        </div>

        {editable && (
          <div style={{ marginTop: '12px' }}>
            <label className="ws-label" htmlFor="po-note">{tr('po.note')}</label>
            <input id="po-note" className="ws-input" value={po.note || ''} onChange={e => setPo(p => ({ ...p, note: e.target.value }))} placeholder={tr('po.notePlaceholder')} />
          </div>
        )}
        {(status === 'ordered' || status === 'partial') && (
          <div className="po-recv-bar">
            <label className="ws-label" htmlFor="po-recv-date" style={{ margin: 0 }}>{tr('po.receiveDate')}</label>
            <input id="po-recv-date" type="date" className="ws-input" style={{ width: 'auto' }} value={recvDate} onChange={e => setRecvDate(e.target.value)} />
            <span className="ws-hint">{tr('po.receiveHint')}</span>
          </div>
        )}
        {po.matchedExpenseLabel && <p className="ws-hint" style={{ marginTop: '10px' }}><Check size={13} /> {tr('po.matched', { label: po.matchedExpenseLabel })}</p>}
        {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)', marginTop: '8px' }}>{error}</p>}

        <div className="modal-footer po-foot">
          {editable && onDelete && <button type="button" className="agi-btn po-danger" onClick={async () => { if (await confirmDialog(tr('po.deleteConfirm', { number: po.number }))) { onDelete(po); onClose(); } }}>{tr('po.deleteDraft')}</button>}
          {(status === 'ordered' || status === 'partial') && <button type="button" className="agi-btn po-danger" onClick={async () => { if (await confirmDialog(tr('po.cancelConfirm', { number: po.number }))) { onSave({ ...po, cancelled: true }); onClose(); } }}>{tr('po.cancel')}</button>}
          <span style={{ flex: 1 }} />
          {status !== 'cancelled' && <button type="button" className="agi-btn" onClick={() => { const e = validate(); if (e) return setError(e); downloadPurchaseOrderPdf({ company, po: clean(po), articles: goods }); }}><Download size={14} /> PDF</button>}
          {editable && <>
            <button type="button" className="agi-btn" onClick={saveDraft}>{tr('po.saveDraft')}</button>
            <button type="button" className="agi-btn" onClick={() => markOrdered(false)}>{tr('po.markOrdered')}</button>
            <button type="button" className="agi-btn primary" onClick={() => markOrdered(true)}><Send size={14} /> {tr('po.sendMail')}</button>
          </>}
          {(status === 'ordered' || status === 'partial') && <button type="button" className="agi-btn primary" onClick={receive}><Truck size={14} /> {tr('po.receive')}</button>}
          {(status === 'received' || status === 'cancelled') && <button type="button" className="agi-btn primary" onClick={onClose}>{tr('lager.done')}</button>}
        </div>
      </div>
    </div>
  );
}
