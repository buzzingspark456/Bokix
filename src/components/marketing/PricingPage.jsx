import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from '../icons';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, ACCENT } from './marketingTokens';
import { KitStyles, KitFaq } from './subpageKit';
import { PRICING_TIERS } from './pricingTiers';
import { localizedPricingTiers } from '../../content/marketing/pricingTiers';
import { PRICING_CONTENT } from '../../content/marketing/pricing';
import { resolvePlan, YEARLY_MINIMUM_MONTHS } from '../../utils/plans';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// FAQPage-schema byggt direkt av FAQ:n i content/marketing/pricing.js —
// samma frågor/svar som faktiskt visas på sidan, aldrig en egen
// dubblett-lista som kan glida isär från vad besökaren ser, oavsett
// språk. Google kan visa dessa som en utfällbar FAQ-rich-snippet direkt i
// sökresultatet, och det är precis den sortens strukturerade fråga/svar-
// data AI-svarsmotorer (Perplexity/ChatGPT/Claude när de faktiskt läser
// sidan) helst citerar rakt av.
function buildFaqSchema(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

// SoftwareApplication-schema — kundönskemål ("två priser nu, inte ett"):
// bygger priserna direkt från PRICING_TIERS (den STRUKTURELLA katalogen,
// pricingTiers.js — priset i kronor är detsamma oavsett språk), samma
// princip som FAQ_SCHEMA ovan, så schemat aldrig kan glida isär från vad
// besökaren faktiskt ser. AggregateOffer (låg/högpris) istället för en
// enda Offer, eftersom det nu verkligen ÄR ett intervall.
function buildSoftwareSchema(description) {
  return {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bokix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/priser`,
  description,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: String(Math.min(...PRICING_TIERS.map((t) => t.price))),
    highPrice: String(Math.max(...PRICING_TIERS.map((t) => t.price))),
    priceCurrency: 'SEK',
    offerCount: String(PRICING_TIERS.length),
    offers: PRICING_TIERS.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: String(t.price),
      priceCurrency: 'SEK',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(t.price),
        priceCurrency: 'SEK',
        unitText: 'MON',
        // Se motsvarande kommentar i LandingPage.jsx: ingen moms läggs på i
        // checkouten, så priset är slutbeloppet.
        valueAddedTaxIncluded: true,
      },
    })),
  },
  };
}

const COMPARE_HEADING = {
  sv: 'Jämför vad som ingår',
  en: 'Compare what’s included',
  no: 'Sammenlign hva som er inkludert',
  dk: 'Sammenlign hvad der er inkluderet',
  fi: 'Vertaa mitä sisältyy',
};

export default function PricingPage({ locale = 'sv' }) {
  const navigate = useNavigate();
  const c = PRICING_CONTENT[locale] || PRICING_CONTENT.sv;
  const tiers = localizedPricingTiers(locale);
  // Månadsvis eller årsvis. Valet följer med hela vägen till Stripe
  // (state → App → Auth → checkout), så kunden debiteras exakt det pris
  // som stod på kortet hen klickade på.
  const [interval, setInterval] = useState('monthly');
  const enterApp = (planId = 'employer_monthly') => navigate('/', { state: { enterApp: true, authMode: 'signup', plan: planId } });
  const compareRows = tiers.reduce((all, t) => (t.features.length > all.length ? t.features : all), []);

  return (
    <MarketingLayout>
      <PageMeta
        title={c.meta.title}
        description={c.meta.description}
        path={locale === 'sv' ? '/priser' : `/${locale}/priser`}
        basePath="/priser"
        locale={locale}
      />
      <JsonLd data={buildSoftwareSchema(c.schemaDescription)} />
      <JsonLd data={buildFaqSchema(c.faq)} />
      <KitStyles />

      {/* Omgjord 2026-09-26 (kundönskemål: "prissidan ser inte bra ut").
          Samma innehåll och språkfiler som förut, ny form: rubrik och
          intervallval i ett block, två tydliga kort där Med personal är det
          mörkgröna, jämförelsen i en ram med pris och knapp per kolumn, och
          FAQ:n i samma lugna stil som undersidorna (subpageKit). */}
      <style>{`
        .bx-pr-hero { padding: clamp(112px, 20vw, 150px) 20px 0; text-align: center; }
        .bx-pr-h1 { font-family: ${SERIF}; font-size: clamp(34px, 5.4vw, 56px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.08; color: ${INK}; margin: 0 auto 16px; max-width: 720px; }
        .bx-pr-lead { font-size: clamp(15.5px, 2.2vw, 18px); line-height: 1.6; color: ${MUTED}; margin: 0 auto; max-width: 600px; }

        .bx-pr-toggle { display: inline-flex; gap: 4px; padding: 5px; border-radius: 999px; background: var(--mkt-ivory); border: 1px solid ${CARD_BORDER}; margin: 34px auto 0; }
        .bx-pr-toggle button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 20px; border-radius: 999px; border: none; cursor: pointer; font-family: inherit; font-size: 14.5px; font-weight: 700; background: transparent; color: ${MUTED}; transition: background .15s, color .15s; }
        .bx-pr-toggle button.on { background: var(--mkt-card-bg); color: ${INK}; box-shadow: 0 2px 8px rgba(28,36,32,.10); }
        .bx-pr-badge { font-size: 11.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; background: ${ACCENT.green.soft}; color: ${ACCENT.green.fg}; }

        .bx-pr-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(10px, 2.4vw, 22px); max-width: 900px; margin: clamp(28px, 5vw, 44px) auto 0; padding: 0 16px; }
        .bx-pr-card { position: relative; display: flex; flex-direction: column; text-align: left; border-radius: 24px; padding: clamp(20px, 4vw, 40px); background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); box-shadow: var(--mkt-card-shadow); }
        .bx-pr-name { font-size: clamp(15px, 3.4vw, 20px); font-weight: 700; color: ${INK}; margin: 0; }
        .bx-pr-for { font-size: 14px; line-height: 1.5; color: ${MUTED}; margin: 8px 0 0; min-height: 42px; }
        .bx-pr-price { font-family: ${SERIF}; font-size: clamp(40px, 10vw, 68px); font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: ${INK}; margin: clamp(18px, 3vw, 28px) 0 8px; white-space: nowrap; }
        .bx-pr-price small { font-family: inherit; font-size: .28em; font-weight: 500; letter-spacing: 0; color: ${MUTED}; }
        .bx-pr-note { font-size: clamp(12.5px, 2.8vw, 14px); color: ${MUTED}; line-height: 1.5; margin: 0 0 clamp(18px, 3vw, 26px); flex: 1; }
        .bx-pr-cta { width: 100%; min-height: 50px; padding: 14px; border-radius: 12px; font-family: inherit; font-size: clamp(13.5px, 3vw, 15.5px); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1.5px solid ${BRAND.green}; background: transparent; color: ${BRAND.green}; transition: background .15s; }
        .bx-pr-cta:hover { background: color-mix(in srgb, ${BRAND.green} 8%, transparent); }
        .bx-pr-sub { font-size: 12px; color: ${MUTED}; margin-top: 10px; line-height: 1.45; text-align: center; }

        /* Med personal: det mörkgröna kortet, knappen vit. */
        .bx-pr-card.featured { background: #0b3d2a; border-color: #0b3d2a; box-shadow: 0 30px 60px -30px rgba(11, 61, 42, .55); }
        .bx-pr-card.featured .bx-pr-name, .bx-pr-card.featured .bx-pr-price { color: #fff; }
        .bx-pr-card.featured .bx-pr-for, .bx-pr-card.featured .bx-pr-note, .bx-pr-card.featured .bx-pr-sub, .bx-pr-card.featured .bx-pr-price small { color: rgba(255, 255, 255, .72); }
        .bx-pr-card.featured .bx-pr-cta { background: #fff; border-color: #fff; color: #0b3d2a; }
        .bx-pr-card.featured .bx-pr-cta:hover { background: #eef5ee; }
        html[data-theme="dark"] #lp-root .bx-pr-card.featured { background: #14532d; border-color: #1f7a42; box-shadow: none; }
        html[data-theme="dark"] #lp-root .bx-pr-cta { color: #3fc063; border-color: #1f9a4a; }
        html[data-theme="dark"] #lp-root .bx-pr-card.featured .bx-pr-cta { background: #fff; border-color: #fff; color: #0b3d2a; }

        .bx-pr-fine { text-align: center; font-size: 13.5px; color: ${MUTED}; line-height: 1.65; max-width: 600px; margin: 26px auto 0; padding: 0 20px; }

        .bx-pr-compare { max-width: 900px; margin: 0 auto; border: 1px solid var(--mkt-card-border); border-radius: 24px; background: var(--mkt-card-bg); overflow: hidden; }
        .bx-pr-row { display: grid; grid-template-columns: minmax(0, 1fr) clamp(84px, 20vw, 170px) clamp(84px, 20vw, 170px); align-items: center; border-top: 1px solid var(--mkt-border-soft); }
        .bx-pr-row > * { padding: 16px 10px; }
        .bx-pr-row > :first-child { padding-left: clamp(16px, 3vw, 28px); font-size: clamp(13.5px, 3.2vw, 15px); color: ${INK_SOFT}; line-height: 1.45; }
        .bx-pr-row > :last-child { background: color-mix(in srgb, ${BRAND.green} 5%, transparent); align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        html[data-theme="dark"] #lp-root .bx-pr-row > :last-child { background: rgba(63, 192, 99, 0.06); }
        .bx-pr-head { border-top: none; }
        .bx-pr-head > * { padding-top: 22px; padding-bottom: 20px; text-align: center; }
        .bx-pr-head-name { display: block; font-size: clamp(12px, 2.8vw, 14px); font-weight: 700; color: ${INK}; }
        .bx-pr-head-price { display: block; font-family: ${SERIF}; font-size: clamp(18px, 4vw, 26px); font-weight: 700; color: ${INK}; margin-top: 4px; }
        .bx-pr-cell { display: flex; justify-content: center; }
        .bx-pr-yes { width: 24px; height: 24px; border-radius: 50%; background: ${ACCENT.green.soft}; display: flex; align-items: center; justify-content: center; }
        .bx-pr-no { width: 14px; height: 2px; border-radius: 2px; background: var(--mkt-card-border); }
        .bx-pr-foot > * { padding-top: 18px; padding-bottom: 22px; }
        .bx-pr-foot .bx-pr-cta { min-height: 42px; padding: 10px 8px; font-size: 13.5px; }
        .bx-pr-foot .bx-pr-cta.solid { background: ${BRAND.green}; color: #fff; }
        html[data-theme="dark"] #lp-root .bx-pr-foot .bx-pr-cta.solid { background: #1f9a4a; border-color: #1f9a4a; color: #fff; }
        .bx-pr-mob { display: none; }
        @media (max-width: 560px) {
          .bx-pr-mob { display: inline; }
          .bx-pr-for { display: none; }
          .bx-pr-cta svg { display: none; }
          .bx-pr-foot { display: none; }
        }
      `}</style>

      <section className="bx-pr-hero" style={{ background: 'var(--mkt-page-bg)' }}>
        <Reveal>
          <h1 className="bx-pr-h1">{c.hero.title}</h1>
          <p className="bx-pr-lead">{c.hero.subtitle}</p>
          {/* Årsvis är förvalt AV — den som inte aktivt väljer det ska
              aldrig råka binda upp sig i förskott. */}
          <div role="group" aria-label="Betalningsintervall" className="bx-pr-toggle">
            {[
              { id: 'monthly', label: c.interval.monthly },
              { id: 'yearly', label: c.interval.yearly, badge: c.interval.yearlyBadge },
            ].map(opt => (
              <button key={opt.id} type="button" className={interval === opt.id ? 'on' : undefined} onClick={() => setInterval(opt.id)} aria-pressed={interval === opt.id}>
                {opt.label}
                {opt.badge && <span className="bx-pr-badge">{opt.badge}</span>}
              </button>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Två nivåer sida vid sida, även på telefonen (kundönskemål). Vad
          som ingår står en gång, i jämförelsen under. Priset ur plans.js,
          samma källa som checkouten debiterar efter. */}
      <section style={{ background: 'var(--mkt-page-bg)', paddingBottom: '8px' }}>
        <div className="bx-pr-cards">
          {tiers.map((tier, i) => {
            const plan = resolvePlan(tier.key, interval);
            return (
              <Reveal key={tier.key} delay={i * 80} className={`bx-pr-card${tier.featured ? ' featured' : ''}`}>
                <h2 className="bx-pr-name">{tier.name}</h2>
                {tier.recommend && <p className="bx-pr-for">{tier.recommend}</p>}
                <div className="bx-pr-price">{plan.price} kr<small> /mån</small></div>
                <p className="bx-pr-note">
                  {/* Månadsvis: bara nivåns korta beskrivning, och bara på telefonen där den längre raden ovanför är dold. Att det är gratis i 30 dagar står redan under knappen. */}
                  {interval === 'yearly' ? c.yearlySavingsNote(plan.savingPerYear) : <span className="bx-pr-mob">{tier.subtitle}</span>}
                </p>
                <button type="button" className="bx-pr-cta" onClick={() => enterApp(plan.id)}>
                  {c.cta} <ArrowRight size={16} />
                </button>
                <div className="bx-pr-sub">
                  {interval === 'yearly' ? c.yearlyMinimumNote(YEARLY_MINIMUM_MONTHS) : c.monthlyNote}
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Moms och avgifter direkt under beloppen: det är frågan man
            ställer i samma sekund som man ser priset. */}
        <p className="bx-pr-fine">{c.vatNote} {c.noHiddenFeesNote}</p>
      </section>

      {/* ── Jämförelsen: varje funktion en gång, en bock per nivå ── */}
      <section style={{ padding: 'clamp(64px, 9vw, 96px) 16px clamp(72px, 10vw, 110px)', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 className="kx-h2" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)', margin: 0 }}>
            {COMPARE_HEADING[locale] || COMPARE_HEADING.sv}
          </h2>
        </Reveal>
        <Reveal delay={60} className="bx-pr-compare">
          <div className="bx-pr-row bx-pr-head">
            <span />
            {tiers.map(t => (
              <span key={t.key}>
                <span className="bx-pr-head-name">{t.name}</span>
                <span className="bx-pr-head-price">{resolvePlan(t.key, interval).price} kr</span>
              </span>
            ))}
          </div>
          {compareRows.map(f => (
            <div key={f} className="bx-pr-row">
              <span>{f}</span>
              {tiers.map(t => (
                <span key={t.key} className="bx-pr-cell">
                  {t.features.includes(f)
                    ? <span className="bx-pr-yes" aria-label="Ingår"><Check size={13} color={ACCENT.green.fg} strokeWidth={3} /></span>
                    : <span className="bx-pr-no" aria-label="Ingår inte" />}
                </span>
              ))}
            </div>
          ))}
          <div className="bx-pr-row bx-pr-foot">
            <span />
            {tiers.map(t => {
              const plan = resolvePlan(t.key, interval);
              return (
                <span key={t.key}>
                  <button type="button" className={`bx-pr-cta${t.featured ? ' solid' : ''}`} onClick={() => enterApp(plan.id)}>{c.cta}</button>
                </span>
              );
            })}
          </div>
        </Reveal>
      </section>

      <section style={{ padding: 'clamp(72px, 10vw, 100px) 20px clamp(80px, 11vw, 110px)', background: IVORY, borderTop: '1px solid var(--mkt-border-soft)' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 className="kx-h2" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)', margin: 0 }}>{c.faqHeading}</h2>
          </Reveal>
          <Reveal delay={80}>
            <KitFaq items={c.faq} />
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
