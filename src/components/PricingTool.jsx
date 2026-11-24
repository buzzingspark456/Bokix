import React, { useMemo, useState } from 'react';
import { Search, X, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, TrendingUp, Calculator, Pencil, Percent, Copy } from './icons';
import ArticleBulkEdit from './ArticleBulkEdit';
import ArticleCombobox from './shared/ArticleCombobox';
import { showUndo } from './shared/undoToast';
import { confirmDialog } from './shared/ConfirmDialog';
import { Panel, Kpi, KpiGrid, usePalette } from './shared/Workspace';
import {
  markupPct, marginPct, priceFromMargin, priceFromMarkup, withVat, roundPrice, marginAfterDiscount,
  maxDiscountForMargin, breakEvenUnits, hourlyRate, pricingStatus,
} from '../utils/pricing';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtPctVal = (v) => (v == null ? '—' : `${numberFormat('sv-SE', { maximumFractionDigits: 1 }).format(v)} %`);
const num = (v) => (v === '' || v == null ? '' : v);

const STATUS = {
  ok: { label: t('ui.nar_malet'), cls: 'ok' },
  below: { label: t('ui.under_malet'), cls: 'warn' },
  loss: { label: t('ui.saljs_med_forlust'), cls: 'late' },
  no_cost: { label: t('ui.inkopspris_saknas'), cls: 'mute' },
  no_price: { label: t('ui.pris_saknas'), cls: 'mute' },
};

function Field({ label, value, onChange, suffix, step = 'any' }) {
  return (
    <div>
      <label className="ws-label">{label}</label>
      <div className="ws-input-suffix">
        <input type="number" step={step} className="ws-input" value={num(value)} onChange={e => onChange(e.target.value)} />
        {suffix && <span>{suffix}</span>}
      </div>
    </div>
  );
}

/** Resultatpanelen till höger i räknaren: ett stort tal och några rader under. */
function Result({ title, value, lines = [], empty, error }) {
  return (
    <div style={{ background: 'var(--bg-muted)', borderRadius: '12px', padding: '18px 20px', alignSelf: 'stretch', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '150px' }}>
      {error ? <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>
        : value == null ? <p className="ws-hint">{empty}</p>
        : <>
          <div className="ws-stat-label">{title}</div>
          <div style={{ fontSize: '30px', fontWeight: 750, letterSpacing: '-0.02em', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', margin: '2px 0 10px' }}>{value}</div>
          {lines.map(([label, v]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '6px 0', borderTop: '1px solid var(--border-light)', fontSize: '13.5px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontWeight: 600, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
            </div>
          ))}
        </>}
    </div>
  );
}

/** Marginal som en liten stapel mot målet, så man ser direkt vilka som ligger lågt. */
function MarginBar({ margin, target }) {
  if (margin == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const pct = Math.max(0, Math.min(100, margin));
  const cls = margin < 0 ? 'over' : margin < target ? 'warn' : '';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
      <div className={`ws-bar ${cls}`} style={{ width: '72px' }}><span style={{ width: `${pct}%` }} /></div>
      <span style={{ fontWeight: 600, color: 'var(--text-main)', minWidth: '52px', textAlign: 'right' }}>{fmtPctVal(margin)}</span>
    </div>
  );
}

const TOOLS = [
  { id: 'price', label: t('pris.toolPrice'), title: t('ui.vilket_pris_ska_jag_ta') },
  { id: 'discount', label: t('pris.toolDiscount'), title: t('ui.vad_tal_jag_for_rabatt') },
  { id: 'breakeven', label: t('pris.toolBreakeven'), title: t('ui.hur_manga_maste_jag_salja') },
  { id: 'hourly', label: t('pris.toolHourly'), title: t('ui.vilket_timpris_behover_jag') },
  { id: 'batch', label: t('pris.toolBatch'), title: t('pris.toolBatchTitle') },
];

// Flera inköpspriser på en gång: ett per rad, gärna inklistrat från Excel.
// Det sista talet på raden är inköpspriset, texten före blir benämning.
export function parseBatch(text) {
  return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const m = line.match(/(-?\d[\d\s]*(?:[.,]\d+)?)\s*(?:kr)?\s*$/i);
    if (!m) return null;
    const cost = Number(m[1].replace(/\s/g, '').replace(',', '.'));
    const label = line.slice(0, m.index).replace(/[\t;:,]+$/, '').trim();
    return Number.isFinite(cost) && cost > 0 ? { label, cost } : null;
  }).filter(Boolean);
}

/**
 * Prissättning — flik under Artiklar (2026-10-17). Överst dina artiklar med
 * marginalen som en stapel mot målet och ett förslag att klicka på när en
 * ligger under. Under det EN räknare med fyra flikar (pris, rabatt,
 * nollpunkt, timpris) i stället för fyra kort med fält bredvid varandra:
 * fälten till vänster, svaret stort till höger. Räkningen ligger i
 * utils/pricing.js.
 */
export default function PricingTool({ articles = [], setArticles, company, setCompanyInfo }) {
  const targetMargin = company?.pricingSettings?.targetMargin ?? 30;
  const setTarget = (v) => setCompanyInfo(prev => ({ ...prev, pricingSettings: { ...(prev.pricingSettings || {}), targetMargin: v === '' ? '' : Number(v) } }));

  const rows = useMemo(() => articles
    .map(a => ({ ...a, info: pricingStatus(a, targetMargin) }))
    .filter(a => Number(a.purchasePrice) > 0 || a.type === 'vara')
    .sort((a, b) => (a.info.margin ?? 999) - (b.info.margin ?? 999)), [articles, targetMargin]);
  const belowCount = rows.filter(a => ['below', 'loss'].includes(a.info.status)).length;

  const applySuggestion = (article, price) => {
    setArticles(prev => prev.map(a => ((a.id && a.id === article.id) ? { ...a, unitPrice: price } : a)));
  };

  const [tool, setTool] = useState('price');
  // Räkna ut öppnas som en ruta i stället för att ligga längst ner (2026-11-24).
  const [calcOpen, setCalcOpen] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [bulkEdit, setBulkEdit] = useState(null);
  const [editing, setEditing] = useState(null); // { key, value }

  // ── Prisräknare ──
  const [cost, setCost] = useState('');
  // Vald artikel i Räkna ut (valfritt): inköpspriset fylls i och det nya priset kan sparas.
  const [calcArticle, setCalcArticle] = useState(null);
  const [calcQuery, setCalcQuery] = useState('');
  const [mode, setMode] = useState('margin');
  const [target, setTargetPct] = useState(40);
  const [vat, setVat] = useState(25);
  const [rounding, setRounding] = useState('none');
  const raw = mode === 'margin' ? priceFromMargin(cost, target) : priceFromMarkup(cost, target);
  const price = raw == null ? null : roundPrice(raw, rounding);

  // ── Rabatt ──
  const [dPrice, setDPrice] = useState('');
  const [dCost, setDCost] = useState('');
  const [dPct, setDPct] = useState(10);
  const [dMin, setDMin] = useState(20);

  // ── Nollpunkt ──
  const [fixed, setFixed] = useState('');
  const [bePrice, setBePrice] = useState('');
  const [beVar, setBeVar] = useState('');
  const units = breakEvenUnits(fixed, bePrice, beVar);

  // ── Timpris ──
  const [monthlyCosts, setMonthlyCosts] = useState('');
  const [pay, setPay] = useState('');
  const [hours, setHours] = useState(100);
  const [buffer, setBuffer] = useState(10);
  const rate = hourlyRate({ monthlyCosts, desiredMonthlyPay: pay, billableHoursPerMonth: hours, bufferPct: buffer });

  const palette = usePalette(company);
  const goal = Number(targetMargin) || 0;
  const withMargin = rows.filter(a => a.info.margin != null);
  const avgMargin = withMargin.length ? withMargin.reduce((sum, a) => sum + a.info.margin, 0) / withMargin.length : null;
  // Dina priser som tabell (2026-11-24): korten fungerade inte med hundratals
  // artiklar. Sök, filter, sortering, sidor och höj alla under målet.
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'margin', dir: 1 });
  const [page, setPage] = useState(0);
  const [raiseRound, setRaiseRound] = useState('krona');
  const PAGE = 50;
  const keyOf = (a) => a.id || a.articleNumber || a.description;
  const isBelow = (a) => ['below', 'loss'].includes(a.info.status);
  const counts = {
    all: rows.length,
    below: rows.filter(a => a.info.status === 'below').length,
    loss: rows.filter(a => a.info.status === 'loss').length,
    ok: rows.filter(a => a.info.status === 'ok').length,
    no_cost: rows.filter(a => a.info.status === 'no_cost' || a.info.status === 'no_price').length,
  };
  const visible = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter(a => {
      if (filter === 'below' && a.info.status !== 'below') return false;
      if (filter === 'loss' && a.info.status !== 'loss') return false;
      if (filter === 'ok' && a.info.status !== 'ok') return false;
      if (filter === 'no_cost' && !['no_cost', 'no_price'].includes(a.info.status)) return false;
      if (!words.length) return true;
      const hay = `${a.articleNumber || ''} ${a.description || ''} ${a.supplier || ''}`.toLowerCase();
      return words.every(w => hay.includes(w));
    });
    const val = (a) => (sort.key === 'description' ? (a.description || '').toLowerCase()
      : sort.key === 'unitPrice' ? Number(a.unitPrice) || 0
      : sort.key === 'purchasePrice' ? Number(a.purchasePrice) || 0
      : sort.key === 'articleNumber' ? String(a.articleNumber || '').padStart(12, '0')
      : a.info.margin ?? 1e9);
    return [...list].sort((x, y) => { const a = val(x); const b = val(y); return (a < b ? -1 : a > b ? 1 : 0) * sort.dir; });
  }, [rows, q, filter, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shownRows = visible.slice(cur * PAGE, cur * PAGE + PAGE);
  const sortBy = (key) => setSort(st => (st.key === key ? { key, dir: -st.dir } : { key, dir: key === 'description' || key === 'articleNumber' || key === 'margin' ? 1 : -1 }));
  const raiseTargets = visible.filter(a => isBelow(a) && a.info.suggested);
  const raiseAll = async () => {
    if (!raiseTargets.length) return;
    if (!(await confirmDialog(t('pris.raiseAllConfirm', { n: raiseTargets.length, goal }), { title: t('pris.raiseAllTitle'), confirmLabel: t('pris.raiseAllBtn', { n: raiseTargets.length }) }))) return;
    const before = articles;
    const next = new Map(raiseTargets.map(a => [keyOf(a), roundPrice(a.info.suggested, raiseRound)]));
    setArticles(prev => prev.map(a => (next.has(keyOf(a)) ? { ...a, unitPrice: next.get(keyOf(a)) } : a)));
    showUndo({ message: t('pris.raised', { n: next.size }), onUndo: () => setArticles(before) });
  };
  const applyOne = (a) => {
    const before = articles;
    applySuggestion(a, roundPrice(a.info.suggested, raiseRound));
    showUndo({ message: t('pris.raisedOne', { name: a.description }), onUndo: () => setArticles(before) });
  };
  const pickedRows = rows.filter(a => picked.has(keyOf(a)));
  const allShownPicked = shownRows.length > 0 && shownRows.every(a => picked.has(keyOf(a)));
  const togglePick = (a) => setPicked(prev => { const n = new Set(prev); const k = keyOf(a); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const togglePage = () => setPicked(prev => { const n = new Set(prev); shownRows.forEach(a => (allShownPicked ? n.delete(keyOf(a)) : n.add(keyOf(a)))); return n; });
  const saveBulk = (patches) => {
    const before = articles;
    setArticles(prev => prev.map(x => (patches.has(keyOf(x)) ? { ...x, ...patches.get(keyOf(x)) } : x)));
    setBulkEdit(null); setPicked(new Set());
    showUndo({ message: t('artEdit.saved', { n: patches.size }), onUndo: () => setArticles(before) });
  };
  // Pris direkt i raden: klicka på priset, skriv, Enter sparar, Esc avbryter.
  const saveInline = () => {
    if (!editing) return;
    const v = Number(String(editing.value).replace(/\s/g, '').replace(',', '.'));
    const a = rows.find(x => keyOf(x) === editing.key);
    setEditing(null);
    if (!a || !Number.isFinite(v) || v < 0 || v === Number(a.unitPrice)) return;
    const before = articles;
    setArticles(prev => prev.map(x => (keyOf(x) === keyOf(a) ? { ...x, unitPrice: Math.round(v * 100) / 100 } : x)));
    showUndo({ message: t('pris.changedOne', { name: a.description }), onUndo: () => setArticles(before) });
  };
  const batch = parseBatch(batchText).map(b => {
    const rawP = mode === 'margin' ? priceFromMargin(b.cost, target) : priceFromMarkup(b.cost, target);
    const pr = rawP == null ? null : roundPrice(rawP, rounding);
    return { ...b, price: pr, incl: pr == null ? null : withVat(pr, vat), margin: pr == null ? null : marginPct(pr, b.cost), profit: pr == null ? null : pr - b.cost };
  });
  const copyBatch = () => {
    const tsv = [[t('ui.benamning'), t('ui.inkopspris'), t('ui.pris_exkl_moms'), t('ui.pris_inkl_moms')].join('\t'), ...batch.map(b => [b.label, fmt(b.cost), b.price == null ? '' : fmt(b.price), b.incl == null ? '' : fmt(b.incl)].join('\t'))].join('\n');
    try { navigator.clipboard?.writeText(tsv); } catch { /* ingen urklippsåtkomst */ }
  };

  const Th = ({ k, children, className = '' }) => (
    <th className={`${className} ar-sortable`} onClick={() => sortBy(k)} aria-sort={sort.key === k ? (sort.dir > 0 ? 'ascending' : 'descending') : undefined}>
      <span>{children}{sort.key === k && (sort.dir > 0 ? <ChevronUp size={13} /> : <ChevronDown size={13} />)}</span>
    </th>
  );

  return (
    <div className="ws-page ws-edge">
      <Panel title={t('pris.yourPrices')}
        sub={rows.length === 0 ? t('pris.yourPricesEmpty') : belowCount > 0 ? t('pris.belowCount', { n: belowCount }) : t('pris.allOk')}
        actions={<>
          <button type="button" className="agi-btn" onClick={() => setCalcOpen(true)}><Calculator size={15} /> {t('pris.calculator')}</button>
          <label className="ws-hint" htmlFor="pz-target" style={{ fontWeight: 600, color: 'var(--text-main)' }}>{t('pris.target')}</label>
          <div className="ws-input-suffix" style={{ width: '92px' }}>
            <input id="pz-target" type="number" className="ws-input" style={{ height: '36px' }} value={num(targetMargin)} onChange={e => setTarget(e.target.value)} />
            <span>%</span>
          </div>
        </>}>
        <KpiGrid>
          <Kpi dot={palette.profit} label={t('pris.avgMargin')} value={fmtPctVal(avgMargin)} sub={t('pris.targetIs', { n: goal })} />
          <Kpi dot={palette.costBar} label={t('pris.below')} value={belowCount} sub={t('pris.belowSub')} negative={belowCount > 0 && rows.some(a => a.info.status === 'loss')} />
          <Kpi dot={palette.income} label={t('ui.artiklar')} value={rows.length} sub={t('pris.withCost', { n: withMargin.length })} />
        </KpiGrid>
        {rows.length > 0 && (
          <div className="pz-table">
            <div className="ar-tools pz-tools-row">
              <label className="ar-search">
                <Search size={15} aria-hidden="true" />
                <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }} placeholder={t('pris.search')} aria-label={t('pris.search')} />
                {q && <button type="button" onClick={() => setQ('')} aria-label={t('ui.rensa')}><X size={14} /></button>}
              </label>
              <div className="ar-chips" role="tablist">
                {[['all', t('artReg.all'), counts.all], ['below', t('ui.under_malet'), counts.below], ['loss', t('ui.saljs_med_forlust'), counts.loss], ['ok', t('ui.nar_malet'), counts.ok], ['no_cost', t('ui.inkopspris_saknas'), counts.no_cost]]
                  .filter(([id, , n]) => id === 'all' || n > 0 || filter === id)
                  .map(([id, label, n]) => (
                    <button key={id} type="button" role="tab" aria-selected={filter === id} className={`ar-chip${filter === id ? ' on' : ''}${id === 'loss' ? ' is-out' : id === 'below' ? ' is-low' : ''}`} onClick={() => { setFilter(id); setPage(0); }}>{label}<span>{n}</span></button>
                  ))}
              </div>
              {raiseTargets.length > 0 && (
                <div className="pz-raise">
                  <select className="ar-select" value={raiseRound} onChange={e => setRaiseRound(e.target.value)} aria-label={t('pris.rounding')}>
                    <option value="krona">{t('pris.roundKrona')}</option>
                    <option value="nine">{t('pris.roundNine')}</option>
                    <option value="none">{t('pris.roundNone')}</option>
                  </select>
                  <button type="button" className="agi-btn primary" onClick={raiseAll}><TrendingUp size={14} /> {t('pris.raiseAllBtn', { n: raiseTargets.length })}</button>
                </div>
              )}
            </div>
            {picked.size > 0 && (
              <div className="ar-bulk pz-bulk" role="toolbar">
                <strong>{t('artReg.selected', { n: picked.size })}</strong>
                <button type="button" onClick={() => setBulkEdit({ focusPrices: false })}><Pencil size={14} /> {t('artEdit.edit')}</button>
                <button type="button" onClick={() => setBulkEdit({ focusPrices: true })}><Percent size={14} /> {t('artReg.updatePrices')}</button>
                <button type="button" className="ar-bulk-x" onClick={() => setPicked(new Set())} aria-label={t('artReg.clear')}><X size={16} /></button>
              </div>
            )}
            {visible.length === 0 ? <p className="ar-none">{t('ui.inga_artiklar_matchar_sokningen')}</p> : (
              <div className="ar-table-wrap">
                <table className="ar-table">
                  <thead>
                    <tr>
                      <th className="ar-cb"><input type="checkbox" checked={allShownPicked} onChange={togglePage} aria-label={t('artReg.pickAll')} /></th>
                      <Th k="articleNumber" className="ar-num-col">{t('ui.artikelnr')}</Th>
                      <Th k="description">{t('ui.benamning')}</Th>
                      <Th k="purchasePrice" className="r ar-w-cost ar-hide-md">{t('artReg.cost')}</Th>
                      <Th k="unitPrice" className="r ar-w-price">{t('artReg.price')}</Th>
                      <Th k="margin" className="pz-w-margin">{t('ui.marginal')}</Th>
                      <th className="r pz-w-sugg">{t('pris.suggestion')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownRows.map(a => {
                      const m = a.info.margin;
                      const st = STATUS[a.info.status];
                      const color = m == null ? 'var(--border)' : m < 0 ? 'var(--status-red-text)' : m < goal ? '#f0a830' : palette.profit;
                      return (
                        <tr key={keyOf(a)} className={picked.has(keyOf(a)) ? 'on' : ''} style={{ cursor: 'default' }}>
                          <td className="ar-cb"><input type="checkbox" checked={picked.has(keyOf(a))} onChange={() => togglePick(a)} aria-label={a.description} /></td>
                          <td className="ar-num">{a.articleNumber || '–'}</td>
                          <td className="ar-name"><strong>{a.description}</strong><small>{[a.type === 'vara' ? t('artReg.goodsOne') : t('artReg.serviceOne'), a.unit, a.supplier].filter(Boolean).join(' · ')}</small></td>
                          <td className="r ar-hide-md ar-muted">{a.purchasePrice ? `${fmt(a.purchasePrice)} kr` : '–'}</td>
                          <td className="r ar-price pz-price-cell">
                            {editing?.key === keyOf(a) ? (
                              <input className="ws-input pz-inline" autoFocus inputMode="decimal" value={editing.value}
                                onChange={e => setEditing(x => ({ ...x, value: e.target.value }))}
                                onKeyDown={e => { if (e.key === 'Enter') saveInline(); if (e.key === 'Escape') setEditing(null); }}
                                onBlur={saveInline} aria-label={t('artReg.price')} />
                            ) : (
                              <button type="button" className="pz-price-btn" title={t('pris.editPrice')} onClick={() => setEditing({ key: keyOf(a), value: Number(a.unitPrice) > 0 ? String(a.unitPrice).replace('.', ',') : '' })}>
                                {Number(a.unitPrice) > 0 ? `${fmt(a.unitPrice)} kr` : <span className="ar-missing">{t('artReg.noPriceShort')}</span>}
                                <Pencil size={12} />
                              </button>
                            )}
                          </td>
                          <td className="pz-margin">
                            {m == null ? <span className={`agi-pill ${st.cls}`}>{st.label}</span> : (
                              <span className="pz-m">
                                <span className="pz-m-track"><span style={{ width: `${Math.max(2, Math.min(100, m))}%`, background: color }} /><em style={{ left: `${Math.max(0, Math.min(100, goal))}%` }} /></span>
                                <b style={{ color: m < 0 ? 'var(--status-red-text)' : undefined }}>{fmtPctVal(m)}</b>
                              </span>
                            )}
                          </td>
                          <td className="r">
                            {isBelow(a) && a.info.suggested
                              ? <button type="button" className="pz-sugg" onClick={() => applyOne(a)}>{t('pris.setTo', { kr: fmt(roundPrice(a.info.suggested, raiseRound)) })}</button>
                              : a.info.status === 'ok' ? <span className="pz-ok">{t('ui.nar_malet')}</span> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pages > 1 && (
              <div className="ar-foot">
                <span>{t('artReg.showing', { from: cur * PAGE + 1, to: Math.min(visible.length, (cur + 1) * PAGE), n: visible.length })}</span>
                <span className="ar-pager">
                  <button type="button" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label={t('artReg.prev')}><ChevronLeft size={16} /></button>
                  <span>{cur + 1} / {pages}</span>
                  <button type="button" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label={t('artReg.next')}><ChevronRight size={16} /></button>
                </span>
              </div>
            )}
          </div>
        )}
      </Panel>

      {calcOpen && (
      <div className="modal-overlay" onClick={() => setCalcOpen(false)}>
      <div className="modal-content pz-calc-modal" style={{ maxWidth: '920px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div><span className="modal-title">{t('pris.calculator')}</span><p className="wsp-sub" style={{ margin: '4px 0 0' }}>{t(`pris.${tool}Intro`)}</p></div>
          <button type="button" className="modal-close" onClick={() => setCalcOpen(false)} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <div className="pz-tools">
          {TOOLS.map(x => (
            <button key={x.id} type="button" className={tool === x.id ? 'on' : ''} onClick={() => setTool(x.id)}>
              <strong>{x.label}</strong><span>{x.title}</span>
            </button>
          ))}
        </div>
        <div className="ws-cols" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', display: tool === 'batch' ? 'none' : undefined }}>
          {tool === 'price' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <div>
                <label className="ws-label">{t('pris.pickArticle')}</label>
                <ArticleCombobox articles={articles} value={calcQuery} className="ws-input" placeholder={t('pris.pickArticlePlaceholder')}
                  onChange={v => { setCalcQuery(v); if (!v) setCalcArticle(null); }}
                  onPick={a => { setCalcArticle(a); setCalcQuery(a.description); if (Number(a.purchasePrice) > 0) setCost(String(a.purchasePrice)); }} />
              </div>
              <Field label={t('ui.inkopspris_kostnad_kr')} value={cost} onChange={v => { setCost(v); }} suffix="kr" />
              <div className="ws-grid2">
                <div>
                  <label className="ws-label">{t('ui.utga_fran')}</label>
                  <select className="ws-input" value={mode} onChange={e => setMode(e.target.value)}>
                    <option value="margin">{t('ui.marginal')}</option>
                    <option value="markup">{t('ui.paslag')}</option>
                  </select>
                </div>
                <Field label={t('ui.procent')} value={target} onChange={setTargetPct} suffix="%" />
              </div>
              <div className="ws-grid2">
                <div>
                  <label className="ws-label">{t('ui.moms')}</label>
                  <select className="ws-input" value={vat} onChange={e => setVat(Number(e.target.value))}>{[0, 6, 12, 25].map(r => <option key={r} value={r}>{r} %</option>)}</select>
                </div>
                <div>
                  <label className="ws-label">{t('ui.avrunda')}</label>
                  <select className="ws-input" value={rounding} onChange={e => setRounding(e.target.value)}>
                    <option value="none">{t('ui.ingen')}</option><option value="krona">{t('ui.hel_krona')}</option><option value="nine">{t('ui.slutar_pa_9')}</option>
                  </select>
                </div>
              </div>
            </div>
            <Result
              title={t('ui.pris_exkl_moms')}
              value={price != null && Number(cost) > 0 ? `${fmt(price)} kr` : null}
              empty={t('pris.priceEmpty')}
              error={price == null ? t('ui.en_marginal_pa_100_eller_mer_gar_inte_att_na') : null}
              lines={price != null ? [
                [t('ui.pris_inkl_moms'), `${fmt(withVat(price, vat))} kr`],
                [t('ui.marginal'), fmtPctVal(marginPct(price, cost))],
                [t('ui.paslag'), fmtPctVal(markupPct(price, cost))],
                [t('ui.vinst_per_enhet'), `${fmt(price - cost)} kr`],
                ...(calcArticle ? [[t('pris.currentPrice'), `${fmt(calcArticle.unitPrice)} kr (${fmtPctVal(marginPct(calcArticle.unitPrice, cost))})`]] : []),
              ] : []}
            />
            {calcArticle && price != null && Number(cost) > 0 && (
              <div className="pz-calc-save">
                <button type="button" className="agi-btn primary" onClick={() => {
                  const before = articles;
                  const k = keyOf(calcArticle);
                  setArticles(prev => prev.map(x => (keyOf(x) === k ? { ...x, unitPrice: price, purchasePrice: Number(cost) || x.purchasePrice } : x)));
                  setCalcArticle({ ...calcArticle, unitPrice: price });
                  showUndo({ message: t('pris.changedOne', { name: calcArticle.description }), onUndo: () => setArticles(before) });
                }}>{t('pris.saveAsPrice', { kr: fmt(price) })}</button>
              </div>
            )}
          </>}

          {tool === 'discount' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <div className="ws-grid2">
                <Field label={t('ui.pris_kr')} value={dPrice} onChange={setDPrice} suffix="kr" />
                <Field label={t('ui.kostnad_kr')} value={dCost} onChange={setDCost} suffix="kr" />
              </div>
              <div className="ws-grid2">
                <Field label={t('ui.rabatt_procent')} value={dPct} onChange={setDPct} suffix="%" />
                <Field label={t('ui.lagsta_marginal')} value={dMin} onChange={setDMin} suffix="%" />
              </div>
            </div>
            <Result
              title={t('ui.marginal_efter_rabatt', { v0: dPct || 0 })}
              value={Number(dPrice) > 0 && Number(dCost) > 0 ? fmtPctVal(marginAfterDiscount(dPrice, dCost, dPct)) : null}
              empty={t('pris.discountEmpty')}
              lines={[
                [t('ui.marginal_utan_rabatt'), fmtPctVal(marginPct(dPrice, dCost))],
                [t('ui.hogsta_rabatt_for_marginal', { v0: dMin || 0 }), fmtPctVal(maxDiscountForMargin(dPrice, dCost, dMin))],
              ]}
            />
          </>}

          {tool === 'breakeven' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <Field label={t('ui.fasta_kostnader_kr')} value={fixed} onChange={setFixed} suffix="kr" />
              <div className="ws-grid2">
                <Field label={t('ui.pris_per_enhet_kr')} value={bePrice} onChange={setBePrice} suffix="kr" />
                <Field label={t('ui.rorlig_kostnad_per_enhet_kr')} value={beVar} onChange={setBeVar} suffix="kr" />
              </div>
            </div>
            <Result
              title={t('ui.enheter_for_att_ga_runt')}
              value={Number(fixed) > 0 && Number(bePrice) > 0 && units != null ? `${units} st` : null}
              empty={t('pris.breakevenEmpty')}
              error={Number(fixed) > 0 && Number(bePrice) > 0 && units == null ? t('ui.varje_sald_enhet_ger_forlust_da_gar_det_aldrig_r') : null}
              lines={[[t('ui.tackningsbidrag_per_enhet'), `${fmt(bePrice - (Number(beVar) || 0))} kr`]]}
            />
          </>}

          {tool === 'hourly' && <>
            <div className="ws-form" style={{ gap: '14px' }}>
              <div className="ws-grid2">
                <Field label={t('ui.kostnader_per_manad_kr')} value={monthlyCosts} onChange={setMonthlyCosts} suffix="kr" />
                <Field label={t('ui.onskat_uttag_per_manad_kr')} value={pay} onChange={setPay} suffix="kr" />
              </div>
              <div className="ws-grid2">
                <Field label={t('ui.debiterbara_timmar_manad')} value={hours} onChange={setHours} suffix="h" />
                <Field label={t('ui.buffert')} value={buffer} onChange={setBuffer} suffix="%" />
              </div>
            </div>
            <Result
              title={t('ui.timpris_exkl_moms')}
              value={rate != null && (Number(monthlyCosts) > 0 || Number(pay) > 0) ? `${fmt(rate)} kr` : null}
              empty={t('pris.hourlyEmpty')}
              lines={rate != null ? [[t('ui.timpris_inkl_25_moms'), `${fmt(withVat(rate, 25))} kr`]] : []}
            />
          </>}
        </div>
        {tool === 'batch' && (
          <div className="pz-batch">
            <div className="pz-batch-settings">
              <label><span className="ws-label">{t('ui.utga_fran')}</span>
                <select className="ws-input" value={mode} onChange={e => setMode(e.target.value)}><option value="margin">{t('ui.marginal')}</option><option value="markup">{t('ui.paslag')}</option></select></label>
              <label><span className="ws-label">{t('ui.procent')}</span><div className="ws-input-suffix"><input className="ws-input" inputMode="decimal" value={target} onChange={e => setTargetPct(e.target.value)} /><span>%</span></div></label>
              <label><span className="ws-label">{t('ui.moms')}</span>
                <select className="ws-input" value={vat} onChange={e => setVat(Number(e.target.value))}>{[0, 6, 12, 25].map(v => <option key={v} value={v}>{v} %</option>)}</select></label>
              <label><span className="ws-label">{t('ui.avrunda')}</span>
                <select className="ws-input" value={rounding} onChange={e => setRounding(e.target.value)}><option value="none">{t('ui.ingen')}</option><option value="krona">{t('ui.hel_krona')}</option><option value="nine">{t('ui.slutar_pa_9')}</option></select></label>
            </div>
            <div className="pz-batch-body">
              <label className="pz-batch-input"><span className="ws-label">{t('pris.batchInput')}</span>
                <textarea className="ws-input" rows={10} value={batchText} placeholder={t('pris.batchPlaceholder')} onChange={e => setBatchText(e.target.value)} />
                <small className="ws-hint">{t('pris.batchHint')}</small>
              </label>
              <div className="pz-batch-out">
                {batch.length === 0 ? <p className="ws-hint">{t('pris.batchEmpty')}</p> : (
                  <>
                    <table className="ar-table pz-batch-table">
                      <thead><tr><th>{t('ui.benamning')}</th><th className="r">{t('ui.inkopspris')}</th><th className="r">{t('pris.exVat')}</th><th className="r">{t('pris.inclVat')}</th><th className="r">{t('ui.marginal')}</th></tr></thead>
                      <tbody>
                        {batch.map((b, i) => (
                          <tr key={i} style={{ cursor: 'default' }}>
                            <td>{b.label || <span className="ar-muted">{t('pris.rowN', { n: i + 1 })}</span>}</td>
                            <td className="r ar-muted">{fmt(b.cost)} kr</td>
                            <td className="r ar-price">{b.price == null ? '–' : `${fmt(b.price)} kr`}</td>
                            <td className="r">{b.incl == null ? '–' : `${fmt(b.incl)} kr`}</td>
                            <td className="r ar-muted">{fmtPctVal(b.margin)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button type="button" className="agi-btn" onClick={copyBatch} style={{ marginTop: '10px' }}><Copy size={14} /> {t('pris.copyResult', { n: batch.length })}</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      )}
      {bulkEdit && (
        <ArticleBulkEdit items={pickedRows} keyOf={keyOf} focusPrices={bulkEdit.focusPrices} onSave={saveBulk} onClose={() => setBulkEdit(null)} />
      )}
    </div>
  );
}
