import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitSection, KitFaq, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd } from '../../utils/seo';
import { HeroShowcase, ProductShot, ReasonRow, FeatureBlock, YearSection, CompareColumns, SectionHead, PRODUCT_KIT_CSS } from './productKit';
import { SplitHero, HeroVisual, Signature, SIGNATURE_CSS } from './productSignatures';

// Produktsida för en bolagsform eller funktion (2026-11-07). Innehållet ligger
// i `page.product` (orgTypes.js / featurePages.js); bilderna är riktiga
// skärmbilder ur appen. Varje sida väljer själv hjälte (hero/heroTabs),
// mittparti (signature), och om skäl, år och jämförelse ska visas, så att
// sidorna inte ser likadana ut.

export default function ProductOrgPage({ page, schemas, enterApp, others, subject, more }) {
  const p = page.product;
  return (
    <MarketingLayout>
      <PageMeta title={page.seoTitle} description={page.seoDescription} path={page.path} />
      {schemas.filter(Boolean).map((s, i) => <JsonLd key={i} data={s} />)}
      <KitStyles />
      <style>{PRODUCT_KIT_CSS + SIGNATURE_CSS}</style>

      {/* Hjälten skiljer sig mellan sidorna: appen med flikar (heroTabs),
          eller text bredvid en bild, telefon, lönebesked eller lista (hero). */}
      {p.hero ? (
        <SplitHero eyebrow={page.eyebrow || page.title} title={p.h1Tail || page.lead} lead={p.lead || page.lead}
          flip={p.hero.flip} note="30 dagar gratis, sedan från 129 kr/mån."
          actions={<>
            <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
            <GhostLink to="/boka-genomgang?om=passar">Boka en genomgång</GhostLink>
          </>}
          visual={<HeroVisual hero={p.hero} />} />
      ) : (
        <section className="pk-hero">
          <Reveal className="pk-hero-text">
            {/* Sökordet först (litet), sedan budskapet stort, i samma h1. */}
            <h1 className="pk-h1-wrap">
              <span className="pk-eyebrow">{page.eyebrow || page.title}</span>
              <span className="kx-h1 pk-h1">{p.h1Tail || page.lead}</span>
            </h1>
            <p className="pk-hero-lead">{p.lead || page.lead}</p>
            <div className="kx-actions pk-hero-actions">
              <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
              <GhostLink to="/boka-genomgang?om=passar">Boka en genomgång</GhostLink>
            </div>
            <p className="pk-hero-note">30 dagar gratis, sedan från 129 kr/mån. Ingen bindningstid på månadsplanen.</p>
          </Reveal>
          <Reveal delay={120}>
            <HeroShowcase tabs={p.heroTabs} />
          </Reveal>
        </section>
      )}

      {p.signature && (
        <section className={'pk-section' + (p.signature.alt === false ? '' : ' is-alt')}>
          <div className="pk-wrap">
            <SectionHead kicker={p.signature.kicker} title={p.signature.title} lead={p.signature.lead} />
            <Signature sig={p.signature} />
          </div>
        </section>
      )}

      {p.reasons && (
        <section className="pk-section is-alt">
          <div className="pk-wrap">
            <SectionHead title={p.reasonsTitle} />
            <ReasonRow items={p.reasons} />
          </div>
        </section>
      )}

      {p.features && (
        <section className="pk-section">
          <div className="pk-wrap">
            <SectionHead title={p.featuresTitle} lead={p.featuresLead} />
            {p.featuresLayout === 'grid' ? (
              <div className={'pk-fgrid' + (p.features.length % 3 === 0 ? ' is-three' : '')}>
                {p.features.map((f, i) => (
                  <Reveal key={f.title} delay={i * 60} className="pk-fgrid-item">
                    <ProductShot name={f.shot} alt={f.title} />
                    <h3>{f.title}</h3>
                    <p>{f.body}</p>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="pk-features">
                {p.features.map((f, i) => <FeatureBlock key={f.title} {...f} flip={i % 2 === 1} />)}
              </div>
            )}
          </div>
        </section>
      )}

      {p.year && (
        <section className="pk-section is-alt">
          <div className="pk-wrap">
            <YearSection {...p.year} />
          </div>
        </section>
      )}

      {p.compare && (
        <section className="pk-section">
          <div className="pk-wrap">
            <SectionHead title={p.compare.title} lead={p.compare.lead} />
            <Reveal><CompareColumns cols={p.compare.cols} rows={p.compare.rows} /></Reveal>
          </div>
        </section>
      )}

      {p.price && (
        <section className="pk-section is-alt is-tight">
          <div className="pk-wrap">
            <Reveal className="pk-price">
              <div>
                <div className="pk-price-amount">Från {p.price.amount}<small>{p.price.unit}</small></div>
                <p className="pk-price-text">{p.price.text}</p>
              </div>
              <div className="kx-actions">
                <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
                <GhostLink to="/priser">Se priser</GhostLink>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <KitSection title="Vanliga frågor">
        <KitFaq items={page.faq} />
        {page.related?.length > 0 && (
          <div className="pk-links">
            {page.related.map(r => <Link key={r.to} to={r.to}>{r.label}</Link>)}
          </div>
        )}
      </KitSection>

      {others?.length > 0 && (
        <KitSection title="Andra bolagsformer" lead="Bokix fungerar för de vanligaste bolagsformerna i Sverige." alt>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {others.map(o => (
              <Link key={o.path} to={o.path} className="kx-btn kx-btn-ghost lp-btn-secondary">Bokföringsprogram för {o.short.toLowerCase()}</Link>
            ))}
          </div>
        </KitSection>
      )}

      {more}

      <KitCta title={page.ctaTitle || `Kom igång med bokföringen för ${subject}`} lead="30 dagar gratis, sedan från 129 kr/mån. Ingen bindningstid på månadsplanen.">
        <PrimaryButton onClick={enterApp}>Prova gratis i 30 dagar</PrimaryButton>
        <GhostLink to="/priser">Se priser</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
