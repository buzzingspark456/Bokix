import React, { useMemo, useState } from 'react';
import { lockedPeriodFor } from '../utils/fiscalYear';
import { Plus, AlertTriangle, Trash2, X, RotateCcw } from './icons';
import ListTable from './shared/ListTable';
import { AccountSearch } from './shared/SearchInputs';
import { confirmDialog } from './shared/ConfirmDialog';
import { Panel, Overview, TaskRow, ListBar, usePalette } from './shared/Workspace';
import {
  ACCRUAL_KINDS, accrualKind, accrualStatus, buildAccrualVerification, buildReversalVerification,
  dueReversals, reversalDateFor,
} from '../utils/accruals';
import { summarizeVacationLiability } from '../utils/vacation';
import { computeVacationAdjustment, buildVacationLiabilityVerification, isVacationAdjustmentBooked } from '../utils/vacationLiability';
import { t, dateLocale } from '../i18n';
import { numberFormat } from '../utils/intlCache';
import './workspace.css';

const fmt = (v) => numberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v || 0);
const fmtKr = (v) => `${numberFormat('sv-SE', { maximumFractionDigits: 0 }).format(Math.round(v || 0))} kr`;
const pad = (n) => String(n).padStart(2, '0');
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const yearEnd = () => `${new Date().getFullYear()}-12-31`;
const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `accr_${Date.now()}_${Math.random().toString(36).slice(2)}`);

const emptyForm = () => ({ kind: 'prepaid_expense', description: '', date: yearEnd(), amount: '', counterAccount: accrualKind('prepaid_expense').counterDefault });

// Färgen följer startsidan: kostnadssidan korall, intäktssidan blå.
const kindColor = (kind, palette) => (accrualKind(kind)?.side === 'income' ? palette.income : palette.cost);

/**
 * Semesterlöneskulden vid bokslut: Bokix räknar skulden ur lönerna och
 * jämför med saldot på 2920/2940. Samma panelstil som resten av sidan.
 */
function useVacation({ employees, payrollRuns, verifications, date }) {
  return useMemo(() => {
    if (!employees.length) return null;
    const summary = summarizeVacationLiability({ employees, payrollRuns, asOf: new Date(`${date}T00:00:00`) });
    const adjustment = computeVacationAdjustment({ verifications, date, liability: summary.totalLiability, liabilityFee: summary.totalLiabilityFee });
    const verification = buildVacationLiabilityVerification({ date, ...adjustment });
    const booked = isVacationAdjustmentBooked(verifications, date);
    return { adjustment, verification, booked, needs: Boolean(verification && !booked), total: adjustment.liability + adjustment.liabilityFee, diff: adjustment.diffLiability + adjustment.diffFee };
  }, [employees, payrollRuns, verifications, date]);
}

/**
 * Periodiseringar — upplupna och förutbetalda poster vid bokslut, med
 * automatisk återföring. Logiken ligger i utils/accruals.js. Sidan har
 * arbetsytornas stil (workspace.css): kant i kant, startsidans grå rutor.
 */
export default function Accruals({ company, accounts = [], verifications = [], employees = [], payrollRuns = [], onAddVerification, setCompanyInfo }) {
  const palette = usePalette(company);
  const accruals = useMemo(() => company?.accruals || [], [company?.accruals]);
  // Vilket låst räkenskapsår datumet ligger i (null om inget), se utils/fiscalYear.js.
  const lockedFor = (date) => lockedPeriodFor(date, company?.lockedFiscalYears);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [vacDate, setVacDate] = useState(yearEnd());
  const [vacMessage, setVacMessage] = useState('');
  const vac = useVacation({ employees, payrollRuns, verifications, date: vacDate });

  const saveAccruals = (next) => setCompanyInfo(prev => ({ ...prev, accruals: next }));
  const due = useMemo(() => dueReversals(accruals, verifications, todayIso()), [accruals, verifications]);
  const kind = form ? accrualKind(form.kind) : null;
  const accountName = (code) => accounts.find(a => a.code === code)?.name || '';

  const rows = useMemo(() => accruals
    .map(a => ({ ...a, status: accrualStatus(a, verifications) }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date))), [accruals, verifications]);
  // "Aktiv" = bokförd men inte återförd än, alltså det som ligger på balanskontona nu.
  const isActive = (r) => !r.status.reversed;
  const shown = rows.filter(r => filter === 'all' || (filter === 'active' ? isActive(r) : r.status.reversed));
  // Översikten (2026-11-22): vad som ligger på balanskontona nu, när nästa
  // återföring sker och om semesterlöneskulden stämmer.
  const activeRows = rows.filter(r => r.status.booked && !r.status.reversed);
  const activeSum = activeRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
  const nextReversal = activeRows.map(r => r.reversalDate || reversalDateFor(r.date)).sort()[0] || null;
  const bookVacation = async () => {
    if (!vac?.verification) return;
    if (lockedFor(vacDate)) return setVacMessage(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(vacDate) }));
    if (!(await confirmDialog(t('ui.bokfor_justering_av_semesterloneskulden')))) return;
    onAddVerification(vac.verification);
    setVacMessage(t('ui.justeringen_ar_bokford_2'));
  };

  const changeKind = (id) => setForm(f => ({ ...f, kind: id, counterAccount: accrualKind(id).counterDefault }));
  const closeForm = () => { setForm(null); setError(''); };

  const handleSave = (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.description.trim()) return setError(t('ui.beskriv_vad_periodiseringen_avser'));
    if (!(amount > 0)) return setError(t('ui.beloppet_maste_vara_storre_an_0'));
    if (!form.date) return setError(t('ui.ange_datum'));
    if (lockedFor(form.date)) return setError(t('ui.rakenskapsaret_ar_last', { v0: lockedFor(form.date) }));
    if (!accounts.some(a => a.code === form.counterAccount)) return setError(t('ui.kontot_finns_inte_i_kontoplanen', { counterAccount: form.counterAccount }));
    const accrual = { id: newId(), ...form, description: form.description.trim(), amount, reversalDate: reversalDateFor(form.date) };
    saveAccruals([...accruals, accrual]);
    onAddVerification(buildAccrualVerification(accrual));
    closeForm();
  };

  const bookDueReversals = async () => {
    if (!(await confirmDialog(t('ui.bokfor', { length: due.length, v1: due.length === 1 ? 'återföring' : 'återföringar' })))) return;
    due.forEach(a => {
      if (lockedFor(a.reversalDate || reversalDateFor(a.date))) return;
      onAddVerification(buildReversalVerification(a));
    });
  };

  const remove = async (a) => {
    if (a.status.booked) return;
    if (!(await confirmDialog(t('ui.ta_bort_2', { description: a.description })))) return;
    saveAccruals(accruals.filter(x => x.id !== a.id));
  };

  const statusPill = (r) => {
    if (r.status.reversed) return <span className="agi-pill ok">{t('accr.pillReversed')}</span>;
    if (r.status.booked) return <span className="agi-pill mute">{t('accr.pillActive')}</span>;
    return <span className="agi-pill warn">{t('ui.ej_bokford')}</span>;
  };

  const count = (id) => rows.filter(r => (id === 'all' ? true : id === 'active' ? isActive(r) : r.status.reversed)).length;

  return (
    <div className="ws-page ws-edge">
      <Panel
        title={t('ui.periodiseringar')}
        sub={t('accr.subV2')}
        actions={rows.length > 0 && <button type="button" className="agi-btn primary" onClick={() => { setForm(emptyForm()); setError(''); }}><Plus size={14} /> {t('ui.ny_periodisering')}</button>}
      >
        {(rows.length > 0 || vac) && (
          <Overview items={[
            { key: 'active', label: t('accr.ovActive'), value: fmtKr(activeSum), sub: activeRows.length === 1 ? t('accr.ovActiveOne') : t('accr.ovActiveMany', { n: activeRows.length }) },
            { key: 'next', label: t('accr.ovNext'), value: nextReversal ? fmtDay(nextReversal) : '—', sub: nextReversal ? t('accr.ovNextSub') : t('accr.ovNextNone') },
            vac && { key: 'vac', label: t('accr.ovVac'), value: fmtKr(vac.total), sub: vac.needs ? t('accr.ovVacNeeds', { kr: fmtKr(vac.diff) }) : t('accr.ovVacOk'), tone: vac.needs ? 'warn' : 'ok' },
          ]} />
        )}

        {due.length > 0 && (
          <div className="ws-tasks">
            <TaskRow
              icon={RotateCcw}
              title={due.length === 1 ? t('accr.reversalOne') : t('accr.reversalMany', { n: due.length })}
              detail={t('accr.reversalDetailV2')}
            >
              <button type="button" className="agi-btn primary" onClick={bookDueReversals}>{t('accr.reversalBook')}</button>
            </TaskRow>
          </div>
        )}

        {/* Semesterlöneskulden som en rad bara när något ska bokföras. */}
        {vac?.needs && (
          <div className="ws-tasks">
            <TaskRow icon={AlertTriangle} title={t('accr.vacTaskTitle')} detail={t('accr.vacTaskDetail', { kr: fmtKr(vac.diff) })}>
              <input type="date" value={vacDate} aria-label={t('ui.per_datum')} onChange={e => e.target.value && setVacDate(e.target.value)} />
              <button type="button" className="agi-btn primary" onClick={bookVacation}>{t('ui.bokfor_justering')}</button>
            </TaskRow>
          </div>
        )}
        {vacMessage && <p className="ws-hint" style={{ marginTop: 8, color: lockedFor(vacDate) ? 'var(--status-red-text)' : 'var(--status-green-text)' }}>{vacMessage}</p>}

        {rows.length === 0 ? (
          <div className="ws-empty">
            <strong>{t('accr.emptyTitle')}</strong>
            <p>{t('accr.emptyText')}</p>
            <button type="button" className="agi-btn primary" onClick={() => { setForm(emptyForm()); setError(''); }}><Plus size={14} /> {t('ui.ny_periodisering')}</button>
          </div>
        ) : (
          <>
          <ListBar title={t('accr.listTitle')}>
            {count('reversed') > 0 && <div className="ws-seg">
              {[['all', t('accr.filterAll')], ['active', t('accr.filterActive')], ['reversed', t('accr.filterReversed')]].map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{label}<span className="lg-count">{count(id)}</span></button>
              ))}
            </div>}
          </ListBar>
          <div className="wsp-flush">
            <ListTable
              bordered={false}
              rowKey={a => a.id}
              rows={shown}
              emptyMessage={t('accr.emptyFilter')}
              mobileList={a => ({
                dot: kindColor(a.kind, palette),
                primary: a.description,
                amount: fmtKr(a.amount),
                meta: `${accrualKind(a.kind)?.label || ''} · ${fmtDay(a.date)}`,
                pill: statusPill(a),
              })}
              columns={[
                {
                  key: 'description', label: t('ui.avser'), render: a => (
                    <div className="ws-name">
                      <span className="ws-dot" style={{ background: kindColor(a.kind, palette) }} />
                      <div className="ws-name-text">
                        <strong>{a.description}</strong>
                        <small>{accrualKind(a.kind)?.label} · {a.counterAccount} {accountName(a.counterAccount)}</small>
                      </div>
                    </div>
                  ),
                },
                { key: 'date', label: t('accr.colDate'), render: a => fmtDay(a.date) },
                { key: 'reversal', label: t('accr.colReversal'), render: a => fmtDay(a.reversalDate || reversalDateFor(a.date)) },
                { key: 'amount', label: t('ui.belopp'), align: 'right', fontWeight: 700, render: a => fmtKr(a.amount) },
                { key: 'status', label: '', align: 'right', render: a => statusPill(a) },
                {
                  key: 'actions', label: '', align: 'right', width: 44,
                  render: a => !a.status.booked && (
                    <button type="button" className="ws-icon-btn" title={t('ui.ta_bort')} aria-label={t('ui.ta_bort')} onClick={() => remove(a)}><Trash2 size={15} /></button>
                  ),
                },
              ]}
            />
          </div>
          </>
        )}
      </Panel>

      {form && (
        <div className="modal-overlay" onClick={closeForm}>
          <form className="modal-content" style={{ maxWidth: '640px' }} onClick={ev => ev.stopPropagation()} onSubmit={handleSave}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{t('ui.ny_periodisering')}</h2>
                <p className="wsp-sub">{t('accr.formSub')}</p>
              </div>
              <button type="button" className="modal-close" onClick={closeForm} aria-label={t('ui.stang')}><X size={18} /></button>
            </div>
            <div className="ws-form">
              <div className="ws-choice">
                {ACCRUAL_KINDS.map(k => (
                  <button key={k.id} type="button" className={form.kind === k.id ? 'on' : ''} onClick={() => changeKind(k.id)}>
                    <strong><i className="accr-kind-dot" style={{ background: kindColor(k.id, palette) }} aria-hidden="true" />{k.label}</strong>
                    <span>{k.help}</span>
                  </button>
                ))}
              </div>
              <div>
                <label className="ws-label" htmlFor="accr-desc">{t('ui.avser_2')}</label>
                <input id="accr-desc" className="ws-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('ui.t_ex_hyra_januari_nasta_ar')} autoFocus />
              </div>
              <div className="ws-grid2">
                <div>
                  <label className="ws-label" htmlFor="accr-amount">{t('ui.belopp')}</label>
                  <div className="ws-input-suffix">
                    <input id="accr-amount" type="number" step="0.01" min="0" className="ws-input" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                    <span>kr</span>
                  </div>
                </div>
                <div>
                  <label className="ws-label" htmlFor="accr-date">{t('ui.datum_bokslutsdag')}</label>
                  <input id="accr-date" type="date" className="ws-input" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="ws-label">{kind.counterLabel}</label>
                <AccountSearch value={form.counterAccount} onChange={c => setForm(f => ({ ...f, counterAccount: c }))} accounts={accounts} placeholder={t('ui.sok_konto')} />
              </div>
              <div className="accr-preview">
                <div className="accr-preview-step">
                  <span className="accr-preview-date">{fmtDay(form.date || yearEnd())}</span>
                  <span>{t('accr.previewBook', { kr: Number(form.amount) > 0 ? fmtKr(form.amount) : t('accr.theAmount'), balance: `${kind.balanceAccount} ${accountName(kind.balanceAccount)}`.trim(), counter: `${form.counterAccount} ${accountName(form.counterAccount)}`.trim() })}</span>
                </div>
                <div className="accr-preview-step">
                  <span className="accr-preview-date">{fmtDay(reversalDateFor(form.date || yearEnd()))}</span>
                  <span>{t('accr.previewReverse')}</span>
                </div>
              </div>
              {error && <p className="ws-hint" style={{ color: 'var(--status-red-text)' }}>{error}</p>}
              <div className="ws-card-actions" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="agi-btn" onClick={closeForm}>{t('ui.avbryt')}</button>
                <button type="submit" className="agi-btn primary">{t('ui.bokfor_periodisering')}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
