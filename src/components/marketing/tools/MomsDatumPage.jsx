import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK, INK_SOFT, MUTED } from '../marketingTokens';
import { nextVatDeadlinePublic } from '../../../utils/freeToolCalculations';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolSegmented, ToolResultPanel, ToolNote, formatDateSv } from './ToolShell';

const tool = toolBySlug('momsdatum');

const PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Månadsvis', hint: 'Omsättning över 40 mkr' },
  { value: 'quarterly', label: 'Kvartalsvis', hint: 'De flesta mindre företag' },
  { value: 'yearly', label: 'Årsvis', hint: 'Enskild firma, låg omsättning' },
];

export default function MomsDatumPage() {
  const [vatPeriod, setVatPeriod] = useState('quarterly');
  const r = nextVatDeadlinePublic({ vatPeriod });
  const daysLeft = r.dueDate ? Math.round((r.dueDate.getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000) : null;

  return (
    <ToolShell
      tool={tool}
      metaTitle="När ska jag deklarera moms? Momsdatum 2026 | Bokix"
      metaDescription="Se nästa förfallodatum för momsdeklarationen direkt — månadsvis, kvartalsvis eller årsvis. Räknar med Skatteverkets undantag i januari och augusti (17:e i stället för 12:e)."
      intro="Välj din redovisningsperiod, så räknar vi ut nästa gång momsdeklarationen och betalningen senast ska vara hos Skatteverket."
      calculator={
        <>
          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>Hur redovisar du moms?</div>
          <ToolSegmented value={vatPeriod} onChange={setVatPeriod} options={PERIOD_OPTIONS} />
          <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.65, margin: '2px 0 0' }}>
            Redovisningsperioden bestäms av din omsättning och står på ditt beslut från Skatteverket — de flesta aktiebolag och enskilda firmor med normal omsättning redovisar kvartalsvis.
          </p>
        </>
      }
      result={
        <ToolResultPanel
          title="Nästa förfallodag"
          footnote={vatPeriod === 'yearly'
            ? 'Årsvis moms redovisas i samma deklaration som inkomstskatten, på ett datum som beror på bolagsform — därför inget exakt datum här.'
            : 'Deklaration och betalning ska vara hos Skatteverket samma dag. Landar datumet på en helg flyttas det fram till nästa vardag.'}
        >
          {r.dueDate ? (
            <>
              <div style={{ fontSize: '26px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                {formatDateSv(r.dueDate)}
              </div>
              <div style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.65)', marginTop: '6px' }}>
                {daysLeft >= 0 ? `Om ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'}` : 'Redan passerat'}
                {vatPeriod === 'quarterly' && r.quarter && ` — avser kvartal ${r.quarter} ${r.year}`}
              </div>
              <div style={{ marginTop: '20px', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
                {(r.dueDate.getMonth() === 0 || r.dueDate.getMonth() === 7) && (
                  <>Datumet är den 17:e, inte den vanliga 12:e — {r.dueDate.getMonth() === 0 ? 'januari' : 'augusti'} har ett eget undantag hos Skatteverket.</>
                )}
                {!(r.dueDate.getMonth() === 0 || r.dueDate.getMonth() === 7) && (
                  <>Nästa deadline efter den här är {vatPeriod === 'monthly' ? 'en månad' : 'ett kvartal'} senare.</>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '15px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7 }}>
              Ingen fast dag att räkna fram — datumet följer din inkomstdeklaration.
            </div>
          )}
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Förfallodagen är den 12:e i andra månaden efter perioden',
          body: 'Momsen för ett kvartal ska vara redovisad och betald senast den 12:e, två kalendermånader efter kvartalets slut. Månadsmoms fungerar likadant, fast en månad i taget.',
          formula: 'Kvartal 2 (apr–jun) → förfaller 12 augusti',
        },
        {
          title: 'Januari och augusti har egna undantag: den 17:e',
          body: 'Skatteverkets egna sommar- och nyårsuppehåll skjuter fram förfallodagen till den 17:e de här två månaderna, oavsett om det är moms eller arbetsgivardeklaration det gäller.',
        },
        {
          title: 'Landar det på en helg flyttas det fram',
          body: 'Faller den 12:e (eller 17:e) på en lördag eller söndag gäller i stället nästa vardag. Skatteverket kan i enskilda fall flytta fram ytterligare vid röda dagar.',
        },
      ]}
      faq={[
        {
          q: 'När ska jag deklarera moms 2026?',
          a: 'Beror på din redovisningsperiod. Kvartalsvis moms förfaller den 12:e i andra månaden efter kvartalets slut (t.ex. 12 maj för första kvartalet). Månadsmoms förfaller den 12:e månaden efter. I januari och augusti gäller den 17:e i stället för den 12:e.',
        },
        {
          q: 'Vad händer om jag missar momsdeadlinen?',
          a: 'Skatteverket tar ut förseningsavgift och kan i vissa fall skönsbeskatta om deklarationen uteblir helt. Betalar du för sent tillkommer dessutom kostnadsränta på beloppet.',
        },
        {
          q: 'Vem redovisar moms månadsvis, kvartalsvis eller årsvis?',
          a: 'Skatteverket bestämmer redovisningsperiod utifrån din förväntade omsättning: normalt kvartalsvis, årsvis vid låg omsättning (under 1–3 mkr beroende på bolagsform) och månadsvis vid hög omsättning (över 40 mkr) eller om du själv begär det.',
        },
        {
          q: 'Kan jag byta redovisningsperiod?',
          a: 'Ja, ansök hos Skatteverket. Ett byte gäller normalt tidigast från nästa hela redovisningsperiod, inte retroaktivt.',
        },
        {
          q: 'Räknar det här verktyget med röda dagar?',
          a: 'Nej, bara helger (lördag/söndag). Skatteverket flyttar i sällsynta fall fram ytterligare vid en röd dag som infaller på förfallodagen — kontrollera alltid mot skatteverket.se inför en specifik deadline.',
        },
      ]}
    >
      <ToolNote title="Samma datum, en gång per period">
        Verktyget visar bara NÄSTA förfallodag räknat från idag. Har du redan bokfört och redovisat den här periodens moms, titta på datumet för perioden därefter i stället.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px' }}>
        Slipper hellre hålla koll själv?{' '}
        <Link to="/funktioner" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Bokix påminner dig</Link>{' '}
        innan varje momsdeadline, och räknar fram momsdeklarationen automatiskt ur din bokföring.
      </p>
    </ToolShell>
  );
}
