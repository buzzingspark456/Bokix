import React, { useMemo, useState } from 'react';
import { AccountSearch } from './SearchInputs';
import {
  spreadPlan, spreadCandidates, sideForAccount, balanceAccountFor, isResultAccount, buildSpreadStart,
} from '../../utils/accrualSpread';
import { getDebet, getKredit } from '../../utils/verificationAmounts';
import { lockedPeriodFor } from '../../utils/fiscalYear';
import { t, dateLocale } from '../../i18n';
import { numberFormat } from '../../utils/intlCache';

// Fälten för en månadsperiodisering (2026-11-22, som Bokio): från en
// verifikation (konto och belopp föreslås) eller fristående. Används i
// Periodiseringar och på den öppnade verifikationen.

const fmtKr = (v) => `${numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0)} kr`;
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const monthLabel = (ym) => new Date(`${ym}-01T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short', year: 'numeric' });
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `spread_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const MONTH_CHOICES = [3, 6, 12, 24, 36];

export default function SpreadFields({ accounts = [], verification = null, lockedFiscalYears, existing = [], onSave, onCancel }) {
  const candidates = useMemo(() => (verification ? spreadCandidates(verification, getDebet, getKredit) : []), [verification]);
  const [account, setAccount] = useState(candidates[0]?.account || '');
  const [amount, setAmount] = useState(candidates[0] ? String(candidates[0].amount) : '');
  const [description, setDescription] = useState(verification?.description || '');
  const [startMonth, setStartMonth] = useState(String(verification?.date || todayIso()).slice(0, 7));
  const [months, setMonths] = useState(12);
  const [error, setError] = useState('');

  const date = verification?.date || todayIso();
  const candidate = candidates.find(c => c.account === account);
  const side = candidate?.side || sideForAccount(account);
  const balanceAccount = candidate?.balanceAccount || balanceAccountFor(side, account);
  const name = (code) => accounts.find(a => a.code === code)?.name || '';
  const value = Number(String(amount).replace(',', '.')) || 0;
  const spread = { id: 'preview', description: description.trim() || verification?.description || '', account, side, balanceAccount, amount: value, startMonth, months, date };
  const plan = value > 0 && account ? spreadPlan(spread) : [];
  const start = value > 0 && account ? buildSpreadStart(spread) : null;
  const alreadyFrom = verification ? existing.filter(s => s.sourceVerificationId === verification.id) : [];
  const usedOnAccount = alreadyFrom.filter(s => s.account === account).reduce((s, x) => s + Math.abs(x.amount), 0);
  const max = candidate ? Math.round((candidate.amount - usedOnAccount) * 100) / 100 : null;

  const save = () => {
    if (!account || !isResultAccount(account)) return setError(t('spread.errAccount'));
    if (!(value > 0)) return setError(t('spread.errAmount'));
    if (max != null && value > max + 0.001) return setError(t('spread.errMax', { kr: fmtKr(max) }));
    if (!(months >= 1 && months <= 120)) return setError(t('spread.errMonths'));
    if (!spread.description) return setError(t('spread.errDescription'));
    const locked = lockedPeriodFor(date, lockedFiscalYears);
    if (locked) return setError(t('ui.rakenskapsaret_ar_last', { v0: locked }));
    setError('');
    onSave({
      ...spread, id: newId(), amount: Math.round(value * 100) / 100,
      sourceVerificationId: verification?.id || null, createdAt: new Date().toISOString(),
    });
  };

  return (
    <div className="ws-form">
      {verification && candidates.length > 1 && (
        <div className="spr-cands" role="radiogroup" aria-label={t('spread.account')}>
          {candidates.map(c => (
            <button key={c.account} type="button" role="radio" aria-checked={account === c.account} className={account === c.account ? 'on' : ''} onClick={() => { setAccount(c.account); setAmount(String(c.amount)); }}>
              <strong>{c.account} {name(c.account)}</strong><span>{fmtKr(c.amount)}</span>
            </button>
          ))}
        </div>
      )}
      {verification && candidates.length === 0 && <p className="ws-hint">{t('spread.noCandidates')}</p>}
      {!verification && (
        <div>
          <label className="ws-label">{t('spread.account')}</label>
          <AccountSearch value={account} onChange={setAccount} accounts={accounts.filter(a => isResultAccount(a.code))} placeholder={t('ui.sok_konto')} />
        </div>
      )}
      {verification && candidates.length === 1 && (
        <p className="spr-one">{t('spread.fromAccount', { account: `${account} ${name(account)}`.trim() })}</p>
      )}
      <div>
        <label className="ws-label" htmlFor="spr-desc">{t('ui.avser_2')}</label>
        <input id="spr-desc" className="ws-input" value={description} onChange={e => setDescription(e.target.value)} placeholder={t('spread.descPlaceholder')} />
      </div>
      <div className="ws-grid2">
        <div>
          <label className="ws-label" htmlFor="spr-amount">{t('spread.amount')}</label>
          <div className="ws-input-suffix">
            <input id="spr-amount" inputMode="decimal" className="ws-input" value={amount} onChange={e => setAmount(e.target.value)} />
            <span>kr</span>
          </div>
          {max != null && <p className="ws-hint" style={{ marginTop: 4 }}>{t('spread.maxHint', { kr: fmtKr(max) })}</p>}
        </div>
        <div>
          <label className="ws-label" htmlFor="spr-start">{t('spread.startMonth')}</label>
          <input id="spr-start" type="month" className="ws-input" value={startMonth} onChange={e => e.target.value && setStartMonth(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="ws-label">{t('spread.months')}</label>
        <div className="ws-seg spr-months">
          {MONTH_CHOICES.map(n => <button key={n} type="button" className={months === n ? 'on' : ''} onClick={() => setMonths(n)}>{n}</button>)}
          <input type="number" min="1" max="120" className="ws-input" aria-label={t('spread.months')} value={months} onChange={e => setMonths(Math.max(1, Math.min(120, Number(e.target.value) || 1)))} />
        </div>
      </div>

      {start && (
        <div className="spr-preview">
          <div className="spr-preview-head">{t('spread.preview')}</div>
          <div className="spr-preview-row is-start">
            <span>{date}</span>
            <span>{t('spread.previewStart', { kr: fmtKr(value), from: `${account} ${name(account)}`.trim(), to: `${balanceAccount} ${name(balanceAccount)}`.trim() })}</span>
          </div>
          {(plan.length > 6 ? [...plan.slice(0, 3), null, ...plan.slice(-2)] : plan).map((p, i) => (p ? (
            <div key={p.month} className="spr-preview-row">
              <span>{monthLabel(p.month)}</span>
              <span>{t('spread.previewMonth', { kr: fmtKr(p.amount), to: `${account} ${name(account)}`.trim() })}</span>
            </div>
          ) : <div key={`gap${i}`} className="spr-preview-gap">{t('spread.more', { n: plan.length - 5 })}</div>))}
          <p className="ws-hint" style={{ margin: '8px 0 0' }}>{t('spread.previewHint')}</p>
        </div>
      )}

      {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>}
      <div className="ws-card-actions" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="agi-btn" onClick={onCancel}>{t('ui.avbryt')}</button>
        <button type="button" className="agi-btn primary" onClick={save} disabled={verification && candidates.length === 0}>{t('spread.save')}</button>
      </div>
    </div>
  );
}
