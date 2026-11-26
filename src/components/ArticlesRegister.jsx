import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Pencil, Copy, Trash2, X, Download, Percent, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Package, Settings2, Upload, Hash, Tag, CreditCard, Wallet, Truck, Layers, Plus } from './icons';
import RowActionMenu from './shared/RowActionMenu';
import ArticleBulkEdit from './ArticleBulkEdit';
import ChipFilter from './shared/ChipFilter';
import { confirmDialog } from './shared/ConfirmDialog';
import { showUndo } from './shared/undoToast';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import { valuateInventory, deriveInvoiceMovements } from '../utils/inventory';
import { articlesToCsv, downloadCsv } from '../utils/csvRegister';

// Artikelregistret för många artiklar (2026-11-24, bara admin än): en riktig
// tabell som Fortnox register men lugnare. Sök på allt, filter som räknar,
// leverantör, sortering per kolumn, sidor om 50, och markera flera för att
// uppdatera priser, byta moms, exportera eller ta bort. Lagersaldot räknas
// här ur samma lagerhändelser som Lager-fliken (utils/inventory.js).
const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtQty = (v) => numberFormat('sv-SE', { maximumFractionDigits: 2 }).format(Number(v) || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0))} kr`;
const PAGE_SIZES = [25, 50, 100, 0];
// Listans inställningar sparas per webbläsare (bara bekvämlighet).
const PREFS_KEY = 'bokix.artReg.prefs';
const DEFAULT_COLS = { num: true, price: true, cost: true, tg: true, stock: true, value: true, supplier: false, unit: false };
const loadPrefs = () => {
  try { const v = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); if (v && typeof v === 'object') return { cols: { ...DEFAULT_COLS, ...(v.cols || {}) }, density: v.density === 'compact' ? 'compact' : 'normal', width: v.width === 'narrow' ? 'narrow' : 'wide', pageSize: PAGE_SIZES.includes(v.pageSize) ? v.pageSize : 50 }; } catch { /* privat läge */ }
  return { cols: { ...DEFAULT_COLS }, density: 'normal', width: 'wide', pageSize: 50 };
};
const marginOf = (a) => {
  const p = Number(a.unitPrice) || 0; const c = Number(a.purchasePrice) || 0;
  return p > 0 && c > 0 ? ((p - c) / p) * 100 : null;
};

export default function ArticlesRegister({ articles = [], setArticles, company, setCompanyInfo, invoices = [], onEdit, onNew, onDuplicate, onImport, onExport, showStock = true, settingsOpen: settingsOpenProp, onSettingsOpenChange }) {
  // Redigera priser från inställningarna: alla artiklar i listan som visas.
  const [bulkItems, setBulkItems] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [supplier, setSupplier] = useState('');
  const [sort, setSort] = useState({ key: 'articleNumber', dir: 1 });
  const [prefs, setPrefs] = useState(loadPrefs);
  // Kugghjulet står bredvid sidans rubrik (Articles.jsx) när den styr panelen.
  const [settingsOpenOwn, setSettingsOpenOwn] = useState(false);
  const controlled = typeof onSettingsOpenChange === 'function';
  const settingsOpen = controlled ? Boolean(settingsOpenProp) : settingsOpenOwn;
  const setSettingsOpen = controlled ? onSettingsOpenChange : setSettingsOpenOwn;
  const pageSize = prefs.pageSize;
  const cols = prefs.cols;
  // Sparas och meddelas utanför setPrefs: Artiklar-sidan lyssnar på
  // bokix:artprefs, och en händelse inifrån uppdateringen ändrade dess
  // tillstånd mitt i ritningen (React-varning, 2026-11-27).
  const updatePrefs = (patch) => {
    const next = { ...prefs, ...patch, cols: { ...prefs.cols, ...(patch.cols || {}) } };
    setPrefs(next);
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* privat läge */ }
    try { window.dispatchEvent(new CustomEvent('bokix:artprefs', { detail: next })); } catch { /* äldre webbläsare */ }
  };
  const setPageSize = (n) => updatePrefs({ pageSize: n });
  const [page, setPage] = useState(0);
  const [picked, setPicked] = useState(() => new Set());
  // Massredigering (ArticleBulkEdit): null | { focusPrices }
  const [bulkEdit, setBulkEdit] = useState(null);

  // Lagersaldo per vara, som i Lager-fliken.
  const stock = useMemo(() => {
    const settings = { method: 'avg', reorderPoints: {}, ...(company?.inventorySettings || {}) };
    // Utan Handel-planen visas inget lager i registret (2026-11-25).
    if (!showStock) return { byId: new Map(), any: false };
    const manual = company?.stockMovements || [];
    const fromInvoices = settings.stockFromInvoices ? deriveInvoiceMovements({ invoices, articles, movements: manual, since: settings.stockFromInvoicesSince || null }) : [];
    const movements = [...manual, ...fromInvoices];
    if (movements.length === 0) return { byId: new Map(), any: false };
    const val = valuateInventory({ articles, movements, method: settings.method, applyLowestValue: settings.lowestValue !== false });
    const byId = new Map(val.lines.map(l => [l.articleId, { qty: l.qty, value: l.bookValue }]));
    return { byId, any: true, reorder: settings.reorderPoints || {}, locations: settings.locations || {} };
  }, [company?.inventorySettings, company?.stockMovements, invoices, articles, showStock]);

  const keyOf = (a) => a.id || a.articleNumber || a.description;
  // Bara varor som haft lager eller har en beställningspunkt får saldo och
  // status; en vara som aldrig lagerförts är inte slut, den syns som –.
  const stockOf = (a) => {
    if (a.type !== 'vara') return null;
    const s = stock.byId.get(a.id);
    if (s) return s;
    return Number(stock.reorder?.[a.id]) > 0 ? { qty: 0, value: 0 } : null;
  };
  const statusOf = (a) => {
    const s = stockOf(a);
    if (!s || !stock.any) return null;
    const min = Number(stock.reorder?.[a.id]) || 0;
    return s.qty <= 0 ? 'out' : min > 0 && s.qty <= min ? 'low' : 'ok';
  };
  const locationOf = (a) => stock.locations?.[a.id] ?? a.location ?? '';

  const suppliers = useMemo(() => [...new Set(articles.map(a => a.supplier).filter(Boolean))].sort((x, y) => x.localeCompare(y, 'sv')), [articles]);
  const counts = useMemo(() => ({
    all: articles.length,
    vara: articles.filter(a => a.type === 'vara').length,
    tjanst: articles.filter(a => a.type !== 'vara').length,
    low: stock.any ? articles.filter(a => statusOf(a) === 'low').length : 0,
    out: stock.any ? articles.filter(a => statusOf(a) === 'out').length : 0,
    noPrice: articles.filter(a => !(Number(a.unitPrice) > 0)).length,
  }), [articles, stock]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const words = s.split(/\s+/).filter(Boolean);
    let list = articles.filter(a => {
      if (filter === 'vara' && a.type !== 'vara') return false;
      if (filter === 'tjanst' && a.type === 'vara') return false;
      if ((filter === 'low' || filter === 'out') && statusOf(a) !== filter) return false;
      if (filter === 'noPrice' && Number(a.unitPrice) > 0) return false;
      if (supplier && a.supplier !== supplier) return false;
      if (!words.length) return true;
      const hay = `${a.articleNumber || ''} ${a.description || ''} ${a.ean || ''} ${a.supplier || ''} ${locationOf(a)}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
    const val = (a) => {
      switch (sort.key) {
        case 'description': return (a.description || '').toLowerCase();
        case 'supplier': return (a.supplier || '\uffff').toLowerCase();
        case 'unitPrice': return Number(a.unitPrice) || 0;
        case 'purchasePrice': return Number(a.purchasePrice) || 0;
        case 'margin': return marginOf(a) ?? -1e9;
        case 'stock': return stockOf(a)?.qty ?? -1e9;
        case 'value': return stockOf(a)?.value ?? -1e9;
        default: return String(a.articleNumber || '').padStart(12, '0');
      }
    };
    list = [...list].sort((x, y) => {
      const a = val(x); const b = val(y);
      return (a < b ? -1 : a > b ? 1 : 0) * sort.dir || String(x.description).localeCompare(String(y.description), 'sv');
    });
    return list;
  }, [articles, q, filter, supplier, sort, stock]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = pageSize ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const current = Math.min(page, pages - 1);
  const shown = pageSize ? rows.slice(current * pageSize, current * pageSize + pageSize) : rows;
  const allShownPicked = shown.length > 0 && shown.every(a => picked.has(keyOf(a)));
  const pickedList = articles.filter(a => picked.has(keyOf(a)));
  const totalValue = stock.any ? rows.reduce((sum, a) => sum + (stockOf(a)?.value || 0), 0) : 0;

  const toggle = (a) => setPicked(prev => { const n = new Set(prev); const k = keyOf(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const toggleShown = () => setPicked(prev => { const n = new Set(prev); shown.forEach(a => (allShownPicked ? n.delete(keyOf(a)) : n.add(keyOf(a)))); return n; });
  const sortBy = (key) => setSort(s => (s.key === key ? { key, dir: -s.dir } : { key, dir: key === 'description' || key === 'articleNumber' ? 1 : -1 }));
  const setFilterReset = (f) => { setFilter(f); setPage(0); };

  const removeOne = (a) => {
    const before = articles;
    setArticles(prev => prev.filter(x => x !== a));
    showUndo({ message: t('ui.undo_borttagen', { name: a.description || a.articleNumber }), onUndo: () => setArticles(before) });
  };
  const removePicked = async () => {
    if (!(await confirmDialog(t('artReg.deleteConfirm', { n: pickedList.length }), { title: t('artReg.deleteTitle'), confirmLabel: t('ui.ta_bort') }))) return;
    const before = articles;
    const keys = new Set(pickedList.map(keyOf));
    setArticles(prev => prev.filter(a => !keys.has(keyOf(a))));
    setPicked(new Set());
    showUndo({ message: t('artReg.deleted', { n: keys.size }), onUndo: () => setArticles(before) });
  };
  const setVatPicked = (rate) => {
    const keys = new Set(pickedList.map(keyOf));
    setArticles(prev => prev.map(a => (keys.has(keyOf(a)) ? { ...a, vatRate: rate } : a)));
  };
  const exportPicked = () => downloadCsv(`artiklar_urval_${new Date().toISOString().slice(0, 10)}.csv`, articlesToCsv(pickedList));

  const saveBulk = (patches, counts) => {
    const before = articles;
    setArticles(prev => prev.map(x => (patches.has(keyOf(x)) ? { ...x, ...patches.get(keyOf(x)) } : x)));
    // Ändrat lagersaldo blir en inventering i dag (samma som i Lager-fliken).
    if (counts?.size && setCompanyInfo) {
      const today = new Date().toISOString().slice(0, 10);
      const byKey = new Map(articles.map(a => [keyOf(a), a]));
      const added = [...counts].map(([k, qty]) => ({ id: `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, articleId: byKey.get(k)?.id, type: 'count', date: today, qty, note: t('artEdit.countNote') })).filter(m => m.articleId);
      setCompanyInfo(prev => ({ ...prev, stockMovements: [...(prev.stockMovements || []), ...added] }));
    }
    setBulkEdit(null);
    setBulkItems(null);
    showUndo({ message: t('artEdit.saved', { n: patches.size }), onUndo: () => setArticles(before) });
  };

  const Th = ({ k, children, className = '' }) => (
    <th className={`${className} ${k ? 'ar-sortable' : ''}`} onClick={k ? () => sortBy(k) : undefined} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <span>{children}{k && sort.key === k && (sort.dir > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</span>
    </th>
  );
  const chips = [
    ['all', t('artReg.all'), counts.all],
    ['vara', t('artReg.goods'), counts.vara],
    ['tjanst', t('artReg.services'), counts.tjanst],
    ...(stock.any ? [['low', t('artReg.low'), counts.low], ['out', t('artReg.out'), counts.out]] : []),
    ...(counts.noPrice ? [['noPrice', t('artReg.noPrice'), counts.noPrice]] : []),
  ].filter(([id, , n]) => id === 'all' || n > 0 || filter === id);

  return (
    <div className={`ar${prefs.density === 'compact' ? ' ar--compact' : ''}`}>
      <div className="ar-tools">
        <label className="ar-search">
          <Search size={15} aria-hidden="true" />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder={t('artReg.search')} aria-label={t('artReg.search')} />
          {q && <button type="button" onClick={() => setQ('')} aria-label={t('ui.rensa')}><X size={14} /></button>}
        </label>
        <ChipFilter label={t('artReg.filter')} value={filter} onChange={setFilterReset} items={chips.map(([id, label, n]) => [id, label, n, id === 'out' || id === 'low' ? id : undefined])} />
        {suppliers.length > 0 && (
          <select className="ar-select" value={supplier} onChange={e => { setSupplier(e.target.value); setPage(0); }} aria-label={t('artReg.supplier')}>
            <option value="">{t('artReg.allSuppliers')}</option>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {!controlled && <button type="button" className="ar-gear" onClick={() => setSettingsOpen(true)} title={t('artSet.title')} aria-label={t('artSet.title')}><Settings2 size={16} /></button>}
      </div>

      {picked.size > 0 && (
        <div className="ar-bulk" role="toolbar" aria-label={t('artReg.selected', { n: picked.size })}>
          <strong>{t('artReg.selected', { n: picked.size })}</strong>
          <button type="button" onClick={() => setBulkEdit({ focusPrices: false })}><Pencil size={14} /> {t('artEdit.edit')}</button>
          <button type="button" onClick={() => setBulkEdit({ focusPrices: true })}><Percent size={14} /> {t('artReg.updatePrices')}</button>
          <select value="" onChange={e => { if (e.target.value !== '') setVatPicked(Number(e.target.value)); }} aria-label={t('artReg.setVat')}>
            <option value="">{t('artReg.setVat')}</option>
            {[25, 12, 6, 0].map(r => <option key={r} value={r}>{r} %</option>)}
          </select>
          <button type="button" onClick={exportPicked}><Download size={14} /> {t('artReg.export')}</button>
          <button type="button" className="danger" onClick={removePicked}><Trash2 size={14} /> {t('ui.ta_bort')}</button>
          <button type="button" className="ar-bulk-x" onClick={() => setPicked(new Set())} aria-label={t('artReg.clear')}><X size={16} /></button>
        </div>
      )}

      {articles.length === 0 ? (
        <div className="ar-empty">
          <span className="ar-empty-ic" aria-hidden="true"><Package size={22} /></span>
          <strong>{t('artReg.emptyTitle')}</strong>
          <p>{t('artReg.emptyText')}</p>
          <button type="button" className="ar-primary" onClick={onNew}>{t('ui.ny_artikel')}</button>
        </div>
      ) : rows.length === 0 ? (
        <p className="ar-none">{t('ui.inga_artiklar_matchar_sokningen')}</p>
      ) : (
        <>
          <div className="ar-table-wrap">
            <table className="ar-table">
              <thead>
                <tr>
                  <th className="ar-cb"><input type="checkbox" checked={allShownPicked} onChange={toggleShown} aria-label={t('artReg.pickAll')} /></th>
                  {cols.num && <Th k="articleNumber" className="ar-num-col">{t('ui.artikelnr')}</Th>}
                  <Th k="description">{t('ui.benamning')}</Th>
                  {cols.supplier && <Th k="supplier" className="ar-hide-md ar-w-sup">{t('artReg.supplier')}</Th>}
                  {cols.unit && <th className="ar-w-unit">{t('ui.enhet')}</th>}
                  {cols.price && <Th k="unitPrice" className="r ar-w-price">{t('artReg.price')}</Th>}
                  {cols.cost && <Th k="purchasePrice" className="r ar-hide-md ar-w-cost">{t('artReg.cost')}</Th>}
                  {cols.tg && <Th k="margin" className="r ar-hide-md ar-w-tg">{t('artReg.margin')}</Th>}
                  {stock.any && cols.stock && <Th k="stock" className="r ar-w-stock">{t('artReg.stock')}</Th>}
                  {stock.any && cols.value && <Th k="value" className="r ar-hide-lg ar-w-value">{t('artReg.value')}</Th>}
                  <th className="ar-act" />
                </tr>
              </thead>
              <tbody>
                {shown.map(a => {
                  const m = marginOf(a);
                  const s = stockOf(a);
                  const st = statusOf(a);
                  const loc = locationOf(a);
                  return (
                    <tr key={keyOf(a)} className={picked.has(keyOf(a)) ? 'on' : ''} onClick={() => onEdit(a)}>
                      <td className="ar-cb" onClick={e => e.stopPropagation()}><input type="checkbox" checked={picked.has(keyOf(a))} onChange={() => toggle(a)} aria-label={a.description} /></td>
                      {cols.num && <td className="ar-num">{a.articleNumber || '–'}</td>}
                      <td className="ar-name">
                        <strong>{a.description}</strong>
                        {(() => { const sub = [!cols.num && a.articleNumber ? a.articleNumber : null, a.type === 'vara' ? null : t('artReg.serviceOne'), Number(a.vatRate) !== 25 ? t('artReg.vatShort', { n: a.vatRate }) : null, cols.supplier ? null : a.supplier, loc ? t('artReg.loc', { loc }) : null].filter(Boolean).join(' · '); return sub ? <small>{sub}</small> : null; })()}
                      </td>
                      {cols.supplier && <td className="ar-hide-md ar-muted ar-ellip ar-sup-td">{a.supplier || '–'}</td>}
                      {cols.unit && <td className="ar-unit-td">{a.unit || 'st'}</td>}
                      {cols.price && <td className="r ar-price">{Number(a.unitPrice) > 0 ? `${fmt(a.unitPrice)} kr` : <span className="ar-missing">{t('artReg.noPriceShort')}</span>}</td>}
                      {cols.cost && <td className="r ar-hide-md ar-muted ar-cost-td">{Number(a.purchasePrice) > 0 ? `${fmt(a.purchasePrice)} kr` : '–'}</td>}
                      {cols.tg && <td className="r ar-hide-md">{m == null ? <span className="ar-muted">–</span> : <span className={`ar-tg${m < 20 ? ' low' : m >= 50 ? ' high' : ''}`}>{numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(m)} %</span>}</td>}
                      {stock.any && cols.stock && <td className="r">{s ? <span className={`ar-stock is-${st}`}><i aria-hidden="true" />{fmtQty(s.qty)} <small>{a.unit || 'st'}</small></span> : <span className="ar-muted">–</span>}</td>}
                      {stock.any && cols.value && <td className="r ar-hide-lg ar-muted">{s && s.value > 0 ? fmtKr(s.value) : '–'}</td>}
                      <td className="ar-act" onClick={e => e.stopPropagation()}>
                        <RowActionMenu items={[
                          { key: 'edit', label: t('ui.andra'), icon: Pencil, onClick: () => onEdit(a) },
                          { key: 'dup', label: t('artReg.duplicate'), icon: Copy, onClick: () => onDuplicate(a) },
                          { divider: true },
                          { key: 'del', label: t('ui.ta_bort'), icon: Trash2, variant: 'danger', onClick: () => removeOne(a) },
                        ]} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="ar-foot">
            <span>{t('artReg.showing', { from: pageSize ? current * pageSize + 1 : 1, to: pageSize ? Math.min(rows.length, (current + 1) * pageSize) : rows.length, n: rows.length })}{stock.any && totalValue > 0 ? ` · ${t('artReg.totalValue', { kr: fmtKr(totalValue) })}` : ''}</span>
            <span className="ar-pager">
              {/* Rader per sida ligger i inställningspanelen (2026-11-26). */}
              {pages > 1 && <>
                <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label={t('artReg.prev')}><ChevronLeft size={16} /></button>
                <span>{current + 1} / {pages}</span>
                <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label={t('artReg.next')}><ChevronRight size={16} /></button>
              </>}
            </span>
          </div>
        </>
      )}

      {settingsOpen && createPortal(
        <div className="ar-set-overlay" onClick={() => setSettingsOpen(false)}>
          <aside className="ar-set" onClick={e => e.stopPropagation()} aria-label={t('artSet.title')}>
            <div className="ar-set-head">
              <h2>{t('artSet.title')}</h2>
              <button type="button" className="modal-close" onClick={() => setSettingsOpen(false)} aria-label={t('ui.stang')}><X size={18} /></button>
            </div>
            <div className="ar-set-sec ar-set-btns">
              <button type="button" onClick={() => { setSettingsOpen(false); setBulkItems(rows); setBulkEdit({ focusPrices: true }); }} disabled={rows.length === 0}><Pencil size={14} /> {t('artSet.editPrices')}</button>
              {onImport && <button type="button" onClick={() => { setSettingsOpen(false); onImport(); }}><Upload size={14} /> {t('artSet.import')}</button>}
              {onNew && <button type="button" onClick={() => { setSettingsOpen(false); onNew(); }}><Plus size={14} /> {t('ui.ny_artikel')}</button>}
              {onExport && <button type="button" onClick={onExport}><Download size={14} /> {t('artSet.export')}</button>}
            </div>
            <div className="ar-set-sec">
              <h3>{t('artSet.columns')}</h3>
              {[['num', t('ui.artikelnummer'), Hash], ['price', t('artReg.price'), Tag], ['cost', t('artReg.cost'), CreditCard], ['tg', t('artReg.margin'), Percent], ...(stock.any ? [['stock', t('artReg.stock'), Package], ['value', t('artReg.value'), Wallet]] : []), ['supplier', t('artReg.supplier'), Truck], ['unit', t('ui.enhet'), Layers]].map(([k, label, Icon]) => (
                <label key={k} className="ar-switch">
                  <span className="ar-switch-label"><Icon size={16} aria-hidden="true" />{label}</span>
                  <input type="checkbox" checked={Boolean(cols[k])} onChange={e => updatePrefs({ cols: { [k]: e.target.checked } })} />
                  <i aria-hidden="true" />
                </label>
              ))}
            </div>
            <div className="ar-set-sec ar-set-two">
              <div>
                <h3>{t('artSet.rowSize')}</h3>
                <div className="ar-set-seg">
                  {[['compact', t('artSet.compact')], ['normal', t('artSet.normal')]].map(([k, label]) => (
                    <button key={k} type="button" className={prefs.density === k ? 'on' : ''} onClick={() => updatePrefs({ density: k })}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <h3>{t('artSet.width')}</h3>
                <div className="ar-set-seg">
                  {[['narrow', t('artSet.narrow')], ['wide', t('artSet.wide')]].map(([k, label]) => (
                    <button key={k} type="button" className={prefs.width === k ? 'on' : ''} onClick={() => updatePrefs({ width: k })}>{label}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="ar-set-sec">
              <h3>{t('artSet.perPage')}</h3>
              <div className="ar-set-seg">
                {PAGE_SIZES.map(n => (
                  <button key={n} type="button" className={pageSize === n ? 'on' : ''} onClick={() => { setPageSize(n); setPage(0); }}>{n || t('artReg.perPageAll')}</button>
                ))}
              </div>
            </div>
          </aside>
        </div>,
        document.body,
      )}

      {bulkEdit && (
        <ArticleBulkEdit items={bulkItems || pickedList} keyOf={keyOf} focusPrices={bulkEdit.focusPrices} onSave={saveBulk} onClose={() => { setBulkEdit(null); setBulkItems(null); }} stockOf={(a) => (showStock && setCompanyInfo && a.type === 'vara' ? (stock.byId.get(a.id)?.qty ?? 0) : null)} />
      )}
    </div>
  );
}
