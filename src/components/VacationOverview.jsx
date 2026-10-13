import React, { useMemo, useState } from 'react';
import { Info, AlertTriangle, Palmtree, ChevronDown, ChevronUp, ChevronRight } from './icons';
import { BRAND } from '../utils/brandColors';
import { summarizeVacationLiability, VACATION_MODEL_NOTES, VACATION_DAYS_BEFORE_SAVING } from '../utils/vacation';
import { EMPLOYER_FEE_CATEGORIES } from '../utils/payrollConfig';
import { t } from '../i18n';
import { numberFormat } from '../utils/intlCache';

// Semesteröversikten (Anställda och lön → Semester): hur många dagar varje
// anställd har kvar och vad de kostar. Allt är härlett, inget är en sparad
// siffra som kan bli inaktuell: intjänandet ur anställningsdatum och
// semesterår, uttaget ur lönekörningarnas Semesteruttag, dagvärdet ur
// semesterregeln (utils/vacation.js).
//
// 2026-10-10: samma stil som lönekörningen, en yta kant i kant i stället för
// kort, en stapel per anställd (intjänat mot uttaget), en rad som går att
// öppna med uttagen per lönekörning, och en påminnelse före semesterårets
// slut om dagar som kan sparas. Semester TAS UT i lönekörningen (där lönen
// betalas), därför leder raden dit.

const fmt = (v) => numberFormat('sv-SE').format(Math.round(v || 0));

// Vad regeln betyder, inte vilken anställningsform den brukar höra till (en
// månadsavlönad kan ha procentregeln, då stod det fel 'Timlön' förut).
const RULE_LABEL = {
  sammaloneregeln: { primary: t('vacationUi.ruleSamma'), formal: 'Sammalöneregeln' },
  procentregeln: { primary: t('vacationUi.ruleProcent'), formal: 'Procentregeln' },
};

/** '1 dag', '5 dagar'. */
const daysText = (n) => `${fmt(n)} ${Math.round(n) === 1 ? t('vacationUi.day') : t('vacationUi.days')}`;

/** Uttagna semesterdagar per lönekörning för en anställd, nyast först. */
function takenByRun(employeeId, payrollRuns) {
  return payrollRuns
    .filter(run => run.completedSteps?.includes('calculated'))
    .map(run => ({
      period: run.period,
      days: (run.rows || [])
        .filter(r => r.employeeId === employeeId)
        .flatMap(r => r.lines || [])
        .filter(l => l.payTypeId === 'vacation_taken')
        .reduce((s, l) => s + (Number(l.quantity) || 0), 0),
    }))
    .filter(x => x.days > 0)
    .sort((a, b) => b.period.localeCompare(a.period));
}

export default function VacationOverview({ employees = [], payrollRuns = [], onSelectEmployee, onOpenRuns }) {
  const feeRate = EMPLOYER_FEE_CATEGORIES.anstalld.rate;
  const summary = useMemo(
    () => summarizeVacationLiability({ employees, payrollRuns, feeRate }),
    [employees, payrollRuns, feeRate]
  );
  const [openId, setOpenId] = useState(null);
  const [showRules, setShowRules] = useState(false);

  if (!employees.length) {
    return (
      <div style={{ flex: 1, minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '48px 24px', background: 'var(--bg-card)' }}>
        <div style={{ width: 72, height: 72, borderRadius: '20px', background: 'var(--bg-muted)', color: BRAND.green, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
          <Palmtree size={30} />
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>{t('ui.inga_anstallda_att_rakna_semester_for')}</div>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '340px', margin: 0 }}>
          {t('ui.lagg_till_en_anstalld_sa_raknas_intjanade_och_ut')}
        </p>
      </div>
    );
  }

  const end = summary.vacationYear.end;
  const daysToYearEnd = Math.ceil((end - new Date()) / 86400000);
  const savable = summary.rows.reduce((s, r) => s + r.savableAtYearEnd, 0);
  const cost = summary.totalLiability + summary.totalLiabilityFee;
  const cells = [
    { label: t('vacationUi.daysLeft'), value: daysText(summary.totalDays), hint: t('vacationUi.daysLeftHint') },
    cost === 0 && summary.totalDays > 0
      ? { label: t('vacationUi.cost'), value: '—', hint: t('vacationUi.costUnknown') }
      : { label: t('vacationUi.cost'), value: `${fmt(cost)} ${t('ui.kr')}`, hint: t('vacationUi.costHint', { pay: fmt(summary.totalLiability), fee: fmt(summary.totalLiabilityFee) }) },
    { label: t('vacationUi.savable'), value: daysText(savable), hint: t('vacationUi.savableHint', { n: VACATION_DAYS_BEFORE_SAVING }) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', flex: 1 }}>
      {/* Rubrik, förklaring och summorna i samma yta. */}
      <div style={{ padding: '18px 24px' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>
          {t('ui.semesteraret')} {summary.vacationYear.label}
        </h2>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '760px' }}>{t('vacationUi.intro')}</p>

        {daysToYearEnd <= 75 && daysToYearEnd > 0 && savable > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '14px', padding: '10px 14px', borderRadius: '10px', background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', fontSize: '13px', lineHeight: 1.5 }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>{t('vacationUi.yearEndSoon', { date: end.toLocaleDateString('sv-SE'), days: daysToYearEnd, savable: fmt(savable) })}</span>
          </div>
        )}

        <div className="payroll-summary" style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {cells.map((c, i) => (
            <div key={c.label} style={{ padding: '16px 18px', borderRight: i < cells.length - 1 ? '1px solid var(--border-light)' : 'none', background: i === 1 ? 'var(--bg-muted)' : 'transparent', minWidth: 0 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{c.label}</div>
              <div style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{c.value}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.45 }}>{c.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {/* En rad per anställd, kant i kant. */}
      <div style={{ borderTop: '1px solid var(--border-light)' }}>
        {summary.rows.map(r => {
          const name = `${r.employee.firstName} ${r.employee.lastName}`;
          const open = openId === r.employee.id;
          const total = Math.max(r.earned + r.saved, 1);
          const takenPct = Math.min(100, (r.taken / total) * 100);
          const rule = RULE_LABEL[r.rule];
          const history = open ? takenByRun(r.employee.id, payrollRuns) : [];
          return (
            <div key={r.employee.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setOpenId(open ? null : r.employee.id)}
                className="vacation-row"
                style={{ width: '100%', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 2fr) auto auto', gap: '18px', alignItems: 'center', padding: '14px 24px', background: open ? 'var(--bg-muted)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>{rule ? rule.primary : ''}</span>
                </span>
                {/* Stapeln: intjänat (hela) och uttaget (fyllt). */}
                <span className="vacation-bar" style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', height: '8px', borderRadius: '999px', background: 'var(--border-light)', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${takenPct}%`, background: r.overEntitlement ? 'var(--status-amber-text)' : 'var(--accent)', borderRadius: '999px' }} />
                  </span>
                  <span style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '5px' }}>
                    {t('vacationUi.barText', { taken: fmt(r.taken), earned: fmt(r.earned) })}{r.saved ? ` · ${t('vacationUi.savedText', { n: fmt(r.saved) })}` : ''}
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>
                    {r.overEntitlement && <AlertTriangle size={14} color="var(--status-amber-text)" aria-label={t('ui.fler_uttagna_dagar_an_intjanade')} />}
                    {fmt(r.totalAvailable)}
                  </span>
                  <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)' }}>{t('vacationUi.daysLeftShort')}</span>
                </span>
                {open ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
              </button>

              {open && (
                <div style={{ padding: '4px 24px 18px', background: 'var(--bg-muted)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px', marginBottom: '14px' }}>
                    {[
                      [t('ui.intjanat'), daysText(r.earned)],
                      [t('ui.uttaget'), daysText(r.taken)],
                      [t('ui.sparade'), r.saved ? daysText(r.saved) : '—'],
                      [t('ui.per_dag'), r.payPerDay ? `${fmt(r.payPerDay)} ${t('ui.kr')}` : '—'],
                      [t('ui.total_kostnad'), r.liabilityTotal ? `${fmt(r.liabilityTotal)} ${t('ui.kr')}` : '—'],
                    ].map(([label, value]) => (
                      <div key={label} style={{ padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-card)', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{label}</div>
                        <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {!r.payPerDay && r.totalAvailable > 0 && (
                    <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>{t('vacationUi.noBasis')}</div>
                  )}
                  {r.rule === 'procentregeln' && r.employee.salaryForm !== 'timlon' && (
                    <div style={{ fontSize: '12.5px', color: 'var(--status-amber-text)', marginBottom: '12px', lineHeight: 1.5 }}>{t('vacationUi.monthlyOnProcent')}</div>
                  )}
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>{t('vacationUi.historyTitle')}</div>
                  {history.length === 0 ? (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>{t('vacationUi.historyEmpty')}</div>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0 }}>
                      {history.map(h => (
                        <li key={h.period} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-light)', fontSize: '13px', color: 'var(--text-main)' }}>
                          <span>{t('ui.lonekorning', { period: h.period })}</span>
                          <span style={{ fontWeight: 700 }}>{daysText(h.days)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {onOpenRuns && (
                      <button type="button" onClick={onOpenRuns} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 16px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t('vacationUi.addInRun')} <ChevronRight size={14} />
                      </button>
                    )}
                    {onSelectEmployee && (
                      <button type="button" onClick={() => onSelectEmployee(r.employee)} style={{ padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t('vacationUi.openEmployee')}
                      </button>
                    )}
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{rule ? rule.formal : ''}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hur det räknas, bara om man frågar. */}
      <div style={{ borderBottom: '1px solid var(--border-light)' }}>
        <button
          type="button"
          onClick={() => setShowRules(s => !s)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 24px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={15} color="var(--text-secondary)" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.hur_raknas_det')}</span>
          </span>
          {showRules ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>
        {showRules && (
          <div style={{ padding: '0 24px 18px' }}>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('ui.semesteraret_loper_1_april')} {summary.vacationYear.start.getFullYear()} {t('ui.n31_mars')} {summary.vacationYear.end.getFullYear()}{t('ui.dagarna_tjanades_in_under_de_tolv_manaderna_dess')}
              </li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('ui.intjanade_dagar_anstallningstid_under_intjanande')}</li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('ui.dagvarde_sammaloneregeln_manadslon_ger_semestert')}</li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{t('vacationUi.howTake')}</li>
              {VACATION_MODEL_NOTES.map(note => (
                <li key={note} style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
