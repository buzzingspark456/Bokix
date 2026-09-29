import React, { useEffect, useRef, useState } from 'react';
import { Check } from '../icons';
import { BRAND } from '../../utils/brandColors';

// ── "Kvitton läser sig själva"-animationen på startsidan (OCR) ──────────
// Ett riktigt kvitto med läsbar text, inte grå streck (kundönskemål
// 2026-09-29: "gör den bättre"). Strålen stannar på en rad i taget, raden
// markeras och det fält den raden ger fylls i till höger, så man ser VAR på
// kvittot varje värde kommer ifrån. Till sist bokförs utgiften.
//
// Fälten (Datum/Belopp/Moms/Konto) är exakt vad utils/ocrReceipt.js läser ut
// och Expenses.jsx visar. Siffrorna går ihop: 842,50 kr inklusive 25 % moms
// ger 168,50 kr i moms.
//
// Startar bara när den syns, och står stilla på sista läget (allt ifyllt)
// vid prefers-reduced-motion, aldrig på ett tomt kvitto.

// Kvittots rader. `field` är index i FIELDS för raden som läses av.
const RECEIPT = [
  { text: 'CIRCLE K', sub: 'Arlandastad', head: true },
  { text: '2026-03-14', right: '16:42', field: 0 },
  { text: 'Diesel 42,12 l', right: '842,50', field: 3 },
  { text: 'Varav moms 25 %', right: '168,50', field: 2 },
  { text: 'TOTALT SEK', right: '842,50', field: 1, total: true },
];

const FIELDS = [
  { label: 'Datum', value: '14 mar 2026' },
  { label: 'Belopp', value: '842,50 kr' },
  { label: 'Moms', value: '168,50 kr' },
  { label: 'Konto', value: '5611 Drivmedel' },
];

// Tandad nederkant som clip-path: 14 tänder, 7 px djupa.
const TEAR = (() => {
  const teeth = 14;
  const pts = ['0 0', '100% 0'];
  for (let i = teeth * 2; i >= 0; i -= 1) {
    pts.push(`${(i / (teeth * 2)) * 100}% ${i % 2 ? '100%' : 'calc(100% - 7px)'}`);
  }
  return `polygon(${pts.join(', ')})`;
})();

// Raderna i den ordning strålen läser dem, uppifrån och ned.
const READ_ORDER = RECEIPT.map((r, i) => (r.field != null ? i : null)).filter(i => i != null);

// Tidslinje: kort paus, en rad i taget, bokfört, vila, börja om.
const START_MS = 500;
const ROW_MS = 700;
const DONE_HOLD_MS = 2800;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** step: -1 = inget läst, 0..n-1 = raden READ_ORDER[step] läses, n = bokfört. */
function useReceiptTimeline() {
  const ref = useRef(null);
  const [step, setStep] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setReduced(true); setStep(READ_ORDER.length); }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return undefined;
    const delay = step === -1 ? START_MS : step >= READ_ORDER.length ? DONE_HOLD_MS : ROW_MS;
    const t = setTimeout(() => setStep(s => (s >= READ_ORDER.length ? -1 : s + 1)), delay);
    return () => clearTimeout(t);
  }, [visible, reduced, step]);

  return [ref, step];
}

export default function ReceiptFlow() {
  const [ref, step] = useReceiptTimeline();
  const rowRefs = useRef([]);
  const [beamTop, setBeamTop] = useState(0);
  const done = step >= READ_ORDER.length;
  const activeRow = step >= 0 && !done ? READ_ORDER[step] : null;
  // Fält som redan lästs in: alla rader före och på den aktuella.
  const readRows = new Set(done ? READ_ORDER : READ_ORDER.slice(0, Math.max(0, step + 1)));
  const filledFields = new Set([...readRows].map(i => RECEIPT[i].field));

  useEffect(() => {
    const el = activeRow != null ? rowRefs.current[activeRow] : null;
    // Strålen ligger längs radens underkant, så den aldrig stryker över texten.
    if (el) setBeamTop(el.offsetTop + el.offsetHeight);
  }, [activeRow]);

  return (
    <div className="bx-ocr" ref={ref}>
      <style>{`
        .bx-ocr { display: flex; align-items: center; justify-content: center; gap: clamp(18px, 4vw, 44px); width: 100%; max-width: 720px; margin: 0 auto; }

        /* Kvittot: vitt termopapper även i mörkt läge. Den tandade
           nederkanten klipps ut med clip-path (se TEAR), och skuggan ligger
           på ett yttre lager som drop-shadow, eftersom clip-path annars
           klipper bort en vanlig box-shadow. */
        .bx-ocr-paper {
          flex-shrink: 0; width: clamp(190px, 30vw, 250px); transform: rotate(-1.2deg);
          filter: drop-shadow(0 1px 1px rgba(15,23,20,0.10)) drop-shadow(0 14px 22px rgba(15,23,20,0.20));
        }
        .bx-ocr-receipt {
          position: relative; padding: 20px 18px 30px; background: #fff; color: #1f2937;
          font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 12px; line-height: 1.35;
          clip-path: ${TEAR};
        }
        .bx-ocr-head { text-align: center; padding-bottom: 12px; margin-bottom: 10px; border-bottom: 1px dashed #cbd5d1; }
        .bx-ocr-head strong { display: block; font-size: 14px; letter-spacing: 0.08em; }
        .bx-ocr-head span { color: #6b7280; font-size: 11px; }
        .bx-ocr-line {
          position: relative; z-index: 1; display: flex; justify-content: space-between; gap: 10px;
          padding: 5px 6px; margin: 0 -6px; border-radius: 4px;
          transition: background-color 0.3s ease, color 0.3s ease;
        }
        .bx-ocr-line.is-total { margin-top: 8px; padding-top: 9px; border-top: 1px dashed #cbd5d1; font-weight: 700; font-size: 13px; border-radius: 0 0 4px 4px; }
        .bx-ocr-line.is-active { background: rgba(20,184,166,0.16); color: #0f3d2e; }
        .bx-ocr-line.is-read { color: #0f5132; }

        /* Strålen glider till raden som läses. */
        .bx-ocr-beam {
          position: absolute; left: 8px; right: 8px; height: 2px; margin-top: -1px; border-radius: 2px; z-index: 2;
          background: linear-gradient(90deg, transparent, #14b8a6 20%, #84cc16 80%, transparent);
          box-shadow: 0 0 12px 2px rgba(20,184,166,0.45);
          transition: top 0.45s cubic-bezier(0.65, 0, 0.35, 1), opacity 0.3s ease;
          pointer-events: none;
        }

        /* Formuläret till höger: samma rader som i appens Ny utgift. */
        .bx-ocr-form {
          flex: 1 1 auto; min-width: 0; max-width: 300px; background: var(--mkt-card-bg);
          border: 1px solid var(--mkt-card-border); border-radius: 14px; padding: 16px;
          box-shadow: 0 18px 40px -26px rgba(15,23,20,0.3);
        }
        .bx-ocr-form-title { font-size: 13px; font-weight: 700; color: var(--mkt-ink); margin: 0 0 12px; }
        .bx-ocr-row { display: flex; align-items: center; gap: 10px; padding: 9px 0; border-top: 1px solid var(--mkt-border-soft); }
        .bx-ocr-row-label { font-size: 12.5px; color: var(--mkt-muted); width: 56px; flex-shrink: 0; }
        .bx-ocr-row-value {
          flex: 1; min-width: 0; font-size: 13.5px; font-weight: 600; color: var(--mkt-ink);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .bx-ocr-row-empty { display: block; height: 8px; width: 70%; border-radius: 4px; background: var(--mkt-border-soft); }
        .bx-ocr-row-value.is-in { animation: bxOcrIn 0.4s cubic-bezier(0.22, 1, 0.36, 1); }
        @keyframes bxOcrIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        .bx-ocr-row-check { flex-shrink: 0; color: var(--mkt-accent-green-fg); opacity: 0; transform: scale(0.6); transition: opacity 0.25s, transform 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
        .bx-ocr-row.is-filled .bx-ocr-row-check { opacity: 1; transform: none; }

        .bx-ocr-done {
          display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 12px;
          padding: 9px 12px; border-radius: 10px; font-size: 13px; font-weight: 700;
          background: ${BRAND.green}; color: #fff;
          opacity: 0; transform: translateY(4px); transition: opacity 0.35s, transform 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .bx-ocr-done.is-in { opacity: 1; transform: none; }

        @media (max-width: 560px) {
          .bx-ocr { flex-direction: column; gap: 22px; }
          .bx-ocr-paper { width: min(250px, 82%); }
          .bx-ocr-form { width: 100%; max-width: 320px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .bx-ocr-beam { display: none; }
          .bx-ocr-line, .bx-ocr-row-check, .bx-ocr-done { transition: none; }
          .bx-ocr-row-value.is-in { animation: none; }
        }
      `}</style>

      <div className="bx-ocr-paper" aria-hidden>
      <div className="bx-ocr-receipt">
        {RECEIPT.map((r, i) => (r.head ? (
          <div key={i} className="bx-ocr-head"><strong>{r.text}</strong><span>{r.sub}</span></div>
        ) : (
          <div
            key={i}
            ref={el => { rowRefs.current[i] = el; }}
            className={`bx-ocr-line${r.total ? ' is-total' : ''}${activeRow === i ? ' is-active' : readRows.has(i) ? ' is-read' : ''}`}
          >
            <span>{r.text}</span><span>{r.right}</span>
          </div>
        )))}
        <div className="bx-ocr-beam" style={{ top: beamTop, opacity: activeRow != null ? 1 : 0 }} />
      </div>
      </div>

      <div className="bx-ocr-form">
        <p className="bx-ocr-form-title">Ny utgift</p>
        {FIELDS.map((f, i) => {
          const on = filledFields.has(i);
          return (
            <div key={f.label} className={`bx-ocr-row${on ? ' is-filled' : ''}`}>
              <span className="bx-ocr-row-label">{f.label}</span>
              {on
                ? <span className="bx-ocr-row-value is-in">{f.value}</span>
                : <span className="bx-ocr-row-value"><span className="bx-ocr-row-empty" /></span>}
              <Check size={15} className="bx-ocr-row-check" />
            </div>
          );
        })}
        <div className={`bx-ocr-done${done ? ' is-in' : ''}`}>
          <Check size={15} /> Bokförd som verifikation
        </div>
      </div>
    </div>
  );
}
