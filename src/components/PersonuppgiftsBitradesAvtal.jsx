import { Link } from 'react-router-dom';

// ── Sida 37 ─────────────────────────────────────────────────────────────
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

const h2 = { marginTop: '36px', marginBottom: '12px', fontSize: '19px', fontWeight: 800, color: '#0f172a' };
const p = { marginBottom: '14px', lineHeight: 1.8, color: '#475569', fontSize: '15px' };
const li = { marginBottom: '8px', lineHeight: 1.75, color: '#475569', fontSize: '15px' };
const ul = { margin: '0 0 16px', paddingLeft: '22px' };
const table = { width: '100%', borderCollapse: 'collapse', margin: '12px 0 20px', fontSize: '13.5px' };
const th = { textAlign: 'left', padding: '9px 12px', background: '#f1f5f9', color: '#334155', fontWeight: 700, borderBottom: '2px solid #e2e8f0' };
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', verticalAlign: 'top' };
const infoBox = { margin: '16px 0', padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' };
const infoP = { margin: 0, lineHeight: 1.75, color: '#15803d', fontSize: '14.5px', fontWeight: 600 };

export default function PersonuppgiftsBitradesAvtal() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '48px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '8px', fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 800 }}>Personuppgiftsbiträdesavtal (PUB)</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px' }}>Senast uppdaterad: {new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <div style={infoBox}>
          <p style={infoP}>
            Det här avtalet gäller automatiskt mellan dig/ditt företag ("Personuppgiftsansvarig") och Bokix ("Personuppgiftsbiträde") så fort du använder tjänsten för att behandla dina kunders, leverantörers eller anställdas personuppgifter — du behöver inte skriva under något separat för att det ska gälla. Vill du ha ett undertecknat exemplar för egen dokumentation, kontakta support@bokix.se.
          </p>
        </div>

        <p style={p}>
          Det här avtalet ("PUB") reglerar Bokix behandling av personuppgifter för din räkning, i enlighet med artikel 28 i EU:s dataskyddsförordning (GDPR). Det kompletterar <Link to="/terms" style={{ color: '#3d7a2e', fontWeight: 600 }}>Användarvillkoren</Link> och <Link to="/privacy" style={{ color: '#3d7a2e', fontWeight: 600 }}>Integritetspolicyn</Link> — vid en eventuell motsägelse gäller det här avtalet för just den personuppgiftsbehandling det beskriver.
        </p>

        <h2 style={h2}>1. Parter</h2>
        <p style={p}>
          <strong>Personuppgiftsansvarig:</strong> du/ditt företag, det Bokix-konto som ingår avtalet genom att använda tjänsten.
        </p>
        <p style={p}>
          <strong>Personuppgiftsbiträde:</strong> Bokix, Strömsörgatan 19, Skellefteå. Organisationsnummer lämnas på begäran via support@bokix.se.
        </p>

        <h2 style={h2}>2. Föremål och varaktighet</h2>
        <p style={p}>
          Bokix behandlar personuppgifter för din räkning i den utsträckning det krävs för att leverera bokförings-, fakturerings-, kvitto-/utgifts- och lönetjänsterna du valt att använda. Behandlingen pågår så länge ditt konto är aktivt, och upphör enligt avsnitt 8 nedan när det avslutas.
        </p>

        <h2 style={h2}>3. Vilka uppgifter och registrerade som omfattas</h2>
        <table style={table}>
          <thead>
            <tr><th style={th}>Kategori av registrerade</th><th style={th}>Typ av personuppgifter</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>Dina kunder och leverantörer</td>
              <td style={td}>Namn, adress, e-post, telefon, organisations-/personnummer, betalningshistorik</td>
            </tr>
            <tr>
              <td style={td}>Dina anställda (om du använder lönemodulen)</td>
              <td style={td}>Namn, personnummer, adress, bankkontonummer, lön, skattetabell, anställningsvillkor</td>
            </tr>
            <tr>
              <td style={td}>Övriga kontakter du registrerar</td>
              <td style={td}>Namn och kontaktuppgifter du själv väljer att lägga in i bokföringen</td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>4. Bokix skyldigheter</h2>
        <ul style={ul}>
          <li style={li}>Behandlar personuppgifterna bara enligt dina dokumenterade instruktioner — i praktiken det som följer av att du använder tjänstens funktioner (t.ex. att skapa en faktura innebär en instruktion att behandla mottagarens namn och adress för det ändamålet).</li>
          <li style={li}>Säkerställer att personal med åtkomst till uppgifterna omfattas av sekretess.</li>
          <li style={li}>Vidtar lämpliga tekniska och organisatoriska säkerhetsåtgärder enligt artikel 32 — se avsnitt 6.</li>
          <li style={li}>Bistår dig, i den mån det är rimligt, med att svara på registrerades förfrågningar (t.ex. utdrag, rättelse, radering) som rör uppgifter du behandlar i tjänsten.</li>
          <li style={li}>Bistår dig vid konsekvensbedömningar och samråd med tillsynsmyndighet, om du begär det och det rör behandling i tjänsten.</li>
          <li style={li}>Underrättar dig utan onödigt dröjsmål vid en personuppgiftsincident som rör din data — se avsnitt 7.</li>
          <li style={li}>Raderar eller återlämnar uppgifterna vid avtalets slut, enligt avsnitt 8.</li>
        </ul>

        <h2 style={h2}>5. Underbiträden</h2>
        <p style={p}>
          Du godkänner härmed generellt att Bokix anlitar följande underbiträden för att leverera tjänsten. Samma lista som <Link to="/privacy" style={{ color: '#3d7a2e', fontWeight: 600 }}>Integritetspolicyns</Link> avsnitt 4 — håll koll där om listan uppdateras.
        </p>
        <table style={table}>
          <thead>
            <tr><th style={th}>Underbiträde</th><th style={th}>Roll</th></tr>
          </thead>
          <tbody>
            <tr><td style={td}>Supabase</td><td style={td}>Databas och autentisering — all bokförings- och kontodata</td></tr>
            <tr><td style={td}>Stripe</td><td style={td}>Betalningar (dina kortbetalningar från kunder, samt Bokix egen fakturering)</td></tr>
            <tr><td style={td}>Resend</td><td style={td}>Utskick av fakturor/offerter du väljer att mejla</td></tr>
            <tr><td style={td}>Vercel (inkl. BotID)</td><td style={td}>Drift/hosting av tjänsten samt bot-/missbruksskydd</td></tr>
          </tbody>
        </table>
        <p style={p}>
          Bokix meddelar dig om nya underbiträden läggs till eller byts ut (via ändring av den här sidan och Integritetspolicyn), så du har möjlighet att invända. Bokix ansvarar för att varje underbiträde är bundet av samma dataskyddsåtaganden som gäller enligt det här avtalet.
        </p>

        <h2 style={h2}>6. Säkerhetsåtgärder</h2>
        <p style={p}>Utöver det som redan beskrivs i Integritetspolicyn tillämpar Bokix bland annat:</p>
        <ul style={ul}>
          <li style={li}>Kryptering av data under överföring (HTTPS/TLS) och lösenord som aldrig lagras i klartext.</li>
          <li style={li}>Radnivåsäkerhet (Row Level Security) i databasen, så att varje konto bara kan läsa och skriva sin egen data — även Bokix egen personal saknar direkt åtkomst till enskilda kunders data i normal drift.</li>
          <li style={li}>Möjlighet till tvåfaktorsautentisering (2FA) på ditt konto.</li>
          <li style={li}>Behörighetsstyrd åtkomst hos underbiträden (t.ex. separata, begränsade API-nycklar per funktion snarare än en enda allomfattande nyckel).</li>
        </ul>

        <h2 style={h2}>7. Personuppgiftsincidenter</h2>
        <p style={p}>
          Upptäcker Bokix en personuppgiftsincident (t.ex. obehörig åtkomst till, förlust av, eller läckage av data du behandlar i tjänsten) underrättar vi dig utan onödigt dröjsmål, med den information vi har tillgänglig, så att du kan uppfylla din egen anmälningsskyldighet gentemot Integritetsskyddsmyndigheten (IMY) inom 72 timmar om det krävs.
        </p>

        <h2 style={h2}>8. Radering och återlämning vid avtalets slut</h2>
        <p style={p}>
          När du avslutar ditt konto slutar Bokix ta betalt och stänger av åtkomsten till det aktiva gränssnittet. Du kan exportera all din data när som helst innan dess (Inställningar → Data och Inställningar). Bokföringsdata bevaras därefter i den utsträckning bokföringslagen kräver (normalt sju år) innan den raderas eller anonymiseras — det här avtalet begränsar inte den lagstadgade skyldigheten. Uppgifter som inte omfattas av ett sådant lagkrav raderas inom rimlig tid efter kontots avslut.
        </p>

        <h2 style={h2}>9. Revisionsrätt</h2>
        <p style={p}>
          Du har rätt att, med rimligt varsel och under normal arbetstid, begära information som visar att Bokix uppfyller sina skyldigheter enligt det här avtalet. Bokix kan i första hand fullgöra det genom att tillhandahålla relevant dokumentation istället för en fysisk revision på plats.
        </p>

        <h2 style={h2}>10. Ansvar</h2>
        <p style={p}>
          Respektive parts ansvar för skada till följd av behandling i strid med GDPR eller det här avtalet regleras av GDPR artikel 82 och, i övrigt, av ansvarsbegränsningen i <Link to="/terms" style={{ color: '#3d7a2e', fontWeight: 600 }}>Användarvillkoren</Link>.
        </p>

        <h2 style={h2}>11. Tillämplig lag</h2>
        <p style={p}>
          Det här avtalet regleras av svensk lag, i övrigt på samma villkor som anges i Användarvillkoren.
        </p>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link to="/privacy" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Integritetspolicy</Link>
            <Link to="/terms" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Användarvillkor</Link>
            <Link to="/cookies" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Cookiepolicy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
