import React, { useEffect, useRef, useState } from 'react';
import { Check, AlertCircle, FileText, Landmark } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';

// ── Levande demos för funktionssidans fyra delar ────────────────────────
// Sidan hade EN animerad bild högst upp och fyra stillastående teckningar
// under. Kundens invändning i sak: det är i funktionerna rörelsen betyder
// något — "cool animations with the functions".
//
// Varje demo visar det som faktiskt händer i just den delen av appen, med
// siffror som går ihop:
//   Bokföring   — det säkra bokförs, det osäkra hamnar i Granskning.
//   Fakturering — samma faktura i de fyra mallar som finns i produkten.
//   Skatt       — momsrutorna fylls, och 59 125 − 9 199 = 49 926.
//   Personal    — 32 000 brutto, 7 040 i skatt, 24 960 netto.
//
// Regler för alla fyra:
//  - De startar först när de syns (IntersectionObserver) — fyra klockor
//    som tickar i bakgrunden på en sida ingen tittar på är bara batteri.
//  - De står helt still vid prefers-reduced-motion, men visar sitt SISTA
//    läge, inte ett tomt. En stillbild ska vara lika informativ.
//  - Ingen text här lovar något appen inte gör.

/** Går runt i `steps` steg, men bara när elementet syns. Returnerar
 *  [ref, aktivt steg]. Vid reducerad rörelse står den på sista steget. */
function useCycle(steps, ms) {
  const ref = useRef(null);
  const [i, setI] = useState(0);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setReduced(true);
      setI(steps - 1);
    }
  }, [steps]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setVisible(true); return undefined; }
    const io = new IntersectionObserver(entries => setVisible(entries.some(e => e.isIntersecting)), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || reduced) return undefined;
    const t = setInterval(() => setI(prev => (prev + 1) % steps), ms);
    return () => clearInterval(t);
  }, [visible, reduced, steps, ms]);

  return [ref, i];
}

/** Delade stilar för alla fyra demos. Renderas EN gång på sidan. */
export function FeatureDemoStyles() {
  return (
    <style>{`
      .bx-fd {
        width: 100%; display: flex; flex-direction: column; gap: 8px;
        font-size: 12px; line-height: 1.4;
      }
      .bx-fd-row {
        display: flex; align-items: center; gap: 9px;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
        border-radius: 10px; padding: 9px 11px;
        opacity: 0; transform: translateY(6px);
        transition: opacity 0.45s, transform 0.45s cubic-bezier(0.22,1,0.36,1), border-color 0.45s;
      }
      .bx-fd-row-in { opacity: 1; transform: none; }
      .bx-fd-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mkt-ink-soft); font-weight: 600; }
      .bx-fd-tag {
        margin-left: auto; display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
        padding: 3px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 800;
        opacity: 0; transform: scale(0.9); transition: opacity 0.35s, transform 0.35s cubic-bezier(0.22,1,0.36,1);
      }
      .bx-fd-tag-in { opacity: 1; transform: none; }
      .bx-fd-tag-ok { background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg); }
      .bx-fd-tag-flag { background: oklch(93% 0.06 80); color: oklch(48% 0.13 70); }

      .bx-fd-num { font-variant-numeric: tabular-nums; font-weight: 800; color: var(--mkt-ink); flex-shrink: 0; }

      /* Momsrutorna */
      .bx-fd-box {
        display: flex; align-items: baseline; gap: 8px;
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
        border-radius: 10px; padding: 8px 11px;
        transition: border-color 0.4s, background 0.4s;
      }
      .bx-fd-box-on { border-color: ${BRAND.green}; }
      .bx-fd-box-code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 10.5px; font-weight: 700; color: var(--mkt-muted); flex-shrink: 0;
      }
      .bx-fd-box-sum { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 800; color: var(--mkt-ink); }

      /* Lönestapeln */
      .bx-fd-bar { height: 9px; border-radius: 5px; background: var(--mkt-card-border); overflow: hidden; }
      .bx-fd-bar-fill { height: 100%; border-radius: 5px; transform-origin: left; transform: scaleX(0); transition: transform 0.8s cubic-bezier(0.22,1,0.36,1); }
      .bx-fd-bar-in { transform: scaleX(1); }

      /* Fakturamallen */
      .bx-fd-inv {
        background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
        border-radius: 12px; padding: 13px; display: flex; flex-direction: column; gap: 8px;
        transition: border-color 0.5s;
      }
      .bx-fd-inv-head { height: 8px; border-radius: 4px; transition: width 0.5s cubic-bezier(0.22,1,0.36,1), background 0.5s; }
      .bx-fd-inv-line { height: 5px; border-radius: 3px; background: var(--mkt-card-border); }
      .bx-fd-inv-name {
        font-size: 10.5px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;
        transition: color 0.5s;
      }
      .bx-fd-swap { animation: bx-fd-in 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      @keyframes bx-fd-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

      .bx-fd-foot {
        display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
        padding: 5px 10px; border-radius: 999px; font-size: 10.5px; font-weight: 800;
        background: var(--mkt-accent-green-soft); color: var(--mkt-accent-green-fg);
        opacity: 0; transition: opacity 0.4s;
      }
      .bx-fd-foot-in { opacity: 1; }

      @media (prefers-reduced-motion: reduce) {
        .bx-fd-row, .bx-fd-tag, .bx-fd-bar-fill, .bx-fd-inv-head, .bx-fd-foot { transition: none; }
        .bx-fd-swap { animation: none; }
      }
    `}</style>
  );
}

/** Bokföring: två poster bokförs automatiskt, en tredje flaggas för
 *  Granskning i stället för att gissas. */
export function DemoBokforing() {
  const [ref, step] = useCycle(5, 1100);
  const items = [
    { label: 'Kvitto · Kontorsmaterial', ok: true },
    { label: 'Faktura 2026-114', ok: true },
    { label: 'Swish 480 kr', ok: false },
  ];
  return (
    <div className="bx-fd" ref={ref}>
      {items.map((item, i) => (
        <div key={item.label} className="bx-fd-row bx-fd-row-in">
          <span className="bx-fd-label">{item.label}</span>
          <span className={`bx-fd-tag ${item.ok ? 'bx-fd-tag-ok' : 'bx-fd-tag-flag'}${step > i ? ' bx-fd-tag-in' : ''}`}>
            {item.ok ? <><Check size={10} /> Bokförd</> : <><AlertCircle size={10} /> Granska</>}
          </span>
        </div>
      ))}
      <span className={`bx-fd-foot${step >= 3 ? ' bx-fd-foot-in' : ''}`}>
        <Check size={11} /> Två av tre utan en knapptryckning
      </span>
    </div>
  );
}

/** Fakturering: samma faktura i produktens fyra mallar. */
export function DemoFakturering() {
  const TEMPLATES = [
    { name: 'Klassisk', color: BRAND.green, headWidth: '52%' },
    { name: 'Kraftfull', color: '#0ea5e9', headWidth: '78%' },
    { name: 'Minimal', color: '#6b7568', headWidth: '34%' },
    { name: 'Rutnät', color: '#14b8a6', headWidth: '64%' },
  ];
  const [ref, i] = useCycle(TEMPLATES.length, 1900);
  const t = TEMPLATES[i];
  return (
    <div className="bx-fd" ref={ref}>
      <div className="bx-fd-inv" style={{ borderColor: t.color }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span className="bx-fd-inv-name" style={{ color: t.color }}>{t.name}</span>
          <FileText size={13} color={t.color} />
        </div>
        <div className="bx-fd-inv-head" style={{ width: t.headWidth, background: t.color }} />
        <div className="bx-fd-inv-line" style={{ width: '90%' }} />
        <div className="bx-fd-inv-line" style={{ width: '72%' }} />
        <div className="bx-fd-inv-line" style={{ width: '84%' }} />
        <div key={t.name} className="bx-fd-swap" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginTop: '2px' }}>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--mkt-muted)' }}>Att betala</span>
          <span className="bx-fd-num">12 400,00</span>
        </div>
      </div>
      <span className="bx-fd-foot bx-fd-foot-in">Fyra mallar, din logotyp</span>
    </div>
  );
}

/** Skatt: momsrutorna fylls i tur och ordning, och summan går ihop. */
export function DemoSkatt() {
  const BOXES = [
    { code: '05', label: 'Försäljning', sum: '236 500' },
    { code: '10', label: 'Utgående moms', sum: '59 125' },
    { code: '48', label: 'Ingående moms', sum: '9 199' },
    { code: '49', label: 'Att betala', sum: '49 926' },
  ];
  const [ref, step] = useCycle(6, 950);
  return (
    <div className="bx-fd" ref={ref}>
      {BOXES.map((b, i) => (
        <div key={b.code} className={`bx-fd-box${step >= i ? ' bx-fd-box-on' : ''}`}>
          <span className="bx-fd-box-code">{b.code}</span>
          <span className="bx-fd-label" style={{ fontSize: '11.5px' }}>{b.label}</span>
          <span className="bx-fd-box-sum" style={{ opacity: step >= i ? 1 : 0.3, transition: 'opacity 0.4s' }}>{b.sum}</span>
        </div>
      ))}
      <span className={`bx-fd-foot${step >= 5 ? ' bx-fd-foot-in' : ''}`}>
        <Check size={11} /> eSKD-fil klar att ladda upp
      </span>
    </div>
  );
}

/** Personal: brutto, skatteavdrag och netto — och filen till banken. */
export function DemoPersonal() {
  const [ref, step] = useCycle(5, 1000);
  const rows = [
    { label: 'Bruttolön', sum: '32 000', width: '100%', color: BRAND.green },
    { label: 'Skatteavdrag', sum: '−7 040', width: '22%', color: 'oklch(55% 0.19 25)' },
    { label: 'Nettolön', sum: '24 960', width: '78%', color: '#0ea5e9' },
  ];
  return (
    <div className="bx-fd" ref={ref}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--mkt-muted)' }}>{r.label}</span>
            <span className="bx-fd-num" style={{ opacity: step >= i ? 1 : 0.35, transition: 'opacity 0.4s' }}>{r.sum}</span>
          </div>
          <div className="bx-fd-bar">
            <div
              className={`bx-fd-bar-fill${step >= i ? ' bx-fd-bar-in' : ''}`}
              style={{ width: r.width, background: r.color }}
            />
          </div>
        </div>
      ))}
      <span className={`bx-fd-foot${step >= 4 ? ' bx-fd-foot-in' : ''}`}>
        <Landmark size={11} /> Betalfil till banken
      </span>
    </div>
  );
}
