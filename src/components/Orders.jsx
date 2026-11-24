import React, { useEffect, useMemo, useState } from 'react';
import { Plus, X, Trash2, Download, Truck, Check, Search, FileText, ClipboardList, ChevronLeft, ChevronRight } from './icons';
import { Panel } from './shared/Workspace';
import ChipFilter from './shared/ChipFilter';
import ArticleCombobox from './shared/ArticleCombobox';
import { confirmDialog } from './shared/ConfirmDialog';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { valuateInventory, deriveInvoiceMovements } from '../utils/inventory';
import {
  num, nextOrderNumber, orderStatus, orderEditable, orderTotals, rowNet, reservedByArticle,
  rowLeftToDeliver, rowLeftToInvoice, deliverOrder, invoiceFromOrder,
} from '../utils/salesOrders';
import { downloadSalesOrderPdf } from '../utils/salesOrderPdf';
import './workspace.css';

// Order (2026-11-24, admin; senare bara Handel-planen). En lista med det som
// ska levereras och faktureras, och en orderruta där man levererar (helt
// eller delvis, resten blir restorder) och fakturerar. Leveransen drar
// lagret; fakturan från ordern drar det inte igen (inventory.js).
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0))} kr`;
const fmtQty = (v) => numberFormat('sv-SE', { maximumFractionDigits: 2 }).format(Number(v) || 0);
const todayIso = () => new Date().toISOString().slice(0, 10);
const newId = () => `so_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const formatShort = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }); };
const emptyRow = () => ({ key: newId(), articleId: '', articleNumber: '', description: '', qty: 1, unit: 'st', unitPrice: '', vatRate: 25, discount: 0, account: '3001', delivered: 0, invoiced: 0 });
const STATUS_PILL = { open: 'info', partial: 'warn', delivered: 'ok', invoiced: 'neutral', cancelled: 'late' };
const PAGE = 50;

export default function Orders({ company, setCompanyInfo, articles = [], contacts = [], invoices = [], onCreateContact, onCreateInvoice, onOpenInvoice, onOpenQuote, globalAction, clearGlobalAction }) {
  const orders = useMemo(() => company?.salesOrders || [], [company?.salesOrders]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('active');
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState(null); // ordern som visas i rutan
  const [message, setMessage] = useState('');

  // Lagersaldo per vara (samma beräkning som Lager-fliken).
  const stock = useMemo(() => {
    const settings = { method: 'avg', ...(company?.inventorySettings || {}) };
    const manual = company?.stockMovements || [];
    const fromInvoices = settings.stockFromInvoices ? deriveInvoiceMovements({ invoices, articles, movements: manual, since: settings.stockFromInvoicesSince || null }) : [];
    const movements = [...manual, ...fromInvoices];
    const tracked = new Set(movements.map(m => m.articleId));
    const qty = new Map();
    if (movements.length) valuateInventory({ articles, movements, method: settings.method }).lines.forEach(l => qty.set(l.articleId, l.qty));
    return { qty, tracked, reorder: settings.reorderPoints || {} };
  }, [company?.inventorySettings, company?.stockMovements, invoices, articles]);
  const articleById = useMemo(() => new Map(articles.map(a => [a.id, a])), [articles]);
  const isStocked = (id) => articleById.get(id)?.type === 'vara' && (stock.tracked.has(id) || Number(stock.reorder[id]) > 0);

  useEffect(() => {
    if (globalAction?.type === 'open_order') {
      const o = orders.find(x => x.id === globalAction.payload?.id);
      if (o) setOpen(o);
      clearGlobalAction?.();
    } else if (globalAction?.type === 'new_order') {
      startNew();
      clearGlobalAction?.();
    }
  }, [globalAction]); // eslint-disable-line react-hooks/exhaustive-deps

  const startNew = () => setOpen({ id: newId(), number: nextOrderNumber(orders), date: todayIso(), deliveryDate: '', customerId: '', customerName: '', ourRef: '', theirRef: '', note: '', rows: [emptyRow()], isNew: true });

  const saveOrder = (order, movements = []) => {
    const { isNew, ...rest } = order;
    let clean = rest;
    // En ny kund som bara skrivits in läggs till i Kunder, så att fakturan har en kund.
    if (!clean.customerId && String(clean.customerName || '').trim() && onCreateContact) {
      const existing = contacts.find(c => String(c.name || '').trim().toLowerCase() === clean.customerName.trim().toLowerCase());
      const customerId = existing?.id || onCreateContact({ name: clean.customerName.trim(), email: clean.customerEmail || '', orgNr: clean.customerOrgNr || '' });
      clean = { ...clean, customerId };
    }
    setCompanyInfo(prev => {
      const list = prev.salesOrders || [];
      const salesOrders = list.some(x => x.id === clean.id) ? list.map(x => (x.id === clean.id ? clean : x)) : [...list, clean];
      return { ...prev, salesOrders, ...(movements.length ? { stockMovements: [...(prev.stockMovements || []), ...movements] } : {}) };
    });
    return clean;
  };
  const deleteOrder = (order) => setCompanyInfo(prev => ({ ...prev, salesOrders: (prev.salesOrders || []).filter(x => x.id !== order.id) }));

  const GROUP = { active: ['open', 'partial', 'delivered'], deliver: ['open', 'partial'], invoice: ['delivered', 'partial'], invoiced: ['invoiced'], all: null };
  const inGroup = (o, k) => {
    const st = orderStatus(o);
    if (k === 'invoice') return (o.rows || []).some(r => rowLeftToInvoice(r) > 0) && st !== 'cancelled';
    return !GROUP[k] || GROUP[k].includes(st);
  };
  const count = (k) => orders.filter(o => inGroup(o, k)).length;
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return orders
      .filter(o => inGroup(o, filter))
      .filter(o => !s || `${o.number} ${o.customerName} ${(o.rows || []).map(r => `${r.articleNumber} ${r.description}`).join(' ')}`.toLowerCase().includes(s))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.number) - Number(a.number));
  }, [orders, q, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);

  const toDeliver = orders.filter(o => ['open', 'partial'].includes(orderStatus(o))).length;
  const toInvoiceValue = orders.filter(o => !o.cancelled).reduce((s, o) => s + (o.rows || []).reduce((ss, r) => ss + rowLeftToInvoice(r) * num(r.unitPrice) * (1 - num(r.discount) / 100), 0), 0);
  const openValue = orders.filter(o => ['open', 'partial', 'delivered'].includes(orderStatus(o))).reduce((s, o) => s + orderTotals(o).net, 0);
  const lateCount = orders.filter(o => ['open', 'partial'].includes(orderStatus(o)) && o.deliveryDate && o.deliveryDate < todayIso()).length;

  return (
    <div className="ws-page ws-edge">
      <Panel title={t('so.title')} sub={orders.length === 0 ? t('so.subEmpty') : toDeliver > 0 ? t('so.subToDeliver', { n: toDeliver }) : t('so.subAllDone')}
        actions={<button type="button" className="agi-btn primary" onClick={startNew}><Plus size={14} /> {t('so.new')}</button>}>
        {orders.length > 0 && (
          <div className="lg-kpis lg-kpis--plain so-kpis">
            <button type="button" className={`lg-kpi is-low${filter === 'deliver' ? ' on' : ''}${toDeliver ? '' : ' is-zero'}`} onClick={() => { setFilter(filter === 'deliver' ? 'active' : 'deliver'); setPage(0); }}>
              <span className="lg-kpi-label">{lateCount ? t('so.kpiDeliverLate', { n: lateCount }) : t('so.kpiDeliver')}</span>
              <strong className="lg-kpi-val">{toDeliver}</strong>
            </button>
            <button type="button" className={`lg-kpi is-value${filter === 'invoice' ? ' on' : ''}${toInvoiceValue > 0 ? '' : ' is-zero'}`} onClick={() => { setFilter(filter === 'invoice' ? 'active' : 'invoice'); setPage(0); }}>
              <span className="lg-kpi-label">{t('so.kpiInvoice')}</span>
              <strong className="lg-kpi-val">{fmtKr(toInvoiceValue)}</strong>
            </button>
            <div className="lg-kpi is-ok">
              <span className="lg-kpi-label">{t('so.kpiOpen')}</span>
              <strong className="lg-kpi-val">{fmtKr(openValue)}</strong>
            </div>
          </div>
        )}
        {message && <p className="ws-hint" style={{ marginTop: '12px', color: 'var(--status-green-text)' }}>{message}</p>}
      </Panel>

      <Panel>
        {orders.length === 0 ? (
          <div className="po-empty">
            <span className="po-empty-ic" aria-hidden="true"><ClipboardList size={22} /></span>
            <strong>{t('so.emptyTitle')}</strong>
            <p>{t('so.emptyText')}</p>
            <button type="button" className="agi-btn primary" onClick={startNew}><Plus size={14} /> {t('so.new')}</button>
          </div>
        ) : (
          <>
            <div className="ws-listbar so-listbar" style={{ marginTop: 0 }}>
              <div className="lg-listtools is-wide">
                <div className="lg-search">
                  <Search size={14} aria-hidden="true" />
                  <input type="text" className="ws-input" placeholder={t('so.search')} value={q} onChange={e => { setQ(e.target.value); setPage(0); }} />
                </div>
                <ChipFilter label={t('artReg.filter')} value={filter} onChange={(id) => { setFilter(id); setPage(0); }}
                  items={[['active', t('so.fActive'), count('active')], ['deliver', t('so.fDeliver'), count('deliver'), 'low'], ['invoice', t('so.fInvoice'), count('invoice')], ['invoiced', t('so.fInvoiced'), count('invoiced')], ['all', t('accr.filterAll'), count('all')]]} />
              </div>
            </div>
            {rows.length === 0 ? <p className="ws-hint" style={{ padding: '16px 0' }}>{t('so.noneHere')}</p> : (
              <div className="lg-tbl po-tbl">
                <div className="ar-table-wrap">
                  <table className="ar-table">
                    <thead>
                      <tr>
                        <th className="po-w-nr">{t('so.colNumber')}</th>
                        <th>{t('so.colCustomer')}</th>
                        <th className="po-w-date ar-hide-md">{t('so.colDate')}</th>
                        <th className="po-w-date">{t('so.colDelivery')}</th>
                        <th className="po-w-prog ar-hide-md">{t('so.colDelivered')}</th>
                        <th className="r ar-w-value">{t('so.colAmount')}</th>
                        <th className="r po-w-status" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(current * PAGE, current * PAGE + PAGE).map(o => {
                        const st = orderStatus(o);
                        const real = (o.rows || []).filter(r => num(r.qty) > 0);
                        const all = real.reduce((s, r) => s + num(r.qty), 0);
                        const got = real.reduce((s, r) => s + num(r.delivered), 0);
                        const late = ['open', 'partial'].includes(st) && o.deliveryDate && o.deliveryDate < todayIso();
                        const short = ['open', 'partial'].includes(st) && real.some(r => r.articleId && isStocked(r.articleId) && rowLeftToDeliver(r) > (stock.qty.get(r.articleId) || 0));
                        return (
                          <tr key={o.id} className={`po-row is-${st}`} onClick={() => setOpen(o)}>
                            <td className="po-nr">{o.number}</td>
                            <td className="ar-name">
                              <strong>{o.customerName || t('so.noCustomer')}</strong>
                              <small>{[real.length === 1 ? t('so.rowsOne') : t('so.rowsMany', { n: real.length }), short ? t('so.shortShort') : null, o.quoteNumber ? t('so.fromQuote', { n: o.quoteNumber }) : null].filter(Boolean).join(' · ')}</small>
                            </td>
                            <td className="ar-hide-md ar-muted">{formatShort(o.date)}</td>
                            <td className={late ? 'po-late' : 'ar-muted'}>{o.deliveryDate ? formatShort(o.deliveryDate) : '–'}</td>
                            <td className="ar-hide-md">{st === 'cancelled' || all === 0 ? <span className="ar-muted">–</span> : (
                              <span className="po-prog"><span className="pz-m-track"><span style={{ width: `${Math.round((got / all) * 100)}%`, background: 'var(--status-green-text)' }} /></span><small>{t('po.progress', { got: fmtQty(got), all: fmtQty(all) })}</small></span>
                            )}</td>
                            <td className="r ar-price">{fmtKr(orderTotals(o).net)}</td>
                            <td className="r"><span className={`agi-pill ${STATUS_PILL[st]}`}>{t(`so.status_${st}`)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {rows.length > PAGE && (
                  <div className="ar-foot">
                    <span>{t('artReg.showing', { from: current * PAGE + 1, to: Math.min(rows.length, (current + 1) * PAGE), n: rows.length })}</span>
                    <span className="ar-pager">
                      <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t('artReg.prev')}><ChevronLeft size={16} /></button>
                      <span>{current + 1} / {pages}</span>
                      <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t('artReg.next')}><ChevronRight size={16} /></button>
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </Panel>

      {open && (
        <OrderModal
          key={open.id}
          initial={open}
          company={company}
          articles={articles}
          contacts={contacts}
          stockQty={stock.qty}
          reservedElsewhere={reservedByArticle(orders, open.id)}
          isStocked={isStocked}
          lockedFor={(date) => lockedPeriodFor(date, company?.lockedFiscalYears)}
          onSave={(o, movements) => saveOrder(o, movements)}
          onDelete={(o) => { deleteOrder(o); setMessage(t('so.deleted', { n: o.number })); }}
          onInvoice={(o) => {
            const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const { rows: invRows, order: next } = invoiceFromOrder(o, invoiceId);
            if (!invRows.length) return false;
            const saved = saveOrder(next);
            onCreateInvoice?.({ id: invoiceId, order: saved, rows: invRows });
            return true;
          }}
          onOpenInvoice={onOpenInvoice}
          onOpenQuote={onOpenQuote}
          onMessage={setMessage}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

function OrderModal({ initial, company, articles, contacts, stockQty, reservedElsewhere, isStocked, lockedFor, onSave, onDelete, onInvoice, onOpenInvoice, onOpenQuote, onMessage, onClose }) {
  const [o, setO] = useState(initial);
  const [mode, setMode] = useState('view'); // 'view' | 'deliver'
  const [deliverDate, setDeliverDate] = useState(todayIso());
  const [amounts, setAmounts] = useState({});
  const [error, setError] = useState('');
  const status = orderStatus(o);
  const editable = orderEditable(o);
  const byId = useMemo(() => new Map(articles.map(a => [a.id, a])), [articles]);
  const available = (id) => (stockQty.get(id) || 0) - (reservedElsewhere.get(id) || 0);
  const lines = (o.rows || []).filter(r => r.articleId || r.description || r.query);
  const totals = orderTotals({ rows: lines });
  const leftToDeliver = lines.some(r => rowLeftToDeliver(r) > 0);
  const leftToInvoice = lines.some(r => rowLeftToInvoice(r) > 0);

  const setRow = (key, patch) => setO(p => ({ ...p, rows: p.rows.map(r => (r.key === key ? { ...r, ...patch } : r)) }));
  const pickArticle = (key, a) => setRow(key, {
    articleId: a.id, articleNumber: a.articleNumber || '', description: a.description || '', unit: a.unit || 'st',
    unitPrice: a.unitPrice ?? '', vatRate: Number(a.vatRate ?? 25), account: a.account || '3001', query: undefined,
  });
  const pickCustomer = (name) => {
    const c = contacts.find(x => String(x.name || '').trim().toLowerCase() === String(name).trim().toLowerCase());
    setO(p => ({ ...p, customerName: name, customerId: c?.id || '', customerEmail: c?.email || p.customerEmail || '', customerOrgNr: c?.orgNr || c?.orgNumber || p.customerOrgNr || '', customerAddress: c ? [c.address, [c.postalCode || c.zip, c.city].filter(Boolean).join(' ')].filter(Boolean).join('\n') : p.customerAddress }));
  };

  const validate = () => {
    if (!String(o.customerName || '').trim()) return t('so.errCustomer');
    if (lines.length === 0) return t('so.errRows');
    if (lines.some(r => !String(r.description || r.query || '').trim() || !(num(r.qty) > 0))) return t('so.errRow');
    return '';
  };
  const clean = (p) => ({
    ...p, customerName: String(p.customerName || '').trim(),
    rows: lines.map(({ query, ...r }) => ({ ...r, description: r.description || query || '', qty: num(r.qty), unitPrice: num(r.unitPrice), vatRate: num(r.vatRate), discount: num(r.discount), delivered: num(r.delivered), invoiced: num(r.invoiced) })),
  });

  const save = (close = true) => {
    const e = validate(); if (e) { setError(e); return null; }
    const saved = onSave(clean(o));
    setO(saved);
    if (close) { onMessage(t('so.saved', { n: saved.number })); onClose(); }
    return saved;
  };

  // Leverera: förifyllt med det som finns ledigt, resten blir restorder.
  const startDeliver = () => {
    const e = validate(); if (e) return setError(e);
    setAmounts(Object.fromEntries(lines.map(r => {
      const left = rowLeftToDeliver(r);
      const cap = r.articleId && isStocked(r.articleId) ? Math.max(0, Math.min(left, available(r.articleId) + 0)) : left;
      return [r.key, String(cap)];
    })));
    setError('');
    setMode('deliver');
  };
  const confirmDeliver = (thenInvoice = false) => {
    if (lockedFor(deliverDate)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(deliverDate) }));
    const base = clean(o);
    const res = deliverOrder(base, { date: deliverDate, amounts: Object.fromEntries(Object.entries(amounts).map(([k, v]) => [k, num(v)])), newId, isStocked });
    if (!res.delivered) return setError(t('so.errDeliver'));
    const saved = onSave(res.order, res.movements);
    setO(saved);
    setMode('view');
    setError('');
    const rest = orderStatus(saved) === 'partial';
    if (thenInvoice) { if (onInvoice(saved)) { onClose(); return; } }
    onMessage(rest ? t('so.deliveredPart', { n: saved.number }) : t('so.deliveredAll', { n: saved.number }));
  };
  // Leverera och fakturera i ett steg när allt finns i lager, annars
  // leveransrutan med det som finns.
  const deliverAndInvoice = () => {
    const e = validate(); if (e) return setError(e);
    const short = lines.some(r => r.articleId && isStocked(r.articleId) && rowLeftToDeliver(r) > available(r.articleId));
    if (short) { startDeliver(); setError(t('so.shortInfo')); return; }
    if (lockedFor(deliverDate)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(deliverDate) }));
    const res = deliverOrder(clean(o), { date: todayIso(), newId, isStocked });
    const saved = onSave(res.order, res.movements);
    if (onInvoice(saved)) onClose();
  };
  const invoiceNow = () => { const saved = save(false); if (saved && onInvoice(saved)) onClose(); };

  const step = status === 'invoiced' ? 3 : status === 'delivered' ? 2 : status === 'partial' ? 1 : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content po-modal so-modal" style={{ maxWidth: '900px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{t('so.orderN', { n: o.number })}{o.customerName ? ` · ${o.customerName}` : ''}</h2>
            <p className="wsp-sub">
              {!o.isNew && <span className={`agi-pill ${STATUS_PILL[status]}`}>{t(`so.status_${status}`)}</span>}
              {o.quoteNumber && onOpenQuote && <button type="button" className="so-link" onClick={() => onOpenQuote(o.quoteId)}>{t('so.fromQuote', { n: o.quoteNumber })}</button>}
            </p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        {status !== 'cancelled' && (
          <ol className="po-track">
            {[t('so.step1'), t('so.step2'), t('so.step3')].map((label, i) => {
              const done = i === 0 ? !o.isNew : i === 1 ? step >= 2 : step >= 3;
              const now = !done && (i === 0 ? o.isNew : i === 1 ? !o.isNew && step < 2 : step === 2);
              return <li key={label} className={done ? 'done' : now ? 'now' : ''}><b>{done ? <Check size={12} /> : i + 1}</b>{label}</li>;
            })}
          </ol>
        )}

        <div className="po-meta so-meta">
          <div className="po-field po-supplier">
            <label className="ws-label" htmlFor="so-cust">{t('so.customer')}</label>
            {editable ? <>
              <input id="so-cust" className="ws-input" list="so-customers" value={o.customerName || ''} onChange={e => pickCustomer(e.target.value)} placeholder={t('so.customerPh')} autoFocus={o.isNew} />
              <datalist id="so-customers">{contacts.filter(c => c.name).map(c => <option key={c.id} value={c.name} />)}</datalist>
            </> : <div className="po-static">{o.customerName}</div>}
          </div>
          <div className="po-field">
            <label className="ws-label" htmlFor="so-date">{t('so.colDate')}</label>
            {editable ? <input id="so-date" type="date" className="ws-input" value={o.date} onChange={e => setO(p => ({ ...p, date: e.target.value }))} /> : <div className="po-static">{o.date}</div>}
          </div>
          <div className="po-field">
            <label className="ws-label" htmlFor="so-del">{t('so.deliveryDate')}</label>
            {status === 'invoiced' || status === 'cancelled' ? <div className="po-static">{o.deliveryDate || '–'}</div>
              : <input id="so-del" type="date" className="ws-input" value={o.deliveryDate || ''} onChange={e => { const v = e.target.value; setO(p => ({ ...p, deliveryDate: v })); if (!editable) onSave({ ...o, deliveryDate: v }); }} />}
          </div>
          {editable && (
            <div className="po-field">
              <label className="ws-label" htmlFor="so-ref">{t('so.theirRef')}</label>
              <input id="so-ref" className="ws-input" value={o.theirRef || ''} onChange={e => setO(p => ({ ...p, theirRef: e.target.value }))} placeholder={t('so.theirRefPh')} />
            </div>
          )}
        </div>

        <div className="lg-dl-rows po-rows">
          {editable && mode === 'view' ? (
            <>
              <div className="lg-dl-row head so-edit" aria-hidden="true">
                <span>{t('so.colItem')}</span><span className="r">{t('lager.colQty')}</span><span className="r">{t('so.colPrice')}</span><span className="r">{t('ui.moms')}</span><span className="r">{t('lager.colSum')}</span><span />
              </div>
              {o.rows.map(r => {
                const a = byId.get(r.articleId);
                const stocked = r.articleId && isStocked(r.articleId);
                const free = stocked ? available(r.articleId) : null;
                return (
                  <div key={r.key} className="lg-dl-row so-edit">
                    <div className="so-item">
                      <ArticleCombobox articles={articles} className="ws-input" placeholder={t('so.searchItem')}
                        value={r.query ?? (r.articleId || r.description ? `${r.articleNumber ? `${r.articleNumber} · ` : ''}${r.description}` : '')}
                        inputProps={{ 'aria-label': t('so.colItem') }}
                        onChange={v => setO(p => ({ ...p, rows: p.rows.map(x => (x.key === r.key ? { ...x, query: v, articleId: '', articleNumber: '', description: v } : x)) }))}
                        onPick={art => pickArticle(r.key, art)} />
                      {stocked && <small className={num(r.qty) > free ? 'so-short' : ''}>{num(r.qty) > free ? t('so.shortRow', { free: fmtQty(Math.max(0, free)), unit: r.unit || a?.unit || 'st' }) : t('so.freeRow', { free: fmtQty(free), unit: r.unit || a?.unit || 'st' })}</small>}
                    </div>
                    <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" value={r.qty} onChange={e => setRow(r.key, { qty: e.target.value })} aria-label={t('lager.colQty')} /><span>{r.unit || 'st'}</span></div>
                    <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder="0" value={r.unitPrice} onChange={e => setRow(r.key, { unitPrice: e.target.value })} aria-label={t('so.colPrice')} /><span>kr</span></div>
                    <select className="ws-input" value={r.vatRate} onChange={e => setRow(r.key, { vatRate: Number(e.target.value) })} aria-label={t('ui.moms')}>
                      {[25, 12, 6, 0].map(v => <option key={v} value={v}>{v} %</option>)}
                    </select>
                    <span className="r lg-dl-sum">{num(r.qty) > 0 && num(r.unitPrice) ? fmtKr(rowNet(r)) : ''}</span>
                    <button type="button" className="ws-icon-btn" aria-label={t('ui.ta_bort')} onClick={() => setO(p => ({ ...p, rows: p.rows.length > 1 ? p.rows.filter(x => x.key !== r.key) : [emptyRow()] }))}><Trash2 size={14} /></button>
                  </div>
                );
              })}
            </>
          ) : (
            <>
              <div className="lg-dl-row head so-track-row" aria-hidden="true">
                <span>{t('so.colItem')}</span><span className="r">{t('so.ordered')}</span><span className="r">{t('so.delivered')}</span>
                <span className="r">{mode === 'deliver' ? t('so.deliverNow') : t('so.invoicedCol')}</span><span className="r">{t('lager.colSum')}</span>
              </div>
              {lines.map(r => {
                const left = rowLeftToDeliver(r);
                const stocked = r.articleId && isStocked(r.articleId);
                return (
                  <div key={r.key} className="lg-dl-row so-track-row">
                    <span className="lg-move-name" style={{ cursor: 'default' }}>
                      <strong>{r.description}</strong>
                      <small>{[r.articleNumber, `${fmt(r.unitPrice)} kr/${r.unit || 'st'}`, mode === 'deliver' && stocked ? t('so.freeRow', { free: fmtQty(available(r.articleId)), unit: r.unit || 'st' }) : null, left > 0 && mode !== 'deliver' && !editable ? t('so.backorder', { n: fmtQty(left), unit: r.unit || 'st' }) : null].filter(Boolean).join(' · ')}</small>
                    </span>
                    <span className="r">{fmtQty(r.qty)} {r.unit || 'st'}</span>
                    <span className={`r${left === 0 ? ' po-done' : ''}`}>{left === 0 ? <><Check size={13} /> {fmtQty(r.delivered)}</> : fmtQty(r.delivered)}</span>
                    {mode === 'deliver'
                      ? (left > 0 ? <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" value={amounts[r.key] ?? ''} onChange={e => setAmounts(v => ({ ...v, [r.key]: e.target.value }))} aria-label={`${t('so.deliverNow')} ${r.description}`} /><span>{r.unit || 'st'}</span></div> : <span />)
                      : <span className="r ar-muted">{fmtQty(r.invoiced)}</span>}
                    <span className="r lg-dl-sum">{fmtKr(rowNet(r))}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <div className="lg-dl-foot">
          {editable && mode === 'view' ? <button type="button" className="agi-btn" onClick={() => setO(p => ({ ...p, rows: [...p.rows, emptyRow()] }))}><Plus size={14} /> {t('lager.addRow')}</button> : <span />}
          <span className="so-totals">{t('so.net')} <b>{fmtKr(totals.net)}</b><em>{t('so.vatAmount', { kr: fmtKr(totals.vat) })}</em></span>
        </div>

        {editable && mode === 'view' && (
          <div style={{ marginTop: '12px' }}>
            <label className="ws-label" htmlFor="so-note">{t('so.note')}</label>
            <input id="so-note" className="ws-input" value={o.note || ''} onChange={e => setO(p => ({ ...p, note: e.target.value }))} placeholder={t('so.notePh')} />
          </div>
        )}
        {mode === 'deliver' && (
          <div className="po-recv-bar">
            <label className="ws-label" htmlFor="so-dd" style={{ margin: 0 }}>{t('so.deliverDate')}</label>
            <input id="so-dd" type="date" className="ws-input" style={{ width: 'auto' }} value={deliverDate} onChange={e => setDeliverDate(e.target.value)} />
          </div>
        )}
        {(o.invoiceIds || []).length > 0 && onOpenInvoice && (
          <p className="so-invoices">{t('so.invoicesLabel')} {(o.invoiceIds || []).map((id, i) => <button key={id} type="button" className="so-link" onClick={() => { onClose(); onOpenInvoice(id); }}>{t('so.invoiceN', { n: i + 1 })}</button>)}</p>
        )}
        {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)', marginTop: '8px' }}>{error}</p>}

        <div className="modal-footer po-foot">
          {mode === 'deliver' ? <>
            <button type="button" className="agi-btn" onClick={() => { setMode('view'); setError(''); }}>{t('ui.avbryt')}</button>
            <span style={{ flex: 1 }} />
            <button type="button" className="agi-btn" onClick={() => confirmDeliver(false)}><Truck size={14} /> {t('so.confirmDeliver')}</button>
            <button type="button" className="agi-btn primary" onClick={() => confirmDeliver(true)}><FileText size={14} /> {t('so.confirmDeliverInvoice')}</button>
          </> : <>
            {editable && !o.isNew && <button type="button" className="agi-btn po-danger" onClick={async () => { if (await confirmDialog(t('so.deleteConfirm', { n: o.number }))) { onDelete(o); onClose(); } }}>{t('so.delete')}</button>}
            {!editable && (status === 'open' || status === 'partial') && <button type="button" className="agi-btn po-danger" onClick={async () => { if (await confirmDialog(t('so.cancelConfirm', { n: o.number }))) { onSave({ ...o, cancelled: true }); onClose(); } }}>{t('so.cancel')}</button>}
            <span style={{ flex: 1 }} />
            {status !== 'cancelled' && <button type="button" className="agi-btn" onClick={() => { const e = validate(); if (e) return setError(e); downloadSalesOrderPdf({ company, order: clean(o), kind: 'confirmation' }); }}><Download size={14} /> {t('so.pdfConfirm')}</button>}
            {(o.deliveries || []).length > 0 && <button type="button" className="agi-btn" onClick={() => downloadSalesOrderPdf({ company, order: o, kind: 'delivery' })}><Download size={14} /> {t('so.pdfDelivery')}</button>}
            {editable && <button type="button" className="agi-btn" onClick={() => save(true)}>{o.isNew ? t('so.saveNew') : t('so.save')}</button>}
            {status !== 'cancelled' && leftToDeliver && <button type="button" className={`agi-btn${editable ? '' : ' primary'}`} onClick={startDeliver}><Truck size={14} /> {t('so.deliver')}</button>}
            {editable && <button type="button" className="agi-btn primary" onClick={deliverAndInvoice}><Check size={14} /> {t('so.deliverAndInvoice')}</button>}
            {!editable && leftToInvoice && <button type="button" className={`agi-btn${leftToDeliver ? '' : ' primary'}`} onClick={invoiceNow}><FileText size={14} /> {leftToDeliver ? t('so.invoiceDelivered') : t('so.invoice')}</button>}
            {(status === 'invoiced' || status === 'cancelled') && <button type="button" className="agi-btn primary" onClick={onClose}>{t('lager.done')}</button>}
          </>}
        </div>
      </div>
    </div>
  );
}
