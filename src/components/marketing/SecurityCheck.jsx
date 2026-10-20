import React, { useEffect, useState } from 'react';
import { Check } from '../icons';
import { BRAND } from '../../utils/brandColors';
import { INK, MUTED, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';

// ── Hjälten på /sakerhet: en inloggning som kontrolleras steg för steg.
// Varje rad motsvarar något som finns i koden (samma regel som
// SecurityPage): TOTP-tvåfaktor (supabase.auth.mfa), radnivåskydd i
// databasen (RLS), sessionen i sessionStorage, datacenter i Stockholm.
const STEP_MS = 900;
const CODE = ['4', '8', '2', '1', '9', '0'];

const CHECKS = [
  { label: 'Lösenord', note: 'Rätt' },
  { label: 'Tvåfaktorkod', note: null },
  { label: 'Behörighet i databasen', note: 'Bara ditt företag' },
  { label: 'Session', note: 'Bara den här fliken' },
];

// Steg 0: inget. 1: lösenord. 2–3: koden skrivs. 4: koden godkänd.
// 5: behörighet. 6: session. 7–9: vila, sedan om.
const STEPS = 10;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function SecurityCheck() {
  const [step, setStep] = useState(STEPS - 2);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    setStep(0);
    const t = setInterval(() => setStep(s => (s + 1) % STEPS), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const digits = step <= 1 ? 0 : step === 2 ? 3 : 6;
  const done = [step >= 1, step >= 4, step >= 5, step >= 6];
  const allDone = step >= 6;

  return (
    <div className="bx-sc" aria-label="Exempel: så kontrolleras en inloggning i Bokix">
      <style>{`
        .bx-sc { width: 100%; max-width: 440px; margin: 0 auto; background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; box-shadow: ${CARD_SHADOW}; overflow: hidden; }
        .bx-sc-row { display: grid; grid-template-columns: 26px 1fr auto; gap: 14px; align-items: center; padding: 16px 22px; border-bottom: 1px solid var(--mkt-border-soft); font-size: 14px; }
        .bx-sc-tick { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid var(--mkt-card-border); display: flex; align-items: center; justify-content: center; transition: background 0.25s ease, border-color 0.25s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .bx-sc-tick.on { background: ${BRAND.green}; border-color: ${BRAND.green}; transform: scale(1.06); }
        .bx-sc-note { font-size: 12.5px; color: ${MUTED}; transition: opacity 0.3s ease; }
        .bx-sc-code { display: inline-flex; gap: 4px; }
        .bx-sc-digit { width: 18px; height: 24px; border-radius: 5px; border: 1px solid var(--mkt-border-soft); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: ${INK}; font-variant-numeric: tabular-nums; transition: border-color 0.2s ease; }
        .bx-sc-foot { display: flex; justify-content: space-between; align-items: center; padding: 14px 22px; font-size: 12.5px; color: ${MUTED}; }
        .bx-sc-state { font-weight: 700; padding: 4px 10px; border-radius: 999px; transition: background 0.3s ease, color 0.3s ease; }
      `}</style>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--mkt-border-soft)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>
        Inloggning
      </div>
      {CHECKS.map((c, i) => (
        <div key={c.label} className="bx-sc-row">
          <span className={`bx-sc-tick ${done[i] ? 'on' : ''}`}>{done[i] && <Check size={12} color="#fff" strokeWidth={3} />}</span>
          <span style={{ color: INK, fontWeight: 600 }}>{c.label}</span>
          {i === 1 ? (
            <span className="bx-sc-code" aria-hidden>
              {CODE.map((d, k) => (
                <span key={k} className="bx-sc-digit" style={{ borderColor: k < digits ? 'var(--mkt-card-border)' : undefined }}>{k < digits ? d : ''}</span>
              ))}
            </span>
          ) : (
            <span className="bx-sc-note" style={{ opacity: done[i] ? 1 : 0 }}>{c.note}</span>
          )}
        </div>
      ))}
      <div className="bx-sc-foot">
        <span>Lagras i Sverige</span>
        <span className="bx-sc-state" style={{ background: allDone ? ACCENT.green.soft : 'var(--mkt-ivory)', color: allDone ? ACCENT.green.fg : MUTED }}>
          {allDone ? 'Inloggad' : 'Kontrollerar'}
        </span>
      </div>
    </div>
  );
}
