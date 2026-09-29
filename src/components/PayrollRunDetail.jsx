import React, { useState, useMemo, useEffect } from 'react';
import {
  Check, ChevronDown, ChevronUp, AlertTriangle, Download, ChevronLeft, Loader2, ExternalLink, RefreshCw, Landmark, CreditCard, Trash2,
  Wallet, Receipt, Banknote, ShieldCheck,
} from './icons';
import CalculationRow from './shared/CalculationRow';
import ListPageHeader from './shared/ListPageHeader';
import { BRAND } from '../utils/brandColors';
import { computeEmployeePayroll, summarizePayrollRun, FEE_RULES_VERSION } from '../utils/payrollCalculation';
import { PAY_TYPE_GROUPS, PAY_LINE_KINDS, getPayType, defaultRateFor } from '../utils/payTypes';
import { PAYROLL_RUN_STEPS, PAYROLL_ACCOUNTS } from '../utils/payrollConfig';
import { generatePayslipPdf } from '../utils/payslipExport';
import { describeRow } from '../utils/plainBooking';
import { downloadAgiPdf } from '../utils/agiExport';
import { downloadAgiXml } from '../utils/agiXml';
import { AGI_XML_ENABLED } from '../utils/featureFlags';
import { preloadSkattetabell } from '../utils/skattetabell';
import { downloadSalaryPaymentFile, getDebtorAccountError } from '../utils/salaryPaymentFile';
import { t as tr } from '../i18n';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(Math.round(v || 0));
const fmtSigned = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('sv-SE').format(Math.round(Math.abs(v || 0)))} kr`;
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };

function StatusBadge({ status }) {
  const map = {
    booked: { label: tr('ui.bokford'), bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' },
    calculated: { label: tr('ui.beraknad_2'), bg: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' },
    draft: { label: tr('ui.utkast'), bg: 'var(--border-light)', color: 'var(--text-secondary)' },
  };
  const s = map[status] || map.draft;
  return <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

// Kundönskemål ("mycket bättre UI"): en rad likadana piller gav ingen känsla
// av att det här ÄR en sekvens — bara sex knappar i samma form, färgen fick
// bära hela beskedet om ordning. Numrerade cirklar + en förbindelselinje
// mellan dem (samma mönster som checkout-/onboardingflöden hos i princip
// alla större SaaS-produkter) gör klart/kommande/framtida läsbart på en
// blick, oavsett färgseende. Bocken ersätter siffran när steget är klart,
// linjen till NÄSTA cirkel färgas i så fort steget FÖRE den är klart.
function StepButtons({ completedSteps, onAdvance, canBook }) {
  return (
    <div className="payroll-stepper" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '20px', paddingTop: '22px' }}>
      {PAYROLL_RUN_STEPS.map((step, i) => {
        const isDone = completedSteps.includes(step.id);
        const prevDone = i === 0 || completedSteps.includes(PAYROLL_RUN_STEPS[i - 1].id);
        const isNext = !isDone && prevDone;
        const disabled = !prevDone || isDone || (step.id === 'booked' && !canBook);
        const isLast = i === PAYROLL_RUN_STEPS.length - 1;
        return (
          <React.Fragment key={step.id}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              {/* Kundfeedback ("hur skulle jag veta att det är man skulle
                  trycka, ha en pil eller nått") — accentfärgen räckte inte
                  som ledtråd ensam. Studsande pil + "Klicka här"-etikett
                  pekar rakt ut det enda steg som faktiskt går att klicka
                  just nu. */}
              {isNext && !disabled && (
                <div
                  style={{
                    position: 'absolute', top: '-24px', left: '15px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                    animation: 'bokix-step-bounce 1s ease-in-out infinite', pointerEvents: 'none',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent-text)', whiteSpace: 'nowrap' }}>{tr('ui.klicka_har')}</span>
                  <ChevronDown size={13} color="var(--accent)" style={{ marginTop: '-2px' }} />
                </div>
              )}
              <button
                disabled={disabled}
                onClick={() => onAdvance(step.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '9px', padding: '4px 14px 4px 4px', borderRadius: '999px',
                  fontSize: '13px', fontWeight: 700, border: 'none', background: 'none',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  animation: (isNext && !disabled) ? 'bokix-step-pulse 1.8s ease-in-out infinite' : 'none',
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12.5px', fontWeight: 800,
                  background: isDone ? BRAND.green : (isNext ? 'var(--accent)' : 'var(--border-light)'),
                  color: isDone || isNext ? 'white' : 'var(--text-muted)',
                  boxShadow: isNext ? '0 0 0 4px var(--status-green-bg)' : 'none',
                  transition: 'background 0.15s, box-shadow 0.15s',
                }}>
                  {isDone ? <Check size={15} /> : i + 1}
                </span>
                <span className="step-label" style={{ color: isDone ? 'var(--text-main)' : (isNext ? 'var(--text-main)' : 'var(--text-muted)') }}>{step.label}</span>
              </button>
            </div>
            {!isLast && (
              <span aria-hidden className="step-connector" style={{ flex: '1 1 24px', minWidth: '20px', maxWidth: '56px', height: '2px', margin: '0 2px', borderRadius: '1px', background: isDone ? BRAND.green : 'var(--border-light)', transition: 'background 0.15s' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Kundönskemål ("mycket bättre UI"): fyra likadana textrutor i rad gav
// ingen ledtråd om VAD varje siffra var utan att läsa etiketten först. En
// liten ikon per kort (samma mönster som Semesteröversiktens kort) gör
// dem urskiljbara på en blick — färgen på siffran gör fortfarande jobbet
// att visa "detta är ett avdrag" (röd skatt) kontra "detta är kvar" (grön
// netto), ikonen gör bara att man känner igen KORTET snabbare, inte bara
// TALET.
function SummaryCards({ totals }) {
  const cards = [
    { label: tr('ui.brutto'), value: totals.gross, color: 'var(--text-main)', icon: Wallet },
    { label: tr('ui.skatt'), value: totals.tax, color: 'var(--status-red-text)', icon: Receipt },
    { label: tr('ui.netto'), value: totals.net, color: 'var(--status-green-text)', icon: Banknote },
    { label: tr('ui.avgifter'), value: totals.employerFee + totals.vacationFee, color: 'var(--text-main)', icon: ShieldCheck },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: '12px', marginBottom: '12px' }}>
      {cards.map(c => (
        <div key={c.label} style={{ ...panelCard, padding: '16px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div style={{ width: 34, height: 34, borderRadius: '10px', background: 'var(--bg-muted)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <c.icon size={16} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>{c.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 800, color: c.color }}>{fmt(c.value)} {tr('ui.kr')}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Lönearter på en anställds rad — övertid, OB, jour, beredskap, frånvaro,
 * förmåner, milersättning, löneutmätning.
 *
 * Beräkningsmotorn tog emot tillägg, avdrag, förmåner och nettoavdrag
 * långt innan den här editorn fanns, men det gick inte att MATA IN dem
 * någonstans: en lönekörning kunde bara bestå av grundlön. Det är den
 * här vyn som gör hela lönemodulen användbar för ett företag med
 * verklig personal — och varje rad bär sitt namn och sin formel vidare
 * till lönebeskedet, så den anställda ser vad tillägget bestod av i
 * stället för en klumpsumma.
 *
 * Antal och à-pris är alltid redigerbara, även när lönearten har ett
 * förvalt påslag: nivåerna för övertid, OB, jour och beredskap kommer ur
 * kollektiv- eller anställningsavtal, inte ur lagen, och systemet ska
 * aldrig påstå att det vet vad som gäller hos just er.
 */
function PayLinesEditor({ row, computed, onUpdateRow, locked }) {
  const employee = row.employeeSnapshot;
  const lines = row.lines || [];
  const [adding, setAdding] = useState('');

  const updateLines = (next) => onUpdateRow(row.employeeId, { lines: next });

  const addLine = (payTypeId) => {
    const type = getPayType(payTypeId);
    if (!type) return;
    const rate = defaultRateFor(type, employee);
    updateLines([...lines, {
      id: `pl_${Date.now()}`,
      payTypeId,
      quantity: type.defaultQuantity ?? 1,
      rate: rate == null ? '' : rate,
      note: '',
    }]);
    setAdding('');
  };

  const patchLine = (id, patch) => updateLines(lines.map(l => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id) => updateLines(lines.filter(l => l.id !== id));

  const cellInput = { padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12.5px', fontFamily: 'inherit', background: 'var(--bg-card)', color: 'var(--text-main)', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: lines.length ? '10px' : '6px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('ui.lonearter')}</span>
        {!locked && (
          <select
            value={adding}
            onChange={e => addLine(e.target.value)}
            style={{ ...cellInput, width: 'auto', minWidth: '190px', cursor: 'pointer' }}
            aria-label={tr('ui.lagg_till_loneart_2')}
          >
            <option value="">{tr('ui.lagg_till_loneart')}</option>
            {PAY_TYPE_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.ids.map(id => <option key={id} value={id}>{getPayType(id)?.name}</option>)}
              </optgroup>
            ))}
          </select>
        )}
      </div>

      {lines.length === 0 ? (
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
          {tr('ui.inga_lonearter_pa_den_har_raden_bara_grundlonen')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {lines.map(line => {
            const type = getPayType(line.payTypeId);
            const calc = computed.payLines?.find(c => c.payTypeId === line.payTypeId && c.quantity === (Number(line.quantity) || 0));
            if (!type) return null;
            const kind = PAY_LINE_KINDS[type.kind];
            return (
              <div key={line.id} style={{ background: 'var(--bg-muted)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '10px 12px' }}>
                <div className="payline-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) 78px 96px minmax(0,1fr) 90px 30px', gap: '8px', alignItems: 'center' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{type.name}</div>
                    <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{kind.label}</div>
                  </div>
                  <input
                    type="number" step="0.01" min="0" value={line.quantity}
                    disabled={locked}
                    onChange={e => patchLine(line.id, { quantity: e.target.value })}
                    style={{ ...cellInput, textAlign: 'right' }} aria-label={tr('ui.antal_2', { unit: type.unit })}
                  />
                  <input
                    type="number" step="0.01" value={line.rate}
                    disabled={locked}
                    placeholder={tr('ui.pris_4')}
                    onChange={e => patchLine(line.id, { rate: e.target.value })}
                    style={{ ...cellInput, textAlign: 'right' }} aria-label={tr('ui.pris_i_kronor')}
                  />
                  <input
                    type="text" value={line.note || ''}
                    disabled={locked}
                    placeholder={tr('ui.anteckning_valfri')}
                    onChange={e => patchLine(line.id, { note: e.target.value })}
                    style={cellInput}
                  />
                  <div style={{ fontSize: '13px', fontWeight: 800, textAlign: 'right', color: kind.sign < 0 ? 'var(--status-red-text)' : 'var(--text-main)', whiteSpace: 'nowrap' }}>
                    {kind.sign < 0 ? '−' : ''}{fmt(calc ? calc.amount : (Number(line.quantity) || 0) * (Number(line.rate) || 0))} {tr('ui.kr')}
                  </div>
                  {!locked ? (
                    <button
                      type="button" onClick={() => removeLine(line.id)} aria-label={tr('ui.ta_bort_3', { name: type.name })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', lineHeight: 0 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : <span />}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                  {type.unit} {tr('ui.pris_3')} {type.help}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function EmployeeRow({ row, computed, previousComputed, onUpdateRow, locked }) {
  const [expanded, setExpanded] = useState(false);
  const isZero = computed.gross === 0 && computed.net === 0 && computed.tax === 0;
  const diff = previousComputed ? computed.net - previousComputed.net : null;
  const isHourly = row.employeeSnapshot.salaryForm === 'timlon';

  return (
    <div style={{ ...panelCard, marginBottom: '10px', overflow: 'hidden', transition: 'box-shadow 0.15s' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => { e.currentTarget.parentElement.style.boxShadow = '0 4px 14px rgba(15, 23, 42, 0.08)'; }}
        onMouseLeave={e => { e.currentTarget.parentElement.style.boxShadow = panelCard.boxShadow; }}
      >
        {/* flex:1 + minWidth:0 (mobil): utan detta orsakade den langa
            "Skatt X kr · Netto Y kr..."-sammanfattningsraden nedan sidledes
            overflow istallet for att helt enkelt radbryta inom raden. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {row.employeeSnapshot.firstName} {row.employeeSnapshot.lastName}
            {diff !== null && Math.abs(diff) > 1 && (
              <span title={tr('ui.jamfort_med_foregaende_lonekorning', { v0: fmtSigned(diff) })} style={{ fontSize: '12px', fontWeight: 700, color: diff < 0 ? 'var(--status-red-text)' : 'var(--status-green-text)', cursor: 'help' }}>
                {fmtSigned(diff)}
              </span>
            )}
          </div>
          {isZero ? (
            <div style={{ fontSize: '12.5px', color: 'var(--status-amber-text)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* Bugfix (kundrapport): visade "Inga tidrapporter" oavsett
                  löneform — meningslöst för en månadsanställd (ingen
                  timme-koncept alls för dem), vars faktiska problem är en
                  0 kr månadslön på anställningsposten, inte saknade
                  tidrapporter. Se payrollCalculation.js: Grundlön-formeln
                  för en månadsanställd är "monthlySalary × employmentRate%",
                  helt skild från timanställdas "hourlyRate × hoursWorked". */}
              <span>{isHourly ? tr('ui.inga_tidrapporter_registrerade_for_denna_period') : tr('ui.ingen_manadslon_angiven_kontrollera_lon_anstalln')}</span>
              {isHourly && !locked && (
                <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number" min="0" placeholder={tr('ui.timmar')} value={row.hoursWorked || ''}
                    onChange={e => onUpdateRow(row.employeeId, { hoursWorked: e.target.value })}
                    style={{ width: '70px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tr('ui.timmar_denna_period')}</span>
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{tr('ui.skatt')} {fmt(computed.tax)} {tr('ui.kr_netto')} {fmt(computed.net)} {tr('ui.kr_avgifter')} {fmt(computed.employerFee)} {tr('ui.kr_semester')} {fmt(computed.vacationProvision)} {tr('ui.kr')}</span>
              {isHourly && !locked && (
                <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number" min="0" value={row.hoursWorked || ''}
                    onChange={e => onUpdateRow(row.employeeId, { hoursWorked: e.target.value })}
                    style={{ width: '60px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{tr('ui.tim')}</span>
                </span>
              )}
            </div>
          )}
          {!computed.hasBankInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--status-red-text)', marginTop: '4px' }}>
              <AlertTriangle size={12} /> {tr('ui.saknar_bankkontouppgifter_kan_inte_inkluderas_i')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-main)' }}>{fmt(computed.gross)} {tr('ui.kr')}</div>
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '4px 18px 16px', borderTop: '1px solid var(--border-light)' }}>
          {computed.steps.map((s, i) => <CalculationRow key={i} {...s} />)}
          <PayLinesEditor row={row} computed={computed} onUpdateRow={onUpdateRow} locked={locked} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); generatePayslipPdf({ employee: row.employeeSnapshot, computed, period: row.period }).save(`lonebesked-${row.employeeSnapshot.lastName}-${row.period}.pdf`); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <Download size={13} /> {tr('ui.ladda_ner_lonebesked_pdf')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VerificationBlock({ title, rows, accounts }) {
  // Lönebokföringen visas på vanlig svenska (pengar ut, kostnad, skuld ökar)
  // i stället för debet- och kreditkolumner — se utils/plainBooking.js.
  const lines = rows
    .map(r => ({ ...describeRow(r, accounts), account: r.account, description: r.description }))
    .filter(l => l.amount > 0);
  const total = rows.reduce((s, r) => s + (r.debet || 0), 0);
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)' }}>
              {[tr('ui.vad_som_bokfors'), tr('ui.belopp')].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Belopp' ? 'right' : 'left', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>{l.account}</span>{l.text}
                  {l.description && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{l.description}</div>}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(l.amount)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}>
              <td style={{ padding: '9px 14px' }}>{tr('ui.summa')}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PayrollRunDetail({ run, previousRun, accounts, company, onBack, onAdvanceStep, onBookRun, onMarkPaid, onUpdateRow, onRefreshSnapshots }) {
  const [agiConfirmed, setAgiConfirmed] = useState(run.completedSteps.includes('agi'));
  const [agiFileProblems, setAgiFileProblems] = useState(null); // { errors, warnings } från senaste filförsöket
  const [showBankGuide, setShowBankGuide] = useState(false);
  // Kundfeedback ("man ska kunna göra manuellt om man vill"): Betala-steget
  // gick tidigare BARA att slutföra via en pil-knapp i sidhuvudet som blint
  // antog 'bank' — ingen riktig knapp fanns i Betalningsmetod-panelen alls,
  // och inget alternativ för den som betalat på annat sätt (Swish, kontant,
  // en separat överföring). showManualPay slår bara på/av den mindre synliga
  // "annat sätt"-sektionen, döljs by default så Bank förblir förstahandsvalet.
  const [showManualPay, setShowManualPay] = useState(false);
  const [tablesReady, setTablesReady] = useState(false);
  const [tablesError, setTablesError] = useState(null);
  const [payFileBusy, setPayFileBusy] = useState(false);
  const [payFileError, setPayFileError] = useState('');
  const [payFileResult, setPayFileResult] = useState(null); // { eligible, excluded } från senaste nedladdningen

  // Skattetabellerna som behövs för körningens anställda hämtas en gång
  // (cachas därefter, se skattetabell.js) — inte per anställd/beräkning.
  useEffect(() => {
    const needed = [...new Set(
      run.rows
        .filter(r => !r.employeeSnapshot?.secondaryIncome && r.employeeSnapshot?.taxTable?.tabellnr)
        .map(r => r.employeeSnapshot.taxTable)
        .map(t => `${t.year}:${t.tabellnr}`)
    )];
    let cancelled = false;
    setTablesReady(false);
    setTablesError(null);
    Promise.all(needed.map(key => {
      const [year, tabellnr] = key.split(':');
      return preloadSkattetabell(year, tabellnr);
    }))
      .then(() => { if (!cancelled) setTablesReady(true); })
      .catch(err => { if (!cancelled) { setTablesError(err.message); setTablesReady(true); } });
    return () => { cancelled = true; };
  }, [run.id, run.rows]);

  const computedRows = useMemo(() => {
    if (!tablesReady) return [];
    return run.rows.map(row => ({ row, computed: computeEmployeePayroll(row.employeeSnapshot, row) }));
  }, [run.rows, tablesReady]);
  const totals = useMemo(() => summarizePayrollRun(computedRows.map(r => r.computed)), [computedRows]);

  const previousComputedByEmployee = useMemo(() => {
    if (!previousRun) return {};
    const map = {};
    previousRun.rows.forEach(row => { map[row.employeeId] = computeEmployeePayroll(row.employeeSnapshot, row); });
    return map;
  }, [previousRun]);

  const displayStatus = run.completedSteps.includes('booked') ? 'booked' : (run.completedSteps.includes('calculated') ? 'calculated' : 'draft');

  const missingBankInfo = computedRows.filter(r => !r.computed.hasBankInfo);
  // Separat från missingBankInfo ovan: betalfilen kräver specifikt IBAN+BIC
  // (clearing-/kontonummer räcker inte där, se salaryPaymentFile.js).
  const missingIbanInfo = computedRows.filter(r => !r.computed.hasIbanInfo);
  const debtorAccountError = getDebtorAccountError(company);
  const canBook = run.completedSteps.includes('paid');

  const handleDownloadPayFile = () => {
    setPayFileBusy(true); setPayFileError(''); setPayFileResult(null);
    try {
      const result = downloadSalaryPaymentFile({ company, run, computedRows });
      setPayFileResult({ eligible: result.eligible.length, excluded: result.excluded });
    } catch (err) {
      setPayFileError(err.message || tr('ui.kunde_inte_skapa_betalfilen'));
    } finally {
      setPayFileBusy(false);
    }
  };

  // Bugkritiskt: en anställd utan tabellnummer i sin frysta ögonblicksbild
  // gör att skatteavdraget tyst blir 0 kr (se payrollCalculation.js) — det
  // ska aldrig vara osynligt VARFÖR. Bara åtgärdbart i utkast (innan
  // 'calculated'), eftersom en redan beräknad/bokförd körning aldrig ska
  // ändras i efterhand.
  const missingTaxTable = run.rows.filter(r => !r.employeeSnapshot?.secondaryIncome && !r.employeeSnapshot?.taxTable?.tabellnr);
  const isDraftRun = !run.completedSteps.includes('calculated');

  const period = run.period;
  const verBlocks = useMemo(() => {
    const acc = PAYROLL_ACCOUNTS;
    // Skattefria ersättningar (milersättning, traktamente) ingår i
    // nettobeloppet som betalas ut, men är INTE lön: de har eget
    // kostnadskonto per löneart och ska aldrig hamna i 7210. Utan en egen
    // debetrad skulle verifikationen dessutom inte balansera — krediten
    // mot bankkontot innehåller ju pengarna.
    const taxFreeByAccount = new Map();
    computedRows.forEach(({ computed }) => {
      (computed.payLines || [])
        .filter(l => l.kind === 'taxFree')
        .forEach(l => taxFreeByAccount.set(l.account, (taxFreeByAccount.get(l.account) || 0) + l.amount));
    });
    const block1 = [
      { account: acc.grossSalary, description: `Lön ${period}: Bruttolön`, debet: totals.gross, kredit: 0 },
      ...[...taxFreeByAccount.entries()].map(([account, amount]) => (
        { account, description: `Lön ${period}: Skattefri ersättning`, debet: Math.round(amount), kredit: 0 }
      )),
      { account: acc.tax, description: `Lön ${period}: Personalskatt`, debet: 0, kredit: totals.tax },
      { account: acc.netSalaryBank, description: `Lön ${period}: Nettolön`, debet: 0, kredit: totals.net },
    ];
    const block2 = [
      { account: acc.employerFeeCost, description: `Lön ${period}: Arbetsgivaravgifter`, debet: totals.employerFee, kredit: 0 },
      { account: acc.employerFeeLiability, description: `Lön ${period}: Arbetsgivaravgifter`, debet: 0, kredit: totals.employerFee },
    ];
    const block3 = [
      { account: acc.vacationProvisionCost, description: `Lön ${period}: Semesteravsättning`, debet: totals.vacationProvision, kredit: 0 },
      { account: acc.vacationProvisionLiability, description: `Lön ${period}: Semesteravsättning`, debet: 0, kredit: totals.vacationProvision },
      { account: acc.vacationSocialFeeCost, description: `Lön ${period}: Sociala avgifter semester`, debet: totals.vacationFee, kredit: 0 },
      { account: acc.vacationSocialFeeLiability, description: `Lön ${period}: Sociala avgifter semester`, debet: 0, kredit: totals.vacationFee },
    ];
    return { block1, block2, block3 };
  }, [totals, period, computedRows]);

  const handleAdvance = (stepId) => {
    if (stepId === 'booked') {
      onBookRun(run.id, verBlocks);
    } else if (stepId === 'paid') {
      // Sida 35: "Betala"-steget sparar numera VILKEN metod som faktiskt
      // användes, inte bara en klar/ej klar-flagga. Bank är den enda
      // metoden som går att slutföra idag (se Betalningsmetod-panelen
      // nedan för varför Kort är "Kommer snart"), så knappen här antar
      // bank — samma en-klicks-beteende som innan, fast nu spårbart.
      onMarkPaid(run.id, 'bank');
    } else {
      onAdvanceStep(run.id, stepId);
    }
  };

  if (!tablesReady) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--text-secondary)', background: 'var(--bg-page)' }}>
        <Loader2 size={24} className="spin" style={{ animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontSize: '13.5px' }}>{tr('ui.hamtar_skattetabeller_fran_skatteverket')}</span>
      </div>
    );
  }

  // Kundfeedback ("täcker inte hela och är inte i toppen"): den här vyn låg
  // tidigare i en paddad, centrerad ö (Payroll.jsx: padding 32px 40px runt
  // hela komponenten) helt utan ListPageHeader — enda sidan i appen som såg
  // ut så, medan alla andra listsidor (Kunder/Fakturering/Bokföring m.fl.)
  // delar samma sidhuvud-mönster (se ListPageHeader.jsx: "en enda delad
  // sidhuvud-komponent för alla listsidor"). Samma fullbredds-skal + fast
  // sidhuvud nu, med StepButtons som headerns "extra rad" (children) så
  // stegindikatorn stannar synlig medan innehållet under scrollar, istället
  // för att scrolla bort tillsammans med resten.
  const subtitleParts = [
    `Utbetalningsdatum: ${run.payDate || '—'}`,
    `${run.rows.length} ${run.rows.length === 1 ? tr('ui.anstalld_2') : tr('ui.anstallda_2')}`,
  ];
  // Bugfix (samma kundrapport som betalsektionen nedan): antog tidigare att
  // allt som inte var 'bank' måste vara 'kort' — en binär gissning som blev
  // fel så fort 'manual' (Swish/kontant/annan överföring, se den nya
  // knappen nedan) infördes som ett riktigt tredje värde.
  const PAYMENT_METHOD_LABELS = { bank: 'bank', card: 'kort', manual: 'manuellt' };
  if (run.paymentMethod) subtitleParts.push(`Betald via ${PAYMENT_METHOD_LABELS[run.paymentMethod] || run.paymentMethod}`);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <ListPageHeader
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            {tr('ui.lonekorning_2')} {run.period} <StatusBadge status={displayStatus} />
          </span>
        }
        subtitle={subtitleParts.join(' · ')}
        actions={[{ key: 'back', label: tr('ui.tillbaka_till_lonekorningar'), icon: ChevronLeft, onClick: onBack }]}
      >
        <div style={{ padding: '14px 0 16px' }}>
          <StepButtons completedSteps={run.completedSteps} onAdvance={handleAdvance} canBook={canBook} />
        </div>
      </ListPageHeader>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
      {missingTaxTable.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--status-red-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div>
              {missingTaxTable.length === 1 ? tr('ui.en_anstalld_saknar') : tr('ui.anstallda_saknar_2', { length: missingTaxTable.length })} {tr('ui.skattetabell_3')}{missingTaxTable.map(r => `${r.employeeSnapshot?.firstName || ''} ${r.employeeSnapshot?.lastName || ''}`.trim()).join(', ')}{tr('ui.skatteavdraget_visas_som_0_kr_tills_detta_atgard')}
            </div>
            {isDraftRun ? (
              <div style={{ marginTop: '8px' }}>
                {tr('ui.n1_fyll_i_tabellnummer_pa_den_anstallda_under_ans')}{' '}
                <button
                  onClick={onRefreshSnapshots}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <RefreshCw size={12} /> {tr('ui.uppdatera_anstalldas_uppgifter_i_utkastet')}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '4px', fontWeight: 600 }}>
                {tr('ui.korningen_ar_redan_beraknad_bokford_dess_ogonbli')}
              </div>
            )}
          </div>
        </div>
      )}

      {missingBankInfo.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--status-red-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{missingBankInfo.length} {missingBankInfo.length === 1 ? tr('ui.anstalld_saknar') : tr('ui.anstallda_saknar')} {tr('ui.clearing_kontonummer_och_kommer_inte_att_inklude')}</span>
        </div>
      )}

      {tablesError && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--status-amber-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{tr('ui.kunde_inte_hamta_skattetabellen_fran_skatteverke')}{tablesError}{tr('ui.skatteavdrag_kan_inte_beraknas_korrekt_forran_de')}</span>
        </div>
      )}

      <SummaryCards totals={totals} />
      {/* Bugfix (kundrapport, dark mode): bakgrunden var --text-main, som
          i mörkt tema ÄR nästan-vit text-färgen (#eef3ea) — rutan blev då
          nästan-vit med vit text, osynlig. --accent skrivs aldrig om per
          tema (samma gröna varumärkesfärg i både ljust och mörkt läge),
          vilket är samma mönster som knappar i resten av appen använder
          för accentfärgad yta med vit text. */}
      <div style={{ background: 'var(--accent)', color: 'white', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 25%, transparent)' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{tr('ui.total_kostnad')}</span>
        <span style={{ fontWeight: 800, fontSize: '22px' }}>{fmt(totals.totalCost)} {tr('ui.kr')}</span>
      </div>

      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px' }}>{tr('ui.anstallda_i_korningen')}</h3>
      {computedRows.map(({ row, computed }) => (
        <EmployeeRow
          key={row.employeeId} row={row} computed={computed}
          previousComputed={previousComputedByEmployee[row.employeeId]}
          accounts={accounts} onUpdateRow={onUpdateRow}
          locked={run.completedSteps.includes('booked')}
        />
      ))}

      {run.completedSteps.includes('approved') && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>{tr('ui.forhandsgranskning_verifikationer')}</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>{tr('ui.genereras_och_bokfors_som_tre_separata_verifikat')}</p>
          <VerificationBlock title={tr('ui.block_1_lon')} rows={verBlocks.block1} accounts={accounts} />
          <VerificationBlock title={tr('ui.block_2_arbetsgivaravgifter')} rows={verBlocks.block2} accounts={accounts} />
          <VerificationBlock title={tr('ui.block_3_semesteravsattning')} rows={verBlocks.block3} accounts={accounts} />
        </div>
      )}

      {run.completedSteps.includes('approved') && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px' }}>{tr('ui.betalningsmetod')}</h3>

          {/* Kundfeedback ("all information", "hela stilen är inte så bra"):
              en redan betald körning visade tidigare exakt samma formulär
              som en obetald — ingen bekräftelse på VAD som faktiskt hände.
              Ersätts nu med en ren kvittens (metod + datum) istället för
              att lämna nedladdnings-/markera-som-betald-knapparna aktiva
              för en redan avslutad betalning. */}
          {run.completedSteps.includes('paid') ? (
            <div style={{ ...panelCard, padding: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'var(--status-green-bg)', color: 'var(--status-green-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Check size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text-main)' }}>
                  {tr('ui.betald')} {run.paidAt ? new Date(run.paidAt).toLocaleDateString('sv-SE') : ''}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {tr('ui.via')} {PAYMENT_METHOD_LABELS[run.paymentMethod] || run.paymentMethod || tr('ui.okant_satt')} · {fmt(totals.net)} {tr('ui.kr_nettolon_till')} {computedRows.length} {computedRows.length === 1 ? tr('ui.anstalld_2') : tr('ui.anstallda_2')}
                </div>
              </div>
            </div>
          ) : (
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '16px', alignItems: 'stretch' }}>
              <div style={{ ...panelCard, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={16} color="var(--accent)" /> {tr('ui.bank_betalfil')}
                </h4>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>{tr('ui.format')}</label>
                <select disabled style={{ width: '100%', maxWidth: '360px', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-muted)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <option>{tr('ui.iso_20022_pain_001_xml')}</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  {tr('ui.iso_20022_standarden_for_betalfiler_kraver_oftas')}
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '12.5px', color: 'var(--status-amber-text)', lineHeight: 1.5 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>{tr('ui.pain_001_skickas_normalt_via_filkommunikationsav')}</span>
                </div>

                {debtorAccountError && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--status-red-text)', lineHeight: 1.5 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span>{debtorAccountError}</span>
                  </div>
                )}

                {missingIbanInfo.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1, color: 'var(--text-muted)' }} />
                    <span>
                      {missingIbanInfo.length} {missingIbanInfo.length === 1 ? tr('ui.anstalld_saknar') : tr('ui.anstallda_saknar')} {tr('ui.iban_bic')}{missingIbanInfo.map(r => `${r.row.employeeSnapshot?.firstName || ''} ${r.row.employeeSnapshot?.lastName || ''}`.trim()).join(', ')}{tr('ui.och_exkluderas_fran_betalfilen_om_du_laddar_ner')}
                    </span>
                  </div>
                )}

                {payFileError && (
                  <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginBottom: '12px' }}>{payFileError}</div>
                )}
                {payFileResult && (
                  <div style={{ fontSize: '12.5px', color: 'var(--status-green-text)', marginBottom: '12px', fontWeight: 600 }}>
                    {tr('ui.betalfil_nedladdad')} {payFileResult.eligible} {payFileResult.eligible === 1 ? tr('ui.anstalld_2') : tr('ui.anstallda_2')} {tr('ui.inkluderade')}
                    {payFileResult.excluded.length > 0 ? tr('ui.exkluderade_saknar_iban_bic', { length: payFileResult.excluded.length }) : '.'}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDownloadPayFile}
                    disabled={payFileBusy || Boolean(debtorAccountError) || missingIbanInfo.length === computedRows.length}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, border: 'none',
                      background: (payFileBusy || debtorAccountError || missingIbanInfo.length === computedRows.length) ? 'var(--border)' : 'var(--accent)',
                      color: (payFileBusy || debtorAccountError || missingIbanInfo.length === computedRows.length) ? 'var(--text-muted)' : 'white',
                      cursor: (payFileBusy || debtorAccountError || missingIbanInfo.length === computedRows.length) ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Download size={15} /> {payFileBusy ? tr('ui.skapar_fil') : tr('ui.ladda_ner_betalfil')}
                  </button>
                  <button type="button" onClick={() => setShowBankGuide(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    {tr('ui.sa_importerar_du_filen_i_din_bank')} {showBankGuide ? <ChevronUp size={13} style={{ verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ verticalAlign: 'middle' }} />}
                  </button>
                </div>
                {showBankGuide && (
                  <div style={{ marginTop: '12px', padding: '14px', background: 'var(--bg-muted)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                    {tr('ui.i_de_flesta_internetbanker_logga_in_pa_foretaget')}
                  </div>
                )}

                {/* Kundfeedback ("man ska kunna markera som betald"): fanns
                    tidigare INGEN knapp här alls — enda vägen att slutföra
                    Betala-steget var pilen i sidhuvudet, helt frikopplad
                    från den här panelen och det du faktiskt just gjorde
                    (laddade ner filen). Riktig bekräftelse-knapp nu,
                    direkt där handlingen ägde rum. */}
                <div style={{ marginTop: 'auto', paddingTop: '18px', borderTop: '1px solid var(--border-light)' }}>
                  <button
                    onClick={() => onMarkPaid(run.id, 'bank')}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 20px', background: 'var(--status-green-text)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer' }}
                  >
                    <Check size={15} /> {tr('ui.markera_som_betald')}
                  </button>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                    {tr('ui.klicka_nar_lonerna_faktiskt_ar_utbetalda_t_ex_ef')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ ...panelCard, padding: '20px', opacity: 0.6 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={16} color="var(--text-muted)" /> {tr('ui.kort_stripe')}
                  </h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
                    {tr('ui.lampligt_for_enstaka_mindre_utbetalningar_men_kr')}
                  </p>
                  <button disabled style={{ width: '100%', padding: '9px 12px', background: 'var(--border-light)', color: 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'not-allowed' }}>
                    {tr('ui.kommer_snart')}
                  </button>
                </div>

                {/* Kundfeedback ("man ska kunna göra manuellt om man
                    vill"): den enda vägen framåt var tidigare att anta att
                    ALLA betalar via den här bankfilen. En del betalar via
                    Swish, kontant eller en separat överföring redan innan
                    de ens öppnar Bokix — de ska kunna säga det, inte tvingas
                    låtsas att en bankfil användes. */}
                <div style={{ ...panelCard, padding: '18px' }}>
                  <button
                    type="button" onClick={() => setShowManualPay(s => !s)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600 }}
                  >
                    {tr('ui.betalade_du_pa_ett_annat_satt')}
                    {showManualPay ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showManualPay && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                        {tr('ui.t_ex_swish_kontant_eller_en_separat_overforing_d')}
                      </p>
                      <button
                        onClick={() => onMarkPaid(run.id, 'manual')}
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-muted)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        {tr('ui.markera_som_betald_manuellt')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bugfix (kundrapport: "funkar inte som den ska"): gated tidigare på
          'payslips' (steg 4, Lönebesked) istället för 'booked' (steg 5,
          Bokför) — se PAYROLL_RUN_STEPS i payrollConfig.js, "AGI och skatt"
          är steg 6, EFTER Bokför. Panelen (och dess kryssruta, som direkt
          anropar onAdvanceStep('agi') utan StepButtons egen sekvens-spärr)
          blev alltså synlig och ifyllbar långt innan AGI-steget faktiskt
          var näst på tur — kunde markera 'agi' som klar innan 'booked' ens
          var det, vilket fick stegraden ovan att se bakvänd ut (ett SENARE
          steg grönt/klart medan ett TIDIGARE fortfarande stod grått). */}
      {run.completedSteps.includes('booked') && (
        <div style={{ ...panelCard, marginTop: '28px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>{tr('ui.agi_och_skatt')}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
            {AGI_XML_ENABLED
              ? tr('ui.filen_nedan_ar_klar_att_ladda_upp_hos_skatteverk')
              : tr('ui.sammanstallning_huvuduppgift_individuppgift_per')}
          </p>
          <div className="form-row-2" style={{ display: 'grid', gap: '10px', fontSize: '13.5px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{tr('ui.total_bruttolon')}</span><span style={{ fontWeight: 700 }}>{fmt(totals.gross)} {tr('ui.kr')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{tr('ui.avdragen_skatt')}</span><span style={{ fontWeight: 700 }}>{fmt(totals.tax)} {tr('ui.kr')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>{tr('ui.arbetsgivaravgifter')}</span><span style={{ fontWeight: 700 }}>{fmt(totals.employerFee)} {tr('ui.kr')}</span></div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            {AGI_XML_ENABLED && (
              <button
                onClick={() => {
                  const result = downloadAgiXml({ company, period: run.period, computedRows }, `agi-${run.period}.xml`);
                  setAgiFileProblems({ errors: result.errors, warnings: result.warnings });
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
              >
                <Download size={14} /> {tr('ui.ladda_ner_agi_fil_for_skatteverket_xml')}
              </button>
            )}
            <button
              onClick={() => downloadAgiPdf({ company, period: run.period, computedRows, totals }, `agi-${run.period}.pdf`)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              <Download size={14} /> {AGI_XML_ENABLED ? tr('ui.sammanstallning_pdf') : tr('ui.ladda_ner_agi_sammanstallning_pdf')}
            </button>
            <a
              href="https://www.skatteverket.se/foretag"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
            >
              {tr('ui.oppna_skatteverket_se')} <ExternalLink size={13} />
            </a>
          </div>

          {agiFileProblems && agiFileProblems.errors.length > 0 && (
            <div role="alert" style={{ background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>{tr('ui.filen_kunde_inte_skapas_an')}</div>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                {agiFileProblems.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}
          {agiFileProblems && agiFileProblems.errors.length === 0 && (
            <div style={{ background: 'var(--status-amber-bg)', color: 'var(--status-amber-text)', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', lineHeight: 1.5, marginBottom: '16px' }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>{tr('ui.filen_ar_sparad')}</div>
              <div>
                {run.rows.every(r => (r.feeRules || 0) >= FEE_RULES_VERSION)
                  ? tr('ui.arbetsgivaravgiften_ar_raknad_efter_varje_anstal')
                  : tr('ui.den_har_lonekorningen_skapades_innan_bokix_rakna')}
                {' '}{tr('ui.deklarationen_lamnas_och_skatten_betalas_senast')}
              </div>
              {agiFileProblems.warnings.length > 0 && (
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                  {agiFileProblems.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              )}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
            <input type="checkbox" checked={agiConfirmed} onChange={e => { setAgiConfirmed(e.target.checked); if (e.target.checked) onAdvanceStep(run.id, 'agi'); }} disabled={run.completedSteps.includes('agi')} />
            {tr('ui.jag_har_lamnat_in_arbetsgivardeklarationen_agi_h')}
          </label>
        </div>
      )}
      </div>
    </div>
  );
}
