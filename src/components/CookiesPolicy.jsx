import { Link } from 'react-router-dom';

import { useState } from 'react';
import { getCookieConsent, saveCookieConsent } from '../utils/cookieConsent';

export default function CookiesPolicy() {
  const [consent, setConsent] = useState(() => getCookieConsent());
  const [analytics, setAnalytics] = useState(() => Boolean(getCookieConsent()?.analytics));

  const updateConsent = (analyticsEnabled) => {
    setConsent(saveCookieConsent({ analytics: analyticsEnabled }));
    setAnalytics(analyticsEnabled);
  };

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
          Du kan blockera cookies i din webbläsare, men då kan vissa funktioner i Bokix sluta fungera.
        </p>
        <div style={{ marginTop: '32px', padding: '18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
          <h2 style={{ marginBottom: '8px', fontSize: '18px', fontWeight: 700 }}>Ändra cookieval</h2>
          <p style={{ marginBottom: '12px', lineHeight: 1.7, color: '#475569', fontSize: '14px' }}>
            {consent ? `Senast sparat: ${consent.analytics ? 'nödvändiga och analyscookies' : 'endast nödvändiga cookies'}.` : 'Du har inte sparat något cookieval ännu.'}
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '14px', color: '#374151' }}>
            <input type="checkbox" checked={analytics} onChange={e => setAnalytics(e.target.checked)} />
            Tillåt analyscookies
          </label>
          <button onClick={() => updateConsent(analytics)} style={{ padding: '9px 16px', border: 'none', borderRadius: '9px', background: '#5ba85a', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Spara cookieval</button>
        </div>
        <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <Link to="/" style={{ color: '#0f172a', fontWeight: 700, textDecoration: 'none' }}>&larr; Tillbaka till startsidan</Link>
        </div>
      </div>
    </div>
  );
}
