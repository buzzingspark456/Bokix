import React, { useMemo, useState } from 'react';
import { lockedPeriodFor, activeFiscalYear } from '../utils/fiscalYear';
import { previousFiscalYear } from '../utils/annualReport';
import { Plus, CheckCircle2, AlertTriangle } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  DIVIDEND_LIABILITY_ACCOUNT, DIVIDEND_SOURCE_ACCOUNTS, checkDividend, dividendLimit, dividendPerShare,
  buildDividendDecision, buildDividendPayment, dividendStatus, dividendPaymentDate,
} from '../utils/dividend';
import { rollForwardPastWeekend, daysFromToday } from '../utils/declarationDeadlines';
import { t, dateLocale } from '../i18n';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtDate = (d) => dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(d instanceof Date ? d : new Date(`${d}T12:00:00`));
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `div_${Date.now()}_${Math.random().toString(36).slice(2)}`);

/**
 * Utdelning i aktiebolag, flik i Skatt och bokslut. Bokför beslut och
 * utbetalning (utils/dividend.js).
 *
 * Gränsen följer ABL 17 kap. 3 § och 18 kap. 4 §: det fria egna kapitalet i
 * den senast fastställda balansräkningen (räkenskapsårets slut före
 * beslutet), minus det som redan beslutats sedan dess. Årets pågående
 * resultat räknas inte. Försiktighetsregeln bedömer styrelsen själv.
 */
export default function Dividend({ company, accounts = [], verifications = [], onAddVerification, setAccounts, setCompanyInfo }) {
  const dividends = useMemo(() => company?.dividends || [], [company?.dividends]);
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);
  const today = todayIso();

  // Räkenskapsåret före det år datumet ligger i: det är dess balansräkning
  // som stämman fastställer och som utdelningen räknas på.
  const balanceYearFor = (date) => {
    let fy = activeFiscalYear(company);
    for (let i = 0; i < 20 && date < fy.start; i++) fy = previousFiscalYear(fy, company);
    return previousFiscalYear(fy, company);
  };
  const baseYear = balanceYearFor(today);
  const overview = useMemo(
    () => dividendLimit({ verifications, accounts, dividends, balanceDate: baseYear.end, date: today }),
    [verifications, accounts, dividends, baseYear.end, today],
  );
  const outstanding = useMemo(() => checkDividend({ verifications, accounts, date: today, amount: 0 }).outstanding, [verifications, accounts, today]);
  const baseLocked = Boolean(company?.lockedFiscalYears?.[baseYear.key]);
  const hasBaseYear = verifications.some(v => v.date && v.date <= baseYear.end);

  const formYear = form ? balanceYearFor(form.date || today) : null;
  const check = form ? dividendLimit({ verifications, accounts, dividends, balanceDate: formYear.end, date: form.date || today, amount: form.amount }) : null;

  const ensureLiabilityAccount = () => {
    if (setAccounts && !accounts.some(a => a.code === DIVIDEND_LIABILITY_ACCOUNT)) {
      setAccounts(prev => (prev.some(a => a.code === DIVIDEND_LIABILITY_ACCOUNT) ? prev : [...prev, { code: DIVIDEND_LIABILITY_ACCOUNT, name: 'Outtagen vinstutdelning', type: 'skuld_kapital' }].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))));
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
    if (!check.withinLimit) return setError(t('ui.utdelningen_far_inte_overstiga_det_fria_egna_kap', { v0: fmt(check.maxDividend) }));
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

  // KU31: utdelning till privatpersoner redovisas av bolaget senast den 31
  // januari året efter utbetalningen. Visas tills en månad efter fristen.
  const ku31 = useMemo(() => {
    const years = new Set(dividends.map(d => dividendPaymentDate(d, verifications)).filter(Boolean).map(d => Number(d.slice(0, 4))));
    return [...years].sort().map(year => ({ year, due: rollForwardPastWeekend(new Date(year + 1, 0, 31)) }))
      .filter(k => daysFromToday(k.due) >= -30);
  }, [dividends, verifications]);

  return (
    <div className="fp-page">
      <section className={`fp-strip${baseLocked || !hasBaseYear ? '' : ' warn'}`}>
        <div>
          <div className="fp-strip-title">{t('yearEndUi.divMax', { amount: fmt(overview.maxDividend) })}</div>
          <div className="fp-strip-sub">
            {!hasBaseYear ? t('yearEndUi.divNoYear') : baseLocked ? t('yearEndUi.divBasis', { date: fmtDate(baseYear.end) }) : t('yearEndUi.divNotLocked', { label: baseYear.label })}
          </div>
        </div>
        {!form && (
          <div className="fp-actions">
            <button type="button" className="agi-btn primary" onClick={startNew}><Plus size={15} /> {t('yearEndUi.newDecision')}</button>
          </div>
        )}
      </section>

      <div className="fp-stats">
        {[
          [t('yearEndUi.freeEquity', { date: fmtDate(baseYear.end) }), overview.freeEquity],
          [t('yearEndUi.decidedSince'), overview.decidedSince],
          [t('yearEndUi.maxDividend'), overview.maxDividend],
          [t('yearEndUi.outstanding'), outstanding],
        ].map(([label, value]) => (
          <div key={label} className="fp-stat">
            <div className="fp-stat-label">{label}</div>
            <div className="fp-stat-value">{fmt(value)} {t('ui.kr')}</div>
          </div>
        ))}
      </div>

      {form && (
        <form onSubmit={save} className="fp-section">
          <h3 className="fp-title">{t('yearEndUi.newDecision')}</h3>
          <div className="fp-fields">
            <div className="fp-grid-2">
              <div><label className="fp-label">{t('yearEndUi.decisionDate')}</label><input type="date" className="fp-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
              <div><label className="fp-label">{t('yearEndUi.amount')}</label><input type="number" step="0.01" min="0" className="fp-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div>
                <label className="fp-label">{t('yearEndUi.from')}</label>
                <select className="fp-input" value={form.sourceAccount} onChange={e => setForm(f => ({ ...f, sourceAccount: e.target.value }))}>
                  {DIVIDEND_SOURCE_ACCOUNTS.map(code => <option key={code} value={code}>{code} {accounts.find(a => a.code === code)?.name || ''}</option>)}
                </select>
              </div>
              <div><label className="fp-label">{t('yearEndUi.shares')}</label><input type="number" min="0" className="fp-input" value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} /></div>
            </div>
            <div><label className="fp-label">{t('yearEndUi.note')}</label><input className="fp-input" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder={t('yearEndUi.notePh')} /></div>
            <div className={`fp-hint ${check.withinLimit ? 'good' : 'bad'}`} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13px' }}>
              {check.withinLimit ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0 }} />}
              <span>
                {check.withinLimit
                  ? t('yearEndUi.within', { amount: fmt(check.maxDividend) })
                  : t('ui.utdelningen_far_inte_overstiga_det_fria_egna_kap', { v0: fmt(check.maxDividend) })}
                {dividendPerShare(form.amount, form.shares) != null && t('yearEndUi.perShare', { amount: fmt(dividendPerShare(form.amount, form.shares)) })}
              </span>
            </div>
            {error && <div className="fp-hint bad">{error}</div>}
          </div>
          <div className="fp-foot">
            <button type="button" className="agi-btn" onClick={() => { setForm(null); setError(''); }}>{t('ui.avbryt')}</button>
            <button type="submit" className="agi-btn primary">{t('yearEndUi.bookDecision')}</button>
          </div>
        </form>
      )}

      {!form && error && <div className="fp-section"><div className="fp-hint bad">{error}</div></div>}

      {paying && (
        <PayPanel dividend={paying} onCancel={() => setPaying(null)} onConfirm={(date) => pay(paying, date)} />
      )}

      <ListTable
        rowKey={d => d.id}
        rows={dividends}
        emptyMessage={t('yearEndUi.empty')}
        mobileList={d => {
          const s = dividendStatus(d, verifications);
          return {
            primary: d.note || t('ui.utdelning'), amount: `${fmt(d.amount)} kr`, meta: d.date,
            pill: <span className={`agi-pill ${s.paid ? 'ok' : 'warn'}`}>{s.paid ? t('ui.utbetald') : s.decided ? t('ui.beslutad_ej_utbetald') : t('ui.beslut_ej_bokfort')}</span>,
            // Utbetalningen måste gå att bokföra även på telefon.
            meta2: s.decided && !s.paid ? <button type="button" className="agi-btn" onClick={e => { e.stopPropagation(); setPaying(d); }}>{t('ui.bokfor_utbetalning')}</button> : null,
          };
        }}
        columns={[
          { key: 'date', label: t('yearEndUi.decisions'), render: d => d.date },
          { key: 'note', label: t('ui.avser'), fontWeight: 600, color: 'var(--text-main)', render: d => d.note || t('ui.utdelning') },
          { key: 'amount', label: t('ui.belopp'), align: 'right', render: d => `${fmt(d.amount)} kr` },
          { key: 'perShare', label: t('ui.per_aktie'), align: 'right', render: d => (d.shares ? `${fmt(dividendPerShare(d.amount, d.shares))} kr` : '–') },
          {
            key: 'status', label: t('ui.status'),
            render: d => {
              const s = dividendStatus(d, verifications);
              if (s.paid) return <span className="agi-pill ok">{t('ui.utbetald')}</span>;
              return <span className="agi-pill warn">{s.decided ? t('ui.beslutad_ej_utbetald') : t('ui.beslut_ej_bokfort')}</span>;
            },
          },
          {
            key: 'actions', label: '', align: 'right',
            render: d => {
              const s = dividendStatus(d, verifications);
              return s.decided && !s.paid ? <button type="button" className="agi-btn" onClick={() => setPaying(d)}>{t('ui.bokfor_utbetalning')}</button> : null;
            },
          },
        ]}
      />

      {ku31.length > 0 && (
        <div className="fp-section" style={{ fontSize: '13px', color: 'var(--text-secondary)', borderBottom: 'none' }}>
          {ku31.map(k => <div key={k.year}>{t('yearEndUi.ku31', { year: k.year, date: fmtDate(k.due) })}</div>)}
        </div>
      )}
    </div>
  );
}

function PayPanel({ dividend, onCancel, onConfirm }) {
  const [date, setDate] = useState(todayIso());
  return (
    <section className="fp-section">
      <h3 className="fp-title">{t('ui.utbetalning_av')} {fmt(dividend.amount)} {t('ui.kr')}</h3>
      <div style={{ maxWidth: '240px' }}><label className="fp-label">{t('ui.utbetalningsdatum')}</label><input type="date" className="fp-input" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="fp-foot" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="agi-btn primary" onClick={() => onConfirm(date)}>{t('ui.bokfor_2')}</button>
        <button type="button" className="agi-btn" onClick={onCancel}>{t('ui.avbryt')}</button>
      </div>
    </section>
  );
}
