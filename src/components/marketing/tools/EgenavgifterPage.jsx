import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK, INK_SOFT, MUTED } from '../marketingTokens';
import { calcSoleTraderFees, SOLE_TRADER_FEE_CATEGORIES } from '../../../utils/freeToolCalculations';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolNumber, ToolSegmented, ToolResultPanel, ToolResultRow, ToolNote, formatKr } from './ToolShell';

const tool = toolBySlug('egenavgifter');

export default function EgenavgifterPage() {
  const [surplus, setSurplus] = useState('400000');
  const [categoryId, setCategoryId] = useState('full');
  const [taxRate, setTaxRate] = useState('32,41');

  const r = calcSoleTraderFees({ surplus, categoryId, municipalTaxRate: String(taxRate).replace(',', '.') });
  const feePercent = (r.feeRate * 100).toFixed(2).replace('.', ',');
  const deductionPercent = Math.round(r.category.standardDeduction * 100);

  return (
    <ToolShell
      tool={tool}
      metaTitle="Egenavgifter enskild firma — räkna ut vad som blir kvar | Bokix"
      metaDescription="Gratis kalkylator för egenavgifter i enskild firma: schablonavdrag, egenavgifter och inkomstskatt på överskottet, i rätt ordning. Se vad som faktiskt blir kvar av ett års vinst."
      intro="I en enskild firma är överskottet inte det du får behålla. Skriv in årets överskott så ser du schablonavdraget, egenavgifterna och ungefär vad som blir kvar efter skatt."
      calculator={
        <>
          <ToolField
            label="Överskott för året"
            suffix="kr"
            hint="Intäkter minus kostnader, före egenavgifter och skatt. Alltså raden längst ner i resultaträkningen."
          >
            <ToolNumber value={surplus} onChange={setSurplus} placeholder="0" />
          </ToolField>

          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>Din situation</div>
          <ToolSegmented
            value={categoryId}
            onChange={setCategoryId}
            options={SOLE_TRADER_FEE_CATEGORIES.map(c => ({ value: c.id, label: c.label, hint: c.hint }))}
          />

          <ToolField
            label="Kommunalskatt"
            suffix="%"
            hint="Din kommuns skattesats, inklusive regionskatt. Riksgenomsnittet ligger runt 32,4 % — din exakta sats står på skatteverket.se."
          >
            <ToolNumber value={taxRate} onChange={setTaxRate} placeholder="32,41" />
          </ToolField>
        </>
      }
      result={
        <ToolResultPanel
          title="Av årets överskott"
          footnote="Uppskattning. Jobbskatteavdrag, grundavdrag, statlig inkomstskatt över brytpunkten, avsättning till periodiseringsfond och expansionsfond kan förändra slutsumman rejält."
        >
          <ToolResultRow label="Överskott" value={r.surplus} />
          <ToolResultRow label={`Schablonavdrag ${deductionPercent} %`} value={-r.standardDeduction} muted />
          <ToolResultRow label="Underlag för egenavgifter" value={r.feeBase} muted />
          <ToolResultRow label={`Egenavgifter ${feePercent} %`} value={r.fees} />
          <ToolResultRow label="Kvar att beskatta" value={r.taxableIncome} />
          <ToolResultRow label={`Inkomstskatt ${taxRate || 0} %`} value={r.incomeTax} />
          <ToolResultRow label="Kvar till dig" value={r.net} strong />

          <div style={{ marginTop: '18px', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
            Av <strong style={{ color: 'white' }}>{formatKr(r.surplus)} kr</strong> i överskott går ungefär{' '}
            <strong style={{ color: 'white' }}>{formatKr(r.fees + r.incomeTax)} kr</strong> till avgifter och skatt.
            Det är {r.surplus > 0 ? Math.round(((r.fees + r.incomeTax) / r.surplus) * 100) : 0} % — bra att veta innan pengarna redan är utgivna.
          </div>
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Schablonavdraget dras först',
          body: `Du får göra ett schablonavdrag på upp till ${deductionPercent} % av överskottet innan egenavgifterna räknas. Avdraget finns för att egenavgifterna i sig är avdragsgilla, men den slutliga summan inte är känd när deklarationen fylls i.`,
          formula: `${formatKr(r.surplus)} × ${deductionPercent} % = ${formatKr(r.standardDeduction)} kr`,
        },
        {
          title: 'Egenavgifter på det som återstår',
          body: `${feePercent} % räknas på underlaget EFTER schablonavdraget — inte på hela överskottet. Räknar man på hela överskottet blir avgifterna ungefär en tredjedel för höga, vilket är den vanligaste missen i egen budget.`,
          formula: `${formatKr(r.feeBase)} × ${feePercent} % = ${formatKr(r.fees)} kr`,
        },
        {
          title: 'Inkomstskatt på resten',
          body: 'Överskottet i en enskild firma beskattas som inkomst av näringsverksamhet, alltså med kommunalskatt (och statlig skatt över brytpunkten). Firman betalar ingen egen bolagsskatt — du och firman är samma skattesubjekt.',
          formula: `${formatKr(r.taxableIncome)} × ${taxRate || 0} % = ${formatKr(r.incomeTax)} kr`,
        },
        {
          title: 'Året efter stäms det av',
          body: 'Du betalar preliminärskatt varje månad utifrån en debiterad preliminärskattsedel. Blev överskottet högre än du uppgav får du betala mer i slutskatt, blev det lägre får du tillbaka. Uppdatera den preliminära deklarationen under året hellre än att bli överraskad.',
        },
      ]}
      faq={[
        {
          q: 'Hur mycket är egenavgifterna?',
          a: 'Fulla egenavgifter är 28,97 % av underlaget. Har du fyllt 66 år vid årets ingång, eller tar ut hel allmän pension, betalar du bara ålderspensionsavgiften på 10,21 %. Underlaget är överskottet efter schablonavdrag.',
        },
        {
          q: 'Vad är schablonavdrag för egenavgifter?',
          a: 'Ett avdrag på upp till 25 % (20 % för den som bara betalar ålderspensionsavgift) som du gör i deklarationen innan egenavgifterna beräknas. Året efter stäms det av mot de faktiska avgifterna: blev schablonavdraget för högt tas mellanskillnaden upp som intäkt, blev det för lågt får du ett avdrag.',
        },
        {
          q: 'Betalar jag arbetsgivaravgift på mitt eget uttag?',
          a: 'Nej. Ett uttag ur en enskild firma är inte lön och belastas inte med arbetsgivaravgift — du betalar egenavgifter på verksamhetens överskott i stället. Har du anställda betalar du däremot arbetsgivaravgift på deras löner.',
        },
        {
          q: 'Gäller det här även aktiebolag?',
          a: 'Nej. Ett aktiebolag är ett eget skattesubjekt: bolaget betalar bolagsskatt på vinsten, och tar du ut lön betalar bolaget arbetsgivaravgift. Egenavgifter gäller enskild firma och delägare i handelsbolag.',
        },
        {
          q: 'Kan jag sänka underlaget?',
          a: 'Ja, avsättning till periodiseringsfond och expansionsfond kan skjuta upp beskattningen, och avdrag för till exempel pensionssparande i näringsverksamheten minskar överskottet. Det här verktyget räknar utan sådana avsättningar.',
        },
        {
          q: 'Räknar Bokix ut det här åt mig?',
          a: 'Bokix håller ordning på överskottet löpande utifrån din bokföring och känner igen bolagsformen från organisationsnumret, så du ser hur året ligger till innan deklarationen. Själva deklarationen fyller du i och signerar hos Skatteverket.',
        },
      ]}
    >
      <ToolNote title="Vad kalkylen förenklar">
        Grundavdrag och jobbskatteavdrag sänker den faktiska skatten, medan statlig inkomstskatt tillkommer på inkomster över brytpunkten.
        Nedsättning av egenavgifter för vissa grupper och karensvalets påverkan på sjukförsäkringsavgiften ingår inte heller.
        Verktyget ger storleksordningen rätt — inte deklarationens exakta slutsiffra.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px' }}>
        Funderar du på att anställa i stället för att ta ut mer själv? Räkna på arbetsgivarkostnaden i{' '}
        <Link to="/verktyg/lonekalkylator" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>lönekalkylatorn</Link>,
        eller läs om hur <Link to="/funktioner" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Bokix bokför enligt rätt regler per bolagsform</Link>.
      </p>
      <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.7, marginTop: '14px' }}>
        Satserna är kontrollerade mot skatteverket.se. Riksdagen kan ändra dem mellan år — stäm alltid av mot Skatteverkets aktuella sida inför deklarationen.
      </p>
    </ToolShell>
  );
}
