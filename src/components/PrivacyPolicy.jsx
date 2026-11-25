import { Link } from 'react-router-dom';
import { PolicyLayout, PolicySection, PolicyTable, policyP, policyLi, policyUl } from './marketing/PolicyLayout';
import { INK } from './marketing/marketingTokens';

// JURIDISKT UTKAST, INTE GRANSKAT — en jurist måste läsa igenom och
// godkänna innehållet innan sidan går live.
//
// Bolagsidentitet (avsnitt 1) bekräftad av kunden: Bokix, Strömsörgatan
// 19, Skellefteå. Org.nr medvetet UTELÄMNAT från denna publika,
// sökmotorindexerade sida efter kundens önskemål — hänvisar till
// support@bokix.se istället.
//
// Avsnitt 10 länkar till det fullständiga PUB-avtalet på /pub
// (PersonuppgiftsBitradesAvtal.jsx) — samma "utkast, ej granskat"-status.

const link = { color: INK, fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' };

export default function PrivacyPolicy() {
  return (
    <PolicyLayout
      title="Integritetspolicy"
      path="/privacy"
      updated="2026-11-09"
      metaTitle="Integritetspolicy | Bokix"
      metaDescription="Vilken personuppgiftsinformation Bokix samlar in, varför, hur länge den sparas och vilka rättigheter du har enligt GDPR."
    >
      <PolicySection n={1} title="Personuppgiftsansvarig" first>
        <p style={policyP}>
          Bokix, Strömsörgatan 19, Skellefteå, är personuppgiftsansvarig för de personuppgifter som behandlas i tjänsten. Har du frågor om hur dina uppgifter hanteras, vill ha vårt organisationsnummer, eller vill utöva någon av dina rättigheter nedan, kontaktar du oss på <a href="mailto:support@bokix.se" style={link}>support@bokix.se</a>.
        </p>
        <p style={policyP}>
          Observera skillnaden mellan de två roller vi kan ha: för dina EGNA konto- och företagsuppgifter är vi personuppgiftsansvariga (se ovan). För de kund-, leverantörs- och anställduppgifter DU själv lägger in i din bokföring är DU personuppgiftsansvarig och Bokix är personuppgiftsbiträde åt dig — se avsnitt 11.
        </p>
      </PolicySection>

      <PolicySection n={2} title="Vilka uppgifter vi samlar in">
        <p style={policyP}>Vilka uppgifter som samlas in beror på hur du använder tjänsten:</p>
        <PolicyTable
          head={['Kategori', 'Exempel', 'Varifrån']}
          rows={[
            ['Kontouppgifter', 'Namn, e-postadress, lösenord (lagras hashat, aldrig i klartext)', 'Du, vid registrering'],
            ['Företagsuppgifter', 'Företagsnamn, organisationsnummer, adress, momsregistreringsnummer, räkenskapsår', 'Du, samt offentliga register (Bolagsverket, direkt eller via FöretagsAPI, och EU:s momsregister VIES) när du söker upp ett företag'],
            ['Bokföringsdata', 'Verifikationer, fakturor, kvitton, kund- och leverantörsuppgifter, kontoplan', 'Du, löpande i tjänsten'],
            ['Personaluppgifter (lönemodulen)', 'Anställdas namn, personnummer, lön, skattetabell, bankkontonummer', 'Du, vid registrering av anställda'],
            ['Kassaförsäljning', 'Försäljningar från din Zettle-kassa: belopp, moms, datum och betalsätt', 'Zettle, bara om du själv kopplat det'],
            ['Kontaktformuläret och supporten', 'Namn, e-postadress, ditt meddelande och en eventuell bild eller PDF du bifogar i appen', 'Du, när du skriver till oss'],
            ['Bokning av genomgång', 'Namn, e-postadress, telefon och den tid du valt', 'Du, när du bokar'],
            ['Betalningsuppgifter', 'Kortuppgifter hanteras aldrig av oss direkt, de går genom Stripe (se avsnitt 4)', 'Stripe'],
            ['Teknisk data', 'IP-adress, webbläsartyp, tidsstämplar för inloggning (säkerhet och felsökning)', 'Automatiskt'],
          ]}
        />
      </PolicySection>

      <PolicySection n={3} title="Varför vi behandlar uppgifterna och den rättsliga grunden">
        <ul style={policyUl}>
          <li style={policyLi}><strong>Fullgörande av avtal</strong> — för att kunna leverera bokförings-, fakturerings- och löneverktyget du registrerat dig för (kontouppgifter, företagsuppgifter, bokföringsdata).</li>
          <li style={policyLi}><strong>Rättslig förpliktelse</strong> — bokföringsdata du själv skapar i tjänsten omfattas av bokföringslagens krav på arkivering; vi raderar aldrig bokföringsdata i förtid enbart för att du säger upp kontot.</li>
          <li style={policyLi}><strong>Berättigat intresse</strong> — teknisk data (IP, tidsstämplar) för att upptäcka missbruk, felsöka driftsproblem och hålla tjänsten säker, en enda inbjudan att lämna ett omdöme om Bokix på Trustpilot (se avsnitt 4), och några få tips-mejl de första två veckorna efter att du skapat kontot, om hur du kommer igång. Varje tips-mejl har en länk där du avregistrerar dig med ett klick.</li>
          <li style={policyLi}><strong>Samtycke</strong> — om du väljer att koppla på integrationer (t.ex. Stripe för kortbetalningar, Zettle för kassan eller din egen e-post som avsändare) behandlas ytterligare uppgifter först när du aktivt ansluter dem, och du kan koppla från när du vill.</li>
        </ul>
      </PolicySection>

      <PolicySection n={4} title="Vilka vi delar uppgifter med">
        <p style={policyP}>Vi säljer aldrig dina uppgifter. Uppgifter delas bara med underleverantörer (personuppgiftsbiträden åt oss) som behövs för att driva tjänsten:</p>
        <ul style={policyUl}>
          <li style={policyLi}><strong>Supabase</strong> — databas- och autentiseringsleverantör. All bokförings- och kontodata, inklusive de kvitton och underlag du laddar upp, lagras hos Supabase på våra vägnar i ett datacenter i Sverige (Stockholm).</li>
          <li style={policyLi}><strong>Stripe</strong> — betalningsleverantör, används om du ansluter kortbetalningar för dina egna kundfakturor. Kortuppgifter går direkt till Stripe och passerar aldrig våra servrar. Stripe behandlar även dina egna kontouppgifter (namn, e-post) för Bokix egen prenumerationsfakturering.</li>
          <li style={policyLi}><strong>Resend</strong> — e-postleverantör. Skickar tjänstens egna mejl till dig (till exempel påminnelser och besked om ditt konto) och de fakturor och offerter du väljer att mejla till dina kunder via Bokix (mottagarens adress, ämnesrad, innehåll och eventuell PDF-bilaga går genom Resend).</li>
          <li style={policyLi}><strong>Vercel</strong> — driftar och hostar hela tjänsten (webbappen och de serverfunktioner som hanterar t.ex. betalningar och e-post). All trafik till Bokix passerar genom Vercels infrastruktur.</li>
          <li style={policyLi}><strong>Sentry</strong> (Functional Software) — felrapporter när appen kraschar i webbläsaren eller ett fel uppstår på servern: felmeddelandet, var i koden felet uppstod, sidans eller funktionens adress utan parametrar och webbläsartyp. Inga kunduppgifter, ingen bokföringsdata, inga cookies och inget användar-id skickas, och e-postadresser, personnummer och organisationsnummer tas bort ur texterna innan de skickas.</li>
          <li style={policyLi}><strong>Vercel BotID</strong> — automatiserad bot-/missbruksdetektering på formulär (t.ex. registrering), en del av Vercel-plattformen ovan.</li>
          <li style={policyLi}><strong>Cloudflare Turnstile</strong> — kontrollerar vid registrering, på kontaktformuläret och vid bokning att det är en människa och inte en robot. Cloudflare får då teknisk information om din webbläsare och ditt besök, och använder den inte för spårning eller reklam.</li>
          <li style={policyLi}><strong>Cloudflare R2</strong> — en krypterad säkerhetskopia av tjänstens databas och uppladdade filer tas varje natt och lagras hos Cloudflare inom EU. Kopian är krypterad innan den lämnar oss, så Cloudflare kan inte läsa innehållet.</li>
          <li style={policyLi}><strong>one.com</strong> — vår e-post. Det du skickar till support@bokix.se, via kontaktformuläret eller supporten i appen, inklusive en bifogad bild eller PDF, hamnar i vår inkorg hos one.com.</li>
          <li style={policyLi}><strong>Google Cloud Vision</strong> — läser texten på kvitton och underlag du laddar upp, både foton och PDF. Bara bilden eller filen skickas, behandlas inom EU och sparas inte hos Google. På webbplatsens gratisverktyg Skanna kvitto läses besökarens första kvitto på samma sätt; för att det ska ske en gång per besökare sparar vi en hashad (oläslig) form av IP-adressen i högst ett år, aldrig adressen i klartext. Efter det läses kvitton i besökarens egen webbläsare.</li>
          <li style={policyLi}><strong>Bolagsverket, FöretagsAPI och VIES</strong> — när du söker upp ett företag (ditt eget, en kund eller en leverantör) skickas organisationsnumret, momsnumret eller det namn du söker på dit för att hämta namn och adress ur offentliga register. Inget annat skickas.</li>
          <li style={policyLi}><strong>Zettle</strong> — <em>endast om du själv kopplar din Zettle-kassa</em>. Bokix hämtar då dina försäljningar därifrån för att bokföra dem. Du kan koppla från när du vill under Inställningar.</li>
          <li style={policyLi}><strong>Trustpilot</strong> — ungefär en månad efter din första betalning för Bokix skickar vi ett mejl där Trustpilot får en kopia. Trustpilot får då din e-postadress och skickar dig en inbjudan att lämna ett omdöme. Det sker en gång per konto, du väljer själv om du vill svara, och vill du inte få inbjudan mejlar du <a href="mailto:support@bokix.se" style={link}>support@bokix.se</a>. Gäller inte dina kunder eller mottagare av fakturor du skickar.</li>
          <li style={policyLi}><strong>Analysverktyg, bara med ditt samtycke</strong> — Google Analytics (Google), Microsoft Clarity (Microsoft) och PostHog mäter hur besökare använder Bokix och sätts först efter att du klickat "Acceptera alla" i cookiebannern. PostHog körs i EU-molnet (Frankfurt) och räknar sidvisningar och några få händelser, till exempel att ett kvitto laddats upp eller en faktura skickats. Ingen bokföringsdata, inga belopp, inga kunduppgifter och inga inmatningar skickas dit. Exakt vilka cookies som sätts står i <a href="/cookies" style={link}>cookiepolicyn</a>.</li>
          <li style={policyLi}><strong>Google</strong> — <em>endast om du själv väljer att koppla din Gmail-adress som avsändare</em> (Inställningar → Fakturautskick). Fakturan skickas då genom ditt eget Google-konto i stället för via Bokix. Se avsnitt 5 nedan för exakt vad det innebär.</li>
        </ul>
        <p style={policyP}>
          Vi delar aldrig uppgifter med tredje part för marknadsföringsändamål. Uppgifter kan lämnas ut om vi är skyldiga att göra det enligt lag, till exempel vid en begäran från Skatteverket eller en domstol.
        </p>
      </PolicySection>

      {/* Krävs ordagrant av Google för att appen ska kunna verifieras:
          policyn måste beskriva hur Google-användardata hämtas, används,
          lagras och delas, och uttryckligen hänvisa till Limited Use. Ändra
          inget här utan att läsa Google API Services User Data Policy —
          en policy som inte täcker det här får appen avslagen. */}
      <PolicySection n={5} title="Om du kopplar din egen Gmail-adress">
        <p style={policyP}>
          Du kan välja att skicka fakturor och offerter från din egen e-postadress i stället för via Bokix. Kopplar du ett Google-konto gäller följande, och ingenting utöver det:
        </p>
        <ul style={policyUl}>
          <li style={policyLi}><strong>Vi ber om en enda behörighet:</strong> <code>gmail.send</code>, alltså rätten att skicka e-post för din räkning. Den ger ingen åtkomst till din inkorg, dina utkast, ditt arkiv eller dina kontakter. Bokix kan inte läsa, söka i, ändra eller radera något i din e-post — inte som ett löfte, utan för att behörigheten inte finns.</li>
          <li style={policyLi}><strong>Vad vi lagrar:</strong> en åtkomstnyckel (refresh-token) från Google, krypterad, samt adressen och namnet som ska stå som avsändare. Nyckeln lämnar aldrig våra servrar och visas aldrig i webbläsaren. Vi lagrar inga meddelanden från ditt konto.</li>
          <li style={policyLi}><strong>Vad vi använder den till:</strong> uteslutande för att skicka de fakturor, offerter och betalningspåminnelser du själv väljer att skicka från Bokix. Aldrig för något annat.</li>
          <li style={policyLi}><strong>Vad vi inte gör:</strong> Google-data delas aldrig vidare till tredje part, används aldrig för annonser eller marknadsföring, säljs aldrig, och används aldrig för att träna generella AI- eller maskininlärningsmodeller. Ingen människa hos oss läser den.</li>
          <li style={policyLi}><strong>Du kan koppla från när du vill:</strong> i Bokix under Inställningar, eller när som helst i ditt Google-konto under Säkerhet → Appar med åtkomst till ditt konto. Då raderas den sparade nyckeln och fakturor skickas åter via Bokix egen adress.</li>
        </ul>
        <p style={policyP}>
          Bokix användning och överföring av information från Google API:er följer <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" style={link}>Google API Services User Data Policy</a>, inklusive kraven på begränsad användning (Limited Use).
        </p>
        <p style={policyP}>
          Väljer du i stället en annan e-postleverantör sparas ditt app-lösenord på samma sätt: krypterat, bara läsbart av våra servrar, och använt enbart för att skicka de meddelanden du själv skickar.
        </p>
      </PolicySection>

      <PolicySection n={6} title="Överföring utanför EU/EES">
        <p style={policyP}>
          Själva lagringen av din bokföring — databasen och de filer du laddar upp — sker i Sverige, i Stockholm (se avsnitt 4). Kopplar du din egen Gmail-adress (avsnitt 5) hanteras det utskicket av Google, ett amerikanskt bolag, på samma villkor som övriga leverantörer nedan.
        </p>
        <p style={policyP}>
          Flera av underleverantörerna i avsnitt 4 (bland annat Stripe, Resend, Vercel, Sentry, Cloudflare och analysverktygen) är amerikanska bolag och kan behandla uppgifter i, eller från, USA. När det sker gör vi det bara med ett giltigt överföringsverktyg på plats — till exempel att leverantören är ansluten till EU-U.S. Data Privacy Framework, eller att vi har standardavtalsklausuler (SCC) med dem — i enlighet med respektive leverantörs egna dataskyddsvillkor. Vill du se vilket verktyg som gäller för en specifik leverantör, kontakta oss på <a href="mailto:support@bokix.se" style={link}>support@bokix.se</a>.
        </p>
      </PolicySection>

      <PolicySection n={7} title="Hur länge vi sparar uppgifterna">
        <ul style={policyUl}>
          <li style={policyLi}>Kontouppgifter sparas så länge du har ett aktivt konto, och raderas eller anonymiseras inom rimlig tid efter att kontot avslutats.</li>
          <li style={policyLi}>Bokföringsdata (verifikationer, fakturor, kvitton) sparas till och med det sjunde året efter utgången av det kalenderår då räkenskapsåret avslutades, i enlighet med bokföringslagens arkiveringskrav (7 kap. 2 § BFL), även om du säger upp kontot eller raderar ett företag. Det som sparas då är bara det lagen kräver, i ett stängt arkiv som bara våra servrar når. Utkast, oanvända kontakter och annat som inte är räkenskapsinformation sparas inte i arkivet.</li>
          <li style={policyLi}>Säkerhetskopior: varje natt tas en kopia av kontot, som sparas i 14 dagar. En månadskopia av det bokförda sparas lika länge som arkivet ovan. Den krypterade nattkopian hos Cloudflare R2 (avsnitt 4) sparas i 35 dagar, och en kopia av en fil som raderats i tjänsten tas bort därifrån efter 30 dagar.</li>
          <li style={policyLi}>Meddelanden via kontaktformuläret och supporten raderas automatiskt ur tjänsten ett år efter att de skickades. Mejlet med en eventuell bilaga finns kvar i vår inkorg hos one.com tills vi raderar det.</li>
          <li style={policyLi}>Teknisk logg-data sparas kortare tid, normalt några veckor, och används enbart för drift och säkerhet.</li>
          <li style={policyLi}>Uppladdade filer (kvitton, underlag, logotyper) som ingen post i tjänsten längre hänvisar till raderas automatiskt efter sju dagar, av ett jobb som körs varje dygn.</li>
          <li style={policyLi}>Ett konto där prenumerationen aldrig startats raderas automatiskt sju dagar efter registreringen, inklusive de företags- och kontaktuppgifter som fyllts i. Konton med bokförd information raderas aldrig på det här sättet.</li>
        </ul>
      </PolicySection>

      <PolicySection n={8} title="Dina rättigheter">
        <p style={policyP}>Enligt GDPR har du rätt att:</p>
        <ul style={policyUl}>
          <li style={policyLi}>Få ett utdrag av vilka uppgifter vi har om dig (du kan även exportera all din data direkt i appen under Inställningar → Import och export).</li>
          <li style={policyLi}>Få felaktiga uppgifter rättade.</li>
          <li style={policyLi}>Begära radering av dina uppgifter, med undantag för sådant vi är skyldiga att bevara enligt bokföringslagen.</li>
          <li style={policyLi}>Invända mot eller begära begränsning av viss behandling.</li>
          <li style={policyLi}>Få ut dina uppgifter i ett maskinläsbart format (dataportabilitet).</li>
          <li style={policyLi}>Lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY), imy.se, om du anser att vi behandlar dina uppgifter felaktigt.</li>
        </ul>
      </PolicySection>

      <PolicySection n={9} title="Säkerhet">
        <p style={policyP}>
          Lösenord lagras aldrig i klartext. Data överförs krypterat (HTTPS/TLS). Åtkomst till din bokföringsdata skyddas av behörighetskontroller på databasnivå (Row Level Security) så att endast du kan läsa och skriva din egen data.
        </p>
        <p style={policyP}>
          Du kan slå på tvåstegsverifiering och logga in med Face ID eller fingeravtryck under Inställningar → Säkerhet. Använder du inte Bokix på 30 dagar loggas du ut automatiskt. Lösenord och nycklar till din egen e-post (avsnitt 5) lagras krypterade och kan bara läsas av våra servrar. Texten på kvitton och underlag du laddar upp (foton och PDF) läses av Google Cloud Vision, som får en nedskalad kopia av bilden eller själva PDF-filen, se avsnitt 4. Går läsningen inte att göra hos Google fyller du i uppgifterna själv; kvittot skickas inte någon annanstans.
        </p>
      </PolicySection>

      <PolicySection n={10} title="Cookies">
        <p style={policyP}>
          Vi använder ett litet antal cookies och liknande tekniker (t.ex. localStorage) för inloggning och grundfunktion — se vår <Link to="/cookies" style={link}>Cookiepolicy</Link> för en fullständig lista.
        </p>
      </PolicySection>

      <PolicySection n={11} title="Personuppgiftsbiträdesavtal (PUB) för dig som företagskund">
        <p style={policyP}>
          De kund-, leverantörs- och anställduppgifter du själv registrerar i din bokföring (t.ex. dina kunders namn/adress, eller dina anställdas personnummer och lön i lönemodulen) ägs och ansvaras för av DIG — du är personuppgiftsansvarig för dem. Bokix behandlar dem enbart på dina instruktioner, som personuppgiftsbiträde. Villkoren för det regleras i vårt <Link to="/pub" style={link}>personuppgiftsbiträdesavtal (PUB)</Link>, som gäller automatiskt för alla företagskunder från och med att du använder tjänsten. Har du frågor kring det, kontakta <a href="mailto:support@bokix.se" style={link}>support@bokix.se</a>.
        </p>
      </PolicySection>

      <PolicySection n={12} title="Ändringar i denna policy">
        <p style={policyP}>
          Om vi gör väsentliga ändringar i hur vi behandlar dina uppgifter meddelar vi det i tjänsten innan ändringen börjar gälla. Datumet högst upp på sidan visar när policyn senast uppdaterades.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
