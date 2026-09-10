import React, { useEffect, useState } from 'react';
import { Rocket, FileText, BookOpen, PieChart } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { INK, INK_SOFT, MUTED } from './marketingTokens';

// ── UF-året som en tidslinje ────────────────────────────────────────────
// Sidans huvudbild: ett läsår från start till bokslut, där en markör
// vandrar längs spåret och varje anhalt i sin tur får berätta vad man gör
// i Bokix just då.
//
// Varför en tidslinje och inte fyra textkort: ett UF-företag lever exakt
// ett läsår, och det är den enda produktupplevelse som är genuint
// annorlunda mot ett vanligt företag. Kort i ett rutnät säger "här är fyra
// funktioner"; ett spår med en början och ett slut säger "så här ser ert
// år ut" — vilket är hela poängen med en egen sida för dem.
//
// Rörelsevokabulären är sajtens egen (samma som BankFlow/MigrationFlow):
// .lp-flow-connector-ledningen, ett svep när innehållet byts, och en ring
// som kvitterar. Inget nytt formspråk bara för att sidan är ny.
//
// Ingen text här lovar något appen inte gör — anhalterna motsvarar
// funktioner som finns (fakturering, kvitton/bank, bokslutsflödet).
const STEP_MS = 5200;

const STEPS = [
  {
    id: 'start', icon: Rocket, label: 'Starta',
    title: 'Företagsnamn och skola',
    body: 'Inget organisationsnummer, inga betaluppgifter. Kontot är igång på en minut.',
  },
  {
    id: 'sell', icon: FileText, label: 'Sälj',
    title: 'Första fakturan',
    body: 'Skicka den på mejl. Med Stripe kopplat kan kunden betala med kort direkt från fakturan.',
  },
  {
    id: 'book', icon: BookOpen, label: 'Bokför',
    title: 'Kvitton och kontoutdrag',
    body: 'Fota kvittot, läs in bankfilen. Allt blir verifikationer enligt BAS-kontoplanen.',
  },
  {
    id: 'close', icon: PieChart, label: 'Bokslut',
    title: 'Året sammanräknat',
    body: 'Resultat- och balansräkning för hela UF-året, och ett räkenskapsår som går att stänga.',
  },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function UfYearFlow() {
  const [i, setI] = useState(0);
  // Muspekaren över en anhalt stannar på den. Klick gör samma sak för den
  // som inte har en muspekare — hela spåret är riktiga knappar, inte
  // dekor, så tangentbord och skärmläsare kommer åt samma innehåll.
  const [held, setHeld] = useState(null);
  // Pekaren NÅGONSTANS i modulen (spår som kort) pausar också, utan att
  // byta anhalt. Kundklagomål, ordagrant i sak: kortet hann bytas mitt i
  // meningen medan man läste det. Den som har pekaren här läser — då ska
  // klockan stå still, inte bara när man råkar hålla den på en prick.
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || paused || held !== null) return undefined;
    const t = setInterval(() => setI(prev => (prev + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(t);
  }, [paused, held]);

  // Att SLÄPPA en anhalt får aldrig hoppa tillbaka till där den
  // automatiska klockan råkade stå när man förde pekaren dit (det var
  // buggen: hovra steg 1, lämna, och kortet slog om till steg 3 i samma
  // ögonblick). Vi flyttar därför klockan till den anhalt man faktiskt
  // tittade på och låter den fortsätta därifrån — ett helt intervall
  // senare, eftersom effekten startas om.
  const release = idx => { setI(idx); setHeld(null); };

  // Pointer-, inte mouse-händelser, och bara för en riktig muspekare: på
  // en pekskärm skickar webbläsaren ett mouseenter vid tryck men ofta
  // inget mouseleave, och tidslinjen hade då frusit på den anhalt man
  // råkade nudda. Där är tryck = klick, och klicket flyttar klockan.
  const isMouse = e => e.pointerType === 'mouse';

  const active = held ?? i;
  const step = STEPS[active];
  // Markörens läge i procent: mitten av varje anhalt, så linjen fylls
  // exakt fram till den som lyser.
  const progress = STEPS.length > 1 ? (active / (STEPS.length - 1)) * 100 : 0;

  return (
    <div
      className="bx-uy"
      onPointerEnter={e => { if (isMouse(e)) setPaused(true); }}
      onPointerLeave={e => { if (isMouse(e)) setPaused(false); }}
    >
      <style>{`
        .bx-uy { width: 100%; display: flex; flex-direction: column; align-items: center; gap: clamp(20px, 3.4vw, 30px); }

        .bx-uy-track { position: relative; width: 100%; max-width: 760px; padding: 0 clamp(6px, 3vw, 18px); }
        /* Spåret: en tunn linje bakom anhalterna, och en fylld linje ovanpå
           som växer fram till den aktiva. Bredden animeras (inte transform)
           eftersom den ska sluta exakt vid en punkt, inte skalas. */
        .bx-uy-rail { position: absolute; left: clamp(6px, 3vw, 18px); right: clamp(6px, 3vw, 18px); top: clamp(21px, 4.6vw, 27px); height: 3px; border-radius: 3px; background: var(--mkt-card-border); }
        .bx-uy-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: linear-gradient(90deg, ${BRAND.green}, #14b8a6); transition: width 0.7s cubic-bezier(0.22, 1, 0.36, 1); }

        .bx-uy-stops { position: relative; display: flex; justify-content: space-between; }
        .bx-uy-stop { display: flex; flex-direction: column; align-items: center; gap: 9px; background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; flex: 1 1 0; min-width: 0; }
        .bx-uy-dot {
          width: clamp(42px, 9.2vw, 54px); height: clamp(42px, 9.2vw, 54px); border-radius: 50%;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
          background: var(--mkt-card-bg); border: 2px solid var(--mkt-card-border); color: var(--mkt-muted);
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.45s, color 0.45s, box-shadow 0.45s;
        }
        .bx-uy-stop-done .bx-uy-dot { border-color: ${BRAND.green}; color: ${BRAND.green}; }
        .bx-uy-stop-on .bx-uy-dot { border-color: ${BRAND.green}; color: #fff; background: ${BRAND.green}; transform: scale(1.12); box-shadow: 0 12px 26px -12px rgba(11,99,41,0.6); }
        .bx-uy-name { font-size: clamp(11.5px, 2.5vw, 14px); font-weight: 700; letter-spacing: -0.005em; color: var(--mkt-muted); transition: color 0.45s; }
        .bx-uy-stop-on .bx-uy-name { color: var(--mkt-ink); }

        /* Ringen som kvitterar den aktiva anhalten — samma idé som navets
           ring i BankFlow, men knuten till ett byte i stället för till en
           egen cykel (därför en engångsanimation via React-key, ingen
           infinite). */
        @keyframes bxUyPing {
          0% { transform: scale(1); opacity: 0.55; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .bx-uy-ping { position: absolute; inset: 0; border-radius: 50%; border: 2px solid ${BRAND.green}; animation: bxUyPing 1.1s ease-out both; pointer-events: none; }
        .bx-uy-dot-wrap { position: relative; display: flex; }

        /* Kortet under spåret. Byts med samma svep som bankbrickan i
           BankFlow, startat om av React:s key. */
        @keyframes bxUySwap {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        .bx-uy-card {
          width: 100%; max-width: 560px; text-align: center;
          background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 16px;
          padding: clamp(20px, 3.6vw, 26px) clamp(20px, 4vw, 30px); box-shadow: var(--mkt-card-shadow);
          animation: bxUySwap 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .bx-uy-ends { display: flex; justify-content: space-between; width: 100%; max-width: 760px; padding: 0 clamp(6px, 3vw, 18px); font-size: 11.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: var(--mkt-muted); }

        @media (prefers-reduced-motion: reduce) {
          .bx-uy-fill, .bx-uy-dot, .bx-uy-name { transition: none; }
          .bx-uy-ping, .bx-uy-card { animation: none; }
        }
      `}</style>

      <div className="bx-uy-ends" aria-hidden>
        <span>Läsårets början</span>
        <span>Läsårets slut</span>
      </div>

      <div className="bx-uy-track">
        <div className="bx-uy-rail" aria-hidden>
          <div className="bx-uy-fill lp-flow-connector" style={{ width: `${progress}%` }} />
        </div>
        <div className="bx-uy-stops">
          {STEPS.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              className={`bx-uy-stop${idx === active ? ' bx-uy-stop-on' : ''}${idx < active ? ' bx-uy-stop-done' : ''}`}
              aria-pressed={idx === active}
              onPointerEnter={e => { if (isMouse(e)) setHeld(idx); }}
              onPointerLeave={e => { if (isMouse(e)) release(idx); }}
              onFocus={() => setHeld(idx)}
              onBlur={() => release(idx)}
              onClick={() => release(idx)}
            >
              <span className="bx-uy-dot-wrap">
                <span className="bx-uy-dot"><s.icon size={20} /></span>
                {idx === active && <span key={`ping-${active}`} className="bx-uy-ping" aria-hidden />}
              </span>
              <span className="bx-uy-name">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* aria-live: den som använder skärmläsare ska få höra att kortet
          bytts, inte upptäcka det av en slump. */}
      <div key={step.id} className="bx-uy-card" aria-live="polite">
        <h3 style={{ fontSize: 'clamp(17px, 2.6vw, 21px)', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>{step.title}</h3>
        <p style={{ fontSize: 'clamp(14px, 2vw, 15.5px)', color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>{step.body}</p>
        <div style={{ marginTop: '14px', fontSize: '11.5px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: MUTED }}>
          Steg {active + 1} av {STEPS.length}
        </div>
      </div>
    </div>
  );
}
