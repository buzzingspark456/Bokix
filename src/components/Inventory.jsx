import React, { useMemo, useState, useEffect } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, Minus, Trash2, X, Search, Truck, AlertTriangle, Inbox, Download, Settings2, ClipboardCheck, PackageMinus, Scale, RefreshCw, ChevronLeft, ChevronRight } from './icons';
import { confirmDialog } from './shared/ConfirmDialog';
import { Panel, Overview, TaskRow, usePalette } from './shared/Workspace';
import {
  STOCK_ACCOUNT_KINDS, valuateInventory, ledgerBalanceAt, buildInventoryVerification, deriveInvoiceMovements, findPurchaseLines,
} from '../utils/inventory';
import { downloadInventoryListPdf, downloadInventoryListCsv } from '../utils/inventoryListPdf';
import { reservedByArticle } from '../utils/salesOrders';
import { nextPoNumber, poStatus, poTotal, onOrderByArticle, receivePo, matchPurchaseOrder, rowRemaining } from '../utils/purchaseOrders';
import PurchaseOrderModal, { PO_STATUS_PILL } from './PurchaseOrderModal';
import ChipFilter from './shared/ChipFilter';
import { t as tr } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(v || 0))} kr`;
const fmtQty = (v) => numberFormat('sv-SE', { maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mv_${Date.now()}_${Math.random().toString(36).slice(2)}`);
// Klara färger för staplar och prickar (statusfärgernas textvarianter blir bruna i ljust läge).
const AMBER = '#f0a830';
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
      {min > 0 && <line x1="0" x2={w} y1={h - (min / max) * (h - 4) - 2} y2={h - (min / max) * (h - 4) - 2} style={{ stroke: AMBER, strokeDasharray: '3 3', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }} />}
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
export default function Inventory({ articles = [], invoices = [], expenses = [], company, verifications = [], onAddVerification, setCompanyInfo, onAddArticle }) {
  const manualMovements = useMemo(() => company?.stockMovements || [], [company?.stockMovements]);
  const settings = { method: 'avg', accountKind: 'handelsvaror', lowestValue: true, stockFromInvoices: false, stockFromInvoicesSince: '', reorderPoints: {}, ...(company?.inventorySettings || {}) };
  // Lagerutgångar ur fakturor räknas fram här och sparas aldrig, så en ändrad
  // eller raderad faktura ger rätt saldo direkt (se deriveInvoiceMovements).
  const invoiceMovements = useMemo(
    () => (settings.stockFromInvoices ? deriveInvoiceMovements({ invoices, articles, movements: manualMovements, since: settings.stockFromInvoicesSince || null }) : []),
    [settings.stockFromInvoices, settings.stockFromInvoicesSince, invoices, articles, manualMovements],
  );
  const movements = useMemo(() => [...manualMovements, ...invoiceMovements], [manualMovements, invoiceMovements]);
  // Högsta saldot per vara i ett svep, inte alla händelser per rad (10 000 varor).
  const peakQty = useMemo(() => {
    const byArticle = new Map();
    for (const m of movements) { if (!m.articleId) continue; const l = byArticle.get(m.articleId); if (l) l.push(m); else byArticle.set(m.articleId, [m]); }
    const peaks = new Map();
    for (const [id, list] of byArticle) peaks.set(id, Math.max(0, ...stockHistory(list, id).map(p => p.qty)));
    return peaks;
  }, [movements]);
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  // Inköpsorder (utils/purchaseOrders.js), sparade på företaget.
  const purchaseOrders = useMemo(() => company?.purchaseOrders || [], [company?.purchaseOrders]);
  const onOrder = useMemo(() => onOrderByArticle(purchaseOrders), [purchaseOrders]);
  // Reserverat i öppna kundorder (salesOrders.js): räknas bort från det lediga.
  const reserved = useMemo(() => reservedByArticle(company?.salesOrders || []), [company?.salesOrders]);
  const resOf = (id) => reserved.get(id) || 0;
  const goods = articles.filter(a => a.type === 'vara' && a.id);
  const palette = usePalette(company);

  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [closingDate, setClosingDate] = useState(`${new Date().getFullYear()}-12-31`);
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [detailId, setDetailId] = useState(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchaseDraft, setPurchaseDraft] = useState({});
  const [countSheet, setCountSheet] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  // Varor, Rörelser eller Att beställa (2026-11-23).
  const [view, setView] = useState('goods');
  const [moveType, setMoveType] = useState('all');
  const [moveSearch, setMoveSearch] = useState('');
  // Inleverans med flera rader: { date, ref, rows: [{ key, articleId, qty, unitCost }] }.
  const [delivery, setDelivery] = useState(null);
  const [orderQty, setOrderQty] = useState({});
  const [poOpen, setPoOpen] = useState(null);
  const [goodsPage, setGoodsPage] = useState(0);
  const [todoOpen, setTodoOpen] = useState(false);
  const [poFilter, setPoFilter] = useState('open');
  const [poSearch, setPoSearch] = useState('');

  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDetailId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [detailId]);

  const setSetting = (patch) => setCompanyInfo(prev => ({ ...prev, inventorySettings: { ...settings, ...(prev.inventorySettings || {}), ...patch } }));
  const saveMovements = (next) => setCompanyInfo(prev => ({ ...prev, stockMovements: next }));
  const savePo = (po) => setCompanyInfo(prev => {
    const list = prev.purchaseOrders || [];
    return { ...prev, purchaseOrders: list.some(x => x.id === po.id) ? list.map(x => (x.id === po.id ? po : x)) : [...list, po] };
  });
  const deletePo = (po) => setCompanyInfo(prev => ({ ...prev, purchaseOrders: (prev.purchaseOrders || []).filter(x => x.id !== po.id) }));
  // Tar emot på en order: inleveranser och orderns mottagna antal sparas i samma ändring.
  const receiveOnPo = (po, { date, amounts, link }) => {
    if (lockedFor(date)) { setMessage(tr('ui.rakenskapsaret_ar_last', { v0: lockedFor(date) })); return; }
    const res = receivePo(po, { date, amounts, newId });
    const nextPo = link ? { ...res.po, ...link } : res.po;
    setCompanyInfo(prev => ({
      ...prev,
      stockMovements: [...(prev.stockMovements || []), ...res.movements],
      purchaseOrders: (prev.purchaseOrders || []).map(x => (x.id === po.id ? nextPo : x)),
    }));
    setMessage(res.movements.length === 1 ? tr('po.receivedMsgOne', { number: po.number }) : tr('po.receivedMsg', { number: po.number, n: res.movements.length }));
  };
  const toggleFromInvoices = (on) => setSetting({ stockFromInvoices: on, stockFromInvoicesSince: on ? (settings.stockFromInvoicesSince || todayIso()) : settings.stockFromInvoicesSince });
  const setReorderPoint = (articleId, value) => {
    const next = { ...(settings.reorderPoints || {}) };
    if (value === '' || !(Number(value) > 0)) delete next[articleId];
    else next[articleId] = Number(value);
    setSetting({ reorderPoints: next });
  };
  const articleOf = (id) => goods.find(g => g.id === id);
  const unitOf = (id) => articleOf(id)?.unit || tr('ui.st');
  const supplierOf = (id) => articleOf(id)?.supplier || '';
  const locationOf = (id) => settings.locations?.[id] ?? articleOf(id)?.location ?? '';
  const setLocation = (articleId, value) => setSetting({ locations: { ...(settings.locations || {}), [articleId]: value } });

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
    // Aldrig lagerförd (ingen händelse, ingen beställningspunkt): inte slut.
    const tracked = lineById.has(g.id) || min > 0;
    const status = !tracked ? 'none' : line.qty <= 0 ? 'out' : min > 0 && line.qty <= min ? 'low' : 'ok';
    return { ...line, min, status, salePrice: Number(g.unitPrice) || 0, unit: g.unit || tr('ui.st') };
  });
  const order = { low: 0, out: 1, ok: 2, none: 3 };
  const tracked = allRows.filter(r => r.status !== 'none');
  const q = search.trim().toLowerCase();
  const rows = allRows
    .filter(r => (filter === 'all' ? r.status !== 'none' : filter === 'instock' ? r.qty > 0 : r.status === filter))
    .filter(r => !q || r.description.toLowerCase().includes(q) || (r.articleNumber || '').toLowerCase().includes(q) || (supplierOf(r.articleId) || '').toLowerCase().includes(q) || String(locationOf(r.articleId) || '').toLowerCase().includes(q))
    .sort((a, b) => order[a.status] - order[b.status] || a.description.localeCompare(b.description, 'sv'));
  const count = (s) => allRows.filter(r => r.status === s).length;
  const lowRows = allRows.filter(r => r.status === 'low');
  const issueRows = allRows.filter(r => r.shortfall > 0);
  // Inköp av varor ur leverantörsfakturor och kvitton som inte finns i lagret
  // än: från första lagerhändelsen, eller årets början om lagret är nytt.
  const firstMovement = manualMovements.map(m => m.date).filter(Boolean).sort()[0];
  const purchasesSince = settings.purchasesSince || firstMovement || `${new Date().getFullYear()}-01-01`;
  const purchases = useMemo(
    () => (goods.length ? findPurchaseLines({ expenses, articles, movements: manualMovements, ignored: settings.ignoredPurchases || [], since: purchasesSince }) : []),
    [expenses, articles, manualMovements, settings.ignoredPurchases, purchasesSince, goods.length],
  );
  const linkedExpenses = new Set(purchaseOrders.map(po => po.matchedExpenseId).filter(Boolean));
  const visiblePurchases = purchases.filter(l => !linkedExpenses.has(l.expenseId));
  const expenseById = new Map((expenses || []).map(e => [e.id, e]));
  const matchFor = (line) => matchPurchaseOrder(purchaseOrders, expenseById.get(line.expenseId));
  const linkExpense = (line, match) => {
    const e = expenseById.get(line.expenseId);
    const label = [e?.supplier, e?.invoiceNumber || e?.receiptNumber, line.date].filter(Boolean).join(' · ');
    const link = { matchedExpenseId: line.expenseId, matchedExpenseLabel: label };
    if (poStatus(match.po) === 'received') savePo({ ...match.po, ...link });
    else receiveOnPo(match.po, { date: line.date, amounts: null, link });
  };
  // Rutan stängs när det inte finns något kvar att lägga in.
  useEffect(() => { if (purchaseOpen && visiblePurchases.length === 0) setPurchaseOpen(false); }, [purchaseOpen, visiblePurchases.length]);
  const draftFor = (line) => purchaseDraft[line.key] || { articleId: line.suggestedArticleId || '', qty: '' };
  const setDraft = (line, patch) => setPurchaseDraft(d => ({ ...d, [line.key]: { ...draftFor(line), ...patch } }));
  const receivePurchase = (line) => {
    const d = draftFor(line);
    const qty = Number(String(d.qty).replace(',', '.'));
    if (!d.articleId || !(qty > 0)) return;
    saveMovements([...manualMovements, {
      id: newId(), articleId: d.articleId, type: 'in', date: line.date, qty,
      unitCost: Math.round((line.net / qty) * 100) / 100, purchaseKey: line.key,
      note: [line.supplier, line.reference].filter(Boolean).join(' ') || undefined,
    }]);
  };
  const ignorePurchase = (line) => setSetting({ ignoredPurchases: [...(settings.ignoredPurchases || []), line.key] });

  // Inventering av alla varor på en gång: räknat antal per vara blir en
  // inventeringshändelse där det skiljer sig från saldot.
  const openCountSheet = () => setCountSheet({ date: todayIso(), counts: {} });
  const saveCountSheet = () => {
    const added = [];
    allRows.forEach(r => {
      const raw = countSheet.counts[r.articleId];
      if (raw === undefined || raw === '') return;
      const counted = Number(String(raw).replace(',', '.'));
      if (!(counted >= 0) || counted === r.qty) return;
      added.push({ id: newId(), articleId: r.articleId, type: 'count', date: countSheet.date, qty: counted, note: tr('lager.countSheetNote') });
    });
    if (added.length) saveMovements([...manualMovements, ...added]);
    setCountSheet(null);
    setMessage(added.length ? tr('lager.countSaved', { n: added.length }) : tr('lager.countNoChange'));
  };

  // Att beställa: varor på eller under beställningspunkten. Förslaget fyller
  // upp till två gånger beställningspunkten, samma som stapeln visar som fullt.
  const orderRows = allRows.filter(r => r.min > 0 && r.qty - resOf(r.articleId) + (onOrder.get(r.articleId)?.qty || 0) <= r.min).map(r => {
    const suggested = Math.max(Math.ceil(r.min * 2 - r.qty + resOf(r.articleId) - (onOrder.get(r.articleId)?.qty || 0)), 1);
    const raw = orderQty[r.articleId];
    return { ...r, supplier: supplierOf(r.articleId), suggested, orderQty: raw === undefined ? suggested : raw };
  });
  const orderGroups = [...orderRows.reduce((m, r) => {
    const k = r.supplier || '';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
    return m;
  }, new Map())].sort((a, b) => (a[0] ? 0 : 1) - (b[0] ? 0 : 1) || a[0].localeCompare(b[0], 'sv'));
  // Inleverans (återställd 2026-11-24: följde med när förslagslistan togs bort).
  const deliveryRow = (articleId = '', qty = '') => ({ key: newId(), articleId, qty, unitCost: articleId ? (articleOf(articleId)?.purchasePrice ?? '') : '' });
  const startDelivery = (prefill, ref = '') => {
    setDelivery({ date: todayIso(), ref, rows: prefill && prefill.length ? prefill : [deliveryRow(), deliveryRow()] });
    setError('');
  };
  const setDeliveryRow = (key, patch) => setDelivery(d => ({ ...d, rows: d.rows.map(x => {
    if (x.key !== key) return x;
    const next = { ...x, ...patch };
    if (patch.articleId !== undefined && patch.articleId !== x.articleId) next.unitCost = articleOf(patch.articleId)?.purchasePrice ?? '';
    return next;
  }) }));
  const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  const deliveryLines = delivery ? delivery.rows.filter(x => x.articleId || x.qty !== '') : [];
  const deliveryTotal = deliveryLines.reduce((sum, x) => sum + (num(x.qty) || 0) * (num(x.unitCost) || 0), 0);
  const saveDelivery = () => {
    if (deliveryLines.length === 0) return setError(tr('lager.deliveryEmpty'));
    const bad = deliveryLines.find(x => !x.articleId || !(num(x.qty) > 0) || !(num(x.unitCost) >= 0) || x.unitCost === '');
    if (bad) return setError(tr('lager.deliveryRowError'));
    if (lockedFor(delivery.date)) return setError(tr('ui.rakenskapsaret_ar_last', { v0: lockedFor(delivery.date) }));
    const note = delivery.ref.trim() || undefined;
    saveMovements([...manualMovements, ...deliveryLines.map(x => ({
      id: newId(), articleId: x.articleId, type: 'in', date: delivery.date, qty: num(x.qty), unitCost: num(x.unitCost), note,
    }))]);
    setMessage(deliveryLines.length === 1 ? tr('lager.deliverySavedOne') : tr('lager.deliverySaved', { n: deliveryLines.length }));
    setDelivery(null); setError('');
    if (view === 'order') setOrderQty({});
  };
  const createPo = (group, supplier) => {
    const po = {
      id: newId(), number: nextPoNumber(purchaseOrders), supplier: supplier || '', date: todayIso(), expectedDate: '',
      rows: (group && group.length ? group.filter(r => num(r.orderQty) > 0).map(r => ({ key: newId(), articleId: r.articleId, description: r.description, qty: String(r.orderQty), unitCost: r.unitCost || articleOf(r.articleId)?.purchasePrice || '', unit: r.unit, received: 0 })) : [{ key: newId(), articleId: '', qty: '', unitCost: '' }]),
    };
    setPoOpen(po);
  };
  // Beställ det som tar slut: ett utkast per leverantör, med det föreslagna antalet.
  const orderLow = () => {
    if (orderGroups.length === 1) return createPo(orderGroups[0][1], orderGroups[0][0]);
    const made = [];
    for (const [supplier, group] of orderGroups) {
      made.push({
        id: newId(), number: nextPoNumber([...purchaseOrders, ...made]), supplier: supplier || '', date: todayIso(), expectedDate: '',
        rows: group.map(r => ({ key: newId(), articleId: r.articleId, description: r.description, qty: Number(r.orderQty) || r.suggested, unitCost: Number(r.unitCost || articleOf(r.articleId)?.purchasePrice) || 0, unit: r.unit, received: 0 })),
      });
    }
    setCompanyInfo(prev => ({ ...prev, purchaseOrders: [...(prev.purchaseOrders || []), ...made] }));
    setPoFilter('draft');
    setMessage(tr('po.draftsMade', { n: made.length }));
  };
  const PO_GROUP = { open: ['draft', 'ordered', 'partial'], draft: ['draft'], ordered: ['ordered', 'partial'], done: ['received', 'cancelled'] };
  const poRows = [...purchaseOrders]
    .filter(po => poFilter === 'all' || PO_GROUP[poFilter].includes(poStatus(po)))
    .filter(po => { const q2 = poSearch.trim().toLowerCase(); return !q2 || `${po.number} ${po.supplier} ${(po.rows || []).map(x => articleOf(x.articleId)?.description || x.description).join(' ')}`.toLowerCase().includes(q2); })
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number)));
  const poCount = (k) => purchaseOrders.filter(po => k === 'all' || PO_GROUP[k].includes(poStatus(po))).length;

  // Rörelser: alla lagerhändelser, nyaste först.
  const moveRows = useMemo(() => {
    const q2 = moveSearch.trim().toLowerCase();
    const byId = new Map(goods.map(g => [g.id, g]));
    return movements
      .filter(m => moveType === 'all' || m.type === moveType)
      .map(m => ({ m, g: byId.get(m.articleId) }))
      .filter(({ m, g }) => !q2 || `${g?.description || ''} ${g?.articleNumber || ''} ${m.note || ''}`.toLowerCase().includes(q2))
      .sort((a, b) => String(b.m.date).localeCompare(String(a.m.date)) || String(b.m.id).localeCompare(String(a.m.id)));
  }, [movements, moveType, moveSearch, goods]);

  // Antal saker att göra och en kort sammanfattning till knappen.
  const showClosing = valuation.lines.length > 0 && closing && !alreadyBooked;
  const todoCount = (visiblePurchases.length > 0 ? 1 : 0) + issueRows.length + (lowRows.length > 0 ? 1 : 0) + (showClosing ? 1 : 0);
  const todoSummary = [
    lowRows.length ? (lowRows.length === 1 ? tr('lager.lowTitle', { name: lowRows[0].description }) : tr('lager.lowMany', { n: lowRows.length })) : null,
    visiblePurchases.length ? (visiblePurchases.length === 1 ? tr('lager.purchasesOne') : tr('lager.purchasesMany', { n: visiblePurchases.length })) : null,
    issueRows.length ? tr('lager.issueShort', { n: issueRows.length }) : null,
    showClosing ? tr('lager.bookValueShort') : null,
  ].filter(Boolean).join(' · ');

  const exportLines = valuation.lines.filter(l => l.qty > 0).map(l => ({ ...l, unit: goods.find(g => g.id === l.articleId)?.unit || 'st' }));
  const exportArgs = { company, date: closingDate, methodName: settings.method === 'fifo' ? 'FIFO' : tr('lager.methodAvg'), account: kind.stockAccount, lines: exportLines, total: valuation.bookValue, writeDown: valuation.writeDown };
  const inStock = allRows.filter(r => r.qty > 0);
  const totalUnits = inStock.reduce((s, r) => s + r.qty, 0);
  const detail = detailId ? allRows.find(r => r.articleId === detailId) : null;
  // Värdet per vara för fördelningsstapeln: de fyra största, resten som Övriga.
  const byValue = allRows.filter(r => r.bookValue > 0).sort((x, y) => y.bookValue - x.bookValue);
  const partColors = [palette.profit, palette.income, palette.costBar, '#a78bfa'];
  const valueParts = byValue.slice(0, 4).map((r, i) => ({ id: r.articleId, name: r.description, value: r.bookValue, color: partColors[i] }));
  if (byValue.length > 4) valueParts.push({ id: '__rest', name: tr('lager.others', { n: byValue.length - 4 }), value: byValue.slice(4).reduce((sum, r) => sum + r.bookValue, 0), color: 'var(--text-muted)' });

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
    ? <span className="agi-pill warn" title={tr('ui.fler_uttag_an_inleveranser_registrerade')}>{tr('lager.check')}</span>
    : r.status === 'out' ? <span className="agi-pill late">{tr('lager.outOfStock')}</span>
    : r.status === 'low' ? <span className="agi-pill warn">{tr('lager.low')}</span>
    : <span className="agi-pill ok">{tr('lager.inStockPill')}</span>);
  const barColor = (r) => (r.status === 'out' ? palette.loss : r.status === 'low' ? AMBER : palette.profit);
  // Stapeln: saldot mot beställningspunkten (två gånger den = full stapel).
  // Utan beställningspunkt mot det högsta saldot varan haft.
  const barPct = (r) => {
    const top = r.min > 0 ? r.min * 2 : Math.max(r.qty, peakQty.get(r.articleId) || 0, 1); // högsta saldot, räknat i ett svep (2026-11-26)
    return Math.max(0, Math.min(100, (r.qty / top) * 100));
  };
  const initial = (name) => (name || '?').trim().charAt(0).toUpperCase();

  return (
    <>

      {/* Lager som i Zoho Inventory och Shopify (2026-11-22): knapparna för
          inleverans, uttag och inventering överst, översikten med fyra
          siffror som filtrerar listan, att göra som smala rader och varorna
          i en ren lista med sök och filter. */}
      <div className="ws-page ws-edge">
        <Panel
          title={tr('ui.lager')}
          sub={tr('lager.overviewSubV2', { method: methodName, account: kind.stockAccount, date: formatShort(closingDate) })}
          actions={<>
            {goods.length > 0 && <button type="button" className="agi-btn" onClick={() => setListOpen(true)} title={tr('lager.countList')}><Download size={14} /> <span className="lg-hide-sm">{tr('lager.countList')}</span></button>}
            <button type="button" className="agi-btn" onClick={() => setShowSettings(true)} title={tr('lager.settings')} aria-label={tr('lager.settings')}><Settings2 size={15} /></button>
            {goods.length > 0 && <>
              <span className="lg-act-sep" aria-hidden="true" />
              <button type="button" className="agi-btn" onClick={openCountSheet}><ClipboardCheck size={14} /> {tr('lager.typeCount')}</button>
              <button type="button" className="agi-btn" onClick={() => startMovement('out')}><PackageMinus size={14} /> {tr('lager.typeOut')}</button>
              <button type="button" className="agi-btn primary" onClick={() => startDelivery()}><Plus size={14} /> {tr('lager.typeIn')}</button>
            </>}
          </>}
        >
          {goods.length > 0 && (
            <div className="lg-kpis lg-kpis--plain">
              <div className="lg-kpi is-value">
                <span className="lg-kpi-label">{tr('lager.stockValue')}</span>
                <strong className="lg-kpi-val">{fmtKr(valuation.bookValue)}</strong>
              </div>
              <button type="button" className={`lg-kpi is-ok${filter === 'instock' ? ' on' : ''}`} onClick={() => { setView('goods'); setFilter(filter === 'instock' ? 'all' : 'instock'); }}>
                <span className="lg-kpi-label">{tr('lager.inStockPill')}</span>
                <strong className="lg-kpi-val">{inStock.length}</strong>
              </button>
              <button type="button" className={`lg-kpi is-low${filter === 'low' ? ' on' : ''}${count('low') ? '' : ' is-zero'}`} onClick={() => { setView('goods'); setFilter(filter === 'low' ? 'all' : 'low'); }}>
                <span className="lg-kpi-label">{tr('lager.lowStock')}</span>
                <strong className="lg-kpi-val">{count('low')}</strong>
              </button>
              <button type="button" className={`lg-kpi is-out${filter === 'out' ? ' on' : ''}${count('out') ? '' : ' is-zero'}`} onClick={() => { setView('goods'); setFilter(filter === 'out' ? 'all' : 'out'); }}>
                <span className="lg-kpi-label">{tr('lager.outOfStock')}</span>
                <strong className="lg-kpi-val">{count('out')}</strong>
              </button>
            </div>
          )}

          {/* Att göra som en knapp (2026-11-24): översikten är ren, listan öppnas i en ruta. */}
          {todoCount > 0 && (
            <button type="button" className="lg-todo-btn" onClick={() => setTodoOpen(true)}>
              <span className="lg-todo-ic" aria-hidden="true"><ClipboardCheck size={17} /></span>
              <span className="lg-todo-text"><strong>{tr('lager.todo')}</strong><small>{todoSummary}</small></span>
              <span className="lg-todo-n">{todoCount}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          )}
          {todoOpen && (
            <div className="modal-overlay" onClick={() => setTodoOpen(false)}>
              <div className="modal-content" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">{tr('lager.todo')}</span>
                  <button type="button" className="modal-close" onClick={() => setTodoOpen(false)} aria-label={tr('ui.stang')}><X size={18} /></button>
                </div>
                <div className="ws-tasks lg-attn" onClickCapture={e => { const btn = e.target.closest('button'); if (btn && !btn.classList.contains('modal-close')) setTimeout(() => setTodoOpen(false), 0); }}>
              {visiblePurchases.length > 0 && (
                <TaskRow icon={Inbox} tone="brand" onClick={() => setPurchaseOpen(true)}
                  title={visiblePurchases.length === 1 ? tr('lager.purchasesOne') : tr('lager.purchasesMany', { n: visiblePurchases.length })}
                  detail={tr('lager.purchasesDetail')}>
                  <span className="agi-btn">{tr('lager.receive')}</span>
                </TaskRow>
              )}
              {issueRows.map(r => (
                <TaskRow key={`issue-${r.articleId}`} icon={AlertTriangle} onClick={() => setDetailId(r.articleId)}
                  title={tr('lager.issueTitle', { name: r.description })}
                  detail={tr('lager.issueDetail', { n: fmtQty(r.shortfall) })}>
                  <button type="button" className="agi-btn primary" onClick={() => startMovement('in', r.articleId)}>{tr('lager.addReceipt')}</button>
                </TaskRow>
              ))}
              {lowRows.length === 1 && lowRows.map(r => (
                <TaskRow key={r.articleId} icon={Truck} onClick={() => setDetailId(r.articleId)}
                  title={tr('lager.lowTitle', { name: r.description })}
                  detail={tr('lager.lowDetail', { qty: fmtQty(r.qty), min: fmtQty(r.min), unit: r.unit })}>
                  <button type="button" className="agi-btn" onClick={() => startMovement('in', r.articleId)}>{tr('lager.typeIn')}</button>
                </TaskRow>
              ))}
              {lowRows.length > 1 && (
                <TaskRow icon={Truck} onClick={() => setView('order')}
                  title={tr('lager.lowMany', { n: lowRows.length })}
                  detail={lowRows.slice(0, 3).map(r => r.description).join(', ') + (lowRows.length > 3 ? ' …' : '')}>
                  <button type="button" className="agi-btn" onClick={(e) => { e.stopPropagation(); setView('order'); }}>{tr('lager.seeOrder')}</button>
                </TaskRow>
              )}
              {valuation.lines.length > 0 && closing && !alreadyBooked && (
                <TaskRow icon={Scale} tone="brand"
                  title={tr('lager.bookValueTitle', { kr: fmtKr(Math.abs(diff)), dir: diff > 0 ? tr('lager.dirUp') : tr('lager.dirDown') })}
                  detail={tr('lager.bookValueDetail', { account: kind.stockAccount, ledger: fmtKr(ledgerBalance), stock: fmtKr(valuation.bookValue) })}>
                  <input type="date" value={closingDate} aria-label={tr('ui.vardering_per_datum')} onChange={e => e.target.value && setClosingDate(e.target.value)} />
                  <button type="button" className="agi-btn primary" onClick={bookClosing}>{tr('lager.book')}</button>
                </TaskRow>
              )}
                </div>
              </div>
            </div>
          )}
          {message && <p className="ws-hint" style={{ marginTop: '12px', color: 'var(--status-green-text)' }}>{message}</p>}
        </Panel>

        <Panel>
          {goods.length === 0 ? (
            <div className="ws-empty">
              <strong>{tr('lager.emptyTitle')}</strong>
              <p>{tr('lager.emptyTextV2')}</p>
              {onAddArticle && <button type="button" className="agi-btn primary" onClick={onAddArticle}><Plus size={14} /> {tr('lager.addGood')}</button>}
            </div>
          ) : (
            <>
              <div className="ws-listbar" style={{ marginTop: 0 }}>
                <div className="lg-views" role="tablist">
                  {[['goods', tr('lager.goods'), goods.length], ['moves', tr('lager.viewMoves'), movements.length], ['order', tr('po.tab'), poCount('open')]].map(([id, label, n]) => (
                    <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'on' : ''} onClick={() => setView(id)}>
                      {label}{n > 0 && <span className="lg-count">{n}</span>}
                    </button>
                  ))}
                </div>
                {view === 'goods' && <div className="lg-listtools">
                  {goods.length > 0 && (
                    <div className="lg-search">
                      <Search size={14} aria-hidden="true" />
                      <input type="text" className="ws-input" placeholder={tr('lager.search')} value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                  )}
                  <ChipFilter label={tr('artReg.filter')} value={filter} onChange={(id) => { setFilter(id); setGoodsPage(0); }}
                    items={[['all', tr('accr.filterAll'), tracked.length], ['instock', tr('lager.inStockPill'), inStock.length], ['low', tr('lager.low'), count('low'), 'low'], ['out', tr('lager.outOfStock'), count('out'), 'out'], ...(count('none') ? [['none', tr('lager.untracked'), count('none')]] : [])]} />
                </div>}
                {view === 'moves' && (
                  <div className="lg-listtools">
                    <div className="lg-search">
                      <Search size={14} aria-hidden="true" />
                      <input type="text" className="ws-input" placeholder={tr('lager.searchMoves')} value={moveSearch} onChange={e => setMoveSearch(e.target.value)} />
                    </div>
                    <ChipFilter label={tr('artReg.filter')} value={moveType} onChange={setMoveType}
                      items={[['all', tr('accr.filterAll'), movements.length], ['in', tr('lager.typeIn'), movements.filter(m => m.type === 'in').length], ['out', tr('lager.typeOut'), movements.filter(m => m.type === 'out').length], ['count', tr('lager.typeCount'), movements.filter(m => m.type === 'count').length]]} />
                  </div>
                )}
                {view === 'order' && (
                  <div className="lg-listtools is-wide">
                    {purchaseOrders.length > 0 && <>
                      <div className="lg-search">
                        <Search size={14} aria-hidden="true" />
                        <input type="text" className="ws-input" placeholder={tr('po.search')} value={poSearch} onChange={e => setPoSearch(e.target.value)} />
                      </div>
                      <ChipFilter label={tr('artReg.filter')} value={poFilter} onChange={setPoFilter}
                        items={[['open', tr('po.fOpen'), poCount('open')], ['draft', tr('po.status_draft'), poCount('draft')], ['ordered', tr('po.fOrdered'), poCount('ordered')], ['done', tr('po.fDone'), poCount('done')], ['all', tr('accr.filterAll'), poCount('all')]]} />
                    </>}
                    {orderRows.length > 0 && <button type="button" className="agi-btn po-low-btn" onClick={orderLow} title={tr('po.orderLow', { n: orderRows.length })}><Truck size={14} /> <span className="po-btn-text">{tr('po.orderLow', { n: orderRows.length })}</span><span className="po-btn-short">{orderRows.length}</span></button>}
                    <button type="button" className="agi-btn primary" onClick={() => createPo(null, '')}><Plus size={14} /> <span className="po-btn-text">{tr('po.new')}</span><span className="po-btn-short">{tr('po.newShort')}</span></button>
                  </div>
                )}
              </div>
              {view === 'moves' ? (
                moveRows.length === 0 ? <p className="ws-hint" style={{ padding: '12px 0' }}>{tr('lager.noMoves')}</p> : (
                  <div className="lg-moves">
                    <div className="lg-move head" aria-hidden="true">
                      <span>{tr('ui.datum')}</span><span>{tr('ui.vara')}</span><span>{tr('lager.colType')}</span><span className="r">{tr('lager.colQty')}</span><span className="r">{tr('lager.colPrice')}</span><span />
                    </div>
                    {moveRows.map(({ m, g }) => (
                      <div key={m.id} className={`lg-move is-${m.type}`}>
                        <span className="lg-move-date">{formatShort(m.date)}</span>
                        <button type="button" className="lg-move-name" onClick={() => g && setDetailId(g.id)}>
                          <strong>{g?.description || tr('lager.removedGood')}</strong>
                          <small>{[g?.articleNumber, m.note, m.source === 'invoice' && m.invoiceNumber ? tr('ui.faktura', { invoiceNumber: m.invoiceNumber }) : null].filter(Boolean).join(' · ') || ' '}</small>
                        </button>
                        <span className="lg-move-type">{movementLabel(m)}</span>
                        <span className={`r lg-move-qty ${m.type}`}>{m.type === 'out' ? '−' : m.type === 'count' ? '= ' : '+'}{fmtQty(m.qty)} <small>{g?.unit || tr('ui.st')}</small></span>
                        <span className="r lg-move-price">{m.type === 'in' && m.unitCost != null ? `${fmt(m.unitCost)} kr` : ''}</span>
                        <span className="r">{m.source === 'invoice'
                          ? <span className="lg-d-auto">{tr('ui.automatiskt')}</span>
                          : <button type="button" className="ws-icon-btn" title={tr('ui.ta_bort')} aria-label={tr('ui.ta_bort')} onClick={() => removeMovement(m)}><Trash2 size={14} /></button>}</span>
                      </div>
                    ))}
                  </div>
                )
              ) : view === 'order' ? (
                <div className="po-view">
                  {purchaseOrders.length === 0 ? (
                    <div className="po-empty">
                      <span className="po-empty-ic" aria-hidden="true"><Truck size={22} /></span>
                      <strong>{tr('po.emptyTitle')}</strong>
                      <p>{tr('po.emptyText')}</p>
                      <button type="button" className="agi-btn primary" onClick={() => createPo(null, '')}><Plus size={14} /> {tr('po.new')}</button>
                    </div>
                  ) : poRows.length === 0 ? (
                    <p className="ws-hint" style={{ padding: '16px 0' }}>{tr('po.noneHere')}</p>
                  ) : (
                    <div className="lg-tbl po-tbl">
                      <div className="ar-table-wrap">
                        <table className="ar-table">
                          <thead>
                            <tr>
                              <th className="po-w-nr">{tr('po.colNumber')}</th>
                              <th>{tr('po.supplier')}</th>
                              <th className="po-w-date ar-hide-md">{tr('po.date')}</th>
                              <th className="po-w-date">{tr('po.expected')}</th>
                              <th className="po-w-prog ar-hide-md">{tr('po.received')}</th>
                              <th className="r ar-w-value">{tr('po.total')}</th>
                              <th className="r po-w-status" />
                            </tr>
                          </thead>
                          <tbody>
                            {poRows.map(po => {
                              const st = poStatus(po);
                              const got = (po.rows || []).reduce((sum, x) => sum + (Number(x.received) || 0), 0);
                              const all = (po.rows || []).reduce((sum, x) => sum + (Number(x.qty) || 0), 0);
                              const late = (st === 'ordered' || st === 'partial') && po.expectedDate && po.expectedDate < todayIso();
                              return (
                                <tr key={po.id} className={`po-row is-${st}`} onClick={() => setPoOpen(po)}>
                                  <td className="po-nr">{po.number}</td>
                                  <td className="ar-name">
                                    <strong>{po.supplier || tr('lager.noSupplier')}</strong>
                                    <small>{[(po.rows || []).length === 1 ? tr('po.rowsOne') : tr('po.rowsMany', { n: (po.rows || []).length }), po.matchedExpenseId ? tr('po.invoiceLinked') : null].filter(Boolean).join(' · ')}</small>
                                  </td>
                                  <td className="ar-hide-md ar-muted">{formatShort(po.date)}</td>
                                  <td className={late ? 'po-late' : 'ar-muted'}>{po.expectedDate ? formatShort(po.expectedDate) : '–'}</td>
                                  <td className="ar-hide-md">{st === 'draft' || st === 'cancelled' || all === 0 ? <span className="ar-muted">–</span> : (
                                    <span className="po-prog"><span className="pz-m-track"><span style={{ width: `${Math.round((got / all) * 100)}%`, background: 'var(--status-green-text)' }} /></span><small>{tr('po.progress', { got: fmtQty(got), all: fmtQty(all) })}</small></span>
                                  )}</td>
                                  <td className="r ar-price">{fmtKr(poTotal(po))}</td>
                                  <td className="r"><span className={`agi-pill ${PO_STATUS_PILL[st]}`}>{tr(`po.status_${st}`)}</span></td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : rows.length === 0 ? (
                <p className="ws-hint" style={{ padding: '12px 0' }}>{tr('lager.noMatch')}</p>
              ) : (
                <div className="lg-tbl">
                  <div className="ar-table-wrap">
                    <table className="ar-table">
                      <thead>
                        <tr>
                          <th className="ar-num-col">{tr('ui.artikelnr')}</th>
                          <th>{tr('ui.vara')}</th>
                          <th className="lg-w-qty">{tr('lager.inStock')}</th>
                          <th className="r ar-hide-md lg-w-min">{tr('lager.reorderShort')}</th>
                          <th className="r ar-w-cost ar-hide-md">{tr('lager.unitCost')}</th>
                          <th className="r ar-w-value">{tr('ui.varde')}</th>
                          <th className="r lg-w-status" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(Math.min(goodsPage, Math.max(0, Math.ceil(rows.length / 50) - 1)) * 50).slice(0, 50).map(r => (
                          <tr key={r.articleId} className={`is-${r.status}`} onClick={() => setDetailId(r.articleId)}>
                            <td className="ar-num">{r.articleNumber || '–'}</td>
                            <td className="ar-name">
                              <strong>{r.description}</strong>
                              {r.shortfall > 0
                                ? <small className="lg-issue">{tr('lager.shortfall', { n: fmtQty(r.shortfall) })}</small>
                                : <small>{[supplierOf(r.articleId), resOf(r.articleId) ? tr('so.reservedShort', { qty: fmtQty(resOf(r.articleId)) }) : null, onOrder.get(r.articleId) ? tr('po.onOrderShort', { qty: fmtQty(onOrder.get(r.articleId).qty) }) : null, locationOf(r.articleId) ? tr('lager.locationShort', { loc: locationOf(r.articleId) }) : null, r.layers.length > 1 ? tr('lager.batchCount', { n: r.layers.length }) : null].filter(Boolean).join(' · ') || ' '}</small>}
                            </td>
                            <td className="lg-qty-cell">
                              {r.status === 'none' ? <span className="ar-muted">–</span> : (
                                <span className="lg-q">
                                  <span className="lg-q-num"><b>{fmtQty(r.qty)}</b> <small>{r.unit}</small></span>
                                  <span className="pz-m-track"><span style={{ width: `${Math.max(r.qty > 0 ? 3 : 0, barPct(r))}%`, background: barColor(r) }} />{r.min > 0 && <em style={{ left: '50%' }} />}</span>
                                </span>
                              )}
                            </td>
                            <td className="r ar-hide-md ar-muted">{r.min > 0 ? fmtQty(r.min) : '–'}</td>
                            <td className="r ar-hide-md ar-muted">{r.unitCost > 0 ? `${fmt(r.unitCost)} kr` : '–'}</td>
                            <td className="r ar-price">{r.bookValue > 0 ? fmtKr(r.bookValue) : <span className="ar-muted">–</span>}</td>
                            <td className="r">{r.status === 'none' ? null : statusPill(r)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 50 && (
                    <div className="ar-foot">
                      <span>{tr('artReg.showing', { from: Math.min(goodsPage, Math.ceil(rows.length / 50) - 1) * 50 + 1, to: Math.min(rows.length, (Math.min(goodsPage, Math.ceil(rows.length / 50) - 1) + 1) * 50), n: rows.length })}</span>
                      <span className="ar-pager">
                        <button type="button" disabled={goodsPage === 0} onClick={() => setGoodsPage(p => Math.max(0, p - 1))} aria-label={tr('artReg.prev')}><ChevronLeft size={16} /></button>
                        <span>{Math.min(goodsPage, Math.ceil(rows.length / 50) - 1) + 1} / {Math.ceil(rows.length / 50)}</span>
                        <button type="button" disabled={goodsPage >= Math.ceil(rows.length / 50) - 1} onClick={() => setGoodsPage(p => p + 1)} aria-label={tr('artReg.next')}><ChevronRight size={16} /></button>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
          {settings.stockFromInvoices && view === 'goods' && goods.length > 0 && (
            <p className="lg-sync">
              <RefreshCw size={13} aria-hidden="true" />
              {invoiceMovements.length === 0 ? tr('lager.syncNone') : tr('lager.syncSome', { n: invoiceMovements.length })}
            </p>
          )}
        </Panel>
      </div>

      {/* Varans sida från höger (2026-11-22): siffrorna överst, knapparna,
          saldot över tid, beställningspunkten, partierna och händelserna
          som en ren lista med ikon per typ. */}
      {detail && (() => {
        const history = movements.filter(m => m.articleId === detail.articleId).sort((a, b) => String(b.date).localeCompare(String(a.date)));
        const points = stockHistory(movements, detail.articleId);
        const margin = detail.salePrice > 0 ? Math.round(((detail.salePrice - detail.unitCost) / detail.salePrice) * 1000) / 10 : null;
        const evIcon = { in: Plus, out: Minus, count: ClipboardCheck };
        return (
          <div className="lg-drawer-overlay" onClick={() => setDetailId(null)}>
            <aside className="lg-drawer lg-drawer--v2" onClick={e => e.stopPropagation()} aria-label={detail.description}>
              <div className="lg-drawer-head">
                <span className="lg-avatar lg" aria-hidden="true">{initial(detail.description)}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h2 className="wsp-title" style={{ fontSize: '19px' }}>{detail.description}</h2>
                  <p className="wsp-sub">{[detail.articleNumber, supplierOf(detail.articleId), methodName].filter(Boolean).join(' · ')}</p>
                </div>
                {statusPill(detail)}
                <button type="button" className="modal-close" onClick={() => setDetailId(null)} aria-label={tr('ui.stang')}><X size={18} /></button>
              </div>

              <div className="lg-drawer-body">
                <div className="lg-d-actions">
                  <button type="button" className="agi-btn primary" onClick={() => startMovement('in', detail.articleId)}><Plus size={14} /> {tr('lager.typeIn')}</button>
                  <button type="button" className="agi-btn" onClick={() => startMovement('out', detail.articleId)}><PackageMinus size={14} /> {tr('lager.typeOut')}</button>
                  <button type="button" className="agi-btn" onClick={() => startMovement('count', detail.articleId)}><ClipboardCheck size={14} /> {tr('lager.typeCount')}</button>
                </div>

                {detail.shortfall > 0 && (
                  <div className="ws-tasks" style={{ marginTop: 0 }}>
                    <TaskRow icon={AlertTriangle} title={tr('lager.shortfall', { n: fmtQty(detail.shortfall) })} detail={tr('lager.shortfallHint')} />
                  </div>
                )}

                <Overview items={[
                  { key: 'qty', label: tr('lager.inStock'), value: `${fmtQty(detail.qty)} ${detail.unit}`, sub: resOf(detail.articleId) ? tr('so.reservedLong', { res: fmtQty(resOf(detail.articleId)), free: fmtQty(detail.qty - resOf(detail.articleId)), unit: detail.unit }) : onOrder.get(detail.articleId) ? tr('po.onOrderLong', { qty: fmtQty(onOrder.get(detail.articleId).qty), date: onOrder.get(detail.articleId).expectedDate ? formatShort(onOrder.get(detail.articleId).expectedDate) : '–' }) : detail.min ? tr('lager.minShort', { n: fmtQty(detail.min) }) : tr('lager.noMin'), tone: detail.status === 'out' ? 'bad' : detail.status === 'low' ? 'warn' : undefined },
                  { key: 'value', label: tr('ui.varde'), value: fmtKr(detail.bookValue), sub: tr('lager.costEach', { price: fmt(detail.unitCost) }) },
                  { key: 'price', label: tr('lager.salePrice'), value: detail.salePrice > 0 ? `${fmt(detail.salePrice)} kr` : '—', sub: margin != null ? tr('lager.marginIs', { n: String(margin).replace('.', ',') }) : tr('lager.noPrice') },
                ]} />

                {points.length >= 2 && (
                  <section className="lg-d-card">
                    <div className="lg-d-card-head"><h3>{tr('lager.stockOverTime')}</h3><span>{formatShort(points[0].date)} – {formatShort(points[points.length - 1].date)}</span></div>
                    <Sparkline points={points} color={palette.income} min={detail.min} />
                  </section>
                )}

                <section className="lg-d-card lg-d-min">
                  <div>
                    <h3><label htmlFor="lg-min">{tr('lager.reorderPoint')}</label></h3>
                    <p>{tr('lager.reorderHint')}</p>
                  </div>
                  <div className="ws-input-suffix" style={{ width: '120px', flexShrink: 0 }}>
                    <input id="lg-min" type="number" min="0" className="ws-input" placeholder="0" value={detail.min || ''} onChange={e => setReorderPoint(detail.articleId, e.target.value)} />
                    <span>{detail.unit}</span>
                  </div>
                </section>

                <section className="lg-d-card lg-d-min">
                  <div>
                    <h3><label htmlFor="lg-loc">{tr('lager.location')}</label></h3>
                    <p>{tr('lager.locationHint')}</p>
                  </div>
                  <input id="lg-loc" className="ws-input" style={{ width: '140px', flexShrink: 0 }} placeholder={tr('lager.locationPlaceholder')} value={locationOf(detail.articleId)} onChange={e => setLocation(detail.articleId, e.target.value)} />
                </section>

                {detail.layers.length > 0 && (
                  <section className="lg-d-card">
                    <div className="lg-d-card-head">
                      <h3>{tr('lager.batches')}</h3>
                      <span>{settings.method === 'fifo' ? tr('lager.batchesFifoShort') : tr('lager.batchesAvg', { price: fmt(detail.unitCost) })}</span>
                    </div>
                    <ul className="lg-d-list">
                      {detail.layers.map((l, i) => (
                        <li key={`${l.date}-${i}`}>
                          <span className="lg-d-date">{formatShort(l.date) || '—'}</span>
                          <span className="lg-d-main">{fmtQty(l.qty)} {detail.unit} × {fmt(l.cost)} kr{i === 0 && settings.method === 'fifo' && detail.layers.length > 1 && <em className="lg-d-tag">{tr('lager.sellsFirst')}</em>}</span>
                          <span className="lg-d-num">{fmtKr(l.qty * l.cost)}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="lg-d-card">
                  <div className="lg-d-card-head"><h3>{tr('lager.history')}</h3><span>{history.length}</span></div>
                  {history.length === 0 ? <p className="lg-d-empty">{tr('lager.noHistory')}</p> : (
                    <ul className="lg-d-list">
                      {history.map(m => {
                        const Ic = evIcon[m.type] || Plus;
                        return (
                          <li key={m.id} className={`is-${m.type}`}>
                            <span className="lg-d-ic" aria-hidden="true"><Ic size={14} /></span>
                            <span className="lg-d-main">
                              <strong>{movementLabel(m)}</strong>
                              <small>
                                {formatShort(m.date)}
                                {m.source === 'invoice' && m.invoiceNumber ? ` · ${tr('ui.faktura', { invoiceNumber: m.invoiceNumber })}` : ''}
                                {m.type === 'in' && m.source !== 'invoice' && m.unitCost != null ? ` · ${fmt(m.unitCost)} kr/${detail.unit}` : ''}
                                {m.note ? ` · ${m.note}` : ''}
                              </small>
                            </span>
                            <span className="lg-d-qty">{m.type === 'out' ? '−' : m.type === 'count' ? '= ' : '+'}{fmtQty(m.qty)}</span>
                            {m.source === 'invoice'
                              ? <span className="lg-d-auto">{tr('ui.automatiskt')}</span>
                              : <button type="button" className="ws-icon-btn" title={tr('ui.ta_bort')} aria-label={tr('ui.ta_bort')} onClick={() => removeMovement(m)}><Trash2 size={14} /></button>}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </div>
            </aside>
          </div>
        );
      })()}

      {poOpen && (
        <PurchaseOrderModal
          key={poOpen.id}
          initial={poOpen}
          goods={goods}
          company={company}
          suppliers={[...new Set([...goods.map(g => g.supplier).filter(Boolean), ...purchaseOrders.map(x => x.supplier).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'sv'))}
          onSave={savePo}
          onDelete={purchaseOrders.some(x => x.id === poOpen.id) ? deletePo : null}
          onReceive={(po, args) => receiveOnPo(po, args)}
          onClose={() => setPoOpen(null)}
        />
      )}

      {/* Inleverans med flera rader (2026-11-23): en leverans från en
          leverantör blir en händelse per vara med samma datum och följesedel. */}
      {delivery && (
        <div className="modal-overlay" onClick={() => setDelivery(null)}>
          <div className="modal-content lg-delivery" style={{ maxWidth: '760px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{tr('lager.typeIn')}</h2>
                <p className="wsp-sub">{tr('lager.deliverySub')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setDelivery(null)} aria-label={tr('ui.stang')}><X size={18} /></button>
            </div>
            <div className="ws-grid2" style={{ marginBottom: '14px' }}>
              <div><label className="ws-label" htmlFor="lg-dl-date">{tr('ui.datum')}</label><input id="lg-dl-date" type="date" className="ws-input" value={delivery.date} onChange={e => setDelivery(d => ({ ...d, date: e.target.value }))} /></div>
              <div><label className="ws-label" htmlFor="lg-dl-ref">{tr('lager.deliveryRef')}</label><input id="lg-dl-ref" className="ws-input" placeholder={tr('lager.deliveryRefPlaceholder')} value={delivery.ref} onChange={e => setDelivery(d => ({ ...d, ref: e.target.value }))} /></div>
            </div>
            <div className="lg-dl-rows">
              <div className="lg-dl-row head" aria-hidden="true"><span>{tr('ui.vara')}</span><span className="r">{tr('lager.colQty')}</span><span className="r">{tr('lager.colCost')}</span><span className="r">{tr('lager.colSum')}</span><span /></div>
              {delivery.rows.map(x => (
                <div key={x.key} className="lg-dl-row">
                  <select className="ws-input" value={x.articleId} onChange={e => setDeliveryRow(x.key, { articleId: e.target.value })} aria-label={tr('ui.vara')}>
                    <option value="">{tr('lager.pickGood')}</option>
                    {goods.map(g => <option key={g.id} value={g.id}>{g.articleNumber ? `${g.articleNumber} · ` : ''}{g.description}</option>)}
                  </select>
                  <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder="0" value={x.qty} onChange={e => setDeliveryRow(x.key, { qty: e.target.value })} aria-label={tr('lager.colQty')} /><span>{x.articleId ? unitOf(x.articleId) : ''}</span></div>
                  <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder="0" value={x.unitCost} onChange={e => setDeliveryRow(x.key, { unitCost: e.target.value })} aria-label={tr('lager.colCost')} /><span>kr</span></div>
                  <span className="r lg-dl-sum">{num(x.qty) > 0 && num(x.unitCost) >= 0 ? fmtKr(num(x.qty) * num(x.unitCost)) : ''}</span>
                  <button type="button" className="ws-icon-btn" aria-label={tr('ui.ta_bort')} title={tr('ui.ta_bort')} onClick={() => setDelivery(d => ({ ...d, rows: d.rows.length > 1 ? d.rows.filter(y => y.key !== x.key) : [deliveryRow()] }))}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="lg-dl-foot">
              <button type="button" className="agi-btn" onClick={() => setDelivery(d => ({ ...d, rows: [...d.rows, deliveryRow()] }))}><Plus size={14} /> {tr('lager.addRow')}</button>
              <span>{tr('lager.deliveryTotal')} <b>{fmtKr(deliveryTotal)}</b></span>
            </div>
            <p className="ws-hint" style={{ marginTop: '10px' }}>{tr('lager.deliveryHint')}</p>
            {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>}
            <div className="modal-footer">
              <button type="button" className="agi-btn" onClick={() => setDelivery(null)}>{tr('ui.avbryt')}</button>
              <button type="button" className="agi-btn primary" onClick={saveDelivery}>{deliveryLines.length > 1 ? tr('lager.saveDeliveryN', { n: deliveryLines.length }) : tr('lager.saveDelivery')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Inköp att lägga in: välj vara och antal, styckpriset räknas ut. */}
      {purchaseOpen && (
        <div className="modal-overlay" onClick={() => setPurchaseOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '640px' }} onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{tr('lager.purchasesTitle')}</h2>
                <p className="wsp-sub">{tr('lager.purchasesSub')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setPurchaseOpen(false)}><X size={18} /></button>
            </div>
            {visiblePurchases.length === 0 ? <p className="ws-hint">{tr('lager.purchasesNone')}</p> : (
              <div className="lg-purchases">
                {visiblePurchases.map(line => {
                  const d = draftFor(line);
                  const match = matchFor(line);
                  const q = Number(String(d.qty).replace(',', '.'));
                  return (
                    <div key={line.key} className="lg-purchase">
                      <div className="lg-purchase-top">
                        <div style={{ minWidth: 0 }}>
                          <strong>{line.supplier || tr('lager.unknownSupplier')}{line.reference ? ` · ${line.reference}` : ''}</strong>
                          <small>{formatShort(line.date)} · {tr('lager.account', { account: line.account })}{line.text ? ` · ${line.text}` : ''}</small>
                        </div>
                        <b>{fmt(line.net)} kr</b>
                      </div>
                      {match && (
                        <div className={`po-match${match.sure ? ' sure' : ''}`}>
                          <span>
                            <strong>{tr('po.matchTitle', { number: match.po.number })}</strong>
                            <small>{match.diff === 0 ? tr('po.matchSame', { total: fmt(match.total) }) : tr('po.matchDiff', { total: fmt(match.total), diff: `${match.diff > 0 ? '+' : '−'}${fmt(Math.abs(match.diff))}` })}{` ${tr(poStatus(match.po) === 'received' ? 'po.matchReceived' : poStatus(match.po) === 'partial' ? 'po.matchPartial' : 'po.matchNotReceived')}`}</small>
                          </span>
                          <button type="button" className="agi-btn primary" onClick={() => linkExpense(line, match)}>{poStatus(match.po) === 'received' ? tr('po.link') : tr('po.receiveAndLink')}</button>
                        </div>
                      )}
                      <div className="lg-purchase-form">
                        <select className="ws-input" value={d.articleId} onChange={ev => setDraft(line, { articleId: ev.target.value })} aria-label={tr('ui.vara')}>
                          <option value="">{tr('lager.pickGood')}</option>
                          {goods.map(g => <option key={g.id} value={g.id}>{g.description}</option>)}
                        </select>
                        <div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" placeholder={tr('ui.antal')} value={d.qty} onChange={ev => setDraft(line, { qty: ev.target.value })} /><span>{tr('ui.st')}</span></div>
                        <span className="ws-hint lg-purchase-each">{q > 0 ? tr('lager.eachPrice', { price: fmt(line.net / q) }) : ''}</span>
                        <button type="button" className="agi-btn primary" disabled={!d.articleId || !(q > 0)} onClick={() => receivePurchase(line)}>{tr('lager.receive')}</button>
                        <button type="button" className="agi-btn" onClick={() => ignorePurchase(line)}>{tr('lager.notStock')}</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inventering av alla varor på en gång. */}
      {countSheet && (
        <div className="modal-overlay" onClick={() => setCountSheet(null)}>
          <div className="modal-content" style={{ maxWidth: '620px' }} onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{tr('lager.countSheetTitle')}</h2>
                <p className="wsp-sub">{tr('lager.countSheetSub')}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setCountSheet(null)}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <label className="ws-label" style={{ margin: 0 }} htmlFor="lg-count-date">{tr('ui.datum')}</label>
              <input id="lg-count-date" type="date" className="ws-input" style={{ width: 'auto' }} value={countSheet.date} onChange={ev => setCountSheet(c => ({ ...c, date: ev.target.value }))} />
              <button type="button" className="agi-btn" style={{ marginLeft: 'auto' }} onClick={() => setCountSheet(c => ({ ...c, counts: Object.fromEntries(allRows.map(r => [r.articleId, fmtQty(r.qty).replace(/\s/g, '')])) }))}>{tr('lager.fillBook')}</button>
            </div>
            <div className="lg-count-sheet">
              <div className="lg-count-row head"><span>{tr('ui.vara')}</span><span className="r">{tr('lager.booked')}</span><span className="r">{tr('lager.counted')}</span><span className="r">{tr('lager.diffShort')}</span></div>
              {allRows.map(r => {
                const raw = countSheet.counts[r.articleId] ?? '';
                const counted = raw === '' ? null : Number(String(raw).replace(',', '.'));
                const dlt = counted == null || Number.isNaN(counted) ? null : counted - r.qty;
                return (
                  <div key={r.articleId} className="lg-count-row">
                    <span className="ws-name-text"><strong>{r.description}</strong>{r.articleNumber && <small>{r.articleNumber}</small>}</span>
                    <span className="r">{fmtQty(r.qty)}</span>
                    <span className="r"><input className="ws-input" inputMode="decimal" placeholder="–" value={raw} onChange={ev => setCountSheet(c => ({ ...c, counts: { ...c.counts, [r.articleId]: ev.target.value } }))} aria-label={`${tr('lager.counted')} ${r.description}`} /></span>
                    <span className={`r lg-diff${dlt > 0 ? ' up' : dlt < 0 ? ' down' : ''}`}>{dlt == null ? '' : dlt === 0 ? '±0' : `${dlt > 0 ? '+' : '−'}${fmtQty(Math.abs(dlt))}`}</span>
                  </div>
                );
              })}
            </div>
            <div className="modal-footer">
              <button type="button" className="agi-btn" onClick={() => setCountSheet(null)}>{tr('ui.avbryt')}</button>
              <button type="button" className="agi-btn primary" onClick={saveCountSheet}>{tr('lager.saveCount')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Inventeringslistan som PDF eller CSV. */}
      {listOpen && (
        <div className="modal-overlay" onClick={() => setListOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '460px' }} onClick={ev => ev.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{tr('lager.countList')}</h2>
              <button type="button" className="modal-close" onClick={() => setListOpen(false)}><X size={18} /></button>
            </div>
            <div className="ws-form">
              <p className="ws-hint">{tr('lager.countListHint')}</p>
              <div>
                <label className="ws-label" htmlFor="lg-list-date">{tr('ui.vardering_per_datum')}</label>
                <input id="lg-list-date" type="date" className="ws-input" value={closingDate} onChange={ev => ev.target.value && setClosingDate(ev.target.value)} />
              </div>
              <div className="lg-list-sum"><span>{(exportLines.length === 1 ? tr('lager.listSummaryOne') : tr('lager.listSummary', { n: exportLines.length }))}</span><b>{fmtKr(valuation.bookValue)}</b></div>
              <div className="modal-footer" style={{ marginTop: 0 }}>
                <button type="button" className="agi-btn" onClick={() => downloadInventoryListCsv(exportArgs)}>CSV</button>
                <button type="button" className="agi-btn primary" onClick={() => { downloadInventoryListPdf(exportArgs); }}><Download size={14} /> PDF</button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  <div className="ws-input-suffix"><input type="number" step="any" min="0" className="ws-input" value={form.qty} autoFocus onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} /><span>{unitOf(form.articleId)}</span></div>
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
