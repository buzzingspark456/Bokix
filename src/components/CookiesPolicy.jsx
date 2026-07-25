import { Link } from 'react-router-dom';

export default function CookiesPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '24px', fontSize: 'clamp(32px, 4vw, 42px)', fontWeight: 800 }}>Cookies</h1>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Vi använder cookies och liknande tekniker för att förbättra upplevelsen och analysera hur tjänsten används.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Vilka cookies används?</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Vi använder nödvändiga cookies för att hantera din session och optional tracking cookies för att förstå hur användare interagerar med sidan.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Hur du kan hantera cookies</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Du kan blockera cookies i din webbläsare, men då kan vissa funktioner i Bokföring.io sluta fungera.
        </p>
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
        </div>
      </div>
    </div>
  );
}
