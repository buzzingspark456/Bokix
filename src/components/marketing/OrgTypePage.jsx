import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';
import { INK, MUTED, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { KitStyles, SubHero, KitSection, PointList, StepList, KitFaq, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { Check } from '../icons';
import { ORG_TYPE_BY_PATH, ORG_TYPE_PAGES } from '../../content/marketing/orgTypes';

// ── Bokföringsprogram per bolagsform (/bokforingsprogram-*) ──────────────
// En sida per bolagsform, allt innehåll i content/marketing/orgTypes.js.

/** Kortet bredvid rubriken: de fyra viktigaste sakerna för just den här bolagsformen. */
function HighlightCard({ page }) {
  return (
    <div style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', boxShadow: CARD_SHADOW, padding: '26px 26px 22px' }}>
      <div style={{ fontSize: '13px', fontWeight: 700, color: MUTED, letterSpacing: '0.02em', marginBottom: '14px' }}>Bokix för {page.short.toLowerCase()}</div>
      {page.highlights.map(h => (
        <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderTop: '1px solid var(--mkt-border-soft)', fontSize: '16px', fontWeight: 600, color: INK }}>
          <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: '50%', background: 'var(--mkt-accent-green-soft)', color: 'var(--mkt-accent-green-fg)', flexShrink: 0 }}>
            <Check size={15} />
          </span>
          {h}
        </div>
      ))}
      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--mkt-border-soft)', fontSize: '14px', color: MUTED }}>
        Från 129 kr/mån, 30 dagar gratis
      </div>
    </div>
  );
}

export default function OrgTypePage({ path }) {
  const page = ORG_TYPE_BY_PATH[path];
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  if (!page) return null;
  const others = ORG_TYPE_PAGES.filter(p => p.path !== page.path);

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: page.faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Bokix',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Webbläsare',
    description: page.seoDescription,
    url: `${SITE_URL}${page.path}`,
    offers: { '@type': 'Offer', price: '129', priceCurrency: 'SEK' },
  };

  return (
    <MarketingLayout>
      <PageMeta title={page.seoTitle} description={page.seoDescription} path={page.path} image={`${SITE_URL}/og/${page.path.slice(1)}.png`} />
      <JsonLd data={productSchema} />
      <JsonLd data={faqSchema} />
      <KitStyles />

      <SubHero
        eyebrow={page.eyebrow}
        title={page.title}
        lead={page.lead}
        actions={<>
          <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
          <GhostLink to="/boka-genomgang">Boka en genomgång</GhostLink>
        </>}
        visual={<HighlightCard page={page} />}
      />

      <KitSection title={`Det här ingår för ${page.short.toLowerCase()}`} lead="Allt ingår i samma pris. Inga tillägg per funktion och inga avgifter per faktura eller kvitto.">
        <PointList items={page.included} />
      </KitSection>

      <KitSection title="Så kommer du igång" lead="De flesta är igång samma dag." alt>
        <StepList items={page.steps} />
      </KitSection>

      <KitSection title="Vanliga frågor">
        <KitFaq items={page.faq} />
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {page.related.map(r => (
            <Link key={r.to} to={r.to} style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600, fontSize: '15px' }}>{r.label}</Link>
          ))}
        </div>
      </KitSection>

      <KitSection title="Andra bolagsformer" lead="Bokix fungerar för de vanligaste bolagsformerna i Sverige." alt>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {others.map(o => (
            <Link key={o.path} to={o.path} className="kx-btn kx-btn-ghost lp-btn-secondary">Bokföringsprogram för {o.short.toLowerCase()}</Link>
          ))}
        </div>
      </KitSection>

      <KitCta title={`Kom igång med bokföringen för ${page.short.toLowerCase()}`} lead="30 dagar gratis, sedan från 129 kr/mån. Ingen bindningstid på månadsplanen.">
        <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
        <GhostLink to="/priser">Se priser</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
