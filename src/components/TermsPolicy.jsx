import { Link } from 'react-router-dom';

export default function TermsPolicy() {
  return (
    <div style={{ minHeight: '100vh', padding: '48px 24px', background: '#f8fafc', color: '#111827', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '820px', margin: '0 auto', background: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
        <h1 style={{ marginBottom: '24px', fontSize: 'clamp(32px, 4vw, 42px)', fontWeight: 800 }}>Användarvillkor</h1>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Dessa villkor styr din användning av Bokix. Genom att använda tjänsten godkänner du dessa villkor och vår integritetspolicy.
        </p>
        
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Användning och Lagstiftning (Bokföringslagen)</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Tjänsten är ett verktyg för att underlätta din bokföring. Enligt <strong>Bokföringslagen</strong> (Bfn.se) är det alltid du som företagare som bär det yttersta och fulla ansvaret för att din bokföring, dina skatteinbetalningar och dina deklarationer är korrekta och inlämnas i tid till Skatteverket och andra myndigheter.
        </p>
        
        <h2 style={{ marginTop: '32px', marginBottom: '12px', fontSize: '18px', fontWeight: 700 }}>Friskrivning från följdfel och ekonomiskt ansvar</h2>
        <p style={{ marginBottom: '16px', lineHeight: 1.8, color: '#475569' }}>
          Bokix frånsäger sig uttryckligen allt ekonomiskt ansvar för felaktiga skatteinbetalningar, missade deklarationer, förseningsavgifter, skattetillägg eller andra direkt eller indirekt ekonomiska skador som kunden drabbas av, oavsett om dessa beror på handhavandefel, mjukvarubuggar, avbrott i tjänsten eller förlorad data. Genom att använda Bokix accepterar du att du ensam ansvarar för att granska och godkänna all redovisningsdata innan den används för skattedeklarationer eller årsredovisningar.
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
