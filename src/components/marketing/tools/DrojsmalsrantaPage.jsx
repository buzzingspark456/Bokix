import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { INK, INK_SOFT, MUTED, CARD_BORDER } from '../marketingTokens';
import { calcLateInterest, LATE_FEES, LATE_INTEREST_MARKUP, DEFAULT_REFERENCE_RATE } from '../../../utils/freeToolCalculations';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolNumber, ToolDate, ToolResultPanel, ToolResultRow, ToolNote, formatKr } from './ToolShell';

const tool = toolBySlug('drojsmalsranta');

// Förvalda datum: förfallodag 30 dagar bakåt, "betalas idag". Ett verktyg
// som möter besökaren med ett färdigt, rimligt exempel förklarar sig självt
// — tomma datumfält gör att första intrycket blir "0 kr" och en tom sida.
function defaultDates() {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() - 30);
  const iso = d => d.toISOString().slice(0, 10);
  return { due: iso(due), paid: iso(today) };
}

export default function DrojsmalsrantaPage() {
  const [dates] = useState(defaultDates);
  const [amount, setAmount] = useState('25000');
  const [dueDate, setDueDate] = useState(dates.due);
  const [paidDate, setPaidDate] = useState(dates.paid);
  const [referenceRate, setReferenceRate] = useState(String(DEFAULT_REFERENCE_RATE));
  const [fees, setFees] = useState(['compensation']);

  const toggleFee = id => setFees(prev => (prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]));

  const r = calcLateInterest({ amount, dueDate, paidDate, referenceRate, fees });

  return (
    <ToolShell
      tool={tool}
      metaTitle="Dröjsmålsränta — räkna ut ränta på en försenad faktura | Bokix"
      metaDescription="Gratis kalkylator för dröjsmålsränta enligt räntelagen: referensränta plus 8 procentenheter, räknat per dag. Se även påminnelseavgift, inkassokrav och förseningsersättning."
      intro="En obetald faktura ger dig rätt till ränta från förfallodagen. Räkna ut exakt hur mycket, per dag, och vilka avgifter du dessutom får lägga på."
      calculator={
        <>
          <ToolField label="Fakturabelopp" suffix="kr" hint="Beloppet som är obetalt, inklusive moms.">
            <ToolNumber value={amount} onChange={setAmount} placeholder="0" />
          </ToolField>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <ToolField label="Förfallodag">
              <ToolDate value={dueDate} onChange={setDueDate} />
            </ToolField>
            <ToolField label="Betalningsdag">
              <ToolDate value={paidDate} onChange={setPaidDate} />
            </ToolField>
          </div>

          <ToolField
            label="Riksbankens referensränta"
            suffix="%"
            hint="Sätts om två gånger per år (1 januari och 1 juli). Kontrollera aktuell nivå på riksbanken.se — dröjsmålsräntan är referensräntan plus 8 procentenheter."
          >
            <ToolNumber value={referenceRate} onChange={setReferenceRate} placeholder="0" />
          </ToolField>

          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '9px' }}>Avgifter du vill lägga på</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
            {Object.values(LATE_FEES).map(fee => {
              const checked = fees.includes(fee.id);
              return (
                <label key={fee.id} style={{
                  display: 'flex', gap: '11px', alignItems: 'flex-start', cursor: 'pointer',
                  padding: '12px 14px', borderRadius: '11px',
                  border: `1.5px solid ${checked ? 'var(--mkt-accent-green-fg)' : CARD_BORDER}`,
                  background: checked ? 'var(--mkt-accent-green-soft)' : 'var(--mkt-page-bg)',
                  transition: 'border-color 0.15s, background 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleFee(fee.id)}
                    style={{ marginTop: '2px', width: 16, height: 16, accentColor: 'var(--mkt-accent-green-fg)', flexShrink: 0 }}
                  />
                  <span>
                    <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 700, color: INK }}>
                      {fee.label} — {fee.amount} kr
                    </span>
                    <span style={{ display: 'block', fontSize: '12px', color: MUTED, lineHeight: 1.55, marginTop: '2px' }}>{fee.note}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </>
      }
      result={
        <ToolResultPanel
          title="Att kräva"
          footnote="Räntan räknas per kalenderdag på 365-dagarsbasis, från dagen efter förfallodagen. Har ni avtalat om en annan räntesats gäller den i stället, så länge den inte är oskälig."
        >
          <ToolResultRow label="Fakturabelopp" value={r.principal} decimals={2} />
          <ToolResultRow label={`Dröjsmålsränta ${formatKr(r.rate, 2)} %`} value={r.interest} decimals={2} note={`${r.days} dagar × ${formatKr(r.dailyInterest, 2)} kr/dag`} />
          {r.feeRows.map(f => (
            <ToolResultRow key={f.id} label={f.label} value={f.amount} muted />
          ))}
          <ToolResultRow label="Totalt att kräva" value={r.total} decimals={2} strong />

          <div style={{ marginTop: '18px', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
            Fakturan är <strong style={{ color: 'white' }}>{r.days} dagar</strong> försenad och kostar dig{' '}
            <strong style={{ color: 'white' }}>{formatKr(r.dailyInterest, 2)} kr</strong> per dag i utebliven ränta.
          </div>
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Räntan börjar löpa på förfallodagen',
          body: 'Har ni avtalat om ett förfallodatum löper räntan från dagen efter. Saknas avtalad förfallodag har gäldenären 30 dagar på sig från det att kravet skickades innan räntan börjar räknas.',
        },
        {
          title: 'Räntesatsen är referensränta + 8 procentenheter',
          body: `Enligt räntelagen. Referensräntan sätts av Riksbanken två gånger per år, så räntesatsen ändras med den — därför är den ett fält här och inte en fast siffra.`,
          formula: `${formatKr(referenceRate || 0, 2)} % + ${LATE_INTEREST_MARKUP} % = ${formatKr(r.rate, 2)} % per år`,
        },
        {
          title: 'Räkna per dag, inte per månad',
          body: 'Årsräntan delas med 365 och multipliceras med antalet dagar. Att avrunda till hela månader är den vanligaste missen och ger nästan alltid fel belopp.',
          formula: `${formatKr(r.principal, 2)} × ${formatKr(r.rate, 2)} % ÷ 365 × ${r.days} dagar = ${formatKr(r.interest, 2)} kr`,
        },
        {
          title: 'Avgifterna är reglerade i lag',
          body: 'Påminnelseavgift på 60 kr kräver att det avtalats innan skulden uppstod. Förseningsersättning på 450 kr får tas ut vid fakturering till företag eller myndigheter utan särskilt avtal — men inte tillsammans med påminnelseavgift för samma faktura.',
        },
      ]}
      faq={[
        {
          q: 'Hur mycket dröjsmålsränta får jag ta ut?',
          a: 'Enligt räntelagen är dröjsmålsräntan Riksbankens referensränta plus 8 procentenheter. Har ni avtalat om en högre ränta i era villkor gäller den, så länge den inte bedöms som oskälig.',
        },
        {
          q: 'Måste dröjsmålsränta stå på fakturan för att gälla?',
          a: 'Nej. Rätten till dröjsmålsränta följer av räntelagen och gäller även om det inte står något på fakturan. Att skriva ut villkoren gör det däremot tydligare för kunden och lättare att driva in.',
        },
        {
          q: 'Vad är skillnaden mellan påminnelseavgift och förseningsersättning?',
          a: 'Påminnelseavgiften på 60 kr kräver att den avtalats i förväg, till exempel i dina villkor. Förseningsersättningen på 450 kr gäller vid handel mellan företag och kräver inget avtal — men du kan inte ta ut båda för samma faktura.',
        },
        {
          q: 'Är dröjsmålsräntan momspliktig?',
          a: 'Nej. Dröjsmålsränta och förseningsavgifter är inte ersättning för en vara eller tjänst och ska därför inte momsbeläggas. Räntan bokförs som en finansiell intäkt.',
        },
        {
          q: 'Hur bokförs dröjsmålsränta?',
          a: 'Som en ränteintäkt, normalt på konto 8310, i den period då den betalas eller när den är säker. Själva fakturan ligger kvar som kundfordran tills betalningen kommer in.',
        },
        {
          q: 'När ska jag skicka till inkasso?',
          a: 'Vanlig ordning är påminnelse först, sedan ett formellt inkassokrav med minst åtta dagars betalningsfrist innan ärendet går vidare till Kronofogden. Ett inkassokrav ger rätt till 180 kr i ersättning.',
        },
      ]}
    >
      <ToolNote title="Kontrollera referensräntan">
        Startvärdet i fältet ovan är bara ett exempel. Riksbanken fastställer referensräntan den 1 januari och den 1 juli varje år, och den räntesats som gäller är den som gällde när dröjsmålet inträffade.
      </ToolNote>
      <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, marginTop: '22px' }}>
        Slipper hellre jaga betalningar?{' '}
        <Link to="/funktioner" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Bokix håller reda på förfallna fakturor</Link>{' '}
        och låter kunden betala med kort direkt på fakturan.
      </p>
    </ToolShell>
  );
}
