import React, { useState } from 'react';
import { ChevronDown } from '../icons';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { AuroraLayer } from './aurora';
import { PageMeta, JsonLd } from '../../utils/seo';
import { FAQ_ITEMS, FAQ_SCHEMA } from './faqData';

// ── Vanliga frågor (/vanliga-fragor) ────────────────────────────────────
// Kundönskemål: startsidans FAQ-sektion (LandingPage.jsx, precis före
// footern) var för tung på mobil — hela accordionen (åtta frågor) fick
// alltid plats där, oavsett skärmbredd. Den fulla listan finns nu HÄR, på
// en egen sida, och startsidan visar bara ett kompakt "Se alla vanliga
// frågor"-kort på mobil i stället (se .lp-faq-mobile-cta,
// MarketingLayout.jsx). Innehållet kommer från samma FAQ_ITEMS som
// startsidan (faqData.js) — en källa, ingen egen dubblettlista.
function FaqItem({ item, index, isOpen, onToggle }) {
  const accent = ACCENT.green;
  return (
    <div
      className="lp-faq-item"
      style={{
        borderRadius: '16px',
        background: isOpen ? `color-mix(in srgb, ${accent.fg} 7%, transparent)` : 'transparent',
        borderLeft: `3px solid ${isOpen ? accent.fg : 'transparent'}`,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      <button className="lp-faq-question" onClick={onToggle} aria-expanded={isOpen} style={{ padding: '22px 16px 22px 20px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: accent.fg, color: 'white', fontSize: '13.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
          <span style={{ fontSize: '17.5px', fontWeight: 700, color: INK }}>{item.q}</span>
        </span>
        <ChevronDown size={20} className={`lp-faq-chevron ${isOpen ? 'lp-faq-open' : ''}`} style={{ color: isOpen ? accent.fg : undefined, flexShrink: 0 }} />
      </button>
      <div className={`lp-faq-answer ${isOpen ? 'lp-faq-open' : ''}`}>
        <div>
          <p style={{ margin: '0 16px 26px 66px', fontSize: '15.5px', color: MUTED, lineHeight: 1.7, maxWidth: '640px' }}>{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <MarketingLayout>
      <PageMeta
        title="Vanliga frågor om Bokix | Bokix"
        description="Svar på det vanligaste du undrar över innan du sätter igång med Bokix: pris, bolagsformer, bokföringsvana, support och mer."
        path="/vanliga-fragor"
      />
      <JsonLd data={FAQ_SCHEMA} />

      <section style={{ padding: '150px 24px 44px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer stops={[['rgba(14,165,233,0.16)', '4% -8%'], ['rgba(20,184,166,0.14)', '97% 105%']]} />
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.6vw, 48px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.15 }}>
            Vanliga frågor
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, margin: 0 }}>
            Det mesta du undrar över innan du sätter igång.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 90px', background: 'var(--mkt-page-bg)', position: 'relative' }}>
        <Reveal style={{ maxWidth: '760px', margin: '0 auto', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: '8px 30px', boxShadow: CARD_SHADOW }}>
          {FAQ_ITEMS.map((item, i) => (
            <FaqItem key={item.q} item={item} index={i} isOpen={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} />
          ))}
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
