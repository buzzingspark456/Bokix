import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Loader2 } from './icons';
import { computeEmployeePayroll } from '../utils/payrollCalculation';
import { preloadSkattetabell } from '../utils/skattetabell';
import { downloadAgiPdf } from '../utils/agiExport';
import { downloadAgiXml } from '../utils/agiXml';
import { AGI_XML_ENABLED } from '../utils/featureFlags';
import { dueDayForMonth, rollForwardPastWeekend } from '../utils/declarationDeadlines';
import { t as tr } from '../i18n';

// Skatteverkets sida för att lämna arbetsgivardeklarationen (e-tjänsten med
// "Deklarera via fil" och "Deklarera noll").
export const SKV_AGI_URL = 'https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration.4.41f1c61d16193087d7fcaeb.html';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(Math.round(v || 0));

/** Sista dag att lämna och betala: den 12:e månaden efter (17:e i januari och augusti). */
function agiDueDate(period) {
  const [y, m] = period.split('-').map(Number);
  const due = new Date(y, m, 1); // månaden efter (m är 1-indexerad)
  due.setDate(dueDayForMonth(due.getMonth()));
  rollForwardPastWeekend(due);
  return due.toLocaleDateString('sv-SE');
}

// En månads arbetsgivardeklaration i detalj: huvuduppgiften (summorna för
// företaget) och en individuppgift per anställd, som i Skatteverkets
// e-tjänst. Med filen att ladda upp, en PDF och en länk dit den lämnas.
export default function AgiReportDetails({ report, run, company }) {
  const rows = run?.rows || [];
  const [tablesReady, setTablesReady] = useState(rows.length === 0);
  useEffect(() => {
    const needed = [...new Set(rows
      .filter(r => !r.employeeSnapshot?.secondaryIncome && r.employeeSnapshot?.taxTable?.tabellnr)
      .map(r => `${r.employeeSnapshot.taxTable.year}:${r.employeeSnapshot.taxTable.tabellnr}`))];
    let cancelled = false;
    Promise.all(needed.map(key => { const [year, nr] = key.split(':'); return preloadSkattetabell(year, nr); }))
      .catch(() => {})
      .finally(() => { if (!cancelled) setTablesReady(true); });
    return () => { cancelled = true; };
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const computedRows = useMemo(
    () => (tablesReady ? rows.map(row => ({ row, computed: computeEmployeePayroll(row.employeeSnapshot, row) })) : []),
    [tablesReady, rows],
  );
  const [problems, setProblems] = useState(null);
  const totals = report.totals || { gross: 0, tax: 0, employerFee: 0 };
  const toPay = (totals.tax || 0) + (totals.employerFee || 0);

  const cell = { padding: '9px 12px', fontSize: '13px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' };
  const head = { ...cell, fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' };
  const btn = { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', textDecoration: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ padding: '14px 16px 16px', borderTop: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
      {/* Huvuduppgift: det företaget redovisar och betalar för månaden. */}
      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>{tr('agiDetails.mainTitle')}</div>
      <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '8px', marginBottom: '16px' }}>
        {[
          [tr('agiDetails.gross'), totals.gross],
          [tr('agiDetails.fee'), totals.employerFee],
          [tr('agiDetails.tax'), totals.tax],
          [tr('agiDetails.toPay'), toPay],
        ].map(([label, value], i) => (
          <div key={label} style={{ padding: '10px 12px', borderRadius: '8px', background: i === 3 ? 'var(--status-green-bg)' : 'var(--bg-muted)' }}>
            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>{label}</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', fontVariantNumeric: 'tabular-nums' }}>{fmt(value)} {tr('ui.kr')}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        {tr('agiDetails.due', { date: agiDueDate(report.period) })}
      </div>

      {/* Individuppgifter: en per anställd. */}
      {report.isZero ? (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.55 }}>{tr('agiDetails.zero')}</div>
      ) : (
        <>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '8px' }}>{tr('agiDetails.individualTitle')}</div>
          {!tablesReady ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> {tr('ui.laser_in_skattetabeller')}
            </div>
          ) : (
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflowX: 'auto', marginBottom: '16px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-muted)' }}>
                    <th style={{ ...head, textAlign: 'left' }}>{tr('agiDetails.name')}</th>
                    <th style={{ ...head, textAlign: 'left' }}>{tr('agiDetails.ssn')}</th>
                    <th style={head}>{tr('agiDetails.grossShort')}</th>
                    <th style={head}>{tr('agiDetails.taxShort')}</th>
                    <th style={head}>{tr('agiDetails.feeShort')}</th>
                  </tr>
                </thead>
                <tbody>
                  {computedRows.map(({ row, computed }) => (
                    <tr key={row.employeeId} style={{ borderTop: '1px solid var(--border-light)' }}>
                      <td style={{ ...cell, textAlign: 'left', fontWeight: 700, color: 'var(--text-main)' }}>{row.employeeSnapshot.firstName} {row.employeeSnapshot.lastName}</td>
                      <td style={{ ...cell, textAlign: 'left', color: 'var(--text-secondary)' }}>{row.employeeSnapshot.ssn || '—'}</td>
                      <td style={cell}>{fmt(computed.gross)}</td>
                      <td style={cell}>{fmt(computed.tax)}</td>
                      <td style={cell}>{fmt(computed.employerFee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Ladda ner och lämna. */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {AGI_XML_ENABLED && !report.isZero && run && (
          <button
            type="button"
            disabled={!tablesReady}
            onClick={() => {
              const result = downloadAgiXml({ company, period: report.period, computedRows }, `agi-${report.period}.xml`);
              setProblems({ errors: result.errors || [], warnings: result.warnings || [] });
            }}
            style={{ ...btn, background: 'var(--accent)', color: 'white', border: 'none' }}
          >
            <Download size={14} /> {tr('agiDetails.xml')}
          </button>
        )}
        <button
          type="button"
          disabled={!tablesReady}
          onClick={() => downloadAgiPdf({ company, period: report.period, computedRows, totals }, `agi-${report.period}.pdf`)}
          style={btn}
        >
          <Download size={14} /> {tr('agiDetails.pdf')}
        </button>
        <a href={SKV_AGI_URL} target="_blank" rel="noopener noreferrer" style={btn}>
          {tr('agiDetails.submitAt')} <ExternalLink size={13} />
        </a>
      </div>
      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
        {report.isZero ? tr('agiDetails.howZero') : tr('agiDetails.how')}
      </div>
      {problems && problems.errors.length > 0 && (
        <div role="alert" style={{ marginTop: '10px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px' }}>
          <div style={{ fontWeight: 700, marginBottom: '4px' }}>{tr('ui.filen_kunde_inte_skapas_an')}</div>
          <ul style={{ margin: 0, paddingLeft: '18px' }}>{problems.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      {problems && problems.errors.length === 0 && problems.warnings.length > 0 && (
        <ul style={{ margin: '10px 0 0', paddingLeft: '18px', fontSize: '12.5px', color: 'var(--status-amber-text)' }}>{problems.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
      )}
    </div>
  );
}
