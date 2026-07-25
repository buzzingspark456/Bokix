import { Link } from 'react-router-dom';

export default function GDPRPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '24px', fontSize: 'clamp(32px, 4vw, 42px)', fontWeight: 800 }}>GDPR</h1>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Bokföring.io efterlever GDPR och behandlar personuppgifter enligt svensk och europeisk dataskyddslagstiftning.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Rättslig grund</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Vi behandlar data på grund av avtal, rättsliga förpliktelser och ditt samtycke där det är tillämpligt. Information sparas så länge det behövs för att leverera tjänsten.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Dina rättigheter</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Du har rätt att begära tillgång till, rättelse av eller radering av dina personuppgifter. Kontakta support@bokforing.io för att utöva dessa rättigheter.
        </p>
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Säkerhet</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Vi använder tekniska och organisatoriska åtgärder för att skydda uppgifterna mot obehörig åtkomst och förlust.
        </p>
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
        </div>
      </div>
    </div>
  );
}
