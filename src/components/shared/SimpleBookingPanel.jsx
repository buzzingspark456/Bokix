import React from 'react';
import { CheckCircle2 } from '../icons';
import { AccountSearch } from './SearchInputs';
import {
  VAT_RATES, simpleKindsFor, paymentAccounts, transferAccounts, describeVerification,
} from '../../utils/plainBooking';

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);

const inp = {
  padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', fontFamily: 'inherit',
  width: '100%', boxSizing: 'border-box', outline: 'none', color: 'var(--text-main)', background: 'var(--bg-card)',
};
const label = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '5px' };

function Field({ title, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <label style={label}>{title}</label>
      {children}
    </div>
  );
}

/**
 * Enkel bokföring: användaren väljer vad som hänt och fyller i belopp, så
 * bygger appen verifikationsraderna. Ingen debet eller kredit visas. Själva
 * radbygget ligger i utils/plainBooking.js; den här komponenten äger bara
 * formuläret och förhandsvisningen.
 *
 * `rows` är de byggda raderna (tal), `errors` det som saknas.
 */
export default function SimpleBookingPanel({ fields, setFields, accounts, orgType, rows, errors, vatExempt = false }) {
  const set = (patch) => setFields(prev => ({ ...prev, ...patch }));
  const kinds = simpleKindsFor(orgType);
  const payments = paymentAccounts(accounts);
  const transfers = transferAccounts(accounts);
  const isSoleProp = orgType === 'Enskild firma';
  const expenseAccounts = (accounts || []).filter(a => /^[14-8]/.test(a.code) && !/^19/.test(a.code));
  const incomeAccounts = (accounts || []).filter(a => /^[38]/.test(a.code));
  const preview = describeVerification(rows, accounts);
  const total = rows.reduce((s, r) => s + (Number(r.debet) || 0), 0);
  const kind = fields.kind;

  const accountSelect = (value, onChange, list) => (
    <select value={value} onChange={e => onChange(e.target.value)} style={inp}>
      {list.map(a => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
    </select>
  );
  const vatSelect = (withMixed) => (
    <select value={fields.vatRate} onChange={e => set({ vatRate: e.target.value === 'mixed' ? 'mixed' : Number(e.target.value) })} style={inp}>
      {VAT_RATES.map(r => <option key={r} value={r}>{r === 0 ? 'Ingen moms' : `${r} % moms`}</option>)}
      {withMixed && <option value="mixed">Flera momssatser</option>}
    </select>
  );
  const amountField = (title) => (
    <Field title={title}>
      <input
        type="number" min="0" step="0.01" inputMode="decimal" value={fields.amount}
        onChange={e => set({ amount: e.target.value })} placeholder="0,00"
        style={{ ...inp, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
      />
    </Field>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Vad har hänt?</div>
        <div role="radiogroup" aria-label="Vad har hänt?" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px' }}>
          {kinds.map(k => {
            const on = kind === k.id;
            return (
              <button
                key={k.id} type="button" role="radio" aria-checked={on}
                onClick={() => set({ kind: k.id, ...(k.id !== 'expense' && fields.vatRate === 'mixed' ? { vatRate: 25 } : {}) })}
                style={{
                  textAlign: 'left', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                  background: on ? 'var(--bg-muted)' : 'var(--bg-card)', color: 'var(--text-main)',
                }}
              >
                <div style={{ fontSize: '13.5px', fontWeight: 700 }}>{k.title}</div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>{k.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
        {kind === 'expense' && (
          <>
            {amountField(vatExempt ? 'Belopp (kr)' : 'Belopp inkl. moms (kr)')}
            {!vatExempt && <Field title="Moms på kvittot">{vatSelect(true)}</Field>}
            {!vatExempt && fields.vatRate === 'mixed' && (
              <Field title="Moms i kronor">
                <input
                  type="number" min="0" step="0.01" inputMode="decimal" value={fields.vatAmount ?? ''}
                  onChange={e => set({ vatAmount: e.target.value })} placeholder="All moms på kvittot"
                  style={{ ...inp, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
                />
              </Field>
            )}
            <Field title="Vad har du köpt?">
              <AccountSearch value={fields.account} accounts={expenseAccounts} placeholder="Sök, till exempel kontorsmaterial" onChange={code => set({ account: code })} />
            </Field>
            <Field title="Hur betalade du?">
              <select
                value={fields.payPrivate && isSoleProp ? 'private' : fields.payAccount}
                onChange={e => (e.target.value === 'private' ? set({ payPrivate: true }) : set({ payPrivate: false, payAccount: e.target.value }))}
                style={inp}
              >
                {payments.map(a => <option key={a.code} value={a.code}>{a.name}</option>)}
                {(accounts || []).some(a => String(a.code) === '2440') && <option value="2440">Ännu inte betalt (leverantörsskuld)</option>}
                {isSoleProp && <option value="private">Med egna pengar (privat)</option>}
              </select>
            </Field>
          </>
        )}

        {kind === 'income' && (
          <>
            {amountField(vatExempt ? 'Belopp (kr)' : 'Belopp inkl. moms (kr)')}
            {!vatExempt && <Field title="Moms på försäljningen">{vatSelect(false)}</Field>}
            <Field title="Vad sålde du?">
              <AccountSearch value={fields.account} accounts={incomeAccounts} placeholder="Standard efter momssats" onChange={code => set({ account: code })} />
            </Field>
            <Field title="Vart kom pengarna?">{accountSelect(fields.payAccount, v => set({ payAccount: v }), payments)}</Field>
          </>
        )}

        {kind === 'transfer' && (
          <>
            {amountField('Belopp (kr)')}
            <Field title="Från">{accountSelect(fields.fromAccount, v => set({ fromAccount: v }), transfers)}</Field>
            <Field title="Till">
              <select value={fields.toAccount} onChange={e => set({ toAccount: e.target.value })} style={inp}>
                <option value="">Välj konto</option>
                {transfers.map(a => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
              </select>
            </Field>
          </>
        )}

        {(kind === 'owner_in' || kind === 'owner_out') && (
          <>
            {amountField('Belopp (kr)')}
            <Field title={kind === 'owner_in' ? 'Vart satte du in pengarna?' : 'Från vilket konto togs pengarna?'}>
              {accountSelect(fields.payAccount, v => set({ payAccount: v }), payments)}
            </Field>
          </>
        )}
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-muted)' }}>
        <div style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.02em', borderBottom: '1px solid var(--border)' }}>
          SÅ HÄR BOKFÖRS DET
        </div>
        {preview.length === 0 ? (
          <div style={{ padding: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>{errors[0] || 'Fyll i uppgifterna ovan så visas bokföringen här.'}</div>
        ) : (
          <>
            {preview.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '9px 14px', fontSize: '13px', borderBottom: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
                <span style={{ color: 'var(--text-main)' }}><span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{p.account}</span>{p.text}</span>
                <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: 'var(--text-main)' }}>{fmt(p.amount)} kr</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', fontSize: '12.5px', fontWeight: 600, color: 'var(--status-green-text)', background: 'var(--status-green-bg)' }}>
              <CheckCircle2 size={14} /> Det går ihop ({fmt(total)} kr)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
