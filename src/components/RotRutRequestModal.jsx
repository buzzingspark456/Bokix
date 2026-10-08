import React, { useMemo, useState } from 'react';
import { X, Download, Check } from './icons';
import { Notice } from './SkattekontoImportModal';
import RotRutBookingImport from './RotRutBookingImport';
import RotRutBatchRow from './RotRutBatchRow';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  rotRutAmounts, rotRutInvoiceErrors, rotRutBatchErrors, downloadRotRutXml, MAX_REQUEST_NAME,
} from '../utils/rotRutRequest';
import { BRAND } from '../utils/brandColors';
import { t as tr } from '../i18n';

// Begäran om utbetalning av ROT/RUT till Skatteverket. Två flikar:
//   Att begära  betalda fakturor med avdrag som inte begärts än. Ger en
//               XML-fil att ladda upp i e-tjänsten "Rot och rut".
//   Väntar      begärda fakturor. Utbetalning bokförs mot skattekontot
//               (1630), avslag flyttar avdraget till kunden (App.jsx).
// Bokix lämnar aldrig in något själv, användaren laddar upp filen.

const fmt = (n) => new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(n || 0);
const today = () => new Date().toISOString().slice(0, 10);
const btn = { padding: '9px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit' };
const primaryBtn = (enabled) => ({ padding: '9px 18px', background: enabled ? BRAND.green : 'var(--gray-300)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 700, cursor: enabled ? 'pointer' : 'not-allowed', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: '6px' });
const inp = { padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' };
const rowSt = { display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: '10px', alignItems: 'start', padding: '10px 4px', borderBottom: '1px solid var(--border-light)', fontSize: '13px' };
const errText = (e) => tr(`rotRut.err.${e.key}`, e.vars);

export default function RotRutRequestModal({ invoices, contacts, company, batches = [], uid, initialTab, onRequested, onPayout, onRejected, onImportBookings, onBatchRequested, onBatchPayout, onClose }) {
  const [tab, setTab] = useState(initialTab || 'new');
  const [type, setType] = useState(() => (invoices.some(i => i.rotRutType === 'rot' && !i.rotRutStatus) ? 'rot' : 'rut'));
  const [name, setName] = useState(() => `${type.toUpperCase()} ${today()}`);
  const [picked, setPicked] = useState(null); // null = alla giltiga
  const [downloadedIds, setDownloadedIds] = useState(null);
  const [payoutIds, setPayoutIds] = useState(new Set());
  const [payoutDate, setPayoutDate] = useState(today());

  const customerOf = (inv) => contacts.find(c => c.id === inv.customerId);

  const candidates = useMemo(() => invoices
    .filter(i => i.rotRutType === type && !i.rotRutStatus && !i.creditFor && i.status !== 'draft' && (i.type || 'invoice') === 'invoice')
    .map(i => ({ inv: i, errors: rotRutInvoiceErrors(i, customerOf(i), { company }) }))
    .sort((a, b) => String(a.inv.paidDate || '9').localeCompare(String(b.inv.paidDate || '9'))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [invoices, contacts, type, company]);

  const valid = candidates.filter(c => c.errors.length === 0);
  const selectedIds = picked ?? new Set(valid.map(c => c.inv.id));
  const selected = valid.filter(c => selectedIds.has(c.inv.id)).map(c => c.inv);
  const batchErrors = rotRutBatchErrors(selected, invoices, contacts, batches);
  const total = selected.reduce((s, i) => s + rotRutAmounts(i).deduction, 0);
  const canDownload = selected.length > 0 && batchErrors.length === 0 && name.trim().length > 0;

  const waiting = invoices.filter(i => i.rotRutType && i.rotRutStatus === 'requested');
  const waitingBatches = batches.filter(b => b.status !== 'paid');
  const waitingCount = waiting.length + waitingBatches.length;

  const toggle = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };

  const switchType = (v) => {
    setType(v); setPicked(null); setDownloadedIds(null);
    setName(`${v.toUpperCase()} ${today()}`);
  };

  const handleDownload = () => {
    if (!canDownload) return;
    downloadRotRutXml({ type, name: name.trim(), invoices: selected, contacts }, `${type}-begaran-${today()}.xml`);
    setDownloadedIds(selected.map(i => i.id));
  };

  const handleMarkRequested = () => {
    onRequested(downloadedIds, today());
    setDownloadedIds(null); setPicked(null); setTab('waiting');
  };

  const handlePayout = () => {
    if (payoutIds.size === 0 || !payoutDate) return;
    onPayout([...payoutIds], payoutDate);
    setPayoutIds(new Set());
  };

  const handleReject = async (inv) => {
    const ok = await confirmDialog(tr('rotRut.rejectConfirm', { nr: inv.invoiceNumber, amount: fmt(rotRutAmounts(inv).deduction) }), { confirmLabel: tr('rotRut.reject'), danger: true });
    if (ok) onRejected(inv.id, today());
  };

  const typeToggle = (
    <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '9px', overflow: 'hidden' }}>
      {['rot', 'rut'].map(v => (
        <button key={v} type="button" onClick={() => switchType(v)} style={{
          padding: '8px 16px', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          background: type === v ? 'var(--accent)' : 'var(--bg-card)', color: type === v ? 'white' : 'var(--text-main)', fontWeight: type === v ? 700 : 500,
        }}>{v.toUpperCase()}</button>
      ))}
    </div>
  );

  const tabBtn = (id, label) => (
    <button type="button" onClick={() => setTab(id)} style={{
      flex: 1, padding: '8px 10px', border: 'none', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
      background: tab === id ? 'var(--accent)' : 'var(--bg-card)', color: tab === id ? 'white' : 'var(--text-main)', fontWeight: tab === id ? 700 : 500,
    }}>{label}</button>
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '720px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{tr('rotRut.title')}</span>
          <button className="modal-close" onClick={onClose} aria-label={tr('ui.stang')}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: '9px', overflow: 'hidden', marginBottom: '16px' }}>
          {tabBtn('new', tr('rotRut.tabNew'))}
          {onImportBookings && tabBtn('import', tr('rotRut.tabImport'))}
          {tabBtn('waiting', `${tr('rotRut.tabWaiting')}${waitingCount ? ` (${waitingCount})` : ''}`)}
        </div>

        {tab === 'new' && (
          <>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{tr('rotRut.intro')}</p>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap', marginBottom: '12px' }}>
              {typeToggle}
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                {tr('rotRut.requestName')}<br />
                <input value={name} maxLength={MAX_REQUEST_NAME} onChange={e => setName(e.target.value)} style={{ ...inp, width: '180px', marginTop: '4px' }} />
              </label>
            </div>

            {candidates.length === 0 ? (
              <Notice tone="amber">{tr('rotRut.noneToRequest', { type: type.toUpperCase() })}</Notice>
            ) : (
              <div style={{ maxHeight: '340px', overflowY: 'auto', marginBottom: '12px', borderTop: '1px solid var(--border-light)' }}>
                {candidates.map(({ inv, errors }) => {
                  const a = rotRutAmounts(inv);
                  const ok = errors.length === 0;
                  return (
                    <label key={inv.id} style={{ ...rowSt, cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.85 }}>
                      <input type="checkbox" disabled={!ok} checked={ok && selectedIds.has(inv.id)} onChange={() => toggle(inv.id)} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {tr('rotRut.invoiceLine', { nr: inv.invoiceNumber, name: customerOf(inv)?.name || '?' })}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {inv.paidDate ? tr('rotRut.paidOn', { date: inv.paidDate }) : tr('rotRut.notPaidYet')}
                          {inv.rotRutWorkType ? ` · ${tr(`rotRut.work.${inv.rotRutWorkType}`)}` : ''}
                        </div>
                        {errors.map(e => (
                          <div key={e.key} style={{ color: 'var(--status-red-text)', fontSize: '12px', marginTop: '2px' }}>{errText(e)}</div>
                        ))}
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(a.deduction)} kr</div>
                    </label>
                  );
                })}
              </div>
            )}

            {batchErrors.map((e, i) => <Notice key={i} tone="red">{errText(e)}</Notice>)}

            {downloadedIds ? (
              <Notice tone="green">{tr('rotRut.downloaded')}</Notice>
            ) : null}

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                {tr('rotRut.summary', { n: selected.length, amount: fmt(total) })}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                {downloadedIds ? (
                  <button type="button" onClick={handleMarkRequested} style={primaryBtn(true)}><Check size={14} /> {tr('rotRut.markRequested')}</button>
                ) : (
                  <button type="button" onClick={handleDownload} disabled={!canDownload} style={primaryBtn(canDownload)}><Download size={14} /> {tr('rotRut.download')}</button>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'import' && (
          <>
            <div style={{ marginBottom: '12px' }}>{typeToggle}</div>
            <RotRutBookingImport
              key={type}
              type={type}
              company={company}
              invoices={invoices}
              contacts={contacts}
              batches={batches}
              uid={uid}
              onImport={onImportBookings}
              onDone={(batchId) => { onBatchRequested(batchId, today()); setTab('waiting'); }}
            />
          </>
        )}

        {tab === 'waiting' && (
          <>
            {waitingBatches.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                {waitingBatches.map(b => (
                  <RotRutBatchRow key={b.id} batch={b} onRequested={() => onBatchRequested(b.id, today())} onPayout={(date, amount) => onBatchPayout(b.id, date, amount)} />
                ))}
              </div>
            )}
            {waiting.length === 0 ? (waitingBatches.length > 0 ? null : (
              <Notice tone="amber">{tr('rotRut.noneWaiting')}</Notice>
            )) : (
              <>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{tr('rotRut.waitingIntro')}</p>
                <div style={{ maxHeight: '340px', overflowY: 'auto', marginBottom: '12px', borderTop: '1px solid var(--border-light)' }}>
                  {waiting.map(inv => (
                    <div key={inv.id} style={rowSt}>
                      <input type="checkbox" checked={payoutIds.has(inv.id)} onChange={() => setPayoutIds(prev => { const n = new Set(prev); if (n.has(inv.id)) n.delete(inv.id); else n.add(inv.id); return n; })} style={{ marginTop: 2 }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                          {inv.rotRutType.toUpperCase()} · {tr('rotRut.invoiceLine', { nr: inv.invoiceNumber, name: customerOf(inv)?.name || '?' })}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {tr('rotRut.requestedOn', { date: inv.rotRutRequestedAt || '' })}
                          {' · '}
                          <button type="button" onClick={() => handleReject(inv)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--status-red-text)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit' }}>{tr('rotRut.reject')}</button>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmt(rotRutAmounts(inv).deduction)} kr</div>
                    </div>
                  ))}
                </div>
                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'end', gap: '12px', flexWrap: 'wrap' }}>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {tr('rotRut.payoutDate')}<br />
                    <input type="date" value={payoutDate} onChange={e => setPayoutDate(e.target.value)} style={{ ...inp, marginTop: '4px' }} />
                  </label>
                  <button type="button" onClick={handlePayout} disabled={payoutIds.size === 0} style={primaryBtn(payoutIds.size > 0)}>
                    <Check size={14} /> {tr('rotRut.registerPayout', { n: payoutIds.size })}
                  </button>
                </div>
              </>
            )}
            <div style={{ marginTop: '8px' }}><button type="button" onClick={onClose} style={btn}>{tr('ui.stang')}</button></div>
          </>
        )}
      </div>
    </div>
  );
}
