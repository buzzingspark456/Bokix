import React from 'react';
import { SERIF, INK, INK_SOFT, MUTED, CARD_BORDER } from './marketingTokens';

// ── Diagram i bloggartiklar ─────────────────────────────────────────────
// Byggda i HTML/CSS (inte bilder) så de följer sajtens ljusa/mörka tema,
// är skarpa på alla skärmar och har text som sökmotorer kan läsa. En
// artikel refererar dem med { t: 'diagram', id } i content/marketing/blog.js.

const CSS = `
  .bxd { margin: 30px 0 34px; }
  .bxd-card { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; padding: 22px; box-shadow: var(--mkt-card-shadow-sm); }
  .bxd-cap { font-size: 13.5px; color: ${MUTED}; line-height: 1.55; margin: 12px 4px 0; }

  .bxd-eq { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 14px; align-items: stretch; }
  .bxd-eq-box { border-radius: 14px; padding: 16px 16px 15px; border: 1px solid ${CARD_BORDER}; background: var(--mkt-ivory); }
  .bxd-eq-box.res { background: var(--mkt-accent-green-soft); border-color: transparent; }
  .bxd-eq-k { font-size: 11.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; }
  .bxd-eq-box.res .bxd-eq-k { color: var(--mkt-accent-green-fg); }
  .bxd-eq-v { font-family: ${SERIF}; font-size: 30px; font-weight: 700; color: ${INK}; letter-spacing: -0.01em; margin: 6px 0 4px; white-space: nowrap; }
  .bxd-eq-s { font-size: 13px; color: ${INK_SOFT}; line-height: 1.45; }
  .bxd-op { display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 300; color: ${MUTED}; }
  @media (max-width: 720px) {
    .bxd-eq { grid-template-columns: 1fr; gap: 8px; }
    .bxd-op { height: 22px; }
  }

  .bxd-year { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; position: relative; }
  .bxd-year::before { content: ''; position: absolute; left: 8%; right: 8%; top: 19px; height: 3px; border-radius: 3px; background: linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16); opacity: 0.8; }
  .bxd-ph { position: relative; text-align: left; }
  .bxd-ph-n { position: relative; width: 40px; height: 40px; border-radius: 50%; background: var(--mkt-card-bg); border: 3px solid #14b8a6; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px; color: ${INK}; box-shadow: 0 4px 10px rgba(20,40,30,0.14); }
  .bxd-ph h4 { font-size: 16.5px; font-weight: 800; color: ${INK}; margin: 14px 0 3px; }
  .bxd-ph-w { font-size: 12.5px; font-weight: 700; color: ${MUTED}; margin-bottom: 8px; }
  .bxd-ph ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
  .bxd-ph li { font-size: 13.5px; line-height: 1.5; color: ${INK_SOFT}; padding-left: 16px; position: relative; }
  .bxd-ph li::before { content: ''; position: absolute; left: 0; top: 0.55em; width: 6px; height: 6px; border-radius: 50%; background: #14b8a6; }
  @media (max-width: 860px) {
    .bxd-year { grid-template-columns: 1fr 1fr; row-gap: 26px; }
    .bxd-year::before { display: none; }
  }
  @media (max-width: 520px) {
    .bxd-year { grid-template-columns: 1fr; }
  }
`;

function BalanceEquation() {
  return (
    <div className="bxd-card">
      <div className="bxd-eq">
        <div className="bxd-eq-box">
          <div className="bxd-eq-k">Ingående balans</div>
          <div className="bxd-eq-v">25 000 kr</div>
          <div className="bxd-eq-s">Konto 1930 Företagskonto, från #IB</div>
        </div>
        <div className="bxd-op" aria-hidden="true">+</div>
        <div className="bxd-eq-box">
          <div className="bxd-eq-k">Årets verifikationer</div>
          <div className="bxd-eq-v">12 500 kr</div>
          <div className="bxd-eq-s">Verifikation A2, inbetalning av faktura 1001</div>
        </div>
        <div className="bxd-op" aria-hidden="true">=</div>
        <div className="bxd-eq-box res">
          <div className="bxd-eq-k">Utgående balans</div>
          <div className="bxd-eq-v">37 500 kr</div>
          <div className="bxd-eq-s">Konto 1930, från #UB</div>
        </div>
      </div>
    </div>
  );
}

const UF_PHASES = [
  { n: 1, h: 'Starta', when: 'Hösten', items: ['Öppna ett bankkonto för företaget', 'Bokför pengarna ni startar med'] },
  { n: 2, h: 'Sälja', when: 'Under året', items: ['Skriv fakturan när affären är klar', 'Fota kvittona direkt'] },
  { n: 3, h: 'Bokföra löpande', when: 'Varje vecka', items: ['Bokför nya händelser', 'Stäm av mot kontoutdraget'] },
  { n: 4, h: 'Avsluta', when: 'Våren', items: ['Gå igenom och rätta', 'Gör bokslutet enligt UF:s anvisningar'] },
];

function UfYear() {
  return (
    <div className="bxd-card">
      <div className="bxd-year">
        {UF_PHASES.map(p => (
          <div className="bxd-ph" key={p.n}>
            <div className="bxd-ph-n">{p.n}</div>
            <h4>{p.h}</h4>
            <div className="bxd-ph-w">{p.when}</div>
            <ul>{p.items.map(i => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const DIAGRAMS = { 'sie-balance': BalanceEquation, 'uf-year': UfYear };

export default function BlogDiagram({ id, caption }) {
  const D = DIAGRAMS[id];
  if (!D) return null;
  return (
    <figure className="bxd" style={{ margin: '30px 0 34px' }}>
      <style>{CSS}</style>
      <D />
      {caption ? <figcaption className="bxd-cap">{caption}</figcaption> : null}
    </figure>
  );
}
