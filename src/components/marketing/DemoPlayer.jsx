import React, { useEffect, useRef, useState } from 'react';
import { BRAND } from '../../utils/brandColors';
import { INK, INK_SOFT, MUTED, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { AppStyles } from './demoApp';

// ── Demospelaren: ett centrerat "appfönster" som spelar upp hur en funktion
// fungerar, steg för steg, som en inspelning. Kundönskemål 2026-09-26:
// animationer i stället för statiska skärmbilder och punktlistor.
//
// Varje steg är { title, body, where, scene }. `scene` är vanlig JSX som
// animerar sig själv med CSS (klasserna .dp-* nedan, fördröjning via
// style={{ '--d': '0.6s' }}). Scenen monteras om varje gång steget byts
// (key), så animationerna startar om från början. En timer byter steg;
// den går bara när spelaren syns på skärmen, och ett klick på ett steg
// hoppar dit och startar om klockan.
//
// prefers-reduced-motion: ingen automatisk uppspelning och inga
// animationer. Alla .dp-*-element har sitt SLUTLÄGE som grundstil, så
// scenen står färdig och läsbar när animationen är avstängd.

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DemoStyles() {
  return (
    <style>{`
      .dp { width: 100%; max-width: 820px; margin: 0 auto; }
      .dp-window { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; box-shadow: 0 30px 70px -34px rgba(15, 23, 42, 0.35), ${CARD_SHADOW}; overflow: hidden; }
      html[data-theme="dark"] #lp-root .dp-window { box-shadow: 0 30px 70px -30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.04); }
      .dp-bar { display: flex; align-items: center; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--mkt-border-soft); background: var(--mkt-ivory); }
      .dp-dots { display: flex; gap: 6px; }
      .dp-dots i { width: 9px; height: 9px; border-radius: 50%; background: var(--mkt-card-border); display: block; }
      .dp-where { flex: 1; text-align: center; font-size: 12px; font-weight: 600; color: ${MUTED}; margin-right: 39px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dp-stage { position: relative; height: clamp(400px, 46vw, 460px); overflow: hidden; }

      .dp-steps { display: grid; gap: 14px; margin-top: 22px; }
      .dp-step { background: none; border: none; padding: 0; text-align: left; cursor: pointer; font-family: inherit; color: ${MUTED}; }
      .dp-step-line { height: 3px; border-radius: 3px; background: var(--mkt-border-soft); overflow: hidden; margin-bottom: 10px; }
      .dp-step-fill { height: 100%; width: 100%; background: ${BRAND.green}; transform-origin: left; transform: scaleX(0); }
      html[data-theme="dark"] #lp-root .dp-step-fill { background: var(--mkt-accent-green-fg); }
      .dp-step.done .dp-step-fill { transform: scaleX(1); }
      .dp-step.on .dp-step-fill { animation: dpFillStep var(--dp-ms) linear both; }
      .dp-step.on.paused .dp-step-fill { animation-play-state: paused; }
      @keyframes dpFillStep { from { transform: scaleX(0); } to { transform: scaleX(1); } }
      .dp-step-title { font-size: 14px; font-weight: 700; line-height: 1.35; transition: color 0.2s; }
      .dp-step.on .dp-step-title, .dp-step:hover .dp-step-title { color: ${INK}; }
      .dp-body { text-align: center; max-width: 600px; margin: 18px auto 0; font-size: 15px; line-height: 1.65; color: ${INK_SOFT}; min-height: 3.3em; }
      .dp-body-in { animation: dpIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
      @media (max-width: 640px) {
        .dp-stage { height: 460px; }
        .dp-steps { gap: 6px; }
        .dp-step-title { display: none; }
        .dp-mobile-title { display: block !important; }
      }

      /* ── Byggklossar för scenerna ── */
      .dp-card { background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 14px; box-shadow: ${CARD_SHADOW}; padding: 16px 18px; width: 100%; max-width: 420px; }
      .dp-label { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; }
      .dp-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--mkt-border-soft); font-size: 13.5px; color: ${INK}; }
      .dp-row:last-child { border-bottom: none; }
      .dp-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .dp-muted { color: ${MUTED}; }
      .dp-strong { font-weight: 700; }
      .dp-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: ${ACCENT.green.fg}; background: ${ACCENT.green.soft}; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
      .dp-tag { display: inline-flex; align-items: center; font-size: 11.5px; font-weight: 700; color: ${MUTED}; border: 1px solid var(--mkt-card-border); padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
      .dp-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-size: 12.5px; font-weight: 700; color: #fff; background: ${BRAND.green}; border-radius: 9px; padding: 8px 14px; white-space: nowrap; }
      .dp-btn-ghost { display: inline-flex; align-items: center; font-size: 12.5px; font-weight: 700; color: ${INK}; border: 1px solid var(--mkt-card-border); border-radius: 9px; padding: 7px 13px; white-space: nowrap; }
      .dp-field { border: 1px solid var(--mkt-card-border); border-radius: 9px; padding: 8px 11px; font-size: 13px; color: ${INK}; min-height: 34px; display: flex; align-items: center; }
      .dp-file { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 700; color: ${INK}; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 10px; padding: 9px 12px; box-shadow: ${CARD_SHADOW}; white-space: nowrap; }
      .dp-code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; }
      .dp-stack { display: flex; flex-direction: column; gap: 12px; align-items: center; width: 100%; }
      .dp-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; width: 100%; max-width: 640px; align-items: center; }
      @media (max-width: 640px) { .dp-split { grid-template-columns: 1fr; gap: 12px; } .dp-hide-sm { display: none !important; } }

      /* Rörelser. Grundstilen är slutläget; animationen spelar fram dit. */
      .dp-in { animation: dpIn 0.55s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s) both; }
      .dp-pop { animation: dpPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) var(--d, 0s) both; }
      .dp-slide { animation: dpSlide 0.6s cubic-bezier(0.16, 1, 0.3, 1) var(--d, 0s) both; }
      .dp-type { display: inline-block; overflow: hidden; white-space: nowrap; vertical-align: bottom; animation: dpType var(--t, 0.9s) steps(var(--n, 16)) var(--d, 0s) both; }
      .dp-grow { transform-origin: left; animation: dpGrow var(--t, 1.2s) cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s) both; }
      .dp-press { animation: dpPress 0.5s ease var(--d, 0s) both; }
      .dp-flash { animation: dpFlash 1.4s ease var(--d, 0s) both; border-radius: 8px; }
      .dp-gone { animation: dpGone 0.45s ease var(--d, 0s) both; }
      .dp-collapse { overflow: hidden; animation: dpCollapse 0.45s ease var(--d, 0s) both; }
      @keyframes dpCollapse { from { max-height: var(--h, 60px); } to { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; border-bottom-width: 0; } }
      .dp-collapse-x { overflow: hidden; white-space: nowrap; animation: dpCollapseX 0.4s ease var(--d, 0s) both; }
      @keyframes dpCollapseX { from { max-width: 220px; } to { max-width: 0; opacity: 0; padding-left: 0; padding-right: 0; } }
      .dp-strike { position: relative; }
      .dp-strike::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1.5px; background: currentColor; transform-origin: left; animation: dpGrow 0.4s ease var(--d, 0s) both; }
      .dp-spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--mkt-border-soft); border-top-color: ${BRAND.green}; animation: dpSpin 0.8s linear infinite, dpGone 0.3s ease var(--d, 1s) both; }
      .dp-swap { display: inline-grid; justify-items: end; }
      .dp-swap > * { grid-area: 1 / 1; }
      .dp-paper { position: relative; overflow: hidden; background: #fbfaf6; color: #1c2420; border-radius: 6px; padding: 16px 18px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; line-height: 1.7; box-shadow: 0 10px 30px -14px rgba(0,0,0,0.35); width: 100%; max-width: 230px; }
      .dp-scan { position: absolute; left: 0; right: 0; height: 26px; margin-top: -13px; background: linear-gradient(180deg, transparent, color-mix(in srgb, ${BRAND.green} 35%, transparent), transparent); animation: dpScan 1.8s cubic-bezier(0.45, 0, 0.55, 1) var(--d, 0s) both; pointer-events: none; }
      @keyframes dpScan { from { top: 0; opacity: 1; } 90% { opacity: 1; } to { top: 100%; opacity: 0; } }
      @keyframes dpIn { from { opacity: 0; transform: translateY(10px); } }
      @keyframes dpPop { from { opacity: 0; transform: scale(0.6); } }
      @keyframes dpSlide { from { opacity: 0; transform: translateX(-24px); } }
      @keyframes dpType { from { max-width: 0; } to { max-width: 40ch; } }
      @keyframes dpGrow { from { transform: scaleX(0); } }
      @keyframes dpPress { 0%, 100% { transform: none; } 45% { transform: scale(0.92); box-shadow: 0 0 0 6px color-mix(in srgb, ${BRAND.green} 25%, transparent); } }
      @keyframes dpFlash { 0% { background: transparent; } 25% { background: ${ACCENT.green.soft}; } 100% { background: transparent; } }
      @keyframes dpGone { to { opacity: 0; transform: scale(0.96); visibility: hidden; } }
      @keyframes dpSpin { to { transform: rotate(360deg); } }

      @media (prefers-reduced-motion: reduce) {
        .dp-in, .dp-pop, .dp-slide, .dp-type, .dp-grow, .dp-press, .dp-flash, .dp-strike::after, .dp-body-in, .dp-step.on .dp-step-fill { animation: none !important; }
        .dp-gone, .dp-spin, .dp-scan, .dp-collapse, .dp-collapse-x { display: none; }
      }
    `}</style>
  );
}

export default function DemoPlayer({ steps, stepMs = 5600, label }) {
  const [active, setActive] = useState(0);
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const [still, setStill] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) { setStill(true); return undefined; }
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); return undefined; }
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (still || !inView) return undefined;
    const t = setTimeout(() => {
      setActive(a => (a + 1) % steps.length);
      setRun(r => r + 1);
    }, stepMs);
    return () => clearTimeout(t);
  }, [active, run, inView, still, stepMs, steps.length]);

  const go = (i) => { setActive(i); setRun(r => r + 1); };
  const step = steps[active];
  const playing = inView && !still;

  return (
    <div ref={rootRef} className="dp" aria-label={label} style={{ '--dp-ms': `${stepMs}ms` }}>
      <AppStyles />
      <div className="dp-window">
        <div className="dp-bar">
          <span className="dp-dots" aria-hidden><i /><i /><i /></span>
          <span className="dp-where">{step.where}</span>
        </div>
        {/* Scenen monteras bara när spelaren har synts en gång (eller är
            stillastående), så animationerna inte hinner spelas klart
            utanför skärmen. Innan dess står ett tomt fönster av samma höjd. */}
        <div className="dp-stage" key={`${active}-${run}-${playing || still ? 1 : 0}`}>
          {(playing || still || run > 0) ? step.scene : null}
        </div>
      </div>

      <div className="dp-steps" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }} role="tablist">
        {steps.map((s, i) => (
          <button
            key={s.title} type="button" role="tab" aria-selected={i === active}
            className={`dp-step${i === active ? ' on' : ''}${i < active ? ' done' : ''}${!playing ? ' paused' : ''}`}
            onClick={() => go(i)}
          >
            <div className="dp-step-line"><div key={i === active ? `${run}-${playing}` : 'x'} className="dp-step-fill" /></div>
            <div className="dp-step-title">{s.title}</div>
          </button>
        ))}
      </div>
      <div key={`b${active}`} className="dp-body dp-body-in">
        <strong className="dp-mobile-title" style={{ display: 'none', color: INK, marginBottom: '4px' }}>{step.title}</strong>
        {step.body}
      </div>
    </div>
  );
}

/** Monterar barnen först när de syns på skärmen, så en engångsanimation
 * spelas för besökaren och inte utanför bild. */
export function PlayOnView({ children, minHeight }) {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || prefersReducedMotion()) { setSeen(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="dp-onview" style={{ minHeight }}>{seen ? children : null}</div>;
}
