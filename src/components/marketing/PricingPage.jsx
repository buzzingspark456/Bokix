import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, ChevronDown, ShieldCheck, Zap } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';

const INCLUDED = [
  'Obegränsat med kund- och leverantörsfakturor',
  'Fyra fakturamallar med egen logotyp och accentfärg',
  'Löpande bokföring och full kontoplan (BAS)',
  'Granskning, så inget bokförs fel utan att du ser det',
  'Moms-, AGI- och kontrolluppgiftssammanställningar',
  'Lönekörningar för hela personalen, med rätt skatteavdrag',
  'Kortbetalningar via Stripe',
  'PDF-export av allt, fakturor, lönebesked, deklarationsunderlag',
];

// Ärliga, konkreta frågor — inga påhittade "99% nöjda kunder"-svar.
const FAQ = [
  { q: 'Behöver jag ange kortuppgifter för att prova?', a: 'Nej. Du provar Bokix i 30 dagar helt gratis, utan kort och utan bindningstid.' },
  { q: 'Kan jag avsluta när som helst?', a: 'Ja. Det finns ingen uppsägningstid eller bindningstid, du avslutar när du vill.' },
  { q: 'Vilka bolagsformer stöds?', a: 'Bokix känner igen enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening utifrån organisationsnumret, och bokför enligt rätt regler för respektive form.' },
  { q: 'Ingår support i priset?', a: 'Ja, support ingår. Du når oss på support@bokix.se.' },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '20px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{q}</span>
        <ChevronDown size={18} color="#6b7280" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '200px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.65, padding: '0 4px 20px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

const TRUST_BITS = [
  { icon: ShieldCheck, text: 'Ingen bindningstid' },
  { icon: Zap, text: 'Igång på minuter' },
  { icon: CheckCircle, text: 'Alla funktioner ingår' },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });

  return (
    <MarketingLayout>
      <style>{`
        .pricing-feature-row { transition: transform 0.18s ease; }
        .pricing-feature-row:hover { transform: translateX(3px); }
      `}</style>

      <section style={{ padding: '150px 24px 70px', background: BRAND.greenLight, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'white', border: `1px solid ${BRAND.green}33`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px' }}>
            Inga dolda avgifter
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px', lineHeight: 1.1 }}>
            Ett pris. Allt ingår.
          </h1>
          <p style={{ fontSize: '17px', color: '#475569', lineHeight: 1.7 }}>
            Ingen "bas + tillägg per funktion"-modell att räkna ut. Ett pris, en faktura, allt du behöver.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 60px', background: 'white' }}>
        <Reveal scale style={{ maxWidth: '460px', margin: '0 auto' }}>
          <div style={{ background: 'white', border: `1.5px solid ${BRAND.green}`, borderRadius: '26px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(61,122,46,0.15)' }}>

            {/* Mörk topp-sektion för priset — bryter kortet i två zoner istället
                för en enda platt vit yta, så det känns som en riktig produkt
                snarare än en generisk prislista. */}
            <div style={{ background: BRAND.greenDark, padding: '38px 36px 34px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ fontSize: '56px', fontWeight: 900, letterSpacing: '-0.03em', color: 'white' }}>99 kr</span>
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}> /mån</span>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '6px' }}>Exkl. moms · avsluta när som helst</div>
              </div>
            </div>

            <div style={{ padding: '32px 36px 36px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', marginBottom: '28px', borderTop: '1px solid #f1f5f9', paddingTop: '22px' }}>
                {INCLUDED.map(f => (
                  <div key={f} className="pricing-feature-row" style={{ fontSize: '14px', color: '#374151', fontWeight: 500, lineHeight: 1.5 }}>{f}</div>
                ))}
              </div>
              <button className="lp-btn-primary" onClick={enterApp} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 2px 8px rgba(61,122,46,0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Kom igång gratis <ArrowRight size={16} />
              </button>
              <div style={{ textAlign: 'center', fontSize: '12.5px', color: '#9ca3af', marginTop: '14px' }}>Gratis i 30 dagar · inget kreditkort krävs</div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={80} style={{ maxWidth: '460px', margin: '28px auto 0', display: 'flex', justifyContent: 'center', gap: '22px', flexWrap: 'wrap' }}>
          {TRUST_BITS.map(t => (
            <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, color: '#64748b' }}>
              <t.icon size={14} color={BRAND.green} /> {t.text}
            </div>
          ))}
        </Reveal>
      </section>

      <section style={{ padding: '70px 24px 100px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 900, letterSpacing: '-0.02em', color: '#0f172a' }}>Vanliga frågor</h2>
          </Reveal>
          <Reveal delay={100} className="lp-card-hover" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '8px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
