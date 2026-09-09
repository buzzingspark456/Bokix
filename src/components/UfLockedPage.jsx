import React from 'react';
import { Lock, ArrowRight, GraduationCap } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { ufBlockedPage, UF_NAV_IDS, UF_NAV_LABELS } from '../utils/ufMode';

// Sidan man landar på om man ändå tar sig till en funktion som inte ingår
// i UF-läget — en bokmärkt URL-hash, en genväg från en annan sida, eller
// produktrundturen. Menyn döljer redan de här sidorna (App.jsx), så det
// här är inte huvudvägen; det är vad som händer när någon kommer förbi
// menyn.
//
// Varför inte bara skicka tillbaka till Startsidan: en tyst omdirigering
// ser ut som en bugg. Den som klickat på "Offerter" ska få veta att
// funktionen finns i Bokix men inte i UF-läget, och vad de gör i stället.
// Tonen är därför förklarande, inte avvisande — det här är inte en
// betalvägg, det är en produkt som är tillskuren för ett UF-år.
export default function UfLockedPage({ tabId, onNavigate }) {
  const page = ufBlockedPage(tabId);
  const label = page?.label || 'Den här funktionen';
  const body = page?.body
    // Generell text för en sida som inte har någon egen skriven. Kan bara
    // hända om någon lägger till en sida i appen utan att ta ställning
    // till UF-läget — ufPageState spärrar då sidan som förvalt läge, se
    // ufMode.js.
    || 'Den här delen av Bokix ingår inte i UF-läget. Den är byggd för företag som drivs vidare efter läsåret, med anställda, projekt eller avtalskunder.';
  const instead = page?.instead;

  return (
    <div style={{ maxWidth: '620px', margin: '0 auto', padding: '24px 0' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
        padding: '48px 28px', borderRadius: '18px',
        background: 'var(--bg-cream)', border: '1px solid var(--bg-cream-border)',
      }}>
        <div style={{
          width: 72, height: 72, borderRadius: '20px', background: 'var(--bg-card)', color: BRAND.green,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        }}>
          <Lock size={28} />
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 11px', borderRadius: '999px',
          background: BRAND.greenLight, color: BRAND.greenDark, fontSize: '11.5px', fontWeight: 800,
          letterSpacing: '0.03em', textTransform: 'uppercase', marginBottom: '12px',
        }}>
          <GraduationCap size={13} /> UF-läget
        </div>

        <h2 style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>
          {label} ingår inte i UF-läget
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: '440px', margin: '0 0 22px' }}>
          {body}
        </p>

        {instead && (
          <button className="btn btn-primary" onClick={() => onNavigate?.(instead.tab)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}>
            {instead.label} <ArrowRight size={15} />
          </button>
        )}

        {/* Vad man FAKTISKT har. Listan byggs ur UF_NAV_IDS så den aldrig
            kan råka räkna upp en sida som inte finns i menyn — den vanliga
            följdfrågan efter "det här går inte" är "vad går då?". */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--border-light)', width: '100%' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
            Det här har ni i UF-läget
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', justifyContent: 'center' }}>
            {UF_NAV_IDS.filter(id => id !== 'settings').map(id => (
              <button
                key={id} onClick={() => onNavigate?.(id)}
                style={{
                  padding: '6px 12px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  fontSize: '12.5px', fontWeight: 600, color: 'var(--text-secondary)',
                }}
              >
                {UF_NAV_LABELS[id] || id}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
