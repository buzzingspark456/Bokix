import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, Trash2, Pencil, X, CalendarClock, Package, PackageMinus } from './icons';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import { Panel, Kpi, KpiGrid, usePalette } from './shared/Workspace';
import {
  ASSET_CATEGORIES, categoryById, monthlyAmount, accumulatedThrough, bookValueAt, scheduleOf,
  pendingDepreciation, buildDepreciationVerification, buildDisposalVerification,
  bookedDepreciationMap, unregisteredAcquisitions, registerSummary, round2,
} from '../utils/fixedAssets';
import { t, dateLocale } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(v || 0))} kr`;
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const lastCompletedMonth = () => { const d = new Date(); return monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)); };
const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtMonth = (ym) => (ym ? new Date(`${ym}-01T00:00:00`).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }) : '');
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const emptyAsset = () => {
  const cat = categoryById('inventarier');
  return {
    id: newId(), name: '', category: cat.id, acquisitionDate: todayIso(), cost: '', residualValue: 0,
    usefulLifeMonths: cat.lifeMonths, assetAccount: cat.assetAccount, accumulatedAccount: cat.accumulatedAccount,
    expenseAccount: cat.expenseAccount, note: '',
  };
};

// Var tillgången står just nu: avskrivs, fullt avskriven eller avyttrad.
function assetState(asset, ym) {
  if (asset.disposedDate) return 'disposed';
  const base = (Number(asset.cost) || 0) - (Number(asset.residualValue) || 0);
  return accumulatedThrough(asset, ym) >= base - 0.005 ? 'done' : 'active';
}

/**
 * Anläggningsregister med avskrivningar — flik under Bokföring.
 * Räkningen ligger i utils/fixedAssets.js; här är bara vyerna. Stilen är
 * arbetsytornas (workspace.css): kant i kant, startsidans grå rutor, och
 * varje tillgång på en egen sida från höger som en vara i Lager.
 */
export default function FixedAssets({ company, accounts = [], verifications = [], onAddVerification, setCompanyInfo }) {
  const palette = usePalette(company);
  const assets = useMemo(() => company?.fixedAssets || [], [company?.fixedAssets]);
  // Vilket låst räkenskapsår datumet ligger i (null om inget), se utils/fiscalYear.js.
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [disposing, setDisposing] = useState(false);
  const [untilMonth, setUntilMonth] = useState(lastCompletedMonth());
  const [filter, setFilter] = useState('inUse');
  const [error, setError] = useState('');

  const saveAssets = (next) => setCompanyInfo(prev => ({ ...prev, fixedAssets: next }));
  const bookedMap = useMemo(() => bookedDepreciationMap(verifications), [verifications]);
  const hasBooked = (assetId) => [...bookedMap.values()].some(set => set.has(assetId));
  const accountName = (code) => accounts.find(a => a.code === code)?.name || '';

  const thisMonth = monthKey(new Date());
  const pending = useMemo(() => pendingDepreciation(assets, verifications, untilMonth, company?.lockedFiscalYears), [assets, verifications, untilMonth, company?.lockedFiscalYears]);
  const suggestions = useMemo(() => unregisteredAcquisitions(verifications, assets), [verifications, assets]);
  const summary = useMemo(() => registerSummary(assets, thisMonth), [assets, thisMonth]);
  const rows = useMemo(() => assets
    .map(a => ({ ...a, state: assetState(a, thisMonth), accumulated: accumulatedThrough(a, thisMonth), bookValue: bookValueAt(a, thisMonth) }))
    .sort((a, b) => String(b.acquisitionDate).localeCompare(String(a.acquisitionDate))), [assets, thisMonth]);
  const inUse = rows.filter(r => r.state !== 'disposed');
  const perMonth = round2(inUse.filter(r => r.state === 'active').reduce((s, r) => s + monthlyAmount(r), 0));
  const shown = rows.filter(r => filter === 'all' || (filter === 'disposed' ? r.state === 'disposed' : r.state !== 'disposed'));
  const count = (id) => rows.filter(r => id === 'all' || (id === 'disposed' ? r.state === 'disposed' : r.state !== 'disposed')).length;
  const open = openId ? rows.find(r => r.id === openId) : null;

  const startNew = (prefill = {}) => {
    const base = emptyAsset();
    const cat = categoryById(prefill.category || base.category);
    setEditing({
      ...base, ...prefill, category: cat.id, usefulLifeMonths: cat.lifeMonths,
      assetAccount: prefill.assetAccount || cat.assetAccount,
      accumulatedAccount: cat.accumulatedAccount, expenseAccount: cat.expenseAccount,
    });
    setIsNew(true); setError('');
  };
  const startEdit = (asset) => {
    const { state: _s, accumulated: _a, bookValue: _b, ...clean } = asset;
    setEditing({ ...clean }); setIsNew(false); setError('');
  };

  const changeCategory = (id) => {
    const cat = categoryById(id);
    setEditing(e => ({
      ...e, category: id, usefulLifeMonths: cat.lifeMonths,
      assetAccount: cat.assetAccount, accumulatedAccount: cat.accumulatedAccount, expenseAccount: cat.expenseAccount,
    }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    const cost = Number(editing.cost);
    const life = Math.round(Number(editing.usefulLifeMonths));
    if (!editing.name.trim()) return setError(t('ui.ange_ett_namn_pa_tillgangen'));
    if (!(cost > 0)) return setError(t('ui.anskaffningsvardet_maste_vara_storre_an_0'));
    if (!(life >= 1)) return setError(t('ui.livslangden_maste_vara_minst_1_manad'));
    if (Number(editing.residualValue) >= cost) return setError(t('ui.restvardet_maste_vara_lagre_an_anskaffningsvarde'));
    if (!editing.acquisitionDate) return setError(t('ui.ange_anskaffningsdatum'));
    const clean = { ...editing, name: editing.name.trim(), cost, usefulLifeMonths: life, residualValue: Number(editing.residualValue) || 0 };
    saveAssets(isNew ? [...assets, clean] : assets.map(a => (a.id === clean.id ? clean : a)));
    setEditing(null); setError('');
  };

  const handleDelete = async (asset) => {
    if (hasBooked(asset.id)) return;
    if (!(await confirmDialog(t('ui.ta_bort_ur_registret', { name: asset.name })))) return;
    saveAssets(assets.filter(a => a.id !== asset.id));
    setOpenId(null);
  };

  const bookPending = async () => {
    if (pending.months.length === 0) return;
    const n = pending.months.length;
    if (!(await confirmDialog(t('ui.bokfor_avskrivningar_for_totalt_kr', { n, v1: n === 1 ? 'månad' : 'månader', v2: fmt(pending.total) })))) return;
    pending.months.forEach(m => onAddVerification(buildDepreciationVerification(m.month, m.items)));
  };

  const handleDispose = async (asset, { date, proceeds }) => {
    const disposalMonth = date.slice(0, 7);
    const conflict = [...bookedMap.entries()].some(([month, ids]) => ids.has(asset.id) && month >= disposalMonth);
    if (conflict) return setError(t('ui.avskrivningar_ar_redan_bokforda_for_manaden_da_t'));
    if (date < asset.acquisitionDate) return setError(t('ui.avyttringsdatum_kan_inte_vara_fore_anskaffningsd'));
    if (lockedFor(date)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(date) }));
    const pricing = Number(proceeds) || 0;
    onAddVerification(buildDisposalVerification(asset, { date, proceeds: pricing }));
    saveAssets(assets.map(a => (a.id === asset.id ? { ...a, disposedDate: date, disposalProceeds: pricing } : a)));
    setDisposing(false); setError('');
  };

  const statusPill = (r) => (r.state === 'disposed' ? <span className="agi-pill mute">{t('fa.pillDisposed')}</span>
    : r.state === 'done' ? <span className="agi-pill ok">{t('fa.pillDone')}</span>
      : <span className="agi-pill mute">{t('fa.pillActive')}</span>);
  const depreciatedPct = (r) => {
    const base = (Number(r.cost) || 0) - (Number(r.residualValue) || 0);
    return base > 0 ? Math.max(0, Math.min(100, Math.round((r.accumulated / base) * 100))) : 0;
  };
  const catColor = (r) => (r.state === 'disposed' ? 'var(--text-muted)' : r.state === 'done' ? palette.profit : palette.income);
  const hasTodo = (assets.length > 0 && pending.months.length > 0) || suggestions.length > 0;

  return (
    <div className="ws-page ws-edge">
      <Panel
        title={t('ui.anlaggningstillgangar')}
        sub={inUse.length === 1 ? t('fa.subOne') : t('fa.subMany', { n: inUse.length })}
        actions={<button type="button" className="agi-btn primary" onClick={() => startNew()}><Plus size={14} /> {t('ui.ny_tillgang')}</button>}
      >
        <KpiGrid>
          <Kpi dot={palette.income} label={t('ui.anskaffningsvarde')} value={fmtKr(summary.cost)} sub={t('fa.kpiCostSub', { n: inUse.length })} />
          <Kpi dot={palette.cost} label={t('fa.kpiAccumulated')} value={fmtKr(summary.accumulated)} sub={summary.cost > 0 ? t('fa.kpiAccumulatedSub', { pct: Math.round((summary.accumulated / summary.cost) * 100) }) : '—'} />
          <Kpi dot={palette.profit} label={t('ui.bokfort_varde')} value={fmtKr(summary.bookValue)} sub={t('fa.kpiBookSub', { month: fmtMonth(thisMonth) })} />
          <Kpi dot={palette.cost} label={t('fa.kpiMonthly')} value={fmtKr(perMonth)} sub={t('fa.kpiMonthlySub', { kr: fmtKr(perMonth * 12) })} />
        </KpiGrid>

        {hasTodo && (
          <div className="lg-todo">
            <div className="lg-todo-title">{t('lager.todo')}</div>
            {assets.length > 0 && pending.months.length > 0 && (
              <div className="dash-today-btn dash-today-btn--warn lg-todo-row" style={{ cursor: 'default' }}>
                <span className="dash-today-lines">
                  <span className="dash-today-kicker">{t('fa.depKicker')}</span>
                  <span className="dash-today-title">{pending.months.length === 1 ? t('fa.depOne', { kr: fmtKr(pending.total) }) : t('fa.depMany', { n: pending.months.length, kr: fmtKr(pending.total) })}</span>
                  <span className="dash-today-detail fa-until">
                    {t('ui.fram_till_och_med')}
                    <input type="month" value={untilMonth} max={`${Number(thisMonth.slice(0, 4)) + 1}-12`} onChange={e => e.target.value && setUntilMonth(e.target.value)} aria-label={t('ui.fram_till_och_med')} />
                    {pending.blockedByLock > 0 && t('ui.i_lasta_ar_hoppas_over', { blockedByLock: pending.blockedByLock })}
                  </span>
                </span>
                <button type="button" className="agi-btn primary" onClick={bookPending}><CalendarClock size={14} /> {t('ui.bokfor_avskrivningar')}</button>
              </div>
            )}
            {suggestions.slice(0, 4).map(s => (
              <button
                key={`${s.verificationId}_${s.account}`}
                type="button"
                className="dash-today-btn dash-today-btn--brand lg-todo-row"
                onClick={() => startNew({ name: s.description, acquisitionDate: s.date, cost: s.amount, category: s.category, assetAccount: s.account, sourceVerificationId: s.verificationId })}
              >
                <span className="dash-today-lines">
                  <span className="dash-today-kicker">{t('fa.suggestKicker')}</span>
                  <span className="dash-today-title">{s.description || t('ui.verifikation')} · {fmtKr(s.amount)}</span>
                  <span className="dash-today-detail">{t('fa.suggestDetail', { account: s.account, date: fmtDay(s.date) })}</span>
                </span>
                <span className="dash-today-ic" aria-hidden="true"><Package size={20} /></span>
              </button>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title={t('fa.listTitle')}
        sub={t('ui.inventarier_med_livslangd_over_tre_ar_och_ett_va')}
        actions={rows.length > 0 && (
          <div className="ws-seg">
            {[['inUse', t('fa.filterInUse')], ['disposed', t('fa.filterDisposed')], ['all', t('accr.filterAll')]].map(([id, label]) => (
              <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}<span className="lg-count">{count(id)}</span></button>
            ))}
          </div>
        )}
      >
        {rows.length === 0 ? (
          <div className="accr-empty">
            <p>{t('ui.inga_anlaggningstillgangar_i_registret_annu_lagg')}</p>
            <button type="button" className="agi-btn primary" onClick={() => startNew()}><Plus size={14} /> {t('ui.ny_tillgang')}</button>
          </div>
        ) : (
          <div className="wsp-flush">
            <ListTable
              bordered={false}
              rowKey={a => a.id}
              rows={shown}
              onRowClick={a => { setOpenId(a.id); setDisposing(false); setError(''); }}
              rowStyle={a => (a.state === 'disposed' ? { opacity: 0.65 } : {})}
              emptyMessage={t('fa.emptyFilter')}
              mobileList={a => ({
                dot: catColor(a),
                primary: a.name,
                amount: a.state === 'disposed' ? t('fa.pillDisposed') : fmtKr(a.bookValue),
                meta: `${categoryById(a.category).label} · ${fmtDay(a.acquisitionDate)}`,
                pill: statusPill(a),
              })}
              columns={[
                {
                  key: 'name', label: t('ui.tillgang'), render: a => (
                    <div className="ws-name">
                      <span className="ws-dot" style={{ background: catColor(a) }} />
                      <div className="ws-name-text">
                        <strong>{a.name}</strong>
                        <small>{categoryById(a.category).label}</small>
                      </div>
                    </div>
                  ),
                },
                { key: 'acquisitionDate', label: t('ui.anskaffad'), render: a => fmtDay(a.acquisitionDate) },
                { key: 'cost', label: t('ui.anskaffningsvarde'), align: 'right', render: a => fmtKr(a.cost) },
                {
                  key: 'progress', label: t('fa.colDepreciated'), width: 170, render: a => (
                    <div className="fa-progress">
                      <div className="ws-bar"><span style={{ width: `${depreciatedPct(a)}%`, background: a.state === 'disposed' ? 'var(--text-muted)' : palette.cost }} /></div>
                      <small>{depreciatedPct(a)} %</small>
                    </div>
                  ),
                },
                { key: 'bv', label: t('ui.bokfort_varde'), align: 'right', fontWeight: 700, render: a => (a.state === 'disposed' ? '—' : fmtKr(a.bookValue)) },
                { key: 'status', label: '', align: 'right', render: a => statusPill(a) },
              ]}
            />
          </div>
        )}
      </Panel>

      {open && (
        <AssetDrawer
          asset={open}
          palette={palette}
          thisMonth={thisMonth}
          accountName={accountName}
          statusPill={statusPill}
          canDelete={!hasBooked(open.id)}
          disposing={disposing}
          error={error}
          onClose={() => { setOpenId(null); setDisposing(false); setError(''); }}
          onEdit={() => startEdit(open)}
          onDelete={() => handleDelete(open)}
          onStartDispose={() => { setDisposing(true); setError(''); }}
          onCancelDispose={() => { setDisposing(false); setError(''); }}
          onDispose={(v) => handleDispose(open, v)}
        />
      )}

      {editing && (
        <AssetForm
          editing={editing}
          setEditing={setEditing}
          isNew={isNew}
          locked={!isNew && hasBooked(editing.id)}
          accounts={accounts}
          palette={palette}
          error={error}
          onCategory={changeCategory}
          onSubmit={handleSave}
          onClose={() => { setEditing(null); setError(''); }}
        />
      )}
    </div>
  );
}

// Avskrivningsplanen per år som staplar; innevarande år markerat.
function YearPlan({ asset, color }) {
  const yearly = {};
  scheduleOf(asset).forEach(r => { const y = r.month.slice(0, 4); yearly[y] = round2((yearly[y] || 0) + r.amount); });
  const entries = Object.entries(yearly);
  if (entries.length === 0) return null;
  const max = Math.max(...entries.map(([, v]) => v), 1);
  const thisYear = String(new Date().getFullYear());
  return (
    <div className="fa-plan" style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` }}>
      {entries.map(([y, amount]) => (
        <div key={y} className={y === thisYear ? 'now' : ''}>
          <b>{fmtKr(amount)}</b>
          <i style={{ height: `${Math.max(4, (amount / max) * 72)}px`, background: y === thisYear ? color : undefined }} />
          <span>{y}</span>
        </div>
      ))}
    </div>
  );
}

function AssetDrawer({ asset, palette, thisMonth, accountName, statusPill, canDelete, disposing, error, onClose, onEdit, onDelete, onStartDispose, onCancelDispose, onDispose }) {
  const schedule = scheduleOf(asset);
  const lastMonth = schedule.length ? schedule[schedule.length - 1].month : null;
  const life = Number(asset.usefulLifeMonths) || 0;
  const account = (code) => `${code} ${accountName(code)}`.trim();
  return (
    <div className="lg-drawer-overlay" onClick={onClose}>
      <aside className="lg-drawer" onClick={e => e.stopPropagation()} aria-label={asset.name}>
        <div className="lg-drawer-head">
          <span className="lg-avatar lg" aria-hidden="true">{(asset.name || '?').trim().charAt(0).toUpperCase()}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 className="wsp-title" style={{ fontSize: '19px' }}>{asset.name}</h2>
            <p className="wsp-sub">{categoryById(asset.category).label} · {fmtDay(asset.acquisitionDate)}</p>
          </div>
          {statusPill(asset)}
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>

        <div className="lg-drawer-body">
          <div className="ws-card-actions">
            <button type="button" className="agi-btn" onClick={onEdit}><Pencil size={14} /> {t('ui.andra')}</button>
            {asset.state !== 'disposed' && <button type="button" className="agi-btn" onClick={onStartDispose}><PackageMinus size={14} /> {t('fa.dispose')}</button>}
            {canDelete && <button type="button" className="agi-btn danger" onClick={onDelete}><Trash2 size={14} /> {t('ui.ta_bort')}</button>}
          </div>

          {disposing && <DisposePanel asset={asset} error={error} onCancel={onCancelDispose} onConfirm={onDispose} />}

          <KpiGrid>
            <Kpi dot={palette.income} label={t('ui.anskaffningsvarde')} value={fmtKr(asset.cost)} sub={fmtDay(asset.acquisitionDate)} />
            <Kpi dot={palette.cost} label={t('fa.kpiAccumulated')} value={fmtKr(asset.accumulated)} sub={t('fa.perMonth', { kr: fmtKr(monthlyAmount(asset)) })} />
            <Kpi dot={palette.profit} label={t('ui.bokfort_varde')} value={asset.state === 'disposed' ? '—' : fmtKr(asset.bookValue)} sub={asset.state === 'disposed' ? t('fa.disposedOn', { date: fmtDay(asset.disposedDate) }) : t('fa.kpiBookSub', { month: fmtMonth(thisMonth) })} />
          </KpiGrid>

          <div className="lg-chart">
            <div className="lg-chart-head"><span>{t('ui.avskrivningsplan_per_ar')}</span>{lastMonth && <span>{t('fa.until', { month: fmtMonth(lastMonth) })}</span>}</div>
            <YearPlan asset={asset} color={palette.cost} />
          </div>

          <dl className="pj-facts fa-facts">
            <dt>{t('fa.life')}</dt><dd>{t('fa.lifeValue', { n: life, y: String(Math.round((life / 12) * 10) / 10).replace('.', ',') })}</dd>
            <dt>{t('fa.residual')}</dt><dd>{fmtKr(asset.residualValue)}</dd>
            <dt>{t('ui.tillgangskonto')}</dt><dd>{account(asset.assetAccount)}</dd>
            <dt>{t('ui.ackumulerade_avskrivningar')}</dt><dd>{account(asset.accumulatedAccount)}</dd>
            <dt>{t('ui.avskrivningskostnad')}</dt><dd>{account(asset.expenseAccount)}</dd>
            {asset.state === 'disposed' && <><dt>{t('fa.proceeds')}</dt><dd>{fmtKr(asset.disposalProceeds)}</dd></>}
          </dl>
          {asset.note && <p className="ws-hint">{asset.note}</p>}
        </div>
      </aside>
    </div>
  );
}

function AssetForm({ editing, setEditing, isNew, locked, accounts, palette, error, onCategory, onSubmit, onClose }) {
  const cost = Number(editing.cost) || 0;
  const preview = { ...editing, cost, usefulLifeMonths: Number(editing.usefulLifeMonths) || 0, residualValue: Number(editing.residualValue) || 0 };
  const set = (k) => (e) => setEditing(s => ({ ...s, [k]: e.target.value }));
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" style={{ maxWidth: '680px' }} onClick={ev => ev.stopPropagation()} onSubmit={onSubmit}>
        <div className="modal-header">
          <div>
            <h2 className="modal-title">{isNew ? t('ui.ny_anlaggningstillgang') : t('ui.andra_tillgang')}</h2>
            {locked && <p className="wsp-sub">{t('ui.avskrivningar_ar_redan_bokforda_sa_varde_datum_o')}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label={t('ui.stang')}><X size={18} /></button>
        </div>
        <div className="ws-form">
          <div>
            <label className="ws-label" htmlFor="fa-name">{t('ui.namn_2')}</label>
            <input id="fa-name" className="ws-input" value={editing.name} onChange={set('name')} placeholder={t('ui.t_ex_macbook_pro_14')} autoFocus={isNew} />
          </div>
          <div className="ws-grid2">
            <div>
              <label className="ws-label" htmlFor="fa-cat">{t('ui.kategori')}</label>
              <select id="fa-cat" className="ws-input" disabled={locked} value={editing.category} onChange={e => onCategory(e.target.value)}>
                {ASSET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="ws-label" htmlFor="fa-date">{t('ui.anskaffningsdatum')}</label>
              <input id="fa-date" type="date" className="ws-input" disabled={locked} value={editing.acquisitionDate} onChange={set('acquisitionDate')} />
            </div>
          </div>
          <div className="ws-grid3">
            <div>
              <label className="ws-label" htmlFor="fa-cost">{t('ui.anskaffningsvarde_kr_exkl_moms')}</label>
              <div className="ws-input-suffix"><input id="fa-cost" type="number" step="0.01" min="0" className="ws-input" disabled={locked} value={editing.cost} onChange={set('cost')} /><span>kr</span></div>
            </div>
            <div>
              <label className="ws-label" htmlFor="fa-res">{t('ui.beraknat_restvarde_kr')}</label>
              <div className="ws-input-suffix"><input id="fa-res" type="number" step="0.01" min="0" className="ws-input" disabled={locked} value={editing.residualValue} onChange={set('residualValue')} /><span>kr</span></div>
            </div>
            <div>
              <label className="ws-label" htmlFor="fa-life">{t('ui.livslangd_manader')}</label>
              <div className="ws-input-suffix"><input id="fa-life" type="number" min="1" className="ws-input" disabled={locked} value={editing.usefulLifeMonths} onChange={set('usefulLifeMonths')} /><span>{t('fa.monthsShort')}</span></div>
            </div>
          </div>

          {cost > 0 && (
            <div className="lg-chart">
              <div className="lg-chart-head"><span>{t('ui.avskrivningsplan_per_ar')}</span><span>{t('fa.perMonth', { kr: fmtKr(monthlyAmount(preview)) })}</span></div>
              <YearPlan asset={preview} color={palette.cost} />
            </div>
          )}

          <details className="fa-accounts">
            <summary>{t('ui.bokforingskonton')}</summary>
            <div className="ws-form" style={{ marginTop: '12px' }}>
              <div><label className="ws-label">{t('ui.tillgangskonto')}</label><AccountSearch value={editing.assetAccount} onChange={c => setEditing(s => ({ ...s, assetAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} /></div>
              <div className="ws-grid2">
                <div><label className="ws-label">{t('ui.ackumulerade_avskrivningar')}</label><AccountSearch value={editing.accumulatedAccount} onChange={c => setEditing(s => ({ ...s, accumulatedAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} /></div>
                <div><label className="ws-label">{t('ui.avskrivningskostnad')}</label><AccountSearch value={editing.expenseAccount} onChange={c => setEditing(s => ({ ...s, expenseAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} /></div>
              </div>
            </div>
          </details>

          <div>
            <label className="ws-label" htmlFor="fa-note">{t('ui.anteckning')}</label>
            <textarea id="fa-note" className="ws-input" value={editing.note || ''} onChange={set('note')} />
          </div>

          {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>}
          <div className="ws-card-actions" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="agi-btn" onClick={onClose}>{t('ui.avbryt')}</button>
            <button type="submit" className="agi-btn primary">{t('ui.spara_tillgang')}</button>
          </div>
        </div>
      </form>
    </div>
  );
}

function DisposePanel({ asset, error, onCancel, onConfirm }) {
  const [date, setDate] = useState(todayIso());
  const [proceeds, setProceeds] = useState('');
  const preview = buildDisposalVerification(asset, { date, proceeds: Number(proceeds) || 0 });
  const result = preview.rows.find(r => r.account === '3973')?.kredit || -(preview.rows.find(r => r.account === '7970')?.debet || 0);
  return (
    <div className="fa-dispose">
      <strong>{t('ui.avyttra_eller_utrangera')} {asset.name}</strong>
      <div className="ws-grid2">
        <div><label className="ws-label" htmlFor="fa-dd">{t('ui.datum')}</label><input id="fa-dd" type="date" className="ws-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div>
          <label className="ws-label" htmlFor="fa-dp">{t('ui.forsaljningspris_exkl_moms_0_utrangering')}</label>
          <div className="ws-input-suffix"><input id="fa-dp" type="number" step="0.01" min="0" className="ws-input" value={proceeds} onChange={e => setProceeds(e.target.value)} /><span>kr</span></div>
        </div>
      </div>
      <p className="ws-hint">
        {result > 0 ? t('ui.vinst_vid_avyttring_kr', { v0: fmt(result) }) : result < 0 ? t('ui.forlust_vid_avyttring_kr', { v0: fmt(-result) }) : t('ui.ingen_vinst_eller_forlust')} {t('ui.avskrivning_sker_till_och_med_manaden_fore_avytt')}
      </p>
      {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>}
      <div className="ws-card-actions">
        <button type="button" className="agi-btn primary" onClick={() => onConfirm({ date, proceeds })}>{t('ui.bokfor_2')}</button>
        <button type="button" className="agi-btn" onClick={onCancel}>{t('ui.avbryt')}</button>
      </div>
    </div>
  );
}
