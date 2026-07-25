import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '24px', fontSize: 'clamp(32px, 4vw, 42px)', fontWeight: 800 }}>Integritetspolicy</h1>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Bokföring.io värnar om din personliga integritet. Den här integritetspolicyn förklarar vilken information vi samlar in, varför vi samlar in den, och hur vi skyddar den.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Vilken data samlar vi in?</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Vi samlar in uppgifter som behövs för att driva din bokföring, inklusive företagsinformation, fakturor, verifikationer och användarkonton. Vi använder också teknisk data för att hålla tjänsten säker och fungera bra.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Hur använder vi informationen?</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Informationen används för att leverera och förbättra Bokföring.io, hantera ditt konto och kommunicera med dig. Vi delar inte personuppgifter med tredje part utan ditt medgivande, förutom vad som krävs enligt lag.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Kontakt</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Har du frågor om din integritet kan du kontakta oss via support@bokforing.io eller via kontaktsidan i appen.
        </p>
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
        </div>
      </div>
    </div>
  );
}
