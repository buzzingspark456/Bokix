import React, { useMemo, useState } from 'react';
import { Info, AlertTriangle, Palmtree, ChevronDown, ChevronUp, Wallet } from './icons';
import ListTable from './shared/ListTable';
import { BRAND } from '../utils/brandColors';
import { summarizeVacationLiability, VACATION_MODEL_NOTES } from '../utils/vacation';
import { EMPLOYER_FEE_CATEGORIES } from '../utils/payrollConfig';
import { t } from '../i18n';

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
  sammaloneregeln: { primary: t('ui.manadslon'), formal: 'Sammalöneregeln' },
  procentregeln: { primary: t('ui.timlon_rorlig'), formal: 'Procentregeln' },
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

  return (
    <div style={{ padding: 'clamp(14px, 3vw, 24px) clamp(14px, 3vw, 24px) 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
        <div style={{ width: 44, height: 44, borderRadius: '12px', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Palmtree size={21} />
        </div>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
            {t('ui.semesteraret')} {summary.vacationYear.label}
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6, maxWidth: '640px' }}>
            {t('ui.intjanade_och_uttagna_semesterdagar_per_anstalld')}
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
          label={t('ui.dagar_kvar_att_ta_ut')}
          value={fmt(summary.totalDays)}
          unit="dagar"
          hint={t('ui.intjanade_minus_redan_uttagna_dagar_alla_anstall')}
        />
        <div style={{ background: BRAND.green, color: 'white', borderRadius: '14px', padding: '18px 20px', flex: '1 1 260px', minWidth: 0, display: 'flex', gap: '14px', alignItems: 'flex-start', boxShadow: '0 4px 14px color-mix(in srgb, var(--accent) 22%, transparent)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '11px', background: 'rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Wallet size={19} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', marginBottom: '4px' }}>{t('ui.vad_de_dagarna_kostar')}</div>
            <div style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
              {fmt(summary.totalLiability + summary.totalLiabilityFee)} <span style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{t('ui.kr')}</span>
            </div>
            <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', marginTop: '5px', lineHeight: 1.5 }}>
              {t('ui.semesterlon')} {fmt(summary.totalLiability)} {t('ui.kr_arbetsgivaravgift')} {fmt(summary.totalLiabilityFee)} {t('ui.kr_ska_stamma_mot_konto_2920_2940_i_balansraknin')}
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
            amount: t('ui.d_kvar', { v: fmt(r.remaining) }),
            meta: t('ui.intjanat_d_uttaget_d', { v0: fmt(r.earned), v1: fmt(r.taken), v2: r.saved ? ` · sparade ${fmt(r.saved)} d` : '' }),
            meta2: t('ui.kostar_nar_de_tas_ut', { v: fmt(r.liabilityTotal) }) + (r.payPerDay ? t('ui.kr_per_dag', { v: fmt(r.payPerDay) }) : ''),
          })}
          columns={[
            {
              key: 'name', label: t('ui.anstalld'), fontWeight: 600, color: 'var(--text-main)', fontSize: '14px',
              render: r => `${r.employee.firstName} ${r.employee.lastName}`,
            },
            {
              key: 'rule', label: t('ui.anstallningsform'),
              help: t('ui.hur_semesterlonen_raknas_for_den_anstallda_manad'),
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
            { key: 'earned', label: t('ui.intjanat'), align: 'right', help: t('ui.semesterdagar_den_anstallda_har_tjanat_ihop_unde'), render: r => `${fmt(r.earned)} d` },
            { key: 'taken', label: t('ui.uttaget'), align: 'right', help: t('ui.semesterdagar_som_redan_tagits_ut_hamtat_ur_lone'), render: r => `${fmt(r.taken)} d` },
            {
              key: 'remaining', label: t('ui.kvar'), align: 'right', fontWeight: 700, color: 'var(--text-main)',
              help: t('ui.intjanat_minus_uttaget_dagarna_den_anstallda_for'),
              render: r => (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                  {r.overEntitlement && (
                    <AlertTriangle size={13} color="var(--status-amber-text)" aria-label={t('ui.fler_uttagna_dagar_an_intjanade')} />
                  )}
                  {fmt(r.remaining)} {t('ui.d')}
                </span>
              ),
            },
            { key: 'saved', label: t('ui.sparade'), align: 'right', help: t('ui.dagar_som_flyttats_med_fran_tidigare_semesterar'), render: r => (r.saved ? `${fmt(r.saved)} d` : '—') },
            {
              key: 'perDay', label: t('ui.per_dag'), align: 'right',
              help: t('ui.vad_en_semesterdag_kostar_i_lon_for_den_har_anst'),
              render: r => (r.payPerDay ? `${fmt(r.payPerDay)} kr` : '—'),
            },
            {
              key: 'liability', label: t('ui.total_kostnad'), align: 'right', fontWeight: 600, color: 'var(--text-main)',
              help: t('ui.kvarvarande_dagar_dagvardet_plus_arbetsgivaravgi'),
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
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>{t('ui.hur_raknas_det')}</span>
          </span>
          {showRules ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>
        {showRules && (
          <div style={{ padding: '0 18px 18px' }}>
            <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('ui.semesteraret_loper_1_april')} {summary.vacationYear.start.getFullYear()} {t('ui.n31_mars')} {summary.vacationYear.end.getFullYear()}{t('ui.dagarna_tjanades_in_under_de_tolv_manaderna_dess')}
              </li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('ui.intjanade_dagar_anstallningstid_under_intjanande')}
              </li>
              <li style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('ui.dagvarde_sammaloneregeln_manadslon_ger_semestert')}
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
