import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from '../marketingTokens';
import { ROUTE_META } from '../routeMeta';

const GUIDES = [
  { slug: 'enskild-firma-bokforing' },
  { slug: 'momsdeklaration' },
  { slug: 'fakturering-vad-kravs' },
  { slug: 'valja-bokforingsprogram' },
];

export default function GuideHub() {
  return (
    <MarketingLayout {...ROUTE_META['/guider']} path="/guider">
      <section style={{ padding: '150px 24px 60px', background: IVORY, textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '620px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.5vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.16 }}>
            Guider om bokföring och företagande
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.75 }}>
            Praktiska genomgångar, inte generisk fyllnadstext — skrivna för svenska småföretag och enskilda firmor.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {GUIDES.map((g) => {
            const meta = ROUTE_META[`/guider/${g.slug}`];
            return (
              <Reveal key={g.slug} as={Link} to={`/guider/${g.slug}`} className="lp-card-hover" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
                background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px',
                padding: '24px 26px', boxShadow: CARD_SHADOW, textDecoration: 'none',
              }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <BookOpen size={18} color={INK_SOFT} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h2 style={{ fontSize: '16.5px', fontWeight: 700, color: INK, marginBottom: '4px' }}>{meta?.title?.replace(' | Bokix', '')}</h2>
                    <p style={{ fontSize: '13.5px', color: MUTED, margin: 0, lineHeight: 1.5 }}>{meta?.description}</p>
                  </div>
                </div>
                <ArrowRight size={18} color={INK_SOFT} style={{ flexShrink: 0 }} />
              </Reveal>
            );
          })}
        </div>
      </section>
    </MarketingLayout>
  );
}
