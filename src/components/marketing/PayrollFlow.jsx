import React, { useEffect, useState } from 'react';
import { Check } from '../icons';
import { BRAND } from '../../utils/brandColors';
import { INK, MUTED, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';

// ── Lönekörningen på /lon: tre rader bockas av en i taget, körningen
// godkänns och de tre filerna Bokix faktiskt skapar (AGI-fil, betalfil,
// verifikation) glider fram under kortet. Samma "en räknare driver allt"-
// mönster som BankFlow, så raden, statusen och filerna aldrig glider ur fas.
//
// Beloppen är ett räkneexempel (samma ~24,5 % skatt som reglaget längre
// ner på sidan, 31,42 % arbetsgivaravgift), inte en skattetabell.
const STEP_MS = 750;
const STEPS = 11;

const ROWS = [
  { name: 'Anna K.', gross: '38 000', tax: '9 310', net: '28 690' },
  { name: 'Omar H.', gross: '34 500', tax: '8 452', net: '26 048' },
  { name: 'Linnea S.', gross: '31 500', tax: '7 718', net: '23 782' },
];

const FILES = [
  { label: 'AGI-fil', note: 'Till Skatteverket' },
  { label: 'Betalfil', note: 'Till banken' },
  { label: 'Verifikation', note: 'Bokförd' },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function PayrollFlow() {
  const [step, setStep] = useState(STEPS - 2);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    setStep(0);
    const t = setInterval(() => setStep(s => (s + 1) % STEPS), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const rowsDone = Math.min(step, ROWS.length);
  const approved = step >= 4;
  const filesShown = Math.max(0, Math.min(step - 4, FILES.length));

  return (
    <div className="bx-pf" aria-label="Exempel på en lönekörning i Bokix">
      <style>{`
        .bx-pf { width: 100%; max-width: 460px; margin: 0 auto; }
        .bx-pf-card { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; box-shadow: ${CARD_SHADOW}; overflow: hidden; }
        .bx-pf-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--mkt-border-soft); }
        .bx-pf-status { font-size: 11.5px; font-weight: 700; padding: 4px 10px; border-radius: 999px; transition: background 0.3s ease, color 0.3s ease; }
        .bx-pf-row { display: grid; grid-template-columns: 22px 1fr auto auto; gap: 12px; align-items: center; padding: 12px 20px; border-bottom: 1px solid var(--mkt-border-soft); font-size: 13.5px; }
        .bx-pf-tick { width: 20px; height: 20px; border-radius: 50%; border: 1.5px solid var(--mkt-card-border); display: flex; align-items: center; justify-content: center; transition: background 0.25s ease, border-color 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .bx-pf-tick.on { background: ${BRAND.green}; border-color: ${BRAND.green}; transform: scale(1.08); }
        .bx-pf-num { font-variant-numeric: tabular-nums; text-align: right; }
        .bx-pf-foot { display: flex; justify-content: space-between; padding: 14px 20px; font-size: 13.5px; font-weight: 700; }
        .bx-pf-files { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
        .bx-pf-file { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 12px; padding: 11px 12px; opacity: 0; transform: translateY(8px); transition: opacity 0.35s ease, transform 0.45s cubic-bezier(0.16, 1, 0.3, 1); }
        .bx-pf-file.on { opacity: 1; transform: none; }
        @media (max-width: 420px) {
          .bx-pf-row { grid-template-columns: 22px 1fr auto; }
          .bx-pf-row .bx-pf-tax { display: none; }
        }
      `}</style>

      <div className="bx-pf-card">
        <div className="bx-pf-head">
          <div>
            <div style={{ fontSize: '14.5px', fontWeight: 700, color: INK }}>Lönekörning mars</div>
            <div style={{ fontSize: '12px', color: MUTED }}>Utbetalning 25 mars</div>
          </div>
          <span className="bx-pf-status" style={{
            background: approved ? ACCENT.green.soft : 'var(--mkt-ivory)',
            color: approved ? ACCENT.green.fg : MUTED,
          }}>
            {approved ? 'Godkänd' : 'Utkast'}
          </span>
        </div>

        <div className="bx-pf-row" style={{ padding: '9px 20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED }}>
          <span />
          <span>Anställd</span>
          <span className="bx-pf-num bx-pf-tax">Skatt</span>
          <span className="bx-pf-num">Netto</span>
        </div>
        {ROWS.map((r, i) => {
          const done = i < rowsDone;
          return (
            <div key={r.name} className="bx-pf-row">
              <span className={`bx-pf-tick ${done ? 'on' : ''}`}>
                {done && <Check size={12} color="#fff" strokeWidth={3} />}
              </span>
              <span style={{ color: INK, fontWeight: 600 }}>
                {r.name}
                <span style={{ display: 'block', fontSize: '12px', color: MUTED, fontWeight: 400 }}>Brutto {r.gross} kr</span>
              </span>
              <span className="bx-pf-num bx-pf-tax" style={{ color: MUTED }}>−{r.tax}</span>
              <span className="bx-pf-num" style={{ color: INK, fontWeight: 600 }}>{r.net}</span>
            </div>
          );
        })}
        <div className="bx-pf-foot">
          <span style={{ color: MUTED, fontWeight: 600 }}>Arbetsgivaravgift</span>
          <span className="bx-pf-num" style={{ color: INK }}>32 677 kr</span>
        </div>
      </div>

      <div className="bx-pf-files">
        {FILES.map((f, i) => (
          <div key={f.label} className={`bx-pf-file ${i < filesShown ? 'on' : ''}`}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: INK }}>{f.label}</div>
            <div style={{ fontSize: '11.5px', color: MUTED }}>{f.note}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
