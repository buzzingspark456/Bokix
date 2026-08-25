import React from 'react';
import GuideLayout, { Link, h2, p, ul, li, note } from './GuideLayout';
import { GUIDE_FAQ } from './guidesFaq';

const FAQ = GUIDE_FAQ['fakturering-vad-kravs'];

export default function GuideFakturering() {
  return (
    <GuideLayout slug="fakturering-vad-kravs" faq={FAQ}>
      <p style={p}>
        En faktura är inte bara en betalningsbegäran — den är ett underlag som ska gå att bokföra korrekt både hos dig och hos din kund, och den ska hålla vissa formkrav enligt mervärdesskattelagen. Så här ser de grundläggande kraven ut.
      </p>

      <h2 style={h2}>Vad en faktura ska innehålla</h2>
      <ul style={ul}>
        <li style={li}>Datum för utfärdande.</li>
        <li style={li}>Ett unikt löpnummer som identifierar fakturan (fakturanummer).</li>
        <li style={li}>Ditt momsregistreringsnummer (om du är momsregistrerad).</li>
        <li style={li}>Ditt och kundens namn och adress.</li>
        <li style={li}>Vad som sålts — varornas mängd och art, eller tjänstens omfattning.</li>
        <li style={li}>Datum då varan levererades eller tjänsten utfördes (om det skiljer sig från fakturadatumet).</li>
        <li style={li}>Priset per enhet exklusive moms, eventuella rabatter.</li>
        <li style={li}>Tillämplig momssats och momsbeloppet, per momssats om flera förekommer på samma faktura.</li>
        <li style={li}>Totalbelopp att betala.</li>
      </ul>
      <div style={note}>
        Vissa branscher och situationer (t.ex. omvänd byggmoms, EU-handel, försäljning undantagen moms) har egna tilläggskrav på vad fakturan ska innehålla — det här är grundkraven för en vanlig inhemsk B2B/B2C-faktura, inte en fullständig lista för alla situationer.
      </div>

      <h2 style={h2}>Betalningsvillkor och förfallodatum</h2>
      <p style={p}>
        Betalningsvillkoren (hur många dagar kunden har på sig att betala) är i grunden något ni avtalar om, inte något lagen bestämmer åt er — men de allra vanligaste villkoren i Sverige är 10, 20 eller 30 dagar netto. Skriv alltid ut både fakturadatum och exakt förfallodatum på fakturan, inte bara "30 dagar netto", så det aldrig råder tvivel om när betalningen faktiskt förfaller.
      </p>

      <h2 style={h2}>Om kunden betalar för sent</h2>
      <p style={p}>
        Skicka en betalningspåminnelse så snart förfallodatumet passerat. Om betalning fortfarande uteblir kan du enligt räntelagen ta ut dröjsmålsränta från förfallodagen, samt en förseningsavgift/påminnelseavgift om det är avtalat. Nästa steg vid fortsatt utebliven betalning är normalt ett inkassokrav.
      </p>

      <h2 style={h2}>Kreditfaktura vid fel</h2>
      <p style={p}>
        Upptäcker du ett fel på en redan skickad faktura (fel belopp, fel kund, fel momssats) ska den inte bara raderas eller skrivas om — skicka en kreditfaktura som nollställer den felaktiga fakturan, och skicka sedan en ny, korrekt faktura. Det håller både din och kundens bokföring spårbar och korrekt.
      </p>

      <p style={p}>
        Ett fakturaprogram som fyller i rätt fält automatiskt och bokför verifikationen samtidigt som fakturan skickas minskar risken för att missa något av kraven ovan. Se <Link to="/funktioner" style={{ color: 'inherit', fontWeight: 600 }}>hur fakturering fungerar i Bokix</Link>.
      </p>
    </GuideLayout>
  );
}
