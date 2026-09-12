import React, { useMemo, useState } from 'react';
import { Info, AlertTriangle, Palmtree, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import ListTable from './shared/ListTable';
import { BRAND } from '../utils/brandColors';
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

// Plain-språk för Regel-kolumnen (se RULE_LABEL nedan) — vilken juridisk
// paragraf som gäller är sällan det en företagare tänker på, VILKEN
// ANSTÄLLNINGSFORM den hör till är det. Den formella termen finns kvar,
// bara nedtonad, inte borttagen.
const RULE_LABEL = {
  sammaloneregeln: { primary: 'Månadslön', formal: 'Sammalöneregeln' },
  procentregeln: { primary: 'Timlön/rörlig', formal: 'Procentregeln' },
};

// Kundfeedback: "semesterdelen under Anställda och lön — jag förstår inte
// vad det är, kan du göra den enklare?" Siffrorna var rätt, men varje kort
// och kolumn hette något ur bokföringens språk ("Semesterskuld", "Att stämma
// av mot 2920 + 2940") utan att någonstans säga vad talet BETYDER för den
// som driver företaget. Därför: en förklarande underrad på varje kort, en
// mening högst upp om vad sidan är, och en förklaring på varje kolumnrubrik
// (ListTable `help`). Inga siffror är ändrade — bara vad de kallas.
//
// Andra omgången kundfeedback ("för mycket text, förstår inte vad som
// står där, inte snyggt"): förklaringstexten om HUR beräkningen fungerar
// (paragrafhänvisningar, semesterårets datum) stod tidigare alltid synlig
// längst ner — en permanent textvägg ingen bad om att läsa just då. Den är
// nu gömd bakom en egen flik (se "Hur räknas det?" nedan), och korten fick
// ikoner + en tydligare rangordning: DAGARNA är huvudsiffran (det är svaret
// på frågan "hur mycket semester har jag kvar att ge"), KOSTNADEN är den
// solida, färgade panelen (samma mönster som lönekörningens "Total
// kostnad") eftersom det är balansräkningsposten som faktiskt spelar roll
// för bokföringen.
function SummaryCard({ icon: Icon, label, value, unit, hint }) {
  return (
    <div style={{ ...panelCard, padding: '18px 20px', flex: '1 1 240px', minWidth: 0, display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: '11px', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={19} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
        <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {value}{unit && <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginLeft: '5px' }}>{unit}</span>}
        </div>
        {hint && <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
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
  // Kollapsad som förval — se filkommentaren ovan. Öppnas av den som
  // faktiskt undrar över en siffra, inte påtvingad alla.
  const [showRules, setShowRules] = useState(false);

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
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ width: 44, height: 44, borderRadius: '12px', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Palmtree size={21} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
            Semesteråret {summary.vacationYear.label}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: '640px' }}>
            Intjänade och uttagna semesterdagar per anställd, och vad de dagar som är kvar kostar när de tas ut.
            Räknas fram automatiskt — du fyller inte i något här.
          </p>
        </div>
      </div>

      {/* Dagarna är huvudsiffran (kortet till vänster, samma neutrala stil
          som övriga sammanfattningskort i appen) — kostnaden får en egen,
          färgad panel istället för ett tredje likadant kort, samma mönster
          som lönekörningens "Total kostnad"-rad. Det gör tydligt att det
          är TVÅ olika sorters svar: en mängd (dagar) och en konsekvens
          (kronor mot balansräkningen), inte tre parallella mätetal. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: '14px', alignItems: 'stretch' }}>
        <SummaryCard
          icon={Palmtree}
          label="Dagar kvar att ta ut"
          value={fmt(summary.totalDays)}
          unit="dagar"
          hint="Intjänade minus redan uttagna dagar, alla anställda ihop."
        />
        <div style={{ background: BRAND.green, color: 'white', borderRadius: '14px', padding: '18px 20px', flex: '1 1 260px', minWidth: 0, display: 'flex', gap: '14px', alignItems: 'flex-start', boxShadow: '0 4px 14px rgba(11, 99, 41, 0.22)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>Vad de dagarna kostar</div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {fmt(summary.totalLiability + summary.totalLiabilityFee)} <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>kr</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', marginTop: '5px', lineHeight: 1.5 }}>
              Semesterlön {fmt(summary.totalLiability)} kr + arbetsgivaravgift {fmt(summary.totalLiabilityFee)} kr. Ska stämma mot konto 2920 + 2940 i balansräkningen.
            </div>
          </div>
        </div>
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
              key: 'rule', label: 'Anställningsform',
              help: 'Hur semesterlönen räknas för den anställda. Månadslön (sammalöneregeln): månadslönen plus ett tillägg per dag — normalt för fast månadslön. Timlön/rörlig (procentregeln): en andel av föregående års lön — normalt för timlön eller rörlig lön.',
              render: r => {
                const label = RULE_LABEL[r.rule];
                if (!label) return '—';
                return (
                  <span>
                    <span style={{ color: 'var(--text-main)' }}>{label.primary}</span>
                    <span style={{ display: 'block', fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '1px' }}>{label.formal}</span>
                  </span>
                );
              },
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

      {/* Modellens gränser skrivs ut — men bara om man frågar. En
          semesterberäkning som ser exakt ut men bygger på förenklingar är
          farligare än en som säger var den slutar gälla (särskilt vid
          sjukfrånvaro, där lagen ger fortsatt intjänande men modellen inte
          gör det), så informationen är kvar i sin helhet — bara gömd bakom
          en flik i stället för alltid påslagen. */}
      <div style={panelCard}>
        <button
          type="button"
          onClick={() => setShowRules(s => !s)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Info size={15} color="var(--text-secondary)" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>Hur räknas det?</span>
          </span>
          {showRules ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>
        {showRules && (
          <div style={{ padding: '0 18px 18px' }}>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Semesteråret löper 1 april {summary.vacationYear.start.getFullYear()} – 31 mars {summary.vacationYear.end.getFullYear()}. Dagarna tjänades in under de tolv månaderna dessförinnan (intjänandeåret).
              </li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Intjänade dagar: anställningstid under intjänandeåret delat med 365, gånger antalet semesterdagar, avrundat uppåt (semesterlagen § 7).
              </li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Dagvärde: sammalöneregeln (Månadslön) ger semestertillägg 0,43 % av månadslönen per dag (§ 16 a), procentregeln (Timlön/rörlig) 0,48 % av intjänandeårets lön per dag (§ 16 b).
              </li>
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
