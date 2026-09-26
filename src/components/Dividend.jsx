import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, CheckCircle2, AlertTriangle } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  DIVIDEND_LIABILITY_ACCOUNT, DIVIDEND_SOURCE_ACCOUNTS, checkDividend, dividendPerShare,
  buildDividendDecision, buildDividendPayment, dividendStatus,
} from '../utils/dividend';

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
    if (!(amount > 0)) return setError('Ange ett belopp större än 0.');
    if (!form.date) return setError('Ange datum för stämmobeslutet.');
    if (lockedFor(form.date)) return setError(`Räkenskapsåret ${lockedFor(form.date)} är låst.`);
    if (!check.withinFreeEquity) return setError(`Utdelningen får inte överstiga det fria egna kapitalet (${fmt(check.maxDividend)} kr).`);
    ensureLiabilityAccount();
    const dividend = { id: newId(), date: form.date, amount, sourceAccount: form.sourceAccount, shares: Number(form.shares) || 0, note: form.note.trim() };
    setCompanyInfo(prev => ({ ...prev, dividends: [...(prev.dividends || []), dividend] }));
    onAddVerification(buildDividendDecision(dividend));
    setForm(null); setError('');
  };

  const pay = async (dividend, date) => {
    if (lockedFor(date)) return setError(`Räkenskapsåret ${lockedFor(date)} är låst.`);
    if (date < dividend.date) return setError('Utbetalningen kan inte vara före beslutet.');
    if (!(await confirmDialog(`Bokför utbetalning av ${fmt(dividend.amount)} kr den ${date}?`))) return;
    onAddVerification(buildDividendPayment(dividend, { date }));
    setPaying(null); setError('');
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '700px' }}>
        Utdelning får bara ske av fritt eget kapital, och bara om det är försvarligt med hänsyn till bolagets ekonomi. Beslutet fattas på bolagsstämman. Utdelning till privatpersoner ska redovisas i en kontrolluppgift (KU31).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {[['Fritt eget kapital', overview.freeEquity], ['Högsta utdelning', overview.maxDividend], [`Beslutad, ej utbetald (${DIVIDEND_LIABILITY_ACCOUNT})`, overview.outstanding]].map(([label, value]) => (
          <div key={label} style={card}>
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: '22px', fontWeight: 800, marginTop: '4px' }}>{fmt(value)} kr</div>
          </div>
        ))}
      </div>

      {form ? (
        <form onSubmit={save} style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 700 }}>Nytt utdelningsbeslut</h3>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <div><label style={lbl}>Datum för stämmobeslut</label><input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><label style={lbl}>Belopp (kr)</label><input type="number" step="0.01" style={inp} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div>
              <label style={lbl}>Tas från</label>
              <select style={inp} value={form.sourceAccount} onChange={e => setForm(f => ({ ...f, sourceAccount: e.target.value }))}>
                {DIVIDEND_SOURCE_ACCOUNTS.map(code => <option key={code} value={code}>{code} {accounts.find(a => a.code === code)?.name || ''}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Antal aktier (valfritt)</label><input type="number" style={inp} value={form.shares} onChange={e => setForm(f => ({ ...f, shares: e.target.value }))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><label style={lbl}>Anteckning</label><input style={inp} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="t.ex. Årsstämma 2026" /></div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginTop: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
            {check.withinFreeEquity ? <CheckCircle2 size={18} color="var(--status-green-text)" style={{ flexShrink: 0 }} /> : <AlertTriangle size={18} color="var(--status-red-text)" style={{ flexShrink: 0 }} />}
            <span>
              {check.withinFreeEquity
                ? `Ryms inom det fria egna kapitalet (${fmt(check.freeEquity)} kr).`
                : `Överstiger det fria egna kapitalet (${fmt(check.freeEquity)} kr). Utdelningen kan inte bokföras.`}
              {dividendPerShare(form.amount, form.shares) != null && ` Utdelning per aktie: ${fmt(dividendPerShare(form.amount, form.shares))} kr.`}
            </span>
          </div>
          {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" style={btn(false)} onClick={() => { setForm(null); setError(''); }}>Avbryt</button>
            <button type="submit" style={btn(true)}>Bokför beslut</button>
          </div>
        </form>
      ) : (
        <div><button type="button" style={btn(true)} onClick={startNew}><Plus size={14} /> Nytt utdelningsbeslut</button></div>
      )}

      {!form && error && <p style={{ margin: 0, fontSize: '13px', color: 'var(--status-red-text)' }}>{error}</p>}

      {paying && (
        <PayPanel dividend={paying} onCancel={() => setPaying(null)} onConfirm={(date) => pay(paying, date)} />
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={d => d.id}
          rows={dividends}
          emptyMessage="Inga utdelningsbeslut ännu."
          mobileList={d => ({ primary: d.note || 'Utdelning', amount: `${fmt(d.amount)} kr`, meta: d.date })}
          columns={[
            { key: 'date', label: 'Beslut', render: d => d.date },
            { key: 'note', label: 'Avser', fontWeight: 600, color: 'var(--text-main)', render: d => d.note || 'Utdelning' },
            { key: 'amount', label: 'Belopp', align: 'right', render: d => `${fmt(d.amount)} kr` },
            { key: 'perShare', label: 'Per aktie', align: 'right', render: d => (d.shares ? `${fmt(dividendPerShare(d.amount, d.shares))} kr` : '—') },
            {
              key: 'status', label: 'Status',
              render: d => {
                const s = dividendStatus(d, verifications);
                if (s.paid) return <span style={{ color: 'var(--status-green-text)' }}>Utbetald</span>;
                return <span style={{ color: 'var(--status-amber-text)' }}>{s.decided ? 'Beslutad, ej utbetald' : 'Beslut ej bokfört'}</span>;
              },
            },
            {
              key: 'actions', label: '', align: 'right',
              render: d => {
                const s = dividendStatus(d, verifications);
                return s.decided && !s.paid ? <button type="button" style={btn(false)} onClick={() => setPaying(d)}>Bokför utbetalning</button> : null;
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
      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px' }}>Utbetalning av {fmt(dividend.amount)} kr</div>
      <div style={{ maxWidth: '240px' }}><label style={lbl}>Utbetalningsdatum</label><input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} /></div>
      <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
        <button type="button" style={btn(true)} onClick={() => onConfirm(date)}>Bokför</button>
        <button type="button" style={btn(false)} onClick={onCancel}>Avbryt</button>
      </div>
    </div>
  );
}
