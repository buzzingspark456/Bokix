import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown } from '../icons';
import { BRAND } from '../../utils/brandColors';
import { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED } from './marketingTokens';
import { SHOT_WIDTH, SHOT_HEIGHT } from '../../content/marketing/screenshots';

// ── Delade byggstenar för produktundersidorna (Funktioner, Integrationer,
// Byt till Bokix, Säkerhet). Kundönskemål 2026-09-26: solida ytor, en
// accentfärg, inga ikonrutor och inga kortrutnät där en lista räcker.
// Varje sida får i stället EN egen animation i hjälten; resten är lugna
// tvåspaltiga rader (rubrik till vänster, innehåll till höger) med tunna
// skiljelinjer, samma rytm på alla fyra sidorna.

export function KitStyles() {
  return (
    <style>{`
      .kx-hero { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr); gap: 64px; align-items: center; max-width: 1120px; margin: 0 auto; }
      .kx-eyebrow { font-size: 12.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; margin-bottom: 16px; }
      .kx-fit { container-type: inline-size; }
      .kx-fit .kx-h1 { font-size: clamp(26px, 9cqi, 52px); }
      .kx-h1 { font-family: ${SERIF}; font-size: clamp(32px, 4.8vw, 52px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: ${INK}; margin: 0 0 18px; }
      .kx-lead { font-size: 17.5px; line-height: 1.65; color: ${MUTED}; margin: 0 0 30px; max-width: 520px; }
      .kx-actions { display: flex; gap: 12px; flex-wrap: wrap; }
      .kx-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 26px; border-radius: 12px; font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; }
      .kx-btn-primary { background: ${BRAND.green}; color: #fff; border: none; }
      .kx-btn-ghost { background: transparent; color: ${INK}; border: 1.5px solid var(--mkt-btn-border); }

      .kx-section { padding: 88px 24px; border-top: 1px solid var(--mkt-border-soft); }
      .kx-split { display: grid; grid-template-columns: minmax(0, 320px) minmax(0, 1fr); gap: 64px; max-width: 1120px; margin: 0 auto; align-items: start; }
      .kx-split-head { position: sticky; top: 110px; }
      .kx-h2 { font-family: ${SERIF}; font-size: clamp(25px, 3.2vw, 34px); font-weight: 700; letter-spacing: -0.015em; line-height: 1.15; color: ${INK}; margin: 0 0 12px; }
      .kx-sub { font-size: 15.5px; line-height: 1.65; color: ${MUTED}; margin: 0; }

      .kx-list { border-top: 1px solid var(--mkt-border-soft); }
      .kx-row { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 28px; padding: 22px 0; border-bottom: 1px solid var(--mkt-border-soft); }
      .kx-row-title { font-size: 15.5px; font-weight: 700; color: ${INK}; line-height: 1.4; }
      .kx-row-meta { display: block; margin-top: 4px; font-size: 12.5px; font-weight: 500; color: ${MUTED}; }
      .kx-row-body { font-size: 15px; line-height: 1.65; color: ${INK_SOFT}; margin: 0; }

      .kx-steps { counter-reset: kx; border-top: 1px solid var(--mkt-border-soft); }
      .kx-step { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 18px; padding: 24px 0; border-bottom: 1px solid var(--mkt-border-soft); }
      .kx-step-n { font-family: ${SERIF}; font-size: 30px; font-weight: 700; line-height: 1; color: ${BRAND.green}; font-variant-numeric: tabular-nums; }
      html[data-theme="dark"] #lp-root .kx-step-n { color: var(--mkt-accent-green-fg); }

      .kx-faq-q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 20px 0; background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; font-size: 15.5px; font-weight: 700; color: ${INK}; }
      .kx-faq-q .chev { flex-shrink: 0; color: ${MUTED}; transition: transform 0.25s ease; }
      .kx-faq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .kx-faq-open .kx-faq-a { grid-template-rows: 1fr; }
      .kx-faq-open .chev { transform: rotate(180deg); }

      .kx-cta { padding: 96px 24px 110px; text-align: center; border-top: 1px solid var(--mkt-border-soft); }

      @media (max-width: 900px) {
        .kx-hero { grid-template-columns: 1fr; gap: 40px; }
        .kx-split { grid-template-columns: 1fr; gap: 28px; }
        .kx-split-head { position: static; }
        .kx-section { padding: 64px 20px; }
      }
      @media (max-width: 620px) {
        .kx-row { grid-template-columns: 1fr; gap: 6px; padding: 18px 0; }
        .kx-step { grid-template-columns: 44px minmax(0, 1fr); gap: 12px; }
        .kx-step-n { font-size: 24px; }
      }
    `}</style>
  );
}

// fitTitle: rubriken krymper efter textkolumnens bredd (container query), så
// att långa ord som "Faktureringsprogram" aldrig går ut över bilden bredvid,
// t.ex. i halv skärm. Används av sökordssidorna (OrgTypePage).
export function SubHero({ eyebrow, title, lead, actions, visual, fitTitle = false }) {
  return (
    <section style={{ padding: '140px 24px 80px', background: 'var(--mkt-page-bg)' }}>
      <div className="kx-hero">
        <Reveal className={fitTitle ? 'kx-fit' : undefined} style={fitTitle ? { minWidth: 0 } : undefined}>
          {eyebrow && <div className="kx-eyebrow">{eyebrow}</div>}
          <h1 className="kx-h1">{title}</h1>
          {lead && <p className="kx-lead">{lead}</p>}
          {actions && <div className="kx-actions">{actions}</div>}
        </Reveal>
        <Reveal delay={120} style={{ minWidth: 0 }}>{visual}</Reveal>
      </div>
    </section>
  );
}

export function PrimaryButton({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="kx-btn kx-btn-primary lp-btn-primary">
      {children} <ArrowRight size={16} />
    </button>
  );
}

export function GhostLink({ to, href, children }) {
  if (href) return <a href={href} className="kx-btn kx-btn-ghost lp-btn-secondary">{children}</a>;
  return <Link to={to} className="kx-btn kx-btn-ghost lp-btn-secondary">{children}</Link>;
}

/** Tvåspaltig sektion: rubriken står kvar (sticky) medan innehållet skrollar. */
export function KitSection({ id, title, lead, alt = false, children }) {
  return (
    <section id={id} className="kx-section" style={{ background: alt ? 'var(--mkt-ivory)' : 'var(--mkt-page-bg)', scrollMarginTop: '84px' }}>
      <div className="kx-split">
        <Reveal className="kx-split-head">
          <h2 className="kx-h2">{title}</h2>
          {lead && <p className="kx-sub">{lead}</p>}
        </Reveal>
        <Reveal delay={80} style={{ minWidth: 0 }}>{children}</Reveal>
      </div>
    </section>
  );
}

/** Centrerad sektion: rubrik och ingress i mitten, innehållet under. */
export function CenterSection({ id, title, lead, alt = false, children }) {
  return (
    <section id={id} className="kx-section" style={{ background: alt ? 'var(--mkt-ivory)' : 'var(--mkt-page-bg)', scrollMarginTop: '84px' }}>
      <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 40px' }}>
        <h2 className="kx-h2" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>{title}</h2>
        {lead && <p className="kx-sub" style={{ fontSize: '17px' }}>{lead}</p>}
      </Reveal>
      <Reveal scale delay={60}>{children}</Reveal>
    </section>
  );
}

/** Rader med tunna linjer: titel (och ev. metarad) till vänster, text till höger. */
export function SpecList({ items }) {
  return (
    <div className="kx-list">
      {items.map(it => (
        <div key={it.title} className="kx-row">
          <div className="kx-row-title">
            {it.title}
            {it.meta && <span className="kx-row-meta">{it.meta}</span>}
          </div>
          <p className="kx-row-body">{it.body}</p>
        </div>
      ))}
    </div>
  );
}

/** Enkla rader utan rubrik, för punktlistor (en mening per rad). */
export function PointList({ items }) {
  return (
    <div className="kx-list">
      {items.map(p => (
        <p key={p} className="kx-row-body" style={{ padding: '14px 0', borderBottom: '1px solid var(--mkt-border-soft)' }}>{p}</p>
      ))}
    </div>
  );
}

export function StepList({ items }) {
  return (
    <div className="kx-steps">
      {items.map((s, i) => (
        <div key={s.title} className="kx-step">
          <span className="kx-step-n">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <div className="kx-row-title" style={{ marginBottom: '6px' }}>{s.title}</div>
            <p className="kx-row-body">{s.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function FaqRow({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={open ? 'kx-faq-open' : undefined} style={{ borderBottom: '1px solid var(--mkt-border-soft)' }}>
      <button type="button" className="kx-faq-q" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {q}
        <ChevronDown size={18} className="chev" />
      </button>
      <div className="kx-faq-a">
        <div style={{ overflow: 'hidden' }}>
          <p className="kx-row-body" style={{ padding: '0 0 20px' }}>{a}</p>
        </div>
      </div>
    </div>
  );
}

export function KitFaq({ items }) {
  return (
    <div style={{ borderTop: '1px solid var(--mkt-border-soft)' }}>
      {items.map(it => <FaqRow key={it.q} {...it} />)}
    </div>
  );
}

export function KitCta({ title, lead, children }) {
  return (
    <section className="kx-cta" style={{ background: 'var(--mkt-page-bg)' }}>
      <Reveal style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 className="kx-h2" style={{ fontSize: 'clamp(27px, 3.8vw, 38px)' }}>{title}</h2>
        {lead && <p className="kx-sub" style={{ margin: '0 auto 28px' }}>{lead}</p>}
        <div className="kx-actions" style={{ justifyContent: 'center' }}>{children}</div>
      </Reveal>
    </section>
  );
}

/**
 * Riktiga skärmbilder ur appen som <img> med alt-text och bildtext, så att
 * Google bildsök har något att indexera (de ritade demona går inte att
 * indexera). Bilderna och vilka sidor som visar dem: content/marketing/
 * screenshots.js.
 */
export function ProductShots({ shots, title = 'Så ser det ut i Bokix', lead, alt = false }) {
  if (!shots?.length) return null;
  return (
    <section className="kx-section" style={{ background: alt ? 'var(--mkt-ivory)' : 'var(--mkt-page-bg)' }}>
      <style>{`
        .kx-shots { display: grid; gap: 40px; max-width: 1080px; margin: 0 auto; }
        .kx-shots.kx-shots-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
        .kx-shot { margin: 0; }
        .kx-shot img { width: 100%; height: auto; display: block; border-radius: 12px; border: 1px solid var(--mkt-card-border); box-shadow: 0 18px 40px -28px rgba(28,36,32,0.45); background: #fff; }
        .kx-shot figcaption { font-size: 14.5px; color: var(--mkt-muted); margin-top: 12px; line-height: 1.5; }
        @media (max-width: 760px) { .kx-shots.kx-shots-2 { grid-template-columns: 1fr; } }
      `}</style>
      <div style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px' }}>
        <h2 className="kx-h2" style={{ fontSize: 'clamp(26px, 3.6vw, 38px)' }}>{title}</h2>
        {lead && <p className="kx-sub" style={{ fontSize: '17px' }}>{lead}</p>}
      </div>
      <div className={`kx-shots${shots.length > 1 ? ' kx-shots-2' : ''}`}>
        {shots.map(shot => (
          <figure key={shot.src} className="kx-shot">
            <img src={shot.src} alt={shot.alt} width={SHOT_WIDTH} height={SHOT_HEIGHT} loading="lazy" decoding="async" />
            {shot.caption && <figcaption>{shot.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}
