import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, Trash2, Pencil, ArrowLeft, CheckCircle2, AlertTriangle, PackageMinus } from './icons';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  ASSET_CATEGORIES, categoryById, monthlyAmount, accumulatedThrough, bookValueAt, scheduleOf,
  pendingDepreciation, buildDepreciationVerification, buildDisposalVerification,
  bookedDepreciationMap, unregisteredAcquisitions, registerSummary, round2,
} from '../utils/fixedAssets';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const lastCompletedMonth = () => { const d = new Date(); return monthKey(new Date(d.getFullYear(), d.getMonth() - 1, 1)); };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const inp = {
  width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '9px',
  fontSize: '14px', color: 'var(--text-main)', background: 'var(--bg-card)', outline: 'none',
  fontFamily: 'inherit', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-main)' };
const card = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' };
const btn = (primary) => ({
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
  border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--accent)' : 'var(--bg-card)', color: primary ? '#fff' : 'var(--text-main)',
});

const emptyAsset = () => {
  const cat = categoryById('inventarier');
  return {
    id: newId(), name: '', category: cat.id, acquisitionDate: todayIso(), cost: '', residualValue: 0,
    usefulLifeMonths: cat.lifeMonths, assetAccount: cat.assetAccount, accumulatedAccount: cat.accumulatedAccount,
    expenseAccount: cat.expenseAccount, note: '',
  };
};

/**
 * Anläggningsregister med avskrivningar — flik i Skatt och bokslut.
 * Räkningen ligger i utils/fixedAssets.js; här är bara formulär och listor.
 */
export default function FixedAssets({ company, accounts = [], verifications = [], onAddVerification, setCompanyInfo }) {
  const assets = useMemo(() => company?.fixedAssets || [], [company?.fixedAssets]);
  // Vilket låst räkenskapsår datumet ligger i (null om inget), se utils/fiscalYear.js.
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [disposing, setDisposing] = useState(null);
  const [untilMonth, setUntilMonth] = useState(lastCompletedMonth());
  const [error, setError] = useState('');

  const saveAssets = (next) => setCompanyInfo(prev => ({ ...prev, fixedAssets: next }));
  const bookedMap = useMemo(() => bookedDepreciationMap(verifications), [verifications]);
  const hasBooked = (assetId) => [...bookedMap.values()].some(set => set.has(assetId));

  const pending = useMemo(() => pendingDepreciation(assets, verifications, untilMonth, company?.lockedFiscalYears), [assets, verifications, untilMonth, company?.lockedFiscalYears]);
  const suggestions = useMemo(() => unregisteredAcquisitions(verifications, assets), [verifications, assets]);
  const summary = useMemo(() => registerSummary(assets, monthKey(new Date())), [assets]);

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
    setEditing(null);
  };

  const handleDelete = async (asset) => {
    if (hasBooked(asset.id)) return;
    if (!(await confirmDialog(t('ui.ta_bort_ur_registret', { name: asset.name })))) return;
    saveAssets(assets.filter(a => a.id !== asset.id));
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
    setDisposing(null); setError('');
  };

  // ── Formulär ──
  if (editing) {
    const locked = !isNew && hasBooked(editing.id);
    const cost = Number(editing.cost) || 0;
    const preview = { ...editing, cost, usefulLifeMonths: Number(editing.usefulLifeMonths) || 0, residualValue: Number(editing.residualValue) || 0 };
    const yearly = {};
    scheduleOf(preview).forEach(r => { const y = r.month.slice(0, 4); yearly[y] = round2((yearly[y] || 0) + r.amount); });
    return (
      <div style={{ padding: '24px', maxWidth: '760px' }}>
        <button type="button" onClick={() => setEditing(null)} style={{ ...btn(false), border: 'none', padding: 0, marginBottom: '16px', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={14} /> {t('ui.tillbaka_2')}
        </button>
        <form onSubmit={handleSave}>
          <div style={{ ...card, marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>{isNew ? t('ui.ny_anlaggningstillgang') : t('ui.andra_tillgang')}</h3>
            {locked && (
              <p style={{ margin: '0 0 14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                {t('ui.avskrivningar_ar_redan_bokforda_sa_varde_datum_o')}
              </p>
            )}
            <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>{t('ui.namn_2')}</label>
                <input style={inp} value={editing.name} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} placeholder={t('ui.t_ex_macbook_pro_14')} />
              </div>
              <div>
                <label style={lbl}>{t('ui.kategori')}</label>
                <select style={inp} disabled={locked} value={editing.category} onChange={e => changeCategory(e.target.value)}>
                  {ASSET_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>{t('ui.anskaffningsdatum')}</label>
                <input type="date" style={inp} disabled={locked} value={editing.acquisitionDate} onChange={e => setEditing(s => ({ ...s, acquisitionDate: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{t('ui.anskaffningsvarde_kr_exkl_moms')}</label>
                <input type="number" step="0.01" style={inp} disabled={locked} value={editing.cost} onChange={e => setEditing(s => ({ ...s, cost: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{t('ui.beraknat_restvarde_kr')}</label>
                <input type="number" step="0.01" style={inp} disabled={locked} value={editing.residualValue} onChange={e => setEditing(s => ({ ...s, residualValue: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{t('ui.livslangd_manader')}</label>
                <input type="number" style={inp} disabled={locked} value={editing.usefulLifeMonths} onChange={e => setEditing(s => ({ ...s, usefulLifeMonths: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>{t('ui.avskrivning_per_manad')}</label>
                <div style={{ ...inp, background: 'var(--bg-muted)' }}>{fmt(monthlyAmount(preview))} {t('ui.kr')}</div>
              </div>
            </div>
          </div>

          <div style={{ ...card, marginBottom: '16px' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ui.bokforingskonton')}</h3>
            <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
              <div><label style={lbl}>{t('ui.tillgangskonto')}</label><AccountSearch value={editing.assetAccount} onChange={c => setEditing(s => ({ ...s, assetAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} /></div>
              <div><label style={lbl}>{t('ui.ackumulerade_avskrivningar')}</label><AccountSearch value={editing.accumulatedAccount} onChange={c => setEditing(s => ({ ...s, accumulatedAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} /></div>
              <div><label style={lbl}>{t('ui.avskrivningskostnad')}</label><AccountSearch value={editing.expenseAccount} onChange={c => setEditing(s => ({ ...s, expenseAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} /></div>
            </div>
          </div>

          {Object.keys(yearly).length > 0 && (
            <div style={{ ...card, marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{t('ui.avskrivningsplan_per_ar')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '8px' }}>
                {Object.entries(yearly).map(([y, amount]) => (
                  <div key={y} style={{ background: 'var(--bg-muted)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px' }}>
                    <div style={{ color: 'var(--text-secondary)' }}>{y}</div>
                    <div style={{ fontWeight: 700 }}>{fmt(amount)} {t('ui.kr')}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ ...card, marginBottom: '16px' }}>
            <label style={lbl}>{t('ui.anteckning')}</label>
            <textarea style={{ ...inp, minHeight: '56px', resize: 'vertical' }} value={editing.note || ''} onChange={e => setEditing(s => ({ ...s, note: e.target.value }))} />
          </div>

          {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: '0 0 12px' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" style={btn(false)} onClick={() => setEditing(null)}>{t('ui.avbryt')}</button>
            <button type="submit" style={btn(true)}>{t('ui.spara_tillgang')}</button>
          </div>
        </form>
      </div>
    );
  }

  const thisMonth = monthKey(new Date());
  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[[t('ui.anskaffningsvarde'), summary.cost], [t('ui.ackumulerade_avskrivningar'), summary.accumulated], [t('ui.bokfort_varde'), summary.bookValue]].map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{fmt(value)} {t('ui.kr')}</div>
          </div>
        ))}
      </div>

      {assets.length > 0 && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderColor: pending.months.length ? 'var(--status-amber-text)' : 'var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {pending.months.length ? <AlertTriangle size={18} color="var(--status-amber-text)" /> : <CheckCircle2 size={18} color="var(--status-green-text)" />}
            <div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>
                {pending.months.length
                  ? t('ui.med_obokforda_avskrivningar_kr', { length: pending.months.length, v1: pending.months.length === 1 ? 'månad' : 'månader', v2: fmt(pending.total) })
                  : t('ui.alla_avskrivningar_ar_bokforda')}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                {t('ui.fram_till_och_med')}{' '}
                <input type="month" value={untilMonth} max={`${Number(thisMonth.slice(0, 4)) + 1}-12`} onChange={e => e.target.value && setUntilMonth(e.target.value)} style={{ border: 'none', background: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit' }} />
                {pending.blockedByLock > 0 && t('ui.i_lasta_ar_hoppas_over', { blockedByLock: pending.blockedByLock })}
              </div>
            </div>
          </div>
          {pending.months.length > 0 && <button type="button" style={btn(true)} onClick={bookPending}>{t('ui.bokfor_avskrivningar')}</button>}
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>{t('ui.inkop_som_kan_vara_anlaggningstillgangar')}</div>
          <p style={{ margin: '0 0 12px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
            {t('ui.dessa_ar_bokforda_pa_ett_tillgangskonto_men_finn')}
          </p>
          {suggestions.slice(0, 6).map(s => (
            <div key={`${s.verificationId}_${s.account}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '8px 0', borderTop: '1px solid var(--border)', fontSize: '13.5px' }}>
              <span>{s.date} · {s.description || t('ui.verifikation')} · {s.account} · <b>{fmt(s.amount)} {t('ui.kr')}</b></span>
              <button type="button" style={btn(false)} onClick={() => startNew({ name: s.description, acquisitionDate: s.date, cost: s.amount, category: s.category, assetAccount: s.account, sourceVerificationId: s.verificationId })}>
                {t('ui.lagg_i_registret')}
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '560px' }}>
          {t('ui.inventarier_med_livslangd_over_tre_ar_och_ett_va')}
        </p>
        <button type="button" style={btn(true)} onClick={() => startNew()}><Plus size={14} /> {t('ui.ny_tillgang')}</button>
      </div>

      {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: 0 }}>{error}</p>}

      {disposing && (
        <DisposePanel asset={disposing} onCancel={() => { setDisposing(null); setError(''); }} onConfirm={(v) => handleDispose(disposing, v)} />
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={a => a.id}
          rows={assets}
          onRowClick={(a) => { setEditing({ ...a }); setIsNew(false); setError(''); }}
          emptyMessage={t('ui.inga_anlaggningstillgangar_i_registret_annu_lagg')}
          mobileList={a => ({ primary: a.name, amount: `${fmt(bookValueAt(a, thisMonth))} kr`, meta: `${categoryById(a.category).label}${a.disposedDate ? ' · avyttrad' : ''}` })}
          columns={[
            { key: 'name', label: t('ui.tillgang'), fontWeight: 600, color: 'var(--text-main)', render: a => a.name },
            { key: 'category', label: t('ui.kategori'), render: a => categoryById(a.category).label },
            { key: 'acquisitionDate', label: t('ui.anskaffad'), render: a => a.acquisitionDate },
            { key: 'cost', label: t('ui.anskaffningsvarde'), align: 'right', render: a => `${fmt(a.cost)} kr` },
            { key: 'acc', label: t('ui.ack_avskrivn'), align: 'right', render: a => `${fmt(accumulatedThrough(a, thisMonth))} kr` },
            { key: 'bv', label: t('ui.bokfort_varde'), align: 'right', color: 'var(--text-main)', render: a => (a.disposedDate ? 'Avyttrad' : `${fmt(bookValueAt(a, thisMonth))} kr`) },
            {
              key: 'actions', label: '', align: 'right', width: 110,
              render: a => (
                <span onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', gap: '10px' }}>
                  {!a.disposedDate && <button type="button" title={t('ui.avyttra_eller_utrangera_2')} onClick={() => { setDisposing(a); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}><PackageMinus size={14} /></button>}
                  <button type="button" title={t('ui.andra')} onClick={() => { setEditing({ ...a }); setIsNew(false); setError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '2px' }}><Pencil size={14} /></button>
                  {!hasBooked(a.id) && <button type="button" title={t('ui.ta_bort')} onClick={() => handleDelete(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>}
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function DisposePanel({ asset, onCancel, onConfirm }) {
  const [date, setDate] = useState(todayIso());
  const [proceeds, setProceeds] = useState('');
  const preview = buildDisposalVerification(asset, { date, proceeds: Number(proceeds) || 0 });
  const result = preview.rows.find(r => r.account === '3973')?.kredit || -(preview.rows.find(r => r.account === '7970')?.debet || 0);
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>{t('ui.avyttra_eller_utrangera')} {asset.name}</div>
      <div className="form-row-2" style={{ display: 'grid', gap: '16px', maxWidth: '520px' }}>
        <div><label style={lbl}>{t('ui.datum')}</label><input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label style={lbl}>{t('ui.forsaljningspris_exkl_moms_0_utrangering')}</label><input type="number" step="0.01" style={inp} value={proceeds} onChange={e => setProceeds(e.target.value)} /></div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '12px 0' }}>
        {result > 0 ? t('ui.vinst_vid_avyttring_kr', { v0: fmt(result) }) : result < 0 ? t('ui.forlust_vid_avyttring_kr', { v0: fmt(-result) }) : t('ui.ingen_vinst_eller_forlust')} {t('ui.avskrivning_sker_till_och_med_manaden_fore_avytt')}
      </p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button type="button" style={btn(true)} onClick={() => onConfirm({ date, proceeds })}>{t('ui.bokfor_2')}</button>
        <button type="button" style={btn(false)} onClick={onCancel}>{t('ui.avbryt')}</button>
      </div>
    </div>
  );
}
