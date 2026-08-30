import React, { useState, useMemo, useEffect } from 'react';
import {
  Check, ChevronDown, ChevronUp, AlertTriangle, Download, ChevronLeft, Loader2, ExternalLink, RefreshCw, Landmark, CreditCard,
} from 'lucide-react';
import CalculationRow from './shared/CalculationRow';
import ListPageHeader from './shared/ListPageHeader';
import { computeEmployeePayroll, summarizePayrollRun } from '../utils/payrollCalculation';
import { PAYROLL_RUN_STEPS, PAYROLL_ACCOUNTS } from '../utils/payrollConfig';
import { generatePayslipPdf } from '../utils/payslipExport';
import { downloadAgiPdf } from '../utils/agiExport';
import { preloadSkattetabell } from '../utils/skattetabell';
import { downloadSalaryPaymentFile, getDebtorAccountError } from '../utils/salaryPaymentFile';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(Math.round(v || 0));
const fmtSigned = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('sv-SE').format(Math.round(Math.abs(v || 0)))} kr`;
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid #ececef', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };

function StatusBadge({ status }) {
  const map = {
    booked: { label: 'Bokförd', bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' },
    calculated: { label: 'Beräknad', bg: '#e0f2fe', color: '#0369a1' },
    draft: { label: 'Utkast', bg: 'var(--border-light)', color: 'var(--text-secondary)' },
  };
  const s = map[status] || map.draft;
  return <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

function StepButtons({ completedSteps, onAdvance, canBook }) {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', paddingTop: '22px' }}>
      {PAYROLL_RUN_STEPS.map((step, i) => {
        const isDone = completedSteps.includes(step.id);
        const prevDone = i === 0 || completedSteps.includes(PAYROLL_RUN_STEPS[i - 1].id);
        const isNext = !isDone && prevDone;
        const disabled = !prevDone || isDone || (step.id === 'booked' && !canBook);
        return (
          <div key={step.id} style={{ position: 'relative' }}>
            {/* Kundfeedback ("hur skulle jag veta att det är man skulle
                trycka, ha en pil eller nått") — accentfärgen räckte inte
                som ledtråd ensam. Studsande pil + "Klicka här"-etikett
                pekar nu rakt ut den enda knapp som faktiskt går att
                klicka just nu. */}
            {isNext && !disabled && (
              <div
                style={{
                  position: 'absolute', top: '-24px', left: '50%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
                  animation: 'bokix-step-bounce 1s ease-in-out infinite', pointerEvents: 'none',
                }}
              >
                <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--accent)', whiteSpace: 'nowrap' }}>Klicka här</span>
                <ChevronDown size={13} color="var(--accent)" style={{ marginTop: '-2px' }} />
              </div>
            )}
            <button
              disabled={disabled}
              onClick={() => onAdvance(step.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '999px',
                fontSize: '13px', fontWeight: 700, border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: isDone ? '#ecfdf5' : (isNext ? 'var(--accent)' : 'var(--border-light)'),
                color: isDone ? '#059669' : (isNext ? 'white' : 'var(--text-muted)'),
                animation: (isNext && !disabled) ? 'bokix-step-pulse 1.8s ease-in-out infinite' : 'none',
              }}
            >
              {isDone && <Check size={14} />} {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function SummaryCards({ totals }) {
  const cards = [
    { label: 'Brutto', value: totals.gross, color: 'var(--text-main)' },
    { label: 'Skatt', value: totals.tax, color: 'var(--status-red-text)' },
    { label: 'Netto', value: totals.net, color: 'var(--status-green-text)' },
    { label: 'Avgifter', value: totals.employerFee + totals.vacationFee, color: 'var(--text-main)' },
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
      {cards.map(c => (
        <div key={c.label} style={{ ...panelCard, padding: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>{c.label}</div>
          <div style={{ fontSize: '20px', fontWeight: 800, color: c.color }}>{fmt(c.value)} kr</div>
        </div>
      ))}
    </div>
  );
}

function EmployeeRow({ row, computed, previousComputed, accounts, onUpdateRow, locked }) {
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
              <span title={`${fmtSigned(diff)} jämfört med föregående lönekörning`} style={{ fontSize: '12px', fontWeight: 700, color: diff < 0 ? 'var(--status-red-text)' : 'var(--status-green-text)', cursor: 'help' }}>
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
              <span>{isHourly ? 'Inga tidrapporter registrerade för denna period' : 'Ingen månadslön angiven — kontrollera lön/anställningsgrad under Anställda'}</span>
              {isHourly && !locked && (
                <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number" min="0" placeholder="Timmar" value={row.hoursWorked || ''}
                    onChange={e => onUpdateRow(row.employeeId, { hoursWorked: e.target.value })}
                    style={{ width: '70px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>timmar denna period</span>
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>Skatt {fmt(computed.tax)} kr · Netto {fmt(computed.net)} kr · Avgifter {fmt(computed.employerFee)} kr · Semester {fmt(computed.vacationProvision)} kr</span>
              {isHourly && !locked && (
                <span onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number" min="0" value={row.hoursWorked || ''}
                    onChange={e => onUpdateRow(row.employeeId, { hoursWorked: e.target.value })}
                    style={{ width: '60px', padding: '3px 6px', border: '1px solid var(--border)', borderRadius: '5px', fontSize: '12px' }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>tim</span>
                </span>
              )}
            </div>
          )}
          {!computed.hasBankInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--status-red-text)', marginTop: '4px' }}>
              <AlertTriangle size={12} /> Saknar bankkontouppgifter — kan inte inkluderas i betalfilen
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontWeight: 800, fontSize: '17px', color: 'var(--text-main)' }}>{fmt(computed.gross)} kr</div>
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '4px 18px 16px', borderTop: '1px solid var(--border-light)' }}>
          {computed.steps.map((s, i) => <CalculationRow key={i} {...s} />)}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); generatePayslipPdf({ employee: row.employeeSnapshot, computed, period: row.period }).save(`lonebesked-${row.employeeSnapshot.lastName}-${row.period}.pdf`); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--bg-muted)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <Download size={13} /> Ladda ner lönebesked (PDF)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function VerificationBlock({ title, rows, accounts }) {
  const total = { debet: rows.reduce((s, r) => s + (r.debet || 0), 0), kredit: rows.reduce((s, r) => s + (r.kredit || 0), 0) };
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>{title}</div>
      <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)' }}>
              {['Konto', 'Beskrivning', 'Debet', 'Kredit'].map(h => (
                <th key={h} style={{ padding: '8px 14px', textAlign: h === 'Konto' || h === 'Beskrivning' ? 'left' : 'right', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const accName = accounts.find(a => a.code === r.account)?.name || '';
              return (
                <tr key={i} style={{ borderTop: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '9px 14px' }}>{r.account} {accName}</td>
                  <td style={{ padding: '9px 14px', color: 'var(--text-secondary)' }}>{r.description}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>{r.debet ? fmt(r.debet) : ''}</td>
                  <td style={{ padding: '9px 14px', textAlign: 'right' }}>{r.kredit ? fmt(r.kredit) : ''}</td>
                </tr>
              );
            })}
            <tr style={{ borderTop: '1px solid var(--border)', fontWeight: 700 }}>
              <td colSpan={2} style={{ padding: '9px 14px' }}>Summa</td>
              <td style={{ padding: '9px 14px', textAlign: 'right' }}>{fmt(total.debet)}</td>
              <td style={{ padding: '9px 14px', textAlign: 'right' }}>{fmt(total.kredit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function PayrollRunDetail({ run, previousRun, accounts, company, onBack, onAdvanceStep, onBookRun, onMarkPaid, onUpdateRow, onRefreshSnapshots }) {
  const [agiConfirmed, setAgiConfirmed] = useState(run.completedSteps.includes('agi'));
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
      setPayFileError(err.message || 'Kunde inte skapa betalfilen.');
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
    const block1 = [
      { account: acc.grossSalary, description: `Lön ${period}: Bruttolön`, debet: totals.gross, kredit: 0 },
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
  }, [totals, period]);

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
        <span style={{ fontSize: '13.5px' }}>Hämtar skattetabeller från Skatteverket…</span>
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
    `${run.rows.length} ${run.rows.length === 1 ? 'anställd' : 'anställda'}`,
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
            Lönekörning {run.period} <StatusBadge status={displayStatus} />
          </span>
        }
        subtitle={subtitleParts.join(' · ')}
        actions={[{ key: 'back', label: 'Tillbaka till lönekörningar', icon: ChevronLeft, onClick: onBack }]}
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
              {missingTaxTable.length === 1 ? 'En anställd saknar' : `${missingTaxTable.length} anställda saknar`} skattetabell ({missingTaxTable.map(r => `${r.employeeSnapshot?.firstName || ''} ${r.employeeSnapshot?.lastName || ''}`.trim()).join(', ')}) — skatteavdraget visas som 0 kr tills detta åtgärdas.
            </div>
            {isDraftRun ? (
              <div style={{ marginTop: '8px' }}>
                1. Fyll i tabellnummer på den anställda under Anställda. 2. Klicka sedan:{' '}
                <button
                  onClick={onRefreshSnapshots}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 12px', background: '#991b1b', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}
                >
                  <RefreshCw size={12} /> Uppdatera anställdas uppgifter i utkastet
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '4px', fontWeight: 600 }}>
                Körningen är redan beräknad/bokförd — dess ögonblicksbild kan inte längre ändras. Rätta den anställdas skattetabell för framtida körningar.
              </div>
            )}
          </div>
        </div>
      )}

      {missingBankInfo.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--status-red-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{missingBankInfo.length} {missingBankInfo.length === 1 ? 'anställd saknar' : 'anställda saknar'} clearing-/kontonummer och kommer inte att inkluderas i betalfilen. Komplettera under Anställda innan Betala-steget.</span>
        </div>
      )}

      {tablesError && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: 'var(--status-amber-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Kunde inte hämta skattetabellen från Skatteverket ({tablesError}). Skatteavdrag kan inte beräknas korrekt förrän detta lyckas — kontrollera internetuppkopplingen och öppna körningen igen.</span>
        </div>
      )}

      <SummaryCards totals={totals} />
      {/* Bugfix (kundrapport, dark mode): bakgrunden var --text-main, som
          i mörkt tema ÄR nästan-vit text-färgen (#eef3ea) — rutan blev då
          nästan-vit med vit text, osynlig. --accent skrivs aldrig om per
          tema (samma gröna varumärkesfärg i både ljust och mörkt läge),
          vilket är samma mönster som knappar i resten av appen använder
          för accentfärgad yta med vit text. */}
      <div style={{ background: 'var(--accent)', color: 'white', borderRadius: '14px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', boxShadow: '0 4px 14px rgba(61, 122, 46, 0.25)' }}>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>Total kostnad</span>
        <span style={{ fontWeight: 800, fontSize: '22px' }}>{fmt(totals.totalCost)} kr</span>
      </div>

      <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px' }}>Anställda i körningen</h3>
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
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>Förhandsgranskning — verifikationer</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>Genereras och bokförs som tre separata verifikationer, summerade över samtliga anställda — inte en per anställd.</p>
          <VerificationBlock title="Block 1 — Lön" rows={verBlocks.block1} accounts={accounts} />
          <VerificationBlock title="Block 2 — Arbetsgivaravgifter" rows={verBlocks.block2} accounts={accounts} />
          <VerificationBlock title="Block 3 — Semesteravsättning" rows={verBlocks.block3} accounts={accounts} />
        </div>
      )}

      {run.completedSteps.includes('approved') && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 12px' }}>Betalningsmetod</h3>

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
                  Betald {run.paidAt ? new Date(run.paidAt).toLocaleDateString('sv-SE') : ''}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  Via {PAYMENT_METHOD_LABELS[run.paymentMethod] || run.paymentMethod || 'okänt sätt'} · {fmt(totals.net)} kr nettolön till {computedRows.length} {computedRows.length === 1 ? 'anställd' : 'anställda'}
                </div>
              </div>
            </div>
          ) : (
            <div className="form-row-stack" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)', gap: '16px', alignItems: 'stretch' }}>
              <div style={{ ...panelCard, padding: '20px', display: 'flex', flexDirection: 'column' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Landmark size={16} color="var(--accent)" /> Bank — Betalfil
                </h4>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>Format</label>
                <select disabled style={{ width: '100%', maxWidth: '360px', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg-muted)', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <option>ISO 20022 pain.001 (XML)</option>
                </select>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '14px', lineHeight: 1.5 }}>
                  ISO 20022, standarden för betalfiler. Kräver oftast filkommunikationsavtal med banken: flera internetbanker tar inte emot pain.001 via vanlig filuppladdning.
                </p>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', fontSize: '12.5px', color: 'var(--status-amber-text)', lineHeight: 1.5 }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>pain.001 skickas normalt via filkommunikationsavtal eller bankgirokoppling, inte genom att laddas upp i internetbanken. Kontrollera att din bank tar emot filen den vägen i god tid före utbetalningsdagen — filen skickas aldrig automatiskt någonstans, du laddar upp den själv.</span>
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
                      {missingIbanInfo.length} {missingIbanInfo.length === 1 ? 'anställd saknar' : 'anställda saknar'} IBAN/BIC ({missingIbanInfo.map(r => `${r.row.employeeSnapshot?.firstName || ''} ${r.row.employeeSnapshot?.lastName || ''}`.trim()).join(', ')}) och exkluderas från betalfilen om du laddar ner den nu. Komplettera under Anställda.
                    </span>
                  </div>
                )}

                {payFileError && (
                  <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginBottom: '12px' }}>{payFileError}</div>
                )}
                {payFileResult && (
                  <div style={{ fontSize: '12.5px', color: 'var(--status-green-text)', marginBottom: '12px', fontWeight: 600 }}>
                    Betalfil nedladdad — {payFileResult.eligible} {payFileResult.eligible === 1 ? 'anställd' : 'anställda'} inkluderade
                    {payFileResult.excluded.length > 0 ? `, ${payFileResult.excluded.length} exkluderade (saknar IBAN/BIC).` : '.'}
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
                    <Download size={15} /> {payFileBusy ? 'Skapar fil…' : 'Ladda ner betalfil'}
                  </button>
                  <button type="button" onClick={() => setShowBankGuide(s => !s)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    Så importerar du filen i din bank {showBankGuide ? <ChevronUp size={13} style={{ verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ verticalAlign: 'middle' }} />}
                  </button>
                </div>
                {showBankGuide && (
                  <div style={{ marginTop: '12px', padding: '14px', background: 'var(--bg-muted)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                    I de flesta internetbanker: logga in på företagets internetbank, sök upp "Filöverföring" eller "Leverantörsbetalningar" i menyn, välj rätt filformat (pain.001/ISO 20022) och ladda upp filen där. Vissa banker kräver ett separat filkommunikationsavtal som tecknas i förväg — kontakta din bank om alternativet inte syns. Sök efter din banks egen dokumentation för exakta steg, eftersom detta skiljer sig mellan banker.
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
                    <Check size={15} /> Markera som betald
                  </button>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                    Klicka när lönerna faktiskt är utbetalda — t.ex. efter att du laddat upp betalfilen i banken. Bokix kan inte se det själv.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ ...panelCard, padding: '20px', opacity: 0.6 }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CreditCard size={16} color="var(--text-muted)" /> Kort (Stripe)
                  </h4>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 0 18px' }}>
                    Lämpligt för enstaka mindre utbetalningar, men kräver en annan Stripe-produkt (utbetalningar till anställda) än den som redan tar emot kortbetalningar från era kunder — inte byggt ännu.
                  </p>
                  <button disabled style={{ width: '100%', padding: '9px 12px', background: 'var(--border-light)', color: 'var(--text-muted)', border: 'none', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'not-allowed' }}>
                    Kommer snart
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
                    Betalade du på ett annat sätt?
                    {showManualPay ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                  {showManualPay && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px', lineHeight: 1.5 }}>
                        T.ex. Swish, kontant eller en separat överföring du redan gjort. Bokix bokför samma verifikationer oavsett — det här styr bara vad som visas som betalningssätt.
                      </p>
                      <button
                        onClick={() => onMarkPaid(run.id, 'manual')}
                        style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-muted)', color: 'var(--text-main)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        Markera som betald manuellt
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
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>AGI och skatt</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Sammanställning (huvuduppgift + individuppgift per anställd) för arbetsgivardeklarationen (AGI). Skatteverket kräver arbetsgivarens egen BankID-signatur vid inlämning, så Bokix skickar inte in den automatiskt — men underlaget nedan är klart att skriva av.
          </p>
          <div className="form-row-2" style={{ display: 'grid', gap: '10px', fontSize: '13.5px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Total bruttolön</span><span style={{ fontWeight: 700 }}>{fmt(totals.gross)} kr</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Avdragen skatt</span><span style={{ fontWeight: 700 }}>{fmt(totals.tax)} kr</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Arbetsgivaravgifter</span><span style={{ fontWeight: 700 }}>{fmt(totals.employerFee)} kr</span></div>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
            <button
              onClick={() => downloadAgiPdf({ company, period: run.period, computedRows, totals }, `agi-${run.period}.pdf`)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
            >
              <Download size={14} /> Ladda ner AGI-sammanställning (PDF)
            </button>
            <a
              href="https://www.skatteverket.se/foretag"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', textDecoration: 'none' }}
            >
              Öppna skatteverket.se <ExternalLink size={13} />
            </a>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', color: 'var(--text-main)', cursor: 'pointer' }}>
            <input type="checkbox" checked={agiConfirmed} onChange={e => { setAgiConfirmed(e.target.checked); if (e.target.checked) onAdvanceStep(run.id, 'agi'); }} disabled={run.completedSteps.includes('agi')} />
            Jag har lämnat in arbetsgivardeklarationen (AGI) hos Skatteverket för denna period
          </label>
        </div>
      )}
      </div>
    </div>
  );
}
