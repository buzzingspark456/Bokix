import React, { useMemo } from 'react';
import { Info, AlertTriangle, Palmtree } from 'lucide-react';
import ListTable from './shared/ListTable';
import { summarizeVacationLiability, VACATION_MODEL_NOTES } from '../utils/vacation';
import { EMPLOYER_FEE_CATEGORIES } from '../utils/payrollConfig';

// Semesteröversikten. Fram till nu kunde lönemodulen räkna fram
// semesterskulden i KRONOR (12 % av bruttolönen varje månad, bokfört mot
// 2920) men aldrig svara på frågan alla faktiskt ställer: hur många dagar
// har jag kvar? Det är den vyn.
//
// Allt här är härlett, ingenting är en sparad siffra som kan bli inaktuell:
// intjänandet räknas ur anställningsdatum och semesterår, uttaget ur
// lönekörningarnas semesterarter, och dagvärdet ur den anställdas
// semesterregel. Se utils/vacation.js för paragraferna bakom varje steg.

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(Math.round(v || 0));
const panelCard = { background: 'var(--bg-card)', borderRadius: '14px', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)' };

function SummaryCard({ label, value, unit, tone }) {
  return (
    <div style={{ ...panelCard, padding: '18px 20px', flex: '1 1 190px', minWidth: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: tone || 'var(--text-main)', letterSpacing: '-0.02em' }}>
        {value}{unit && <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '5px' }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function VacationOverview({ employees = [], payrollRuns = [], onSelectEmployee }) {
  // Avgiftssatsen som skulden ska bära: samma standardsats lönekörningen
  // själv använder, inte en egen kopia.
  const feeRate = EMPLOYER_FEE_CATEGORIES.anstalld.rate;
  const summary = useMemo(
    () => summarizeVacationLiability({ employees, payrollRuns, feeRate }),
    [employees, payrollRuns, feeRate]
  );

  if (!employees.length) {
    return (
      <div style={{ flex: 1, minHeight: '280px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', margin: '24px', padding: '48px 24px', ...panelCard }}>
        <div style={{ width: 72, height: 72, borderRadius: '20px', background: 'var(--border-light)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
          <Palmtree size={30} />
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>Inga anställda att räkna semester för</div>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '340px', margin: 0 }}>
          Lägg till en anställd, så räknas intjänade och uttagna semesterdagar fram automatiskt.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
          Semesteråret {summary.vacationYear.label}
        </div>
        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
          1 april {summary.vacationYear.start.getFullYear()} – 31 mars {summary.vacationYear.end.getFullYear()}. Intjänandeåret är de tolv månaderna dessförinnan.
        </div>
      </div>

      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        <SummaryCard label="Kvarvarande dagar" value={fmt(summary.totalDays)} unit="dagar" />
        <SummaryCard label="Semesterskuld" value={fmt(summary.totalLiability)} unit="kr" />
        <SummaryCard label="Sociala avgifter på skulden" value={fmt(summary.totalLiabilityFee)} unit="kr" />
        <SummaryCard label="Att stämma av mot 2920 + 2940" value={fmt(summary.totalLiability + summary.totalLiabilityFee)} unit="kr" tone="var(--accent)" />
      </div>

      <div style={panelCard}>
        <ListTable
          rowKey={r => r.employee.id}
          onRowClick={onSelectEmployee ? (r => onSelectEmployee(r.employee)) : undefined}
          rows={summary.rows}
          columns={[
            {
              key: 'name', label: 'Anställd', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px',
              render: r => `${r.employee.firstName} ${r.employee.lastName}`,
            },
            {
              key: 'rule', label: 'Regel',
              render: r => (r.rule === 'sammaloneregeln' ? 'Sammalöneregeln' : r.rule === 'procentregeln' ? 'Procentregeln' : '—'),
            },
            { key: 'earned', label: 'Intjänat', align: 'right', render: r => `${fmt(r.earned)} d` },
            { key: 'taken', label: 'Uttaget', align: 'right', render: r => `${fmt(r.taken)} d` },
            {
              key: 'remaining', label: 'Kvar', align: 'right', fontWeight: 700, color: 'var(--text-main)',
              render: r => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  {r.overEntitlement && (
                    <AlertTriangle size={13} color="var(--status-amber-text)" aria-label="Fler uttagna dagar än intjänade" />
                  )}
                  {fmt(r.remaining)} d
                </span>
              ),
            },
            { key: 'saved', label: 'Sparade', align: 'right', render: r => (r.saved ? `${fmt(r.saved)} d` : '—') },
            {
              key: 'perDay', label: 'Per dag', align: 'right',
              render: r => (r.payPerDay ? `${fmt(r.payPerDay)} kr` : '—'),
            },
            {
              key: 'liability', label: 'Skuld inkl. avgifter', align: 'right', fontWeight: 600, color: 'var(--text-main)',
              render: r => `${fmt(r.liabilityTotal)} kr`,
            },
          ]}
        />
      </div>

      {/* Modellens gränser skrivs ut. En semesterberäkning som ser exakt ut
          men bygger på förenklingar är farligare än en som säger var den
          slutar gälla — särskilt vid sjukfrånvaro, där lagen ger fortsatt
          intjänande men modellen inte gör det. */}
      <div style={{ ...panelCard, padding: '18px 20px', background: 'var(--bg-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <Info size={15} color="var(--text-secondary)" />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Så räknas det, och var modellen slutar</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Intjänade dagar: anställningstid under intjänandeåret delat med 365, gånger antalet semesterdagar, avrundat uppåt (semesterlagen § 7).
          </li>
          <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Dagvärde: sammalöneregeln ger semestertillägg 0,43 % av månadslönen per dag (§ 16 a), procentregeln 0,48 % av intjänandeårets lön per dag (§ 16 b).
          </li>
          {VACATION_MODEL_NOTES.map(note => (
            <li key={note} style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
