import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight } from '../icons';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, CARD_BORDER } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { TERMS } from './ordlistaTerms';

// ── Ordlista (/ordlista) ────────────────────────────────────────────────
// Den sida som svarar på frågan besökaren har INNAN hen ens vet att hen
// letar bokföringsprogram ("vad är en verifikation?"). Innehållet ligger i
// ordlistaTerms.js, den här filen är bara presentation: sökfält, gruppering
// per bokstav och strukturerad data.
//
// Upplägg sedan 2026-10-13 (användaren: "gör listan fin"): samma stil som
// /blogg, rubrik och sök till vänster, en bokstavsrad, och sedan orden som
// rader under en stor bokstav, som i ett riktigt lexikon. Inga kort, inga
// tomma hål i ett rutnät. Ord som börjar med en siffra (3:12-reglerna)
// hamnar under "#" först, i stället för en egen grupp "3".
//
// Sökningen är avsiktligt enkel — filtrering i minnet på en lista med
// femtio poster, ingen fuzzy-matchning och inget bibliotek. Poängen är att
// hitta ett ord man redan vet namnet på, inte att gissa fram det.

// DefinedTermSet är den schema.org-typ som faktiskt beskriver en ordlista
// (inte Article eller FAQPage). Byggd ur samma TERMS-lista som renderas,
// aldrig en parallell kopia — samma princip som FAQ_SCHEMA i
// LandingPage.jsx.
const GLOSSARY_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'DefinedTermSet',
  name: 'Bokix bokföringsordlista',
  description: 'Svenska bokförings-, skatte- och lönebegrepp förklarade på vanlig svenska.',
  url: `${SITE_URL}/ordlista`,
  inLanguage: 'sv-SE',
  hasDefinedTerm: TERMS.map(t => ({
    '@type': 'DefinedTerm',
    name: t.term,
    description: t.def,
  })),
};

/** Bokstaven en term grupperas under. Siffror samlas under "#". Å/Ä/Ö är
 * egna bokstäver sist i det svenska alfabetet — `localeCompare` med 'sv'
 * vet det, men gruppnyckeln måste plockas ut för hand. */
function initial(term) {
  const c = term.trim().charAt(0).toUpperCase();
  return /[0-9]/.test(c) ? '#' : c;
}
const byLetter = (a, b) => (a === '#' ? -1 : b === '#' ? 1 : a.localeCompare(b, 'sv'));
const termId = (term) => `term-${term.toLowerCase().replace(/[^a-zåäö0-9]+/g, '-').replace(/^-|-$/g, '')}`;
const letterId = (letter) => `bokstav-${letter === '#' ? 'siffror' : letter.toLowerCase()}`;

const CSS = `
  .bxo-wrap { max-width: 1200px; margin: 0 auto; }
  .bxo-head { padding: 116px 24px 0; }
  .bxo-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .bxo-h1 { font-family: ${SERIF}; font-size: clamp(38px, 6vw, 60px); font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1.05; margin: 0; }
  .bxo-count { font-size: 15px; color: ${MUTED}; margin: 10px 0 0; }
  .bxo-search { position: relative; width: min(380px, 100%); }
  .bxo-search input { width: 100%; padding: 13px 16px 13px 42px; font-size: 15px; font-family: inherit; color: ${INK}; background: var(--mkt-card-bg); border: 1.5px solid ${CARD_BORDER}; border-radius: 12px; transition: border-color 0.15s, box-shadow 0.15s; }
  .bxo-search input:focus { outline: none; border-color: var(--mkt-accent-green-fg); box-shadow: 0 0 0 3px var(--mkt-accent-green-soft); }

  .bxo-jump { position: sticky; top: 84px; z-index: 5; background: var(--mkt-page-bg); margin-top: 28px; padding: 10px 0; border-top: 1px solid var(--mkt-border-soft); border-bottom: 1px solid var(--mkt-border-soft); display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; }
  .bxo-jump::-webkit-scrollbar { display: none; }
  .bxo-jump a { flex: none; min-width: 34px; height: 34px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 14px; font-weight: 700; color: ${INK_SOFT}; text-decoration: none; }
  .bxo-jump a:hover { background: var(--mkt-ivory); color: ${INK}; }

  .bxo-group { display: grid; grid-template-columns: 140px minmax(0, 1fr); gap: 0 32px; padding: 34px 0 6px; border-bottom: 1px solid var(--mkt-border-soft); scroll-margin-top: 150px; }
  .bxo-letter { font-family: ${SERIF}; font-size: 64px; font-weight: 700; line-height: 1; color: var(--mkt-accent-green-fg); margin: 0; position: sticky; top: 160px; align-self: start; }
  .bxo-list { list-style: none; margin: 0; padding: 0; }
  .bxo-item { display: grid; grid-template-columns: minmax(180px, 280px) minmax(0, 1fr); gap: 8px 32px; padding: 4px 0 26px; scroll-margin-top: 150px; }
  .bxo-item + .bxo-item { padding-top: 22px; border-top: 1px solid var(--mkt-border-soft); }
  .bxo-term { font-family: ${SERIF}; font-size: 21px; font-weight: 700; color: ${INK}; line-height: 1.25; letter-spacing: -0.01em; margin: 0; }
  .bxo-def { font-size: 16px; line-height: 1.7; color: ${INK_SOFT}; margin: 0; max-width: 680px; }
  .bxo-tool { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; font-size: 14px; font-weight: 700; color: var(--mkt-accent-green-fg); text-decoration: none; }
  .bxo-tool:hover { text-decoration: underline; text-underline-offset: 3px; }

  .bxo-cta { margin: 64px 0 100px; padding: 36px 0 0; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
  .bxo-cta h2 { font-family: ${SERIF}; font-size: clamp(24px, 3vw, 32px); font-weight: 700; color: ${INK}; margin: 0 0 6px; letter-spacing: -0.01em; }
  .bxo-cta p { font-size: 16px; color: ${MUTED}; margin: 0; }

  @media (max-width: 900px) {
    .bxo-group { grid-template-columns: 1fr; }
    .bxo-letter { position: static; font-size: 48px; margin-bottom: 18px; }
    .bxo-item { grid-template-columns: 1fr; }
  }
  @media (max-width: 600px) {
    .bxo-head { padding-top: 100px; }
    .bxo-jump { top: 84px; }
    .bxo-term { font-size: 19px; }
  }
`;

export default function OrdlistaPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? TERMS.filter(t => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q))
      : TERMS;
    const sorted = [...filtered].sort((a, b) => a.term.localeCompare(b.term, 'sv'));
    const map = new Map();
    for (const t of sorted) {
      const letter = initial(t.term);
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter).push(t);
    }
    return [...map.entries()].sort(([a], [b]) => byLetter(a, b));
  }, [query]);

  // Bokstäver som har minst en term, i svensk bokstavsordning (Å/Ä/Ö sist).
  const letters = useMemo(() => [...new Set(TERMS.map(t => initial(t.term)))].sort(byLetter), []);

  const total = TERMS.length;
  const shown = groups.reduce((n, [, items]) => n + items.length, 0);

  return (
    <MarketingLayout>
      <PageMeta
        title="Bokföringsordlista: termer förklarade enkelt | Bokix"
        description={`${total} bokförings-, skatte- och lönebegrepp förklarade på vanlig svenska: verifikation, periodisering, AGI, K2, SIE-fil, egenavgifter och fler.`}
        path="/ordlista"
      />
      <JsonLd data={GLOSSARY_SCHEMA} />
      <style>{CSS}</style>

      <header className="bxo-head">
        <div className="bxo-wrap">
          <div className="bxo-top">
            <div>
              <h1 className="bxo-h1">Ordlista</h1>
              <p className="bxo-count" aria-live="polite">
                {query
                  ? (shown === 0 ? 'Inga träffar. Prova ett annat ord.' : `${shown} av ${total} ord`)
                  : `${total} ord om bokföring, skatt och lön`}
              </p>
            </div>
            <div className="bxo-search">
              <Search size={17} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
              <input
                type="search"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Sök ett ord"
                aria-label="Sök i ordlistan"
              />
            </div>
          </div>
        </div>
      </header>

      <section style={{ padding: '0 24px' }}>
        <div className="bxo-wrap">
          {/* Bokstavsraden byggs ur de bokstäver som FAKTISKT har termer
              (inte hela alfabetet) — en död länk till "Q" hjälper ingen.
              Den ligger här och inte i rubriken, så att den följer med
              (sticky) genom hela listan. */}
          {!query && (
            <nav className="bxo-jump" aria-label="Hoppa till bokstav">
              {letters.map(letter => (
                <a key={letter} href={`#${letterId(letter)}`}>{letter}</a>
              ))}
            </nav>
          )}
          {groups.map(([letter, items]) => (
            <div key={letter} className="bxo-group" id={letterId(letter)}>
              <h2 className="bxo-letter" aria-label={letter === '#' ? 'Siffror' : `Bokstaven ${letter}`}>{letter}</h2>
              <ul className="bxo-list">
                {items.map(t => (
                  <li key={t.term} id={termId(t.term)} className="bxo-item">
                    <h3 className="bxo-term">{t.term}</h3>
                    <div>
                      <p className="bxo-def">{t.def}</p>
                      {t.tool && (
                        <Link to={t.tool} className="bxo-tool">Räkna på det <ArrowRight size={14} /></Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="bxo-cta">
            <div>
              <h2>Slipp lära dig alltihop</h2>
              <p>Bokix väljer konton åt dig och frågar bara när något är oklart.</p>
            </div>
            <div className="lp-cta-group" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '14px 26px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
                Prova gratis i 30 dagar
              </button>
              <Link to="/verktyg" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
                Gratisverktygen <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
