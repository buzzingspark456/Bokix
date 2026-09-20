import React, { useMemo, useState } from 'react';
import { Plus, AlertTriangle, CheckCircle2, Trash2 } from './icons';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  ACCRUAL_KINDS, accrualKind, accrualStatus, buildAccrualVerification, buildReversalVerification,
  dueReversals, reversalDateFor,
} from '../utils/accruals';
import { summarizeVacationLiability } from '../utils/vacation';
import { computeVacationAdjustment, buildVacationLiabilityVerification, isVacationAdjustmentBooked } from '../utils/vacationLiability';

const fmt = (v) => new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const yearEnd = () => `${new Date().getFullYear()}-12-31`;
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `accr_${Date.now()}_${Math.random().toString(36).slice(2)}`);

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

const emptyForm = () => ({ kind: 'prepaid_expense', description: '', date: yearEnd(), amount: '', counterAccount: accrualKind('prepaid_expense').counterDefault });

/**
 * Periodiseringar — upplupna och förutbetalda poster vid bokslut, med
 * automatisk återföring. Logiken ligger i utils/accruals.js.
 */
function VacationLiabilityCard({ employees, payrollRuns, verifications, lockedYears, onAddVerification }) {
  const [date, setDate] = useState(yearEnd());
  const [message, setMessage] = useState('');
  const adjustment = useMemo(() => {
    const summary = summarizeVacationLiability({ employees, payrollRuns, asOf: new Date(`${date}T00:00:00`) });
    return computeVacationAdjustment({ verifications, date, liability: summary.totalLiability, liabilityFee: summary.totalLiabilityFee });
  }, [employees, payrollRuns, verifications, date]);
  const verification = buildVacationLiabilityVerification({ date, ...adjustment });
  const booked = isVacationAdjustmentBooked(verifications, date);
  const locked = lockedYears.includes(date.slice(0, 4));

  const book = async () => {
    if (!verification) return;
    if (locked) return setMessage(`Räkenskapsåret ${date.slice(0, 4)} är låst.`);
    if (!(await confirmDialog('Bokför justering av semesterlöneskulden?'))) return;
    onAddVerification(verification);
    setMessage('Justeringen är bokförd.');
  };

  return (
    <div style={card}>
      <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>Semesterlöneskuld</div>
      <p style={{ margin: '0 0 14px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
        Intjänad, ej uttagen semester är en skuld vid bokslutet. Bokix jämför den beräknade skulden med saldot på 2920 och 2940 och bokför skillnaden.
      </p>
      <div style={{ maxWidth: '220px', marginBottom: '14px' }}>
        <label style={lbl}>Per datum</label>
        <input type="date" style={inp} value={date} onChange={e => e.target.value && setDate(e.target.value)} />
      </div>
      {[
        ['Beräknad semesterlön (2920)', adjustment.liability, adjustment.balance2920],
        ['Beräknade arbetsgivaravgifter (2940)', adjustment.liabilityFee, adjustment.balance2940],
      ].map(([label, calc, ledger]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '7px 0', borderTop: '1px solid var(--border)', fontSize: '13.5px', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          <span>beräknat <b>{fmt(calc)} kr</b> · bokfört <b>{fmt(ledger)} kr</b></span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600 }}>
          {verification && !booked ? <AlertTriangle size={16} color="var(--status-amber-text)" /> : <CheckCircle2 size={16} color="var(--status-green-text)" />}
          {booked ? 'Justeringen är bokförd'
            : verification ? `Justering: ${fmt(adjustment.diffLiability)} kr + ${fmt(adjustment.diffFee)} kr avgifter`
              : 'Kontona stämmer med beräknad skuld'}
        </div>
        {verification && !booked && <button type="button" style={btn(true)} onClick={book}>Bokför justering</button>}
      </div>
      {message && <p style={{ margin: '10px 0 0', fontSize: '13px', color: locked ? 'var(--status-red-text)' : 'var(--status-green-text)' }}>{message}</p>}
    </div>
  );
}

export default function Accruals({ company, accounts = [], verifications = [], employees = [], payrollRuns = [], onAddVerification, setCompanyInfo }) {
  const accruals = useMemo(() => company?.accruals || [], [company?.accruals]);
  const lockedYears = useMemo(() => Object.keys(company?.lockedFiscalYears || {}), [company?.lockedFiscalYears]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');

  const saveAccruals = (next) => setCompanyInfo(prev => ({ ...prev, accruals: next }));
  const due = useMemo(() => dueReversals(accruals, verifications, todayIso()), [accruals, verifications]);
  const kind = form ? accrualKind(form.kind) : null;

  const changeKind = (id) => setForm(f => ({ ...f, kind: id, counterAccount: accrualKind(id).counterDefault }));

  const handleSave = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.description.trim()) return setError('Beskriv vad periodiseringen avser.');
    if (!(amount > 0)) return setError('Beloppet måste vara större än 0.');
    if (!form.date) return setError('Ange datum.');
    if (lockedYears.includes(form.date.slice(0, 4))) return setError(`Räkenskapsåret ${form.date.slice(0, 4)} är låst.`);
    if (!accounts.some(a => a.code === form.counterAccount)) return setError(`Kontot ${form.counterAccount} finns inte i kontoplanen.`);
    const accrual = { id: newId(), ...form, description: form.description.trim(), amount, reversalDate: reversalDateFor(form.date) };
    saveAccruals([...accruals, accrual]);
    onAddVerification(buildAccrualVerification(accrual));
    setForm(null); setError('');
  };

  const bookDueReversals = async () => {
    if (!(await confirmDialog(`Bokför ${due.length} ${due.length === 1 ? 'återföring' : 'återföringar'}?`))) return;
    due.forEach(a => {
      if (lockedYears.includes((a.reversalDate || reversalDateFor(a.date)).slice(0, 4))) return;
      onAddVerification(buildReversalVerification(a));
    });
  };

  const remove = async (a) => {
    const s = accrualStatus(a, verifications);
    if (s.booked) return;
    if (!(await confirmDialog(`Ta bort "${a.description}"?`))) return;
    saveAccruals(accruals.filter(x => x.id !== a.id));
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '680px' }}>
        Periodisera så att kostnader och intäkter hamnar på rätt räkenskapsår. Varje post bokförs vid årsskiftet och återförs automatiskt första dagen i nästa år.
      </p>

      {due.length > 0 && (
        <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderColor: 'var(--status-amber-text)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={18} color="var(--status-amber-text)" />
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{due.length} {due.length === 1 ? 'återföring' : 'återföringar'} att bokföra. Annars räknas kostnaden eller intäkten två gånger.</div>
          </div>
          <button type="button" style={btn(true)} onClick={bookDueReversals}>Bokför återföringar</button>
        </div>
      )}

      {employees.length > 0 && (
        <VacationLiabilityCard employees={employees} payrollRuns={payrollRuns} verifications={verifications} lockedYears={lockedYears} onAddVerification={onAddVerification} />
      )}

      {form ? (
        <form onSubmit={handleSave} style={card}>
          <h3 style={{ margin: '0 0 6px', fontSize: '15px', fontWeight: 700 }}>Ny periodisering</h3>
          <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--text-secondary)' }}>{kind.help}</p>
          <div className="form-row-2" style={{ display: 'grid', gap: '16px' }}>
            <div>
              <label style={lbl}>Typ</label>
              <select style={inp} value={form.kind} onChange={e => changeKind(e.target.value)}>
                {ACCRUAL_KINDS.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Datum (bokslutsdag)</label>
              <input type="date" style={inp} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Avser *</label>
              <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="t.ex. Hyra januari nästa år" />
            </div>
            <div>
              <label style={lbl}>Belopp (kr) *</label>
              <input type="number" step="0.01" style={inp} value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>{kind.counterLabel}</label>
              <AccountSearch value={form.counterAccount} onChange={c => setForm(f => ({ ...f, counterAccount: c }))} accounts={accounts} placeholder="Sök konto…" />
            </div>
          </div>
          <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '14px 0 0' }}>
            Bokförs mot {kind.balanceAccount}. Återföring: {reversalDateFor(form.date || yearEnd())}.
          </p>
          {error && <p style={{ color: 'var(--status-red-text)', fontSize: '13px', margin: '12px 0 0' }}>{error}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
            <button type="button" style={btn(false)} onClick={() => { setForm(null); setError(''); }}>Avbryt</button>
            <button type="submit" style={btn(true)}>Bokför periodisering</button>
          </div>
        </form>
      ) : (
        <div><button type="button" style={btn(true)} onClick={() => { setForm(emptyForm()); setError(''); }}><Plus size={14} /> Ny periodisering</button></div>
      )}

      <div style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--bg-card)' }}>
        <ListTable
          rowKey={a => a.id}
          rows={accruals}
          emptyMessage="Inga periodiseringar ännu. Lägg till förutbetald hyra, upplupen el eller något annat som hör till en annan period."
          mobileList={a => ({ primary: a.description, amount: `${fmt(a.amount)} kr`, meta: `${accrualKind(a.kind).label} · ${a.date}` })}
          columns={[
            { key: 'description', label: 'Avser', fontWeight: 600, color: 'var(--text-main)', render: a => a.description },
            { key: 'kind', label: 'Typ', render: a => accrualKind(a.kind).label },
            { key: 'date', label: 'Datum', render: a => a.date },
            { key: 'amount', label: 'Belopp', align: 'right', render: a => `${fmt(a.amount)} kr` },
            {
              key: 'status', label: 'Status',
              render: a => {
                const s = accrualStatus(a, verifications);
                if (s.reversed) return <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', color: 'var(--status-green-text)' }}><CheckCircle2 size={14} /> Återförd</span>;
                if (s.booked) return <span style={{ color: 'var(--status-amber-text)' }}>Bokförd, återförs {a.reversalDate || reversalDateFor(a.date)}</span>;
                return <span style={{ color: 'var(--text-secondary)' }}>Ej bokförd</span>;
              },
            },
            {
              key: 'actions', label: '', align: 'right', width: 50,
              render: a => !accrualStatus(a, verifications).booked && (
                <button type="button" title="Ta bort" onClick={() => remove(a)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '2px' }}><Trash2 size={14} /></button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
