import React, { useEffect, useRef, useState } from 'react';
import { SERIF } from './marketingTokens';
import { Check } from '../icons';

// ── Animerade bilder för bolagsformssidorna (OrgTypePage.jsx) ───────────
// En bild per bolagsform som visar det som är speciellt för just den:
//   enskild firma   kvittot blir NE-bilaga
//   aktiebolag      resultaträkning, INK2 och årsredovisning som skrivs under
//   handelsbolag    årets resultat delas på delägarna
//   ek. förening    kassör, ordförande och revisor i samma bokföring
// Bilderna stegar fram i en loop medan de syns och pausar utanför skärmen.
// Förrenderat (och med reducerad rörelse) visas slutläget direkt, så att
// sidan aldrig ser tom ut. Beloppen är exempel, inte riktiga företag.

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const kr = (n) => `${Math.round(n).toLocaleString('sv-SE')} kr`;

/** Stegräknare 0..steps i loop medan elementet syns. Startar i slutläget. */
function useStepLoop(steps, stepMs = 1100, holdMs = 3200) {
  const ref = useRef(null);
  const [step, setStep] = useState(steps);
  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return undefined;
    let timer = null;
    let current = 0;
    const tick = () => {
      current = current >= steps ? 0 : current + 1;
      setStep(current);
      timer = setTimeout(tick, current === steps ? holdMs : stepMs);
    };
    // Utanför skärmen: pausa och visa slutläget, så att bilden aldrig
    // fastnar halvvägs. Tillbaka i bild: börja om från början.
    const io = new IntersectionObserver(([e]) => {
      clearTimeout(timer);
      if (e.isIntersecting) { current = 0; setStep(0); timer = setTimeout(tick, 500); }
      else setStep(steps);
    }, { threshold: 0.2 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(timer); };
  }, [steps, stepMs, holdMs]);
  return [ref, step];
}

/** Räknar upp till `value` när `on` blir sant. */
function CountUp({ value, on, ms = 900, format = kr }) {
  const [shown, setShown] = useState(on ? value : 0);
  useEffect(() => {
    if (!on) { setShown(0); return undefined; }
    if (prefersReducedMotion()) { setShown(value); return undefined; }
    let raf; const t0 = performance.now();
    const run = (t) => { const p = Math.min(1, (t - t0) / ms); setShown(value * (1 - Math.pow(1 - p, 3))); if (p < 1) raf = requestAnimationFrame(run); };
    raf = requestAnimationFrame(run);
    return () => cancelAnimationFrame(raf);
  }, [on, value, ms]);
  return <>{format(shown)}</>;
}

function VisualStyles() {
  return (
    <style>{`
      .ov { position: relative; display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-width: 0; }
      .ov-card { background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); border-radius: 18px; box-shadow: var(--mkt-card-shadow); padding: 18px 20px; }
      .ov-title { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mkt-muted); margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
      .ov-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 0; border-top: 1px solid var(--mkt-border-soft); font-size: 14.5px; color: var(--mkt-ink-soft); }
      .ov-row:first-of-type { border-top: 0; }
      .ov-row b { color: var(--mkt-ink); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
      .ov-total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 8px; padding-top: 10px; border-top: 2px solid var(--mkt-ink); }
      .ov-total span { font-size: 14px; font-weight: 700; color: var(--mkt-ink); }
      .ov-total strong { font-family: ${SERIF}; font-size: 26px; color: var(--mkt-accent-green-fg); font-variant-numeric: tabular-nums; }
      .ov-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--mkt-accent-green-fg); background: var(--mkt-accent-green-soft); padding: 4px 10px; border-radius: 999px; white-space: nowrap; }
      .ov-tick { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg); flex: none; }
      .ov-note { font-size: 13px; color: var(--mkt-muted); text-align: center; }
      .ov-arrow { display: flex; justify-content: center; color: var(--mkt-muted); }
      .ov-arrow svg { width: 26px; height: 26px; }
      /* Steg: dolt tills det är dags, sedan glider det in. */
      .ov-step { transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
      .ov-step.off { opacity: 0; transform: translateY(10px); }
      .ov-step.on { opacity: 1; transform: none; }
      .ov-dim { transition: opacity 0.4s ease; }
      .ov-dim.off { opacity: 0.25; }
      .ov-bar { height: 8px; border-radius: 999px; background: var(--mkt-border-soft); overflow: hidden; margin-top: 8px; }
      .ov-bar i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16); transition: width 0.9s cubic-bezier(0.16, 1, 0.3, 1); }
      .ov-sign path { stroke-dasharray: 260; transition: stroke-dashoffset 1.4s ease; }
      .ov-grid2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
      .ov-grid2 .ov-chip { white-space: normal; }
      .ov-grid2 .ov-title { white-space: nowrap; letter-spacing: 0.04em; }
      .ov-doc { display: flex; align-items: center; gap: 12px; }
      .ov-doc-ico { width: 38px; height: 46px; border-radius: 7px; border: 1.5px solid var(--mkt-border-soft); display: flex; align-items: flex-end; justify-content: center; padding-bottom: 6px; font-size: 9.5px; font-weight: 800; color: var(--mkt-muted); flex: none; background: var(--mkt-page-bg); }
      .ov-doc-name { font-size: 15px; font-weight: 700; color: var(--mkt-ink); }
      .ov-doc-sub { font-size: 12.5px; color: var(--mkt-muted); }
      .ov-people { position: relative; height: 330px; }
      .ov-people svg.lines { position: absolute; inset: 0; width: 100%; height: 100%; }
      .ov-people svg.lines path { stroke-dasharray: 6 7; animation: ovDash 1.6s linear infinite; }
      @keyframes ovDash { to { stroke-dashoffset: -26; } }
      .ov-person { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 6px; width: 104px; text-align: center; }
      .ov-avatar { width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #fff; box-shadow: 0 8px 20px -8px rgba(0,0,0,0.4); }
      .ov-person span { font-size: 13px; font-weight: 700; color: var(--mkt-ink); }
      .ov-ledger { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 200px; padding: 14px 16px; }
      @media (max-width: 480px) { .ov-ledger { width: 172px; padding: 12px 13px; } .ov-person { width: 86px; } }
      @media (prefers-reduced-motion: reduce) {
        .ov-step, .ov-dim, .ov-bar i, .ov-sign path { transition: none !important; }
        .ov-people svg.lines path { animation: none; }
      }
    `}</style>
  );
}

const Arrow = () => (
  <div className="ov-arrow" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16M6 14l6 6 6-6" /></svg></div>
);
const cls = (on) => `ov-step ${on ? 'on' : 'off'}`;

// ── Enskild firma: kvitto → NE-bilaga ───────────────────────────────────
function SoleProprietorVisual() {
  const [ref, step] = useStepLoop(4);
  return (
    <div ref={ref} className="ov" role="img" aria-label="Exempel: ett kvitto läses av och beloppen hamnar i NE-bilagan, där överskottet räknas fram">
      <div className="ov-card">
        <div className="ov-title">Kvitto <span className={`ov-chip ${cls(step >= 1)}`}><Check size={12} /> Avläst</span></div>
        <div className="ov-row">Kontorsmaterial <b>499 kr</b></div>
        <div className="ov-row">Varav moms 25 % <b>99,80 kr</b></div>
      </div>
      <div className={cls(step >= 2)}><Arrow /></div>
      <div className={`ov-card ${cls(step >= 2)}`}>
        <div className="ov-title">NE-bilaga <span>2026</span></div>
        <div className="ov-row">R1 Försäljning <b><CountUp value={412000} on={step >= 2} /></b></div>
        <div className="ov-row">R5 Varor och material <b>−<CountUp value={38400} on={step >= 2} /></b></div>
        <div className="ov-row">R6 Övriga kostnader <b>−<CountUp value={52900} on={step >= 2} /></b></div>
        <div className={`ov-total ${cls(step >= 3)}`}><span>Överskott</span><strong><CountUp value={320700} on={step >= 3} /></strong></div>
      </div>
      <div className={`ov-note ${cls(step >= 4)}`}>Förslag ur bokföringen. Du lämnar in med BankID.</div>
    </div>
  );
}

// ── Aktiebolag: bokföring → INK2 → årsredovisning som skrivs under ──────
function CompanyVisual() {
  const [ref, step] = useStepLoop(4);
  const docs = [
    { ico: 'RR', name: 'Resultaträkning', sub: 'Årets resultat 186 400 kr' },
    { ico: 'INK2', name: 'INK2 med SRU-fil', sub: 'Till Skatteverket' },
    { ico: 'K2', name: 'Årsredovisning K2', sub: 'PDF att skriva under' },
  ];
  return (
    <div ref={ref} className="ov" role="img" aria-label="Exempel: resultaträkning, INK2 och årsredovisning enligt K2 tas fram ur bokföringen och styrelsen skriver under">
      {docs.map((d, i) => (
        <div key={d.name} className={`ov-card ov-doc ${cls(step >= i)}`}>
          <div className="ov-doc-ico">{d.ico}</div>
          <div style={{ flex: 1 }}>
            <div className="ov-doc-name">{d.name}</div>
            <div className="ov-doc-sub">{d.sub}</div>
          </div>
          <span className={`ov-tick ${cls(step >= i + 1)}`}><Check size={13} /></span>
        </div>
      ))}
      <div className={`ov-card ${cls(step >= 3)}`} style={{ paddingTop: 14 }}>
        <div className="ov-title">Styrelsen skriver under</div>
        <svg className="ov-sign" viewBox="0 0 260 56" style={{ width: '100%', height: 56 }} aria-hidden>
          <path d="M8 40 C 30 6, 44 52, 62 26 S 92 10, 104 34 S 132 48, 150 22 S 186 14, 196 36 C 206 50, 228 30, 252 24" fill="none" stroke="var(--mkt-ink)" strokeWidth="2.6" strokeLinecap="round" style={{ strokeDashoffset: step >= 3 ? 0 : 260 }} />
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
          <span className="ov-doc-sub">Senast 7 månader efter året</span>
          <span className={`ov-chip ${cls(step >= 4)}`}>Utdelning bokförd</span>
        </div>
      </div>
    </div>
  );
}

// ── Handelsbolag: årets resultat delas på delägarna ─────────────────────
function PartnershipVisual() {
  const [ref, step] = useStepLoop(3);
  const total = 240000;
  return (
    <div ref={ref} className="ov" role="img" aria-label="Exempel: årets resultat på 240 000 kr delas lika mellan två delägare, som deklarerar sin andel själva">
      <div className="ov-card" style={{ textAlign: 'center' }}>
        <div className="ov-title" style={{ justifyContent: 'center' }}>Årets resultat i bolaget</div>
        <div style={{ fontFamily: SERIF, fontSize: 34, fontWeight: 700, color: 'var(--mkt-ink)' }}><CountUp value={total} on={step >= 0} /></div>
        <div className="ov-doc-sub">Bolaget betalar ingen egen inkomstskatt</div>
      </div>
      <div className={cls(step >= 1)}>
        <svg viewBox="0 0 300 40" style={{ width: '100%', height: 40, display: 'block' }} aria-hidden>
          <path d="M150 0 V14 Q150 20 144 20 H82 Q76 20 76 26 V40 M150 14 Q150 20 156 20 H218 Q224 20 224 26 V40" fill="none" stroke="var(--mkt-muted)" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="ov-grid2">
        {['Delägare A', 'Delägare B'].map(name => (
          <div key={name} className={`ov-card ${cls(step >= 1)}`}>
            <div className="ov-title">{name} <span>50 %</span></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--mkt-ink)', fontVariantNumeric: 'tabular-nums' }}><CountUp value={total / 2} on={step >= 1} /></div>
            <div className="ov-bar"><i style={{ width: step >= 1 ? '50%' : '0%' }} /></div>
            <div style={{ marginTop: 10 }}><span className={`ov-chip ${cls(step >= 2)}`}>N3A i egen deklaration</span></div>
          </div>
        ))}
      </div>
      <div className={`ov-note ${cls(step >= 3)}`}>Resultatet förs till delägarnas kapitalkonton vid bokslutet.</div>
    </div>
  );
}

// ── Ekonomisk förening: hela styrelsen i samma bokföring ────────────────
function AssociationVisual() {
  const [ref, step] = useStepLoop(3);
  const people = [
    { name: 'Kassör', letter: 'K', bg: '#0ea5e9', style: { left: 0, top: 0 } },
    { name: 'Ordförande', letter: 'O', bg: '#14b8a6', style: { right: 0, top: 0 } },
    { name: 'Revisor', letter: 'R', bg: '#65a30d', style: { left: '50%', bottom: 0, transform: 'translateX(-50%)' } },
  ];
  return (
    <div ref={ref} className="ov" role="img" aria-label="Exempel: kassör, ordförande och revisor arbetar i samma bokföring, revisorn granskar och INK2 blir klar">
      <div className="ov-people">
        <svg className="lines" viewBox="0 0 400 330" preserveAspectRatio="none" aria-hidden>
          <path d="M60 30 L200 165" fill="none" stroke="var(--mkt-muted)" strokeWidth="2" />
          <path d="M340 30 L200 165" fill="none" stroke="var(--mkt-muted)" strokeWidth="2" />
          <path d="M200 262 L200 165" fill="none" stroke="var(--mkt-muted)" strokeWidth="2" />
        </svg>
        {people.map((p, i) => (
          <div key={p.name} className={`ov-person ${cls(step >= Math.min(i, 1))}`} style={p.style}>
            <div className="ov-avatar" style={{ background: p.bg }}>{p.letter}</div>
            <span>{p.name}{p.name === 'Revisor' && step >= 2 ? ' ✓' : ''}</span>
          </div>
        ))}
        <div className="ov-card ov-ledger">
          <div className="ov-title" style={{ marginBottom: 6 }}>Föreningens bokföring</div>
          <div className="ov-row" style={{ fontSize: 13 }}>Intäkter <b><CountUp value={964000} on={step >= 0} /></b></div>
          <div className="ov-row" style={{ fontSize: 13 }}>Resultat <b><CountUp value={58200} on={step >= 0} /></b></div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className={`ov-chip ${cls(step >= 2)}`}><Check size={12} /> Revisorn har granskat</span>
        <span className={`ov-chip ${cls(step >= 3)}`}><Check size={12} /> INK2 klar</span>
      </div>
    </div>
  );
}

// ── Om oss: samma köp, två sätt ─────────────────────────────────────────
// Vänster: så ser ett köp ut i en vanlig konteringstabell. Höger: samma köp
// i Bokix enkla läge. Beloppen stämmer (499 kr med 25 % moms).
export function AboutVisual() {
  const [ref, step] = useStepLoop(4);
  const rows = [['6110 Kontorsmateriel', '399,20', ''], ['2641 Ingående moms', '99,80', ''], ['1930 Företagskonto', '', '499,00']];
  return (
    <>
      <VisualStyles />
      <div ref={ref} className="ov" role="img" aria-label="Exempel: ett köp av kontorsmaterial för 499 kronor, först som konton med debet och kredit, sedan som det ser ut i Bokix">
        <div className="ov-card">
          <div className="ov-title">Vanlig bokföring <span>Debet · Kredit</span></div>
          {rows.map(([acc, d, k], i) => (
            <div key={acc} className={`ov-row ${cls(step >= 0)}`} style={{ transitionDelay: `${i * 120}ms` }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{acc}</span>
              <b>{d || '·'} <span style={{ color: 'var(--mkt-muted)', fontWeight: 500 }}>/</span> {k || '·'}</b>
            </div>
          ))}
          <div className="ov-doc-sub" style={{ marginTop: 8 }}>Du behöver veta kontonummer och vilken sida beloppet ska stå på.</div>
        </div>
        <div className={cls(step >= 1)}><Arrow /></div>
        <div className={`ov-card ${cls(step >= 1)}`}>
          <div className="ov-title">I Bokix</div>
          <div className="ov-row">Vad har hänt? <b>Jag har köpt något</b></div>
          <div className="ov-row">Belopp <b><CountUp value={499} on={step >= 2} /></b></div>
          <div className="ov-row">Vad köpte du? <b>Kontorsmaterial</b></div>
          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="ov-doc-sub">Kontona och momsen sköts åt dig.</span>
            <span className={`ov-chip ${cls(step >= 3)}`}><Check size={12} /> Bokfört</span>
          </div>
        </div>
      </div>
    </>
  );
}

const VISUALS = {
  'enskild-firma': SoleProprietorVisual,
  aktiebolag: CompanyVisual,
  handelsbolag: PartnershipVisual,
  'ekonomisk-forening': AssociationVisual,
};

export default function OrgTypeVisual({ slug }) {
  const Visual = VISUALS[slug];
  if (!Visual) return null;
  return (
    <>
      <VisualStyles />
      <Visual />
    </>
  );
}
