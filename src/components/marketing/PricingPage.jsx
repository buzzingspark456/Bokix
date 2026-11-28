import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check } from '../icons';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY } from './marketingTokens';
import { KitStyles, KitFaq } from './subpageKit';
import { PRICING_TIERS, TRADE_PRICING_TIER } from './pricingTiers';
import { localizedPricingTiers } from '../../content/marketing/pricingTiers';
import { PRICING_CONTENT } from '../../content/marketing/pricing';
import { resolvePlan, YEARLY_MINIMUM_MONTHS } from '../../utils/plans';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// Prissidan (omgjord 2026-11-21): samma upplägg som prisförslaget från
// november (stora kort med beskrivning och höjdpunkter, en jämförelse med
// etiketter), men med dagens två nivåer och priser. Priserna kommer ur
// plans.js, samma källa som kassan debiterar efter. Byts till de nya
// nivåerna när AB:t är klart (se grenen forslag/priser-efter-ab).
// Inga skärmbilder och ingen jämförelse mot Excel här (grundarens beslut).

const G = BRAND.green;

function buildFaqSchema(faq) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}

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
        // Ingen moms läggs på i kassan, priset är slutbeloppet.
        priceSpecification: { '@type': 'UnitPriceSpecification', price: String(t.price), priceCurrency: 'SEK', unitText: 'MON', valueAddedTaxIncluded: true },
      })),
    },
  };
}

// Det kortet lyfter fram per nivå.
const HIGHLIGHTS = {
  solo: ['Obegränsat med kvitton, fakturor och offerter', 'Moms, bokslut och årsredovisning', 'Bjud in 1 person, konsult och revisor gratis'],
  employer: ['Allt i Bas', 'Lön, lönebesked och arbetsgivardeklaration', 'Bjud in 2 personer, konsult och revisor gratis'],
  trade: ['Allt i Personal', 'Order, lager och inköp som hänger ihop', 'Prissättning med marginalmål'],
};

// Jämförelsen. Bas och Personal: allt som finns i Bokix i dag; skillnaden är
// lön och hur många man kan bjuda in (utils/plans.js invitedUserLimit).
// Handel (kommer snart) har allt i Personal plus handelsdelen.
const ALL = { kind: 'yes', text: 'Obegränsat', strong: true };
const IN = { kind: 'yes', text: 'Ingår' };
const NO = { kind: 'no' };
const SOON = { kind: 'soon' };
const COMPARE_BASE = [
  { group: 'Bokföring och fakturor' },
  { title: 'Bokföring', desc: 'Verifikationer, kontoplan och rapporter.', values: [ALL, ALL] },
  { title: 'Kvittoavläsning', desc: 'Datum, belopp och moms läses av från ett foto eller en PDF.', values: [ALL, ALL] },
  { title: 'Kundfakturor och offerter', desc: 'Med din logga, ROT och RUT och kortbetalning om du vill.', values: [ALL, ALL] },
  { title: 'Leverantörsfakturor', desc: 'Registrera, betala och bokför.', values: [ALL, ALL] },
  { title: 'Fakturor från egen e-post', desc: 'Skicka från din Gmail eller egen adress.', values: [IN, IN] },
  { title: 'Kontoutdrag från banken', desc: 'Läses in som fil och matchas mot fakturor och kvitton.', values: [{ kind: 'yes', text: 'Som fil', soon: 'Direktkoppling under utveckling' }, { kind: 'yes', text: 'Som fil', soon: 'Direktkoppling under utveckling' }] },
  { group: 'Moms, bokslut och skatt' },
  { title: 'Momsdeklaration', desc: 'Räknas fram ur bokföringen, som fil till Skatteverket.', values: [IN, IN] },
  { title: 'Bokslut och deklaration', desc: 'NE-bilaga, INK2, INK3 eller INK4 beroende på bolagsform.', values: [IN, IN] },
  { title: 'Årsredovisning K2', desc: 'För aktiebolag och ekonomiska föreningar.', values: [IN, IN] },
  { title: 'ROT och RUT', desc: 'Avdraget räknas och begäran tas fram.', values: [IN, IN] },
  { group: 'Lön' },
  { title: 'Lönekörning', desc: 'Skattetabeller, arbetsgivaravgift och lönebesked.', values: [NO, IN] },
  { title: 'Arbetsgivardeklaration', desc: 'AGI-fil till Skatteverket.', values: [NO, IN] },
  { title: 'Betalfil till banken', desc: 'Lönerna betalas ut med en fil.', values: [NO, IN] },
  { group: 'Mer' },
  { title: 'Stripe och Zettle', desc: 'Kortbetalningar och kassa bokförs.', values: [IN, IN] },
  { title: 'Lager och artiklar', desc: 'Lagervärde, påslag och inventering.', values: [IN, IN] },
  { title: 'Projekt och tid', desc: 'Tid och resultat per uppdrag.', values: [IN, IN] },
  { title: 'Anläggningsregister', desc: 'Avskrivningar varje månad.', values: [IN, IN] },
  { title: 'Bjud in fler', desc: 'Utöver dig själv. Din redovisningskonsult eller revisor räknas inte och ingår gratis.', values: [{ kind: 'yes', text: '1 person' }, { kind: 'yes', text: '2 personer' }] },
  { title: 'SIE4-export och support', desc: 'Ta med bokföringen när du vill. Hjälp på svenska via mejl.', values: [IN, IN] },
];
// Handel får samma värde som Personal på varje rad, plus en egen grupp.
const COMPARE = [
  ...COMPARE_BASE.map(r => (r.group ? r : { ...r, values: [...r.values, r.values[1]] })),
  { group: 'Handel' },
  { title: 'Order', desc: 'Order, delleverans och restorder.', values: [NO, NO, SOON] },
  { title: 'Inköpsorder', desc: 'Beställ från leverantörer och ta emot varorna i lagret.', values: [NO, NO, SOON] },
  { title: 'Prissättning', desc: 'Priser med marginalmål per artikel.', values: [NO, NO, SOON] },
  { title: 'Orderbekräftelse och följesedel', desc: 'Skickas till kunden med din logga.', values: [NO, NO, SOON] },
];

function Value({ v }) {
  if (v.kind === 'no') return <span className="pp-dash" aria-label="Ingår inte" />;
  if (v.kind === 'soon') return <span className="pp-soon"><i aria-hidden="true" />Kommer snart</span>;
  return (
    <span className="pp-val-wrap">
      <span className={`pp-val${v.strong ? ' strong' : ''}`}><span className="pp-check"><Check size={12} color="#fff" strokeWidth={3.4} /></span>{v.text}</span>
      {v.soon && <span className="pp-soon"><i aria-hidden="true" /><span className="pp-soon-long">{v.soon}</span><span className="pp-soon-short">Under utveckling</span></span>}
    </span>
  );
}

export default function PricingPage({ locale = 'sv' }) {
  const navigate = useNavigate();
  const c = PRICING_CONTENT[locale] || PRICING_CONTENT.sv;
  const tiers = [...localizedPricingTiers(locale), TRADE_PRICING_TIER];
  // Månadsvis eller årsplan. Valet följer med hela vägen till Stripe.
  const [interval, setInterval] = useState('monthly');
  const [mt, setMt] = useState('employer');
  const enterApp = (planId = 'employer_monthly') => navigate('/', { state: { enterApp: true, authMode: 'signup', plan: planId } });
  const cell = (t) => [t.featured ? 'feat' : '', t.key !== mt ? 'mhide' : ''].filter(Boolean).join(' ') || undefined;

  return (
    <MarketingLayout>
      <PageMeta title={c.meta.title} description={c.meta.description} path={locale === 'sv' ? '/priser' : `/${locale}/priser`} basePath="/priser" locale={locale} />
      <JsonLd data={buildSoftwareSchema(c.schemaDescription)} />
      <JsonLd data={buildFaqSchema(c.faq)} />
      <KitStyles />
      <style>{`
        .pp-hero { padding: clamp(116px, 18vw, 150px) 20px 0; text-align: center; }
        .pp-h1 { font-family: ${SERIF}; font-size: clamp(36px, 6vw, 62px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.05; color: ${INK}; margin: 0; }
        .pp-lead { font-size: 17px; color: ${MUTED}; margin: 14px auto 0; max-width: 560px; line-height: 1.5; }
        .pp-toggle { display: inline-flex; gap: 4px; padding: 5px; border-radius: 999px; background: var(--mkt-ivory); border: 1px solid var(--mkt-card-border); margin-top: 28px; }
        .pp-toggle button { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: 999px; border: 0; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 700; background: transparent; color: ${MUTED}; }
        .pp-toggle button.on { background: var(--mkt-card-bg); color: ${INK}; box-shadow: 0 2px 10px rgba(0, 0, 0, .15); }
        .pp-save { font-size: 12px; padding: 2px 9px; border-radius: 999px; background: color-mix(in srgb, ${G} 20%, transparent); color: var(--mkt-accent-green-fg, ${G}); }

        .pp-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; max-width: 1180px; margin: clamp(36px, 5vw, 56px) auto 0; padding: 0 16px; }
        .pp-card { display: flex; flex-direction: column; border-radius: 22px; padding: 32px 30px 34px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); position: relative; }
        .pp-card.featured { background: color-mix(in srgb, ${G} 8%, var(--mkt-card-bg)); border: 2px solid color-mix(in srgb, ${G} 55%, transparent); }
        .pp-badge { position: absolute; top: -13px; left: 30px; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 999px; background: ${G}; color: #fff; }
        .pp-name { font-family: ${SERIF}; font-size: 38px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; color: ${INK}; margin: 0; }
        .pp-tag { font-size: 15px; font-weight: 600; color: ${MUTED}; margin-top: 8px; }
        .pp-price { font-family: ${SERIF}; font-size: 48px; font-weight: 700; letter-spacing: -0.03em; color: ${INK}; margin-top: 26px; line-height: 1; }
        .pp-price small { font-family: inherit; font-size: 16px; font-weight: 500; letter-spacing: 0; color: ${MUTED}; margin-left: 4px; }
        .pp-vat { font-size: 13px; color: ${MUTED}; margin-top: 8px; }
        .pp-hr { height: 1px; background: var(--mkt-border-soft); margin: 22px 0; border: 0; }
        .pp-desc { font-size: 15.5px; line-height: 1.55; color: ${INK_SOFT}; margin: 0; }
        .pp-btn { width: 100%; min-height: 48px; border-radius: 12px; font-family: inherit; font-size: 15.5px; font-weight: 700; cursor: pointer; border: 1.5px solid ${INK}; background: transparent; color: ${INK}; }
        .pp-card.featured .pp-btn, .pp-head .feat .pp-btn { background: ${G}; border-color: ${G}; color: #fff; }
        .pp-small { font-size: 13px; color: ${MUTED}; margin-top: 10px; text-align: center; }
        .pp-hl-title { font-size: 15px; font-weight: 700; color: ${INK}; margin: 0 0 14px; }
        .pp-hl { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
        .pp-hl li { display: flex; gap: 12px; align-items: flex-start; font-size: 15px; line-height: 1.45; color: ${INK_SOFT}; }
        .pp-tick { flex-shrink: 0; width: 22px; height: 22px; border-radius: 50%; background: color-mix(in srgb, ${G} 18%, transparent); display: flex; align-items: center; justify-content: center; margin-top: 1px; }
        .pp-note { max-width: 900px; margin: 22px auto 0; padding: 0 16px; text-align: center; font-size: 14px; color: ${MUTED}; line-height: 1.55; }

        .pp-cmp-sec { padding: clamp(72px, 10vw, 110px) 16px; background: ${IVORY}; border-top: 1px solid var(--mkt-border-soft); margin-top: clamp(64px, 9vw, 100px); }
        .pp-cmp { max-width: 960px; margin: 0 auto; }
        .pp-cmp-h { font-family: ${SERIF}; font-size: clamp(28px, 4.2vw, 44px); font-weight: 700; color: ${INK}; margin: 0; letter-spacing: -0.02em; }
        .pp-cmp-lead { font-size: 16px; color: ${MUTED}; margin: 10px 0 0; }
        .pp-table { margin-top: 32px; border: 1px solid var(--mkt-card-border); border-radius: 22px; background: var(--mkt-card-bg); }
        .pp-row { display: grid; grid-template-columns: minmax(0, 1.5fr) repeat(3, minmax(0, 1fr)); }
        .pp-card.soon { background: var(--mkt-card-bg); }
        .pp-card.soon .pp-price { color: ${MUTED}; }
        .pp-btn:disabled { cursor: default; opacity: .55; }
        .pp-soon-tag { position: absolute; top: -13px; left: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px 4px 10px; background-color: var(--mkt-card-bg) !important; border-radius: 999px; border: 1px solid color-mix(in srgb, ${G} 30%, transparent); background: color-mix(in srgb, ${G} 9%, transparent); font-size: 12.5px; font-weight: 700; color: var(--mkt-accent-green-fg, ${G}); }
        .pp-soon-tag i { width: 7px; height: 7px; border-radius: 50%; background: #2fbf63; }
        .pp-row > * { padding: 16px 12px; display: flex; align-items: center; justify-content: center; }
        .pp-row > :first-child { justify-content: flex-start; padding-left: 24px; }
        .pp-head { position: sticky; top: 64px; z-index: 2; background: var(--mkt-card-bg); border-radius: 22px 22px 0 0; border-bottom: 1px solid var(--mkt-card-border); }
        .pp-head > * { flex-direction: column; gap: 4px; padding: 20px 12px; }
        .pp-head .feat { background: color-mix(in srgb, ${G} 9%, transparent); }
        .pp-head-label { font-family: ${SERIF}; font-size: 20px; font-weight: 700; color: ${INK}; align-items: flex-start !important; }
        .pp-head-name { font-family: ${SERIF}; font-size: 22px; font-weight: 700; color: ${INK}; }
        .pp-head-price { font-size: 15px; color: ${MUTED}; }
        .pp-head .pp-btn { margin-top: 10px; min-height: 40px; font-size: 14px; max-width: 170px; }
        .pp-grp > * { padding-top: 22px !important; padding-bottom: 8px !important; }
        .pp-grp > :first-child { font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: ${MUTED}; }
        .pp-row > .feat { background: color-mix(in srgb, ${G} 5%, transparent); }
        .pp-item + .pp-item > * { border-top: 1px solid var(--mkt-border-soft); }
        .pp-ft { display: flex; flex-direction: column; align-items: flex-start !important; text-align: left; }
        .pp-ft b { font-size: 15.5px; color: ${INK}; }
        .pp-ft span { font-size: 14px; color: ${MUTED}; margin-top: 3px; line-height: 1.4; }
        .pp-val-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
        .pp-pill { display: inline-flex; justify-content: center; min-width: 104px; padding: 8px 16px; border-radius: 999px; font-size: 14.5px; font-weight: 700; white-space: nowrap; }
        .pp-pill.yes { background: color-mix(in srgb, ${G} 20%, transparent); color: var(--mkt-accent-green-fg, ${G}); }
        .pp-pill-sub { font-size: 12.5px; color: ${MUTED}; }
        .pp-val { display: inline-flex; align-items: center; gap: 8px; font-size: 14.5px; font-weight: 600; color: ${INK_SOFT}; white-space: nowrap; }
        .pp-val.strong { color: ${INK}; font-weight: 700; }
        .pp-check { width: 20px; height: 20px; border-radius: 50%; background: ${G}; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pp-soon { display: inline-flex; align-items: center; gap: 6px; margin-top: 2px; padding: 2px 9px 2px 7px; border-radius: 999px; border: 1px solid color-mix(in srgb, ${G} 30%, transparent); background: color-mix(in srgb, ${G} 9%, transparent); font-size: 11.5px; font-weight: 600; color: var(--mkt-accent-green-fg, ${G}); white-space: nowrap; }
        .pp-soon-short { display: none; }
        .pp-soon i { position: relative; width: 7px; height: 7px; border-radius: 50%; background: #2fbf63; flex-shrink: 0; }
        .pp-soon i::after { content: ''; position: absolute; inset: 0; border-radius: 50%; background: #2fbf63; animation: lp-pulse 1.8s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .pp-soon i::after { animation: none; } }
        .pp-dash { width: 16px; height: 2px; border-radius: 2px; background: var(--mkt-card-border); }
        .pp-end > * { padding: 0 !important; height: 18px; }
        .pp-mtabs { display: none; }

        .pp-faq-sec { padding: clamp(64px, 9vw, 100px) 16px; background: var(--mkt-page-bg); }
        .pp-faq { max-width: 760px; margin: 0 auto; }

        @media (max-width: 1000px) {
          .pp-cards { grid-template-columns: minmax(0, 1fr); max-width: 520px; }
        }
        @media (max-width: 640px) {
          .pp-row { grid-template-columns: minmax(0, 1fr) 128px; }
          .pp-row > .mhide { display: none !important; }
          .pp-row > :first-child { padding-left: 14px; }
          .pp-row > * { padding: 12px 6px; }
          .pp-mtabs { display: flex; gap: 6px; margin-top: 22px; padding: 5px; border-radius: 999px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); }
          .pp-mtabs button { flex: 1; padding: 10px 0; border-radius: 999px; border: 0; background: transparent; color: ${MUTED}; font-family: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
          .pp-mtabs button.on { background: ${G}; color: #fff; }
          .pp-head { top: 56px; }
          .pp-head .pp-btn { display: none; }
          .pp-head-name { font-size: 17px; }
          .pp-val { font-size: 13px; white-space: normal; text-align: left; }
          .pp-soon-long { display: none; }
          .pp-soon-short { display: inline; }
          .pp-ft b { font-size: 14px; }
          .pp-ft span { font-size: 12.5px; }
        }
      `}</style>

      <section className="pp-hero" style={{ background: 'var(--mkt-page-bg)' }}>
        <Reveal>
          <h1 className="pp-h1">{c.hero.title}</h1>
          <p className="pp-lead">{c.hero.lead}</p>
          <div className="pp-toggle" role="group" aria-label="Betalningsintervall">
            <button type="button" className={interval === 'monthly' ? 'on' : undefined} aria-pressed={interval === 'monthly'} onClick={() => setInterval('monthly')}>{c.interval.monthly}</button>
            <button type="button" className={interval === 'yearly' ? 'on' : undefined} aria-pressed={interval === 'yearly'} onClick={() => setInterval('yearly')}>{c.interval.yearly} <span className="pp-save">{c.interval.yearlyBadge}</span></button>
          </div>
        </Reveal>
      </section>

      <section style={{ background: 'var(--mkt-page-bg)' }}>
        <div className="pp-cards">
          {tiers.map((t, i) => {
            const plan = resolvePlan(t.key, interval);
            return (
              <Reveal key={t.key} delay={i * 70} className={`pp-card${t.featured ? ' featured' : ''}${t.comingSoon ? ' soon' : ''}`}>
                {t.featured && <span className="pp-badge">{c.popular}</span>}
                <h2 className="pp-name">{t.name}</h2>
                <div className="pp-tag">{t.subtitle}</div>
                {t.comingSoon && <span className="pp-soon-tag"><i aria-hidden="true" />Kommer snart</span>}
                <div className="pp-price">{plan.price} kr<small>/mån</small></div>
                <div className="pp-vat">{interval === 'yearly' ? c.yearlySavingsNote(plan.savingPerYear) : c.noVat}</div>
                <hr className="pp-hr" />
                <p className="pp-desc">{t.recommend}</p>
                <hr className="pp-hr" />
                {t.comingSoon
                  ? <button type="button" className="pp-btn" disabled>Kommer snart</button>
                  : <button type="button" className="pp-btn" onClick={() => enterApp(plan.id)}>{c.cta}</button>}
                <div className="pp-small">{t.comingSoon ? 'Går inte att välja än' : interval === 'yearly' ? c.yearlyMinimumNote(YEARLY_MINIMUM_MONTHS) : c.monthlyNote}</div>
                <hr className="pp-hr" />
                <p className="pp-hl-title">{c.highlightsTitle}</p>
                <ul className="pp-hl">
                  {(HIGHLIGHTS[t.key] || []).map(h => (
                    <li key={h}><span className="pp-tick"><Check size={13} color={G} strokeWidth={3.2} /></span>{h}</li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
        <p className="pp-note">{c.footNote}</p>
      </section>

      <section className="pp-cmp-sec">
        <div className="pp-cmp">
          <h2 className="pp-cmp-h">{c.compareHeading}</h2>
          <p className="pp-cmp-lead">{c.compareLead}</p>
          <div className="pp-mtabs" role="group" aria-label="Visa nivå">
            {tiers.map(t => (
              <button key={t.key} type="button" className={mt === t.key ? 'on' : undefined} aria-pressed={mt === t.key} onClick={() => setMt(t.key)}>{t.name}</button>
            ))}
          </div>
          <div className="pp-table">
            <div className="pp-row pp-head">
              <span className="pp-head-label">{c.compareIncluded}</span>
              {tiers.map(t => {
                const plan = resolvePlan(t.key, interval);
                return (
                  <span key={t.key} className={cell(t)}>
                    <span className="pp-head-name">{t.name}</span>
                    <span className="pp-head-price">{plan.price} kr/mån</span>
                    {t.comingSoon
                      ? <button type="button" className="pp-btn" disabled>Snart</button>
                      : <button type="button" className="pp-btn" onClick={() => enterApp(plan.id)}>{c.ctaShort}</button>}
                  </span>
                );
              })}
            </div>
            {COMPARE.map(r => (r.group ? (
              <div key={r.group} className="pp-row pp-grp">
                <span>{r.group}</span>
                {tiers.map(t => <span key={t.key} className={cell(t)} />)}
              </div>
            ) : (
              <div key={r.title} className="pp-row pp-item">
                <span className="pp-ft"><b>{r.title}</b><span>{r.desc}</span></span>
                {r.values.map((v, i) => <span key={i} className={cell(tiers[i])}><Value v={v} /></span>)}
              </div>
            )))}
            <div className="pp-row pp-end"><span />{tiers.map(t => <span key={t.key} className={cell(t)} />)}</div>
          </div>
        </div>
      </section>

      <section className="pp-faq-sec">
        <div className="pp-faq">
          <h2 className="pp-cmp-h" style={{ textAlign: 'center' }}>{c.faqHeading}</h2>
          <div style={{ marginTop: 24 }}><KitFaq items={c.faq} /></div>
          <Link to="/billigt-bokforingsprogram" style={{ display: 'inline-block', marginTop: '24px', color: 'var(--mkt-accent-green-fg)', fontWeight: 600, fontSize: '15px' }}>Så jämför du priset på bokföringsprogram</Link>
        </div>
      </section>
    </MarketingLayout>
  );
}
