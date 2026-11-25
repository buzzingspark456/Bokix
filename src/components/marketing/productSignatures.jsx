import React from 'react';
import { Reveal } from './MarketingLayout';
import { ProductShot } from './productKit';

// Egen hjälte och eget mittparti för en produktsida (2026-11-07). Används av
// Lön: lönebeskedet (räknat med appens egen löneberäkning) och lönemånaden.
// Övriga varianter provades och togs bort på användarens begäran.

const kr = (n, dec = 0) => n.toLocaleString('sv-SE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + ' kr';

/** Hjälte med text på ena sidan och något visuellt på den andra. */
export function SplitHero({ eyebrow, title, lead, actions, note, visual, flip = false }) {
  return (
    <section className={'sg-hero' + (flip ? ' is-flip' : '')}>
      <div className="sg-hero-grid">
        <Reveal className="sg-hero-text">
          <h1 className="pk-h1-wrap">
            <span className="pk-eyebrow">{eyebrow}</span>
            <span className="kx-h1 sg-h1">{title}</span>
          </h1>
          <p className="sg-lead">{lead}</p>
          <div className="kx-actions">{actions}</div>
          {note && <p className="pk-hero-note">{note}</p>}
        </Reveal>
        <Reveal delay={120} className="sg-hero-visual">{visual}</Reveal>
      </div>
    </section>
  );
}

/** Numrerade steg i en rad, med eller utan bild under varje. */
export function FlowSteps({ steps }) {
  return (
    <ol className={'sg-flow' + (steps.some(s => s.shot) ? ' has-shots' : '')} style={{ '--n': steps.length }}>
      {steps.map((s, i) => (
        <Reveal as="li" key={s.title} delay={i * 80} className="sg-flow-step">
          <div className="sg-flow-n">{i + 1}</div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
          {s.shot && <div className="sg-flow-shot"><ProductShot name={s.shot} alt={s.title} /></div>}
        </Reveal>
      ))}
    </ol>
  );
}

/** Lön: ett lönebesked, uträknat med appens egen löneberäkning. */
export function Payslip({ name, period, rows, net, costRows, totalCost }) {
  return (
    <div className="sg-pay">
      <div className="sg-pay-head">
        <div>
          <div className="sg-pay-label">Lönebesked</div>
          <div className="sg-pay-name">{name}</div>
        </div>
        <div className="sg-pay-period">{period}</div>
      </div>
      <div className="sg-pay-rows">
        {rows.map(r => (
          <div key={r.label} className="sg-pay-row"><span>{r.label}</span><span>{r.amount < 0 ? '−' + kr(-r.amount) : kr(r.amount)}</span></div>
        ))}
        <div className="sg-pay-row is-net"><span>Att betala ut</span><span>{kr(net)}</span></div>
      </div>
      <div className="sg-pay-cost">
        <div className="sg-pay-label">Kostnad för företaget</div>
        {costRows.map(r => (
          <div key={r.label} className="sg-pay-row is-small"><span>{r.label}</span><span>{kr(r.amount)}</span></div>
        ))}
        <div className="sg-pay-row is-total"><span>Totalt</span><span>{kr(totalCost)}</span></div>
      </div>
    </div>
  );
}

/** Välj rätt mittparti utifrån sidans data. */
export function Signature({ sig }) {
  switch (sig.type) {
    case 'flow': return <FlowSteps steps={sig.steps} />;
    default: return null;
  }
}

/** Hjältens bild utifrån sidans data. */
export function HeroVisual({ hero }) {
  switch (hero.type) {
    case 'payslip': return <Payslip {...hero.payslip} />;
    default: return <ProductShot name={hero.shot} alt={hero.alt} eager />;
  }
}

export const SIGNATURE_CSS = `
.sg-hero { padding: 132px 24px 88px; background: var(--mkt-page-bg); overflow: hidden; }
.sg-hero-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 64px; align-items: center; }
.sg-hero.is-flip .sg-hero-text { order: 2; }
.sg-hero.is-flip .sg-hero-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
.sg-h1 { display: block; font-size: clamp(36px, 4.6vw, 56px); line-height: 1.06; letter-spacing: -0.03em; margin: 0; }
.sg-lead { font-size: 18.5px; line-height: 1.6; color: var(--mkt-ink-soft); margin: 0 0 30px; max-width: 520px; text-wrap: pretty; }
.sg-hero-visual { min-width: 0; }

.sg-flow { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 28px; counter-reset: none; }
.sg-flow-step { position: relative; }
.sg-flow-n { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 17px; color: #fff; background: var(--mkt-accent-green-fg); margin-bottom: 18px; }
html[data-theme="dark"] #lp-root .sg-flow-n { color: #0f1a13; }
.sg-flow-step:not(:last-child)::after { content: ''; position: absolute; top: 20px; left: 52px; right: -16px; height: 2px; background: var(--mkt-border-soft); }
.sg-flow-step h3 { font-size: 19px; font-weight: 700; color: var(--mkt-ink); margin: 0 0 8px; }
.sg-flow-step p { font-size: 15.5px; line-height: 1.55; color: var(--mkt-ink-soft); margin: 0; text-wrap: pretty; }
.sg-flow-shot { margin-top: 22px; }

.sg-pay-label { font-size: 12.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mkt-muted); }
.sg-pay { max-width: 460px; margin: 0 auto; border-radius: 20px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); box-shadow: 0 40px 80px -44px rgba(16,24,20,0.4); overflow: hidden; }
.sg-pay-head { display: flex; justify-content: space-between; align-items: flex-start; padding: 22px 24px; border-bottom: 1px solid var(--mkt-border-soft); }
.sg-pay-name { font-size: 19px; font-weight: 700; color: var(--mkt-ink); margin-top: 2px; }
.sg-pay-period { font-size: 14px; font-weight: 600; color: var(--mkt-muted); }
.sg-pay-rows { padding: 8px 24px 14px; }
.sg-pay-row { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; font-size: 15.5px; color: var(--mkt-ink-soft); font-variant-numeric: tabular-nums; }
.sg-pay-row.is-net { margin-top: 6px; padding-top: 14px; border-top: 2px solid var(--mkt-ink); font-size: 18px; font-weight: 800; color: var(--mkt-ink); }
.sg-pay-cost { padding: 16px 24px 20px; background: var(--mkt-ivory); border-top: 1px solid var(--mkt-border-soft); }
.sg-pay-row.is-small { font-size: 14.5px; padding: 6px 0; }
.sg-pay-row.is-total { font-weight: 800; color: var(--mkt-ink); border-top: 1px solid var(--mkt-border-soft); margin-top: 6px; padding-top: 10px; }

@media (max-width: 960px) {
  .sg-hero-grid, .sg-hero.is-flip .sg-hero-grid { grid-template-columns: 1fr; gap: 44px; }
  .sg-hero.is-flip .sg-hero-text { order: 0; }
  .sg-flow { grid-template-columns: 1fr; }
  .sg-flow-step:not(:last-child)::after { display: none; }
}
@media (max-width: 640px) {
  .sg-hero { padding: 104px 16px 64px; }
}
`;
