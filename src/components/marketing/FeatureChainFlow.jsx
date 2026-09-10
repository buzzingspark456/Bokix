import React, { useEffect, useState } from 'react';
import { Receipt, BookOpen, BarChart3 } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { INK, INK_SOFT, MUTED } from './marketingTokens';

// ── Kedjan: ett kvitto blir bokföring blir rapport ──────────────────────
// Funktionssidans huvudbild. Sidan listade fyra områden och trettio
// funktioner, men aldrig SAMBANDET — och sambandet är hela argumentet för
// att ha allt i ett verktyg: det du gör en gång dyker upp överallt där det
// ska, utan att du för in det igen.
//
// Tre led, med riktiga siffror som går ihop: 712 kr inklusive 25 % moms
// blir 569,60 netto och 142,40 moms, och exakt de talen är de som syns i
// momsrapporten. Ett exempel där siffrorna inte stämmer är värre än inget
// exempel — den som kan bokföring ser det direkt, och det är den personen
// som ska övertygas.
//
// Rörelsevokabulären är sajtens egen (UfYearFlow/BankFlow/SecurityFlow):
// leden lyser i tur och ordning, pekaren pausar, och den som bett om
// mindre rörelse får en stillastående bild med allt synligt.
const STEP_MS = 3400;

const LINKS = [
  {
    id: 'kvitto', icon: Receipt, label: 'Du fotar kvittot',
    note: 'Eller drar in PDF:en. Fälten fylls i, underlaget sparas.',
  },
  {
    id: 'bokfor', icon: BookOpen, label: 'Bokix konterar',
    note: 'BAS-konton, moms uträknad, verifikationsnummer satt. Är något osäkert hamnar det i Granskning i stället.',
  },
  {
    id: 'rapport', icon: BarChart3, label: 'Det syns direkt',
    note: 'Momsrapporten, resultatet och huvudboken uppdateras i samma sekund. Du för aldrig in samma sak två gånger.',
  },
];

// Verifikationen som faktiskt uppstår. Debet/kredit går ihop.
const ROWS = [
  { account: '6110', name: 'Kontorsmateriel', debit: '569,60', credit: '' },
  { account: '2641', name: 'Ingående moms', debit: '142,40', credit: '' },
  { account: '1930', name: 'Företagskonto', debit: '', credit: '712,00' },
];

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function FeatureChainFlow() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion() || paused) return undefined;
    const t = setInterval(() => setI(prev => (prev + 1) % LINKS.length), STEP_MS);
    return () => clearInterval(t);
  }, [paused]);

  const isMouse = e => e.pointerType === 'mouse';

  return (
    <div
      className="bx-ch"
      onPointerEnter={e => { if (isMouse(e)) setPaused(true); }}
      onPointerLeave={e => { if (isMouse(e)) setPaused(false); }}
    >
      <style>{`
        .bx-ch { width: 100%; }
        .bx-ch-row { display: grid; grid-template-columns: 1fr 30px 1fr 30px 1fr; align-items: stretch; }
        @media (max-width: 860px) { .bx-ch-row { grid-template-columns: 1fr; gap: 10px; } }

        .bx-ch-card {
          display: flex; flex-direction: column;
          background: var(--mkt-card-bg); border: 1.5px solid var(--mkt-card-border);
          border-radius: 16px; padding: 18px 18px 16px; text-align: left;
          font-family: inherit; cursor: pointer; width: 100%;
          transition: border-color 0.5s, box-shadow 0.5s, transform 0.5s cubic-bezier(0.22,1,0.36,1);
        }
        .bx-ch-card-on { border-color: ${BRAND.green}; box-shadow: 0 18px 40px -26px rgba(11,99,41,0.7); transform: translateY(-3px); }

        .bx-ch-head { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
        .bx-ch-icon {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--mkt-ivory); color: var(--mkt-muted);
          transition: background 0.5s, color 0.5s;
        }
        .bx-ch-card-on .bx-ch-icon { background: ${BRAND.green}; color: #fff; }
        .bx-ch-step { margin-left: auto; font-size: 11px; font-weight: 800; color: var(--mkt-muted); }

        /* Ledningen mellan leden. Fylls i takt med att kedjan går framåt,
           så man ser att det är ETT förlopp och inte tre fristående kort. */
        .bx-ch-wire { position: relative; align-self: center; height: 2px; background: var(--mkt-card-border); border-radius: 2px; overflow: hidden; }
        .bx-ch-wire-fill { position: absolute; inset: 0; background: linear-gradient(90deg, ${BRAND.green}, #14b8a6); transform-origin: left; transform: scaleX(0); transition: transform 0.6s cubic-bezier(0.22,1,0.36,1); }
        .bx-ch-wire-on .bx-ch-wire-fill { transform: scaleX(1); }
        @media (max-width: 860px) {
          .bx-ch-wire { width: 2px; height: 22px; justify-self: center; }
          .bx-ch-wire-fill { transform-origin: top; transform: scaleY(0); }
          .bx-ch-wire-on .bx-ch-wire-fill { transform: scaleY(1); }
        }

        /* Innehållet i respektive kort. Kvittot, verifikationen, talen. */
        .bx-ch-slip { background: var(--mkt-ivory); border-radius: 10px; padding: 12px 13px; }
        .bx-ch-ver { font-size: 12px; width: 100%; border-collapse: collapse; }
        .bx-ch-ver td { padding: 4px 0; color: var(--mkt-ink-soft); }
        .bx-ch-ver td:last-child, .bx-ch-ver td:nth-last-child(2) { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .bx-ch-figs { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; }
        .bx-ch-fig { background: var(--mkt-ivory); border-radius: 10px; padding: 11px 12px; }

        .bx-ch-note { font-size: 12.5px; color: var(--mkt-muted); line-height: 1.55; margin: 12px 0 0; }

        @media (prefers-reduced-motion: reduce) {
          .bx-ch-card, .bx-ch-icon, .bx-ch-wire-fill { transition: none; }
        }
      `}</style>

      <div className="bx-ch-row">
        {LINKS.map((link, idx) => (
          <React.Fragment key={link.id}>
            {idx > 0 && (
              <div className={`bx-ch-wire${i >= idx ? ' bx-ch-wire-on' : ''}`} aria-hidden>
                <span className="bx-ch-wire-fill" />
              </div>
            )}
            <button
              type="button"
              className={`bx-ch-card${i === idx ? ' bx-ch-card-on' : ''}`}
              aria-current={i === idx}
              onClick={() => setI(idx)}
            >
              <div className="bx-ch-head">
                <span className="bx-ch-icon"><link.icon size={16} /></span>
                <span style={{ fontSize: '14.5px', fontWeight: 700, color: INK }}>{link.label}</span>
                <span className="bx-ch-step">0{idx + 1}</span>
              </div>

              {idx === 0 && (
                <div className="bx-ch-slip">
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, marginBottom: '7px' }}>Kvitto</div>
                  <div style={{ fontSize: '13px', color: INK_SOFT, marginBottom: '3px' }}>Kontorsmaterial</div>
                  <div style={{ fontSize: '21px', fontWeight: 800, color: INK, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>712,00 kr</div>
                  <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '3px' }}>varav moms 25 %</div>
                </div>
              )}

              {idx === 1 && (
                <div className="bx-ch-slip">
                  <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, marginBottom: '5px' }}>Verifikation A-42</div>
                  <table className="bx-ch-ver">
                    <tbody>
                      {ROWS.map(r => (
                        <tr key={r.account}>
                          <td style={{ fontWeight: 700 }}>{r.account}</td>
                          <td style={{ paddingLeft: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td>
                          <td>{r.debit}</td>
                          <td style={{ paddingLeft: '8px' }}>{r.credit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {idx === 2 && (
                <div className="bx-ch-figs">
                  <div className="bx-ch-fig">
                    <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED, marginBottom: '5px' }}>Ingående moms</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>142,40</div>
                  </div>
                  <div className="bx-ch-fig">
                    <div style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: MUTED, marginBottom: '5px' }}>Kostnad</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>569,60</div>
                  </div>
                </div>
              )}

              <p className="bx-ch-note">{link.note}</p>
            </button>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
