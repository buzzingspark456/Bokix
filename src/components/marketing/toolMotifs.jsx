import React from 'react';
import { BRAND } from '../../utils/brandColors';

// ── Motiv för verktygskorten ────────────────────────────────────────────
// Åtta små, ständigt gående bilder — en per kort, både i rutnätet längst
// ner på /funktioner och i "Det här får du med Bokix" på Startsidan.
//
// TRE ÄR OMRITADE efter en andra genomgång med kunden:
//   projekt — var tre abstrakta staplar ("vad är det här? det ska se ut
//     som ett projekt"); är nu två projekt med namn, färdiggrad och
//     resultat, alltså det man faktiskt ser i projektlistan.
//   konto — var sex rutor som fylldes som en engångskod ("det betyder
//     ingenting"); är nu tre användare där den tredje bjuds in, plus en
//     tvåfaktorsmarkering. Kortet handlar om vilka som kommer in.
//   kvitton — kunden ville se något RIKTIGT: ett kvitto med ett belopp
//     och en PDF bakom. Så ser det ut nu, med samma 712,00 kr som kedjan
//     högst upp på /funktioner använder.
//
// TEMA: allt ritas med marknadssajtens egna tokens (--mkt-*), aldrig fasta
// hex utom varumärkets grönt och de två accentfärgerna. Korten ska se lika
// genomarbetade ut i ljust som i mörkt läge — uttryckligt kundkrav.
//
// Rent CSS, inga timers och ingen JS-state: åtta små oändliga animationer
// kostar nästan ingenting, medan åtta IntersectionObservers med var sitt
// intervall hade varit åtta gånger mer maskineri än bilderna är värda.
// Allt står still vid prefers-reduced-motion, i sitt slutläge.

export function ToolMotifStyles() {
  return (
    <style>{`
      /* Rutnät för korten som bär motiven. AUTO-FIT DUGER INTE HÄR: på en
         bred skärm bröt minmax() sex kort till fem plus ett ensamt, och åtta
         kort till fem plus tre. Antalet kolumner är därför låst per
         brytpunkt, så raderna alltid går jämnt ut (3+3 respektive 4+4). */
      .bx-tool-grid { display: grid; gap: 20px; }
      .bx-tool-grid-3 { grid-template-columns: repeat(3, 1fr); }
      .bx-tool-grid-4 { grid-template-columns: repeat(4, 1fr); }
      @media (max-width: 1140px) { .bx-tool-grid-4 { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 960px) { .bx-tool-grid-3 { grid-template-columns: repeat(2, 1fr); } }
      @media (max-width: 620px) { .bx-tool-grid-3, .bx-tool-grid-4 { grid-template-columns: 1fr; } }

      .bx-tm {
        position: relative; height: clamp(104px, 9vw, 132px); border-radius: 12px; overflow: hidden;
        background: var(--mkt-ivory); border: 1px solid var(--mkt-card-border);
        background-image: repeating-linear-gradient(to bottom, transparent 0 21px, var(--mkt-card-border) 21px 22px);
        background-position: center;
        display: flex; align-items: center; justify-content: center; gap: 7px;
        margin-bottom: 16px;
        /* Djup åt kortet som vänder sig (.bx-tm-flip) — utan perspektiv blir
           en rotateY bara en hoptryckning på bredden, inte en vändning. */
        perspective: 700px;
      }
      .bx-tm-chip {
        padding: 7px 14px; border-radius: 9px; font-size: 12.5px; font-weight: 800;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); color: var(--mkt-muted);
      }

      /* 1. Bank — två rader glider ihop och låser i varandra. */
      .bx-tm-match { display: flex; align-items: center; gap: 9px; }
      .bx-tm-match span { display: block; width: 68px; height: 15px; border-radius: 5px; }
      .bx-tm-match span:first-child { background: ${BRAND.green}; animation: bx-tm-l 3.2s ease-in-out infinite; }
      .bx-tm-match span:last-child { background: #0ea5e9; animation: bx-tm-r 3.2s ease-in-out infinite; }
      .bx-tm-match i { width: 9px; height: 9px; border-radius: 50%; background: var(--mkt-card-border); animation: bx-tm-lock 3.2s ease-in-out infinite; }
      @keyframes bx-tm-l { 0%, 100% { transform: translateX(-22px); } 45%, 70% { transform: none; } }
      @keyframes bx-tm-r { 0%, 100% { transform: translateX(22px); } 45%, 70% { transform: none; } }
      @keyframes bx-tm-lock { 0%, 40% { background: var(--mkt-card-border); transform: scale(1); } 55%, 70% { background: ${BRAND.green}; transform: scale(1.5); } 100% { background: var(--mkt-card-border); transform: scale(1); } }

      /* 2. Utgifter och kvitton — ett riktigt kvitto med ett riktigt belopp,
         och PDF:en bakom. Kunden ville se det man faktiskt laddar upp, inte
         en abstrakt vit ruta. */
      .bx-tm-doc { position: relative; width: 152px; height: 88px; }
      .bx-tm-doc-pdf {
        position: absolute; right: 0; top: 9px; width: 62px; height: 70px; border-radius: 8px;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
        display: flex; align-items: flex-end; justify-content: center; padding-bottom: 8px;
        font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; color: var(--mkt-muted);
        transform: rotate(5deg);
      }
      /* Vikt hörn, så rutan läser som ett dokument. */
      .bx-tm-doc-pdf::after {
        content: ''; position: absolute; right: 0; top: 0; width: 15px; height: 15px;
        background: var(--mkt-ivory);
        border-left: 1px solid var(--mkt-card-border); border-bottom: 1px solid var(--mkt-card-border);
        border-radius: 0 8px 0 3px;
      }
      .bx-tm-doc-receipt {
        position: absolute; left: 0; top: 2px; width: 98px; padding: 9px 10px 10px; border-radius: 8px; z-index: 1;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-accent-green-fg);
        box-shadow: 0 10px 22px -14px rgba(0,0,0,0.55);
        display: flex; flex-direction: column; gap: 4px;
        animation: bx-tm-lift 3.6s ease-in-out infinite;
      }
      .bx-tm-doc-label { font-size: 8.5px; font-weight: 800; letter-spacing: 0.12em; color: var(--mkt-muted); }
      .bx-tm-doc-sum { font-size: 15px; font-weight: 800; letter-spacing: -0.02em; color: var(--mkt-ink); font-variant-numeric: tabular-nums; }
      .bx-tm-doc-line { height: 4px; border-radius: 2px; background: var(--mkt-card-border); }
      @keyframes bx-tm-lift { 0%, 100% { transform: rotate(-4deg) translateY(2px); } 50% { transform: rotate(-1deg) translateY(-3px); } }

      /* 3. Offerter — kortet vänder från offert till faktura. */
      .bx-tm-flip { width: 96px; height: 62px; position: relative; transform-style: preserve-3d; animation: bx-tm-turn 4s ease-in-out infinite; }
      .bx-tm-flip span {
        position: absolute; inset: 0; border-radius: 7px; backface-visibility: hidden;
        display: flex; align-items: center; justify-content: center;
        font-size: 11.5px; font-weight: 800; letter-spacing: 0.06em;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); color: var(--mkt-muted);
        box-shadow: 0 6px 14px -10px rgba(0,0,0,0.5);
      }
      .bx-tm-flip span:last-child { transform: rotateY(180deg); border-color: var(--mkt-accent-green-fg); color: var(--mkt-accent-green-fg); }
      @keyframes bx-tm-turn { 0%, 40% { transform: rotateY(0); } 60%, 100% { transform: rotateY(180deg); } }

      /* 4. Projekt — två projekt med namn, färdiggrad och resultat. Här
         stod tidigare tre staplar utan sammanhang; ett projekt känns igen
         på att det heter något och har ett utfall. */
      .bx-tm-proj { width: 82%; max-width: 210px; display: flex; flex-direction: column; gap: 11px; }
      .bx-tm-proj-row { display: flex; flex-direction: column; gap: 5px; }
      .bx-tm-proj-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .bx-tm-proj-name { font-size: 10.5px; font-weight: 700; color: var(--mkt-ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .bx-tm-proj-sum { font-size: 10.5px; font-weight: 800; font-variant-numeric: tabular-nums; flex-shrink: 0; }
      .bx-tm-proj-track { height: 7px; border-radius: 4px; background: var(--mkt-card-border); overflow: hidden; }
      .bx-tm-proj-fill { display: block; height: 100%; border-radius: 4px; transform-origin: left; animation: bx-tm-fillbar 3.6s cubic-bezier(0.22,1,0.36,1) infinite; }
      .bx-tm-proj-row:last-child .bx-tm-proj-fill { animation-delay: 0.4s; }
      @keyframes bx-tm-fillbar { 0% { transform: scaleX(0.05); } 35%, 80% { transform: scaleX(1); } 100% { transform: scaleX(0.05); } }

      /* 5. Kunder — numret slås upp, namnet kommer tillbaka. */
      .bx-tm-lookup { display: flex; flex-direction: column; align-items: center; gap: 9px; }
      .bx-tm-lookup b {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 12.5px; font-weight: 700; color: var(--mkt-muted);
        padding: 7px 14px; border-radius: 8px;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
      }
      .bx-tm-lookup span { font-size: 14px; font-weight: 800; color: var(--mkt-accent-green-fg); animation: bx-tm-found 3.4s ease-in-out infinite; }
      @keyframes bx-tm-found { 0%, 12% { opacity: 0; transform: translateY(5px); } 26%, 100% { opacity: 1; transform: none; } }

      /* 6. Rapporter — fyra staplar som ritar om sig. */
      .bx-tm-chart { display: flex; align-items: flex-end; gap: 8px; height: 68px; }
      .bx-tm-chart span { width: 15px; border-radius: 4px; background: ${BRAND.green}; transform-origin: bottom; }
      .bx-tm-chart span:nth-child(1) { height: 33px; animation: bx-tm-wave 2.8s ease-in-out infinite; }
      .bx-tm-chart span:nth-child(2) { height: 59px; animation: bx-tm-wave 2.8s ease-in-out 0.2s infinite; }
      .bx-tm-chart span:nth-child(3) { height: 45px; animation: bx-tm-wave 2.8s ease-in-out 0.4s infinite; }
      .bx-tm-chart span:nth-child(4) { height: 68px; animation: bx-tm-wave 2.8s ease-in-out 0.6s infinite; }
      @keyframes bx-tm-wave { 0%, 100% { transform: scaleY(0.45); } 50% { transform: scaleY(1); } }

      /* 7. Konto och behörighet — tre användare, där den tredje bjuds in,
         och en tvåfaktorsmarkering. Kortet handlar om VILKA som kommer in;
         den gamla engångskoden sa ingenting om det. */
      .bx-tm-users { display: flex; flex-direction: column; align-items: center; gap: 10px; }
      .bx-tm-users-row { display: flex; align-items: center; }
      .bx-tm-user {
        width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 11px; font-weight: 800; letter-spacing: 0.02em;
        border: 2px solid var(--mkt-card-bg);
        background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg);
      }
      .bx-tm-user + .bx-tm-user { margin-left: -9px; }
      .bx-tm-user-2 { background: var(--mkt-accent-blue-soft); color: var(--mkt-accent-blue-fg); }
      /* Den inbjudna: tonar in, blir kvar en stund, försvinner igen. */
      .bx-tm-user-3 {
        background: var(--mkt-card-bg); color: var(--mkt-muted);
        border-style: dashed; border-color: var(--mkt-card-border);
        animation: bx-tm-invite 4s ease-in-out infinite;
      }
      @keyframes bx-tm-invite {
        0%, 15% { opacity: 0; transform: scale(0.6); }
        30%, 75% { opacity: 1; transform: none; }
        90%, 100% { opacity: 0; transform: scale(0.6); }
      }
      .bx-tm-2fa {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 5px 11px; border-radius: 999px;
        font-size: 10px; font-weight: 800; letter-spacing: 0.04em;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); color: var(--mkt-muted);
      }
      .bx-tm-2fa i { width: 7px; height: 7px; border-radius: 50%; background: ${BRAND.green}; animation: bx-tm-blink 2.4s ease-in-out infinite; }
      @keyframes bx-tm-blink { 0%, 100% { opacity: 0.35; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }

      /* 8. Filformat — formaten avlöser varandra. */
      .bx-tm-formats { position: relative; width: 130px; height: 34px; }
      .bx-tm-formats span { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; opacity: 0; }
      .bx-tm-formats span:nth-child(1) { animation: bx-tm-cycle 8s linear infinite; }
      .bx-tm-formats span:nth-child(2) { animation: bx-tm-cycle 8s linear 2s infinite; }
      .bx-tm-formats span:nth-child(3) { animation: bx-tm-cycle 8s linear 4s infinite; }
      .bx-tm-formats span:nth-child(4) { animation: bx-tm-cycle 8s linear 6s infinite; }
      @keyframes bx-tm-cycle { 0%, 1% { opacity: 0; transform: translateY(5px); } 4%, 22% { opacity: 1; transform: none; } 25%, 100% { opacity: 0; transform: translateY(-5px); } }

      @media (prefers-reduced-motion: reduce) {
        .bx-tm * { animation: none !important; }
        .bx-tm-flip { transform: none; }
        .bx-tm-lookup span { opacity: 1; }
        .bx-tm-formats span:nth-child(1) { opacity: 1; }
        .bx-tm-proj-fill { transform: scaleX(1); }
        .bx-tm-user-3 { opacity: 1; transform: none; }
      }
    `}</style>
  );
}

/** Ett motiv per korttyp. `kind` matchar nyckeln i korten (FeaturesPage
 *  och LandingPage). */
const G_TOKEN = 'var(--mkt-accent-green-fg)';

export default function ToolMotif({ kind }) {
  switch (kind) {
    case 'bank':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-match"><span /><i /><span /></span>
        </div>
      );
    case 'kvitton':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-doc">
            <span className="bx-tm-doc-pdf">PDF</span>
            <span className="bx-tm-doc-receipt">
              <span className="bx-tm-doc-label">KVITTO</span>
              <span className="bx-tm-doc-sum">712,00 kr</span>
              <span className="bx-tm-doc-line" style={{ width: '78%' }} />
              <span className="bx-tm-doc-line" style={{ width: '52%' }} />
            </span>
          </span>
        </div>
      );
    case 'offerter':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-flip"><span>OFFERT</span><span>FAKTURA</span></span>
        </div>
      );
    case 'projekt':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-proj">
            <span className="bx-tm-proj-row">
              <span className="bx-tm-proj-top">
                <span className="bx-tm-proj-name">Villa Ekhagen</span>
                <span className="bx-tm-proj-sum" style={{ color: G_TOKEN }}>+42 800</span>
              </span>
              <span className="bx-tm-proj-track">
                <span className="bx-tm-proj-fill" style={{ width: '72%', background: BRAND.green }} />
              </span>
            </span>
            <span className="bx-tm-proj-row">
              <span className="bx-tm-proj-top">
                <span className="bx-tm-proj-name">Ombyggnad Torg 4</span>
                <span className="bx-tm-proj-sum" style={{ color: 'var(--mkt-muted)' }}>+6 150</span>
              </span>
              <span className="bx-tm-proj-track">
                <span className="bx-tm-proj-fill" style={{ width: '38%', background: '#0ea5e9' }} />
              </span>
            </span>
          </span>
        </div>
      );
    case 'kunder':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-lookup"><b>556677-8899</b><span>Nordvik Bygg AB</span></span>
        </div>
      );
    case 'rapporter':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-chart"><span /><span /><span /><span /></span>
        </div>
      );
    case 'konto':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-users">
            <span className="bx-tm-users-row">
              <span className="bx-tm-user">AA</span>
              <span className="bx-tm-user bx-tm-user-2">SE</span>
              <span className="bx-tm-user bx-tm-user-3">+</span>
            </span>
            <span className="bx-tm-2fa"><i />TVÅFAKTOR PÅ</span>
          </span>
        </div>
      );
    case 'format':
      return (
        <div className="bx-tm" aria-hidden>
          <span className="bx-tm-formats">
            <span><span className="bx-tm-chip">SIE4</span></span>
            <span><span className="bx-tm-chip">eSKD</span></span>
            <span><span className="bx-tm-chip">SRU</span></span>
            <span><span className="bx-tm-chip">ISO 20022</span></span>
          </span>
        </div>
      );
    default:
      return null;
  }
}
