import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { INK, INK_SOFT, MUTED } from './marketingTokens';

// ── "Kvittot läser sig självt"-animationen (OCR) ────────────────────────
// Kundönskemål, uttryckligt: OCR-läsningen av kvitton ska synas på
// startsidan som en egen, "super cool" animation — inte bara en textrad i
// "Det här får du"-kortet (den raden finns kvar, det här är UTÖVER den).
//
// Samma rörelsevokabulär och säkerhetsregler som BankFlow.jsx/
// MigrationFlow.jsx redan lägger fast för startsidans andra animationer:
//   - Startar bara när den syns (IntersectionObserver, samma useCycle-
//     mönster som featureDemos.jsx), och står stilla vid
//     prefers-reduced-motion — men visar då SISTA läget (allt ifyllt),
//     aldrig ett tomt kvitto.
//   - Fälten som visas (Datum/Belopp/Moms/Konto) och märkningen med en
//     liten OCR-badge är EXAKT vad utils/ocrReceipt.js faktiskt läser ut
//     och vad Expenses.jsx:s OcrBadge faktiskt visar — ingen påhittad
//     funktionalitet.
const CYCLE_MS = 1050;
const STEPS = 5; // 0 = strålen längst upp, inget ifyllt … 4 = allt ifyllt + bokfört

const RECEIPT_LINES = [
  { w: '78%' }, { w: '52%' }, { w: '64%' }, { w: '40%' }, { w: '70%' }, { w: '46%' },
];

const FIELDS = [
  { label: 'Datum', value: '14 mar 2026' },
  { label: 'Belopp', value: '842,50 kr' },
  { label: 'Moms', value: '25 %' },
  { label: 'Konto', value: '5611 Drivmedel' },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Samma synlighets-/reducerad-rörelse-mönster som featureDemos.jsx:s
 *  useCycle, egen kopia hellre än en delad import — den här cyklar en
 *  bråkdel snabbare (CYCLE_MS) och har ett annat antal steg, och de två
 *  filerna hör inte ihop funktionellt. */
function useReceiptCycle() {
  const ref = useRef(null);
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) { setReduced(true); setStep(STEPS - 1); }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return undefined;
    const t = setInterval(() => setStep(prev => (prev + 1) % STEPS), CYCLE_MS);
    return () => clearInterval(t);
  }, [visible, reduced]);

  return [ref, step];
}

export default function ReceiptFlow() {
  const [ref, step] = useReceiptCycle();
  const filled = Math.max(0, step); // steg 0 → 0 fält ifyllda, steg 4 → alla fyra

  return (
    <div className="bx-ocr" ref={ref}>
      <style>{`
        .bx-ocr { display: flex; align-items: center; justify-content: center; gap: clamp(14px, 3.4vw, 30px); width: 100%; max-width: min(94%, 640px); margin: 0 auto; flex-wrap: nowrap; }

        /* Kvittot: vitt papper med en sicksackad nederkant (repeating-
           linear-gradient som en mask) — läser omedelbart som "kvitto",
           inte "generiskt kort". */
        .bx-ocr-receipt {
          position: relative; flex-shrink: 0; width: clamp(108px, 15vw, 158px);
          padding: 16px 14px 20px; background: #fff; border: 1px solid var(--mkt-card-border);
          border-radius: 6px 6px 0 0; box-shadow: var(--mkt-card-shadow); overflow: hidden;
        }
        .bx-ocr-receipt::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 10px;
          background: repeating-linear-gradient(-45deg, #fff 0 6px, transparent 6px 12px), var(--mkt-page-bg, #fff);
          -webkit-mask: repeating-linear-gradient(-45deg, #000 0 6px, transparent 6px 12px);
          mask: repeating-linear-gradient(-45deg, #000 0 6px, transparent 6px 12px);
        }
        .bx-ocr-line { height: 4px; border-radius: 2px; background: var(--mkt-card-border); margin-bottom: 8px; }
        .bx-ocr-line:last-child { margin-bottom: 0; }

        /* Strålen: sveper nedåt i takt med steg-numret, glöder i loggans
           gradient. transition (inte keyframes) eftersom positionen styrs
           av React-state, precis som ledgerraderna i BankFlow. */
        .bx-ocr-beam {
          position: absolute; left: 4px; right: 4px; height: 14px; border-radius: 3px;
          background: linear-gradient(90deg, transparent, rgba(14,165,233,0.55), rgba(20,184,166,0.65), rgba(132,204,22,0.55), transparent);
          filter: blur(1.5px); box-shadow: 0 0 10px 1px rgba(20,184,166,0.45);
          transition: top 0.55s cubic-bezier(0.45, 0, 0.55, 1), opacity 0.3s;
        }

        /* Pilen mellan kvitto och fält — kort, ingen ledning behövs på så
           kort avstånd (till skillnad från BankFlow:s längre resa). */
        .bx-ocr-arrow { flex-shrink: 0; color: var(--mkt-muted); }

        /* Fältformuläret. Samma radspråk som featureDemos.jsx:s .bx-fd-row,
           egen liten klass hellre än delad — annars hade en ändring i
           featureDemos.jsx:s delade stilar av misstag kunnat påverka den
           här animationen som ligger i en helt annan fil. */
        .bx-ocr-form { flex: 1 1 auto; min-width: 0; max-width: 260px; display: flex; flex-direction: column; gap: 7px; }
        .bx-ocr-row {
          display: flex; align-items: center; gap: 8px; background: var(--mkt-card-bg);
          border: 1px solid var(--mkt-card-border); border-radius: 9px; padding: 7px 10px;
          opacity: 0; transform: translateX(-5px);
          transition: opacity 0.4s, transform 0.4s cubic-bezier(0.22,1,0.36,1), border-color 0.4s;
        }
        .bx-ocr-row-in { opacity: 1; transform: none; border-color: ${BRAND.green}; }
        .bx-ocr-row-label { font-size: 11px; font-weight: 700; color: var(--mkt-muted); flex-shrink: 0; }
        .bx-ocr-row-value { margin-left: auto; font-size: 12px; font-weight: 800; color: var(--mkt-ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bx-ocr-row-check { flex-shrink: 0; color: ${BRAND.green}; opacity: 0; transform: scale(0.7); transition: opacity 0.3s, transform 0.3s cubic-bezier(0.22,1,0.36,1); }
        .bx-ocr-row-in .bx-ocr-row-check { opacity: 1; transform: none; }

        .bx-ocr-done {
          display: inline-flex; align-items: center; gap: 5px; align-self: flex-start; margin-top: 2px;
          padding: 4px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 800;
          background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg);
          opacity: 0; transition: opacity 0.4s;
        }
        .bx-ocr-done-in { opacity: 1; }

        @media (max-width: 480px) {
          .bx-ocr { gap: 10px; }
          .bx-ocr-receipt { width: 92px; padding: 13px 11px 17px; }
          .bx-ocr-form { max-width: 190px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .bx-ocr-beam { transition: none; opacity: 0; }
          .bx-ocr-row, .bx-ocr-row-check, .bx-ocr-done { transition: none; }
        }
      `}</style>

      <div className="bx-ocr-receipt">
        {RECEIPT_LINES.map((l, i) => <div key={i} className="bx-ocr-line" style={{ width: l.w }} />)}
        <div className="bx-ocr-beam" aria-hidden style={{ top: `${8 + Math.min(step, 3) * 22}%`, opacity: step >= 4 ? 0 : 1 }} />
      </div>

      <svg className="bx-ocr-arrow" width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden>
        <path d="M0 7h17M12 1l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      <div className="bx-ocr-form">
        {FIELDS.map((f, i) => {
          const on = filled > i;
          return (
            <div key={f.label} className={`bx-ocr-row${on ? ' bx-ocr-row-in' : ''}`}>
              <span className="bx-ocr-row-label">{f.label}</span>
              <span className="bx-ocr-row-value">{on ? f.value : '—'}</span>
              <Check size={13} strokeWidth={3} className="bx-ocr-row-check" />
            </div>
          );
        })}
        <span className={`bx-ocr-done${step >= 4 ? ' bx-ocr-done-in' : ''}`}>
          <Check size={11} strokeWidth={3} /> Bokfört
        </span>
      </div>
    </div>
  );
}
