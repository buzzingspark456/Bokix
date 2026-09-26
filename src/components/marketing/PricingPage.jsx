import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Check } from '../icons';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
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

// Samma FAQ-stil som startsidan (LandingPage.jsx) — numrerad cirkel, en
// enda genomgående accentfärg, större text.
const FAQ_ACCENT = ACCENT.green;

function FaqItem({ q, a, index, open, onToggle }) {
  return (
    <div
      style={{
        borderRadius: '16px',
        background: open ? `color-mix(in srgb, ${FAQ_ACCENT.fg} 7%, transparent)` : 'transparent',
        borderLeft: `3px solid ${open ? FAQ_ACCENT.fg : 'transparent'}`,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', padding: '22px 16px 22px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ width: 34, height: 34, borderRadius: '50%', background: FAQ_ACCENT.fg, color: 'white', fontSize: '13.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
          <span style={{ fontSize: '17px', fontWeight: 700, color: INK }}>{q}</span>
        </span>
        <ChevronDown size={20} color={open ? FAQ_ACCENT.fg : MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '200px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.7, margin: '0 16px 24px 66px' }}>{a}</p>
      </div>
    </div>
  );
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
  const [openFaq, setOpenFaq] = useState(0);
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

      <section style={{ padding: 'clamp(110px, 22vw, 150px) 24px clamp(36px, 7vw, 56px)', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.14 }}>
            {c.hero.title}
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            {c.hero.subtitle}
          </p>
        </Reveal>
      </section>

      {/* Två prisnivåer (kundönskemål 2026-09-26): korta kort sida vid
          sida, även på telefonen, med bara pris, vem nivån passar och
          knappen. Vad som ingår står EN gång i jämförelsetabellen under,
          i stället för samma sju rader upprepade i båda korten. Data från
          PRICING_TIERS (pricingTiers.js), priset ur plans.js — samma
          källa som checkouten debiterar efter. */}
      <section style={{ padding: '0 16px 20px', background: 'var(--mkt-page-bg)' }}>
        <style>{`
          .bx-pr-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(10px, 3vw, 24px); max-width: 860px; margin: 0 auto; }
          .bx-pr-card { background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 22px; padding: clamp(18px, 4vw, 32px); display: flex; flex-direction: column; box-shadow: var(--mkt-card-shadow); }
          .bx-pr-card.featured { border: 2px solid ${BRAND.green}; }
          html[data-theme="dark"] #lp-root .bx-pr-card.featured { border-color: var(--mkt-accent-green-fg); }
          .bx-pr-name { font-size: clamp(12px, 2.8vw, 13.5px); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; }
          .bx-pr-price { font-family: ${SERIF}; font-size: clamp(34px, 9vw, 56px); font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1.05; margin: 10px 0 6px; white-space: nowrap; }
          .bx-pr-price small { font-family: inherit; font-size: 0.3em; font-weight: 500; color: ${MUTED}; letter-spacing: 0; }
          .bx-pr-note { font-size: clamp(12px, 2.8vw, 13.5px); color: ${MUTED}; line-height: 1.5; margin: 0 0 18px; flex: 1; }
          .bx-pr-cta { width: 100%; min-height: 48px; padding: 14px; border-radius: 12px; border: none; background: ${BRAND.green}; color: #fff; font-family: inherit; font-size: clamp(13.5px, 3.2vw, 15px); font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px; }
          .bx-pr-sub { text-align: center; font-size: 12px; color: ${MUTED}; margin-top: 10px; line-height: 1.45; }
          .bx-pr-recommend { display: block; }
          @media (max-width: 520px) { .bx-pr-recommend { display: none; } .bx-pr-cta svg { display: none; } }

          .bx-pr-table { max-width: 860px; margin: 0 auto; border-top: 1px solid var(--mkt-border-soft); }
          .bx-pr-row { display: grid; grid-template-columns: minmax(0, 1fr) clamp(76px, 18vw, 150px) clamp(76px, 18vw, 150px); align-items: center; border-bottom: 1px solid var(--mkt-border-soft); }
          .bx-pr-row > * { padding: 15px 8px; }
          .bx-pr-row > :first-child { padding-left: 0; font-size: clamp(13.5px, 3.4vw, 15px); color: ${INK_SOFT}; line-height: 1.45; }
          .bx-pr-cell { display: flex; justify-content: center; }
          .bx-pr-head { position: sticky; top: 84px; z-index: 2; background: var(--mkt-page-bg); }
          .bx-pr-head > * { font-size: clamp(11px, 2.6vw, 12.5px); font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: ${MUTED}; text-align: center; }
          .bx-pr-group > * { padding-top: 26px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; }
          .bx-pr-yes { width: 24px; height: 24px; border-radius: 50%; background: ${ACCENT.green.soft}; display: flex; align-items: center; justify-content: center; }
          .bx-pr-no { width: 14px; height: 2px; border-radius: 2px; background: var(--mkt-card-border); }
        `}</style>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          {/* Betalningsintervall. Årsvis är förvalt AV — den som inte
              aktivt väljer det ska aldrig råka binda upp ett år i förskott. */}
          <Reveal style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
            <div role="group" aria-label="Betalningsintervall" style={{ display: 'inline-flex', gap: '4px', padding: '5px', borderRadius: '999px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}` }}>
              {[
                { id: 'monthly', label: c.interval.monthly },
                { id: 'yearly', label: c.interval.yearly, badge: c.interval.yearlyBadge },
              ].map(opt => {
                const active = interval === opt.id;
                return (
                  <button
                    key={opt.id} type="button" onClick={() => setInterval(opt.id)} aria-pressed={active}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '8px',
                      padding: '11px 20px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '14.5px', fontWeight: 700, border: 'none',
                      background: active ? 'var(--mkt-card-bg)' : 'transparent',
                      color: active ? INK : MUTED,
                      boxShadow: active ? '0 2px 8px rgba(28,36,32,0.10)' : 'none',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {opt.label}
                    {opt.badge && (
                      <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: ACCENT.green.soft, color: ACCENT.green.fg }}>
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </Reveal>
        </div>

        <div className="bx-pr-cards">
          {tiers.map((tier, i) => {
            const plan = resolvePlan(tier.key, interval);
            return (
              <Reveal key={tier.key} delay={i * 80} className={`bx-pr-card${tier.featured ? ' featured' : ''}`}>
                <div className="bx-pr-name">{tier.name}</div>
                <div className="bx-pr-price">{plan.price} kr<small> /mån</small></div>
                <p className="bx-pr-note">
                  {interval === 'yearly' ? c.yearlySavingsNote(plan.savingPerYear) : `${tier.subtitle} · ${c.freeTrialSuffix}`}
                  {tier.recommend && <span className="bx-pr-recommend" style={{ marginTop: '10px' }}>{tier.recommend}</span>}
                </p>
                <button type="button" className="bx-pr-cta lp-btn-primary" onClick={() => enterApp(plan.id)}>
                  {c.cta} <ArrowRight size={16} />
                </button>
                <div className="bx-pr-sub">
                  {interval === 'yearly' ? c.yearlyMinimumNote(YEARLY_MINIMUM_MONTHS) : c.monthlyNote}
                </div>
              </Reveal>
            );
          })}
        </div>

        {/* Momsraden direkt under beloppen: "tillkommer det moms?" är
            frågan man ställer i samma sekund som man ser priset. Bokix är
            inte momsregistrerat — priset är hela beloppet. */}
        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--mkt-muted)', margin: '24px auto 0', maxWidth: '520px', lineHeight: 1.65 }}>
          {c.vatNote} {c.noHiddenFeesNote}
        </p>
      </section>

      {/* ── Jämförelsen: varje funktion en gång, en bock per nivå ── */}
      <section style={{ padding: '56px 16px 90px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 3.6vw, 36px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, margin: 0 }}>
            {COMPARE_HEADING[locale] || COMPARE_HEADING.sv}
          </h2>
        </Reveal>
        <Reveal delay={60} className="bx-pr-table">
          <div className="bx-pr-row bx-pr-head">
            <span />
            {tiers.map(t => <span key={t.key}>{t.name}</span>)}
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
        </Reveal>
      </section>

      {/* Kundönskemål: ingen demo på prissidan längre — startsidans "Se
          demo" i Hero (DemoOverlay, se LandingPage.jsx) är nu den ENDA
          platsen för den riktiga, klickbara produktvisningen. */}

      <section style={{ padding: '90px 24px 100px', background: IVORY, borderTop: '1px solid var(--mkt-border-soft)' }}>
        <div style={{ maxWidth: 'min(88vw, 900px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '44px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 40px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>{c.faqHeading}</h2>
          </Reveal>
          <Reveal delay={100} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: '8px 30px', boxShadow: CARD_SHADOW }}>
            {c.faq.map((item, i) => (
              <FaqItem key={item.q} {...item} index={i} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
