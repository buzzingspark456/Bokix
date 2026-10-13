import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, CheckCircle2, Trash2, Plus, ExternalLink } from './icons';
import AgiReportDetails, { SKV_AGI_URL } from './AgiReportDetails';
import { computeEmployeePayroll, summarizePayrollRun } from '../utils/payrollCalculation';
import { agiDueDate, daysFromToday } from '../utils/declarationDeadlines';
import { confirmDialog } from './shared/ConfirmDialog';
import { t, dateLocale } from '../i18n';
import { numberFormat, dateTimeFormat } from '../utils/intlCache';

const fmt = (v) => numberFormat('sv-SE').format(Math.round(v || 0));
const pad = (n) => String(n).padStart(2, '0');

// Arbetsgivardeklarationen som ett år: en rad per månad med lön, skatt,
// avgift, vad som ska betalas och sista dag, som Lönekörningar-fliken.
// Överst det som ska göras härnäst. En rad öppnar månadens detaljer
// (huvuduppgift, individuppgifter, fil och PDF).
//
// Bokix räknar en månad som saknad från den första lönekörningen eller
// AGI:n som gjorts här. Månader före det kan ha lämnats någon annanstans.
export default function AgiYearView({ agiReports = [], payrollRuns = [], company, onCreateAgiReport, onMarkAgiSubmitted, onDeleteAgiReport }) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisPeriod = `${thisYear}-${pad(now.getMonth() + 1)}`;
  const [openPeriod, setOpenPeriod] = useState(null);
  const [year, setYear] = useState(thisYear);

  const firstPeriod = useMemo(() => {
    const all = [...payrollRuns.map(r => r.period), ...agiReports.map(r => r.period)].filter(Boolean).sort();
    return all[0] || null;
  }, [payrollRuns, agiReports]);

  const runFor = (period) => {
    const runs = payrollRuns.filter(r => r.period === period);
    return runs.find(r => r.completedSteps?.includes('booked')) || runs[0] || null;
  };

  const rowFor = (period) => {
    const report = agiReports.find(r => r.period === period) || null;
    const run = runFor(period);
    let totals = report?.totals || null;
    if (!totals && run) {
      try { totals = summarizePayrollRun(run.rows.map(row => computeEmployeePayroll(row.employeeSnapshot || {}, row))); } catch { totals = null; }
    }
    const ended = period < thisPeriod;
    let state = 'none';
    if (report?.status === 'submitted') state = 'submitted';
    else if (report) state = 'draft';
    else if (run) state = 'todo';
    else if (ended && firstPeriod && period >= firstPeriod) state = 'missing';
    const due = agiDueDate(period);
    const daysLeft = daysFromToday(due);
    return { period, report, run, totals, state, due, daysLeft, late: ['draft', 'todo', 'missing'].includes(state) && daysLeft < 0 };
  };

  const years = useMemo(() => {
    const ys = new Set([thisYear]);
    [...payrollRuns, ...agiReports].forEach(r => { const y = Number(String(r.period).slice(0, 4)); if (y) ys.add(y); });
    return [...ys].sort((a, b) => b - a);
  }, [payrollRuns, agiReports, thisYear]);
  const shownYear = years.includes(year) ? year : thisYear;

  // Månaderna som visas: avslutade månader (och innevarande om den har
  // lön) i valt år, från den första lönen här. Tidigare år visar hela året.
  const rows = useMemo(() => {
    const list = [];
    for (let m = 12; m >= 1; m--) {
      const period = `${shownYear}-${pad(m)}`;
      const hasData = payrollRuns.some(r => r.period === period) || agiReports.some(r => r.period === period);
      if (!hasData && period >= thisPeriod) continue;
      if (!hasData && (!firstPeriod || period < firstPeriod)) continue;
      list.push(rowFor(period));
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shownYear, payrollRuns, agiReports, firstPeriod, thisPeriod]);

  // Nästa sak att göra, över alla år: den äldsta månaden som inte är inlämnad.
  const allActionable = useMemo(() => {
    if (!firstPeriod) return [];
    const out = [];
    const [fy, fm] = firstPeriod.split('-').map(Number);
    for (let d = new Date(fy, fm - 1, 1); ; d.setMonth(d.getMonth() + 1)) {
      const period = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      if (period > thisPeriod) break;
      const r = rowFor(period);
      if (['draft', 'todo', 'missing'].includes(r.state)) out.push(r);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payrollRuns, agiReports, firstPeriod, thisPeriod]);
  const next = allActionable[0] || null;
  const missingZero = allActionable.filter(r => r.state === 'missing');

  const monthName = (period, withYear = false) => {
    const s = dateTimeFormat(dateLocale(), withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }).format(new Date(`${period}-01T12:00:00`));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const fmtDue = (d) => dateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' }).format(d);
  const daysText = (n) => (n < 0 ? t('ui.forsenad') : n === 0 ? t('ui.idag_2') : n === 1 ? t('ui.imorgon') : t('ui.om_dagar', { daysLeft: n }));

  const create = (period) => {
    const id = onCreateAgiReport?.(period);
    setOpenPeriod(period);
    return id;
  };
  const openRow = (r) => {
    if (r.state === 'none') return;
    if (!r.report) { create(r.period); return; }
    setOpenPeriod(p => (p === r.period ? null : r.period));
  };

  const STATUS = {
    submitted: { label: t('agiYear.submitted'), cls: 'ok' },
    draft: { label: t('agiYear.draft'), cls: 'warn' },
    todo: { label: t('agiYear.todo'), cls: 'warn' },
    missing: { label: t('agiYear.missing'), cls: 'warn' },
    none: { label: t('agiYear.noPay'), cls: 'mute' },
  };

  return (
    <div className="agi-year">
      {/* Härnäst */}
      <section className={`agi-next${next ? (next.late ? ' late' : '') : ' done'}`}>
        {next ? (
          <>
            <div className="agi-next-main">
              <div className="agi-next-label">{t('agiYear.next')}</div>
              <div className="agi-next-title">{t('agiYear.nextTitle', { month: monthName(next.period, true) })}</div>
              <div className="agi-next-sub">
                {t('agiYear.dueOn', { date: fmtDue(next.due) })} · <strong>{daysText(next.daysLeft)}</strong>
                {next.totals && next.state !== 'missing' ? <> · {t('agiYear.toPay', { amount: fmt((next.totals.tax || 0) + (next.totals.employerFee || 0)) })}</> : null}
              </div>
            </div>
            <div className="agi-next-actions">
              <button type="button" className="agi-btn primary" onClick={() => openRow(next)}>
                {next.report ? t('agiYear.open') : next.state === 'missing' ? t('agiYear.createZero') : t('agiYear.create')} <ChevronRight size={16} />
              </button>
              <a className="agi-btn" href={SKV_AGI_URL} target="_blank" rel="noopener noreferrer">{t('agiDetails.submitAt')} <ExternalLink size={13} /></a>
            </div>
          </>
        ) : (
          <div className="agi-next-main">
            <div className="agi-next-title"><CheckCircle2 size={18} /> {firstPeriod ? t('agiYear.allDone') : t('agiYear.nothingYet')}</div>
            <div className="agi-next-sub">{firstPeriod ? t('agiYear.allDoneSub') : t('agiYear.nothingYetSub')}</div>
          </div>
        )}
      </section>

      {missingZero.length > 1 && (
        <div className="agi-zero-note">
          <span>{t('agiYear.zeroNote', { n: missingZero.length })}</span>
          <button type="button" className="agi-btn" onClick={() => missingZero.forEach(r => onCreateAgiReport?.(r.period))}>
            <Plus size={14} /> {t('agiYear.createAllZero', { n: missingZero.length })}
          </button>
        </div>
      )}

      {years.length > 1 && (
        <div className="filter-pills agi-years" role="tablist" aria-label={t('payrollYear.year')}>
          {years.map(y => (
            <button key={y} type="button" role="tab" aria-selected={y === shownYear} className={`filter-pill${y === shownYear ? ' active' : ''}`} onClick={() => setYear(y)}>{y}</button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="agi-empty">{t('agiYear.empty')}</div>
      ) : (
        <div className="agi-table" role="table">
          <div className="agi-tr agi-th" role="row">
            <span role="columnheader">{t('payrollYear.month')}</span>
            <span role="columnheader" className="num">{t('payrollYear.gross')}</span>
            <span role="columnheader" className="num col-hide">{t('agiYear.tax')}</span>
            <span role="columnheader" className="num col-hide">{t('agiYear.fee')}</span>
            <span role="columnheader" className="num">{t('agiYear.pay')}</span>
            <span role="columnheader" className="col-hide">{t('agiYear.due')}</span>
            <span role="columnheader">{t('payrollYear.status')}</span>
            <span aria-hidden="true" />
          </div>
          {rows.map(r => {
            const open = openPeriod === r.period && r.report;
            const st = STATUS[r.state];
            const toPay = r.totals ? (r.totals.tax || 0) + (r.totals.employerFee || 0) : null;
            return (
              <div key={r.period} className={`agi-row${open ? ' open' : ''}`}>
                <div className={`agi-tr${r.state === 'none' ? ' quiet' : ''}`} role="row" tabIndex={r.state === 'none' ? -1 : 0}
                  onClick={() => openRow(r)} onKeyDown={e => { if (e.key === 'Enter') openRow(r); }}>
                  <span className="agi-month">{monthName(r.period)}{r.report?.isZero && <small className="agi-zero-tag">{t('ui.nolldeklaration')}</small>}</span>
                  <span className="num">{r.totals ? `${fmt(r.totals.gross)} kr` : '–'}</span>
                  <span className="num col-hide">{r.totals ? `${fmt(r.totals.tax)} kr` : '–'}</span>
                  <span className="num col-hide">{r.totals ? `${fmt(r.totals.employerFee)} kr` : '–'}</span>
                  <span className="num strong">{toPay != null ? `${fmt(toPay)} kr` : '–'}</span>
                  <span className={`col-hide${r.late ? ' late' : ''}`}>{r.state === 'none' ? '–' : fmtDue(r.due)}</span>
                  <span><span className={`agi-pill ${r.late ? 'late' : st.cls}`}>{r.late ? t('ui.forsenad') : st.label}</span></span>
                  <span className="agi-chev" aria-hidden="true">{r.state === 'none' ? null : open ? <ChevronDown size={16} /> : r.report ? <ChevronRight size={16} /> : <Plus size={15} />}</span>
                </div>
                {open && (
                  <div className="agi-detail">
                    <div className="agi-detail-actions">
                      {r.report.status !== 'submitted' ? (
                        <button type="button" className="agi-btn primary" onClick={() => onMarkAgiSubmitted?.(r.report.id)}>
                          <CheckCircle2 size={15} /> {t('agiYear.markSubmitted')}
                        </button>
                      ) : (
                        <span className="agi-submitted-at">
                          <CheckCircle2 size={15} /> {r.report.submittedAt ? t('agiYear.submittedOn', { date: new Date(r.report.submittedAt).toLocaleDateString('sv-SE') }) : t('agiYear.submitted')}
                        </span>
                      )}
                      {onDeleteAgiReport && (
                        <button type="button" className="agi-btn danger" onClick={async () => {
                          if (await confirmDialog(t('ui.ta_bort_agi_rapporten_for', { v0: monthName(r.period, true) }), { danger: true })) { onDeleteAgiReport(r.report.id); setOpenPeriod(null); }
                        }}>
                          <Trash2 size={14} /> {t('ui.ta_bort')}
                        </button>
                      )}
                    </div>
                    <AgiReportDetails report={r.report} run={r.run} company={company} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
