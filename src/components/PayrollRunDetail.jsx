import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Check, ChevronDown, ChevronUp, AlertTriangle, Download, ChevronLeft, Loader2, ExternalLink, RefreshCw, Trash2,
  Upload, Send,
} from './icons';
import { sendPayslipEmail } from '../emailApi';
import { parsePayrollHours } from '../utils/payrollHoursImport';
import CalculationRow from './shared/CalculationRow';
import ListPageHeader from './shared/ListPageHeader';
import { BRAND } from '../utils/brandColors';
import { computeEmployeePayroll, summarizePayrollRun, FEE_RULES_VERSION } from '../utils/payrollCalculation';
import { PAY_TYPE_GROUPS, PAY_LINE_KINDS, getPayType, defaultRateFor } from '../utils/payTypes';
import { PAYROLL_RUN_STEPS, PAYROLL_ACCOUNTS } from '../utils/payrollConfig';
import { generatePayslipPdf, generateAllPayslipsPdf, yearToDate } from '../utils/payslipExport';
import { describeRow } from '../utils/plainBooking';
import { downloadAgiPdf } from '../utils/agiExport';
import { downloadAgiXml } from '../utils/agiXml';
import { AGI_XML_ENABLED } from '../utils/featureFlags';
import { preloadSkattetabell } from '../utils/skattetabell';
import { downloadSalaryPaymentFile, getDebtorAccountError } from '../utils/salaryPaymentFile';
import { t as tr } from '../i18n';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(Math.round(v || 0));
const fmtSigned = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${new Intl.NumberFormat('sv-SE').format(Math.round(Math.abs(v || 0)))} kr`;
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xs)' };

function StatusBadge({ status }) {
  const map = {
    booked: { label: tr('ui.bokford'), bg: 'var(--status-green-bg)', color: 'var(--status-green-text)' },
    calculated: { label: tr('ui.beraknad_2'), bg: 'var(--status-blue-bg)', color: 'var(--status-blue-text)' },
    draft: { label: tr('ui.utkast'), bg: 'var(--border-light)', color: 'var(--text-secondary)' },
  };
  const s = map[status] || map.draft;
  return <span style={{ padding: '4px 12px', borderRadius: '999px', fontSize: '12.5px', fontWeight: 700, background: s.bg, color: s.color }}>{s.label}</span>;
}

// Lönekörningen i steg (2026-10-10): en rad med stegen överst, och varje
// steg visar bara sitt eget innehåll. Raden används för att FLYTTA SIG
// mellan stegen (klara steg och det steg man står på går att öppna), inte
// för att utföra dem: varje steg har sin egen tydliga knapp längst ner.
// Sista steget, Klart, samlar allt. Numrerade cirklar med en linje mellan
// gör ordningen läsbar på en blick, oavsett färgseende.
const RUN_STAGES = [...PAYROLL_RUN_STEPS.map(s => s.id), 'done'];
function StageNav({ stage, completedSteps, onOpen }) {
  const labels = Object.fromEntries(PAYROLL_RUN_STEPS.map(s => [s.id, s.label]));
  labels.done = tr('payrollStages.doneShort');
  const allDone = PAYROLL_RUN_STEPS.every(s => completedSteps.includes(s.id));
  // Det steg man kommit till: första ej klara, eller Klart.
  const reached = allDone ? RUN_STAGES.length - 1 : RUN_STAGES.findIndex(id => !completedSteps.includes(id));
  return (
    <nav className="payroll-stepper" aria-label={tr('payrollStages.navLabel')} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: '10px', padding: '12px 0 14px' }}>
      {RUN_STAGES.map((id, i) => {
        const isDone = id === 'done' ? allDone : completedSteps.includes(id);
        const isCurrent = stage === id;
        const openable = i <= reached;
        const isLast = i === RUN_STAGES.length - 1;
        return (
          <React.Fragment key={id}>
            <button
              type="button"
              disabled={!openable}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => onOpen(id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px 4px 4px', borderRadius: '999px',
                fontSize: '13px', fontWeight: isCurrent ? 800 : 600, border: 'none',
                background: isCurrent ? 'var(--bg-muted)' : 'none', fontFamily: 'inherit',
                cursor: openable ? 'pointer' : 'not-allowed',
              }}
            >
              <span style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 800,
                background: isDone ? BRAND.green : (isCurrent ? 'var(--accent)' : 'var(--border-light)'),
                color: isDone || isCurrent ? 'white' : 'var(--text-muted)',
              }}>
                {isDone ? <Check size={14} /> : i + 1}
              </span>
              <span className="step-label" style={{ color: openable ? 'var(--text-main)' : 'var(--text-muted)' }}>{labels[id]}</span>
            </button>
            {!isLast && (
              <span aria-hidden className="step-connector" style={{ flex: '1 1 16px', minWidth: '12px', maxWidth: '40px', height: '2px', margin: '0 2px', borderRadius: '1px', background: isDone ? BRAND.green : 'var(--border-light)' }} />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

// Kundönskemål ("mycket bättre UI"): fyra likadana textrutor i rad gav
// ingen ledtråd om VAD varje siffra var utan att läsa etiketten först. En
// liten ikon per kort (samma mönster som Semesteröversiktens kort) gör
// dem urskiljbara på en blick — färgen på siffran gör fortfarande jobbet
// att visa "detta är ett avdrag" (röd skatt) kontra "detta är kvar" (grön
// netto), ikonen gör bara att man känner igen KORTET snabbare, inte bara
// TALET.
// Ett enda lugnt kort i stället för fyra kort och en stor grön balk
// (kundönskemål 2026-10-07: "snyggare, syns bra"). Siffrorna står i
// textfärg; bara totalkostnaden, den man faktiskt betalar, är framhävd.
function SummaryCards({ totals, flat = false }) {
  const cells = [
    { label: tr('ui.brutto'), value: totals.gross },
    { label: tr('ui.skatt'), value: totals.tax },
    { label: tr('ui.netto'), value: totals.net, hint: tr('payrollUi.netHint') },
    { label: tr('ui.avgifter'), value: totals.employerFee + totals.vacationFee },
  ];
  return (
    <div className="payroll-summary" style={{ ...panelCard, ...(flat ? { boxShadow: 'none', marginTop: '16px', marginBottom: 0 } : { marginBottom: '28px' }), display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) minmax(0, 1.3fr)', overflow: 'hidden' }}>
      {cells.map(c => (
        <div key={c.label} style={{ padding: '16px 18px', borderRight: '1px solid var(--border-light)', minWidth: 0 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{c.label}</div>
          <div style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(c.value)} {tr('ui.kr')}</div>
          {c.hint && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>{c.hint}</div>}
        </div>
      ))}
      <div style={{ padding: '16px 20px', background: 'var(--bg-muted)', minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>{tr('ui.total_kostnad')}</div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(totals.totalCost)} {tr('ui.kr')}</div>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '3px' }}>{tr('payrollUi.totalHint')}</div>
      </div>
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
function EmployeeRow({ row, computed, previousComputed, onUpdateRow, locked, payslipArgs, flat = false }) {
  const [expanded, setExpanded] = useState(false);
  const isZero = computed.gross === 0 && computed.net === 0 && computed.tax === 0;
  const diff = previousComputed ? computed.net - previousComputed.net : null;
  const isHourly = row.employeeSnapshot.salaryForm === 'timlon';

  return (
    <div style={flat ? { borderBottom: '1px solid var(--border-light)' } : { ...panelCard, marginBottom: '10px', overflow: 'hidden', transition: 'box-shadow 0.15s' }}>
      <div
        className="payroll-emp-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: flat ? '14px 24px' : '14px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
        onMouseEnter={e => { if (flat) e.currentTarget.style.background = 'var(--bg-muted)'; else e.currentTarget.parentElement.style.boxShadow = 'var(--shadow-sm)'; }}
        onMouseLeave={e => { if (flat) e.currentTarget.style.background = ''; else e.currentTarget.parentElement.style.boxShadow = panelCard.boxShadow; }}
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
            <div style={{ fontSize: '12.5px', color: 'var(--status-amber-text)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Bugfix (kundrapport): visade "Inga tidrapporter" oavsett
                  löneform — meningslöst för en månadsanställd (ingen
                  timme-koncept alls för dem), vars faktiska problem är en
                  0 kr månadslön på anställningsposten, inte saknade
                  tidrapporter. Se payrollCalculation.js: Grundlön-formeln
                  för en månadsanställd är "monthlySalary × employmentRate%",
                  helt skild från timanställdas "hourlyRate × hoursWorked". */}
              <span>{isHourly ? tr('payrollUi.noHours') : tr('payrollUi.noSalary')}</span>
            </div>
          ) : (
            <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              {tr('payrollUi.rowSummary', { tax: fmt(computed.tax), net: fmt(computed.net) })}
            </div>
          )}
          {!computed.hasBankInfo && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <AlertTriangle size={12} color="var(--status-amber-text)" /> {tr('payrollUi.noBank')}
            </div>
          )}
        </div>
        <div className="payroll-emp-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Timmarna är det man fyller i varje månad för en timanställd:
              ett riktigt fält här, inte en liten ruta inne i texten. */}
          {isHourly && !locked && (
            <label className="payroll-emp-hours" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <input
                type="number" min="0" step="0.5" inputMode="decimal" placeholder="0" value={row.hoursWorked || ''}
                onChange={e => onUpdateRow(row.employeeId, { hoursWorked: e.target.value })}
                style={{ width: '76px', padding: '7px 9px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '14px', textAlign: 'right', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' }}
                aria-label={tr('payrollUi.hours')}
              />
              {tr('payrollUi.hoursShort')}
            </label>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(computed.gross)} {tr('ui.kr')}</div>
            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{tr('payrollUi.gross')}</div>
          </div>
          {expanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: flat ? '4px 24px 16px' : '4px 18px 16px', borderTop: '1px solid var(--border-light)' }}>
          {computed.steps.map((s, i) => <CalculationRow key={i} {...s} />)}
          <PayLinesEditor row={row} computed={computed} onUpdateRow={onUpdateRow} locked={locked} />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button
              onClick={(e) => { e.stopPropagation(); generatePayslipPdf(payslipArgs({ row, computed })).save(`lonebesked-${row.employeeSnapshot.lastName}-${row.period}.pdf`); }}
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

// En rad per anställd: brutto, skatt, netto och arbetsgivaravgift. Visas i
// Granska och i Klart, med ett lönebesked att ladda ner per person.
function EmployeeSummaryTable({ computedRows, onDownload }) {
  const th = { padding: '10px 16px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em', textAlign: 'right' };
  const td = { padding: '12px 16px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  return (
    <div style={{ ...panelCard, overflowX: 'auto', marginBottom: '20px' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
        <thead>
          <tr style={{ background: 'var(--bg-muted)' }}>
            <th style={{ ...th, textAlign: 'left' }}>{tr('payrollStages.employee')}</th>
            <th style={th}>{tr('payrollStages.gross')}</th>
            <th style={th}>{tr('payrollStages.tax')}</th>
            <th style={th}>{tr('payrollStages.net')}</th>
            <th style={th}>{tr('payrollStages.fee')}</th>
            {onDownload && <th style={th} />}
          </tr>
        </thead>
        <tbody>
          {computedRows.map(({ row, computed }) => (
            <tr key={row.employeeId} style={{ borderTop: '1px solid var(--border-light)' }}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 700, color: 'var(--text-main)' }}>{row.employeeSnapshot.firstName} {row.employeeSnapshot.lastName}</td>
              <td style={td}>{fmt(computed.gross)} {tr('ui.kr')}</td>
              <td style={td}>{fmt(computed.tax)} {tr('ui.kr')}</td>
              <td style={{ ...td, fontWeight: 700 }}>{fmt(computed.net)} {tr('ui.kr')}</td>
              <td style={td}>{fmt(computed.employerFee)} {tr('ui.kr')}</td>
              {onDownload && (
                <td style={td}>
                  <button type="button" onClick={() => onDownload({ row, computed })} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    <Download size={12} /> {tr('payrollStages.payslip')}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Lönebeskedet som det ser ut, för en anställd i taget (samma PDF som
// laddas ner och mejlas).
function PayslipPreview({ computedRows, payslipArgs }) {
  const [employeeId, setEmployeeId] = useState(computedRows[0]?.row.employeeId);
  const current = computedRows.find(r => r.row.employeeId === employeeId) || computedRows[0];
  const [url, setUrl] = useState(null);
  // Sidan ritas som en bild med pdf.js (samma som kvittoavläsningen), så att
  // förhandsvisningen fungerar i alla webbläsare, även i en iPhone där en
  // PDF i en ram inte visas. Öppna som PDF ger den riktiga filen.
  const [image, setImage] = useState(null);
  useEffect(() => {
    if (!current) return undefined;
    let made = null;
    let cancelled = false;
    setImage(null);
    try {
      const doc = generatePayslipPdf(payslipArgs(current));
      made = doc.output('bloburl');
      setUrl(String(made));
      const data = new Uint8Array(doc.output('arraybuffer'));
      (async () => {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          }
          const pdf = await pdfjsLib.getDocument({ data }).promise;
          const pdfPage = await pdf.getPage(1);
          const viewport = pdfPage.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          if (!cancelled) setImage(canvas.toDataURL('image/png'));
        } catch { /* visas då via länken Öppna som PDF */ }
      })();
    } catch { setUrl(null); }
    return () => { cancelled = true; if (made) URL.revokeObjectURL(String(made)); };
  }, [current?.row.employeeId, current?.computed.net]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!current) return null;
  return (
    <div style={{ ...panelCard, marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '14px 18px', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>{tr('payrollStages.previewTitle')}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {computedRows.length > 1 && (
            <select value={current.row.employeeId} onChange={e => setEmployeeId(e.target.value)} aria-label={tr('payrollStages.employee')} style={{ padding: '7px 10px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', background: 'var(--bg-card)', color: 'var(--text-main)', fontFamily: 'inherit' }}>
              {computedRows.map(r => <option key={r.row.employeeId} value={r.row.employeeId}>{r.row.employeeSnapshot.firstName} {r.row.employeeSnapshot.lastName}</option>)}
            </select>
          )}
          {url && <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{tr('payrollStages.openPdf')}</a>}
        </div>
      </div>
      {image ? (
        <div style={{ padding: '18px', background: 'var(--bg-muted)', display: 'flex', justifyContent: 'center' }}>
          <img src={image} alt={tr('payrollStages.previewTitle')} style={{ display: 'block', width: '100%', maxWidth: '760px', height: 'auto', borderRadius: '6px', boxShadow: '0 8px 24px rgba(15,23,42,0.18)', background: 'white' }} />
        </div>
      ) : url ? (
        <div style={{ padding: '18px', fontSize: '13px', color: 'var(--text-secondary)' }}>{tr('payrollStages.previewLoading')}</div>
      ) : (
        <div style={{ padding: '18px', fontSize: '13px', color: 'var(--text-secondary)' }}>{tr('payrollStages.previewMissing')}</div>
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

export default function PayrollRunDetail({ run, previousRun, allRuns = [], onSyncBeforeServerCall, accounts, company, onBack, onAdvanceStep, onBookRun, onMarkPaid, onUpdateRow, onRefreshSnapshots }) {
  const [agiConfirmed, setAgiConfirmed] = useState(run.completedSteps.includes('agi'));
  // Timmar från fil (utils/payrollHoursImport.js), i stället för en rad i taget.
  const hoursFileRef = useRef(null);
  const [hoursResult, setHoursResult] = useState(null);
  const handleHoursFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const r = parsePayrollHours(String(ev.target.result || ''), run.rows);
      if (!r.missingColumns.length) r.updates.forEach(u => onUpdateRow(u.employeeId, { hoursWorked: u.hours }));
      setHoursResult(r);
    };
    reader.readAsText(f, 'utf-8');
  };
  const [agiFileProblems, setAgiFileProblems] = useState(null); // { errors, warnings } från senaste filförsöket
  const [showBankGuide, setShowBankGuide] = useState(false);
  // Kundfeedback ("man ska kunna göra manuellt om man vill"): Betala-steget
  // gick tidigare BARA att slutföra via en pil-knapp i sidhuvudet som blint
  // antog 'bank' — ingen riktig knapp fanns i Betalningsmetod-panelen alls,
  // och inget alternativ för den som betalat på annat sätt (Swish, kontant,
  // en separat överföring). showManualPay slår bara på/av den mindre synliga
  // "annat sätt"-sektionen, döljs by default så Bank förblir förstahandsvalet.
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

  // ── Lönebesked till alla (se panelen längre ner) ──
  const [mailState, setMailState] = useState({ busy: false, done: 0, total: 0, result: null });
  const withEmail = computedRows.filter(r => String(r.row.employeeSnapshot?.email || '').includes('@'));
  const withoutEmail = computedRows.filter(r => !String(r.row.employeeSnapshot?.email || '').includes('@'));
  const sentCount = run.rows.filter(r => r.payslipSentAt).length;
  const payslipArgs = ({ row, computed }) => ({
    employee: row.employeeSnapshot, computed, period: row.period || run.period, company, payDate: run.payDate,
    ytd: yearToDate({
      employeeId: row.employeeId, period: run.period, runs: allRuns, current: computed,
      computeRow: (r) => computeEmployeePayroll(r.employeeSnapshot, r),
    }),
  });
  const handleDownloadAllPayslips = () => {
    generateAllPayslipsPdf(computedRows.map(payslipArgs)).save(`lonebesked-${run.period}.pdf`);
  };
  const handleEmailPayslips = async () => {
    if (withEmail.length === 0) return;
    // Mottagaren slås upp på servern ur den sparade anställda, så det som
    // står på skärmen måste vara sparat först.
    try { await onSyncBeforeServerCall?.(); } catch { /* skickar ändå, servern säger till om e-post saknas */ }
    setMailState({ busy: true, done: 0, total: withEmail.length, result: null });
    let sent = 0;
    const failed = [];
    for (const r of withEmail) {
      const name = `${r.row.employeeSnapshot.firstName} ${r.row.employeeSnapshot.lastName}`;
      try {
        const base64 = generatePayslipPdf(payslipArgs(r)).output('datauristring').split(',')[1];
        await sendPayslipEmail({ companyId: company?.id, employeeId: r.row.employeeId, period: run.period, attachmentBase64: base64 });
        onUpdateRow(r.row.employeeId, { payslipSentAt: new Date().toISOString() });
        sent++;
      } catch (err) {
        failed.push(`${name}: ${err.message}`);
      }
      setMailState(s => ({ ...s, done: s.done + 1 }));
    }
    setMailState({ busy: false, done: 0, total: 0, result: { sent, failed } });
  };

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

  // Steget som visas: först det första som inte är klart, sedan det man
  // klickar på i stegraden. Efter en åtgärd går vyn vidare till nästa steg.
  const firstOpenStage = RUN_STAGES.find(id => id !== 'done' && !run.completedSteps.includes(id)) || 'done';
  const [stage, setStage] = useState(firstOpenStage);
  useEffect(() => { setStage(firstOpenStage); }, [run.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextStage = (id) => RUN_STAGES[RUN_STAGES.indexOf(id) + 1] || 'done';
  const prevStage = (id) => RUN_STAGES[RUN_STAGES.indexOf(id) - 1];
  const markPaid = (method) => { onMarkPaid(run.id, method); setStage('payslips'); };
  const [payMethodChoice, setPayMethodChoice] = useState(null);
  const payMethod = payMethodChoice || (!debtorAccountError && missingIbanInfo.length === 0 ? 'bank' : 'manual');

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
    setStage(nextStage(stepId));
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
        <StageNav stage={stage} completedSteps={run.completedSteps} onOpen={setStage} />
      </ListPageHeader>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div className="payroll-stage-head" style={{ padding: '18px 24px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-main)' }}>{tr(`payrollStages.${stage}Title`)}</h2>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.55, maxWidth: '760px' }}>{tr(`payrollStages.${stage}Text`, { period: run.period })}</p>
      {stage === 'calculated' && missingTaxTable.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-red-bg)', border: '1px solid var(--status-red-bg)', borderRadius: '8px', padding: '12px 14px', margin: '14px 0 0', fontSize: '13px', color: 'var(--status-red-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div>
              {missingTaxTable.length === 1 ? tr('ui.en_anstalld_saknar') : tr('ui.anstallda_saknar_2', { length: missingTaxTable.length })} {tr('ui.skattetabell_3')}{missingTaxTable.map(r => `${r.employeeSnapshot?.firstName || ''} ${r.employeeSnapshot?.lastName || ''}`.trim()).join(', ')}{tr('ui.skatteavdraget_visas_som_0_kr_tills_detta_atgard')} {tr('fos.runHint')}
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

      {(stage === 'calculated' || stage === 'paid') && missingBankInfo.length > 0 && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '10px', padding: '10px 14px', margin: '14px 0 0', fontSize: '13px', color: 'var(--status-amber-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{missingBankInfo.length} {missingBankInfo.length === 1 ? tr('ui.anstalld_saknar') : tr('ui.anstallda_saknar')} {tr('ui.clearing_kontonummer_och_kommer_inte_att_inklude')}</span>
        </div>
      )}

      {stage === 'calculated' && tablesError && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', background: 'var(--status-amber-bg)', border: '1px solid var(--status-amber-bg)', borderRadius: '8px', padding: '12px 14px', margin: '14px 0 0', fontSize: '13px', color: 'var(--status-amber-text)' }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{tr('ui.kunde_inte_hamta_skattetabellen_fran_skatteverke')}{tablesError}{tr('ui.skatteavdrag_kan_inte_beraknas_korrekt_forran_de')}</span>
        </div>
      )}

      {(stage === 'calculated' || stage === 'approved' || stage === 'done') && <SummaryCards totals={totals} flat />}
      {stage === 'calculated' && (<>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', margin: '22px 0 12px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>{tr('ui.anstallda_i_korningen')}</h3>
        {!run.completedSteps.includes('booked') && (
          <button type="button" onClick={() => hoursFileRef.current?.click()} title={tr('payrollHours.title')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <Upload size={14} /> {tr('payrollHours.button')}
          </button>
        )}
        <input type="file" ref={hoursFileRef} accept=".csv,text/csv,.txt" style={{ display: 'none' }} onChange={handleHoursFile} />
      </div>
      {hoursResult && (
        <div style={{ background: hoursResult.missingColumns.length || hoursResult.unmatched.length || hoursResult.errors.length ? 'var(--status-amber-bg)' : 'var(--status-green-bg)', color: hoursResult.missingColumns.length || hoursResult.unmatched.length || hoursResult.errors.length ? 'var(--status-amber-text)' : 'var(--status-green-text)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', lineHeight: 1.55 }}>
          {hoursResult.missingColumns.length > 0 ? tr('payrollHours.missing', { cols: hoursResult.missingColumns.join(', ') }) : (
            <>
              <div>{tr('payrollHours.done', { n: hoursResult.updates.length, hours: hoursResult.updates.reduce((s, u) => s + u.hours, 0).toLocaleString('sv-SE') })}</div>
              {hoursResult.updates.some(u => !u.hourly) && <div>{tr('payrollHours.monthly', { names: hoursResult.updates.filter(u => !u.hourly).map(u => u.name).join(', ') })}</div>}
              {hoursResult.unmatched.length > 0 && <div>{tr('payrollHours.unmatched', { list: hoursResult.unmatched.map(u => `${tr('payrollHours.row', { line: u.line })} ${u.name || u.ssn}`).join(', ') })}</div>}
              {hoursResult.errors.length > 0 && <div>{tr('payrollHours.bad', { list: hoursResult.errors.map(e => tr('payrollHours.row', { line: e.line })).join(', ') })}</div>}
            </>
          )}
        </div>
      )}
      <div style={{ margin: '0 -24px -18px', borderTop: '1px solid var(--border-light)' }}>
      {computedRows.map(({ row, computed }) => (
        <EmployeeRow flat
          key={row.employeeId} row={row} computed={computed}
          previousComputed={previousComputedByEmployee[row.employeeId]}
          accounts={accounts} onUpdateRow={onUpdateRow} payslipArgs={payslipArgs}
          locked={run.completedSteps.includes('booked')}
        />
      ))}
      </div>
      </>)}
      </div>
      <div className="payroll-stage-body" style={{ padding: stage === 'calculated' ? 0 : '20px 24px', flex: 1 }}>
      {(stage === 'approved' || stage === 'done') && (
        <EmployeeSummaryTable computedRows={computedRows} onDownload={stage === 'done' ? (r) => generatePayslipPdf(payslipArgs(r)).save(`lonebesked-${r.row.employeeSnapshot.lastName}-${run.period}.pdf`) : null} />
      )}


      {stage === 'booked' && (
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px' }}>{tr('ui.forhandsgranskning_verifikationer')}</h3>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '0 0 16px' }}>{tr('ui.genereras_och_bokfors_som_tre_separata_verifikat')}</p>
          <VerificationBlock title={tr('ui.block_1_lon')} rows={verBlocks.block1} accounts={accounts} />
          <VerificationBlock title={tr('ui.block_2_arbetsgivaravgifter')} rows={verBlocks.block2} accounts={accounts} />
          <VerificationBlock title={tr('ui.block_3_semesteravsattning')} rows={verBlocks.block3} accounts={accounts} />
        </div>
      )}

      {stage === 'paid' && (
        <div>
          {run.completedSteps.includes('paid') ? (
            <div style={{ ...panelCard, padding: '20px', display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
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
          ) : null}

          {/* Vem får vad: beloppet och kontot per anställd, det man behöver
              för att betala själv i internetbanken. */}
          <div style={{ ...panelCard, overflowX: 'auto', marginBottom: '20px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-muted)' }}>
                  {[[tr('payrollStages.employee'), 'left'], [tr('payPanel.amount'), 'right'], [tr('payPanel.account'), 'left']].map(([h, align]) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: align, fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {computedRows.map(({ row, computed }) => {
                  const e = row.employeeSnapshot;
                  const account = computed.iban ? computed.iban : (e.clearingNumber && e.accountNumber ? `${e.clearingNumber}-${e.accountNumber}` : '');
                  return (
                    <tr key={row.employeeId} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--text-main)' }}>{e.firstName} {e.lastName}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(computed.net)} {tr('ui.kr')}</td>
                      <td style={{ padding: '12px 16px', color: account ? 'var(--text-secondary)' : 'var(--status-amber-text)', fontVariantNumeric: 'tabular-nums' }}>
                        {account || tr('payPanel.noAccount')}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-muted)' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 700 }}>{tr('ui.summa')}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(totals.net)} {tr('ui.kr')}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{tr('payPanel.payDate', { date: run.payDate || '—' })}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {!run.completedSteps.includes('paid') && (
            <>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 10px' }}>{tr('payPanel.howTitle')}</h3>
              <div className="filter-pills" role="radiogroup" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {[['manual', tr('payPanel.manual')], ['bank', tr('payPanel.file')]].map(([id, label]) => (
                  <button key={id} type="button" role="radio" aria-checked={payMethod === id} className={'filter-pill' + (payMethod === id ? ' active' : '')} onClick={() => setPayMethodChoice(id)}>{label}</button>
                ))}
              </div>

              {payMethod === 'manual' ? (
                <div style={{ ...panelCard, padding: '18px 20px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  {tr('payPanel.manualText')}
                </div>
              ) : (
                <div style={{ ...panelCard, padding: '18px 20px' }}>
                  {/* Det som måste vara på plats för en betalfil, som en lista. */}
                  {[
                    [!debtorAccountError, debtorAccountError ? tr('payPanel.companyIbanMissing') : tr('payPanel.companyIbanOk')],
                    [missingIbanInfo.length === 0, missingIbanInfo.length === 0
                      ? tr('payPanel.allIban')
                      : tr('payPanel.someIban', { n: computedRows.length - missingIbanInfo.length, total: computedRows.length, names: missingIbanInfo.map(r => `${r.row.employeeSnapshot?.firstName || ''} ${r.row.employeeSnapshot?.lastName || ''}`.trim()).join(', ') })],
                  ].map(([ok, text], i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', color: ok ? 'var(--text-main)' : 'var(--status-amber-text)', marginBottom: '8px' }}>
                      {ok ? <Check size={16} color="var(--status-green-text)" style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />}
                      <span>{text}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: '12.5px', color: 'var(--text-secondary)', margin: '6px 0 14px', lineHeight: 1.55 }}>{tr('payPanel.fileNote')}</p>
                  {payFileError && <div style={{ fontSize: '12.5px', color: 'var(--status-red-text)', marginBottom: '12px' }}>{payFileError}</div>}
                  {payFileResult && (
                    <div style={{ fontSize: '12.5px', color: 'var(--status-green-text)', marginBottom: '12px', fontWeight: 600 }}>
                      {tr('ui.betalfil_nedladdad')} {payFileResult.eligible} {payFileResult.eligible === 1 ? tr('ui.anstalld_2') : tr('ui.anstallda_2')} {tr('ui.inkluderade')}
                      {payFileResult.excluded.length > 0 ? tr('ui.exkluderade_saknar_iban_bic', { length: payFileResult.excluded.length }) : '.'}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(() => {
                      const blocked = payFileBusy || Boolean(debtorAccountError) || missingIbanInfo.length === computedRows.length;
                      return (
                        <button onClick={handleDownloadPayFile} disabled={blocked} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 700, border: 'none', background: blocked ? 'var(--border)' : 'var(--accent)', color: blocked ? 'var(--text-muted)' : 'white', cursor: blocked ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                          <Download size={15} /> {payFileBusy ? tr('ui.skapar_fil') : tr('ui.ladda_ner_betalfil')}
                        </button>
                      );
                    })()}
                    <button type="button" onClick={() => setShowBankGuide(v => !v)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {tr('ui.sa_importerar_du_filen_i_din_bank')} {showBankGuide ? <ChevronUp size={13} style={{ verticalAlign: 'middle' }} /> : <ChevronDown size={13} style={{ verticalAlign: 'middle' }} />}
                    </button>
                  </div>
                  {showBankGuide && (
                    <div style={{ marginTop: '12px', padding: '14px', background: 'var(--bg-muted)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                      {tr('ui.i_de_flesta_internetbanker_logga_in_pa_foretaget')}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Lönebesked till alla på en gång: en PDF med alla (att skriva ut eller
          arkivera) eller ett mejl per anställd med sitt eget lönebesked.
          Med många timanställda är en knapp per person inte hållbart. */}
      {stage === 'payslips' && computedRows.length > 0 && (
        <PayslipPreview computedRows={computedRows} payslipArgs={payslipArgs} />
      )}
      {(stage === 'payslips' || stage === 'done') && computedRows.length > 0 && (
        <div style={{ ...panelCard, marginBottom: '20px', padding: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>{tr('payslips.title')}</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
            {tr('payslips.intro', { n: computedRows.length, withEmail: withEmail.length, sent: sentCount })}
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" onClick={handleDownloadAllPayslips} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <Download size={14} /> {tr('payslips.downloadAll')}
            </button>
            <button type="button" onClick={handleEmailPayslips} disabled={withEmail.length === 0 || mailState.busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: withEmail.length === 0 || mailState.busy ? 'var(--gray-300)' : BRAND.green, border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: 'white', cursor: withEmail.length === 0 || mailState.busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
              <Send size={14} /> {mailState.busy ? tr('payslips.sending', { done: mailState.done, total: mailState.total }) : tr('payslips.emailAll', { n: withEmail.length })}
            </button>
          </div>
          {withoutEmail.length > 0 && (
            <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>
              {tr('payslips.noEmail', { names: withoutEmail.map(r => `${r.row.employeeSnapshot.firstName} ${r.row.employeeSnapshot.lastName}`).join(', ') })}
            </div>
          )}
          {mailState.result && (
            <div style={{ marginTop: '12px', fontSize: '12.5px', color: mailState.result.failed.length ? 'var(--status-red-text)' : 'var(--status-green-text)' }}>
              {tr('payslips.result', { sent: mailState.result.sent })}
              {mailState.result.failed.length > 0 && ` ${tr('payslips.failed', { list: mailState.result.failed.join('; ') })}`}
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
      {(stage === 'agi' || stage === 'done') && run.completedSteps.includes('booked') && (
        <div style={{ ...panelCard, marginBottom: '20px', padding: '20px' }}>
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
            <input type="checkbox" checked={agiConfirmed} onChange={e => { setAgiConfirmed(e.target.checked); if (e.target.checked) { onAdvanceStep(run.id, 'agi'); setStage('done'); } }} disabled={run.completedSteps.includes('agi')} />
            {tr('ui.jag_har_lamnat_in_arbetsgivardeklarationen_agi_h')}
          </label>
        </div>
      )}
      </div>
      <div className="payroll-stage-footer" style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 24px', background: 'var(--bg-card)', borderTop: '1px solid var(--border)' }}>
        <div>
          {prevStage(stage) && (
            <button type="button" onClick={() => setStage(prevStage(stage))} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', fontFamily: 'inherit' }}>
              <ChevronLeft size={14} /> {tr('payrollStages.back')}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {(() => {
            const done = stage === 'done' || run.completedSteps.includes(stage);
            const primary = (label, onClick, disabled = false) => (
              <button type="button" onClick={onClick} disabled={disabled} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '10px 20px', background: disabled ? 'var(--gray-300)' : BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {label}
              </button>
            );
            const note = (text) => <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>{text}</span>;
            if (stage === 'done') return primary(tr('ui.tillbaka_till_lonekorningar'), onBack);
            if (done) return primary(`${tr('payrollStages.next')} →`, () => setStage(nextStage(stage)));
            switch (stage) {
              case 'calculated': return primary(tr('payrollStages.calculatedAction'), () => handleAdvance('calculated'));
              case 'approved': return (<>{totals.gross <= 0 && note(tr('payrollUi.nothingToPay'))}{primary(tr('payrollStages.approvedAction'), () => handleAdvance('approved'), totals.gross <= 0)}</>);
              case 'paid': return primary(tr('ui.markera_som_betald'), () => markPaid(payMethod));
              case 'payslips': return primary(tr('payrollStages.payslipsAction'), () => handleAdvance('payslips'));
              case 'booked': return (<>{!canBook && note(tr('payrollStages.bookedNeedsPaid'))}{primary(tr('payrollStages.bookedAction'), () => handleAdvance('booked'), !canBook)}</>);
              case 'agi': return note(tr('payrollStages.agiHint'));
              default: return null;
            }
          })()}
        </div>
      </div>
      </div>
    </div>
  );
}
