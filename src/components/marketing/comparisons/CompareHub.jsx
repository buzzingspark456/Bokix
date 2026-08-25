import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from '../marketingTokens';
import { COMPARISON_LIST } from './comparisonData';
import { ROUTE_META } from '../routeMeta';

// Nav-hub för konkurrentjämförelserna — dels en bra landningssida för
// sökningar som "bokföringsprogram jämförelse", dels intern länkning
// mellan de tre jämförelsesidorna (bra för både SEO och för att en
// besökare som landat på fel jämförelse hittar rätt).
export default function CompareHub() {
  return (
    <MarketingLayout {...ROUTE_META['/jamfor']} path="/jamfor">
      <section style={{ padding: '150px 24px 60px', background: IVORY, textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '620px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.16 }}>
            Jämför bokföringsprogram
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.75 }}>
            Ärliga, konkreta jämförelser mellan Bokix och de vanligaste alternativen — pris, vad som ingår, och när ett annat program faktiskt kan passa bättre.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {COMPARISON_LIST.map((c) => (
            <Reveal key={c.slug} as={Link} to={`/jamfor/${c.slug}`} className="lp-card-hover" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
              background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px',
              padding: '24px 26px', boxShadow: CARD_SHADOW, textDecoration: 'none',
            }}>
              <div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: INK, marginBottom: '4px' }}>Bokix vs {c.name}</h2>
                <p style={{ fontSize: '13.5px', color: MUTED, margin: 0, lineHeight: 1.5 }}>{c.pricingSummary}</p>
              </div>
              <ArrowRight size={18} color={INK_SOFT} style={{ flexShrink: 0 }} />
            </Reveal>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
