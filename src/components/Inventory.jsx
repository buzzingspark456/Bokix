import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, Trash2, X, ChevronDown, ChevronRight } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  STOCK_ACCOUNT_KINDS, valuateInventory, ledgerBalanceAt, buildInventoryVerification, deriveInvoiceMovements,
} from '../utils/inventory';
import { t as tr } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(v || 0))} kr`;
const fmtQty = (v) => numberFormat('sv-SE', { maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mv_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const MOVEMENT_TYPES = [
  { id: 'in', label: tr('lager.typeIn'), hint: tr('lager.typeInHint') },
  { id: 'out', label: tr('lager.typeOut'), hint: tr('lager.typeOutHint') },
  { id: 'count', label: tr('lager.typeCount'), hint: tr('lager.typeCountHint') },
];
const movementLabel = (m) => (m.source === 'invoice'
  ? (m.type === 'in' ? tr('ui.retur_kreditfaktura') : tr('ui.sald_pa_faktura'))
  : MOVEMENT_TYPES.find(t => t.id === m.type)?.label);

/**
 * Lager — flik under Artiklar, byggd som Fortnox Lager (2026-10-17): en
 * varulista med saldo, inköpspris och lagervärde per vara, tre tydliga
 * knappar (Inleverans, Uttag, Inventering) i stället för en typlista, och
 * varje vara fälls ut till sina partier (FIFO: det äldsta säljs först) och
 * sina händelser. Inställningarna (metod, konto, lägsta värdets princip)
 * ligger bakom en knapp, och bokslutsjusteringen är en egen rad som bara
 * syns när bokföringen och lagret skiljer sig. Räkningen ligger i
 * utils/inventory.js.
 */
export default function Inventory({ articles = [], invoices = [], company, verifications = [], onAddVerification, setCompanyInfo, onAddArticle }) {
  const manualMovements = useMemo(() => company?.stockMovements || [], [company?.stockMovements]);
  const settings = { method: 'avg', accountKind: 'handelsvaror', lowestValue: true, stockFromInvoices: false, stockFromInvoicesSince: '', ...(company?.inventorySettings || {}) };
  // Lagerutgångar ur fakturor räknas fram här och sparas aldrig, så en ändrad
  // eller raderad faktura ger rätt saldo direkt (se deriveInvoiceMovements).
  const invoiceMovements = useMemo(
    () => (settings.stockFromInvoices ? deriveInvoiceMovements({ invoices, articles, movements: manualMovements, since: settings.stockFromInvoicesSince || null }) : []),
    [settings.stockFromInvoices, settings.stockFromInvoicesSince, invoices, articles, manualMovements],
  );
  const movements = useMemo(() => [...manualMovements, ...invoiceMovements], [manualMovements, invoiceMovements]);
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const goods = articles.filter(a => a.type === 'vara' && a.id);

  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [closingDate, setClosingDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const setSetting = (patch) => setCompanyInfo(prev => ({ ...prev, inventorySettings: { ...settings, ...(prev.inventorySettings || {}), ...patch } }));
  const saveMovements = (next) => setCompanyInfo(prev => ({ ...prev, stockMovements: next }));
  const toggleFromInvoices = (on) => setSetting({ stockFromInvoices: on, stockFromInvoicesSince: on ? (settings.stockFromInvoicesSince || todayIso()) : settings.stockFromInvoicesSince });

  const valuation = useMemo(
    () => valuateInventory({ articles, movements, method: settings.method, asOf: closingDate, applyLowestValue: settings.lowestValue }),
    [articles, movements, settings.method, settings.lowestValue, closingDate],
  );
  const kind = STOCK_ACCOUNT_KINDS.find(k => k.id === settings.accountKind) || STOCK_ACCOUNT_KINDS[0];
  const ledgerBalance = ledgerBalanceAt(verifications, kind.stockAccount, closingDate);
  const closing = buildInventoryVerification({
    date: closingDate, closingValue: valuation.bookValue, ledgerBalance, stockAccount: kind.stockAccount, changeAccount: kind.changeAccount,
  });
  const alreadyBooked = verifications.some(v => v.sourceId === `inventory_${closingDate}` && (v.status || 'booked') !== 'draft');
  const diff = Math.round((valuation.bookValue - ledgerBalance) * 100) / 100;

  // Alla varor syns, även de som inte har någon lagerhändelse än (saldo 0),
  // så att man ser vad man kan göra en inleverans på.
  const lineById = new Map(valuation.lines.map(l => [l.articleId, l]));
  const rows = goods
    .map(g => lineById.get(g.id) || { articleId: g.id, articleNumber: g.articleNumber || '', description: g.description, qty: 0, unitCost: Number(g.purchasePrice) || 0, costValue: 0, bookValue: 0, writeDown: 0, shortfall: 0, layers: [], empty: true })
    .sort((a, b) => (b.qty > 0) - (a.qty > 0) || a.description.localeCompare(b.description, 'sv'));
  const inStock = rows.filter(r => r.qty > 0);
  const totalUnits = inStock.reduce((s, r) => s + r.qty, 0);

  const startMovement = (type, articleId) => {
    const id = articleId || goods[0]?.id || '';
    setForm({ articleId: id, type, date: todayIso(), qty: '', unitCost: goods.find(g => g.id === id)?.purchasePrice ?? '' });
    setError('');
  };

  const saveMovement = (e) => {
    e.preventDefault();
    const qty = Number(form.qty);
    if (!form.articleId) return setError(tr('ui.valj_en_vara'));
    if (!(form.type === 'count' ? qty >= 0 && form.qty !== '' : qty > 0)) return setError(tr('ui.ange_ett_antal'));
    if (form.type === 'in' && !(Number(form.unitCost) >= 0 && form.unitCost !== '')) return setError(tr('ui.ange_inkopspris_per_enhet'));
    saveMovements([...manualMovements, {
      id: newId(), articleId: form.articleId, type: form.type, date: form.date, qty,
      unitCost: form.type === 'in' ? Number(form.unitCost) : undefined,
    }]);
    setForm(null); setError('');
  };

  const removeMovement = async (m) => {
    if (!(await confirmDialog(tr('ui.ta_bort_lagerhandelsen_varderingen_raknas_om')))) return;
    saveMovements(manualMovements.filter(x => x.id !== m.id));
  };

  const bookClosing = async () => {
    if (!closing) return;
    if (lockedFor(closingDate)) return setMessage(tr('ui.rakenskapsaret_ar_last', { v0: lockedFor(closingDate) }));
    if (!(await confirmDialog(tr('ui.bokfor_lagerjustering_kr_pa', { v0: closing.rows[0].debet ? '+' : '−', v1: fmt(Math.abs(diff)), stockAccount: kind.stockAccount })))) return;
    onAddVerification(closing);
    setMessage(tr('ui.lagerjusteringen_ar_bokford'));
  };

  const methodName = settings.method === 'fifo' ? tr('lager.methodFifo') : tr('lager.methodAvg');

  const renderDetail = (r) => {
    const history = movements
      .filter(m => m.articleId === r.articleId)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return (
      <div className="ws-cols" style={{ padding: '16px 20px 20px', background: 'var(--bg-card)', gap: '16px' }} onClick={e => e.stopPropagation()}>
        <div className="ws-card">
          <div className="ws-card-head">
            <div>
              <h4 className="ws-card-title" style={{ fontSize: '14px' }}>{tr('lager.history')}</h4>
            </div>
            <div className="ws-card-actions">
              <button type="button" className="agi-btn" onClick={() => startMovement('in', r.articleId)}>{tr('lager.typeIn')}</button>
              <button type="button" className="agi-btn" onClick={() => startMovement('out', r.articleId)}>{tr('lager.typeOut')}</button>
            </div>
          </div>
          {history.length === 0 ? <div className="ws-rows-empty">{tr('lager.noHistory')}</div> : (
            <ul className="ws-rows">
              {history.map(m => (
                <li key={m.id}>
                  <span className="date">{m.date}</span>
                  <span className="grow">
                    {movementLabel(m)}
                    {m.source === 'invoice' && m.invoiceNumber ? <span className="muted">{tr('ui.faktura', { invoiceNumber: m.invoiceNumber })}</span> : null}
                  </span>
                  <span className="num">{m.type === 'out' ? '−' : m.type === 'count' ? '= ' : '+'}{fmtQty(m.qty)} {tr('ui.st')}</span>
                  {m.type === 'in' && m.source !== 'invoice' && <span className="muted" style={{ width: '96px', textAlign: 'right' }}>{fmt(m.unitCost)} kr</span>}
                  {m.source === 'invoice'
                    ? <span className="muted">{tr('ui.automatiskt')}</span>
                    : <button type="button" className="ws-icon-btn" title={tr('ui.ta_bort')} onClick={() => removeMovement(m)}><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="ws-card">
          <div className="ws-card-head">
            <div>
              <h4 className="ws-card-title" style={{ fontSize: '14px' }}>{tr('lager.batches')}</h4>
              <p className="ws-card-sub">{settings.method === 'fifo' ? tr('lager.batchesFifo') : tr('lager.batchesAvg', { price: fmt(r.unitCost) })}</p>
            </div>
          </div>
          {r.layers.length === 0 ? <div className="ws-rows-empty">{tr('lager.noBatches')}</div> : (
            <ul className="ws-rows">
              {r.layers.map((l, i) => (
                <li key={`${l.date}-${i}`}>
                  <span className="date">{l.date || '—'}</span>
                  <span className="grow">{fmtQty(l.qty)} {tr('ui.st')} × {fmt(l.cost)} kr</span>
                  <span className="num">{fmtKr(l.qty * l.cost)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="ws-page">
      <div className="ws-stats">
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('ui.lagervarde_att_bokfora')}</div>
          <div className="ws-stat-value">{fmtKr(valuation.bookValue)}</div>
          <div className="ws-stat-sub">{tr('lager.perDate', { date: closingDate })}</div>
        </div>
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('lager.itemsInStock')}</div>
          <div className="ws-stat-value">{inStock.length}</div>
          <div className="ws-stat-sub">{tr('lager.units', { n: fmtQty(totalUnits) })}</div>
        </div>
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('ui.nedskrivning')}</div>
          <div className="ws-stat-value">{fmtKr(valuation.writeDown)}</div>
          <div className="ws-stat-sub">{settings.lowestValue ? tr('lager.lowestOn') : tr('lager.lowestOff')}</div>
        </div>
        <div className="ws-stat">
          <div className="ws-stat-label">{tr('lager.method')}</div>
          <div className="ws-stat-value" style={{ fontSize: '17px', paddingTop: '4px' }}>{methodName}</div>
          <div className="ws-stat-sub">{tr('lager.account', { account: kind.stockAccount })}</div>
        </div>
      </div>

      {valuation.lines.length > 0 && (
        <div className={`ws-notice${closing && !alreadyBooked ? ' warn' : ' ok'}`}>
          <div>
            <strong>
              {alreadyBooked ? tr('ui.lagerjusteringen_per_ar_bokford', { closingDate })
                : closing ? tr('ui.lagret_behover_justeras_med_kr', { v0: diff > 0 ? '+' : '−', v1: fmt(Math.abs(diff)) })
                : tr('ui.bokforingen_stammer_med_lagervardet')}
            </strong>
            <p>{tr('lager.ledgerVsStock', { account: kind.stockAccount, ledger: fmtKr(ledgerBalance), stock: fmtKr(valuation.bookValue) })}</p>
          </div>
          <div className="ws-card-actions">
            <input type="date" className="ws-input" style={{ width: 'auto', height: '36px' }} value={closingDate} aria-label={tr('ui.vardering_per_datum')} onChange={e => e.target.value && setClosingDate(e.target.value)} />
            {closing && !alreadyBooked && <button type="button" className="agi-btn primary" onClick={bookClosing}>{tr('ui.bokfor_lagerjustering')}</button>}
          </div>
        </div>
      )}
      {message && <p className="ws-hint" style={{ color: 'var(--status-green-text)' }}>{message}</p>}

      <div className="ws-card">
        <div className="ws-card-head">
          <div>
            <h3 className="ws-card-title">{tr('lager.goods')}</h3>
            <p className="ws-card-sub">{tr('lager.goodsSub')}</p>
          </div>
          <div className="ws-card-actions">
            <button type="button" className="agi-btn" onClick={() => setShowSettings(true)}>{tr('lager.settings')}</button>
            {goods.length > 0 && <>
              <button type="button" className="agi-btn" onClick={() => startMovement('count')}>{tr('lager.typeCount')}</button>
              <button type="button" className="agi-btn" onClick={() => startMovement('out')}>{tr('lager.typeOut')}</button>
              <button type="button" className="agi-btn primary" onClick={() => startMovement('in')}><Plus size={14} /> {tr('lager.typeIn')}</button>
            </>}
          </div>
        </div>
        {goods.length === 0 ? (
          <div className="ws-empty">
            <h3>{tr('lager.emptyTitle')}</h3>
            <p>{tr('ui.lagret_foljer_artiklar_av_typen')} <b>{tr('ui.vara')}</b>{tr('ui.lagg_till_en_vara_under_fliken_artiklar_for_att')}</p>
            <p style={{ marginTop: '-8px' }}>{tr('ui.inget_lager_varderat_annu_registrera_en_inlevera')}</p>
            {onAddArticle && <button type="button" className="agi-btn primary" onClick={onAddArticle}><Plus size={14} /> {tr('lager.addGood')}</button>}
          </div>
        ) : (
          <ListTable
            bordered={false}
            rowKey={r => r.articleId}
            rows={rows}
            onRowClick={r => setExpanded(expanded === r.articleId ? null : r.articleId)}
            isExpanded={r => expanded === r.articleId}
            renderExpanded={renderDetail}
            emptyMessage={tr('ui.inget_lager_varderat_annu_registrera_en_inlevera')}
            mobileList={r => ({ primary: r.description, amount: fmtKr(r.bookValue), meta: tr('ui.st_kr', { v0: fmtQty(r.qty), v1: fmt(r.unitCost) }) })}
            columns={[
              {
                key: 'description', label: tr('ui.vara'), render: r => (
                  <div className="ws-name">
                    {expanded === r.articleId ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}
                    <div className="ws-name-text">
                      <strong>{r.description}</strong>
                      {r.articleNumber && <small>{r.articleNumber}</small>}
                    </div>
                  </div>
                ),
              },
              { key: 'qty', label: tr('lager.inStock'), align: 'right', fontWeight: 600, color: 'var(--text-main)', render: r => `${fmtQty(r.qty)} ${tr('ui.st')}` },
              { key: 'unitCost', label: tr('lager.unitCost'), align: 'right', render: r => `${fmt(r.unitCost)} kr` },
              { key: 'bookValue', label: tr('ui.varde'), align: 'right', fontWeight: 600, color: 'var(--text-main)', render: r => fmtKr(r.bookValue) },
              {
                key: 'status', label: '', align: 'right', render: r => (r.shortfall > 0
                  ? <span className="agi-pill late" title={tr('ui.fler_uttag_an_inleveranser_registrerade')}>{tr('ui.saknar')} {fmtQty(r.shortfall)} {tr('ui.inleverans')}</span>
                  : r.writeDown > 0 ? <span className="agi-pill warn">{tr('lager.writtenDown')}</span>
                  : r.qty <= 0 ? <span className="agi-pill" style={{ background: 'var(--bg-muted)', color: 'var(--text-secondary)' }}>{tr('lager.outOfStock')}</span>
                  : null),
              },
            ]}
          />
        )}
      </div>

      {/* Lagerhändelse: tre typer som flikar i stället för en lista. */}
      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <div className="modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{MOVEMENT_TYPES.find(t => t.id === form.type)?.label}</h2>
              <button type="button" className="modal-close" onClick={() => setForm(null)}><X size={18} /></button>
            </div>
            <form className="ws-form" onSubmit={saveMovement}>
              <div className="ws-seg" style={{ alignSelf: 'flex-start' }}>
                {MOVEMENT_TYPES.map(t => <button key={t.id} type="button" className={form.type === t.id ? 'on' : ''} onClick={() => setForm(f => ({ ...f, type: t.id }))}>{t.label}</button>)}
              </div>
              <p className="ws-hint" style={{ marginTop: '-6px' }}>{MOVEMENT_TYPES.find(t => t.id === form.type)?.hint}</p>
              <div>
                <label className="ws-label">{tr('ui.vara')}</label>
                <select className="ws-input" value={form.articleId} onChange={e => setForm(f => ({ ...f, articleId: e.target.value, unitCost: goods.find(g => g.id === e.target.value)?.purchasePrice ?? f.unitCost }))}>
                  {goods.map(g => <option key={g.id} value={g.id}>{g.description}</option>)}
                </select>
              </div>
              <div className="ws-grid2">
                <div><label className="ws-label">{tr('ui.datum')}</label><input type="date" className="ws-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
                <div>
                  <label className="ws-label">{form.type === 'count' ? tr('lager.countedQty') : tr('ui.antal')}</label>
                  <div className="ws-input-suffix"><input type="number" step="any" min="0" className="ws-input" value={form.qty} autoFocus onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /><span>{tr('ui.st')}</span></div>
                </div>
              </div>
              {form.type === 'in' && (
                <div>
                  <label className="ws-label">{tr('ui.inkopspris_per_enhet_kr_exkl_moms')}</label>
                  <div className="ws-input-suffix"><input type="number" step="0.01" min="0" className="ws-input" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))} /><span>kr</span></div>
                </div>
              )}
              {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>}
              <div className="modal-footer" style={{ marginTop: 0 }}>
                <button type="button" className="agi-btn" onClick={() => setForm(null)}>{tr('ui.avbryt')}</button>
                <button type="submit" className="agi-btn primary">{tr('ui.spara')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-content" style={{ maxWidth: '520px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{tr('lager.settings')}</h2>
              <button type="button" className="modal-close" onClick={() => setShowSettings(false)}><X size={18} /></button>
            </div>
            <div className="ws-form">
              <div>
                <label className="ws-label">{tr('ui.varderingsmetod')}</label>
                <div className="ws-choice">
                  <button type="button" className={settings.method === 'fifo' ? 'on' : ''} onClick={() => setSetting({ method: 'fifo' })}>
                    <strong>{tr('lager.methodFifo')}</strong><span>{tr('lager.methodFifoHint')}</span>
                  </button>
                  <button type="button" className={settings.method === 'avg' ? 'on' : ''} onClick={() => setSetting({ method: 'avg' })}>
                    <strong>{tr('lager.methodAvg')}</strong><span>{tr('lager.methodAvgHint')}</span>
                  </button>
                </div>
              </div>
              <div>
                <label className="ws-label">{tr('ui.lagerkonto')}</label>
                <select className="ws-input" value={settings.accountKind} onChange={e => setSetting({ accountKind: e.target.value })}>
                  {STOCK_ACCOUNT_KINDS.map(k => <option key={k.id} value={k.id}>{k.label} ({k.stockAccount})</option>)}
                </select>
              </div>
              <label className="ws-check">
                <input type="checkbox" checked={settings.lowestValue} onChange={e => setSetting({ lowestValue: e.target.checked })} />
                <span>{tr('ui.lagsta_vardets_princip_lagst_av_inkopspris_och_f')}</span>
              </label>
              <label className="ws-check">
                <input type="checkbox" checked={settings.stockFromInvoices} onChange={e => toggleFromInvoices(e.target.checked)} />
                <span>{tr('ui.dra_av_lagret_automatiskt_nar_jag_fakturerar')}<small>{tr('lager.fromInvoicesHint')}</small></span>
              </label>
              {settings.stockFromInvoices && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="ws-hint">{tr('ui.rakna_fakturor_fran_och_med')}</span>
                  <input type="date" className="ws-input" style={{ width: 'auto' }} value={settings.stockFromInvoicesSince} onChange={e => setSetting({ stockFromInvoicesSince: e.target.value })} />
                </div>
              )}
              <div className="modal-footer" style={{ marginTop: 0 }}>
                <button type="button" className="agi-btn primary" onClick={() => setShowSettings(false)}>{tr('lager.done')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {settings.stockFromInvoices && (
        <p className="ws-hint">
          {tr('ui.dra_av_lagret_automatiskt_nar_jag_fakturerar')}: {invoiceMovements.length === 0
            ? tr('ui.inga_fakturarader_hittades_an_raden_maste_ha_sam')
            : tr('ui.fakturarader_raknas_med_lagg_inte_in_samma_forsa', { length: invoiceMovements.length })}
        </p>
      )}
    </div>
  );
}
