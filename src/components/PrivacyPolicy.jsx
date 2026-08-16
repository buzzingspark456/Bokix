import { Link } from 'react-router-dom';

// ── Sida 37 ─────────────────────────────────────────────────────────────
// JURIDISKT UTKAST, INTE GRANSKAT. Ett första utkast, inte ett
// färdiggranskat juridiskt dokument. Innan sidan går live i produktion
// måste en jurist läsa igenom och godkänna innehållet, och företagets
// organisationsnummer/adress verifieras mot aktuell information.

const h2 = { marginTop: '36px', marginBottom: '12px', fontSize: '19px', fontWeight: 800, color: '#0f172a' };
const h3 = { marginTop: '22px', marginBottom: '8px', fontSize: '15px', fontWeight: 700, color: '#0f172a' };
const p = { marginBottom: '14px', lineHeight: 1.8, color: '#475569', fontSize: '15px' };
const li = { marginBottom: '8px', lineHeight: 1.75, color: '#475569', fontSize: '15px' };
const ul = { margin: '0 0 16px', paddingLeft: '22px' };
const table = { width: '100%', borderCollapse: 'collapse', margin: '12px 0 20px', fontSize: '13.5px' };
const th = { textAlign: 'left', padding: '9px 12px', background: '#f1f5f9', color: '#334155', fontWeight: 700, borderBottom: '2px solid #e2e8f0' };
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', verticalAlign: 'top' };

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '48px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '8px', fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 800 }}>Integritetspolicy</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px' }}>Senast uppdaterad: {new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <p style={p}>
          Den här policyn förklarar vilken personuppgiftsinformation Bokix ("vi", "oss") samlar in när du använder tjänsten, varför, hur länge den sparas, och vilka rättigheter du har enligt EU:s dataskyddsförordning (GDPR). Den gäller både dig som skapar ett konto och de kund-/leverantörsuppgifter du själv lägger in i din bokföring.
        </p>

        <h2 style={h2}>1. Personuppgiftsansvarig</h2>
        <p style={p}>
          Bokix är personuppgiftsansvarig för de personuppgifter som behandlas i tjänsten. Har du frågor om hur dina uppgifter hanteras, eller vill utöva någon av dina rättigheter nedan, kontaktar du oss på <a href="mailto:support@bokix.se" style={{ color: '#3d7a2e', fontWeight: 600 }}>support@bokix.se</a>.
        </p>

        <h2 style={h2}>2. Vilka uppgifter vi samlar in</h2>
        <p style={p}>Vilka uppgifter som samlas in beror på hur du använder tjänsten:</p>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Kategori</th>
              <th style={th}>Exempel</th>
              <th style={th}>Varifrån</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}>Kontouppgifter</td>
              <td style={td}>Namn, e-postadress, lösenord (lagras hashat, aldrig i klartext)</td>
              <td style={td}>Du, vid registrering</td>
            </tr>
            <tr>
              <td style={td}>Företagsuppgifter</td>
              <td style={td}>Företagsnamn, organisationsnummer, adress, momsregistreringsnummer</td>
              <td style={td}>Du, vid företagsuppsättning</td>
            </tr>
            <tr>
              <td style={td}>Bokföringsdata</td>
              <td style={td}>Verifikationer, fakturor, kvitton, leverantörsuppgifter, kontoplan</td>
              <td style={td}>Du, löpande i tjänsten</td>
            </tr>
            <tr>
              <td style={td}>Personaluppgifter (om du använder löne­modulen)</td>
              <td style={td}>Anställdas namn, personnummer, lön, skattetabell, bankkontonummer</td>
              <td style={td}>Du, vid registrering av anställda</td>
            </tr>
            <tr>
              <td style={td}>Betalningsuppgifter</td>
              <td style={td}>Kortuppgifter hanteras aldrig av oss direkt — de går genom Stripe (se avsnitt 4)</td>
              <td style={td}>Stripe</td>
            </tr>
            <tr>
              <td style={td}>Teknisk data</td>
              <td style={td}>IP-adress, webbläsartyp, tidsstämplar för inloggning (för säkerhet och felsökning)</td>
              <td style={td}>Automatiskt</td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>3. Varför vi behandlar uppgifterna och den rättsliga grunden</h2>
        <ul style={ul}>
          <li style={li}><strong>Fullgörande av avtal</strong> — för att kunna leverera bokförings-, fakturerings- och löneverktyget du registrerat dig för (kontouppgifter, företagsuppgifter, bokföringsdata).</li>
          <li style={li}><strong>Rättslig förpliktelse</strong> — bokföringsdata du själv skapar i tjänsten omfattas av bokföringslagens krav på arkivering; vi raderar aldrig bokföringsdata i förtid enbart för att du säger upp kontot.</li>
          <li style={li}><strong>Berättigat intresse</strong> — teknisk data (IP, tidsstämplar) för att upptäcka missbruk, felsöka driftsproblem och hålla tjänsten säker.</li>
          <li style={li}><strong>Samtycke</strong> — om du väljer att koppla på integrationer (t.ex. Stripe för kortbetalningar) behandlas ytterligare uppgifter först när du aktivt ansluter dem, och du kan koppla från när du vill.</li>
        </ul>

        <h2 style={h2}>4. Vilka vi delar uppgifter med</h2>
        <p style={p}>Vi säljer aldrig dina uppgifter. Uppgifter delas bara med underleverantörer som behövs för att driva tjänsten:</p>
        <ul style={ul}>
          <li style={li}><strong>Supabase</strong> — databas- och autentiseringsleverantör. All bokförings- och kontodata lagras hos Supabase på våra vägnar.</li>
          <li style={li}><strong>Stripe</strong> — betalningsleverantör, används om du ansluter kortbetalningar för dina egna kundfakturor. Kortuppgifter går direkt till Stripe och passerar aldrig våra servrar.</li>
        </ul>
        <p style={p}>
          Vi delar aldrig uppgifter med tredje part för marknadsföringsändamål. Uppgifter kan lämnas ut om vi är skyldiga att göra det enligt lag, till exempel vid en begäran från Skatteverket eller en domstol.
        </p>

        <h2 style={h2}>5. Hur länge vi sparar uppgifterna</h2>
        <ul style={ul}>
          <li style={li}>Kontouppgifter sparas så länge du har ett aktivt konto, och raderas eller anonymiseras inom rimlig tid efter att kontot avslutats.</li>
          <li style={li}>Bokföringsdata (verifikationer, fakturor, kvitton) sparas i minst sju år efter räkenskapsårets utgång, i enlighet med bokföringslagens arkiveringskrav — även om du säger upp kontot.</li>
          <li style={li}>Teknisk logg-data sparas kortare tid, normalt några veckor, och används enbart för drift och säkerhet.</li>
        </ul>

        <h2 style={h2}>6. Dina rättigheter</h2>
        <p style={p}>Enligt GDPR har du rätt att:</p>
        <ul style={ul}>
          <li style={li}>Få ett utdrag av vilka uppgifter vi har om dig (du kan även exportera all din data direkt i appen under Inställningar → Data och Inställningar).</li>
          <li style={li}>Få felaktiga uppgifter rättade.</li>
          <li style={li}>Begära radering av dina uppgifter, med undantag för sådant vi är skyldiga att bevara enligt bokföringslagen.</li>
          <li style={li}>Invända mot eller begära begränsning av viss behandling.</li>
          <li style={li}>Få ut dina uppgifter i ett maskinläsbart format (dataportabilitet).</li>
          <li style={li}>Lämna in ett klagomål till Integritetsskyddsmyndigheten (IMY), imy.se, om du anser att vi behandlar dina uppgifter felaktigt.</li>
        </ul>

        <h2 style={h2}>7. Säkerhet</h2>
        <p style={p}>
          Lösenord lagras aldrig i klartext. Data överförs krypterat (HTTPS/TLS). Åtkomst till din bokföringsdata skyddas av behörighetskontroller på databasnivå (Row Level Security) så att endast du kan läsa och skriva din egen data.
        </p>

        <h2 style={h2}>8. Cookies</h2>
        <p style={p}>
          Vi använder ett litet antal cookies och liknande tekniker (t.ex. localStorage) för inloggning och grundfunktion — se vår <Link to="/cookies" style={{ color: '#3d7a2e', fontWeight: 600 }}>Cookiepolicy</Link> för en fullständig lista.
        </p>

        <h2 style={h2}>9. Ändringar i denna policy</h2>
        <p style={p}>
          Om vi gör väsentliga ändringar i hur vi behandlar dina uppgifter meddelar vi det i tjänsten innan ändringen börjar gälla. Datumet högst upp på sidan visar när policyn senast uppdaterades.
        </p>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link to="/terms" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Användarvillkor</Link>
            <Link to="/cookies" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Cookiepolicy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
