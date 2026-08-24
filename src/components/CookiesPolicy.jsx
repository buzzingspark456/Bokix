import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

// ── Sida 37 ─────────────────────────────────────────────────────────────
// JURIDISKT UTKAST, INTE GRANSKAT. Texten på den här sidan (liksom
// PrivacyPolicy.jsx och TermsPolicy.jsx) är ett första utkast, inte ett
// färdiggranskat juridiskt dokument. Innan den här sidan går live i
// produktion måste: (1) en jurist faktiskt läsa igenom och godkänna
// innehållet, (2) företagets organisationsnummer och adress verifieras
// mot den faktiska, aktuella informationen (ingen platshållartext finns i
// den här filen idag, men kontrollera ändå att inget hunnit bli inaktuellt
// mellan detta utkast och lanseringen).

const h2 = { marginTop: '36px', marginBottom: '12px', fontSize: '19px', fontWeight: 800, color: '#0f172a' };
const p = { marginBottom: '14px', lineHeight: 1.8, color: '#475569', fontSize: '15px' };
const table = { width: '100%', borderCollapse: 'collapse', margin: '12px 0 20px', fontSize: '13.5px' };
const th = { textAlign: 'left', padding: '9px 12px', background: '#f1f5f9', color: '#334155', fontWeight: 700, borderBottom: '2px solid #e2e8f0' };
const td = { padding: '9px 12px', borderBottom: '1px solid #f1f5f9', color: '#475569', verticalAlign: 'top' };
const code = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' };
const goodBox = { margin: '16px 0', padding: '16px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px' };
const goodP = { margin: 0, lineHeight: 1.75, color: '#15803d', fontSize: '14.5px', fontWeight: 600 };

// Bugfix: se motsvarande kommentar i PrivacyPolicy.jsx — var new Date() vid
// render, visade alltid dagens datum istället för det faktiska ändringsdatumet.
const LAST_UPDATED = '24 augusti 2026';

export default function CookiesPolicy() {
  useDocumentMeta({
    title: 'Cookiepolicy | Bokix',
    description: 'Vilka cookies Bokix använder, varför, och hur du styr ditt samtycke. Inga marknadsföringscookies.',
    path: '/cookies',
  });
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '48px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '8px', fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 800 }}>Cookiepolicy</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px' }}>Senast uppdaterad: {LAST_UPDATED}</p>

        <div style={goodBox}>
          <p style={goodP}>Bokix använder inga marknadsförings- eller reklamcookies. Vi använder Google Analytics för grundläggande besöksstatistik, men bara om du aktivt godkänt det i cookiebannern — den sätts aldrig innan du sagt ja.</p>
        </div>

        <p style={p}>
          Den här sidan listar exakt vilka cookies och liknande lagringstekniker (t.ex. <code style={code}>localStorage</code>) Bokix faktiskt sätter i din webbläsare, inte en generisk mall. De nödvändiga cookies nedan kräver inget samtycke enligt gällande regler (de behövs för att logga in och för att tjänsten ska fungera), men analyscookies gör det, och visas bara efter att du klickat "Acceptera alla" i cookiebannern som visas vid ditt första besök.
        </p>

        <h2 style={h2}>Strikt nödvändiga — inloggning och session</h2>
        <table style={table}>
          <thead>
            <tr><th style={th}>Namn</th><th style={th}>Typ</th><th style={th}>Ändamål</th><th style={th}>Livslängd</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}><code style={code}>sb-*-auth-token</code></td>
              <td style={td}>localStorage</td>
              <td style={td}>Håller dig inloggad mellan sidladdningar (sätts av vår inloggningsleverantör Supabase).</td>
              <td style={td}>Tills du loggar ut, eller sessionen löper ut</td>
            </tr>
            <tr>
              <td style={td}><code style={code}>bokforing_data</code></td>
              <td style={td}>localStorage</td>
              <td style={td}>Lokal cachekopia av din bokföringsdata, så appen fungerar även vid tillfälligt avbrott mot servern.</td>
              <td style={td}>Tills den skrivs över eller rensas manuellt</td>
            </tr>
            <tr>
              <td style={td}><code style={code}>bokix_onboarding_completed</code> / <code style={code}>_skipped</code></td>
              <td style={td}>localStorage</td>
              <td style={td}>Kommer ihåg om du gått igenom (eller hoppat över) startguiden, så den inte visas igen i onödan.</td>
              <td style={td}>Tills du rensar webbläsardata</td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>Strikt nödvändiga — säkerhet vid bankkoppling till Stripe</h2>
        <table style={table}>
          <thead>
            <tr><th style={th}>Namn</th><th style={th}>Typ</th><th style={th}>Ändamål</th><th style={th}>Livslängd</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}><code style={code}>bokix_stripe_oauth_state</code></td>
              <td style={td}>Cookie (httpOnly)</td>
              <td style={td}>Skyddar mot förfalskade anslutningsförsök (CSRF) under de sekunder det tar att ansluta Stripe för kortbetalningar. Sätts bara om du aktivt startar den anslutningen under Inställningar.</td>
              <td style={td}>Max 10 minuter, raderas direkt efter anslutningen</td>
            </tr>
          </tbody>
        </table>

        <h2 style={h2}>Analys — kräver ditt samtycke</h2>
        <p style={p}>
          Vi använder Google Analytics för att förstå hur besökare hittar och använder Bokix marknadsföringssidor. Vi kör det via Googles "Consent Mode": mätscriptet laddas alltid, men det sätts uttryckligen till "nekad" (denied) tills du valt "Acceptera alla" i cookiebannern. Väljer du "Endast nödvändiga" stannar analys-cookies nekade, permanent, tills du själv ändrar dig via "Cookieinställningar" i sidfoten.
        </p>
        <table style={table}>
          <thead>
            <tr><th style={th}>Namn</th><th style={th}>Typ</th><th style={th}>Ändamål</th><th style={th}>Livslängd</th></tr>
          </thead>
          <tbody>
            <tr>
              <td style={td}><code style={code}>_ga</code> / <code style={code}>_gid</code></td>
              <td style={td}>Cookie (Google Analytics)</td>
              <td style={td}>Skiljer besökare åt för anonymiserad besöksstatistik. Sätts bara efter att du klickat "Acceptera alla".</td>
              <td style={td}>_ga: 2 år, _gid: 24 timmar</td>
            </tr>
            <tr>
              <td style={td}><code style={code}>bokix_cookie_consent</code></td>
              <td style={td}>Cookie</td>
              <td style={td}>Kommer ihåg ditt val i cookiebannern (accepterat eller nekat), så bannern inte visas på varje besök.</td>
              <td style={td}>12 månader</td>
            </tr>
          </tbody>
        </table>
        <p style={p}>
          Inga marknadsförings- eller reklamcookies används, oavsett vad du väljer i bannern. Vill du ändra ditt tidigare val, klicka "Cookieinställningar" längst ner på vilken sida som helst.
        </p>

        <h2 style={h2}>Hur du kan hantera cookies</h2>
        <p style={p}>
          Du kan blockera eller radera cookies och localStorage i din webbläsares inställningar när som helst. De nödvändiga cookies ovan krävs för grundfunktionen, så att blockera dem innebär att du blir utloggad och att onboarding-guiden kan visas igen, men ingen data i din faktiska bokföring påverkas (den ligger sparad hos oss, inte bara lokalt).
        </p>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link to="/privacy" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Integritetspolicy</Link>
            <Link to="/terms" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Användarvillkor</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
