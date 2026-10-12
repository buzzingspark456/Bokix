import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';
import { KitStyles, SubHero, KitSection, SpecList, PointList, StepList, KitFaq, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import OrgTypeVisual from './OrgTypeVisuals';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { Check } from '../icons';
import { ORG_TYPE_BY_PATH, ORG_TYPE_PAGES } from '../../content/marketing/orgTypes';

// ── Bokföringsprogram per bolagsform (/bokforingsprogram-*) ──────────────
// En sida per bolagsform, allt innehåll i content/marketing/orgTypes.js.

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
      <PageMeta title={page.seoTitle} description={page.seoDescription} path={page.path} />
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
          <div style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {page.highlights.map(h => (
              <span key={h} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--mkt-ink-soft)', border: '1px solid var(--mkt-border-soft)', borderRadius: '999px', padding: '5px 12px' }}>
                <Check size={13} style={{ color: 'var(--mkt-accent-green-fg)' }} /> {h}
              </span>
            ))}
          </div>
        </>}
        visual={<OrgTypeVisual slug={page.slug} />}
      />

      <KitSection title={`Bra att veta om ${page.short.toLowerCase()}`} lead="Det som skiljer bokföringen för just den här bolagsformen från de andra." alt>
        <SpecList items={page.facts} />
      </KitSection>

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
