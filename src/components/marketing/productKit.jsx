import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from './MarketingLayout';
import { Check } from '../icons';

// Produktsidornas byggklossar (2026-11-07). Bilderna är riktiga skärmbilder
// ur appen (scripts/capture-product-shots.mjs → public/product/), i ljust och
// mörkt läge. Ramen runt dem ritas här och följer sajtens tema, så bilden är
// bara själva appen.

// Bildernas storlek i pixlar (dubbel upplösning): hela appen med sidomenyn
// (1440x900-fönster), eller bara innehållet till höger om menyn, skuret till
// 16:11 ur ett 1180 px brett fönster (namn som slutar på -c).
const SIZE_FULL = { w: 2880, h: 1694 };
const SIZE_CONTENT = { w: 1936, h: 1332 };

function shotSrc(name, dark) {
  return `/product/${name}${dark ? '-mork' : ''}.jpg`;
}

/** En bild ur appen: ljus och mörk variant, CSS visar den som passar temat. */
export function ShotImg({ name, alt, eager = false, size: sizeOverride }) {
  const size = sizeOverride || (name.endsWith('-c') ? SIZE_CONTENT : SIZE_FULL);
  const common = { width: size.w, height: size.h, decoding: 'async', loading: eager ? 'eager' : 'lazy' };
  return (<>
    <img className="pk-img pk-img-light" src={shotSrc(name, false)} alt={alt} {...common} />
    <img className="pk-img pk-img-dark" src={shotSrc(name, true)} alt="" aria-hidden="true" {...common} loading="lazy" />
  </>);
}

/** Fönstret runt en bild. `crop` = bildförhållande som visas (överkanten). */
export function ProductShot({ name, alt, crop, eager }) {
  return (
    <div className="pk-frame">
      <div className="pk-bar" aria-hidden="true"><i /><i /><i /><span>app.bokix.se</span></div>
      <div className="pk-view" style={crop ? { aspectRatio: crop } : undefined}>
        <ShotImg name={name} alt={alt} eager={eager} />
      </div>
    </div>
  );
}

/**
 * Hjältens bildspel: flikar över ett appfönster, bilderna byter mjukt och
 * flikens linje visar tiden kvar. Stannar när man pekar på det, när det inte
 * syns och när besökaren valt mindre rörelse. Laddar bara den bild som visas
 * och nästa, inte alla på en gång.
 */
export function HeroShowcase({ tabs, interval = 5200 }) {
  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState(() => new Set([0, 1]));
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !rootRef.current || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setRunning(e.isIntersecting), { threshold: 0.35 });
    io.observe(rootRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!running || paused) return undefined;
    const t = setTimeout(() => go((active + 1) % tabs.length), interval);
    return () => clearTimeout(t);
  });

  function go(i) {
    setActive(i);
    setSeen(prev => { const n = new Set(prev); n.add(i); n.add((i + 1) % tabs.length); return n; });
  }

  const animating = running && !paused;
  return (
    <div ref={rootRef} className="pk-show" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="pk-tabs" role="tablist" aria-label="Delar av appen">
        {tabs.map((t, i) => (
          <button key={t.label} type="button" role="tab" aria-selected={i === active}
            className={'pk-tab' + (i === active ? ' is-active' : '')} onClick={() => go(i)}>
            {t.label}
            <span className="pk-tab-line" aria-hidden="true">
              <span key={i === active ? `on-${active}` : 'off'} className={i === active && animating ? 'is-running' : ''} style={{ animationDuration: interval + 'ms' }} />
            </span>
          </button>
        ))}
      </div>
      <div className="pk-frame pk-frame-hero">
        <div className="pk-bar" aria-hidden="true"><i /><i /><i /><span>app.bokix.se</span></div>
        <div className="pk-stack">
          {tabs.map((t, i) => (
            <div key={t.shot} className={'pk-slide' + (i === active ? ' is-active' : '')} aria-hidden={i !== active}>
              {seen.has(i) && <ShotImg name={t.shot} alt={t.alt || t.label} eager={i === 0} />}
            </div>
          ))}
        </div>
      </div>
      <p className="pk-caption" aria-live="polite">{tabs[active].caption}</p>
    </div>
  );
}

/** Tre skäl bredvid varandra. Ingen ikon, inget kort: rubrik och en mening. */
export function ReasonRow({ items }) {
  return (
    <div className="pk-reasons">
      {items.map((r, i) => (
        <Reveal key={r.title} delay={i * 70} className="pk-reason">
          <h3>{r.title}</h3>
          <p>{r.body}</p>
        </Reveal>
      ))}
    </div>
  );
}

/** Text på ena sidan, ett utsnitt ur appen på den andra. */
export function FeatureBlock({ kicker, title, body, points, shot, alt, flip = false, link }) {
  return (
    <div className={'pk-feature' + (flip ? ' is-flip' : '')}>
      <Reveal className="pk-feature-text">
        {kicker && <div className="pk-kicker">{kicker}</div>}
        <h3 className="pk-h3">{title}</h3>
        <p className="pk-body">{body}</p>
        {points?.length > 0 && (
          <ul className="pk-points">
            {points.map(p => <li key={p}><Check size={17} aria-hidden="true" />{p}</li>)}
          </ul>
        )}
        {link && <Link to={link.to} className="pk-more">{link.label} <span aria-hidden="true">→</span></Link>}
      </Reveal>
      <Reveal delay={90} className="pk-feature-shot">
        <ProductShot name={shot} alt={alt || title} />
      </Reveal>
    </div>
  );
}

/**
 * Året (eller månaden) som tidslinje: rubrik, ingress och det som återkommer
 * varje månad till vänster (står kvar när man skrollar), händelserna i
 * ordning till höger. Viktiga datum (key) får en fylld prick.
 */
export function YearSection({ title, lead, every, everyLabel = 'Varje månad', quarters, note }) {
  return (
    <div className="pk-yr">
      <Reveal className="pk-yr-side">
        <h2 className="kx-h2 pk-h2 pk-yr-title">{title}</h2>
        {lead && <p className="pk-lead">{lead}</p>}
        {every && (
          <div className="pk-yr-every">
            <div className="pk-yr-ticks" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} />)}</div>
            <div className="pk-yr-every-label">{everyLabel}</div>
            <p>{every}</p>
          </div>
        )}
        {note && <p className="pk-yr-note">{note}</p>}
      </Reveal>
      <div className="pk-yr-list">
        {quarters.map((q, qi) => (
          <Reveal key={q.label} delay={qi * 60} className="pk-yr-group">
            <div className="pk-yr-glabel"><span>{q.label}</span></div>
            {q.events.length === 0 && (
              <div className="pk-yr-ev is-empty"><div className="pk-yr-date" /><div className="pk-yr-dot" /><div className="pk-yr-body"><p className="pk-yr-bokix">{q.empty || 'Löpande bokföring.'}</p></div></div>
            )}
            {q.events.map(e => (
              <div key={e.date + e.title} className={'pk-yr-ev' + (e.key ? ' is-key' : '')}>
                <div className="pk-yr-date">{e.date}</div>
                <div className="pk-yr-dot" aria-hidden="true" />
                <div className="pk-yr-body">
                  <div className="pk-yr-mdate">{e.date}</div>
                  <h3 className="pk-yr-etitle">{e.title}</h3>
                  {e.bokix && <p className="pk-yr-bokix"><span>I Bokix</span>{e.bokix}</p>}
                </div>
              </div>
            ))}
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/** Ärlig jämförelse i tre spalter; den sista (Bokix) markerad. */
export function CompareColumns({ cols, rows }) {
  return (
    <div className="pk-cmp" role="table">
      <div className="pk-cmp-row pk-cmp-head" role="row">
        <span role="columnheader" />
        {cols.map((c, i) => <span key={c} role="columnheader" className={i === cols.length - 1 ? 'is-us' : ''}>{c}</span>)}
      </div>
      {rows.map(([label, ...cells]) => (
        <div key={label} className="pk-cmp-row" role="row">
          <span role="rowheader" className="pk-cmp-label">{label}</span>
          {cells.map((c, i) => (
            <span key={i} role="cell" data-col={cols[i]} className={i === cells.length - 1 ? 'is-us' : ''}>{c}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Rubrik för en centrerad sektion. */
export function SectionHead({ kicker, title, lead }) {
  return (
    <Reveal className="pk-head">
      {kicker && <div className="pk-kicker">{kicker}</div>}
      <h2 className="kx-h2 pk-h2">{title}</h2>
      {lead && <p className="pk-lead">{lead}</p>}
    </Reveal>
  );
}

export const PRODUCT_KIT_CSS = `
.pk-img { display: block; width: 100%; height: auto; }
.pk-img-dark { display: none; }
html[data-theme="dark"] #lp-root .pk-img-light { display: none; }
html[data-theme="dark"] #lp-root .pk-img-dark { display: block; }

.pk-frame { border-radius: 14px; overflow: hidden; background: var(--mkt-card-bg); border: 1px solid var(--mkt-card-border); box-shadow: 0 1px 2px rgba(16,24,20,0.04), 0 30px 60px -32px rgba(16,24,20,0.28); }
html[data-theme="dark"] #lp-root .pk-frame { box-shadow: 0 1px 2px rgba(0,0,0,0.4), 0 30px 60px -30px rgba(0,0,0,0.7); }
.pk-bar { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 14px; border-bottom: 1px solid var(--mkt-border-soft); background: var(--mkt-ivory); }
.pk-bar i { width: 10px; height: 10px; border-radius: 50%; background: var(--mkt-border-soft); }
html[data-theme="dark"] #lp-root .pk-bar i { background: #2f4433; }
.pk-bar span { margin: 0 auto; transform: translateX(-24px); font-size: 12px; font-weight: 500; color: var(--mkt-muted); letter-spacing: 0.01em; }
.pk-view { overflow: hidden; }
.pk-view .pk-img { width: 100%; height: 100%; object-fit: cover; object-position: left top; }

.pk-hero { padding: 128px 24px 0; background: var(--mkt-page-bg); overflow: hidden; }
.pk-hero-text { max-width: 1040px; margin: 0 auto; text-align: center; }
.pk-h1-wrap { margin: 0 0 22px; font-weight: inherit; }
.pk-eyebrow { display: block; font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--mkt-accent-green-fg); margin-bottom: 18px; font-family: inherit; }
.pk-h1 { display: block; font-size: clamp(36px, 5.2vw, 62px); line-height: 1.06; letter-spacing: -0.03em; margin: 0; }
.pk-hero-lead { font-size: 19px; line-height: 1.6; color: var(--mkt-ink-soft); max-width: 640px; margin: 0 auto 30px; text-wrap: pretty; }
.pk-lead, .pk-body, .pk-reason p, .pk-price-text { text-wrap: pretty; }
.pk-h2, .pk-h3 { text-wrap: wrap; }
.pk-hero-actions { justify-content: center; }
.pk-hero-note { margin: 16px 0 0; font-size: 14px; color: var(--mkt-muted); }

.pk-show { max-width: 1180px; margin: 56px auto 0; }
.pk-tabs { display: flex; justify-content: center; gap: 4px; margin-bottom: 18px; flex-wrap: wrap; }
.pk-tab { position: relative; padding: 10px 16px 12px; border: 0; background: none; font: inherit; font-size: 15px; font-weight: 600; color: var(--mkt-muted); cursor: pointer; border-radius: 8px; }
.pk-tab:hover { color: var(--mkt-ink); }
.pk-tab.is-active { color: var(--mkt-ink); }
.pk-tab:focus-visible { outline: 2px solid var(--mkt-accent-green-fg); outline-offset: 2px; }
.pk-tab-line { position: absolute; left: 16px; right: 16px; bottom: 4px; height: 2px; border-radius: 2px; background: transparent; overflow: hidden; }
.pk-tab.is-active .pk-tab-line { background: var(--mkt-border-soft); }
.pk-tab-line > span { display: block; height: 100%; width: 0; background: var(--mkt-accent-green-fg); }
.pk-tab.is-active .pk-tab-line > span { width: 100%; }
.pk-tab.is-active .pk-tab-line > span.is-running { width: 0; animation: pk-fill linear forwards; }
@keyframes pk-fill { to { width: 100%; } }
.pk-frame-hero { border-radius: 16px 16px 0 0; border-bottom: 0; }
.pk-stack { display: grid; aspect-ratio: 2880 / 1694; }
.pk-slide { grid-area: 1 / 1; opacity: 0; transition: opacity 0.6s ease; }
.pk-slide.is-active { opacity: 1; }
.pk-caption { position: relative; margin: 0; padding: 18px 24px 0; min-height: 1.6em; text-align: center; font-size: 15px; color: var(--mkt-muted); }
.pk-hero-fade { height: 1px; background: var(--mkt-border-soft); max-width: 1180px; margin: 0 auto; }

.pk-section { padding: 104px 24px; border-top: 1px solid var(--mkt-border-soft); background: var(--mkt-page-bg); }
.pk-section.is-alt { background: var(--mkt-ivory); }
.pk-section.is-tight { padding-top: 72px; padding-bottom: 72px; }
.pk-wrap { max-width: 1120px; margin: 0 auto; }
.pk-head { max-width: 960px; margin: 0 auto 56px; text-align: center; }
.pk-head .pk-lead { max-width: 680px; margin-left: auto; margin-right: auto; }
.pk-kicker { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mkt-accent-green-fg); margin-bottom: 12px; }
.pk-h2 { font-size: clamp(28px, 4vw, 44px); font-weight: 700; line-height: 1.1; letter-spacing: -0.025em; color: var(--mkt-ink); margin: 0 0 14px; }
.pk-lead { font-size: 17.5px; line-height: 1.6; color: var(--mkt-muted); margin: 0; }

.pk-reasons { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px; }
.pk-reason { border-top: 2px solid var(--mkt-ink); padding-top: 22px; }
.pk-reason h3 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.3; color: var(--mkt-ink); margin: 0 0 10px; }
.pk-reason p { font-size: 16px; line-height: 1.6; color: var(--mkt-ink-soft); margin: 0; }

.pk-features { display: flex; flex-direction: column; gap: 112px; }
.pk-feature { display: grid; grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr); gap: 72px; align-items: center; }
.pk-feature.is-flip { grid-template-columns: minmax(0, 1.22fr) minmax(0, 0.78fr); }
.pk-feature.is-flip .pk-feature-text { order: 2; }
.pk-h3 { font-size: clamp(23px, 2.5vw, 29px); font-weight: 700; line-height: 1.15; letter-spacing: -0.02em; color: var(--mkt-ink); margin: 0 0 14px; }
.pk-body { font-size: 17px; line-height: 1.65; color: var(--mkt-ink-soft); margin: 0 0 22px; }
.pk-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.pk-points li { display: flex; gap: 10px; align-items: flex-start; font-size: 15.5px; line-height: 1.5; color: var(--mkt-ink); }
.pk-points svg { flex: none; margin-top: 2px; color: var(--mkt-accent-green-fg); }
.pk-feature-shot { min-width: 0; }
.pk-fgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 48px 32px; }
.pk-fgrid-item h3 { font-size: 20px; font-weight: 700; letter-spacing: -0.01em; color: var(--mkt-ink); margin: 22px 0 8px; }
.pk-fgrid-item p { font-size: 16px; line-height: 1.6; color: var(--mkt-ink-soft); margin: 0; text-wrap: pretty; }
.pk-fgrid.is-three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (max-width: 960px) { .pk-fgrid.is-three { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 760px) { .pk-fgrid, .pk-fgrid.is-three { grid-template-columns: 1fr; } }
.pk-more { display: inline-block; margin-top: 24px; font-size: 15.5px; font-weight: 700; color: var(--mkt-accent-green-fg); text-decoration: none; }
.pk-more:hover { text-decoration: underline; }


.pk-yr { display: grid; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 80px; align-items: start; }
.pk-yr-side { position: sticky; top: 110px; }
.pk-yr-title { text-align: left; }
.pk-yr-side .pk-lead { margin-bottom: 28px; }
.pk-yr-every { padding: 20px 22px; border-radius: 16px; border: 1px solid var(--mkt-card-border); background: var(--mkt-card-bg); }
.pk-yr-ticks { display: grid; grid-template-columns: repeat(12, 1fr); gap: 4px; margin-bottom: 16px; }
.pk-yr-ticks i { height: 6px; border-radius: 3px; background: var(--mkt-accent-green-fg); opacity: 0.85; }
.pk-yr-every-label { font-size: 12.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mkt-ink); margin-bottom: 6px; }
.pk-yr-every p { margin: 0; font-size: 15px; line-height: 1.55; color: var(--mkt-ink-soft); }
.pk-yr-note { margin: 18px 0 0; font-size: 14px; line-height: 1.6; color: var(--mkt-muted); }
.pk-yr-list { position: relative; }
.pk-yr-list::before { content: ''; position: absolute; left: 151px; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: var(--mkt-border-soft); }
.pk-yr-group + .pk-yr-group { margin-top: 12px; }
.pk-yr-glabel { display: grid; grid-template-columns: 140px 24px 1fr; gap: 0 0; margin-bottom: 6px; }
.pk-yr-glabel span { grid-column: 3; padding-left: 20px; font-size: 12.5px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--mkt-muted); }
.pk-yr-ev { display: grid; grid-template-columns: 140px 24px 1fr; align-items: start; padding: 12px 0; }
.pk-yr-date { padding-top: 3px; padding-right: 18px; text-align: right; font-size: 14px; font-weight: 700; color: var(--mkt-muted); font-variant-numeric: tabular-nums; line-height: 1.35; }
.pk-yr-ev.is-key .pk-yr-date { color: var(--mkt-ink); }
.pk-yr-dot { position: relative; z-index: 1; width: 12px; height: 12px; margin: 6px auto 0; border-radius: 50%; background: var(--mkt-ivory); border: 2px solid var(--mkt-btn-border); }
.pk-section:not(.is-alt) .pk-yr-dot { background: var(--mkt-page-bg); }
.pk-yr-ev.is-key .pk-yr-dot { width: 14px; height: 14px; margin-top: 5px; background: var(--mkt-accent-green-fg); border-color: var(--mkt-accent-green-fg); box-shadow: 0 0 0 5px var(--mkt-accent-green-soft); }
.pk-yr-body { padding-left: 20px; min-width: 0; }
.pk-yr-mdate { display: none; }
.pk-yr-etitle { margin: 0 0 6px; font-size: 18px; font-weight: 700; line-height: 1.3; letter-spacing: -0.01em; color: var(--mkt-ink); }
.pk-yr-ev:not(.is-key) .pk-yr-etitle { font-size: 16.5px; font-weight: 600; color: var(--mkt-ink-soft); }
.pk-yr-bokix { margin: 0; font-size: 15px; line-height: 1.55; color: var(--mkt-ink-soft); text-wrap: pretty; }
.pk-yr-bokix span { display: inline-block; margin-right: 8px; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; font-weight: 800; letter-spacing: 0.04em; vertical-align: 1px; color: var(--mkt-accent-green-fg); background: var(--mkt-accent-green-soft); }
.pk-yr-ev.is-empty .pk-yr-bokix { color: var(--mkt-muted); font-style: normal; }
.pk-yr-ev.is-empty .pk-yr-dot { width: 8px; height: 8px; margin-top: 8px; border-width: 0; background: var(--mkt-border-soft); }
.pk-cmp { border: 1px solid var(--mkt-card-border); border-radius: 16px; overflow: hidden; background: var(--mkt-card-bg); }
.pk-cmp-row { display: grid; grid-template-columns: minmax(0, 1fr) repeat(3, minmax(0, 1.15fr)); border-top: 1px solid var(--mkt-border-soft); }
.pk-cmp-row:first-child { border-top: 0; }
.pk-cmp-row > span { padding: 18px 22px; font-size: 15px; line-height: 1.5; color: var(--mkt-ink-soft); }
.pk-cmp-head > span { font-size: 15px; font-weight: 700; color: var(--mkt-ink); padding-top: 20px; padding-bottom: 20px; }
.pk-cmp-label { font-weight: 700; color: var(--mkt-ink) !important; }
.pk-cmp-row > span.is-us { background: var(--mkt-ivory); color: var(--mkt-ink); font-weight: 600; }
.pk-cmp-head > span.is-us { color: var(--mkt-accent-green-fg); }
html[data-theme="dark"] #lp-root .pk-cmp-row > span.is-us { background: #1c3022; }

.pk-price { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px 32px; padding: 30px 34px; border-radius: 18px; border: 1px solid var(--mkt-card-border); background: var(--mkt-card-bg); }
.pk-price-amount { font-size: clamp(30px, 3.6vw, 40px); font-weight: 800; letter-spacing: -0.02em; color: var(--mkt-ink); line-height: 1.1; }
.pk-price-amount small { font-size: 17px; font-weight: 600; color: var(--mkt-muted); letter-spacing: 0; }
.pk-price-text { font-size: 15.5px; line-height: 1.6; color: var(--mkt-ink-soft); margin: 8px 0 0; max-width: 560px; }

.pk-links { display: flex; flex-wrap: wrap; gap: 10px 24px; margin-top: 28px; }
.pk-links a { color: var(--mkt-accent-green-fg); font-weight: 600; font-size: 15px; }

@media (max-width: 960px) {
  .pk-yr { grid-template-columns: 1fr; gap: 36px; }
  .pk-yr-side { position: static; }
  .pk-reasons { grid-template-columns: 1fr; gap: 28px; }
  .pk-feature, .pk-feature.is-flip { grid-template-columns: 1fr; gap: 28px; }
  .pk-feature.is-flip .pk-feature-text { order: 0; }
  .pk-features { gap: 72px; }
}
@media (max-width: 640px) {
  .pk-yr-list::before { left: 7px; }
  .pk-yr-glabel, .pk-yr-ev { grid-template-columns: 16px 1fr; }
  .pk-yr-glabel span { grid-column: 2; padding-left: 16px; }
  .pk-yr-date { display: none; }
  .pk-yr-dot { margin-left: 1px; }
  .pk-yr-body { padding-left: 16px; }
  .pk-yr-mdate { display: block; font-size: 13px; font-weight: 700; color: var(--mkt-muted); margin-bottom: 2px; }
  .pk-yr-ev.is-key .pk-yr-mdate { color: var(--mkt-accent-green-fg); }
  .pk-hero { padding: 104px 16px 0; }
  .pk-hero-text { text-align: left; }
  .pk-hero-lead { margin-left: 0; font-size: 17.5px; }
  .pk-hero-actions { justify-content: flex-start; }
  .pk-show { margin-top: 36px; }
  .pk-tabs { justify-content: flex-start; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; margin: 0 -16px 14px; padding: 0 12px; }
  .pk-tabs::-webkit-scrollbar { display: none; }
  .pk-tab { flex: none; padding: 9px 12px 12px; font-size: 14.5px; }
  .pk-tab-line { left: 12px; right: 12px; }
  .pk-bar { height: 26px; }
  .pk-bar span { display: none; }
  .pk-caption { text-align: left; padding: 14px 0 0; }
  .pk-section { padding: 72px 16px; }
  .pk-head { text-align: left; margin-bottom: 36px; }
  .pk-cmp-head { display: none; }
  .pk-cmp-row { grid-template-columns: 1fr; padding: 8px 0; }
  .pk-cmp-row > span { padding: 6px 18px; }
  .pk-cmp-row > span[data-col]::before { content: attr(data-col) ': '; font-weight: 700; color: var(--mkt-muted); }
  .pk-cmp-row > span.is-us { margin: 4px 10px; border-radius: 8px; padding: 8px 10px; }
  .pk-price { padding: 24px 20px; }
}
@media (prefers-reduced-motion: reduce) {
  .pk-slide { transition: none; }
}
`;
