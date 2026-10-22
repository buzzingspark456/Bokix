import React, { useMemo, useState } from 'react';
import { lockedPeriodFor, activeFiscalYear } from '../utils/fiscalYear';
import { previousFiscalYear } from '../utils/annualReport';
import { Plus, AlertTriangle, Download } from './icons';
import ListTable from './shared/ListTable';
import { confirmDialog } from './shared/ConfirmDialog';
import {
  REFUND_COST_ACCOUNT, REFUND_LIABILITY_ACCOUNT, memberTurnover, computeRefund, refundSummary,
  buildRefundDecision, buildRefundPayment, refundStatus,
} from '../utils/patronageRefund';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

const kr = (v) => `${numberFormat('sv-SE').format(Math.round(v || 0))} kr`;
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`);

/**
 * Återbäring i ekonomisk förening, flik i Skatt och bokslut (före INK2).
 * Ett förslag per räkenskapsår med medlemmarnas omsättning, bokföring av
 * beslut och utbetalning (utils/patronageRefund.js). Avdraget i INK2 och
 * förslaget i årsredovisningen räknas fram därifrån.
 */
export default function PatronageRefund({ company, accounts = [], verifications = [], invoices = [], expenses = [], contacts = [], onAddVerification, setAccounts, setCompanyInfo }) {
  const refunds = useMemo(() => company?.patronageRefunds || [], [company?.patronageRefunds]);
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [paying, setPaying] = useState(null);

  const current = activeFiscalYear(company);
  const previous = previousFiscalYear(current, company);
  const years = [previous, current].filter(y => verifications.some(v => v.date >= y.start && v.date <= y.end) || y.key === current.key);

  const saveRefunds = (fn) => setCompanyInfo?.(prev => ({ ...prev, patronageRefunds: fn(prev.patronageRefunds || []) }));

  const startNew = () => {
    const year = years[0];
    setForm({ id: null, fyKey: year.key, basis: 'purchases', mode: 'amount', amount: '', percent: '', privateMembers: false, decidedBy: 'meeting', decisionDate: '', members: [] });
    setError('');
  };
  const edit = (r) => { setForm({ ...r, members: (r.members || []).map(m => ({ ...m })) }); setError(''); };
  const formYear = form ? (years.find(y => y.key === form.fyKey) || years[0]) : null;
  const formRefund = form ? { ...form, fyEnd: formYear.end, fyLabel: formYear.label } : null;
  const summary = formRefund ? refundSummary(formRefund) : null;

  const setMember = (i, patch) => setForm(f => ({ ...f, members: f.members.map((m, j) => (j === i ? { ...m, ...patch } : m)) }));
  const fetchMembers = () => {
    const list = memberTurnover({ basis: form.basis, invoices, expenses, contacts, period: { start: formYear.start, end: formYear.end } });
    if (!list.length) return setError(form.basis === 'sales' ? t('refund.noSuppliers') : t('refund.noCustomers'));
    setError('');
    setForm(f => ({ ...f, members: list.map(m => ({ id: newId(), ...m })) }));
  };

  const save = (e) => {
    e.preventDefault();
    const members = form.members.filter(m => String(m.name || '').trim() || Number(m.turnover));
    if (!members.length) return setError(t('refund.needMembers'));
    if (members.some(m => !String(m.name || '').trim())) return setError(t('refund.needNames'));
    const draft = { ...form, members, fyStart: formYear.start, fyEnd: formYear.end, fyLabel: formYear.label };
    if (!(computeRefund(draft).total > 0)) return setError(t('refund.needAmount'));
    if (!form.decisionDate) return setError(t('refund.needDate'));
    if (form.decisionDate < formYear.start) return setError(t('refund.dateBeforeYear'));
    const saved = { ...draft, id: form.id || newId() };
    saveRefunds(list => (form.id ? list.map(r => (r.id === form.id ? saved : r)) : [...list, saved]));
    setForm(null); setError('');
  };

  const ensureAccounts = () => {
    if (!setAccounts) return;
    const needed = [
      { code: REFUND_COST_ACCOUNT, name: 'Lämnade gottgörelser', type: 'kostnad' },
      { code: REFUND_LIABILITY_ACCOUNT, name: 'Övriga kortfristiga skulder', type: 'skuld_kapital' },
    ];
    setAccounts(prev => {
      const missing = needed.filter(n => !prev.some(a => a.code === n.code));
      return missing.length ? [...prev, ...missing].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })) : prev;
    });
  };

  const bookDecision = async (r) => {
    const s = refundSummary(r);
    if (lockedFor(r.decisionDate)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(r.decisionDate) }));
    if (!(await confirmDialog(t('refund.confirmDecision', { amount: kr(s.total), date: r.decisionDate })))) return;
    ensureAccounts();
    onAddVerification(buildRefundDecision(r, s.total));
    setError('');
  };
  const pay = async (r, date) => {
    const s = refundSummary(r);
    if (lockedFor(date)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(date) }));
    if (date < r.decisionDate) return setError(t('refund.payBeforeDecision'));
    if (!(await confirmDialog(t('ui.bokfor_utbetalning_av_kr_den', { v0: numberFormat('sv-SE').format(Math.round(s.total)), date })))) return;
    onAddVerification(buildRefundPayment(r, s.total, { date }));
    setPaying(null); setError('');
  };
  const remove = async (r) => {
    if (!(await confirmDialog(t('refund.confirmRemove', { label: r.fyLabel })))) return;
    saveRefunds(list => list.filter(x => x.id !== r.id));
  };
  const downloadList = (r) => {
    const s = computeRefund(r);
    const lines = [['Medlem', 'Omsättning', 'Återbäring'], ...s.perMember.map(m => [m.name, m.turnover, m.refund]), ['Summa', s.totalTurnover, s.total]];
    const csv = '﻿' + lines.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `aterbaring-${r.fyLabel.replace(/\//g, '-')}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const latest = refunds.find(r => r.fyEnd === previous.end) || refunds.find(r => r.fyEnd === current.end) || null;
  const latestSummary = latest ? refundSummary(latest) : null;

  const statusPill = (r) => {
    const s = refundStatus(r, verifications);
    if (s.paid) return <span className="agi-pill ok">{t('ui.utbetald')}</span>;
    return <span className="agi-pill warn">{s.decided ? t('ui.beslutad_ej_utbetald') : t('refund.proposal')}</span>;
  };
  const actions = (r) => {
    const s = refundStatus(r, verifications);
    return (
      <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        <button type="button" className="agi-btn" onClick={() => downloadList(r)} title={t('refund.downloadList')} aria-label={t('refund.downloadList')}><Download size={14} /></button>
        {!s.decided && <button type="button" className="agi-btn" onClick={() => edit(r)}>{t('ui.andra')}</button>}
        {!s.decided && <button type="button" className="agi-btn" onClick={() => remove(r)}>{t('ui.ta_bort')}</button>}
        {!s.decided && <button type="button" className="agi-btn primary" onClick={() => bookDecision(r)}>{t('refund.bookDecision')}</button>}
        {s.decided && !s.paid && <button type="button" className="agi-btn" onClick={() => setPaying(r)}>{t('ui.bokfor_utbetalning')}</button>}
      </span>
    );
  };

  const Seg = ({ label, value, options, onChange }) => (
    <div className="rf-q">
      <span>{label}</span>
      <span className="rf-seg" role="group" aria-label={label}>
        {options.map(([val, text]) => <button key={text} type="button" aria-pressed={value === val} onClick={() => onChange(val)}>{text}</button>)}
      </span>
    </div>
  );

  return (
    <div className="fp-page">
      <style>{`
        .rf-q { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .rf-seg { display: inline-flex; border: 1px solid var(--border); border-radius: 999px; padding: 3px; gap: 2px; flex-wrap: wrap; }
        .rf-seg button { border: none; background: transparent; padding: 6px 14px; border-radius: 999px; font: inherit; font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
        .rf-seg button[aria-pressed="true"] { background: var(--bg-card); color: var(--text-main); box-shadow: 0 1px 2px rgba(0,0,0,0.12); }
        .rf-members { border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin: 6px 0 10px; }
        .rf-m { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 110px 32px; gap: 10px; align-items: center; padding: 8px 12px; border-top: 1px solid var(--border-light); font-size: 13.5px; }
        .rf-m:first-child { border-top: 0; }
        .rf-m.head { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.03em; }
        .rf-m .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
        .rf-x { border: none; background: transparent; color: var(--text-muted); cursor: pointer; font-size: 18px; line-height: 1; }
        .rf-box { padding: 12px 14px; border-radius: 10px; background: var(--bg-muted); font-size: 13.5px; line-height: 1.5; margin: 10px 0; }
        @media (max-width: 700px) {
          .rf-m { grid-template-columns: minmax(0, 1fr) 100px 28px; }
          .rf-m > :nth-child(3) { display: none; }
        }
      `}</style>

      <section className="fp-strip">
        <div>
          <div className="fp-strip-title">{t('refund.title')}</div>
          <div className="fp-strip-sub">{t('refund.sub')}</div>
        </div>
        {!form && (
          <div className="fp-actions">
            <button type="button" className="agi-btn primary" onClick={startNew}><Plus size={15} /> {t('refund.new')}</button>
          </div>
        )}
      </section>

      {latestSummary && (
        <div className="fp-stats">
          {[
            [t('refund.statYear'), latest.fyLabel],
            [t('refund.statTurnover'), kr(latestSummary.totalTurnover)],
            [t('refund.statRefund'), kr(latestSummary.total)],
            [t('refund.statDeductible'), kr(latestSummary.deductible)],
          ].map(([label, value]) => (
            <div key={label} className="fp-stat"><div className="fp-stat-label">{label}</div><div className="fp-stat-value">{value}</div></div>
          ))}
        </div>
      )}

      {form && (
        <form onSubmit={save} className="fp-section">
          <h3 className="fp-title">{form.id ? t('refund.edit') : t('refund.new')}</h3>
          <div className="fp-fields">
            <div style={{ maxWidth: 260 }}>
              <label className="fp-label">{t('refund.year')}</label>
              <select className="fp-input" value={form.fyKey} onChange={e => setForm(f => ({ ...f, fyKey: e.target.value }))}>
                {years.map(y => <option key={y.key} value={y.key}>{y.label}</option>)}
              </select>
            </div>
            <Seg label={t('refund.qBasis')} value={form.basis} options={[['purchases', t('refund.basisPurchases')], ['sales', t('refund.basisSales')]]} onChange={v => setForm(f => ({ ...f, basis: v }))} />

            <div>
              <div className="fp-label">{t('refund.members')}</div>
              <div className="rf-members">
                <div className="rf-m head"><span>{t('refund.member')}</span><span style={{ textAlign: 'right' }}>{t('refund.turnover')}</span><span style={{ textAlign: 'right' }}>{t('refund.refund')}</span><span /></div>
                {form.members.map((m, i) => (
                  <div key={m.id || i} className="rf-m">
                    <input className="fp-input" aria-label={t('refund.member')} value={m.name} onChange={e => setMember(i, { name: e.target.value })} />
                    <input type="number" min="0" className="fp-input" aria-label={t('refund.turnover')} value={m.turnover} onChange={e => setMember(i, { turnover: e.target.value === '' ? '' : Number(e.target.value) })} />
                    <span className="num">{kr(summary.perMember[i]?.refund)}</span>
                    <button type="button" className="rf-x" aria-label={t('refund.removeMember')} onClick={() => setForm(f => ({ ...f, members: f.members.filter((_, j) => j !== i) }))}>×</button>
                  </div>
                ))}
                {form.members.length === 0 && <div className="rf-m" style={{ color: 'var(--text-muted)' }}><span style={{ gridColumn: '1 / -1' }}>{t('refund.noMembersYet')}</span></div>}
              </div>
              <div className="fp-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                <button type="button" className="agi-btn" onClick={fetchMembers}>{form.basis === 'sales' ? t('refund.fetchSuppliers') : t('refund.fetchCustomers')}</button>
                <button type="button" className="agi-btn" onClick={() => setForm(f => ({ ...f, members: [...f.members, { id: newId(), name: '', turnover: '' }] }))}><Plus size={14} /> {t('refund.addMember')}</button>
              </div>
            </div>

            <Seg label={t('refund.qMode')} value={form.mode} options={[['amount', t('refund.modeAmount')], ['percent', t('refund.modePercent')]]} onChange={v => setForm(f => ({ ...f, mode: v }))} />
            <div style={{ maxWidth: 260 }}>
              <label className="fp-label">{form.mode === 'percent' ? t('refund.percent') : t('refund.amount')}</label>
              <input type="number" min="0" step={form.mode === 'percent' ? '0.01' : '1'} className="fp-input"
                value={form.mode === 'percent' ? form.percent : form.amount}
                onChange={e => setForm(f => ({ ...f, [f.mode === 'percent' ? 'percent' : 'amount']: e.target.value === '' ? '' : Number(e.target.value) }))} />
            </div>
            <Seg label={t('refund.qPrivate')} value={form.privateMembers} options={[[true, t('ink4.yes')], [false, t('ink4.no')]]} onChange={v => setForm(f => ({ ...f, privateMembers: v }))} />
            <Seg label={t('refund.qDecidedBy')} value={form.decidedBy} options={[['meeting', t('refund.meeting')], ['board', t('refund.board')]]} onChange={v => setForm(f => ({ ...f, decidedBy: v }))} />
            <div style={{ maxWidth: 260 }}>
              <label className="fp-label">{t('refund.decisionDate')}</label>
              <input type="date" className="fp-input" value={form.decisionDate} onChange={e => setForm(f => ({ ...f, decisionDate: e.target.value }))} />
            </div>

            <div className="rf-box">
              <div><strong>{t('refund.total', { amount: kr(summary.total), turnover: kr(summary.totalTurnover) })}</strong></div>
              {form.decisionDate && (
                <div>{summary.withinYear ? t('refund.timingWithin', { label: formYear.label }) : t('refund.timingAfter', { label: formYear.label })}</div>
              )}
              {form.privateMembers && (summary.unknownRate
                ? <div>{t('refund.capUnknown')}</div>
                : <div>{t('refund.cap', { cap: kr(summary.cap), rate: numberFormat('sv-SE').format(summary.rate) })}{summary.nonDeductible > 0 ? ` ${t('refund.capOver', { amount: kr(summary.nonDeductible) })}` : ''}</div>)}
            </div>
            {error && <div className="fp-hint bad" style={{ display: 'flex', gap: 8 }}><AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} /> {error}</div>}
          </div>
          <div className="fp-foot">
            <button type="button" className="agi-btn" onClick={() => { setForm(null); setError(''); }}>{t('ui.avbryt')}</button>
            <button type="submit" className="agi-btn primary">{t('refund.save')}</button>
          </div>
        </form>
      )}

      {!form && error && <div className="fp-section"><div className="fp-hint bad">{error}</div></div>}
      {paying && <PayPanel refund={paying} onCancel={() => setPaying(null)} onConfirm={(date) => pay(paying, date)} />}

      <ListTable
        rowKey={r => r.id}
        rows={refunds}
        emptyMessage={t('refund.empty')}
        mobileList={r => ({ primary: t('refund.rowTitle', { label: r.fyLabel }), amount: kr(computeRefund(r).total), meta: r.decisionDate, pill: statusPill(r), meta2: actions(r) })}
        columns={[
          { key: 'year', label: t('refund.year'), fontWeight: 600, color: 'var(--text-main)', render: r => r.fyLabel },
          { key: 'date', label: t('refund.decisionDate'), render: r => `${r.decisionDate} · ${r.decidedBy === 'board' ? t('refund.board') : t('refund.meeting')}` },
          { key: 'members', label: t('refund.members'), align: 'right', render: r => (r.members || []).length },
          { key: 'amount', label: t('refund.refund'), align: 'right', render: r => kr(computeRefund(r).total) },
          { key: 'status', label: t('ui.status'), render: statusPill },
          { key: 'actions', label: '', align: 'right', render: actions },
        ]}
      />
      <div className="fp-section" style={{ fontSize: 13, color: 'var(--text-secondary)', borderBottom: 'none' }}>{t('refund.footer')}</div>
    </div>
  );
}

function PayPanel({ refund, onCancel, onConfirm }) {
  const [date, setDate] = useState(todayIso());
  return (
    <section className="fp-section">
      <h3 className="fp-title">{t('ui.utbetalning_av')} {kr(computeRefund(refund).total)}</h3>
      <div style={{ maxWidth: '240px' }}><label className="fp-label">{t('ui.utbetalningsdatum')}</label><input type="date" className="fp-input" value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="fp-foot" style={{ justifyContent: 'flex-start' }}>
        <button type="button" className="agi-btn primary" onClick={() => onConfirm(date)}>{t('ui.bokfor_2')}</button>
        <button type="button" className="agi-btn" onClick={onCancel}>{t('ui.avbryt')}</button>
      </div>
    </section>
  );
}
