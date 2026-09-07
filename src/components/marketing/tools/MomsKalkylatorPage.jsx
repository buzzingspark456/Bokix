import React, { useState } from 'react';
import { INK, INK_SOFT, MUTED, CARD_BORDER } from '../marketingTokens';
import { calcVat, VAT_RATE_GUIDE } from '../../../utils/freeToolCalculations';
import { OUTPUT_VAT_ACCOUNT_BY_RATE, SALES_ACCOUNT_BY_RATE, OUTPUT_VAT_RUTA_BY_RATE, SALES_RUTA_BY_RATE, INPUT_VAT_ACCOUNT } from '../../../utils/vatConfig';
import { toolBySlug } from './toolsConfig';
import ToolShell, { ToolField, ToolNumber, ToolSegmented, ToolResultPanel, ToolResultRow, ToolNote, formatKr } from './ToolShell';

const tool = toolBySlug('momskalkylator');

// Det som gör verktyget till mer än en av tjugo identiska momsräknare på
// nätet: samma kontoplan och samma momsrutor som appen faktiskt bokför
// mot (vatConfig.js) visas direkt under svaret. Ingen annan gratisräknare
// säger "och så här bokförs det" — och det är precis den frågan den som
// googlar "räkna moms baklänges" har härnäst.
function BookkeepingHint({ rate, mode }) {
  const salesAccount = SALES_ACCOUNT_BY_RATE[rate];
  const vatAccount = OUTPUT_VAT_ACCOUNT_BY_RATE[rate];
  return (
    <div style={{ marginTop: '22px', paddingTop: '18px', borderTop: `1px dashed ${CARD_BORDER}` }}>
      <div style={{ fontSize: '12.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: MUTED, marginBottom: '10px' }}>
        Så bokförs det
      </div>
      {mode === 'add' ? (
        <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
          Försäljning: nettot mot konto <strong style={{ color: INK }}>{salesAccount}</strong> och momsen mot{' '}
          <strong style={{ color: INK }}>{vatAccount}</strong> (utgående moms {rate} %). I momsdeklarationen hamnar nettot i{' '}
          ruta <strong style={{ color: INK }}>{SALES_RUTA_BY_RATE[rate]}</strong> och momsen i ruta{' '}
          <strong style={{ color: INK }}>{OUTPUT_VAT_RUTA_BY_RATE[rate]}</strong>.
        </p>
      ) : (
        <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
          Ett inköp: nettot mot rätt kostnadskonto och momsen mot{' '}
          <strong style={{ color: INK }}>{INPUT_VAT_ACCOUNT}</strong> (ingående moms), som du drar av i ruta{' '}
          <strong style={{ color: INK }}>48</strong>. Är det i stället en försäljning inkl. moms bokförs momsen mot{' '}
          <strong style={{ color: INK }}>{vatAccount}</strong> och redovisas i ruta{' '}
          <strong style={{ color: INK }}>{OUTPUT_VAT_RUTA_BY_RATE[rate]}</strong>.
        </p>
      )}
    </div>
  );
}

export default function MomsKalkylatorPage() {
  const [amount, setAmount] = useState('10000');
  const [rate, setRate] = useState(25);
  const [mode, setMode] = useState('add');

  const r = calcVat({ amount, rate, mode });
  const guide = VAT_RATE_GUIDE.find(g => g.rate === rate);

  return (
    <ToolShell
      tool={tool}
      metaTitle="Momskalkylator — räkna ut moms baklänges och framlänges | Bokix"
      metaDescription="Gratis momskalkylator: lägg på eller räkna ur moms med 25, 12 eller 6 %. Se netto, moms och bruttobelopp direkt — plus vilka konton och momsrutor beloppet hamnar i."
      intro="Skriv in ett belopp, välj momssats och riktning. Du får netto, moms och totalsumma direkt — och ser vilka konton och momsrutor beloppet hör hemma i."
      calculator={
        <>
          <ToolSegmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'add', label: 'Lägg på moms', hint: 'Beloppet är exkl. moms' },
              { value: 'extract', label: 'Räkna ur moms', hint: 'Beloppet är inkl. moms' },
            ]}
          />
          <ToolField
            label={mode === 'add' ? 'Belopp exklusive moms' : 'Belopp inklusive moms'}
            suffix="kr"
            hint={mode === 'add' ? 'Priset du sätter på fakturan innan moms.' : 'Totalsumman på kvittot eller fakturan.'}
          >
            <ToolNumber value={amount} onChange={setAmount} placeholder="0" />
          </ToolField>
          <div style={{ fontSize: '13px', fontWeight: 700, color: INK, marginBottom: '7px' }}>Momssats</div>
          <ToolSegmented
            value={rate}
            onChange={setRate}
            options={VAT_RATE_GUIDE.map(g => ({ value: g.rate, label: g.label, hint: g.title }))}
          />
          {guide && (
            <p style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.65, margin: '2px 0 0' }}>
              <strong style={{ color: INK_SOFT }}>{guide.rate} %:</strong> {guide.examples}
            </p>
          )}
          <BookkeepingHint rate={rate} mode={mode} />
        </>
      }
      result={
        <ToolResultPanel
          title="Resultat"
          footnote="Avrundat till ören. Säljer du till företag i ett annat EU-land, eller omvänd byggmoms, gäller andra regler — se frågorna nedan."
        >
          <ToolResultRow label="Belopp exkl. moms" value={r.net} decimals={2} />
          <ToolResultRow label={`Moms ${rate} %`} value={r.vat} decimals={2} />
          <ToolResultRow label="Belopp inkl. moms" value={r.gross} decimals={2} strong />
          <div style={{ marginTop: '18px', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '11px', fontSize: '12.5px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>
            {mode === 'add'
              ? <>Du fakturerar <strong style={{ color: 'white' }}>{formatKr(r.gross, 2)} kr</strong>, varav <strong style={{ color: 'white' }}>{formatKr(r.vat, 2)} kr</strong> är moms du redovisar vidare till Skatteverket — inte en intäkt.</>
              : <>Av <strong style={{ color: 'white' }}>{formatKr(r.gross, 2)} kr</strong> är <strong style={{ color: 'white' }}>{formatKr(r.vat, 2)} kr</strong> moms. Din faktiska kostnad (eller intäkt) är <strong style={{ color: 'white' }}>{formatKr(r.net, 2)} kr</strong>.</>}
          </div>
        </ToolResultPanel>
      }
      steps={[
        {
          title: 'Lägga på moms på ett nettobelopp',
          body: 'Multiplicera med momssatsen och lägg till. Rakt fram — det är åt andra hållet det brukar bli fel.',
          formula: `${formatKr(r.net, 2)} × ${rate} % = ${formatKr(r.net * rate / 100, 2)} kr moms`,
        },
        {
          title: 'Räkna ur moms ur ett bruttobelopp',
          body: 'Dela med 1 + momssatsen. Att i stället dra av 25 % av bruttot är den vanligaste räknemissen i svensk bokföring: momsen i 1 000 kr inkl. moms är 200 kr, inte 250 kr.',
          formula: `${formatKr(r.gross, 2)} ÷ ${(1 + rate / 100).toFixed(2)} = ${formatKr(r.gross / (1 + rate / 100), 2)} kr exkl. moms`,
        },
        {
          title: 'Momsen är aldrig din',
          body: 'Utgående moms är pengar du håller åt Skatteverket tills nästa momsdeklaration. Den ska aldrig räknas som en intäkt i resultatet, och därför bokförs den på ett eget skuldkonto.',
        },
      ]}
      faq={[
        {
          q: 'Hur räknar jag ut moms baklänges?',
          a: 'Dela bruttobeloppet med 1,25 för 25 % moms, med 1,12 för 12 % och med 1,06 för 6 %. Skillnaden mellan bruttot och resultatet är momsen. Att dra av momssatsen direkt från bruttot ger fel svar.',
        },
        {
          q: 'Vilken momssats gäller för mig?',
          a: '25 % är normalskattesatsen och gäller de flesta varor och tjänster. 12 % gäller bland annat livsmedel, restaurang och hotell. 6 % gäller böcker, tidningar, persontransport och kultur. Är du osäker på en specifik tjänst är det Skatteverkets branschvisa vägledning som gäller.',
        },
        {
          q: 'Måste jag ta ut moms?',
          a: 'Du ska ta ut moms om du är momsregistrerad. Företag med en omsättning under gränsen för momsbefrielse kan välja att stå utanför momssystemet — då tar du inte ut moms, men får heller inte dra av ingående moms på dina inköp.',
        },
        {
          q: 'Vad gäller vid försäljning till andra EU-länder?',
          a: 'Vid försäljning av varor eller tjänster till ett momsregistrerat företag i ett annat EU-land tar du normalt inte ut svensk moms — köparen redovisar den själv (omvänd betalningsskyldighet). Du behöver köparens VAT-nummer och redovisar försäljningen i en periodisk sammanställning.',
        },
        {
          q: 'När ska momsen betalas in?',
          a: 'Det beror på din redovisningsperiod: månad, kvartal eller helår. Kvartalsvis är vanligast för mindre företag. Deklarationen och betalningen ska vara hos Skatteverket samma dag, och datumet varierar med periodlängd och omsättning.',
        },
        {
          q: 'Räknar Bokix ut momsen automatiskt?',
          a: 'Ja. Momsen räknas per faktura- och kvittorad, bokförs på rätt konto och summeras löpande till en momsdeklaration med rätt belopp i rätt ruta. Du får också en färdig eSKD-fil att ladda upp hos Skatteverket.',
        },
      ]}
    >
      <ToolNote title="Undantag som verktyget inte täcker">
        Omvänd byggmoms, vinstmarginalbeskattning, import från länder utanför EU och blandad verksamhet följer egna regler och kan inte räknas fram med en enkel procentsats.
        Bokix hanterar de vanliga fallen automatiskt och flaggar det som är osäkert i granskningsvyn i stället för att gissa.
      </ToolNote>
    </ToolShell>
  );
}
