import React from 'react';
import GuideLayout, { Link, h2, p, ul, li, note } from './GuideLayout';
import { GUIDE_FAQ } from './guidesFaq';

const FAQ = GUIDE_FAQ.momsdeklaration;

export default function GuideMoms() {
  return (
    <GuideLayout slug="momsdeklaration" faq={FAQ}>
      <p style={p}>
        Momsdeklarationen är för många den mest stressiga återkommande deadlinen i ett litet företag — inte för att den är särskilt komplicerad i sig, utan för att den kräver att bokföringen faktiskt är i ordning i tid. Så här hänger delarna ihop.
      </p>

      <h2 style={h2}>Utgående och ingående moms</h2>
      <p style={p}>
        Utgående moms är den moms du lägger på dina egna fakturor och tar in från kunder. Ingående moms är den moms du själv betalar på inköp till verksamheten (t.ex. programvara, material, kontorshyra). Momsdeklarationen är i grunden en avstämning: utgående moms minus ingående moms, för perioden, är det du ska betala in till (eller få tillbaka från) Skatteverket.
      </p>

      <h2 style={h2}>Momssatser i Sverige</h2>
      <ul style={ul}>
        <li style={li}><strong>25 %</strong> — standardsatsen, gäller de flesta varor och tjänster.</li>
        <li style={li}><strong>12 %</strong> — bland annat livsmedel, restaurang- och cateringtjänster, hotell.</li>
        <li style={li}><strong>6 %</strong> — bland annat böcker, tidningar, persontransport, biljetter till konserter och idrottsevenemang.</li>
      </ul>
      <p style={p}>
        Vissa tjänster är helt momsfria (t.ex. viss sjukvård och utbildning) — kontrollera alltid vilken sats som gäller för just det du säljer om du är osäker.
      </p>

      <h2 style={h2}>Redovisningsperioder och deadlines</h2>
      <p style={p}>
        Skatteverket tilldelar dig en redovisningsperiod baserat på din förväntade årsomsättning:
      </p>
      <ul style={ul}>
        <li style={li}>Omsättning under ca 1 miljon kr/år — kan välja årsmoms (deklareras en gång/år).</li>
        <li style={li}>Omsättning under 40 miljoner kr/år — kvartalsvis momsredovisning.</li>
        <li style={li}>Högre omsättning — månadsvis momsredovisning.</li>
      </ul>
      <p style={p}>
        Deadline för kvartalsvis momsdeklaration ligger normalt kring den 12:e i den andra månaden efter kvartalets slut. För en enskild firma utan EU-handel som redovisar årsmoms ligger deadline normalt i maj året efter beskattningsåret.
      </p>
      <div style={note}>
        Exakta datum flyttas något år till år (och skiljer sig beroende på om du deklarerar digitalt eller på papper) — den enda korrekta källan för DINA deadlines är din egen sida på <a href="https://www.skatteverket.se" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', fontWeight: 600 }}>skatteverket.se</a>, inte den här guiden.
      </div>

      <h2 style={h2}>Vanliga misstag</h2>
      <ul style={ul}>
        <li style={li}>Att vänta med att bokföra kvitton och fakturor till precis innan deadline — då hinner underlag försvinna eller glömmas bort.</li>
        <li style={li}>Att blanda ihop momssatser på blandade fakturor (t.ex. en faktura med både en vara till 25 % och en tjänst till 6 %).</li>
        <li style={li}>Att missa att en period utan försäljning ändå ska deklareras (en "nolldeklaration"), inte bara hoppas över.</li>
      </ul>

      <p style={p}>
        Ett bokföringsprogram som räknar ut momsen löpande utifrån redan bokförda verifikationer, istället för att du samlar ihop allt i efterhand, gör momsdeklarationen till en avstämning snarare än ett eget litet projekt varje kvartal. Läs mer om <Link to="/funktioner" style={{ color: 'inherit', fontWeight: 600 }}>hur Bokix hanterar moms</Link>, eller om <Link to="/guider/enskild-firma-bokforing" style={{ color: 'inherit', fontWeight: 600 }}>bokföring för enskild firma</Link> i grunden.
      </p>
    </GuideLayout>
  );
}
