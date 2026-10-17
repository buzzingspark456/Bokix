import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';
import { KitStyles, SubHero, KitSection, SpecList, PointList, StepList, KitFaq, KitCta, PrimaryButton, GhostLink, ProductShots } from './subpageKit';
import { shotsFor } from '../../content/marketing/screenshots';
import OrgTypeVisual, { HeroVideo } from './OrgTypeVisuals';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { ORG_TYPE_BY_PATH, ORG_TYPE_PAGES } from '../../content/marketing/orgTypes';
import { FEATURE_BY_PATH, FEATURE_PAGES, PAYROLL_CARD, INTEGRATIONS_CARD, HERO_VIDEO_DATE, HERO_VIDEO_DURATION, heroVideoFile } from '../../content/marketing/featurePages';
import MoreCards from './MoreCards';

// Jämförelsetabell (bara på sidor med `compare`, t.ex. alternativ till
// Fortnox). På telefon blir varje rad ett eget kort.
function CompareTable({ cols, rows }) {
  return (
    <div className="kx-cmp" role="table">
      <div className="kx-cmp-row kx-cmp-head" role="row">
        <span role="columnheader" />
        {cols.map(c => <span key={c} role="columnheader">{c}</span>)}
      </div>
      {rows.map(([label, ...cells]) => (
        <div key={label} className="kx-cmp-row" role="row">
          <span role="rowheader" className="kx-cmp-label">{label}</span>
          {cells.map((c, i) => <span key={i} role="cell" data-col={cols[i]}>{c}</span>)}
        </div>
      ))}
      <style>{`
        .kx-cmp { border: 1px solid var(--mkt-card-border); border-radius: 16px; overflow: hidden; background: var(--mkt-card-bg); }
        .kx-cmp-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(0, 1.2fr); gap: 18px; padding: 16px 20px; border-top: 1px solid var(--mkt-border-soft); font-size: 15px; line-height: 1.45; color: var(--mkt-ink-soft); }
        .kx-cmp-row:first-child { border-top: 0; }
        .kx-cmp-head { font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mkt-muted); background: var(--mkt-page-bg); }
        .kx-cmp-label { font-weight: 700; color: var(--mkt-ink); }
        .kx-cmp-row span:nth-child(2) { color: var(--mkt-ink); font-weight: 600; }
        @media (max-width: 640px) {
          .kx-cmp-head { display: none; }
          .kx-cmp-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
          .kx-cmp-row span[data-col]::before { content: attr(data-col) ': '; font-weight: 700; color: var(--mkt-muted); }
        }
      `}</style>
    </div>
  );
}

// ── Bokföringsprogram per bolagsform (/bokforingsprogram-*) ──────────────
// En sida per bolagsform, allt innehåll i content/marketing/orgTypes.js.
// Samma sida används för funktionssidorna (featurePages.js), som har egna
// rubriker (factsTitle, includedTitle) och länkar till varandra i stället
// för till bolagsformerna.

export default function OrgTypePage({ path }) {
  const page = ORG_TYPE_BY_PATH[path] || FEATURE_BY_PATH[path];
  const isFeature = Boolean(FEATURE_BY_PATH[path]);
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  if (!page) return null;
  const others = (isFeature ? FEATURE_PAGES : ORG_TYPE_PAGES).filter(p => p.path !== page.path);
  const subject = page.short.toLowerCase();

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

  // Filmen överst får en VideoObject, så att Google kan visa den i sökresultaten.
  const videoSchema = page.video ? {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: page.video.title,
    description: page.video.description,
    thumbnailUrl: [`${SITE_URL}/videos/hero/${heroVideoFile(page)}.jpg`],
    uploadDate: `${HERO_VIDEO_DATE}T08:00:00+02:00`,
    duration: HERO_VIDEO_DURATION,
    contentUrl: `${SITE_URL}/videos/hero/${heroVideoFile(page)}.mp4`,
    inLanguage: 'sv-SE',
    isFamilyFriendly: true,
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  } : null;

  return (
    <MarketingLayout>
      <PageMeta title={page.seoTitle} description={page.seoDescription} path={page.path} />
      <JsonLd data={productSchema} />
      <JsonLd data={faqSchema} />
      {videoSchema && <JsonLd data={videoSchema} />}
      <KitStyles />

      <SubHero
        fitTitle
        title={page.title}
        lead={page.lead}
        actions={<>
          <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
          <GhostLink to="/boka-genomgang">Boka en genomgång</GhostLink>
        </>}
        visual={page.video ? <HeroVideo file={heroVideoFile(page)} label={page.video.description} /> : <OrgTypeVisual slug={page.slug} />}
      />

      <ProductShots shots={shotsFor(page.path)} />

      {page.compare && (
        <KitSection title={page.compare.title} lead={page.compare.lead}>
          <CompareTable cols={page.compare.cols} rows={page.compare.rows} />
        </KitSection>
      )}

      <KitSection title={page.factsTitle || `Bra att veta om ${subject}`} lead={page.factsLead || 'Det som skiljer bokföringen för just den här bolagsformen från de andra.'} alt>
        <SpecList items={page.facts} />
      </KitSection>

      <KitSection title={page.includedTitle || `Det här ingår för ${subject}`} lead="Allt ingår i samma pris. Inga tillägg per funktion och inga avgifter per faktura eller kvitto.">
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

      <KitSection title={isFeature ? 'Mer i Bokix' : 'Andra bolagsformer'} lead={isFeature ? 'Allt finns i samma bokföringsprogram, till samma pris.' : 'Bokix fungerar för de vanligaste bolagsformerna i Sverige.'} alt>
        {isFeature ? (<>
          <MoreCards pages={[...others, PAYROLL_CARD, INTEGRATIONS_CARD]} />
          <Link to="/funktioner" style={{ display: 'inline-block', marginTop: '20px', color: 'var(--mkt-accent-green-fg)', fontWeight: 600, fontSize: '15px' }}>Se alla funktioner</Link>
        </>) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          {others.map(o => (
            <Link key={o.path} to={o.path} className="kx-btn kx-btn-ghost lp-btn-secondary">Bokföringsprogram för {o.short.toLowerCase()}</Link>
          ))}
        </div>
        )}
      </KitSection>

      <KitCta title={page.ctaTitle || `Kom igång med bokföringen för ${subject}`} lead="30 dagar gratis, sedan från 129 kr/mån. Ingen bindningstid på månadsplanen.">
        <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
        <GhostLink to="/priser">Se priser</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
