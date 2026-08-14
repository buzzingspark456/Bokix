import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, ChevronDown, Sparkles, ShieldCheck, Zap } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';

const INCLUDED = [
  'Obegränsat med kund- och leverantörsfakturor',
  'Fyra fakturamallar med egen logotyp och accentfärg',
  'Löpande bokföring och full kontoplan (BAS)',
  'Granskning — inget bokförs fel utan att du ser det',
  'Moms-, AGI- och kontrolluppgiftssammanställningar',
  'Lönekörningar för hela personalen, med rätt skatteavdrag',
  'Kortbetalningar via Stripe',
  'PDF-export av allt — fakturor, lönebesked, deklarationsunderlag',
];

// Ärliga, konkreta frågor — inga påhittade "99% nöjda kunder"-svar.
const FAQ = [
  { q: 'Behöver jag ange kortuppgifter för att prova?', a: 'Nej. Du provar Bokix i 30 dagar helt gratis, utan kort och utan bindningstid.' },
  { q: 'Kan jag avsluta när som helst?', a: 'Ja. Det finns ingen uppsägningstid eller bindningstid — du avslutar när du vill.' },
  { q: 'Vilka bolagsformer stöds?', a: 'Bokix känner igen enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening utifrån organisationsnumret, och bokför enligt rätt regler för respektive form.' },
  { q: 'Ingår support i priset?', a: 'Ja, support ingår — du når oss på support@bokix.se.' },
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
  { icon: Sparkles, text: 'Alla funktioner ingår' },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });

  return (
    <MarketingLayout>
      <style>{`
        @keyframes pricingOrbDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-30px,24px) scale(1.1); } }
        @keyframes pricingOrbDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(26px,-20px) scale(1.06); } }
        @keyframes pricingCardGlow {
          0%,100% { box-shadow: 0 30px 70px -20px rgba(61,122,46,0.32), 0 0 0 1px rgba(61,122,46,0.08); }
          50% { box-shadow: 0 34px 90px -18px rgba(61,122,46,0.46), 0 0 0 1px rgba(61,122,46,0.14); }
        }
        .pricing-orb-1 { animation: pricingOrbDrift1 10s ease-in-out infinite; }
        .pricing-orb-2 { animation: pricingOrbDrift2 12s ease-in-out infinite; }
        .pricing-card-glow { animation: pricingCardGlow 4.5s ease-in-out infinite; }
        .pricing-feature-row { transition: transform 0.18s ease; }
        .pricing-feature-row:hover { transform: translateX(3px); }
      `}</style>

      <section style={{ padding: '150px 24px 70px', background: `linear-gradient(160deg, #f8fffe 0%, ${BRAND.greenLight}44 60%, white 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="pricing-orb-1" style={{ position: 'absolute', top: '-60px', left: '8%', width: '280px', height: '280px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.greenLight}bb 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div className="pricing-orb-2" style={{ position: 'absolute', top: '10%', right: '6%', width: '220px', height: '220px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'white', border: `1px solid ${BRAND.green}33`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px', boxShadow: '0 4px 14px -4px rgba(61,122,46,0.2)' }}>
            <Sparkles size={13} /> Inga dolda avgifter
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
          <div className="pricing-card-glow" style={{ background: 'white', border: `1.5px solid ${BRAND.green}`, borderRadius: '26px', overflow: 'hidden' }}>

            {/* Mörk topp-sektion för priset — bryter kortet i två zoner istället
                för en enda platt vit yta, så det känns som en riktig produkt
                snarare än en generisk prislista. */}
            <div style={{ background: `linear-gradient(155deg, ${BRAND.green} 0%, #142a1f 100%)`, padding: '38px 36px 34px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-60px', right: '-40px', width: '160px', height: '160px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(150,255,140,0.18) 0%, transparent 70%)' }} />
              <div style={{ position: 'relative' }}>
                <span style={{ fontSize: '56px', fontWeight: 900, letterSpacing: '-0.03em', color: 'white' }}>199 kr</span>
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}> /mån</span>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '6px' }}>Exkl. moms · avsluta när som helst</div>
              </div>
            </div>

            <div style={{ padding: '32px 36px 36px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', marginBottom: '28px' }}>
                {INCLUDED.map(f => (
                  <div key={f} className="pricing-feature-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: 19, height: 19, borderRadius: '50%', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                      <CheckCircle size={12} color={BRAND.greenDark} />
                    </div>
                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: 500, lineHeight: 1.5 }}>{f}</span>
                  </div>
                ))}
              </div>
              <button className="lp-btn-primary" onClick={enterApp} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 6px 20px -4px rgba(61,122,46,0.4)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
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
          <Reveal delay={100} className="lp-card-hover" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '8px 24px', boxShadow: '0 20px 50px -30px rgba(15,23,42,0.15)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
