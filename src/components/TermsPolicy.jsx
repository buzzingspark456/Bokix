import { Link } from 'react-router-dom';

export default function TermsPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '24px', fontSize: 'clamp(32px, 4vw, 42px)', fontWeight: 800 }}>Användarvillkor</h1>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Dessa villkor styr din användning av Bokix. Genom att använda tjänsten godkänner du dessa villkor och vår integritetspolicy.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Användning</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Tjänsten får användas för laglig bokföring och administration av företagets ekonomi. Du ansvarar för att uppgifter som matas in är korrekta och uppfyller gällande regelverk.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Ansvarsbegränsning</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Bokix ansvarar inte för ekonomiska skador som uppstår på grund av felaktig användning eller utebliven säkerhetskopiering av dina data.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Ändringar</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Vi kan uppdatera villkoren vid behov. Viktiga ändringar meddelas via tjänsten och träder i kraft när de publiceras.
        </p>
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
        </div>
      </div>
    </div>
  );
}
