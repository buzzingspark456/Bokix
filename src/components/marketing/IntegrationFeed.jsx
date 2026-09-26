import React, { useEffect, useState } from 'react';
import { INK, MUTED, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { StripeIconLogo, ZettleLogo, BolagsverketLogo, SkatteverketLogo } from '../shared/BrandLogos';

// ── Hjälten på /integrationer: en händelselogg där det som kommer in från
// kopplingarna glider in överst och stämplas med vad Bokix gjorde av det.
// Startsidan har redan kopplingsgrafen (fyra logotyper runt ett nav); den
// här sidan visar i stället VAD som händer, en rad i taget.
//
// Samma ärlighetskrav som IntegrationsPage: Skatteverket-raden är en fil
// Bokix skapar och du själv laddar upp, inget skickas i ditt namn.
const STEP_MS = 2400;
const VISIBLE = 3;

const EVENTS = [
  { key: 'stripe', Logo: StripeIconLogo, h: 22, title: 'Kortbetalning, faktura 2026-021', amount: '+4 900,00', result: 'Matchad mot fakturan' },
  { key: 'zettle', Logo: ZettleLogo, h: 16, title: 'Kassaförsäljning, lördag', amount: '+3 240,00', result: 'Bokförd' },
  { key: 'bolagsverket', Logo: BolagsverketLogo, h: 26, title: 'Företagsuppgifter hämtade', amount: 'Aktiebolag', result: 'Regelverk valt' },
  { key: 'skatteverket', Logo: SkatteverketLogo, h: 24, title: 'Momsdeklaration, kvartal 1', amount: 'eSKD-fil', result: 'Redo att ladda upp' },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function IntegrationFeed() {
  // `head` är den senaste händelsen; listan visar den och de två före.
  const [head, setHead] = useState(VISIBLE - 1);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const t = setInterval(() => setHead(h => h + 1), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const rows = Array.from({ length: VISIBLE }, (_, i) => head - i).map(n => ({
    n,
    ev: EVENTS[((n % EVENTS.length) + EVENTS.length) % EVENTS.length],
  }));

  return (
    <div className="bx-if" aria-label="Exempel på händelser från Bokix kopplingar">
      <style>{`
        .bx-if { width: 100%; max-width: 520px; margin: 0 auto; background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; box-shadow: ${CARD_SHADOW}; overflow: hidden; }
        .bx-if-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid var(--mkt-border-soft); font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; }
        .bx-if-live { display: inline-flex; align-items: center; gap: 7px; text-transform: none; letter-spacing: 0; font-weight: 600; }
        .bx-if-live::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: ${ACCENT.green.fg}; animation: bxIfPulse 2.4s ease-in-out infinite; }
        @keyframes bxIfPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .bx-if-row { display: grid; grid-template-columns: 44px 1fr auto; gap: 14px; align-items: center; padding: 15px 20px; border-bottom: 1px solid var(--mkt-border-soft); }
        .bx-if-row:last-child { border-bottom: none; }
        .bx-if-row.is-new { animation: bxIfIn 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .bx-if-row.is-new .bx-if-stamp { animation: bxIfStamp 0.5s 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
        @keyframes bxIfIn { from { opacity: 0; transform: translateY(-14px); } to { opacity: 1; transform: none; } }
        @keyframes bxIfStamp { from { opacity: 0; transform: scale(0.85); } to { opacity: 1; transform: none; } }
        .bx-if-logo { width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--mkt-border-soft); display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .bx-if-stamp { display: inline-block; margin-top: 4px; font-size: 11.5px; font-weight: 700; color: ${ACCENT.green.fg}; background: ${ACCENT.green.soft}; padding: 2px 8px; border-radius: 6px; }
        .bx-if-title { display: block; font-size: 14px; font-weight: 600; color: ${INK}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media (max-width: 480px) { .bx-if-title { white-space: normal; font-size: 13.5px; line-height: 1.35; } .bx-if-row { padding: 14px 16px; gap: 12px; } }
        @media (prefers-reduced-motion: reduce) { .bx-if-row.is-new, .bx-if-row.is-new .bx-if-stamp, .bx-if-live::before { animation: none; } }
      `}</style>
      <div className="bx-if-head">
        <span>Händelser</span>
        <span className="bx-if-live">Idag</span>
      </div>
      {rows.map(({ n, ev }, i) => (
        <div key={n} className={`bx-if-row ${i === 0 ? 'is-new' : ''}`} style={{ opacity: i === 2 ? 0.55 : 1 }}>
          <span className="bx-if-logo"><ev.Logo height={ev.h} /></span>
          <span style={{ minWidth: 0 }}>
            <span className="bx-if-title">{ev.title}</span>
            <span className="bx-if-stamp">{ev.result}</span>
          </span>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{ev.amount}</span>
        </div>
      ))}
    </div>
  );
}
