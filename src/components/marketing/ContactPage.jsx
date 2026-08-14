import React from 'react';
import { Mail, LifeBuoy, CreditCard, ShieldCheck, ArrowRight } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';

// Ärliga kontaktvägar — allt går till samma inkorg (support@bokix.se), inget
// påhittat livechat-widget eller telefonnummer vi inte bemannar. Ämnena är
// bara en genväg som förifyller mailet så frågan hamnar rätt direkt.
const TOPICS = [
  { icon: LifeBuoy, title: 'Support', desc: 'Tekniska frågor, buggar, eller hjälp att komma igång.', subject: 'Support' },
  { icon: CreditCard, title: 'Fakturering & pris', desc: 'Frågor om din prenumeration, betalning eller uppsägning.', subject: 'Fakturering' },
  { icon: ShieldCheck, title: 'Säkerhet & integritet', desc: 'Frågor om GDPR, dina rättigheter eller hur din data hanteras.', subject: 'Integritet' },
];

export default function ContactPage() {
  return (
    <MarketingLayout>
      <style>{`
        @keyframes contactOrbDrift1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-26px,20px) scale(1.1); } }
        @keyframes contactOrbDrift2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(22px,-18px) scale(1.06); } }
        .contact-orb-1 { animation: contactOrbDrift1 10s ease-in-out infinite; }
        .contact-orb-2 { animation: contactOrbDrift2 12.5s ease-in-out infinite; }
        .contact-topic-card:hover { border-color: transparent !important; box-shadow: 0 20px 45px -20px rgba(61,122,46,0.35) !important; }
      `}</style>

      <section style={{ padding: '150px 24px 60px', background: `linear-gradient(160deg, #f8fffe 0%, ${BRAND.greenLight}44 60%, white 100%)`, position: 'relative', overflow: 'hidden' }}>
        <div className="contact-orb-1" style={{ position: 'absolute', top: '-50px', left: '10%', width: '260px', height: '260px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.greenLight}bb 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div className="contact-orb-2" style={{ position: 'absolute', top: '15%', right: '8%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <Reveal style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 60, height: 60, borderRadius: '17px', background: `linear-gradient(155deg, ${BRAND.green} 0%, #142a1f 100%)`, boxShadow: '0 12px 30px -8px rgba(61,122,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Mail size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px', lineHeight: 1.1 }}>
            Kontakta oss
          </h1>
          <p style={{ fontSize: '16.5px', color: '#475569', lineHeight: 1.75 }}>
            Inget säljteam, inget callcenter, inget formulär du skickar ut i tomma intet. Mejla direkt — en riktig person läser och svarar.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '30px 24px 60px', background: 'white' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
          {TOPICS.map((t, i) => (
            <Reveal key={t.title} delay={i * 90} as="a" href={`mailto:support@bokix.se?subject=${encodeURIComponent(t.subject)}`} className="lp-card-hover contact-topic-card" style={{ display: 'block', textDecoration: 'none', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '18px', padding: '26px' }}>
              <div style={{ width: 42, height: 42, borderRadius: '11px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                <t.icon size={20} color={BRAND.greenDark} />
              </div>
              <h2 style={{ fontSize: '15.5px', fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{t.title}</h2>
              <p style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.6, margin: '0 0 14px' }}>{t.desc}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', fontWeight: 700, color: BRAND.green }}>
                Mejla om det här <ArrowRight size={13} />
              </span>
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ padding: '20px 24px 110px', background: 'white' }}>
        <Reveal scale style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ background: `linear-gradient(155deg, ${BRAND.green} 0%, #142a1f 100%)`, borderRadius: '22px', padding: '38px 36px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', bottom: '-60px', left: '-30px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(150,255,140,0.16) 0%, transparent 70%)' }} />
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#c8f7bd', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px', position: 'relative' }}>
              Eller skippa listan ovan
            </p>
            <a
              href="mailto:support@bokix.se"
              className="lp-btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '15px 28px', background: 'white', color: BRAND.greenDark, borderRadius: '13px', fontWeight: 700, fontSize: '15.5px', textDecoration: 'none', position: 'relative' }}
            >
              <Mail size={17} /> support@bokix.se
            </a>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
