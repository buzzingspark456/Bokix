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

// Kundfeedback: "semesterdelen under Anställda och lön — jag förstår inte
// vad det är, kan du göra den enklare?" Siffrorna var rätt, men varje kort
// och kolumn hette något ur bokföringens språk ("Semesterskuld", "Att stämma
// av mot 2920 + 2940") utan att någonstans säga vad talet BETYDER för den
// som driver företaget. Därför: en förklarande underrad på varje kort, en
// mening högst upp om vad sidan är, och en förklaring på varje kolumnrubrik
// (ListTable `help`). Inga siffror är ändrade — bara vad de kallas.
function SummaryCard({ label, value, unit, hint, tone }) {
  return (
    <div style={{ ...panelCard, padding: '16px 18px', flex: '1 1 210px', minWidth: 0 }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: tone || 'var(--text-main)', letterSpacing: '-0.02em' }}>
        {value}{unit && <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '5px' }}>{unit}</span>}
      </div>
      {hint && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.5 }}>{hint}</div>}
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
    <div style={{ padding: 'clamp(14px, 3vw, 24px) clamp(14px, 3vw, 24px) 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
          Semesteråret {summary.vacationYear.label}
        </div>
        {/* Kort ingress (var sju rader på en telefon innan — man fick skrolla
            förbi en textvägg för att komma till siffrorna). Detaljerna om
            semesterår/intjänandeår står kvar, men i faktarutan längst ner
            där resten av regelverket redan förklaras. */}
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: '720px' }}>
          Intjänade och uttagna semesterdagar per anställd, och vad de dagar som är kvar kostar när de tas ut.
          Räknas fram automatiskt — du fyller inte i något här.
        </p>
      </div>

      {/* Två kort i stället för fyra. De tre penningkorten sa i praktiken
          samma sak i tre steg (semesterlön, avgift, summa) och tog hela
          skärmen på en telefon; nu bär totalen uppdelningen som en rad under
          sig. `auto-fit` gör att de ligger sida vid sida även på en telefon
          i stället för två fullbreda block staplade på varandra. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: '14px' }}>
        <SummaryCard
          label="Dagar kvar att ta ut"
          value={fmt(summary.totalDays)}
          unit="dagar"
          hint="Intjänade minus redan uttagna dagar, alla anställda ihop."
        />
        <SummaryCard
          label="Vad de dagarna kostar"
          value={fmt(summary.totalLiability + summary.totalLiabilityFee)}
          unit="kr"
          tone="var(--accent-text)"
          hint={`Semesterlön ${fmt(summary.totalLiability)} kr + arbetsgivaravgift ${fmt(summary.totalLiabilityFee)} kr. Ska stämma mot konto 2920 + 2940 i balansräkningen.`}
        />
      </div>

      <div style={panelCard}>
        <ListTable
          rowKey={r => r.employee.id}
          onRowClick={onSelectEmployee ? (r => onSelectEmployee(r.employee)) : undefined}
          rows={summary.rows}
          // Åtta kolumner får aldrig plats på en telefon. Den kompakta
          // listraden (samma som Verifikationer/Bank) bär det man faktiskt
          // vill veta i mobilen: vem, hur många dagar kvar, och vad de
          // kostar — resten finns kvar i tabellen på en större skärm.
          mobileList={r => ({
            dot: r.overEntitlement ? 'var(--status-amber-text)' : 'var(--status-green-text)',
            primary: `${r.employee.firstName} ${r.employee.lastName}`,
            amount: `${fmt(r.remaining)} d kvar`,
            meta: `Intjänat ${fmt(r.earned)} d · uttaget ${fmt(r.taken)} d${r.saved ? ` · sparade ${fmt(r.saved)} d` : ''}`,
            meta2: `Kostar ${fmt(r.liabilityTotal)} kr när de tas ut${r.payPerDay ? ` · ${fmt(r.payPerDay)} kr per dag` : ''}`,
          })}
          columns={[
            {
              key: 'name', label: 'Anställd', fontWeight: 600, color: 'var(--text-main)', fontSize: '14px',
              render: r => `${r.employee.firstName} ${r.employee.lastName}`,
            },
            {
              key: 'rule', label: 'Regel',
              help: 'Hur semesterlönen räknas för den anställda. Sammalöneregeln: månadslönen plus ett tillägg per dag — normalt för fast månadslön. Procentregeln: en andel av föregående års lön — normalt för timlön eller rörlig lön.',
              render: r => (r.rule === 'sammaloneregeln' ? 'Sammalöneregeln' : r.rule === 'procentregeln' ? 'Procentregeln' : '—'),
            },
            { key: 'earned', label: 'Intjänat', align: 'right', help: 'Semesterdagar den anställda har tjänat ihop under intjänandeåret.', render: r => `${fmt(r.earned)} d` },
            { key: 'taken', label: 'Uttaget', align: 'right', help: 'Semesterdagar som redan tagits ut, hämtat ur lönekörningarna.', render: r => `${fmt(r.taken)} d` },
            {
              key: 'remaining', label: 'Kvar', align: 'right', fontWeight: 700, color: 'var(--text-main)',
              help: 'Intjänat minus uttaget — dagarna den anställda fortfarande har rätt att ta ut.',
              render: r => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  {r.overEntitlement && (
                    <AlertTriangle size={13} color="var(--status-amber-text)" aria-label="Fler uttagna dagar än intjänade" />
                  )}
                  {fmt(r.remaining)} d
                </span>
              ),
            },
            { key: 'saved', label: 'Sparade', align: 'right', help: 'Dagar som flyttats med från tidigare semesterår. Man får spara högst fem dagar per år i upp till fem år.', render: r => (r.saved ? `${fmt(r.saved)} d` : '—') },
            {
              key: 'perDay', label: 'Per dag', align: 'right',
              help: 'Vad EN semesterdag kostar i lön för den här anställda.',
              render: r => (r.payPerDay ? `${fmt(r.payPerDay)} kr` : '—'),
            },
            {
              key: 'liability', label: 'Total kostnad', align: 'right', fontWeight: 600, color: 'var(--text-main)',
              help: 'Kvarvarande dagar × dagvärdet, plus arbetsgivaravgift. Det här är vad den anställdas sparade semester kostar dig när den tas ut.',
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
            Semesteråret löper 1 april {summary.vacationYear.start.getFullYear()} – 31 mars {summary.vacationYear.end.getFullYear()}. Dagarna tjänades in under de tolv månaderna dessförinnan (intjänandeåret).
          </li>
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
