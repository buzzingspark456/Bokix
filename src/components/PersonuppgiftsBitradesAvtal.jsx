import { Link } from 'react-router-dom';
import { Handshake } from 'lucide-react';
import { PolicyLayout, PolicySection, PolicyTable, PolicyCallout, policyP, policyLi, policyUl } from './marketing/PolicyLayout';
import { ACCENT } from './marketing/marketingTokens';

// JURIDISKT UTKAST, INTE GRANSKAT. Precis som PrivacyPolicy.jsx/
// TermsPolicy.jsx/CookiesPolicy.jsx: ett första utkast byggt på standard-
// innehållet GDPR artikel 28.3 kräver av ett personuppgiftsbiträdesavtal
// (PUB), inte ett dokument en jurist redan granskat och godkänt. Läs igenom
// och godkänn innan avtalet börjar gälla skarpt mot företagskunder.
//
// Modellen som valts: ett STÅENDE, publikt PUB som gäller automatiskt för
// alla företagskunder i och med att tjänsten används (samma mönster som
// t.ex. Vercels och GitHubs egna DPA-sidor) — inte ett dokument som skickas
// för separat underskrift per kund. Länkad från PrivacyPolicy.jsx avsnitt
// 10. Om ni istället vill kräva en aktiv, signerad accept per företagskund
// (t.ex. vid registrering) är det en produktändring utöver den här sidan.
//
// Underbiträdes-listan i avsnitt 5 MÅSTE hållas i synk med PrivacyPolicy.jsx
// avsnitt 4 (Supabase/Stripe/Resend/Vercel/Vercel BotID) — samma
// leverantörer, två ställen, lätt att glömma bort det ena vid en ändring.
//
// Kundönskemål ("gör policysidorna organiserade") — samma ombyggnad som
// TermsPolicy.jsx/CookiesPolicy.jsx: från en fristående vit box utan
// sajt-header/footer till samma delade PolicyLayout-system som
// PrivacyPolicy.jsx. Samma accentfärg (blå) som Privacy, medvetet — de två
// hör ihop tematiskt (persondata/GDPR), till skillnad från Terms (grönt)
// och Cookies (turkos) som är egna ämnen.
export default function PersonuppgiftsBitradesAvtal() {
  return (
    <PolicyLayout
      icon={Handshake}
      title="Personuppgiftsbiträdesavtal"
      accent={ACCENT.blue}
      path="/pub"
      updated="2026-09-07"
      metaTitle="Personuppgiftsbiträdesavtal (PUB) | Bokix"
      metaDescription="Villkoren för Bokix behandling av personuppgifter för din räkning, enligt artikel 28 i GDPR — gäller automatiskt för alla företagskunder."
      intro="Reglerar Bokix behandling av personuppgifter för din räkning, i enlighet med artikel 28 i EU:s dataskyddsförordning (GDPR)."
    >
      <PolicySection n={1} title="Parter" first>
        <PolicyCallout tone="good">
          Det här avtalet gäller automatiskt mellan dig/ditt företag ("Personuppgiftsansvarig") och Bokix ("Personuppgiftsbiträde") så fort du använder tjänsten för att behandla dina kunders, leverantörers eller anställdas personuppgifter — du behöver inte skriva under något separat för att det ska gälla. Vill du ha ett undertecknat exemplar för egen dokumentation, kontakta support@bokix.se.
        </PolicyCallout>
        <p style={policyP}>
          Det här avtalet ("PUB") kompletterar <Link to="/terms" style={{ color: ACCENT.green.fg, fontWeight: 600 }}>Användarvillkoren</Link> och <Link to="/privacy" style={{ color: ACCENT.blue.fg, fontWeight: 600 }}>Integritetspolicyn</Link> — vid en eventuell motsägelse gäller det här avtalet för just den personuppgiftsbehandling det beskriver.
        </p>
        <p style={policyP}>
          <strong>Personuppgiftsansvarig:</strong> du/ditt företag, det Bokix-konto som ingår avtalet genom att använda tjänsten.
        </p>
        <p style={policyP}>
          <strong>Personuppgiftsbiträde:</strong> Bokix, Strömsörgatan 19, Skellefteå. Organisationsnummer lämnas på begäran via support@bokix.se.
        </p>
      </PolicySection>

      <PolicySection n={2} title="Föremål och varaktighet">
        <p style={policyP}>
          Bokix behandlar personuppgifter för din räkning i den utsträckning det krävs för att leverera bokförings-, fakturerings-, kvitto-/utgifts- och lönetjänsterna du valt att använda. Behandlingen pågår så länge ditt konto är aktivt, och upphör enligt avsnitt 8 nedan när det avslutas.
        </p>
      </PolicySection>

      <PolicySection n={3} title="Vilka uppgifter och registrerade som omfattas">
        <PolicyTable
          head={['Kategori av registrerade', 'Typ av personuppgifter']}
          rows={[
            ['Dina kunder och leverantörer', 'Namn, adress, e-post, telefon, organisations-/personnummer, betalningshistorik'],
            ['Dina anställda (om du använder lönemodulen)', 'Namn, personnummer, adress, bankkontonummer, lön, skattetabell, anställningsvillkor'],
            ['Övriga kontakter du registrerar', 'Namn och kontaktuppgifter du själv väljer att lägga in i bokföringen'],
          ]}
        />
      </PolicySection>

      <PolicySection n={4} title="Bokix skyldigheter">
        <ul style={policyUl}>
          <li style={policyLi}>Behandlar personuppgifterna bara enligt dina dokumenterade instruktioner — i praktiken det som följer av att du använder tjänstens funktioner (t.ex. att skapa en faktura innebär en instruktion att behandla mottagarens namn och adress för det ändamålet).</li>
          <li style={policyLi}>Säkerställer att personal med åtkomst till uppgifterna omfattas av sekretess.</li>
          <li style={policyLi}>Vidtar lämpliga tekniska och organisatoriska säkerhetsåtgärder enligt artikel 32 — se avsnitt 6.</li>
          <li style={policyLi}>Bistår dig, i den mån det är rimligt, med att svara på registrerades förfrågningar (t.ex. utdrag, rättelse, radering) som rör uppgifter du behandlar i tjänsten.</li>
          <li style={policyLi}>Bistår dig vid konsekvensbedömningar och samråd med tillsynsmyndighet, om du begär det och det rör behandling i tjänsten.</li>
          <li style={policyLi}>Underrättar dig utan onödigt dröjsmål vid en personuppgiftsincident som rör din data — se avsnitt 7.</li>
          <li style={policyLi}>Raderar eller återlämnar uppgifterna vid avtalets slut, enligt avsnitt 8.</li>
        </ul>
      </PolicySection>

      <PolicySection n={5} title="Underbiträden">
        <p style={policyP}>
          Du godkänner härmed generellt att Bokix anlitar följande underbiträden för att leverera tjänsten. Samma lista som <Link to="/privacy" style={{ color: ACCENT.blue.fg, fontWeight: 600 }}>Integritetspolicyns</Link> avsnitt 4 — håll koll där om listan uppdateras.
        </p>
        <PolicyTable
          head={['Underbiträde', 'Roll']}
          rows={[
            ['Supabase', 'Databas och autentisering — all bokförings- och kontodata. Lagring inom EU (Frankfurt, Tyskland).'],
            ['Stripe', 'Betalningar (dina kortbetalningar från kunder, samt Bokix egen fakturering)'],
            ['Resend', 'Utskick av fakturor/offerter du väljer att mejla'],
            ['Vercel (inkl. BotID)', 'Drift/hosting av tjänsten samt bot-/missbruksskydd'],
            ['Google', 'Endast om du själv kopplat din Gmail-adress som avsändare — utskicket går då genom ditt eget konto. Bokix har enbart behörighet att skicka, aldrig att läsa.'],
          ]}
        />
        <p style={policyP}>
          Bokix meddelar dig om nya underbiträden läggs till eller byts ut (via ändring av den här sidan och Integritetspolicyn), så du har möjlighet att invända. Bokix ansvarar för att varje underbiträde är bundet av samma dataskyddsåtaganden som gäller enligt det här avtalet.
        </p>
      </PolicySection>

      <PolicySection n={6} title="Säkerhetsåtgärder">
        <p style={policyP}>Utöver det som redan beskrivs i Integritetspolicyn tillämpar Bokix bland annat:</p>
        <ul style={policyUl}>
          <li style={policyLi}>Kryptering av data under överföring (HTTPS/TLS) och lösenord som aldrig lagras i klartext.</li>
          <li style={policyLi}>Radnivåsäkerhet (Row Level Security) i databasen, så att varje konto bara kan läsa och skriva sin egen data — även Bokix egen personal saknar direkt åtkomst till enskilda kunders data i normal drift.</li>
          <li style={policyLi}>Möjlighet till tvåfaktorsautentisering (2FA) på ditt konto.</li>
          <li style={policyLi}>Behörighetsstyrd åtkomst hos underbiträden (t.ex. separata, begränsade API-nycklar per funktion snarare än en enda allomfattande nyckel).</li>
        </ul>
      </PolicySection>

      <PolicySection n={7} title="Personuppgiftsincidenter">
        <p style={policyP}>
          Upptäcker Bokix en personuppgiftsincident (t.ex. obehörig åtkomst till, förlust av, eller läckage av data du behandlar i tjänsten) underrättar vi dig utan onödigt dröjsmål, med den information vi har tillgänglig, så att du kan uppfylla din egen anmälningsskyldighet gentemot Integritetsskyddsmyndigheten (IMY) inom 72 timmar om det krävs.
        </p>
      </PolicySection>

      <PolicySection n={8} title="Radering och återlämning vid avtalets slut">
        <p style={policyP}>
          När du avslutar ditt konto slutar Bokix ta betalt och stänger av åtkomsten till det aktiva gränssnittet. Du kan exportera all din data när som helst innan dess (Inställningar → Data och Inställningar). Bokföringsdata bevaras därefter i den utsträckning bokföringslagen kräver (normalt sju år) innan den raderas eller anonymiseras — det här avtalet begränsar inte den lagstadgade skyldigheten. Uppgifter som inte omfattas av ett sådant lagkrav raderas inom rimlig tid efter kontots avslut.
        </p>
      </PolicySection>

      <PolicySection n={9} title="Revisionsrätt">
        <p style={policyP}>
          Du har rätt att, med rimligt varsel och under normal arbetstid, begära information som visar att Bokix uppfyller sina skyldigheter enligt det här avtalet. Bokix kan i första hand fullgöra det genom att tillhandahålla relevant dokumentation istället för en fysisk revision på plats.
        </p>
      </PolicySection>

      <PolicySection n={10} title="Ansvar">
        <p style={policyP}>
          Respektive parts ansvar för skada till följd av behandling i strid med GDPR eller det här avtalet regleras av GDPR artikel 82 och, i övrigt, av ansvarsbegränsningen i <Link to="/terms" style={{ color: ACCENT.green.fg, fontWeight: 600 }}>Användarvillkoren</Link>.
        </p>
      </PolicySection>

      <PolicySection n={11} title="Tillämplig lag">
        <p style={policyP}>
          Det här avtalet regleras av svensk lag, i övrigt på samma villkor som anges i Användarvillkoren.
        </p>
      </PolicySection>
    </PolicyLayout>
  );
}
