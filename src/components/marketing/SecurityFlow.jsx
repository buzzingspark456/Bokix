import React, { useEffect, useState } from 'react';
import { Lock, ShieldCheck, User, Database } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { INK, INK_SOFT, MUTED } from './marketingTokens';

// ── Radnivåskyddet, visat i stället för förklarat ───────────────────────
// Säkerhetssidans huvudbild. Den ersätter det stycke brödtext som tidigare
// försökte förklara Row Level Security i ord — vilket är den svåraste
// tänkbara formen för exakt det här: en icke-tekniker läser "åtkomsten
// styrs av regler i själva databasen" och tar med sig ingenting alls.
//
// Bilden visar mekanismen: samma tabell innehåller flera företags rader,
// frågan ställs, och det som kommer tillbaka är bara dina. Sista anhalten
// är den som faktiskt betyder något — appen ber om ALLT, och får ändå bara
// sitt eget, eftersom regeln sitter i databasen och inte i koden som
// råkade ställa frågan.
//
// Rörelsevokabulären är sajtens egen (UfYearFlow/BankFlow/MigrationFlow):
// anhalter man kan hålla kvar, paus när pekaren är i modulen, respekt för
// prefers-reduced-motion. Inget nytt formspråk för en ny sida.
const STEP_MS = 4600;

// Raderna i "databasen". `mine` avgör vad som händer i steg 3 och 4 —
// bara dina rader kommer tillbaka, resten förblir låsta.
const ROWS = [
  { id: 'r1', mine: true, label: 'Faktura 2026-114', sum: '12 400 kr' },
  { id: 'r2', mine: false, label: 'Faktura 2026-088', sum: '4 900 kr' },
  { id: 'r3', mine: true, label: 'Kvitto, Circle K', sum: '712 kr' },
  { id: 'r4', mine: false, label: 'Lönekörning mars', sum: '38 200 kr' },
  { id: 'r5', mine: true, label: 'Verifikation A-42', sum: '2 150 kr' },
];

const STEPS = [
  {
    id: 'login', icon: User, label: 'Du loggar in',
    title: 'Frågan bär din identitet',
    body: 'Varje anrop till databasen är signerat med vem du är. Det är inte något appen påstår — det är något databasen kan kontrollera själv.',
    query: 'select * from fakturor',
  },
  {
    id: 'shared', icon: Database, label: 'Samma tabell',
    title: 'Alla företag ligger i samma tabell',
    body: 'Så fungerar varje molntjänst. Det som skiljer dem åt är vad som händer härnäst.',
    query: 'select * from fakturor',
  },
  {
    id: 'filter', icon: ShieldCheck, label: 'Regeln körs',
    title: 'Databasen filtrerar, inte appen',
    body: 'En regel på tabellen (Row Level Security) släpper bara igenom rader som hör till ditt företag. Den körs före svaret, varje gång.',
    query: 'select * from fakturor',
  },
  {
    id: 'bug', icon: Lock, label: 'Även vid bugg',
    title: 'Appen kan be om allt — och får ändå bara ditt',
    body: 'Det är hela poängen med att lägga regeln i databasen. En bugg i webbläsarkoden kan inte be sig förbi den, för det är inte koden som avgör.',
    query: 'select * from fakturor  -- utan filter',
  },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function SecurityFlow() {
  const [i, setI] = useState(0);
  const [held, setHeld] = useState(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || paused || held !== null) return undefined;
    const t = setInterval(() => setI(prev => (prev + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [paused, held]);

  const isMouse = e => e.pointerType === 'mouse';
  const active = held ?? i;
  const step = STEPS[active];

  // Från och med steg 3 är svaret filtrerat. Före dess visas tabellen som
  // den är: allas rader, ingen skillnad ännu.
  const filtering = active >= 2;

  return (
    <div
      className="bx-sf"
      onPointerEnter={e => { if (isMouse(e)) setPaused(true); }}
      onPointerLeave={e => { if (isMouse(e)) setPaused(false); }}
    >
      <style>{`
        .bx-sf { width: 100%; display: flex; flex-direction: column; gap: clamp(18px, 3vw, 26px); }

        .bx-sf-stops { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
        .bx-sf-stop {
          display: inline-flex; align-items: center; gap: 8px; padding: 9px 15px;
          border-radius: 999px; border: 1.5px solid var(--mkt-card-border);
          background: var(--mkt-card-bg); color: var(--mkt-muted);
          font-family: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer;
          transition: border-color 0.35s, color 0.35s, background 0.35s, transform 0.35s cubic-bezier(0.22,1,0.36,1);
        }
        .bx-sf-stop-on { border-color: ${BRAND.green}; color: #fff; background: ${BRAND.green}; transform: translateY(-1px); }
        .bx-sf-stop-done { border-color: ${BRAND.green}; color: ${BRAND.green}; }

        /* Scenen: frågan till vänster, tabellen till höger. Under 720px
           staplas de, och kopplingen blir lodrät i stället för vågrät. */
        .bx-sf-stage {
          display: grid; grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1.05fr);
          align-items: center; gap: 0;
          background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
          border-radius: 18px; padding: clamp(16px, 3vw, 24px);
        }
        @media (max-width: 720px) { .bx-sf-stage { grid-template-columns: 1fr; gap: 14px; } }

        .bx-sf-pane-label {
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--mkt-muted); margin-bottom: 9px;
        }

        /* Frågekortet. Monospace: det ÄR en fråga till en databas, och den
           som känner igen formen ska känna igen den. */
        .bx-sf-query {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: clamp(11px, 2.3vw, 12.5px); line-height: 1.5;
          background: #14201a; color: #d7e5dc; border-radius: 11px;
          padding: 13px 14px; word-break: break-word;
        }
        .bx-sf-query-you { display: flex; align-items: center; gap: 7px; margin-bottom: 9px; color: rgba(255,255,255,0.55); font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }

        /* Ledningen mellan frågan och tabellen, med en puls som vandrar. */
        .bx-sf-wire { position: relative; height: 2px; background: var(--mkt-card-border); border-radius: 2px; }
        @media (max-width: 720px) { .bx-sf-wire { width: 2px; height: 26px; justify-self: center; } }
        .bx-sf-pulse {
          position: absolute; top: 50%; left: 0; width: 7px; height: 7px; margin: -3.5px 0 0 -3.5px;
          border-radius: 50%; background: ${BRAND.green};
          box-shadow: 0 0 0 4px rgba(11,99,41,0.14);
          animation: bx-sf-run 1.9s cubic-bezier(0.5,0,0.5,1) infinite;
        }
        @keyframes bx-sf-run { 0% { left: 0; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { left: 100%; opacity: 0; } }
        @media (max-width: 720px) {
          .bx-sf-pulse { top: 0; left: 50%; animation-name: bx-sf-run-y; }
          @keyframes bx-sf-run-y { 0% { top: 0; opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { top: 100%; opacity: 0; } }
        }

        .bx-sf-rows { display: flex; flex-direction: column; gap: 6px; }
        .bx-sf-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--mkt-card-border); background: var(--mkt-ivory);
          font-size: clamp(11.5px, 2.4vw, 13px);
          transition: opacity 0.5s, filter 0.5s, border-color 0.5s, background 0.5s, transform 0.5s cubic-bezier(0.22,1,0.36,1);
        }
        .bx-sf-row-mine { border-color: rgba(11,99,41,0.35); background: var(--mkt-accent-green-soft); }
        /* Andras rader när regeln körts: kvar i tabellen, men utan innehåll
           som går att läsa. De försvinner INTE — de finns, du når dem bara
           inte, och det är sanningen om hur det fungerar. */
        .bx-sf-row-locked { opacity: 0.42; filter: blur(2.4px); transform: scale(0.985); }
        .bx-sf-row-sum { margin-left: auto; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }

        .bx-sf-badge {
          display: inline-flex; align-items: center; gap: 6px; margin-top: 11px;
          padding: 7px 12px; border-radius: 999px; font-size: 12px; font-weight: 700;
          transition: opacity 0.4s;
        }

        /* Textkortet under scenen. Svepet vid byte är samma som sajtens
           övriga flöden — innehållet byts, det hoppar inte. */
        .bx-sf-card { text-align: center; max-width: 620px; margin: 0 auto; min-height: 96px; }
        .bx-sf-swap { animation: bx-sf-in 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes bx-sf-in { from { opacity: 0; transform: translateY(7px); } to { opacity: 1; transform: none; } }

        @media (prefers-reduced-motion: reduce) {
          .bx-sf-pulse { animation: none; opacity: 1; }
          .bx-sf-swap { animation: none; }
          .bx-sf-row, .bx-sf-stop { transition: none; }
        }
      `}</style>

      {/* Anhalterna — riktiga knappar, inte dekor. */}
      <div className="bx-sf-stops">
        {STEPS.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            className={`bx-sf-stop${idx === active ? ' bx-sf-stop-on' : idx < active ? ' bx-sf-stop-done' : ''}`}
            aria-current={idx === active}
            onPointerEnter={e => { if (isMouse(e)) setHeld(idx); }}
            onPointerLeave={e => { if (isMouse(e)) { setI(idx); setHeld(null); } }}
            onClick={() => { setI(idx); setHeld(null); }}
          >
            <s.icon size={14} /> {s.label}
          </button>
        ))}
      </div>

      <div className="bx-sf-stage">
        <div>
          <div className="bx-sf-pane-label">Din webbläsare</div>
          <div className="bx-sf-query">
            <div className="bx-sf-query-you"><User size={12} /> Du, inloggad</div>
            <div key={step.id}>{step.query}</div>
          </div>
        </div>

        <div className="bx-sf-wire" aria-hidden><span className="bx-sf-pulse" /></div>

        <div>
          <div className="bx-sf-pane-label">Databasen</div>
          <div className="bx-sf-rows">
            {ROWS.map(row => {
              const locked = filtering && !row.mine;
              return (
                <div
                  key={row.id}
                  className={`bx-sf-row${row.mine && filtering ? ' bx-sf-row-mine' : ''}${locked ? ' bx-sf-row-locked' : ''}`}
                  aria-hidden={locked}
                >
                  {locked
                    ? <Lock size={13} style={{ flexShrink: 0, color: MUTED }} />
                    : <ShieldCheck size={13} style={{ flexShrink: 0, color: filtering ? BRAND.green : MUTED }} />}
                  <span style={{ color: INK_SOFT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                  <span className="bx-sf-row-sum" style={{ color: INK }}>{row.sum}</span>
                </div>
              );
            })}
          </div>
          <div
            className="bx-sf-badge"
            style={{
              opacity: filtering ? 1 : 0,
              background: 'var(--mkt-accent-green-soft)',
              color: 'var(--mkt-accent-green-fg)',
            }}
          >
            <ShieldCheck size={13} /> 3 av 5 rader returnerade
          </div>
        </div>
      </div>

      <div className="bx-sf-card">
        <div key={step.id} className="bx-sf-swap">
          <h3 style={{ fontSize: 'clamp(16px, 2.6vw, 19px)', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.01em' }}>
            {step.title}
          </h3>
          <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, margin: 0 }}>
            {step.body}
          </p>
        </div>
      </div>
    </div>
  );
}
