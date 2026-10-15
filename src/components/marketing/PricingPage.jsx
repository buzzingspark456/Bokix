import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
};

// Rubrikerna i jämförelsen och raden över Med personals punkter, per språk.
const COMPARE_GROUPS = {
  sv: { base: 'Ingår i båda', payroll: 'Lön och personal' },
};
const EVERYTHING_IN = {
  sv: (name) => `Allt i ${name}, plus:`,
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
  const groups = COMPARE_GROUPS[locale] || COMPARE_GROUPS.sv;
  const everythingIn = EVERYTHING_IN[locale] || EVERYTHING_IN.sv;

  // Det som ingår i den minsta nivån ingår i båda; resten är lönedelen.
  const baseTier = tiers.reduce((a, t) => (t.features.length < a.features.length ? t : a), tiers[0]);
  const allRows = tiers.reduce((all, t) => (t.features.length > all.length ? t.features : all), []);
  const baseRows = allRows.filter(f => baseTier.features.includes(f));
  const extraRows = allRows.filter(f => !baseTier.features.includes(f));

  // Jämförelsen: ett kort med nivåerna överst (namn, pris, knapp, följer
  // med vid skroll), funktionerna vänsterställda och Med personal-kolumnen
  // svagt grönt tonad hela vägen ner.
  const tierCell = (t) => `bx-cmp-t${t.featured ? ' pro' : ''}`;
  const renderRow = (f) => (
    <div key={f} className="bx-cmp-row bx-cmp-item">
      <span className="bx-cmp-f">{f}</span>
      {tiers.map(t => (
        <span key={t.key} className={tierCell(t)}>
          {t.features.includes(f)
            ? <span className="bx-cmp-yes" aria-label="Ingår"><Check size={14} color="#fff" strokeWidth={3.2} /></span>
            : <span className="bx-cmp-no" aria-label="Ingår inte" />}
        </span>
      ))}
    </div>
  );

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

      {/* Omgjord 2026-09-26 (kundönskemål: "prissidan ser inte bra ut",
          sedan "de är små, gör dem bra och fina"). Rubriken står ensam,
          utan ingress; korten är stora, med de viktigaste punkterna i
          varje; momsraden under korten är borta (frågan besvaras i FAQ:n).
          Jämförelsen är uppdelad i det som ingår i båda och lönedelen. */}
      <style>{`
        .bx-pr-hero { padding: clamp(116px, 20vw, 160px) 20px 0; text-align: center; }
        .bx-pr-h1 { font-family: ${SERIF}; font-size: clamp(38px, 6.4vw, 68px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.05; color: ${INK}; margin: 0 auto; max-width: 820px; }

        .bx-pr-toggle { display: inline-flex; gap: 4px; padding: 6px; border-radius: 999px; background: var(--mkt-ivory); border: 1px solid ${CARD_BORDER}; margin: clamp(28px, 4vw, 40px) auto 0; }
        .bx-pr-toggle button { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 999px; border: none; cursor: pointer; font-family: inherit; font-size: 15.5px; font-weight: 700; background: transparent; color: ${MUTED}; transition: background .15s, color .15s; }
        .bx-pr-toggle button.on { background: var(--mkt-card-bg); color: ${INK}; box-shadow: 0 2px 10px rgba(28,36,32,.12); }
        .bx-pr-badge { font-size: 12px; font-weight: 700; padding: 3px 10px; border-radius: 999px; background: ${ACCENT.green.soft}; color: ${ACCENT.green.fg}; }

        .bx-pr-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(10px, 2.4vw, 28px); max-width: 1060px; margin: clamp(32px, 5vw, 52px) auto 0; padding: 0 16px; }
        .bx-pr-card { display: flex; flex-direction: column; text-align: left; border-radius: 28px; padding: clamp(20px, 4.4vw, 48px); background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); box-shadow: 0 24px 60px -40px rgba(15, 40, 25, .35); }
        .bx-pr-name { font-size: clamp(17px, 3.6vw, 26px); font-weight: 700; letter-spacing: -0.01em; color: ${INK}; margin: 0; }
        .bx-pr-for { font-size: 16px; line-height: 1.55; color: ${MUTED}; margin: 10px 0 0; min-height: 50px; }
        .bx-pr-price { font-family: ${SERIF}; font-size: clamp(44px, 11vw, 84px); font-weight: 700; letter-spacing: -0.035em; line-height: 1; color: ${INK}; margin: clamp(18px, 3.4vw, 32px) 0 clamp(6px, 1vw, 10px); white-space: nowrap; }
        .bx-pr-price small { font-family: inherit; font-size: .26em; font-weight: 500; letter-spacing: 0; color: ${MUTED}; }
        .bx-pr-note { font-size: clamp(13px, 2.8vw, 15px); color: ${MUTED}; line-height: 1.5; margin: 0 0 clamp(18px, 3vw, 28px); min-height: 1.5em; }
        .bx-pr-cta { width: 100%; min-height: 56px; padding: 14px; border-radius: 14px; font-family: inherit; font-size: clamp(14px, 3vw, 17px); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1.5px solid ${BRAND.green}; background: transparent; color: ${BRAND.green}; transition: background .15s, transform .15s; }
        .bx-pr-cta:hover { background: color-mix(in srgb, ${BRAND.green} 8%, transparent); }
        .bx-pr-sub { font-size: 13px; color: ${MUTED}; margin-top: 12px; line-height: 1.45; text-align: center; }
        .bx-pr-points { list-style: none; margin: clamp(22px, 3.4vw, 32px) 0 0; padding: clamp(22px, 3.4vw, 30px) 0 0; border-top: 1px solid var(--mkt-border-soft); display: grid; gap: 14px; flex: 1; }
        .bx-pr-points-lead { font-size: 14.5px; font-weight: 700; color: ${INK}; }
        .bx-pr-points li { display: flex; gap: 12px; align-items: flex-start; font-size: 15.5px; line-height: 1.45; color: ${INK_SOFT}; }
        .bx-pr-points li svg { flex-shrink: 0; margin-top: 3px; }

        /* Med personal: det mörkgröna kortet, knappen vit. */
        .bx-pr-card.featured { background: #0b3d2a; border-color: #0b3d2a; box-shadow: 0 40px 80px -40px rgba(11, 61, 42, .6); }
        .bx-pr-card.featured .bx-pr-name, .bx-pr-card.featured .bx-pr-price, .bx-pr-card.featured .bx-pr-points-lead { color: #fff; }
        .bx-pr-card.featured .bx-pr-for, .bx-pr-card.featured .bx-pr-note, .bx-pr-card.featured .bx-pr-sub, .bx-pr-card.featured .bx-pr-price small { color: rgba(255, 255, 255, .72); }
        .bx-pr-card.featured .bx-pr-points { border-top-color: rgba(255, 255, 255, .16); }
        .bx-pr-card.featured .bx-pr-points li { color: rgba(255, 255, 255, .9); }
        html[data-theme="dark"] #lp-root .bx-pr-card { box-shadow: none; }
        html[data-theme="dark"] #lp-root .bx-pr-card.featured { background: linear-gradient(180deg, #17482c 0%, #0f2e1c 100%); border-color: rgba(63, 192, 99, .45); box-shadow: 0 0 0 1px rgba(63, 192, 99, .12), 0 40px 90px -50px rgba(63, 192, 99, .45); }
        html[data-theme="dark"] #lp-root .bx-pr-card.featured .bx-pr-points { border-top-color: rgba(143, 214, 122, .16); }
        html[data-theme="dark"] #lp-root .bx-pr-cta { color: #3fc063; border-color: #1f9a4a; }
        /* Med personal-knappen: solid klargrön med vit text, samma i båda teman. */
        #lp-root .bx-pr-cta.solid, html[data-theme="dark"] #lp-root .bx-pr-cta.solid { background: linear-gradient(180deg, #25a855 0%, #1a8a43 100%); border: none; color: #fff; box-shadow: 0 1px 0 rgba(255, 255, 255, .25) inset, 0 12px 28px -12px rgba(26, 138, 67, .7); }
        #lp-root .bx-pr-cta.solid:hover, html[data-theme="dark"] #lp-root .bx-pr-cta.solid:hover { background: linear-gradient(180deg, #2bb65d 0%, #1d9649 100%); transform: translateY(-1px); }
        .bx-pr-cta svg { transition: transform .15s; }
        .bx-pr-cta:hover svg { transform: translateX(3px); }

        .bx-cmp { max-width: 940px; margin: 0 auto; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 28px; box-shadow: 0 30px 70px -45px rgba(15, 40, 25, .35); }
        html[data-theme="dark"] #lp-root .bx-cmp { box-shadow: none; }
        .bx-cmp-row { display: grid; grid-template-columns: minmax(0, 1fr) clamp(96px, 21vw, 200px) clamp(96px, 21vw, 200px); }
        .bx-cmp-row > * { display: flex; align-items: center; padding: clamp(14px, 2vw, 18px) clamp(8px, 1.4vw, 14px); }
        .bx-cmp-f { padding-left: clamp(18px, 3.6vw, 36px) !important; font-size: clamp(14px, 3.2vw, 16px); line-height: 1.45; color: ${INK}; min-width: 0; overflow-wrap: anywhere; hyphens: auto; }
        .bx-cmp-t { justify-content: center; }
        .bx-cmp-t.pro { background: color-mix(in srgb, ${BRAND.green} 6%, transparent); }
        html[data-theme="dark"] #lp-root .bx-cmp-t.pro { background: rgba(63, 192, 99, .07); }
        .bx-cmp-item + .bx-cmp-item { border-top: 1px solid var(--mkt-border-soft); }
        .bx-cmp-yes { width: 24px; height: 24px; border-radius: 50%; background: ${BRAND.green}; display: flex; align-items: center; justify-content: center; }
        html[data-theme="dark"] #lp-root .bx-cmp-yes { background: #1f9a4a; }
        .bx-cmp-no { width: 14px; height: 2px; border-radius: 2px; background: var(--mkt-card-border); }

        .bx-cmp-head { position: sticky; top: 84px; z-index: 3; background: var(--mkt-card-bg); border-radius: 28px 28px 0 0; border-bottom: 1px solid var(--mkt-card-border); }
        .bx-cmp-head > * { flex-direction: column; justify-content: flex-end; align-items: center; gap: 4px; padding-top: clamp(20px, 3vw, 28px); padding-bottom: clamp(16px, 2.4vw, 22px); text-align: center; }
        .bx-cmp-head .bx-cmp-f { align-items: flex-start; }
        .bx-cmp-head > :last-child { border-top-right-radius: 28px; }
        .bx-cmp-name { font-size: clamp(13px, 2.9vw, 16px); font-weight: 700; color: ${INK}; }
        .bx-cmp-price { font-size: clamp(12.5px, 2.8vw, 14.5px); color: ${MUTED}; }
        .bx-cmp-head .bx-pr-cta { margin-top: 10px; min-height: 40px; padding: 8px 14px; font-size: 13.5px; border-radius: 10px; }
        .bx-cmp-caption { font-family: ${SERIF}; font-size: clamp(18px, 3vw, 24px); font-weight: 700; color: ${INK}; letter-spacing: -.01em; }

        .bx-cmp-group > * { padding-top: 12px; padding-bottom: 12px; background: var(--mkt-ivory); }
        .bx-cmp-group .bx-cmp-f { font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: ${MUTED}; }
        .bx-cmp-group > .bx-cmp-t.pro { background: color-mix(in srgb, ${BRAND.green} 9%, var(--mkt-ivory)); }
        html[data-theme="dark"] #lp-root .bx-cmp-group > * { background: rgba(255, 255, 255, .03); }
        html[data-theme="dark"] #lp-root .bx-cmp-group > .bx-cmp-t.pro { background: rgba(63, 192, 99, .1); }
        .bx-cmp-end > * { padding: 0; height: 18px; }
        .bx-cmp-end > .bx-cmp-t.pro { border-bottom-right-radius: 28px; }

        .bx-pr-faq .kx-faq-q { font-size: clamp(16px, 3.4vw, 18px); padding: 24px 0; }
        .bx-pr-faq .kx-row-body { font-size: 16px; }

        .bx-pr-mob { display: none; }
        .bx-pr-badge-mob { display: none; margin-top: 12px; }
        @media (max-width: 560px) {
          .bx-pr-mob { display: inline; }
          .bx-pr-for, .bx-pr-points { display: none; }
          .bx-pr-card { border-radius: 22px; }
          .bx-pr-price { font-size: clamp(34px, 10.5vw, 44px); }
          .bx-pr-toggle button { padding: 11px 20px; font-size: 14.5px; }
          .bx-pr-toggle .bx-pr-badge { display: none; }
          .bx-pr-badge-mob { display: inline-block; }
          .bx-pr-price small { display: block; font-size: 13px; margin-top: 6px; }
          .bx-cmp-head .bx-pr-cta { display: none; }
          .bx-cmp-head { top: 64px; }
          .bx-pr-cta { min-height: 50px; }
          .bx-pr-cta svg { display: none; }
        }
      `}</style>

      <section className="bx-pr-hero" style={{ background: 'var(--mkt-page-bg)' }}>
        <Reveal>
          <h1 className="bx-pr-h1">{c.hero.title}</h1>
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
          {/* Telefon: rabatten under valet i stället för inuti knappen, där den bröts på flera rader. */}
          <div><span className="bx-pr-badge bx-pr-badge-mob">{c.interval.yearlyBadge}</span></div>
        </Reveal>
      </section>

      {/* Två nivåer sida vid sida, även på telefonen (kundönskemål). Priset
          ur plans.js, samma källa som checkouten debiterar efter. */}
      <section style={{ background: 'var(--mkt-page-bg)', paddingBottom: 'clamp(64px, 9vw, 104px)' }}>
        <div className="bx-pr-cards">
          {tiers.map((tier, i) => {
            const plan = resolvePlan(tier.key, interval);
            const isBase = tier.key === baseTier.key;
            const points = isBase ? tier.features.slice(0, 5) : extraRows;
            return (
              <Reveal key={tier.key} delay={i * 80} className={`bx-pr-card${tier.featured ? ' featured' : ''}`}>
                <h2 className="bx-pr-name">{tier.name}</h2>
                {tier.recommend && <p className="bx-pr-for">{tier.recommend}</p>}
                <div className="bx-pr-price">{plan.price} kr<small> /mån</small></div>
                <p className="bx-pr-note">
                  {/* Månadsvis: nivåns korta beskrivning, bara på telefonen där raden ovanför är dold. */}
                  {interval === 'yearly' ? c.yearlySavingsNote(plan.savingPerYear) : <span className="bx-pr-mob">{tier.subtitle}</span>}
                </p>
                <button type="button" className={`bx-pr-cta${tier.featured ? ' solid' : ''}`} onClick={() => enterApp(plan.id)}>
                  {c.cta} <ArrowRight size={17} />
                </button>
                <div className="bx-pr-sub">
                  {interval === 'yearly' ? c.yearlyMinimumNote(YEARLY_MINIMUM_MONTHS) : c.monthlyNote}
                </div>
                <ul className="bx-pr-points">
                  {!isBase && <li className="bx-pr-points-lead">{everythingIn(baseTier.name)}</li>}
                  {points.map(f => (
                    <li key={f}>
                      <Check size={17} color={tier.featured ? '#8fd67a' : ACCENT.green.fg} strokeWidth={3} />
                      {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Jämförelsen: varje funktion en gång, en bock per nivå ── */}
      <section style={{ padding: 'clamp(80px, 11vw, 120px) 16px', background: IVORY, borderTop: '1px solid var(--mkt-border-soft)', borderBottom: '1px solid var(--mkt-border-soft)' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: 'clamp(28px, 4vw, 44px)' }}>
          <h2 className="kx-h2" style={{ fontSize: 'clamp(28px, 4.2vw, 46px)', margin: 0 }}>
            {COMPARE_HEADING[locale] || COMPARE_HEADING.sv}
          </h2>
        </Reveal>
        <Reveal delay={60} className="bx-cmp">
          <div className="bx-cmp-row bx-cmp-head">
            <span className="bx-cmp-f" />
            {tiers.map(t => {
              const plan = resolvePlan(t.key, interval);
              return (
                <span key={t.key} className={tierCell(t)}>
                  <span className="bx-cmp-name">{t.name}</span>
                  <span className="bx-cmp-price">{plan.price} kr/mån</span>
                  <button type="button" className={`bx-pr-cta${t.featured ? ' solid' : ''}`} onClick={() => enterApp(plan.id)}>{c.cta}</button>
                </span>
              );
            })}
          </div>
          <div className="bx-cmp-row bx-cmp-group">
            <span className="bx-cmp-f">{groups.base}</span>
            {tiers.map(t => <span key={t.key} className={tierCell(t)} />)}
          </div>
          {baseRows.map(renderRow)}
          <div className="bx-cmp-row bx-cmp-group">
            <span className="bx-cmp-f">{groups.payroll}</span>
            {tiers.map(t => <span key={t.key} className={tierCell(t)} />)}
          </div>
          {extraRows.map(renderRow)}
          <div className="bx-cmp-row bx-cmp-end">
            <span />
            {tiers.map(t => <span key={t.key} className={tierCell(t)} />)}
          </div>
        </Reveal>
      </section>

      <section style={{ padding: 'clamp(72px, 10vw, 110px) 20px clamp(80px, 11vw, 120px)', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 className="kx-h2" style={{ fontSize: 'clamp(28px, 4.2vw, 46px)', margin: 0 }}>{c.faqHeading}</h2>
          </Reveal>
          <Reveal delay={80} className="bx-pr-faq">
            <KitFaq items={c.faq} />
            <Link to="/billigt-bokforingsprogram" style={{ display: 'inline-block', marginTop: '24px', color: 'var(--mkt-accent-green-fg)', fontWeight: 600, fontSize: '15px' }}>Så jämför du priset på bokföringsprogram</Link>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
