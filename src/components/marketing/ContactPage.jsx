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
        .contact-topic-row:hover { background: #f1f5f9 !important; }
      `}</style>

      <section style={{ padding: '150px 24px 60px', background: BRAND.greenLight, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '620px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ width: 60, height: 60, borderRadius: '17px', background: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Mail size={26} color="white" />
          </div>
          <h1 style={{ fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px', lineHeight: 1.1 }}>
            Kontakta oss
          </h1>
          <p style={{ fontSize: '16.5px', color: '#475569', lineHeight: 1.75 }}>
            Inget säljteam, inget callcenter, inget formulär du skickar ut i tomma intet. Mejla direkt, en riktig person läser och svarar.
          </p>
        </Reveal>
      </section>

      {/* Klickbara länkrader istället för fristående ikon-kort (samma mönster
          som AboutPage.jsx använder) — samma information, en annan form. */}
      <section style={{ padding: '30px 24px 60px', background: 'white' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', border: '1px solid #e5e7eb', borderRadius: '16px', overflow: 'hidden' }}>
          {TOPICS.map((t, i) => (
            <Reveal
              key={t.title} delay={i * 90} as="a" href={`mailto:support@bokix.se?subject=${encodeURIComponent(t.subject)}`}
              className="contact-topic-row"
              style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none', padding: '20px 24px', borderTop: i > 0 ? '1px solid #e5e7eb' : 'none', transition: 'background 0.15s' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <t.icon size={18} color={BRAND.greenDark} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: '#111827', margin: '0 0 3px' }}>{t.title}</h2>
                <p style={{ fontSize: '12.5px', color: '#64748b', lineHeight: 1.5, margin: 0 }}>{t.desc}</p>
              </div>
              <ArrowRight size={16} color={BRAND.green} style={{ flexShrink: 0 }} />
            </Reveal>
          ))}
        </div>
      </section>

      <section style={{ padding: '20px 24px 110px', background: 'white' }}>
        <Reveal scale style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ background: BRAND.greenDark, borderRadius: '22px', padding: '38px 36px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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
