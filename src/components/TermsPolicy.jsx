import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { PolicyLayout, PolicySection, PolicyCallout, policyP, policyLi, policyUl } from './marketing/PolicyLayout';
import { ACCENT } from './marketing/marketingTokens';

// JURIDISKT UTKAST, INTE GRANSKAT — en jurist måste läsa igenom och
// godkänna innehållet innan sidan går live.
//
// Bolagsidentitet bekräftad av kunden (samma som PrivacyPolicy.jsx,
// avsnitt 1) — Bokix, Strömsörgatan 19, Skellefteå. Bolagsform/org.nr
// medvetet UTELÄMNADE här — se motsvarande kommentar i PrivacyPolicy.jsx
// för varför.
//
// Kundönskemål ("gör policysidorna organiserade") — den här sidan var
// tidigare en helt egen, fristående vit box (ingen sajt-header/footer,
// hårdkodade ljusa hexfärger som aldrig fungerade i mörkt läge, egen
// dubblettuppsättning av h2/p/li-stilar). Byggd om för att använda samma
// delade PolicyLayout/PolicySection-system som PrivacyPolicy.jsx redan
// gjorde — enda policy-sidan som INTE gjorde det innan. Allt sakinnehåll
// är oförändrat, bara presentationen.

const link = { color: ACCENT.green.fg, fontWeight: 600 };

export default function TermsPolicy() {
  return (
    <PolicyLayout
      icon={FileText}
      title="Användarvillkor"
      accent={ACCENT.green}
      path="/terms"
      updated="2026-09-07"
      metaTitle="Användarvillkor | Bokix"
      metaDescription="Villkoren för att använda Bokix — konto och prenumeration, ditt ansvar som användare, ansvarsbegränsning och uppsägning."
      intro="Dessa villkor styr din och ditt företags användning av tjänsten Bokix — läs igenom dem innan du skapar ett konto."
    >
      <PolicySection n={1} title="Vad tjänsten är" first>
        <p style={policyP}>
          Dessa villkor ("Villkoren") ingås mellan dig/ditt företag och Bokix, Strömsörgatan 19, Skellefteå ("Bokix", "vi", "oss"), och styr din och ditt företags användning av tjänsten Bokix. Genom att skapa ett konto eller använda tjänsten godkänner du Villkoren och vår <Link to="/privacy" style={link}>Integritetspolicy</Link>. Om du använder tjänsten för ett företags räkning intygar du att du har behörighet att binda företaget till dessa Villkor.
        </p>
        <p style={policyP}>
          Bokix är ett webbaserat verktyg för löpande bokföring, fakturering, kvitto-/utgiftshantering, lönekörning och underlag inför skattedeklarationer, byggt för svenska småföretag. Tjänsten hjälper dig strukturera och beräkna din bokföring — den ersätter inte revisor, redovisningskonsult eller Skatteverkets egna e-tjänster.
        </p>
      </PolicySection>

      <PolicySection n={2} title="Konto och prenumeration">
        <ul style={policyUl}>
          <li style={policyLi}>Du måste vara minst 18 år och ha rätt att företräda det företag du registrerar för att skapa ett konto.</li>
          <li style={policyLi}>Du ansvarar för att uppgifterna du lämnar vid registrering är korrekta, och för att hålla ditt lösenord hemligt.</li>
          <li style={policyLi}>Tjänsten erbjuds mot en månadsavgift enligt gällande prissättning (se <Link to="/priser" style={link}>bokix.se/priser</Link>), med en kostnadsfri provperiod om 30 dagar. Avgiften debiteras månadsvis via Stripe, oavsett vilken plan du valt — även årsplanen, som är ett lägre månadspris och inte en förskottsbetalning för hela året.</li>
          <li style={policyLi}>Priserna anges i svenska kronor. Bokix är inte momsregistrerat, och ingen mervärdesskatt tillkommer därför på abonnemangsavgiften.</li>
          <li style={policyLi}>På månadsplanen kan du säga upp din prenumeration när som helst — det finns varken bindningstid eller uppsägningstid. Årsplanen ger ett lägre månadspris mot en minsta avtalstid om tre månader, räknat från den första debiteringen; därefter kan även den sägas upp när som helst. Uppsägning sker under Inställningar i tjänsten.</li>
          <li style={policyLi}>Redan betalda avgifter återbetalas inte för påbörjade perioder, om inte annat följer av tvingande konsumenträtt.</li>
        </ul>
      </PolicySection>

      <PolicySection n={3} title="Ditt ansvar som användare">
        <p style={policyP}>Du ansvarar för:</p>
        <ul style={policyUl}>
          <li style={policyLi}>Att den bokföringsdata, de kunduppgifter och de leverantörsuppgifter du matar in är korrekta.</li>
          <li style={policyLi}>Att inte använda tjänsten för olagliga ändamål, för att bokföra fiktiva transaktioner, eller för att kringgå skattelagstiftning.</li>
          <li style={policyLi}>Att inte försöka bryta tjänstens säkerhet, avkoda dess källkod, eller belasta den på ett sätt som stör andra användare.</li>
          <li style={policyLi}>Att hålla dina inloggningsuppgifter säkra och meddela oss omgående vid misstänkt obehörig åtkomst till ditt konto.</li>
        </ul>
      </PolicySection>

      <PolicySection n={4} title="Användning och lagstiftning (Bokföringslagen)">
        <p style={policyP}>
          Tjänsten är ett verktyg för att underlätta din bokföring. Enligt <strong>Bokföringslagen</strong> (se bfn.se) är det alltid du som företagare som bär det yttersta och fulla ansvaret för att din bokföring, dina skatteinbetalningar och dina deklarationer är korrekta och lämnas in i tid till Skatteverket och andra myndigheter. Bokix genererar underlag och beräkningar — det är ditt ansvar att granska dem innan de skickas in eller läggs till grund för betalning.
        </p>
      </PolicySection>

      <PolicySection n={5} title="Friskrivning från följdfel och ekonomiskt ansvar">
        <PolicyCallout tone="red">
          Bokix frånsäger sig uttryckligen allt ekonomiskt ansvar för felaktiga skatteinbetalningar, missade deklarationer, förseningsavgifter, skattetillägg eller andra direkta eller indirekta ekonomiska skador som kunden drabbas av, oavsett om dessa beror på handhavandefel, mjukvarubuggar, avbrott i tjänsten eller förlorad data. Genom att använda Bokix accepterar du att du ensam ansvarar för att granska och godkänna all redovisningsdata innan den används för skattedeklarationer eller årsredovisningar.
        </PolicyCallout>
        <p style={policyP}>
          Vårt totala ansvar gentemot dig, oavsett grund, är i alla händelser begränsat till det belopp du betalat för tjänsten under de senaste tre (3) månaderna.
        </p>
      </PolicySection>

      <PolicySection n={6} title="Drift och tillgänglighet">
        <p style={policyP}>
          Vi strävar efter hög tillgänglighet men garanterar inte att tjänsten är felfri eller tillgänglig utan avbrott. Planerat underhåll meddelas när det är praktiskt möjligt. Vi rekommenderar att du regelbundet exporterar din data (Inställningar → Data och Inställningar) som en egen säkerhetskopia.
        </p>
        <p style={policyP}>
          Bokix är byggt på och beroende av tredjepartsleverantörer (bland annat Supabase, Stripe, Resend och Vercel — se <Link to="/privacy" style={link}>Integritetspolicyn</Link>, avsnitt 4). Driftstörningar hos en sådan leverantör kan påverka tjänstens tillgänglighet, och vi ansvarar inte för avbrott som orsakas utanför vår egen kontroll.
        </p>
        <p style={policyP}>
          Ingen av parterna ansvarar för underlåtenhet att uppfylla dessa Villkor om det beror på omständigheter utanför partens rimliga kontroll (force majeure), till exempel naturkatastrof, krig, myndighetsbeslut, arbetsmarknadskonflikt eller omfattande avbrott hos internet-/molntjänstleverantörer.
        </p>
      </PolicySection>

      <PolicySection n={7} title="Din data">
        <p style={policyP}>
          Du äger din bokföringsdata. Vi använder den bara för att leverera tjänsten till dig, aldrig för att sälja den vidare. Du kan exportera all din data när som helst i tjänsten. Vid uppsägning av kontot bevarar vi bokföringsdata så länge bokföringslagen kräver det (normalt sju år), men slutar ta betalt och stänger av åtkomsten till det aktiva gränssnittet.
        </p>
      </PolicySection>

      <PolicySection n={8} title="Immateriella rättigheter">
        <p style={policyP}>
          Bokix, dess varumärke, design och källkod tillhör oss. Du får en icke-exklusiv, ej överlåtbar rätt att använda tjänsten så länge din prenumeration är aktiv. Du behåller full äganderätt till den data du själv lägger in.
        </p>
      </PolicySection>

      <PolicySection n={9} title="Uppsägning från vår sida">
        <p style={policyP}>
          Vi kan stänga av eller avsluta ditt konto om du bryter mot dessa Villkor, till exempel genom att använda tjänsten för olagliga ändamål. Vi meddelar dig om detta och ger dig, om möjligt, tillfälle att exportera din data innan kontot avslutas.
        </p>
      </PolicySection>

      <PolicySection n={10} title="Ändringar">
        <p style={policyP}>
          Vi kan uppdatera Villkoren vid behov, till exempel vid nya funktioner eller ändrad lagstiftning. Väsentliga ändringar meddelas via tjänsten i god tid innan de träder i kraft. Datumet högst upp på sidan visar när Villkoren senast uppdaterades.
        </p>
      </PolicySection>

      <PolicySection n={11} title="Tillämplig lag">
        <p style={policyP}>
          Dessa Villkor regleras av svensk lag. Tvister ska i första hand lösas genom dialog; i andra hand avgörs de av svensk allmän domstol.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
