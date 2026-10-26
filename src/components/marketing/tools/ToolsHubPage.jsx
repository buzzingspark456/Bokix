import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '../../icons';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, MUTED } from '../marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../../utils/seo';
import { TOOLS, TOOLS_HUB_PATH, TOOL_GROUPS, toolBySlug } from './toolsConfig';

// Navet för de fria verktygen. Egen sida (inte bara sidfotslänkar) av två
// skäl: den är målsidan för "gratis verktyg bokföring"-sökningar, och den
// ger varje enskilt verktyg en intern länk från en sida med tyngd —
// annars hänger verktygssidorna bara i sidfoten.
//
// Listan byggs ur TOOL_GROUPS (toolsConfig.js), samma grupper som
// Verktyg-menyn: ett nytt verktyg läggs in där och dyker upp i båda.

const ITEM_LIST_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Gratis verktyg för svenska företagare',
  itemListElement: TOOLS.map((t, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: t.title,
    description: t.description,
    url: `${SITE_URL}${t.path}`,
  })),
};

// Ordlistan är inte en räknare, men hör hemma i samma "gratis och
// användbart utan konto"-familj.
const GROUPS = [
  ...TOOL_GROUPS.map(g => ({
    title: g.title,
    items: g.items.map(([slug]) => {
      const t = toolBySlug(slug);
      return { key: slug, title: t.title, text: t.short, to: t.path };
    }),
  })),
  { title: 'Slå upp', items: [{ key: 'ordlista', title: 'Bokföringsordlista', text: 'Verifikation, periodisering, AGI och K2 på vanlig svenska', to: '/ordlista' }] },
];

export default function ToolsHubPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Gratis verktyg för företagare: moms, lön, ROT | Bokix"
        description="Gratis kalkylatorer för svenska företagare: moms, lön, egenavgifter, ROT och RUT, dröjsmålsränta, utdelning och viktiga datum. Inget konto krävs."
        path={TOOLS_HUB_PATH}
      />
      <JsonLd data={ITEM_LIST_SCHEMA} />
      <style>{`
        .bx-hub-group { display: grid; grid-template-columns: 220px 1fr; gap: 24px; padding: 28px 0; border-top: 1px solid var(--mkt-card-border); }
        .bx-hub-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0 32px; }
        .bx-hub-item { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 0; text-decoration: none; border-bottom: 1px solid var(--mkt-card-border); }
        .bx-hub-item:hover .bx-hub-title { color: var(--mkt-accent-green-fg); }
        .bx-hub-item:hover .bx-hub-arrow { transform: translateX(3px); color: var(--mkt-accent-green-fg); }
        @media (max-width: 780px) {
          .bx-hub-group { grid-template-columns: 1fr; gap: 6px; padding: 24px 0 8px; }
          .bx-hub-list { grid-template-columns: 1fr; }
        }
      `}</style>

      <section style={{ padding: 'clamp(116px, 15vw, 150px) 24px 36px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '1040px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(36px, 5.6vw, 60px)', fontWeight: 700, letterSpacing: '-0.02em', color: INK, margin: '0 0 16px', lineHeight: 1.06 }}>
            Verktyg som räknar rätt åt dig
          </h1>
          <p style={{ fontSize: 'clamp(16px, 1.7vw, 19px)', color: MUTED, lineHeight: 1.6, margin: 0, maxWidth: '640px' }}>
            De uträkningar svenska företagare gör om och om igen, med formeln utskriven så du ser hur svaret kom fram.
            Ingen registrering och inget som sparas.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '12px 24px clamp(72px, 9vw, 110px)', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '1040px', margin: '0 auto' }}>
          {GROUPS.map((g, gi) => (
            <Reveal key={g.title} delay={gi * 60} className="bx-hub-group">
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: INK, margin: '14px 0 0' }}>{g.title}</h2>
              <div className="bx-hub-list">
                {g.items.map(item => (
                  <Link key={item.key} to={item.to} className="bx-hub-item">
                    <span style={{ minWidth: 0 }}>
                      <span className="bx-hub-title" style={{ display: 'block', fontSize: '16.5px', fontWeight: 600, color: INK, transition: 'color 0.15s' }}>{item.title}</span>
                      <span style={{ display: 'block', fontSize: '14px', color: MUTED, marginTop: '3px', lineHeight: 1.45 }}>{item.text}</span>
                    </span>
                    <ArrowRight className="bx-hub-arrow" size={16} color="var(--mkt-muted)" style={{ flexShrink: 0, transition: 'transform 0.15s, color 0.15s' }} />
                  </Link>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
