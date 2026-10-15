import React from 'react';
import { Link } from 'react-router-dom';
import { SERIF } from './marketingTokens';
import { Check } from '../icons';

// ── Korten under "Mer i Bokix" på funktionssidorna (OrgTypePage.jsx) ─────
// Varje kort har en egen liten ritad bild av det sidan handlar om, så att
// korten inte ser likadana ut: en betald faktura, kartonger, en sjunkande
// värdelinje, en prislapp osv. Bara rubrik och bild, ingen förklarande text.
// Bilderna är byggda för att rymmas i ett kort på ~140 px (två kort i bredd
// på en telefon), och rutnätet styrs av sin egen bredd (container query),
// så det blir rätt även i halv skärm. Ytor och text använder temats
// variabler, så korten går att läsa i både ljust och mörkt läge.

const chip = { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: 'var(--mkt-accent-green-fg)', background: 'var(--mkt-accent-green-soft)', borderRadius: '999px', padding: '3px 9px', whiteSpace: 'nowrap' };
const mini = { background: 'var(--mkt-page-bg)', border: '1px solid var(--mkt-border-soft)', borderRadius: '9px' };
const num = { fontFamily: SERIF, fontWeight: 700, color: 'var(--mkt-ink)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', lineHeight: 1.1 };
const stack = { display: 'grid', gap: '8px', justifyItems: 'start' };

function InvoiceMini() {
  return (
    <div style={{ ...mini, ...stack, gap: 4, padding: '9px 12px 10px', transform: 'rotate(-2deg)' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--mkt-muted)' }}>Faktura 1012</span>
      <span style={{ ...num, fontSize: 19 }}>9 500 kr</span>
      <span style={{ ...chip, marginTop: 3 }}><Check size={11} /> Betald</span>
    </div>
  );
}

function StockMini() {
  const box = (c) => <i style={{ display: 'block', width: 22, height: 18, borderRadius: 4, background: c, backgroundImage: 'linear-gradient(90deg, transparent 40%, rgba(255,255,255,0.32) 40%, rgba(255,255,255,0.32) 60%, transparent 60%)' }} />;
  return (
    <div style={stack}>
      <div style={{ display: 'grid', justifyItems: 'center', gap: 3 }}>
        {box('#d3a76b')}
        <div style={{ display: 'flex', gap: 3 }}>{box('#c99a5e')}{box('#bd8f55')}</div>
      </div>
      <span style={{ ...num, fontSize: 21 }}>22 400 kr</span>
    </div>
  );
}

function DepreciationMini() {
  return (
    <div style={{ ...stack, width: '100%' }}>
      <svg viewBox="0 0 120 40" preserveAspectRatio="none" style={{ width: '100%', maxWidth: 150, height: 36 }} aria-hidden>
        <defs><linearGradient id="mc-dep" x1="0" x2="1"><stop offset="0" stopColor="#14b8a6" /><stop offset="1" stopColor="#84cc16" /></linearGradient></defs>
        <path d="M6 7 L114 33" stroke="url(#mc-dep)" strokeWidth="4" strokeLinecap="round" fill="none" vectorEffect="non-scaling-stroke" />
      </svg>
      <span style={{ ...num, fontSize: 19 }}>667 kr/mån</span>
    </div>
  );
}

function PriceTagMini() {
  return (
    <div style={{ ...mini, position: 'relative', whiteSpace: 'nowrap', padding: '9px 12px 9px 24px', borderRadius: '8px 14px 14px 8px', transform: 'rotate(-4deg)' }}>
      <i style={{ position: 'absolute', left: 10, top: '50%', width: 8, height: 8, marginTop: -4, borderRadius: '50%', background: 'var(--mkt-card-border)' }} />
      <span style={{ ...num, fontSize: 24 }}>179 kr</span><span style={{ fontSize: 12.5, color: 'var(--mkt-muted)', fontWeight: 600 }}> /mån</span>
    </div>
  );
}

function StartupMini() {
  return (
    <div style={stack}>
      <span style={{ ...mini, padding: '5px 9px', fontFamily: 'Consolas, Menlo, monospace', fontSize: 13, fontWeight: 700, color: 'var(--mkt-ink)', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>559123-4567</span>
      <span style={chip}><Check size={11} /> Hämtat</span>
    </div>
  );
}

function PayslipMini() {
  const row = { display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, color: 'var(--mkt-ink-soft)' };
  return (
    <div style={{ ...stack, width: '100%' }}>
      <div style={{ ...mini, padding: '7px 10px', width: '100%', maxWidth: 160, display: 'grid', gap: 3 }}>
        <div style={row}><span>Lön</span><b style={{ color: 'var(--mkt-ink)' }}>32 000</b></div>
        <div style={row}><span>Skatt</span><b style={{ color: 'var(--mkt-ink)' }}>−7 900</b></div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', background: '#7c3aed', borderRadius: 6, padding: '4px 8px', letterSpacing: '0.03em' }}>AGI-fil</span>
    </div>
  );
}

function LogosMini() {
  const tile = { width: 34, height: 34, borderRadius: 9, background: '#fff', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 12px -8px rgba(0,0,0,0.4)' };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 150 }}>
      <span style={{ ...tile, width: 'auto', padding: '0 7px' }}><img src="/stripe-wordmark.png" alt="" style={{ height: 13, width: 'auto' }} /></span>
      <span style={tile}><img src="/zettle-blue.png" alt="" style={{ width: 24, height: 'auto' }} /></span>
      <span style={tile}><img src="/gmail-icon.png" alt="" style={{ width: 20, height: 'auto' }} /></span>
      <span style={{ ...tile, fontSize: 10, fontWeight: 800, color: '#1d2b23' }}>SIE4</span>
    </div>
  );
}

const MINIS = {
  '/faktureringsprogram': InvoiceMini,
  '/bokforingsprogram-med-lager': StockMini,
  '/anlaggningsregister': DepreciationMini,
  '/billigt-bokforingsprogram': PriceTagMini,
  '/bokforingsprogram-nystartat-foretag': StartupMini,
  '/lon': PayslipMini,
  '/integrationer': LogosMini,
};

export default function MoreCards({ pages }) {
  return (
    <div className="kx-more-wrap">
      <div className="kx-more-grid">
        {pages.filter(o => MINIS[o.path]).map(o => {
          const Mini = MINIS[o.path];
          return (
            <Link key={o.path} to={o.path} className="kx-more-card">
              <span className="kx-more-title">{o.linkLabel || o.short}</span>
              <span className="kx-more-art"><Mini /></span>
            </Link>
          );
        })}
      </div>
      <style>{`
        .kx-more-wrap { container-type: inline-size; }
        .kx-more-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        @container (min-width: 560px) { .kx-more-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; } }
        .kx-more-card { display: flex; flex-direction: column; min-width: 0; text-decoration: none; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 14px; padding: 16px 14px 14px; overflow: hidden; transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .kx-more-card:hover { transform: translateY(-2px); box-shadow: var(--mkt-card-shadow); }
        .kx-more-title { font-size: 14px; font-weight: 700; color: var(--mkt-ink); line-height: 1.3; }
        .kx-more-art { flex: 1; min-height: 100px; display: flex; align-items: center; padding-top: 12px; min-width: 0; }
        @container (min-width: 560px) { .kx-more-card { padding: 18px 18px 16px; } }
        @media (prefers-reduced-motion: reduce) { .kx-more-card { transition: none; } .kx-more-card:hover { transform: none; } }
      `}</style>
    </div>
  );
}
