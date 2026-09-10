import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK_SOFT, MUTED } from '../marketingTokens';
import {
  calcDividendAllowance,
  DIVIDEND_RULES,
  DIVIDEND_BASE_AMOUNT,
  DIVIDEND_WAGE_DEDUCTION,
  DIVIDEND_SERVICE_CAP,
} from '../../../utils/freeToolCalculations';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolNumber, ToolResultPanel, ToolResultRow, ToolNote, formatKr } from './ToolShell';

// Verktyget för 3:12-reglerna. Räknelogiken ligger i
// freeToolCalculations.js (calcDividendAllowance) och är testad för sig —
// den här filen är bara fälten, texten och resultatpanelen.
//
// Varför den här sidan är mer uttalad om ÅRTAL än de andra verktygen:
// 3:12 ändrades i grunden den 1 januari 2026 (en regel i stället för två,
// grundbelopp 4 IBB, slopat löneuttagskrav). Väldigt mycket av det som
// ligger högst upp i sökresultaten beskriver fortfarande de GAMLA
// reglerna, och en företagare som räknar efter en gammal guide får ett
// gränsbelopp som är drygt hundratusen kronor för lågt. Sidan säger
// därför rakt ut vilket år den gäller för och vad som ändrades.

const tool = toolBySlug('utdelning');
const YEAR = DIVIDEND_RULES.year;

export default function UtdelningPage() {
  const [ownership, setOwnership] = useState('100');
  const [payroll, setPayroll] = useState('900000');
  const [ownSalary, setOwnSalary] = useState('500000');
  const [saved, setSaved] = useState('0');
  const [dividend, setDividend] = useState('400000');
  const [serviceTaxRate, setServiceTaxRate] = useState('52');

  const r = calcDividendAllowance({
    ownershipPercent: ownership,
    payroll,
    ownSalary,
    savedAllowance: saved,
    dividend,
    serviceTaxRate,
  });

  const ownSalaryNumber = Number(String(ownSalary).replace(',', '.')) || 0;

  return (
    <ToolShell
      tool={tool}
      metaTitle={`Utdelningskalkylator ${YEAR} — gränsbelopp enligt 3:12-reglerna | Bokix`}
      metaDescription={`Gratis kalkylator för 3:12-reglerna ${YEAR}: grundbelopp på fyra inkomstbasbelopp, lönebaserat utrymme och skatten på utdelning i fåmansbolag. Räknar enligt de nya reglerna som gäller från 1 januari 2026.`}
      intro={`Hur mycket kan du ta i utdelning till 20 % skatt? Skriv in ägarandel, löner och sparat utrymme så räknar vi gränsbeloppet enligt de nya 3:12-reglerna för ${YEAR}.`}
      calculator={
        <>
          <ToolField
            label="Din ägarandel"
            suffix="%"
            hint="Både grundbeloppet och löneunderlaget fördelas efter ägarandel. Äger du och din partner hälften var får ni halva grundbeloppet var — inte ett helt vardera."
          >
            <ToolNumber value={ownership} onChange={setOwnership} placeholder="100" />
          </ToolField>

          <ToolField
            label={`Löner i bolaget under ${YEAR - 1}`}
            suffix="kr"
            hint="Alla kontanta bruttolöner i bolaget och dess dotterbolag under året före, inklusive din egen lön. Förmåner och kostnadsersättningar räknas inte med."
          >
            <ToolNumber value={payroll} onChange={setPayroll} placeholder="0" />
          </ToolField>

          <ToolField
            label={`Din egen lön under ${YEAR - 1}`}
            suffix="kr"
            hint={`Används bara till taket: det lönebaserade utrymmet får aldrig bli större än ${DIVIDEND_RULES.wageCapMultiple} gånger din egen (eller en närståendes) lön. Något löneuttagskrav finns inte längre.`}
          >
            <ToolNumber value={ownSalary} onChange={setOwnSalary} placeholder="0" />
          </ToolField>

          <ToolField
            label="Sparat utdelningsutrymme"
            suffix="kr"
            hint="Gränsbelopp du inte använt tidigare år — står på förra årets K10. Det följer med, men räknas sedan 2026 inte längre upp med ränta."
          >
            <ToolNumber value={saved} onChange={setSaved} placeholder="0" />
          </ToolField>

          <ToolField
            label="Utdelning du planerar att ta"
            suffix="kr"
            hint="Utdelningen beslutas på bolagsstämman och får bara tas ur fritt eget kapital enligt senast fastställda balansräkning."
          >
            <ToolNumber value={dividend} onChange={setDividend} placeholder="0" />
          </ToolField>

          <ToolField
            label="Marginalskatt på tjänst"
            suffix="%"
            hint="Används bara på den del som överstiger gränsbeloppet. Runt 52 % för den som redan ligger över brytpunkten för statlig skatt, cirka 32 % för den som inte gör det."
          >
            <ToolNumber value={serviceTaxRate} onChange={setServiceTaxRate} placeholder="52" />
          </ToolField>
        </>
      }
      result={
        <ToolResultPanel
          title={`Gränsbelopp ${YEAR}`}
          footnote="Gränsbeloppet tillhör den som äger andelarna vid årets ingång och redovisas på blankett K10 året efter. Uppskattning — flera bolag, delägarskap under året och närståendekretsen kan ändra utfallet."
        >
          <ToolResultRow label={`Grundbelopp (4 IBB × ${Math.round(r.share * 100)} %)`} value={r.baseAmount} />
          <ToolResultRow label="Din andel av löneunderlaget" value={r.payrollShare} muted />
          <ToolResultRow label="Efter avdrag med 8 IBB" value={r.wageBaseAfterDeduction} muted />
          <ToolResultRow
            label="Lönebaserat utrymme (50 %)"
            value={r.wageBased}
            note={r.wageCapApplied ? `Begränsat av taket: ${DIVIDEND_RULES.wageCapMultiple} × din egen lön` : null}
          />
          <ToolResultRow label="Sparat utdelningsutrymme" value={r.savedAllowance} muted />
          <ToolResultRow label="Gränsbelopp totalt" value={r.allowance} strong />

          <div style={{ marginTop: '22px' }}>
            <ToolResultRow label="Utdelning inom gränsbeloppet" value={r.withinAllowance} muted />
            <ToolResultRow label="Skatt 20 %" value={r.taxWithin} />
            {r.aboveAllowance > 0 && (
              <>
                <ToolResultRow label="Över gränsbeloppet (beskattas som tjänst)" value={r.aboveAllowance} muted />
                <ToolResultRow label={`Skatt ${serviceTaxRate || 0} %`} value={r.taxAbove} />
              </>
            )}
            <ToolResultRow label="Kvar till dig efter skatt" value={r.net} strong />
          </div>

          <div style={{ marginTop: '18px', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
            {r.carriedForward > 0 ? (
              <>
                Du sparar <strong style={{ color: 'white' }}>{formatKr(r.carriedForward)} kr</strong> i outnyttjat utrymme till nästa år.
                Sedan {YEAR} växer det inte längre med ränta — det ligger bara kvar.
              </>
            ) : (
              <>
                Hela gränsbeloppet är utnyttjat. Utdelning därutöver beskattas som lön, fast utan arbetsgivaravgifter — och ger varken pension eller sjukpenning.
              </>
            )}
          </div>
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Grundbeloppet: fyra inkomstbasbelopp',
          body: `Varje delägare i ett fåmansföretag får ett grundbelopp på fyra inkomstbasbelopp, ${formatKr(DIVIDEND_BASE_AMOUNT)} kr för ${YEAR}. Det fördelas efter ägarandel — och äger du flera bolag fördelas det numera automatiskt mellan dem, du kan inte längre välja vilket bolag som ska använda schablonen.`,
          formula: `${formatKr(DIVIDEND_BASE_AMOUNT)} × ${Math.round(r.share * 100)} % = ${formatKr(r.baseAmount)} kr`,
        },
        {
          title: 'Lönebaserat utrymme ovanpå',
          body: `Har bolaget löner får du lägga till hälften av din andel av föregående års kontanta löner, efter ett schablonavdrag på åtta inkomstbasbelopp (${formatKr(DIVIDEND_WAGE_DEDUCTION)} kr). Avdraget ersätter det gamla löneuttagskravet: du behöver inte längre ta ut en viss lön för att över huvud taget få räkna med löneunderlaget.`,
          formula: `(${formatKr(r.payrollShare)} − ${formatKr(DIVIDEND_WAGE_DEDUCTION)}) × 50 % = ${formatKr(r.wageBasedRaw)} kr`,
        },
        {
          title: `Taket: ${DIVIDEND_RULES.wageCapMultiple} gånger din egen lön`,
          body: 'Det lönebaserade utrymmet får aldrig överstiga femtio gånger din egen eller en närståendes kontanta lön från bolaget. Det är spärren som gör att en delägare med minimal lön inte kan räkna hem hela personalstyrkans löneunderlag.',
          formula: `${formatKr(ownSalaryNumber)} × ${DIVIDEND_RULES.wageCapMultiple} = ${formatKr(r.wageCap)} kr`,
        },
        {
          title: 'Skatten: 20 % inom, tjänst över',
          body: `Utdelning inom gränsbeloppet tas upp till två tredjedelar i inkomstslaget kapital, vilket ger 20 % effektiv skatt. Det som överstiger beskattas som tjänsteinkomst (fast utan arbetsgivaravgifter) upp till takbeloppet 90 inkomstbasbelopp, ${formatKr(DIVIDEND_SERVICE_CAP)} kr — därutöver som kapital med 30 %.`,
          formula: `${formatKr(r.withinAllowance)} × 20 % = ${formatKr(r.taxWithin)} kr`,
        },
        {
          title: 'Outnyttjat utrymme sparas',
          body: `Tar du ut mindre än gränsbeloppet sparas resten till kommande år och kan användas senare. Nytt från ${YEAR}: det sparade utrymmet räknas inte längre upp med ränta, så att medvetet spara utrymme är mindre lönsamt än det var förr.`,
        },
      ]}
      faq={[
        {
          q: 'Vad är 3:12-reglerna?',
          a: 'Reglerna i 57 kap. inkomstskattelagen — ursprungligen 3 § 12 mom. i den gamla lagen, därav namnet — som styr hur utdelning och kapitalvinst beskattas för delägare i fåmansföretag. De finns för att en ägare som också arbetar i bolaget annars skulle kunna ta ut hela sin arbetsinkomst som lågbeskattad utdelning i stället för lön.',
        },
        {
          q: 'Vad ändrades den 1 januari 2026?',
          a: 'Förenklingsregeln och huvudregeln slogs ihop till en enda regel: alla får ett grundbelopp på fyra inkomstbasbelopp (322 400 kr för 2026) plus ett lönebaserat utrymme på 50 % av löneunderlaget efter avdrag med åtta inkomstbasbelopp. Löneuttagskravet och kravet på minst 4 % ägande togs bort, och sparat utdelningsutrymme räknas inte längre upp med ränta. Guider som fortfarande talar om "2,75 inkomstbasbelopp" beskriver de gamla reglerna.',
        },
        {
          q: 'Omfattas mitt bolag av 3:12?',
          a: 'Reglerna gäller kvalificerade andelar i fåmansföretag — förenklat ett aktiebolag där fyra eller färre delägare äger mer än hälften, och där du eller en närstående är verksam i betydande omfattning. Ett passivt ägande i ett bolag du inte arbetar i är normalt inte kvalificerat, och då beskattas utdelningen med 30 % rakt av.',
        },
        {
          q: 'Måste jag ta ut lön för att få räkna med löneunderlaget?',
          a: 'Nej, inte längre. Löneuttagskravet slopades från och med 2026. Din egen lön styr däremot fortfarande taket på femtio gånger lönen, och lön ger pension, sjukpenning och föräldrapenning som utdelning aldrig ger — så noll i lön är sällan rätt svar ändå.',
        },
        {
          q: 'När kan jag ta utdelningen?',
          a: 'Gränsbeloppet tillhör den som äger andelarna vid årets ingång. Själva utdelningen beslutas av bolagsstämman och får bara tas ur fritt eget kapital enligt senast fastställda balansräkning. Den redovisas sedan på blankett K10 i din egen deklaration året efter.',
        },
        {
          q: 'Bokförs utdelningen i Bokix?',
          a: 'Ja. Beslutad utdelning bokförs mot eget kapital och ligger som en skuld till aktieägaren tills den betalas ut, och Bokix föreslår konteringen. Själva K10:an fyller du i hos Skatteverket — men underlaget, löner och utbetalningar, ligger redan i bokföringen.',
        },
      ]}
    >
      <ToolNote title={`Siffrorna gäller beskattningsåret ${YEAR}`}>
        Grundbeloppet ({formatKr(DIVIDEND_BASE_AMOUNT)} kr) och avdraget på åtta inkomstbasbelopp ({formatKr(DIVIDEND_WAGE_DEDUCTION)} kr)
        bygger på inkomstbasbeloppet för året före beskattningsåret och indexeras varje år.
        Kalkylen förutsätter att andelarna är kvalificerade, att du ägde dem vid årets ingång och att du bara äger ett fåmansbolag —
        äger du flera fördelas grundbeloppet mellan dem efter ägarandel.
      </ToolNote>
      <ToolNote tone="warn" title="Det här räknar verktyget inte på">
        Kapitalvinst när du säljer andelarna (samma gränsbelopp, men med omkostnadsbelopp och andra tidsgränser),
        närståendekretsens gemensamma takbelopp, andelar som ägts en del av året och koncerner med dotterbolag i flera led.
        Känner du igen dig i någon av dem: stäm av med en revisor innan stämman beslutar om utdelningen.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px' }}>
        Väger du lön mot utdelning? Räkna på vad lönen kostar bolaget i{' '}
        <Link to="/verktyg/lonekalkylator" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>lönekalkylatorn</Link> —
        och slå upp <Link to="/ordlista" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>gränsbelopp, K10 och fåmansföretag i ordlistan</Link>.
      </p>
      <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.7, marginTop: '14px' }}>
        Kontrollerat mot de nya 3:12-regler som gäller från 1 januari 2026. Riksdagen kan ändra dem mellan år — stäm alltid av mot Skatteverkets aktuella sida inför deklarationen.
        Verktyget ger ett underlag, inte skatterådgivning.
      </p>
    </ToolShell>
  );
}
