import React, { useMemo, useState, useEffect } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, Trash2, X, Search } from './icons';
import ListTable from './shared/ListTable';
import { ListFilterBar } from './shared/ListPageHeader';
import { confirmDialog } from './shared/ConfirmDialog';
import { Panel, Kpi, KpiGrid, usePalette } from './shared/Workspace';
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
const formatShort = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }); };

const MOVEMENT_TYPES = [
  { id: 'in', label: tr('lager.typeIn'), hint: tr('lager.typeInHint') },
  { id: 'out', label: tr('lager.typeOut'), hint: tr('lager.typeOutHint') },
  { id: 'count', label: tr('lager.typeCount'), hint: tr('lager.typeCountHint') },
];
// Orsak vid uttag, som i Shopify och Stocky. Påverkar inte värderingen,
// men syns i historiken så att svinn går att följa upp.
const OUT_REASONS = ['sale', 'shrink', 'damaged', 'own_use', 'return_supplier', 'other'];
const movementLabel = (m) => {
  if (m.source === 'invoice') return m.type === 'in' ? tr('ui.retur_kreditfaktura') : tr('ui.sald_pa_faktura');
  const base = MOVEMENT_TYPES.find(t => t.id === m.type)?.label;
  return m.type === 'out' && m.reason ? `${base} · ${tr(`lager.reason_${m.reason}`)}` : base;
};

/** Saldot över tid för en vara, som punkter (datum, antal) för en liten kurva. */
function stockHistory(movements, articleId) {
  const list = movements.filter(m => m.articleId === articleId).slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  let qty = 0;
  const points = [];
  list.forEach(m => {
    const q = Number(m.qty) || 0;
    if (m.type === 'in') qty += q;
    else if (m.type === 'out') qty = Math.max(0, qty - q);
    else if (m.type === 'count') qty = q;
    if (points.length && points[points.length - 1].date === m.date) points[points.length - 1].qty = qty;
    else points.push({ date: m.date, qty });
  });
  return points;
}

function Sparkline({ points, color, min }) {
  if (points.length < 2) return null;
  const w = 100, h = 40;
  const max = Math.max(1, ...points.map(p => p.qty), min || 0);
  // Trappsteg: saldot ligger kvar tills nästa händelse. Tidsaxeln är riktiga dagar.
  const day = (iso) => new Date(iso).getTime();
  const t0 = day(points[0].date), t1 = Math.max(day(points[points.length - 1].date), day(new Date().toISOString().slice(0, 10)));
  const X = (iso) => (t1 > t0 ? ((day(iso) - t0) / (t1 - t0)) * w : 0);
  const Y = (qty) => h - (qty / max) * (h - 4) - 2;
  const xy = [];
  points.forEach((p, i) => { if (i > 0) xy.push([X(p.date), Y(points[i - 1].qty)]); xy.push([X(p.date), Y(p.qty)]); });
  xy.push([w, Y(points[points.length - 1].qty)]);
  const line = xy.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return (
    <svg className="lg-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon points={`0,${h} ${line} ${w},${h}`} style={{ fill: color, opacity: 0.12 }} />
      <polyline points={line} style={{ fill: 'none', stroke: color, strokeWidth: 1.6, vectorEffect: 'non-scaling-stroke' }} />
      {min > 0 && <line x1="0" x2={w} y1={h - (min / max) * (h - 4) - 2} y2={h - (min / max) * (h - 4) - 2} style={{ stroke: 'var(--status-amber-text)', strokeDasharray: '3 3', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }} />}
    </svg>
  );
}

/**
 * Lager — flik under Artiklar (2026-10-17), byggd efter Fortnox Lager,
 * Shopify och Sortly i Bokix startsidestil:
 *  - filterrad under sidhuvudet: Alla / I lager / Lågt / Slut och sök
 *  - överblick i grå rutor: lagervärde, varor, lågt lager, slut
 *  - varje vara som en ruta med saldo, stapel mot beställningspunkten och status
 *  - en egen sida (från höger) per vara: saldo över tid, beställningspunkt,
 *    snabbknappar, FIFO-partier och alla händelser med orsak
 * Beställningspunkterna sparas i inventorySettings.reorderPoints. Räkningen
 * (FIFO/vägt genomsnitt, lägsta värdets princip) ligger i utils/inventory.js.
 */
export default function Inventory({ articles = [], invoices = [], company, verifications = [], onAddVerification, setCompanyInfo, onAddArticle }) {
  const manualMovements = useMemo(() => company?.stockMovements || [], [company?.stockMovements]);
  const settings = { method: 'avg', accountKind: 'handelsvaror', lowestValue: true, stockFromInvoices: false, stockFromInvoicesSince: '', reorderPoints: {}, ...(company?.inventorySettings || {}) };
  // Lagerutgångar ur fakturor räknas fram här och sparas aldrig, så en ändrad
  // eller raderad faktura ger rätt saldo direkt (se deriveInvoiceMovements).
  const invoiceMovements = useMemo(
    () => (settings.stockFromInvoices ? deriveInvoiceMovements({ invoices, articles, movements: manualMovements, since: settings.stockFromInvoicesSince || null }) : []),
    [settings.stockFromInvoices, settings.stockFromInvoicesSince, invoices, articles, manualMovements],
  );
  const movements = useMemo(() => [...manualMovements, ...invoiceMovements], [manualMovements, invoiceMovements]);
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const goods = articles.filter(a => a.type === 'vara' && a.id);
  const palette = usePalette(company);

  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [closingDate, setClosingDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [view, setViewState] = useState(() => { try { return localStorage.getItem('bokix_stock_view') || 'cards'; } catch { return 'cards'; } });
  const setView = (v) => { setViewState(v); try { localStorage.setItem('bokix_stock_view', v); } catch { /* privat läge */ } };

  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDetailId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailId]);

  const setSetting = (patch) => setCompanyInfo(prev => ({ ...prev, inventorySettings: { ...settings, ...(prev.inventorySettings || {}), ...patch } }));
  const saveMovements = (next) => setCompanyInfo(prev => ({ ...prev, stockMovements: next }));
  const toggleFromInvoices = (on) => setSetting({ stockFromInvoices: on, stockFromInvoicesSince: on ? (settings.stockFromInvoicesSince || todayIso()) : settings.stockFromInvoicesSince });
  const setReorderPoint = (articleId, value) => {
    const next = { ...(settings.reorderPoints || {}) };
    if (value === '' || !(Number(value) > 0)) delete next[articleId];
    else next[articleId] = Number(value);
    setSetting({ reorderPoints: next });
  };

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

  // Alla varor syns, även de utan lagerhändelse (saldo 0), med status mot
  // beställningspunkten: slut, lågt eller i lager.
  const lineById = new Map(valuation.lines.map(l => [l.articleId, l]));
  const allRows = goods.map(g => {
    const line = lineById.get(g.id) || { articleId: g.id, articleNumber: g.articleNumber || '', description: g.description, qty: 0, unitCost: Number(g.purchasePrice) || 0, costValue: 0, bookValue: 0, writeDown: 0, shortfall: 0, layers: [] };
    const min = Number(settings.reorderPoints?.[g.id]) || 0;
    const status = line.qty <= 0 ? 'out' : min > 0 && line.qty <= min ? 'low' : 'ok';
    return { ...line, min, status, salePrice: Number(g.unitPrice) || 0, unit: g.unit || tr('ui.st') };
  });
  const order = { low: 0, out: 1, ok: 2 };
  const q = search.trim().toLowerCase();
  const rows = allRows
    .filter(r => filter === 'all' || r.status === filter)
    .filter(r => !q || r.description.toLowerCase().includes(q) || (r.articleNumber || '').toLowerCase().includes(q))
    .sort((a, b) => order[a.status] - order[b.status] || a.description.localeCompare(b.description, 'sv'));
  const count = (s) => allRows.filter(r => r.status === s).length;
  const lowRows = allRows.filter(r => r.status === 'low');
  const inStock = allRows.filter(r => r.qty > 0);
  const totalUnits = inStock.reduce((s, r) => s + r.qty, 0);
  const detail = detailId ? allRows.find(r => r.articleId === detailId) : null;

  const startMovement = (type, articleId) => {
    const id = articleId || goods[0]?.id || '';
    setForm({ articleId: id, type, date: todayIso(), qty: '', unitCost: goods.find(g => g.id === id)?.purchasePrice ?? '', reason: 'sale', note: '' });
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
      reason: form.type === 'out' ? form.reason : undefined,
      note: form.note.trim() || undefined,
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
  const statusPill = (r) => (r.shortfall > 0
    ? <span className="agi-pill late" title={tr('ui.fler_uttag_an_inleveranser_registrerade')}>{tr('ui.saknar')} {fmtQty(r.shortfall)} {tr('ui.inleverans')}</span>
    : r.status === 'out' ? <span className="agi-pill late">{tr('lager.outOfStock')}</span>
    : r.status === 'low' ? <span className="agi-pill warn">{tr('lager.low')}</span>
    : <span className="agi-pill ok">{tr('lager.inStockPill')}</span>);
  const barColor = (r) => (r.status === 'out' ? 'var(--status-red-text)' : r.status === 'low' ? 'var(--status-amber-text)' : palette.profit);
  // Stapeln: saldot mot beställningspunkten (två gånger den = full stapel).
  // Utan beställningspunkt mot det högsta saldot varan haft.
  const barPct = (r) => {
    const top = r.min > 0 ? r.min * 2 : Math.max(r.qty, ...stockHistory(movements, r.articleId).map(p => p.qty), 1);
    return Math.max(0, Math.min(100, (r.qty / top) * 100));
  };
  const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

  return (
    <>
      {goods.length > 0 && (
        <ListFilterBar>
          <div className="ws-seg">
            {[['all', tr('ui.alla'), allRows.length], ['ok', tr('lager.inStockPill'), count('ok')], ['low', tr('lager.low'), count('low')], ['out', tr('lager.outOfStock'), count('out')]].map(([id, label, n]) => (
              <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label} <span className="lg-count">{n}</span></button>
            ))}
          </div>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '180px', maxWidth: '320px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input type="text" className="ws-input" style={{ height: '34px', paddingLeft: '32px', fontSize: '13px' }} placeholder={tr('lager.search')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </ListFilterBar>
      )}

      <div className="ws-page">
        <Panel title={tr('ui.lager')} sub={tr('lager.overviewSub', { date: closingDate, method: methodName, account: kind.stockAccount })}
          actions={<button type="button" className="agi-btn" onClick={() => setShowSettings(true)}>{tr('lager.settings')}</button>}>
          <KpiGrid>
            <Kpi dot={palette.profit} label={tr('lager.stockValue')} value={fmtKr(valuation.bookValue)} sub={valuation.writeDown > 0 ? tr('lager.afterWriteDown', { kr: fmtKr(valuation.writeDown) }) : tr('lager.perDate', { date: closingDate })} />
            <Kpi dot={palette.income} label={tr('lager.itemsInStock')} value={inStock.length} sub={tr('lager.units', { n: fmtQty(totalUnits) })} />
            <Kpi dot="var(--status-amber-text)" label={tr('lager.lowStock')} value={count('low')} sub={tr('lager.lowSub')} />
            <Kpi dot="var(--status-red-text)" label={tr('lager.outOfStock')} value={count('out')} sub={tr('lager.outSub')} />
          </KpiGrid>

          {lowRows.length > 0 && (
            <div className="ws-notice warn" style={{ marginTop: '12px' }}>
              <div>
                <strong>{(lowRows.length === 1 ? tr('lager.reorderNoticeOne') : tr('lager.reorderNotice', { n: lowRows.length }))}</strong>
                <p>{lowRows.map(r => `${r.description} (${fmtQty(r.qty)} ${tr('ui.st')})`).join(', ')}</p>
              </div>
              <button type="button" className="agi-btn" onClick={() => setFilter('low')}>{tr('lager.showLow')}</button>
            </div>
          )}

          {valuation.lines.length > 0 && closing && !alreadyBooked && (
            <div className="ws-notice" style={{ marginTop: '12px' }}>
              <div>
                <strong>{tr('ui.lagret_behover_justeras_med_kr', { v0: diff > 0 ? '+' : '−', v1: fmt(Math.abs(diff)) })}</strong>
                <p>{tr('lager.ledgerVsStock', { account: kind.stockAccount, ledger: fmtKr(ledgerBalance), stock: fmtKr(valuation.bookValue) })}</p>
              </div>
              <div className="ws-card-actions">
                <input type="date" className="ws-input" style={{ width: 'auto', height: '36px' }} value={closingDate} aria-label={tr('ui.vardering_per_datum')} onChange={e => e.target.value && setClosingDate(e.target.value)} />
                <button type="button" className="agi-btn primary" onClick={bookClosing}>{tr('ui.bokfor_lagerjustering')}</button>
              </div>
            </div>
          )}
          {alreadyBooked && <p className="ws-hint" style={{ marginTop: '12px' }}>{tr('ui.lagerjusteringen_per_ar_bokford', { closingDate })}</p>}
          {message && <p className="ws-hint" style={{ marginTop: '12px', color: 'var(--status-green-text)' }}>{message}</p>}
        </Panel>

        <Panel
          title={tr('lager.goods')}
          sub={goods.length > 0 ? tr('lager.goodsSub') : null}
          actions={goods.length > 0 && <>
            <div className="ws-seg">
              <button type="button" className={view === 'cards' ? 'on' : ''} onClick={() => setView('cards')}>{tr('proj.viewCards')}</button>
              <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>{tr('proj.viewList')}</button>
            </div>
            <button type="button" className="agi-btn" onClick={() => startMovement('count')}>{tr('lager.typeCount')}</button>
            <button type="button" className="agi-btn" onClick={() => startMovement('out')}>{tr('lager.typeOut')}</button>
            <button type="button" className="agi-btn primary" onClick={() => startMovement('in')}><Plus size={14} /> {tr('lager.typeIn')}</button>
          </>}
        >
          {goods.length === 0 ? (
            <div className="ws-empty" style={{ padding: '28px 12px 12px' }}>
              <h3>{tr('lager.emptyTitle')}</h3>
              <p>{tr('ui.lagret_foljer_artiklar_av_typen')} <b>{tr('ui.vara')}</b>{tr('ui.lagg_till_en_vara_under_fliken_artiklar_for_att')}</p>
              <p style={{ marginTop: '-8px' }}>{tr('ui.inget_lager_varderat_annu_registrera_en_inlevera')}</p>
              {onAddArticle && <button type="button" className="agi-btn primary" onClick={onAddArticle}><Plus size={14} /> {tr('lager.addGood')}</button>}
            </div>
          ) : rows.length === 0 ? (
            <p className="ws-hint" style={{ padding: '12px 0' }}>{tr('lager.noMatch')}</p>
          ) : view === 'cards' ? (
            <div className="pj-grid">
              {rows.map(r => (
                <button key={r.articleId} type="button" className="pj-card lg-card" style={{ '--pj': barColor(r) }} onClick={() => setDetailId(r.articleId)}>
                  <div className="lg-card-head">
                    <span className="lg-avatar" aria-hidden="true">{initial(r.description)}</span>
                    <div className="ws-name-text">
                      <strong>{r.description}</strong>
                      <small>{r.articleNumber || tr('ui.vara')}</small>
                    </div>
                    {statusPill(r)}
                  </div>
                  <div className="pj-card-hours">
                    <span><b>{fmtQty(r.qty)}</b> {r.unit} {tr('lager.inStockLower')}</span>
                    {r.min > 0 && <span className="pj-card-pct">{tr('lager.minShort', { n: fmtQty(r.min) })}</span>}
                  </div>
                  <div className="pz-track">
                    <span style={{ width: `${barPct(r)}%` }} />
                    {r.min > 0 && <em style={{ left: '50%' }} />}
                  </div>
                  <div className="pj-card-money">
                    <div><span>{tr('ui.varde')}</span><b>{fmtKr(r.bookValue)}</b></div>
                    <div><span>{tr('lager.unitCost')}</span><b>{fmt(r.unitCost)} kr</b></div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="wsp-flush">
              <ListTable
                bordered={false}
                rowKey={r => r.articleId}
                rows={rows}
                onRowClick={r => setDetailId(r.articleId)}
                emptyMessage={tr('lager.noMatch')}
                mobileList={r => ({ primary: r.description, amount: fmtKr(r.bookValue), meta: tr('ui.st_kr', { v0: fmtQty(r.qty), v1: fmt(r.unitCost) }), pill: statusPill(r) })}
                columns={[
                  {
                    key: 'description', label: tr('ui.vara'), render: r => (
                      <div className="ws-name">
                        <span className="lg-avatar sm" aria-hidden="true">{initial(r.description)}</span>
                        <div className="ws-name-text"><strong>{r.description}</strong>{r.articleNumber && <small>{r.articleNumber}</small>}</div>
                      </div>
                    ),
                  },
                  { key: 'qty', label: tr('lager.inStock'), align: 'right', fontWeight: 600, color: 'var(--text-main)', render: r => `${fmtQty(r.qty)} ${r.unit}` },
                  { key: 'min', label: tr('lager.reorderPoint'), align: 'right', render: r => (r.min ? fmtQty(r.min) : '—') },
                  { key: 'unitCost', label: tr('lager.unitCost'), align: 'right', render: r => `${fmt(r.unitCost)} kr` },
                  { key: 'bookValue', label: tr('ui.varde'), align: 'right', fontWeight: 600, color: 'var(--text-main)', render: r => fmtKr(r.bookValue) },
                  { key: 'status', label: '', align: 'right', render: r => statusPill(r) },
                ]}
              />
            </div>
          )}
        </Panel>

        {settings.stockFromInvoices && (
          <p className="ws-hint">
            {tr('ui.dra_av_lagret_automatiskt_nar_jag_fakturerar')}: {invoiceMovements.length === 0
              ? tr('ui.inga_fakturarader_hittades_an_raden_maste_ha_sam')
              : tr('ui.fakturarader_raknas_med_lagg_inte_in_samma_forsa', { length: invoiceMovements.length })}
          </p>
        )}
      </div>

      {/* Varans egen sida, inglidande från höger som i Shopify och Zoho. */}
      {detail && (() => {
        const history = movements.filter(m => m.articleId === detail.articleId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const points = stockHistory(movements, detail.articleId);
        const margin = detail.salePrice > 0 ? Math.round(((detail.salePrice - detail.unitCost) / detail.salePrice) * 1000) / 10 : null;
        return (
          <div className="lg-drawer-overlay" onClick={() => setDetailId(null)}>
            <aside className="lg-drawer" onClick={e => e.stopPropagation()} aria-label={detail.description}>
              <div className="lg-drawer-head">
                <span className="lg-avatar lg" aria-hidden="true">{initial(detail.description)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 className="wsp-title" style={{ fontSize: '19px' }}>{detail.description}</h2>
                  <p className="wsp-sub">{[detail.articleNumber, methodName].filter(Boolean).join(' · ')}</p>
                </div>
                {statusPill(detail)}
                <button type="button" className="modal-close" onClick={() => setDetailId(null)} aria-label={tr('ui.stang')}><X size={18} /></button>
              </div>

              <div className="lg-drawer-body">
                <div className="ws-card-actions">
                  <button type="button" className="agi-btn primary" onClick={() => startMovement('in', detail.articleId)}><Plus size={14} /> {tr('lager.typeIn')}</button>
                  <button type="button" className="agi-btn" onClick={() => startMovement('out', detail.articleId)}>{tr('lager.typeOut')}</button>
                  <button type="button" className="agi-btn" onClick={() => startMovement('count', detail.articleId)}>{tr('lager.typeCount')}</button>
                </div>

                <KpiGrid>
                  <Kpi dot={barColor(detail)} label={tr('lager.inStock')} value={`${fmtQty(detail.qty)} ${detail.unit}`} sub={detail.min ? tr('lager.minShort', { n: fmtQty(detail.min) }) : tr('lager.noMin')} />
                  <Kpi dot={palette.profit} label={tr('ui.varde')} value={fmtKr(detail.bookValue)} sub={tr('lager.costEach', { price: fmt(detail.unitCost) })} />
                  <Kpi dot={palette.income} label={tr('lager.salePrice')} value={`${fmt(detail.salePrice)} kr`} sub={margin != null ? tr('lager.marginIs', { n: String(margin).replace('.', ',') }) : '—'} />
                </KpiGrid>

                {points.length >= 2 && (
                  <div className="lg-chart">
                    <div className="lg-chart-head"><span>{tr('lager.stockOverTime')}</span><span>{formatShort(points[0].date)} – {formatShort(points[points.length - 1].date)}</span></div>
                    <Sparkline points={points} color={palette.income} min={detail.min} />
                  </div>
                )}

                <div className="lg-min">
                  <div>
                    <label className="ws-label" htmlFor="lg-min">{tr('lager.reorderPoint')}</label>
                    <p className="ws-hint">{tr('lager.reorderHint')}</p>
                  </div>
                  <div className="ws-input-suffix" style={{ width: '120px', flexShrink: 0 }}>
                    <input id="lg-min" type="number" min="0" className="ws-input" placeholder="0" value={detail.min || ''} onChange={e => setReorderPoint(detail.articleId, e.target.value)} />
                    <span>{detail.unit}</span>
                  </div>
                </div>

                <div className="ws-card">
                  <div className="ws-card-head">
                    <div>
                      <h3 className="ws-card-title" style={{ fontSize: '14.5px' }}>{tr('lager.batches')}</h3>
                      <p className="ws-card-sub">{settings.method === 'fifo' ? tr('lager.batchesFifo') : tr('lager.batchesAvg', { price: fmt(detail.unitCost) })}</p>
                    </div>
                  </div>
                  {detail.layers.length === 0 ? <div className="ws-rows-empty">{tr('lager.noBatches')}</div> : (
                    <ul className="ws-rows">
                      {detail.layers.map((l, i) => (
                        <li key={`${l.date}-${i}`}>
                          <span className="date">{formatShort(l.date) || '—'}</span>
                          <span className="grow">{fmtQty(l.qty)} {detail.unit} × {fmt(l.cost)} kr{i === 0 && settings.method === 'fifo' && detail.layers.length > 1 ? <span className="muted"> · {tr('lager.sellsFirst')}</span> : null}</span>
                          <span className="num">{fmtKr(l.qty * l.cost)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="ws-card">
                  <div className="ws-card-head"><h3 className="ws-card-title" style={{ fontSize: '14.5px' }}>{tr('lager.history')}</h3><span className="ws-hint">{history.length}</span></div>
                  {history.length === 0 ? <div className="ws-rows-empty">{tr('lager.noHistory')}</div> : (
                    <ul className="ws-rows">
                      {history.map(m => (
                        <li key={m.id}>
                          <span className="date">{formatShort(m.date)}</span>
                          <span className="grow">
                            {movementLabel(m)}
                            {m.source === 'invoice' && m.invoiceNumber ? <span className="muted"> · {tr('ui.faktura', { invoiceNumber: m.invoiceNumber })}</span> : null}
                            {m.note ? <span className="muted"> · {m.note}</span> : null}
                          </span>
                          <span className="num" style={{ color: m.type === 'out' ? 'var(--status-red-text)' : m.type === 'in' ? 'var(--status-green-text)' : 'var(--text-main)' }}>
                            {m.type === 'out' ? '−' : m.type === 'count' ? '= ' : '+'}{fmtQty(m.qty)}
                          </span>
                          {m.type === 'in' && m.source !== 'invoice' && <span className="muted" style={{ width: '82px', textAlign: 'right' }}>{fmt(m.unitCost)} kr</span>}
                          {m.source === 'invoice'
                            ? <span className="muted">{tr('ui.automatiskt')}</span>
                            : <button type="button" className="ws-icon-btn" title={tr('ui.ta_bort')} onClick={() => removeMovement(m)}><Trash2 size={14} /></button>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </aside>
          </div>
        );
      })()}

      {/* Lagerhändelse: tre typer som flikar, orsak vid uttag. */}
      {form && (
        <div className="modal-overlay" style={{ zIndex: 1300 }} onClick={() => setForm(null)}>
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
              {form.type === 'out' && (
                <div>
                  <label className="ws-label">{tr('lager.reason')}</label>
                  <select className="ws-input" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}>
                    {OUT_REASONS.map(r => <option key={r} value={r}>{tr(`lager.reason_${r}`)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="ws-label">{tr('lager.note')}</label>
                <input className="ws-input" value={form.note} placeholder={tr('lager.notePlaceholder')} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
              </div>
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
    </>
  );
}
