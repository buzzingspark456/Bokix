import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, CheckCircle2, AlertTriangle } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  DIVIDEND_LIABILITY_ACCOUNT, DIVIDEND_SOURCE_ACCOUNTS, checkDividend, dividendPerShare,
  buildDividendDecision, buildDividendPayment, dividendStatus,
} from '../utils/dividend';
import { t } from '../i18n';

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `div_${Date.now()}_${Math.random().toString(36).slice(2)}`);

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

/**
 * Utdelning i aktiebolag — flik i Skatt och bokslut. Kontrollerar mot fritt
 * eget kapital och bokför beslut och utbetalning. Räkningen ligger i
 * utils/dividend.js.
 */
export default function Dividend({ company, accounts = [], verifications = [], onAddVerification, setAccounts, setCompanyInfo }) {
  const dividends = useMemo(() => company?.dividends || [], [company?.dividends]);
  // Vilket låst räkenskapsår datumet ligger i (null om inget), se utils/fiscalYear.js.
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);

  const today = todayIso();
  const overview = useMemo(() => checkDividend({ verifications, accounts, date: today, amount: 0 }), [verifications, accounts, today]);
  const check = form ? checkDividend({ verifications, accounts, date: form.date || today, amount: form.amount }) : null;

  const ensureLiabilityAccount = () => {
    if (setAccounts && !accounts.some(a => a.code === DIVIDEND_LIABILITY_ACCOUNT)) {
      setAccounts(prev => (prev.some(a => a.code === DIVIDEND_LIABILITY_ACCOUNT) ? prev : [...prev, { code: DIVIDEND_LIABILITY_ACCOUNT, name: 'Outtagen utdelning', type: 'skuld_kapital' }].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))));
    }
  };

  const startNew = () => {
    setForm({ date: today, amount: '', sourceAccount: '2091', shares: '', note: '' });
    setError('');
  };

  const save = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return setError(t('ui.ange_ett_belopp_storre_an_0'));
    if (!form.date) return setError(t('ui.ange_datum_for_stammobeslutet'));
    if (lockedFor(form.date)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(form.date) }));
    if (!check.withinFreeEquity) return setError(t('ui.utdelningen_far_inte_overstiga_det_fria_egna_kap', { v0: fmt(check.maxDividend) }));
    ensureLiabilityAccount();
    const dividend = { id: newId(), date: form.date, amount, sourceAccount: form.sourceAccount, shares: Number(form.shares) || 0, note: form.note.trim() };
    setCompanyInfo(prev => ({ ...prev, dividends: [...(prev.dividends || []), dividend] }));
    onAddVerification(buildDividendDecision(dividend));
    setForm(null); setError('');
  };

  const pay = async (dividend, date) => {
    if (lockedFor(date)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(date) }));
    if (date < dividend.date) return setError(t('ui.utbetalningen_kan_inte_vara_fore_beslutet'));
    if (!(await confirmDialog(t('ui.bokfor_utbetalning_av_kr_den', { v0: fmt(dividend.amount), date })))) return;
    onAddVerification(buildDividendPayment(dividend, { date }));
    setPaying(null); setError('');
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '700px' }}>
        {t('ui.utdelning_far_bara_ske_av_fritt_eget_kapital_och')}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[[t('ui.fritt_eget_kapital'), overview.freeEquity], [t('ui.hogsta_utdelning'), overview.maxDividend], [t('ui.beslutad_ej_utbetald_2', { DIVIDEND_LIABILITY_ACCOUNT }), overview.outstanding]].map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{fmt(value)} {t('ui.kr')}</div>
          </div>
        ))}
      </div>

      {form ? (
        <form onSubmit={save} style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>{t('ui.nytt_utdelningsbeslut')}</h3>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <div><label style={lbl}>{t('ui.datum_for_stammobeslut')}</label><input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label style={lbl}>{t('ui.belopp_kr_2')}</label><input type="number" step="0.01" style={inp} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div>
              <label style={lbl}>{t('ui.tas_fran')}</label>
              <select style={inp} value={form.sourceAccount} onChange={e => setForm(f => ({ ...f, sourceAccount: e.target.value }))}>
                {DIVIDEND_SOURCE_ACCOUNTS.map(code => <option key={code} value={code}>{code} {accounts.find(a => a.code === code)?.name || ''}</option>)}
              </select>
            </div>
            <div><label style={lbl}>{t('ui.antal_aktier_valfritt')}</label><input type="number" style={inp} value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>{t('ui.anteckning')}</label><input style={inp} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('ui.t_ex_arsstamma_2026')} /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {check.withinFreeEquity ? <CheckCircle2 size={18} color="var(--status-green-text)" style={{ flexShrink: 0 }} /> : <AlertTriangle size={18} color="var(--status-red-text)" style={{ flexShrink: 0 }} />}
            <span>
              {check.withinFreeEquity
                ? t('ui.ryms_inom_det_fria_egna_kapitalet_kr', { v0: fmt(check.freeEquity) })
                : t('ui.overstiger_det_fria_egna_kapitalet_kr_utdelninge', { v0: fmt(check.freeEquity) })}
              {dividendPerShare(form.amount, form.shares) != null && t('ui.utdelning_per_aktie_kr', { v0: fmt(dividendPerShare(form.amount, form.shares)) })}
            </span>
          </div>
          {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" style={btn(false)} onClick={() => { setForm(null); setError(''); }}>{t('ui.avbryt')}</button>
            <button type="submit" style={btn(true)}>{t('ui.bokfor_beslut')}</button>
          </div>
        </form>
      ) : (
        <div><button type="button" style={btn(true)} onClick={startNew}><Plus size={14} /> {t('ui.nytt_utdelningsbeslut')}</button></div>
      )}

      {!form && error && <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-red-text)' }}>{error}</p>}

      {paying && (
        <PayPanel dividend={paying} onCancel={() => setPaying(null)} onConfirm={(date) => pay(paying, date)} />
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={d => d.id}
          rows={dividends}
          emptyMessage={t('ui.inga_utdelningsbeslut_annu')}
          mobileList={d => ({ primary: d.note || t('ui.utdelning'), amount: `${fmt(d.amount)} kr`, meta: d.date })}
          columns={[
            { key: 'date', label: t('ui.beslut'), render: d => d.date },
            { key: 'note', label: t('ui.avser'), fontWeight: 600, color: 'var(--text-main)', render: d => d.note || 'Utdelning' },
            { key: 'amount', label: t('ui.belopp'), align: 'right', render: d => `${fmt(d.amount)} kr` },
            { key: 'perShare', label: t('ui.per_aktie'), align: 'right', render: d => (d.shares ? `${fmt(dividendPerShare(d.amount, d.shares))} kr` : '—') },
            {
              key: 'status', label: t('ui.status'),
              render: d => {
                const s = dividendStatus(d, verifications);
                if (s.paid) return <span style={{ color: 'var(--status-green-text)' }}>{t('ui.utbetald')}</span>;
                return <span style={{ color: 'var(--status-amber-text)' }}>{s.decided ? t('ui.beslutad_ej_utbetald') : t('ui.beslut_ej_bokfort')}</span>;
              },
            },
            {
              key: 'actions', label: '', align: 'right',
              render: d => {
                const s = dividendStatus(d, verifications);
                return s.decided && !s.paid ? <button type="button" style={btn(false)} onClick={() => setPaying(d)}>{t('ui.bokfor_utbetalning')}</button> : null;
              },
            },
          ]}
        />
      </div>
    </div>
  );
}

function PayPanel({ dividend, onCancel, onConfirm }) {
  const [date, setDate] = useState(todayIso());
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>{t('ui.utbetalning_av')} {fmt(dividend.amount)} {t('ui.kr')}</div>
      <div style={{ maxWidth: '240px' }}><label style={lbl}>{t('ui.utbetalningsdatum')}</label><input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
        <button type="button" style={btn(true)} onClick={() => onConfirm(date)}>{t('ui.bokfor_2')}</button>
        <button type="button" style={btn(false)} onClick={onCancel}>{t('ui.avbryt')}</button>
      </div>
    </div>
  );
}
