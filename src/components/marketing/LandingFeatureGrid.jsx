import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from './MarketingLayout';

// ── Startsidans funktionsrutnät ─────────────────────────────────────────
// Det första man ser efter hjälten. Ersätter de pastellfärgade korten och
// sexkortsrutnätet (2026-10-17, "ser lite AI ut"): ETT rutnät, vita kort med
// tunn kant, och i varje stor ruta ett utsnitt som ser ut som appen gör i dag
// (konton, statusetiketter, momsrutor, lönebesked) i stället för gråa streck.
// Färg bara där appen själv har färg: grönt för klart, gult för ditt val.
// Siffrorna hänger ihop: 32 000 kr i lön ger 7 040 kr i skatt (tabell 33),
// momsrutorna går jämnt ut (59 125 − 9 199 = 49 926).

const CSS = `
  .fg { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 16px; max-width: 1180px; margin: 0 auto; text-align: left; }
  .fg-tile { grid-column: span 6; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; transition: transform 0.25s ease, box-shadow 0.25s ease; }
  .fg-tile:hover { transform: translateY(-2px); box-shadow: 0 22px 44px -30px rgba(15, 23, 42, 0.35); }
  .fg-w7 { grid-column: span 7; } .fg-w5 { grid-column: span 5; } .fg-w3 { grid-column: span 3; }
  .fg-text { padding: 26px 28px 0; }
  .fg-title { font-size: 20px; font-weight: 700; color: var(--mkt-ink); letter-spacing: -0.01em; margin: 0 0 6px; }
  .fg-desc { font-size: 15px; color: var(--mkt-muted); line-height: 1.55; margin: 0; max-width: 46ch; }
  .fg-art { margin-top: auto; padding: 24px 28px 0; }
  .fg-small .fg-text { padding: 22px 22px 0; }
  .fg-small .fg-title { font-size: 16.5px; }
  .fg-small .fg-desc { font-size: 14px; }
  .fg-small .fg-art { padding: 18px 22px 22px; }

  /* Utsnitten: samma uttryck som appen, vita rader på en ljus platta som
     sticker upp ur kortets underkant. */
  .fg-plate { background: var(--mkt-ivory); border: 1px solid var(--mkt-border-soft); border-bottom: none; border-radius: 14px 14px 0 0; padding: 14px 14px 0; }
  .fg-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
  .fg-row:last-child { margin-bottom: 14px; }
  .fg-row-main { min-width: 0; }
  .fg-row-title { font-size: 13.5px; font-weight: 700; color: var(--mkt-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fg-row-sub { font-size: 12px; color: var(--mkt-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fg-num { font-variant-numeric: tabular-nums; font-weight: 700; color: var(--mkt-ink); font-size: 13.5px; white-space: nowrap; }
  .fg-pill { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
  .fg-ok { background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg); }
  .fg-wait { background: #fbefd5; color: #8a5300; }
  html[data-theme="dark"] #lp-root .fg-wait { background: rgba(245, 158, 11, 0.18); color: #f0b429; }
  .fg-right { display: flex; align-items: center; gap: 10px; }

  .fg-paper { background: #fff; color: #1c2420; border-radius: 12px 12px 0 0; box-shadow: 0 -1px 0 rgba(0,0,0,0.04), 0 18px 40px -22px rgba(15, 23, 42, 0.45); padding: 16px 18px 6px; max-width: 360px; margin: 0 auto; font-size: 12px; }
  .fg-paper-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .fg-logo { width: 26px; height: 26px; border-radius: 7px; background: #0b6329; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 13px; }
  .fg-paper-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; }
  .fg-paper-total { display: flex; justify-content: space-between; align-items: center; padding: 10px 0 12px; font-weight: 800; font-size: 14px; }
  .fg-paybtn { display: inline-flex; align-items: center; justify-content: center; width: 100%; padding: 8px; border-radius: 8px; background: #635bff; color: #fff; font-weight: 700; font-size: 12px; margin-bottom: 12px; }

  .fg-box { display: grid; grid-template-columns: 30px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 9px 12px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-radius: 10px; margin-bottom: 6px; font-size: 13px; color: var(--mkt-ink); }
  .fg-box b { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 11.5px; color: var(--mkt-muted); font-weight: 700; }
  .fg-box.sum { border-color: var(--mkt-accent-green-fg); }
  .fg-file { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: var(--mkt-ink); background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-radius: 9px; padding: 7px 11px; margin: 4px 0 14px; }
  .fg-file i { font-style: normal; font-size: 10px; font-weight: 800; color: var(--mkt-accent-green-fg); border: 1px solid currentColor; border-radius: 4px; padding: 1px 4px; }

  .fg-slip { display: grid; gap: 10px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); border-radius: 12px; padding: 14px 16px; margin-bottom: 14px; }
  .fg-slip-line { display: flex; justify-content: space-between; font-size: 13px; color: var(--mkt-ink-soft); }
  .fg-slip-line.total { border-top: 1px solid var(--mkt-border-soft); padding-top: 10px; font-weight: 800; color: var(--mkt-ink); font-size: 14.5px; }
  .fg-tags { display: flex; gap: 6px; flex-wrap: wrap; }

  .fg-mini { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; color: var(--mkt-ink); background: var(--mkt-ivory); border: 1px solid var(--mkt-border-soft); border-radius: 10px; padding: 9px 11px; }
  .fg-bar { height: 6px; border-radius: 6px; background: var(--mkt-border-soft); overflow: hidden; margin-top: 7px; }
  .fg-bar span { display: block; height: 100%; border-radius: 6px; background: var(--mkt-accent-green-fg); }
  .fg-bars { display: flex; align-items: flex-end; gap: 5px; height: 38px; }
  .fg-bars span { flex: 1; border-radius: 4px 4px 0 0; background: var(--mkt-accent-green-fg); opacity: 0.85; }

  @media (max-width: 900px) {
    .fg-w7, .fg-w5, .fg-tile { grid-column: span 12; }
    .fg-w3 { grid-column: span 6; }
  }
  @media (max-width: 560px) {
    .fg { gap: 12px; }
    .fg-text { padding: 22px 20px 0; }
    .fg-art { padding: 20px 16px 0; }
    .fg-title { font-size: 18.5px; }
    .fg-desc { font-size: 14.5px; }
    .fg-w3 { grid-column: span 6; }
    .fg-small .fg-text { padding: 18px 16px 0; }
    .fg-small .fg-title { font-size: 15.5px; }
    .fg-small .fg-desc { font-size: 13px; }
    .fg-small .fg-art { padding: 14px 14px 16px; }
    .fg-mini { flex-direction: column; align-items: flex-start; gap: 6px; }
    .fg-row { grid-template-columns: minmax(0, 1fr); gap: 6px; }
    .fg-row-title, .fg-row-sub { white-space: normal; }
    .fg-right { justify-content: space-between; }
  }
`;

function Tile({ size, title, desc, children, delay }) {
  const small = size === 'w3';
  return (
    <Reveal delay={delay} className={`fg-tile fg-${size}${small ? ' fg-small' : ''}`}>
      <div className="fg-text">
        <h3 className="fg-title">{title}</h3>
        <p className="fg-desc">{desc}</p>
      </div>
      <div className="fg-art" aria-hidden="true">{children}</div>
    </Reveal>
  );
}

const Row = ({ title, sub, amount, pill, wait }) => (
  <div className="fg-row">
    <div className="fg-row-main">
      <div className="fg-row-title">{title}</div>
      <div className="fg-row-sub">{sub}</div>
    </div>
    <div className="fg-right">
      <span className="fg-num">{amount}</span>
      <span className={`fg-pill ${wait ? 'fg-wait' : 'fg-ok'}`}>{pill}</span>
    </div>
  </div>
);

/** `items` från content/marketing/landing.js (features.items), i ordning:
 * bokföring, fakturor, moms, lön, offerter, projekt, kunder, rapporter. */
export default function LandingFeatureGrid({ items }) {
  const [bok, fak, moms, lon, off, proj, kund, rap] = items;
  return (
    <>
      <style>{CSS}</style>
      <div className="fg">
        <Tile size="w7" title={bok.title} desc={bok.desc} delay={0}>
          <div className="fg-plate">
            <Row title="Kvitto · Kontorsbutiken" sub="5410 Förbrukningsinventarier, moms 2640" amount="712,00" pill="Bokförd" />
            <Row title="Faktura 1042 · Nordvik Bygg AB" sub="1510 Kundfordringar, 3001 Försäljning" amount="18 500,00" pill="Bokförd" />
            <Row title="Kvitto · Ny leverantör" sub="Inget tidigare konto att gå efter" amount="249,00" pill="Granska" wait />
          </div>
        </Tile>

        <Tile size="w5" title={fak.title} desc={fak.desc} delay={80}>
          <div className="fg-paper">
            <div className="fg-paper-head">
              <div style={{ display: 'flex', gap: '9px', alignItems: 'center' }}>
                <span className="fg-logo">D</span>
                <div><div style={{ fontWeight: 800 }}>Ditt Företag AB</div><div style={{ color: '#6b7280' }}>Faktura 1042</div></div>
              </div>
              <span className="fg-pill fg-ok" style={{ background: '#e3f4e4', color: '#1d6b2c' }}>Betald</span>
            </div>
            <div className="fg-paper-row"><span>Konsulttimmar, 20 h</span><span>14 800,00</span></div>
            <div className="fg-paper-row"><span>Moms 25 %</span><span>3 700,00</span></div>
            <div className="fg-paper-total"><span>Att betala</span><span>18 500,00 kr</span></div>
            <div className="fg-paybtn">Betala nu</div>
          </div>
        </Tile>

        <Tile size="w5" title={moms.title} desc={moms.desc} delay={0}>
          <div className="fg-plate">
            <div className="fg-box"><b>05</b><span>Försäljning</span><span className="fg-num">236 500</span></div>
            <div className="fg-box"><b>10</b><span>Utgående moms</span><span className="fg-num">59 125</span></div>
            <div className="fg-box"><b>48</b><span>Ingående moms</span><span className="fg-num">9 199</span></div>
            <div className="fg-box sum"><b>49</b><span>Att betala</span><span className="fg-num">49 926</span></div>
            <div className="fg-file"><i>XML</i> moms-2026-kv3.xml</div>
          </div>
        </Tile>

        <Tile size="w7" title={lon.title} desc={lon.desc} delay={80}>
          <div className="fg-plate">
            <div className="fg-slip">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--mkt-ink)' }}>Lönebesked · Johanna Exempel</span>
                <span className="fg-pill fg-ok">Klar</span>
              </div>
              <div className="fg-slip-line"><span>Bruttolön</span><span className="fg-num">32 000,00</span></div>
              <div className="fg-slip-line"><span>Skatteavdrag, tabell 33</span><span className="fg-num">−7 040,00</span></div>
              <div className="fg-slip-line total"><span>Utbetalas</span><span className="fg-num">24 960,00</span></div>
              <div className="fg-tags">
                <span className="fg-file" style={{ margin: 0 }}><i>PDF</i> Lönebesked</span>
                <span className="fg-file" style={{ margin: 0 }}><i>XML</i> AGI till Skatteverket</span>
                <span className="fg-file" style={{ margin: 0 }}><i>FIL</i> Betalfil till banken</span>
              </div>
            </div>
          </div>
        </Tile>

        <Tile size="w3" title={off.title} desc={off.desc} delay={0}>
          <div className="fg-mini"><span>Offert O-1042</span><span className="fg-pill fg-ok">Accepterad</span></div>
        </Tile>
        <Tile size="w3" title={proj.title} desc={proj.desc} delay={60}>
          <div className="fg-mini" style={{ display: 'block' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Villa Ekhagen</span><span className="fg-num" style={{ fontSize: '12.5px' }}>+42 800</span></div>
            <div className="fg-bar"><span style={{ width: '68%' }} /></div>
          </div>
        </Tile>
        <Tile size="w3" title={kund.title} desc={kund.desc} delay={120}>
          <div className="fg-mini"><span style={{ fontFamily: 'ui-monospace, monospace' }}>556677-8899</span><span style={{ fontWeight: 700 }}>Nordvik Bygg AB</span></div>
        </Tile>
        <Tile size="w3" title={rap.title} desc={rap.desc} delay={180}>
          <div className="fg-mini" style={{ display: 'block' }}>
            <div className="fg-bars">{[42, 55, 48, 66, 61, 82].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
          </div>
        </Tile>
      </div>
    </>
  );
}

// ── Bolagsformerna: fem kort i samma stil som rutnätet ovan ─────────────
// Ersätter den rullande raden med färgade prickar. Varje kort säger vad
// Bokix tar fram just för den bolagsformen; det som inte görs (INK3 för
// ideella föreningar) står inte med. Kort med egen sida är länkar.
const ORG_CSS = `
  .og { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; max-width: 1180px; margin: 0 auto; text-align: left; }
  .og-card { display: flex; flex-direction: column; gap: 10px; padding: 20px 20px 18px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 18px; text-decoration: none; color: inherit; transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease; }
  a.og-card:hover { transform: translateY(-2px); box-shadow: 0 22px 44px -30px rgba(15, 23, 42, 0.35); border-color: var(--mkt-accent-green-fg); }
  .og-name { font-size: 16.5px; font-weight: 700; color: var(--mkt-ink); line-height: 1.3; }
  .og-docs { display: flex; flex-wrap: wrap; gap: 6px; }
  .og-doc { font-size: 12px; font-weight: 700; color: var(--mkt-ink-soft); background: var(--mkt-ivory); border: 1px solid var(--mkt-border-soft); border-radius: 7px; padding: 3px 8px; white-space: nowrap; }
  .og-more { margin-top: auto; padding-top: 6px; font-size: 13px; font-weight: 700; color: var(--mkt-accent-green-fg); }
  @media (max-width: 1000px) { .og { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 560px) {
    .og { grid-template-columns: 1fr; gap: 10px; }
    .og-card { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; padding: 16px 18px; }
    .og-name { width: 100%; }
    .og-more { margin: 0; padding: 0; }
  }
`;

export const ORG_TYPE_CARDS = [
  { name: 'Enskild firma', docs: ['NE-bilaga', 'Egenavgifter'] },
  { name: 'Aktiebolag (AB)', docs: ['INK2', 'Årsredovisning K2'] },
  { name: 'Handelsbolag / KB', docs: ['INK4', 'Bilaga per delägare'] },
  { name: 'Ekonomisk förening', docs: ['INK2', 'Årsredovisning'] },
  { name: 'Ideell förening / stiftelse', docs: ['Moms', 'Årsbokslut'] },
];

export function OrgTypeCards({ links = {}, moreLabel = 'Läs mer' }) {
  return (
    <>
      <style>{ORG_CSS}</style>
      <div className="og">
        {ORG_TYPE_CARDS.map((card, i) => {
          const body = (
            <>
              <span className="og-name">{card.name}</span>
              <span className="og-docs">{card.docs.map(doc => <span key={doc} className="og-doc">{doc}</span>)}</span>
              {links[card.name] && <span className="og-more">{moreLabel} →</span>}
            </>
          );
          return (
            <Reveal key={card.name} delay={i * 60} style={{ display: 'flex' }}>
              {links[card.name]
                ? <Link to={links[card.name]} className="og-card" style={{ flex: 1 }}>{body}</Link>
                : <div className="og-card" style={{ flex: 1 }}>{body}</div>}
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
