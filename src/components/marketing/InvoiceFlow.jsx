import React, { useEffect, useState } from 'react';
import { INK, MUTED, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';

// ── Hjälten på /funktioner (Bokföring & fakturering): en faktura fylls i
// rad för rad, skickas, blir betald — och verifikationen skrivs av sig
// själv under. Det är sidans hela poäng i en rörelse: du fakturerar,
// bokföringen följer med. En räknare driver allt, som i BankFlow.
const STEP_MS = 800;
const STEPS = 12;

const LINES = [
  { text: 'Konsulttimmar, 12 h', amount: '11 400,00' },
  { text: 'Resa till kund', amount: '600,00' },
];

const STATUS = ['Utkast', 'Utkast', 'Utkast', 'Utkast', 'Skickad', 'Skickad', 'Betald'];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function InvoiceFlow() {
  const [step, setStep] = useState(STEPS - 2);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    setStep(0);
    const t = setInterval(() => setStep(s => (s + 1) % STEPS), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const linesShown = Math.min(step, LINES.length);
  const totals = step >= 3;
  const status = STATUS[Math.min(step, STATUS.length - 1)];
  const paid = status === 'Betald';
  const booked = step >= 7;

  return (
    <div className="bx-inv" aria-label="Exempel: en faktura som betalas och bokförs i Bokix">
      <style>{`
        .bx-inv { width: 100%; max-width: 470px; margin: 0 auto; }
        .bx-inv-card { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; box-shadow: ${CARD_SHADOW}; padding: 22px 24px 20px; }
        .bx-inv-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13.5px; padding: 10px 0; border-bottom: 1px solid var(--mkt-border-soft); opacity: 0; transform: translateX(-8px); transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
        .bx-inv-row.on { opacity: 1; transform: none; }
        .bx-inv-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
        .bx-inv-tot { transition: opacity 0.4s ease; }
        .bx-inv-status { font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; transition: background 0.3s ease, color 0.3s ease; }
        .bx-inv-paid { display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; color: ${ACCENT.green.fg}; margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--mkt-border-soft); opacity: 0; transform: translateY(-4px); transition: opacity 0.35s ease, transform 0.4s ease; }
        .bx-inv-paid.on { opacity: 1; transform: none; }
        .bx-inv-ver { margin-top: 14px; background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 14px; padding: 14px 18px; opacity: 0; transform: translateY(10px); transition: opacity 0.4s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        .bx-inv-ver.on { opacity: 1; transform: none; }
        .bx-inv-ver-row { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; padding: 5px 0; color: ${INK}; }
      `}</style>

      <div className="bx-inv-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Faktura 2026-022</div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: INK, marginTop: '3px' }}>Linné Arkitekter AB</div>
          </div>
          <span className="bx-inv-status" style={{ background: paid ? ACCENT.green.soft : 'var(--mkt-ivory)', color: paid ? ACCENT.green.fg : MUTED }}>{status}</span>
        </div>

        {LINES.map((l, i) => (
          <div key={l.text} className={`bx-inv-row ${i < linesShown ? 'on' : ''}`}>
            <span style={{ color: INK }}>{l.text}</span>
            <span className="bx-inv-num" style={{ color: INK }}>{l.amount}</span>
          </div>
        ))}

        <div className="bx-inv-tot" style={{ opacity: totals ? 1 : 0 }}>
          <div className="bx-inv-row on" style={{ borderBottom: 'none', paddingBottom: '4px' }}>
            <span style={{ color: MUTED }}>Moms 25 %</span>
            <span className="bx-inv-num" style={{ color: MUTED }}>3 000,00</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '16px', fontWeight: 700, color: INK }}>
            <span>Att betala</span>
            <span className="bx-inv-num">15 000,00 kr</span>
          </div>
        </div>

        <div className={`bx-inv-paid ${paid ? 'on' : ''}`}>
          <span>Betalning mottagen</span>
          <span className="bx-inv-num">15 000,00 kr</span>
        </div>
      </div>

      <div className={`bx-inv-ver ${booked ? 'on' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Verifikation A-58</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: ACCENT.green.fg }}>Bokförd automatiskt</span>
        </div>
        <div className="bx-inv-ver-row"><span>1930 Företagskonto</span><span className="bx-inv-num">15 000,00</span></div>
        <div className="bx-inv-ver-row"><span>1510 Kundfordringar</span><span className="bx-inv-num" style={{ color: MUTED }}>−15 000,00</span></div>
      </div>
    </div>
  );
}
