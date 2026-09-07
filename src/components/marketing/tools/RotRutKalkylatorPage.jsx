import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK, INK_SOFT, MUTED } from '../marketingTokens';
import { ROT_RUT_RATES, ROT_RUT_COMBINED_CAP, ROT_CAP, calcRotRutDeduction } from '../../../utils/rotRutConfig';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolNumber, ToolSegmented, ToolResultPanel, ToolResultRow, ToolNote, formatKr } from './ToolShell';

const tool = toolBySlug('rot-rut');

export default function RotRutKalkylatorPage() {
  const [type, setType] = useState('rot');
  const [labor, setLabor] = useState('20000');
  const [material, setMaterial] = useState('8000');
  const [buyers, setBuyers] = useState(1);

  const laborGross = Number(labor) || 0;
  const materialGross = Number(material) || 0;

  // Samma funktion som fakturamotorn i appen använder (rotRutConfig.js) —
  // inte en egen procenträkning här. Raden konstrueras med vatRate 0 och
  // qty 1 så `rowGross` returnerar exakt det bruttobelopp besökaren skrev
  // in: i appen kommer bruttot ur radens netto × moms, här är bruttot det
  // användaren redan har framför sig på offerten.
  const { rate, deduction: rawDeduction } = calcRotRutDeduction(type, [
    { qty: 1, unitPrice: laborGross, vatRate: 0, discount: 0, rotRutLabor: true },
  ]);

  // Taket gäller PER KÖPARE och år. Två makar som båda står som köpare på
  // fakturan har alltså dubbelt tak — en av de vanligaste frågorna en
  // hantverkare får, och en siffra man annars måste leta rätt på.
  const perBuyerCap = type === 'rot' ? ROT_CAP : ROT_RUT_COMBINED_CAP;
  const totalCap = perBuyerCap * buyers;
  const deduction = Math.min(rawDeduction, totalCap);
  const cappedAway = rawDeduction - deduction;

  const invoiceTotal = laborGross + materialGross;
  const customerPays = invoiceTotal - deduction;

  return (
    <ToolShell
      tool={tool}
      metaTitle="ROT- och RUT-kalkylator — räkna ut avdraget på fakturan | Bokix"
      metaDescription="Gratis ROT- och RUT-kalkylator: räkna ut avdraget på arbetskostnaden, se vad kunden betalar och vad du begär tillbaka från Skatteverket. Med takbelopp per köpare."
      intro="Avdraget gäller bara arbetskostnaden, aldrig materialet. Skriv in beloppen inklusive moms så ser du vad kunden ska betala och vad du begär tillbaka från Skatteverket."
      calculator={
        <>
          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>Typ av arbete</div>
          <ToolSegmented
            value={type}
            onChange={setType}
            options={[
              { value: 'rot', label: `ROT ${ROT_RUT_RATES.rot.percent} %`, hint: 'Renovering, om- och tillbyggnad' },
              { value: 'rut', label: `RUT ${ROT_RUT_RATES.rut.percent} %`, hint: 'Städ, trädgård, flytt' },
            ]}
          />

          <ToolField
            label="Arbetskostnad inkl. moms"
            suffix="kr"
            hint="Bara arbetet — restid och maskinhyra räknas normalt in, material aldrig."
          >
            <ToolNumber value={labor} onChange={setLabor} placeholder="0" />
          </ToolField>

          <ToolField
            label="Material och övrigt inkl. moms"
            suffix="kr"
            hint="Ger inget avdrag, men ska med på fakturan för att totalen ska stämma."
          >
            <ToolNumber value={material} onChange={setMaterial} placeholder="0" />
          </ToolField>

          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>Antal köpare på fakturan</div>
          <ToolSegmented
            value={buyers}
            onChange={setBuyers}
            options={[
              { value: 1, label: 'En köpare', hint: `Tak ${formatKr(perBuyerCap)} kr` },
              { value: 2, label: 'Två köpare', hint: `Tak ${formatKr(perBuyerCap * 2)} kr` },
            ]}
          />
          <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.65, margin: '2px 0 0' }}>
            Taket gäller per person och år. Står två personer som köpare, och båda äger bostaden och har tillräcklig skatt att räkna av mot, gäller dubbelt tak.
          </p>
        </>
      }
      result={
        <ToolResultPanel
          title="På fakturan"
          footnote="Kunden måste ha tillräckligt med skatt att räkna av mot, och taket delas med alla ROT/RUT-arbeten kunden köpt under året. Kontrollera saldot hos Skatteverket innan du fakturerar stora belopp."
        >
          <ToolResultRow label="Arbetskostnad" value={laborGross} />
          <ToolResultRow label="Material och övrigt" value={materialGross} />
          <ToolResultRow label="Fakturabelopp före avdrag" value={invoiceTotal} muted />
          <ToolResultRow label={`${ROT_RUT_RATES[type].label}-avdrag ${rate} %`} value={-deduction} />
          <ToolResultRow label="Kunden betalar" value={customerPays} strong />

          <div style={{ marginTop: '22px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <ToolResultRow label="Du begär från Skatteverket" value={deduction} />
            <ToolResultRow label="Totalt till dig" value={customerPays + deduction} muted />
          </div>

          {cappedAway > 0 && (
            <div style={{ marginTop: '16px', padding: '12px 14px', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
              Avdraget slår i taket: <strong style={{ color: 'white' }}>{formatKr(cappedAway)} kr</strong> ryms inte inom{' '}
              {formatKr(totalCap)} kr och måste betalas av kunden själv.
            </div>
          )}
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Bara arbetskostnaden räknas',
          body: 'Material, resekostnader för inköp och utrustning du säljer vidare ger aldrig avdrag. Dela därför upp fakturan tydligt i arbete och material — Skatteverket kan begära underlaget i efterhand.',
        },
        {
          title: 'Avdraget räknas på beloppet INKLUSIVE moms',
          body: 'En vanlig missuppfattning är att avdraget beräknas på nettopriset. Det gör det inte: procentsatsen läggs på arbetskostnaden inklusive moms.',
          formula: `${formatKr(laborGross)} × ${rate} % = ${formatKr(rawDeduction)} kr`,
        },
        {
          title: 'Kunden betalar mellanskillnaden',
          body: 'Du drar av avdraget direkt på fakturan (fakturamodellen) och begär sedan resten från Skatteverket. Kunden ser hela beloppet, men betalar bara sin del.',
          formula: `${formatKr(invoiceTotal)} − ${formatKr(deduction)} = ${formatKr(customerPays)} kr`,
        },
        {
          title: 'Taket är per person och år',
          body: `ROT och RUT delar ett gemensamt tak på ${formatKr(ROT_RUT_COMBINED_CAP)} kr per person och år, varav högst ${formatKr(ROT_CAP)} kr får vara ROT. Kunden ansvarar för att taket inte överskrids, men det är du som riskerar att inte få ut pengarna om det gör det.`,
        },
      ]}
      faq={[
        {
          q: 'Hur mycket är ROT-avdraget?',
          a: `ROT-avdraget är ${ROT_RUT_RATES.rot.percent} % av arbetskostnaden inklusive moms, med ett tak på ${formatKr(ROT_CAP)} kr per person och år. Procentsatsen har ändrats flera gånger de senaste åren, så kontrollera alltid vad som gäller för arbetets utförandedatum.`,
        },
        {
          q: 'Hur mycket är RUT-avdraget?',
          a: `RUT-avdraget är ${ROT_RUT_RATES.rut.percent} % av arbetskostnaden inklusive moms. ROT och RUT delar ett gemensamt tak på ${formatKr(ROT_RUT_COMBINED_CAP)} kr per person och år.`,
        },
        {
          q: 'Vilka arbeten ger ROT respektive RUT?',
          a: 'ROT gäller reparation, underhåll, om- och tillbyggnad av en bostad som kunden äger och bor i. RUT gäller hushållsnära tjänster som städning, fönsterputs, trädgårdsarbete, flytt och viss IT-hjälp. Skatteverket har en detaljerad lista över vad som ingår i respektive kategori.',
        },
        {
          q: 'Vad händer om kunden inte har tillräcklig skatt?',
          a: 'Då får du inte ut hela beloppet från Skatteverket, och mellanskillnaden får du kräva av kunden i efterhand. Därför är det klokt att be kunden kontrollera sitt kvarvarande utrymme innan större arbeten påbörjas.',
        },
        {
          q: 'Kan ett företag få ROT- eller RUT-avdrag?',
          a: 'Nej, avdraget är personligt och kan bara ges till en privatperson som äger och bor i bostaden. Fakturerar du ett företag eller en bostadsrättsförening gäller inget avdrag.',
        },
        {
          q: 'Hanterar Bokix ROT och RUT på fakturan?',
          a: 'Ja. Du märker de rader som är arbetskostnad, så räknas avdraget fram automatiskt, visas för kunden på fakturan och bokförs som en fordran på Skatteverket i stället för som en rabatt.',
        },
      ]}
    >
      <ToolNote tone="warn" title="Procentsatserna ändras">
        ROT-satsen har ändrats flera gånger de senaste åren och gäller utifrån när arbetet utfördes och betalades, inte när fakturan skrevs.
        Verktyget räknar med de satser som gäller nu. Vid arbeten som sträcker sig över ett årsskifte: kontrollera vad som gäller för respektive delbetalning.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px' }}>
        Ska du skicka fakturan också?{' '}
        <Link to="/funktioner" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Bokix räknar avdraget direkt i fakturan</Link>{' '}
        och håller isär arbete och material åt dig.
      </p>
    </ToolShell>
  );
}
