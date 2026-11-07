import React from 'react';
import { Reveal } from './MarketingLayout';
import DemoPlayer, { PlayOnView } from './DemoPlayer';
import { BOKFORING_DEMO, FAKTURERING_DEMO, SKATT_DEMO } from './demoScenesFeatures';
import { Check } from '../icons';

// Delar till bolagsforms- och funktionssidorna (OrgTypePage), 2026-11-07:
// en rad med det viktigaste under hjälten och en riktig appdemo.

// Vilket flöde i appen som visas: det sidan handlar om, ritat som appen ser
// ut i dag (demoApp.jsx). Saknas en scen som passar visas ingen demo, hellre
// än en som handlar om något annat.
const SKATT = { steps: SKATT_DEMO, title: 'Momsen och bokslutet i appen', lead: 'Bokix kontrollerar perioden och fyller i momsdeklarationen ur bokföringen. Du lämnar in själv.' };
const BOKFORING = { steps: BOKFORING_DEMO, title: 'Den löpande bokföringen i appen', lead: 'Kvittot läses av, verifikationen skrivs och det som är osäkert hamnar i Att granska.' };
export const DEMO_BY_SLUG = {
  'enskild-firma': SKATT,
  aktiebolag: SKATT,
  handelsbolag: SKATT,
  'ekonomisk-forening': BOKFORING,
  'ideell-forening': BOKFORING,
  nystartat: BOKFORING,
  billigt: BOKFORING,
  fakturering: { steps: FAKTURERING_DEMO, title: 'Fakturan i appen', lead: 'Från ny faktura till betald, med kortbetalning och bokföring som följer med.' },
};

/** Raden under hjälten: sidans viktigaste punkter, utan siffror och kort. */
export function HighlightStrip({ items }) {
  if (!items?.length) return null;
  return (
    <div className="ot-strip" role="list">
      {items.map(h => (
        <span key={h} role="listitem" className="ot-strip-item"><Check size={16} aria-hidden="true" />{h}</span>
      ))}
    </div>
  );
}

/** Appdemon för sidan, eller inget om ingen scen passar. */
export function DemoSection({ slug }) {
  const demo = DEMO_BY_SLUG[slug];
  if (!demo) return null;
  return (
    <section className="kx-section" style={{ background: 'var(--mkt-page-bg)' }}>
      <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px' }}>
        <h2 className="kx-h2" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>{demo.title}</h2>
        <p className="kx-sub" style={{ fontSize: '17px' }}>{demo.lead}</p>
      </Reveal>
      <PlayOnView minHeight={420}>
        <DemoPlayer steps={demo.steps} stepMs={7000} label={'Demo: ' + demo.title} />
      </PlayOnView>
    </section>
  );
}

/**
 * Hjälte som på stora SaaS-sajter: rubrik, text och knappar centrerade, och
 * den riktiga appen i ett fönster direkt under (spelar direkt). Används när
 * sidan har en demo; annars står den vanliga SubHero kvar.
 */
export function ProductHero({ slug, title, lead, actions }) {
  const demo = DEMO_BY_SLUG[slug];
  return (
    <section className="ot-hero">
      <Reveal className="ot-hero-text">
        <h1 className="kx-h1 ot-hero-h1">{title}</h1>
        {lead && <p className="kx-lead ot-hero-lead">{lead}</p>}
        {actions && <div className="kx-actions ot-hero-actions">{actions}</div>}
      </Reveal>
      <Reveal delay={120} className="ot-hero-demo">
        <DemoPlayer steps={demo.steps} stepMs={7000} label={'Demo: ' + demo.title} />
      </Reveal>
    </section>
  );
}

/** Filmen om sidan (VideoObject i sökresultaten), i en egen lugn sektion. */
export function VideoSection({ title, children }) {
  return (
    <section className="kx-section" style={{ background: 'var(--mkt-page-bg)' }}>
      <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 28px' }}>
        <h2 className="kx-h2" style={{ fontSize: 'clamp(24px, 3.2vw, 34px)' }}>{title}</h2>
      </Reveal>
      <Reveal className="ot-video">{children}</Reveal>
    </section>
  );
}

export const ORG_EXTRAS_CSS = [
  '.ot-hero { padding: 132px 24px 40px; background: var(--mkt-page-bg); }',
  '.ot-hero-text { max-width: 760px; margin: 0 auto; text-align: center; }',
  '.ot-hero-h1 { font-size: clamp(34px, 5.2vw, 60px); }',
  '.ot-hero-lead { margin-left: auto; margin-right: auto; max-width: 600px; font-size: 18.5px; }',
  '.ot-hero-actions { justify-content: center; }',
  '.ot-hero-demo { max-width: 1080px; margin: 44px auto 0; }',
  '.ot-video { max-width: 760px; margin: 0 auto; }',
  '@media (max-width: 640px) { .ot-hero { padding: 104px 16px 24px; } .ot-hero-text { text-align: left; } .ot-hero-actions { justify-content: flex-start; } .ot-hero-demo { margin-top: 28px; } }',
  '.ot-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px 28px; max-width: 1080px; margin: 0 auto; padding: 22px 24px 30px; }',
  '.ot-strip-item { display: inline-flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--mkt-ink); }',
  '.ot-strip-item svg { flex: none; color: var(--mkt-accent-green-fg); }',
  '@media (max-width: 640px) { .ot-strip { justify-content: flex-start; flex-direction: column; gap: 10px; padding: 8px 20px 26px; } }',
].join('\n');
