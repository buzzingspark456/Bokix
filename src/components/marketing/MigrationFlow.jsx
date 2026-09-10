import React, { useEffect, useState } from 'react';
import { BRAND } from '../../utils/brandColors';
import { INK, MUTED } from './marketingTokens';
import BokixWordmark from '../shared/BokixWordmark';
import { ProgramLogo } from '../shared/BrandLogos';
import { MIGRATION_SOURCES } from '../../utils/migrationSources';

// ── "Byt hit"-animationen: ditt nuvarande program → SIE4-filen → Bokix ──
// Delad av startsidan (egen sektion ovanför prissektionen) och
// /byt-bokforingsprogram (hjälten). EN komponent, inte två snarlika
// kopior: animationen är hela poängen med båda ytorna och skulle
// garanterat divergera annars.
//
// Rörelsen är byggd av samma vokabulär som resten av marknadssajten redan
// använder (se <MarketingStyles> i MarketingLayout.jsx), inte en ny
// egen idé: .lp-flow-connector (gradienten som vandrar längs en "ledning")
// är exakt den klass "Kopplat till"-diagrammet och leverantörsfaktura-
// pipen redan kör. Det som tillkommer här har egna keyframes nedan:
// SIE4-paketet som färdas längs ledningen, programbytet i vänsteränden,
// och navets ring — som pulserar i takt med paketets ankomst i stället
// för med delade .lp-hub-pulse (annan cykellängd, hade glidit ur fas).
//
// Layouten är AVSIKTLIGT vågrät i alla bredder. En tidigare variant lät
// hjälterutan flex-wrap:a på mobil, vilket gav en trasig bild: sju
// loggor i 5+2 och en nedåtpil bredvid (inte över) Bokix-kortet. Med
// clamp():ade mått får en 390px-skärm samma läsordning som en 1440px:
// därifrån → filen → hit. Bricksraden under bryter i stället kontrollerat
// via max-width (4+3 på mobil, alla sju på en rad på desktop) — aldrig en
// ensam överbliven bricka.
const SWAP_MS = 2800;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function MigrationFlow({ note = true }) {
  // Index, inte id: cykeln ska gå igenom listan i ordning och wrappa runt.
  const [i, setI] = useState(0);
  // Muspekaren över en bricka fryser cykeln på just det programmet — en
  // ren muspekarförbättring, ingen tangentbords-/skärmläsarväg går genom
  // den (auto-cykeln visar ändå alla program för alla andra).
  const [held, setHeld] = useState(null);

  useEffect(() => {
    if (prefersReducedMotion() || held !== null) return undefined;
    const t = setInterval(() => setI(prev => (prev + 1) % MIGRATION_SOURCES.length), SWAP_MS);
    return () => clearInterval(t);
  }, [held]);

  const activeIndex = held ?? i;
  const active = MIGRATION_SOURCES[activeIndex];

  return (
    <div className="bx-mf">
      <style>{`
        .bx-mf { display: flex; flex-direction: column; align-items: center; gap: clamp(20px, 4vw, 30px); width: 100%; }

        /* Scenen: källa → ledning → nav. Vågrät i ALLA bredder, se
           filkommentaren ovan. */
        .bx-mf-stage { display: flex; align-items: center; justify-content: center; gap: clamp(8px, 2.4vw, 20px); width: 100%; max-width: min(94%, 860px); }
        .bx-mf-side { display: flex; flex-direction: column; align-items: center; gap: 9px; flex-shrink: 0; }

        .bx-mf-tile { display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 14px; }
        .bx-mf-tile-lg { width: clamp(66px, 9vw, 128px); height: clamp(66px, 9vw, 128px); border: 1.5px solid var(--mkt-card-border); box-shadow: var(--mkt-card-shadow); }
        .bx-mf-label { font-size: clamp(11.5px, 2.6vw, 13.5px); font-weight: 700; letter-spacing: -0.005em; white-space: nowrap; }

        /* Bytet i vänsteränden: gamla loggan lämnar, nya kommer in. Byter
           man program med musen ska den nya brickan inte glida in från
           samma håll som auto-cykeln — men det är samma animation, bara
           omstartad av React:s key. */
        @keyframes bxMfSwap {
          from { opacity: 0; transform: translateY(6px) scale(0.94); }
          to   { opacity: 1; transform: none; }
        }
        .bx-mf-swap { animation: bxMfSwap 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }

        /* Ledningen mellan dem — .lp-flow-connector (delad) sköter själva
           vandringen, det här sätter bara formen. */
        .bx-mf-pipe { position: relative; flex: 1 1 auto; min-width: clamp(52px, 9vw, 200px); height: 34px; }
        .bx-mf-wire { position: absolute; left: 0; right: 0; top: 50%; height: 3px; margin-top: -1.5px; border-radius: 3px; }

        /* SIE4-paketet som färdas från programmet in i Bokix. Spåret är
           lika brett som ledningen, så translateX(100%) landar exakt på
           navets kant oavsett skärmbredd — ingen uppmätning i JS. */
        @keyframes bxMfPacket {
          0%   { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        /* Paketet tonar ut strax INNAN det når navet, inte när det redan
           ligger ovanpå det: annars överlappade SIE4-pillret Bokix-kortets
           kant i sista bildrutan (syns direkt på en 390px-skärm, där
           ledningen är kort). Nu läser sekvensen som avsett — filen åker in
           i Bokix, och ringen kvitterar ankomsten (bxMfArrive, 88%). */
        @keyframes bxMfPacketFade {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          72%  { opacity: 1; }
          84%  { opacity: 0; }
          100% { opacity: 0; }
        }
        .bx-mf-track { position: absolute; inset: 0; animation: bxMfPacket ${SWAP_MS}ms cubic-bezier(0.45, 0, 0.55, 1) infinite; }
        .bx-mf-packet {
          position: absolute; left: 0; top: 50%; transform: translate(-50%, -50%);
          display: flex; align-items: center; gap: 4px; padding: 4px 9px; border-radius: 999px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap;
          animation: bxMfPacketFade ${SWAP_MS}ms linear infinite;
        }

        /* Navet: Bokix-kortet. Ringen andas i takt med paketet (samma
           ${SWAP_MS}ms) i stället för den delade .lp-hub-pulse — poängen är
           att den ska kvittera ANKOMSTEN, och en egen cykellängd hade
           glidit ur fas med filen som kommer in. */
        .bx-mf-hub { position: relative; display: flex; align-items: center; justify-content: center; padding: clamp(11px, 3vw, 17px) clamp(13px, 3.6vw, 22px); border-radius: 16px; background: var(--mkt-card-bg); border: 1.5px solid ${BRAND.green}; box-shadow: var(--mkt-card-shadow); }
        @keyframes bxMfArrive {
          0%, 72% { transform: scale(1); opacity: 0.3; }
          88%     { transform: scale(1.09); opacity: 0.85; }
          100%    { transform: scale(1); opacity: 0.3; }
        }
        .bx-mf-halo { position: absolute; inset: -6px; border-radius: 21px; border: 1.5px solid ${BRAND.green}; opacity: 0.3; pointer-events: none; animation: bxMfArrive ${SWAP_MS}ms ease-in-out infinite; }

        /* Bricksraden: max-width styr brytningen (4+3 på mobil, sju på en
           rad från 560px), aldrig en ensam överbliven bricka. */
        .bx-mf-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; max-width: 254px; }
        .bx-mf-chip { width: 56px; height: 56px; border: 1px solid var(--mkt-card-border); border-radius: 15px; transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.35s, box-shadow 0.35s; }
        .bx-mf-chip-on { transform: translateY(-4px) scale(1.09); border-color: ${BRAND.green}; box-shadow: 0 10px 20px -10px rgba(28,36,32,0.45); }
        @media (min-width: 560px) { .bx-mf-row { max-width: 470px; } }
        /* På riktigt breda skärmar får alla sju brickorna rymmas på en rad
           utan att raden i sig blir en smal remsa mitt i sektionen. */
        @media (min-width: 1280px) { .bx-mf-row { max-width: 760px; gap: 14px; } }

        /* Under 480px räckte clamp():arna precis men INTE mer: scenen fyllde
           sektionens hela innermått, så navets ring (och dess pulsering)
           låg klistrad mot skärmkanten och såg avklippt ut. Här krymper
           brickan/navet ett snäpp till — ledningen suger upp det som blir
           över (flex: 1) och blir längre, vilket dessutom ger paketet en
           tydligare resa. */
        @media (max-width: 480px) {
          .bx-mf-stage { gap: 10px; padding: 0 4px; }
          .bx-mf-tile-lg { width: 62px; height: 62px; border-radius: 14px; }
          .bx-mf-hub { padding: 11px 13px; }
          .bx-mf-label { font-size: 11.5px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bx-mf-swap, .bx-mf-track, .bx-mf-packet, .bx-mf-halo { animation: none !important; }
          .bx-mf-packet { opacity: 1; }
          .bx-mf-chip, .bx-mf-chip-on { transition: none; }
        }
      `}</style>

      <div className="bx-mf-stage">
        {/* Källan — programmet man byter FRÅN. key:en är hela poängen:
            React monterar om noden vid varje byte, vilket startar om
            .bx-mf-swap. */}
        <div className="bx-mf-side">
          <span key={active.id} className="bx-mf-tile bx-mf-tile-lg bx-mf-swap">
            <ProgramLogo src={active.logo} alt={active.name} size={46} />
          </span>
          <span key={`${active.id}-name`} className="bx-mf-label bx-mf-swap" style={{ color: MUTED }}>{active.name}</span>
        </div>

        <div className="bx-mf-pipe" aria-hidden>
          <div className="bx-mf-wire lp-flow-connector" style={{ backgroundImage: `linear-gradient(90deg, var(--mkt-card-border), ${BRAND.green}, var(--mkt-card-border))` }} />
          <div className="bx-mf-track">
            <span className="bx-mf-packet" style={{ background: BRAND.greenLight, color: BRAND.greenDark, border: `1px solid ${BRAND.green}` }}>SIE4</span>
          </div>
        </div>

        <div className="bx-mf-side">
          <span className="bx-mf-hub">
            <span className="bx-mf-halo" aria-hidden />
            <BokixWordmark height="clamp(23px, 5.8vw, 30px)" />
          </span>
          <span className="bx-mf-label" style={{ color: INK }}>Din nya bokföring</span>
        </div>
      </div>

      {/* Alla program på en gång — den aktiva lyfts. Muspekaren fryser
          cykeln på den bricka man pekar på; inget klick, ingen fokusfälla,
          bara en liten belöning för den som utforskar. */}
      <div className="bx-mf-row">
        {MIGRATION_SOURCES.map((p, idx) => (
          <span
            key={p.id}
            title={p.note ? `${p.name} — ${p.note}` : p.name}
            onMouseEnter={() => setHeld(idx)}
            onMouseLeave={() => { setHeld(null); setI(idx); }}
            className={`bx-mf-tile bx-mf-chip${idx === activeIndex ? ' bx-mf-chip-on' : ''}`}
          >
            <ProgramLogo src={p.logo} alt={p.name} size={34} />
          </span>
        ))}
      </div>

      {note && (
        <p style={{ fontSize: '13.5px', color: MUTED, textAlign: 'center', margin: 0, maxWidth: '440px', lineHeight: 1.6 }}>
          Något annat program? SIE4 är en branschstandard — Bokix läser filen oavsett vilket program som skapade den.
        </p>
      )}
    </div>
  );
}
