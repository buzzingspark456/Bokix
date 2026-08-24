import { Link } from 'react-router-dom';

// ── Sida 37 ─────────────────────────────────────────────────────────────
// JURIDISKT UTKAST, INTE GRANSKAT. Ett första utkast, inte ett
// färdiggranskat juridiskt dokument. Innan sidan går live i produktion
// måste en jurist läsa igenom och godkänna innehållet.
//
// Bolagsidentitet bekräftad av kunden (samma som PrivacyPolicy.jsx,
// avsnitt 1) — Bokix, Strömsörgatan 19, Skellefteå. Bolagsform/org.nr
// medvetet UTELÄMNADE här — se motsvarande kommentar i PrivacyPolicy.jsx
// för varför.

const h2 = { marginTop: '36px', marginBottom: '12px', fontSize: '19px', fontWeight: 800, color: '#0f172a' };
const p = { marginBottom: '14px', lineHeight: 1.8, color: '#475569', fontSize: '15px' };
const li = { marginBottom: '8px', lineHeight: 1.75, color: '#475569', fontSize: '15px' };
const ul = { margin: '0 0 16px', paddingLeft: '22px' };
const warnBox = { margin: '16px 0', padding: '18px 20px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px' };
const warnP = { margin: 0, lineHeight: 1.8, color: '#991b1b', fontSize: '14.5px' };

export default function TermsPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '48px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '8px', fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 800 }}>Användarvillkor</h1>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '28px' }}>Senast uppdaterad: {new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

        <p style={p}>
          Dessa villkor ("Villkoren") ingås mellan dig/ditt företag och Bokix, Strömsörgatan 19, Skellefteå ("Bokix", "vi", "oss"), och styr din och ditt företags användning av tjänsten Bokix. Genom att skapa ett konto eller använda tjänsten godkänner du Villkoren och vår <Link to="/privacy" style={{ color: '#3d7a2e', fontWeight: 600 }}>Integritetspolicy</Link>. Om du använder tjänsten för ett företags räkning intygar du att du har behörighet att binda företaget till dessa Villkor.
        </p>

        <h2 style={h2}>1. Vad tjänsten är</h2>
        <p style={p}>
          Bokix är ett webbaserat verktyg för löpande bokföring, fakturering, kvitto-/utgiftshantering, lönekörning och underlag inför skattedeklarationer, byggt för svenska småföretag. Tjänsten hjälper dig strukturera och beräkna din bokföring — den ersätter inte revisor, redovisningskonsult eller Skatteverkets egna e-tjänster.
        </p>

        <h2 style={h2}>2. Konto och prenumeration</h2>
        <ul style={ul}>
          <li style={li}>Du måste vara minst 18 år och ha rätt att företräda det företag du registrerar för att skapa ett konto.</li>
          <li style={li}>Du ansvarar för att uppgifterna du lämnar vid registrering är korrekta, och för att hålla ditt lösenord hemligt.</li>
          <li style={li}>Tjänsten erbjuds mot en månadsavgift enligt gällande prissättning (se <Link to="/priser" style={{ color: '#3d7a2e', fontWeight: 600 }}>bokix.se/priser</Link>), med en kostnadsfri provperiod om 30 dagar. Inget kreditkort krävs för att starta provperioden.</li>
          <li style={li}>Du kan säga upp din prenumeration när som helst — det finns ingen bindningstid. Uppsägning sker under Inställningar i tjänsten.</li>
          <li style={li}>Redan betalda avgifter återbetalas inte för påbörjade perioder, om inte annat följer av tvingande konsumenträtt.</li>
        </ul>

        <h2 style={h2}>3. Ditt ansvar som användare</h2>
        <p style={p}>Du ansvarar för:</p>
        <ul style={ul}>
          <li style={li}>Att den bokföringsdata, de kunduppgifter och de leverantörsuppgifter du matar in är korrekta.</li>
          <li style={li}>Att inte använda tjänsten för olagliga ändamål, för att bokföra fiktiva transaktioner, eller för att kringgå skattelagstiftning.</li>
          <li style={li}>Att inte försöka bryta tjänstens säkerhet, avkoda dess källkod, eller belasta den på ett sätt som stör andra användare.</li>
          <li style={li}>Att hålla dina inloggningsuppgifter säkra och meddela oss omgående vid misstänkt obehörig åtkomst till ditt konto.</li>
        </ul>

        <h2 style={h2}>4. Användning och lagstiftning (Bokföringslagen)</h2>
        <p style={p}>
          Tjänsten är ett verktyg för att underlätta din bokföring. Enligt <strong>Bokföringslagen</strong> (se bfn.se) är det alltid du som företagare som bär det yttersta och fulla ansvaret för att din bokföring, dina skatteinbetalningar och dina deklarationer är korrekta och lämnas in i tid till Skatteverket och andra myndigheter. Bokix genererar underlag och beräkningar — det är ditt ansvar att granska dem innan de skickas in eller läggs till grund för betalning.
        </p>

        <h2 style={h2}>5. Friskrivning från följdfel och ekonomiskt ansvar</h2>
        <div style={warnBox}>
          <p style={warnP}>
            Bokix frånsäger sig uttryckligen allt ekonomiskt ansvar för felaktiga skatteinbetalningar, missade deklarationer, förseningsavgifter, skattetillägg eller andra direkta eller indirekta ekonomiska skador som kunden drabbas av, oavsett om dessa beror på handhavandefel, mjukvarubuggar, avbrott i tjänsten eller förlorad data. Genom att använda Bokix accepterar du att du ensam ansvarar för att granska och godkänna all redovisningsdata innan den används för skattedeklarationer eller årsredovisningar.
          </p>
        </div>
        <p style={p}>
          Vårt totala ansvar gentemot dig, oavsett grund, är i alla händelser begränsat till det belopp du betalat för tjänsten under de senaste tre (3) månaderna.
        </p>

        <h2 style={h2}>6. Drift och tillgänglighet</h2>
        <p style={p}>
          Vi strävar efter hög tillgänglighet men garanterar inte att tjänsten är felfri eller tillgänglig utan avbrott. Planerat underhåll meddelas när det är praktiskt möjligt. Vi rekommenderar att du regelbundet exporterar din data (Inställningar → Data och Inställningar) som en egen säkerhetskopia.
        </p>
        <p style={p}>
          Bokix är byggt på och beroende av tredjepartsleverantörer (bland annat Supabase, Stripe, Resend och Vercel — se <Link to="/privacy" style={{ color: '#3d7a2e', fontWeight: 600 }}>Integritetspolicyn</Link>, avsnitt 4). Driftstörningar hos en sådan leverantör kan påverka tjänstens tillgänglighet, och vi ansvarar inte för avbrott som orsakas utanför vår egen kontroll.
        </p>
        <p style={p}>
          Ingen av parterna ansvarar för underlåtenhet att uppfylla dessa Villkor om det beror på omständigheter utanför partens rimliga kontroll (force majeure), till exempel naturkatastrof, krig, myndighetsbeslut, arbetsmarknadskonflikt eller omfattande avbrott hos internet-/molntjänstleverantörer.
        </p>

        <h2 style={h2}>7. Din data</h2>
        <p style={p}>
          Du äger din bokföringsdata. Vi använder den bara för att leverera tjänsten till dig, aldrig för att sälja den vidare. Du kan exportera all din data när som helst i tjänsten. Vid uppsägning av kontot bevarar vi bokföringsdata så länge bokföringslagen kräver det (normalt sju år), men slutar ta betalt och stänger av åtkomsten till det aktiva gränssnittet.
        </p>

        <h2 style={h2}>8. Immateriella rättigheter</h2>
        <p style={p}>
          Bokix, dess varumärke, design och källkod tillhör oss. Du får en icke-exklusiv, ej överlåtbar rätt att använda tjänsten så länge din prenumeration är aktiv. Du behåller full äganderätt till den data du själv lägger in.
        </p>

        <h2 style={h2}>9. Uppsägning från vår sida</h2>
        <p style={p}>
          Vi kan stänga av eller avsluta ditt konto om du bryter mot dessa Villkor, till exempel genom att använda tjänsten för olagliga ändamål. Vi meddelar dig om detta och ger dig, om möjligt, tillfälle att exportera din data innan kontot avslutas.
        </p>

        <h2 style={h2}>10. Ändringar</h2>
        <p style={p}>
          Vi kan uppdatera Villkoren vid behov, till exempel vid nya funktioner eller ändrad lagstiftning. Väsentliga ändringar meddelas via tjänsten i god tid innan de träder i kraft. Datumet högst upp på sidan visar när Villkoren senast uppdaterades.
        </p>

        <h2 style={h2}>11. Tillämplig lag</h2>
        <p style={p}>
          Dessa Villkor regleras av svensk lag. Tvister ska i första hand lösas genom dialog; i andra hand avgörs de av svensk allmän domstol.
        </p>

        <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
          <div style={{ display: 'flex', gap: '16px' }}>
            <Link to="/privacy" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Integritetspolicy</Link>
            <Link to="/cookies" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>Cookiepolicy</Link>
            <Link to="/pub" style={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', fontSize: '14px' }}>PUB-avtal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
