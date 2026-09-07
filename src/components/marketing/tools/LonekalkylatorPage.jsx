import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK, INK_SOFT, MUTED } from '../marketingTokens';
import { calcEmployerCost, STANDARD_EMPLOYER_FEE_RATE, VACATION_PROVISION_RATE } from '../../../utils/freeToolCalculations';
import { PAYROLL_ACCOUNTS } from '../../../utils/payrollConfig';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolNumber, ToolSegmented, ToolResultPanel, ToolResultRow, ToolNote, formatKr } from './ToolShell';

const tool = toolBySlug('lonekalkylator');

const feePercent = (STANDARD_EMPLOYER_FEE_RATE * 100).toFixed(2).replace('.', ',');
const vacationPercent = (VACATION_PROVISION_RATE * 100).toFixed(0);

export default function LonekalkylatorPage() {
  const [gross, setGross] = useState('35000');
  const [taxRate, setTaxRate] = useState('30');
  const [vacation, setVacation] = useState(true);

  const r = calcEmployerCost({ gross, taxRate, vacation });

  return (
    <ToolShell
      tool={tool}
      metaTitle="Lönekalkylator — vad kostar en anställd? | Bokix"
      metaDescription="Gratis lönekalkylator: räkna ut arbetsgivaravgift, semesteravsättning och total kostnad för en anställd utifrån bruttolönen. Se hela vägen från lönekostnad till nettolön."
      intro="Bruttolönen är sällan hela kostnaden. Skriv in månadslönen så ser du arbetsgivaravgiften, semesteravsättningen och vad den anställda faktiskt kostar per månad."
      calculator={
        <>
          <ToolField label="Bruttolön per månad" suffix="kr" hint="Lönen före skatt, som den står i anställningsavtalet.">
            <ToolNumber value={gross} onChange={setGross} placeholder="0" />
          </ToolField>

          <ToolField
            label="Preliminär skattesats"
            suffix="%"
            hint="En uppskattning. Det exakta skatteavdraget kommer ur Skatteverkets skattetabell och beror på kommun, ålder och församling — riksgenomsnittet för kommunalskatt ligger runt 32 %."
          >
            <ToolNumber value={taxRate} onChange={setTaxRate} placeholder="30" />
          </ToolField>

          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>Semesteravsättning</div>
          <ToolSegmented
            value={vacation}
            onChange={setVacation}
            options={[
              { value: true, label: `Ja, ${vacationPercent} %`, hint: 'Procentregeln' },
              { value: false, label: 'Nej', hint: 'Betalas ut löpande' },
            ]}
          />
          <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.65, margin: '2px 0 0' }}>
            Semesterlönen tjänas in varje månad även om den betalas ut på sommaren. Räknar du bort den underskattas kostnaden per anställd med drygt {Math.round(VACATION_PROVISION_RATE * (1 + STANDARD_EMPLOYER_FEE_RATE) * 100)} %.
          </p>
        </>
      }
      result={
        <ToolResultPanel
          title="Kostnad per månad"
          footnote={`Arbetsgivaravgiften är standardsatsen ${feePercent} %. Särskilda regler för unga, pensionärer och visst styrelsearvode kan ge en lägre sats.`}
        >
          <ToolResultRow label="Bruttolön" value={r.gross} />
          <ToolResultRow label={`Arbetsgivaravgift ${feePercent} %`} value={r.employerFee} />
          {vacation && <ToolResultRow label={`Semesteravsättning ${vacationPercent} %`} value={r.vacationProvision} />}
          {vacation && <ToolResultRow label="Sociala avgifter på semestern" value={r.vacationFee} />}
          <ToolResultRow label="Total kostnad för dig" value={r.totalCost} strong />

          <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.45)', marginBottom: '8px' }}>
              Den anställda får ut
            </div>
            <ToolResultRow label={`Preliminärskatt ${taxRate || 0} %`} value={r.tax} muted />
            <ToolResultRow label="Nettolön (uppskattad)" value={r.net} />
          </div>

          <div style={{ marginTop: '18px', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
            Du betalar <strong style={{ color: 'white' }}>{formatKr(r.totalCost)} kr</strong> för att den anställda ska få{' '}
            <strong style={{ color: 'white' }}>{formatKr(r.net)} kr</strong> i handen — ungefär{' '}
            <strong style={{ color: 'white' }}>{formatKr(r.costPerNetKrona, 2)} kr</strong> per utbetald krona.
          </div>
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Arbetsgivaravgift på bruttolönen',
          body: `Standardsatsen är ${feePercent} % och räknas på bruttolönen plus eventuella skattepliktiga förmåner. Den betalas av dig, utöver lönen — den dras inte från den anställdas lön.`,
          formula: `${formatKr(r.gross)} × ${feePercent} % = ${formatKr(r.employerFee)} kr`,
        },
        {
          title: 'Semesterlönen tjänas in löpande',
          body: `Med procentregeln avsätts ${vacationPercent} % av bruttolönen varje månad, och den avsättningen bär i sin tur arbetsgivaravgifter. Det är den post som oftast glöms bort när man räknar på en nyanställning.`,
          formula: vacation ? `${formatKr(r.gross)} × ${vacationPercent} % = ${formatKr(r.vacationProvision)} kr (+ avgifter ${formatKr(r.vacationFee)} kr)` : 'Avstängd i beräkningen ovan',
        },
        {
          title: 'Skatteavdraget dras från lönen',
          body: 'Preliminärskatten är den anställdas pengar, inte en extra kostnad för dig — du håller bara inne beloppet och betalar in det. Det exakta avdraget hämtas ur Skatteverkets skattetabell utifrån den anställdas kommun, ålder och tabellkolumn.',
          formula: `${formatKr(r.gross)} − ${formatKr(r.tax)} = ${formatKr(r.net)} kr netto`,
        },
        {
          title: 'Så bokförs månaden',
          body: `Bruttolön mot ${PAYROLL_ACCOUNTS.grossSalary}, personalskatt mot ${PAYROLL_ACCOUNTS.tax}, nettolönen mot ${PAYROLL_ACCOUNTS.netSalaryBank}, arbetsgivaravgiften mot ${PAYROLL_ACCOUNTS.employerFeeCost}/${PAYROLL_ACCOUNTS.employerFeeLiability} och semesteravsättningen mot ${PAYROLL_ACCOUNTS.vacationProvisionCost}/${PAYROLL_ACCOUNTS.vacationProvisionLiability}. Exakt de konton Bokix bokför en lönekörning på.`,
        },
      ]}
      faq={[
        {
          q: 'Hur mycket är arbetsgivaravgiften 2026?',
          a: `Standardsatsen är ${feePercent} % av bruttolönen. Lägre satser kan gälla för vissa grupper, till exempel personer som fyllt 66 år vid årets ingång, där bara ålderspensionsavgiften tas ut.`,
        },
        {
          q: 'Vad kostar en anställd med 30 000 kr i månadslön?',
          a: `Med standardsatsen och semesteravsättning enligt procentregeln landar den totala månadskostnaden på ungefär ${formatKr(calcEmployerCost({ gross: 30000, taxRate: 30 }).totalCost)} kr — alltså cirka ${Math.round((calcEmployerCost({ gross: 30000, taxRate: 30 }).totalCost / 30000 - 1) * 100)} % ovanpå bruttolönen, innan pension och försäkringar.`,
        },
        {
          q: 'Ingår tjänstepension och försäkringar i kalkylen?',
          a: 'Nej. Tjänstepension är avtalsbaserad (till exempel ITP eller ett eget pensionsavtal) och varierar för mycket för att kunna schablonberäknas. Har du kollektivavtal tillkommer typiskt några procent för pension och avtalsförsäkringar ovanpå summan här.',
        },
        {
          q: 'Är nettolönen exakt?',
          a: 'Nej, den är en uppskattning utifrån den skattesats du anger. Det verkliga skatteavdraget slås upp i Skatteverkets skattetabell per anställd. I Bokix görs det uppslaget automatiskt vid varje lönekörning, så lönebeskedet stämmer på kronan.',
        },
        {
          q: 'Måste jag rapportera lönen till Skatteverket varje månad?',
          a: 'Ja, via arbetsgivardeklaration på individnivå (AGI) senast den 12:e månaden efter utbetalningen. Bokix sammanställer underlaget per lönekörning.',
        },
      ]}
    >
      <ToolNote title="Vad som inte ingår">
        Tjänstepension, avtalsförsäkringar, friskvård, arbetsplats och utrustning tillkommer utöver siffrorna ovan.
        Räkna med några procent extra för pension och försäkringar om du har eller planerar kollektivavtal — kalkylen här visar de lagstadgade delarna, inte de avtalade.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px' }}>
        Driver du enskild firma betalar du inte arbetsgivaravgift på ditt eget uttag, utan{' '}
        <strong style={{ color: INK }}>egenavgifter</strong> på överskottet. Räkna på det i{' '}
        <Link to="/verktyg/egenavgifter" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>egenavgiftskalkylatorn</Link>.
      </p>
    </ToolShell>
  );
}
