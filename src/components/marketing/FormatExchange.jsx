import React, { useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { BokixWordmark } from './MarketingLayout';
import { INK, INK_SOFT } from './marketingTokens';

// ── Filformatsväxeln ────────────────────────────────────────────────────
// Integrationssidans huvudbild. Här låg tidigare två spalter med tio
// stycken brödtext — allt sant, men ingen läser tio stycken om filformat,
// och den som gör det hittar ändå inte det enda format hen kom hit för.
//
// Nu är det en växel: det som går IN till vänster, det som går UT till
// höger, Bokix i mitten. Man ser hela repertoaren på en gång och plockar
// fram det man faktiskt undrade över.
//
// SEO: varje formats fulla beskrivning renderas i DOM, även när den inte
// visas (hidden-attributet, inte villkorad rendering). Sidan förrenderas
// (entry-server.jsx) och texten ska finnas i HTML-filen — annars hade den
// här omgörningen tystat halva sidans innehåll för Google.
//
// Skiljer sig med flit från Startsidans kopplingsdiagram, som visar fyra
// LOGOTYPER i en graf. Det här handlar om filformat, inte om varumärken —
// två bilder av samma sak hade fått sidan att kännas som en kopia.
const CYCLE_MS = 3600;

function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function FormatExchange({ imports = [], exports: outs = [] }) {
  // Ett id per rad: riktning + index, så in- och utlistan aldrig kan
  // krocka om de råkar ha lika många poster.
  const all = [
    ...imports.map((item, i) => ({ ...item, dir: 'in', id: `in-${i}` })),
    ...outs.map((item, i) => ({ ...item, dir: 'out', id: `out-${i}` })),
  ];
  const [activeId, setActiveId] = useState(all[0]?.id);
  // Har besökaren själv valt ett format slutar karusellen — då läser hen.
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (picked || prefersReducedMotion() || all.length === 0) return undefined;
    const t = setInterval(() => {
      setActiveId(curr => {
        const idx = all.findIndex(x => x.id === curr);
        return all[(idx + 1) % all.length].id;
      });
    }, CYCLE_MS);
    return () => clearInterval(t);
    // all är härledd ur props och byts inte under sidans liv.
  }, [picked, all.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = all.find(x => x.id === activeId) || all[0];

  const column = (items, dir, Icon, heading, hint) => (
    <div className="bx-fx-col">
      <div className="bx-fx-col-head">
        <Icon size={14} /> {heading}
      </div>
      <div className="bx-fx-chips">
        {items.map((item, i) => {
          const id = `${dir}-${i}`;
          return (
            <button
              key={id}
              type="button"
              className={`bx-fx-chip${activeId === id ? ' bx-fx-chip-on' : ''}`}
              aria-current={activeId === id}
              onClick={() => { setActiveId(id); setPicked(true); }}
              onPointerEnter={e => { if (e.pointerType === 'mouse') { setActiveId(id); setPicked(true); } }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div className="bx-fx-hint">{hint}</div>
    </div>
  );

  return (
    <div className="bx-fx">
      <style>{`
        .bx-fx { width: 100%; display: flex; flex-direction: column; gap: 20px; }

        .bx-fx-stage {
          display: grid; grid-template-columns: 1fr auto 1fr; gap: clamp(14px, 3vw, 30px);
          align-items: center;
        }
        @media (max-width: 820px) { .bx-fx-stage { grid-template-columns: 1fr; } }

        .bx-fx-col { min-width: 0; }
        .bx-fx-col-head {
          display: flex; align-items: center; gap: 7px; margin-bottom: 12px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--mkt-muted);
        }
        .bx-fx-chips { display: flex; flex-wrap: wrap; gap: 8px; }
        .bx-fx-chip {
          padding: 9px 14px; border-radius: 10px; cursor: pointer; font-family: inherit;
          font-size: 13px; font-weight: 700; text-align: left;
          background: var(--mkt-card-bg); border: 1.5px solid var(--mkt-card-border); color: var(--mkt-ink-soft);
          transition: border-color 0.3s, color 0.3s, background 0.3s, transform 0.3s cubic-bezier(0.22,1,0.36,1);
        }
        .bx-fx-chip-on { border-color: ${BRAND.green}; background: ${BRAND.green}; color: #fff; transform: translateY(-1px); }
        .bx-fx-hint { margin-top: 11px; font-size: 12px; color: var(--mkt-muted); line-height: 1.5; }

        /* Navet. Två ledningar som pulsar inåt respektive utåt — riktningen
           är hela poängen med bilden. */
        .bx-fx-hub { display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .bx-fx-hub-box {
          display: flex; align-items: center; justify-content: center;
          padding: 14px 18px; border-radius: 16px;
          background: var(--mkt-card-bg); border: 1.5px solid var(--mkt-card-border);
          box-shadow: var(--mkt-card-shadow);
        }
        .bx-fx-lane { position: relative; width: clamp(48px, 8vw, 84px); height: 2px; background: var(--mkt-card-border); border-radius: 2px; overflow: hidden; }
        .bx-fx-lane::after {
          content: ''; position: absolute; top: 0; bottom: 0; width: 34%;
          background: linear-gradient(90deg, transparent, ${BRAND.green}, transparent);
          animation: bx-fx-slide 2.4s linear infinite;
        }
        .bx-fx-lane-out::after { animation-direction: reverse; }
        @keyframes bx-fx-slide { from { left: -34%; } to { left: 100%; } }
        .bx-fx-lanes { display: flex; align-items: center; gap: 6px; }
        @media (max-width: 820px) { .bx-fx-hub { flex-direction: row; justify-content: center; } .bx-fx-lanes { display: none; } }

        /* Detaljkortet. Alla format ligger kvar i DOM (hidden), bara ett
           syns — se filkommentaren om SEO. */
        .bx-fx-detail {
          background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border);
          border-radius: 16px; padding: clamp(18px, 3vw, 24px);
          box-shadow: var(--mkt-card-shadow);
        }
        .bx-fx-badge {
          display: inline-flex; align-items: center; gap: 6px; margin-bottom: 11px;
          padding: 5px 11px; border-radius: 999px;
          font-size: 10.5px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase;
        }
        .bx-fx-meta {
          display: inline-block; margin-top: 13px; padding: 6px 11px; border-radius: 8px;
          background: var(--mkt-ivory); border: 1px solid var(--mkt-card-border);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11.5px; color: var(--mkt-muted);
        }
        .bx-fx-in { animation: bx-fx-fade 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes bx-fx-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

        @media (prefers-reduced-motion: reduce) {
          .bx-fx-lane::after { animation: none; }
          .bx-fx-in { animation: none; }
          .bx-fx-chip { transition: none; }
        }
      `}</style>

      <div className="bx-fx-stage">
        {column(imports, 'in', ArrowDownToLine, 'Går in', 'Ingen av vägarna in kräver att du skriver av något för hand.')}

        <div className="bx-fx-hub">
          <div className="bx-fx-lanes" aria-hidden><span className="bx-fx-lane" /></div>
          <div className="bx-fx-hub-box"><BokixWordmark height={26} /></div>
          <div className="bx-fx-lanes" aria-hidden><span className="bx-fx-lane bx-fx-lane-out" /></div>
        </div>

        {column(outs, 'out', ArrowUpFromLine, 'Går ut', 'Allt du lagt in går att få ut igen, i format andra system läser.')}
      </div>

      {/* Varje format har sitt kort i DOM. Bara det aktiva visas. */}
      <div>
        {all.map(item => {
          const on = item.id === active?.id;
          return (
            <div key={item.id} hidden={!on} className={`bx-fx-detail${on ? ' bx-fx-in' : ''}`}>
              <span
                className="bx-fx-badge"
                style={item.dir === 'in'
                  ? { background: 'var(--mkt-accent-blue-soft)', color: 'var(--mkt-accent-blue-fg)' }
                  : { background: 'var(--mkt-accent-green-soft)', color: 'var(--mkt-accent-green-fg)' }}
              >
                {item.dir === 'in' ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                {item.dir === 'in' ? 'In i Bokix' : 'Ut ur Bokix'}
              </span>
              <h3 style={{ fontSize: 'clamp(16px, 2.6vw, 19px)', fontWeight: 700, color: INK, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
                {item.title}
              </h3>
              <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              {item.meta && <span className="bx-fx-meta">{item.meta}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
