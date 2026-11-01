import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Search, X } from '../icons';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { INK, INK_SOFT, MUTED } from './marketingTokens';
import { PageMeta, JsonLd } from '../../utils/seo';
import { FAQ_GROUPS, FAQ_TOP, FAQ_SCHEMA } from './faqData';

// ── Vanliga frågor (/vanliga-fragor) ────────────────────────────────────
// Kundönskemål 2026-09-28: sidan var "amatörmässig", en lång numrerad lista.
// Nu: det viktigaste först (sex kortsvar som syns direkt), sedan frågorna
// grupperade efter ämne med en meny till vänster, och en sökruta. Varje
// svar börjar med det raka svaret, som visas i fetstil. Innehållet ligger i
// faqData.js, som också ger startsidans FAQ-kort och FAQPage-schemat.

const slug = (s) => s.toLowerCase()
  .replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/é/g, 'e')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Första meningen i fetstil: det raka svaret.
function Answer({ text }) {
  const m = text.match(/^(.+?[.?!])\s(.*)$/s);
  if (!m) return <p className="fq-a-text"><strong>{text}</strong></p>;
  return <p className="fq-a-text"><strong>{m[1]}</strong> {m[2]}</p>;
}

function Row({ item, open, onToggle }) {
  const id = slug(item.q);
  return (
    <div id={id} className={`fq-row${open ? ' fq-open' : ''}`}>
      <h3 className="fq-q-wrap">
        <button type="button" className="fq-q" onClick={() => onToggle(id)} aria-expanded={open} aria-controls={`${id}-svar`}>
          <span>{item.q}</span>
          <ChevronDown size={20} className="fq-chev" />
        </button>
      </h3>
      <div className="fq-a" id={`${id}-svar`} role="region">
        <div style={{ overflow: 'hidden' }}><Answer text={item.a} /></div>
      </div>
    </div>
  );
}

const CSS = `
  .fq-hero { padding: 140px 24px 56px; text-align: center; background: var(--mkt-page-bg); }
  .fq-search { position: relative; max-width: 520px; margin: 30px auto 0; }
  .fq-search input { width: 100%; box-sizing: border-box; height: 54px; padding: 0 48px 0 50px; border-radius: 14px; border: 1px solid var(--mkt-border-soft); background: var(--mkt-card-bg); color: ${INK}; font: inherit; font-size: 16px; outline: none; box-shadow: 0 10px 30px -22px rgba(15, 40, 25, 0.35); }
  .fq-search input:focus { border-color: var(--mkt-accent-green-fg); }
  .fq-search input::-webkit-search-cancel-button { -webkit-appearance: none; display: none; }
  .fq-search .fq-ic { position: absolute; left: 17px; top: 50%; transform: translateY(-50%); color: ${MUTED}; pointer-events: none; }
  .fq-search .fq-clear { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; border: none; background: none; color: ${MUTED}; cursor: pointer; border-radius: 8px; display: grid; place-items: center; }

  .fq-wrap { max-width: 1120px; margin: 0 auto; }
  .fq-top { padding: 8px 24px 88px; background: var(--mkt-page-bg); }
  .fq-top-title { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; margin: 0 0 22px; }
  .fq-top-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 48px; }
  .fq-top-item { padding: 24px 0 26px; border-top: 1px solid var(--mkt-border-soft); }
  .fq-top-item h2 { font-size: 17px; font-weight: 700; color: ${INK}; margin: 0 0 8px; line-height: 1.35; }
  .fq-top-item p { font-size: 15.5px; line-height: 1.6; color: ${INK_SOFT}; margin: 0 0 12px; }
  .fq-more { background: none; border: none; padding: 0; font: inherit; font-size: 14px; font-weight: 600; color: var(--mkt-accent-green-fg); cursor: pointer; }
  .fq-more:hover { text-decoration: underline; }

  .fq-main { padding: 88px 24px 96px; border-top: 1px solid var(--mkt-border-soft); background: var(--mkt-page-bg); }
  .fq-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 72px; align-items: start; }
  .fq-nav { position: sticky; top: 110px; display: flex; flex-direction: column; gap: 2px; }
  .fq-nav a { display: flex; justify-content: space-between; padding: 8px 12px; margin-left: -12px; border-radius: 9px; font-size: 14.5px; font-weight: 600; color: ${MUTED}; text-decoration: none; }
  .fq-nav a:hover { color: ${INK}; background: var(--mkt-card-bg); }
  .fq-nav a span { font-weight: 500; opacity: 0.7; }
  .fq-group { scroll-margin-top: 100px; }
  .fq-group + .fq-group { margin-top: 64px; }
  .fq-group-title { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; color: ${INK}; margin: 0 0 8px; }
  .fq-list { border-top: 1px solid var(--mkt-border-soft); }

  .fq-row { border-bottom: 1px solid var(--mkt-border-soft); scroll-margin-top: 100px; }
  .fq-q-wrap { margin: 0; font-size: inherit; }
  .fq-q { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 21px 0; background: none; border: none; cursor: pointer; text-align: left; font-family: inherit; font-size: 16.5px; font-weight: 600; color: ${INK}; line-height: 1.4; }
  .fq-q:hover span { color: var(--mkt-accent-green-fg); }
  .fq-chev { flex-shrink: 0; color: ${MUTED}; transition: transform 0.25s ease; }
  .fq-open .fq-chev { transform: rotate(180deg); }
  .fq-a { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  .fq-open .fq-a { grid-template-rows: 1fr; }
  .fq-a-text { margin: 0; padding: 0 40px 24px 0; max-width: 700px; font-size: 15.5px; line-height: 1.7; color: ${INK_SOFT}; }
  .fq-a-text strong { color: ${INK}; font-weight: 700; }
  .fq-hit-group { display: block; font-size: 12px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: ${MUTED}; margin-top: 18px; }
  .fq-hits .fq-chev { display: none; }
  .fq-hits .fq-q { cursor: default; padding-top: 6px; }
  .fq-hits .fq-q:hover span { color: inherit; }
  .fq-empty { text-align: center; padding: 40px 0; color: ${MUTED}; font-size: 16px; }

  @media (max-width: 900px) {
    .fq-top-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 32px; }
    .fq-layout { grid-template-columns: 1fr; gap: 0; }
    .fq-nav { display: none; }
  }
  @media (max-width: 600px) {
    .fq-hero { padding: 116px 20px 40px; }
    .fq-top { padding: 0 20px 64px; }
    .fq-top-grid { grid-template-columns: 1fr; }
    .fq-main { padding: 64px 20px 72px; }
    .fq-a-text { padding-right: 0; }
    .fq-q { font-size: 16px; padding: 18px 0; }
  }
`;

export default function FaqPage() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const toggle = (id) => setOpen(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // Öppna och rulla till en fråga (från "Det viktigaste" eller en länk med #fråga).
  const reveal = (id) => {
    setOpen(prev => new Set(prev).add(id));
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id && FAQ_GROUPS.some(g => g.items.some(i => slug(i.q) === id))) reveal(id);
  }, []);

  const q = query.trim().toLowerCase();
  const hits = useMemo(() => !q ? [] : FAQ_GROUPS.flatMap(g => g.items
    .filter(i => `${i.q} ${i.a}`.toLowerCase().includes(q))
    .map(i => ({ ...i, group: g.title }))), [q]);

  return (
    <MarketingLayout>
      <PageMeta
        title="Vanliga frågor om Bokix"
        description="Raka svar om Bokix: vad det kostar, om du behöver kunna bokföring, vilka företag det passar, moms, lön, kortbetalningar och säkerhet."
        path="/vanliga-fragor"
      />
      <JsonLd data={FAQ_SCHEMA} />
      <KitStyles />
      <style>{CSS}</style>

      <section className="fq-hero">
        <Reveal style={{ maxWidth: '680px', margin: '0 auto' }}>
          <h1 className="kx-h1">Vanliga frågor</h1>
          <p className="kx-lead" style={{ margin: '0 auto' }}>Raka svar, det viktigaste först.</p>
          <div className="fq-search" role="search">
            <Search size={20} className="fq-ic" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök, till exempel moms eller pris"
              aria-label="Sök bland frågorna"
            />
            {query && <button type="button" className="fq-clear" onClick={() => setQuery('')} aria-label="Rensa sökningen"><X size={18} /></button>}
          </div>
        </Reveal>
      </section>

      {q ? (
        <section className="fq-top" style={{ paddingBottom: 96 }}>
          <div className="fq-wrap" style={{ maxWidth: 760 }}>
            {hits.length ? (
              <>
                <p className="fq-top-title">{hits.length === 1 ? '1 fråga' : `${hits.length} frågor`}</p>
                <div className="fq-list fq-hits">
                  {hits.map(item => (
                    <div key={item.q}>
                      <span className="fq-hit-group">{item.group}</span>
                      <Row item={item} open onToggle={() => {}} />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="fq-empty">Inga frågor matchar "{query}". Skriv till oss på <a href="mailto:bokixab@gmail.com" style={{ color: 'var(--mkt-accent-green-fg)' }}>bokixab@gmail.com</a>.</p>
            )}
          </div>
        </section>
      ) : (
        <>
          <section className="fq-top" aria-labelledby="fq-viktigast">
            <div className="fq-wrap">
              <p className="fq-top-title" id="fq-viktigast">Det viktigaste</p>
              <div className="fq-top-grid">
                {FAQ_TOP.map(item => (
                  <div key={item.q} className="fq-top-item">
                    <h2>{item.q}</h2>
                    <p>{item.short}</p>
                    <button type="button" className="fq-more" onClick={() => reveal(slug(item.q))}>Läs hela svaret</button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="fq-main">
            <div className="fq-wrap fq-layout">
              <nav className="fq-nav" aria-label="Ämnen">
                {FAQ_GROUPS.map(g => <a key={g.id} href={`#${g.id}`}>{g.title}<span>{g.items.length}</span></a>)}
              </nav>
              <div>
                {FAQ_GROUPS.map(g => (
                  <div key={g.id} id={g.id} className="fq-group">
                    <h2 className="fq-group-title">{g.title}</h2>
                    <div className="fq-list">
                      {g.items.map(item => <Row key={item.q} item={item} open={open.has(slug(item.q))} onToggle={toggle} />)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>
      )}

      <KitCta title="Hittade du inte svaret?" lead="Skriv till oss, så svarar vi. Support ingår i priset.">
        <PrimaryButton onClick={() => navigate('/kontakt')}>Kontakta oss</PrimaryButton>
        <GhostLink to="/guider">Se videoguiderna</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
