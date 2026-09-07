import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Calculator } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { AuroraLayer } from './aurora';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { TERMS } from './ordlistaTerms';

// ── Ordlista (/ordlista) ────────────────────────────────────────────────
// Den sida som svarar på frågan besökaren har INNAN hen ens vet att hen
// letar bokföringsprogram ("vad är en verifikation?"). Innehållet ligger i
// ordlistaTerms.js, den här filen är bara presentation: sökfält, gruppering
// per bokstav och strukturerad data.
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

/** Bokstaven en term ska sorteras/grupperas under. Å/Ä/Ö är egna bokstäver
 * sist i det svenska alfabetet — `localeCompare` med 'sv' vet det, men
 * gruppnyckeln måste plockas ut för hand. */
function initial(term) {
  return term.trim().charAt(0).toUpperCase();
}

export default function OrdlistaPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? TERMS.filter(t => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q))
      : TERMS;
    const sorted = [...filtered].sort((a, b) => a.term.localeCompare(b.term, 'sv'));
    const byLetter = new Map();
    for (const t of sorted) {
      const letter = initial(t.term);
      if (!byLetter.has(letter)) byLetter.set(letter, []);
      byLetter.get(letter).push(t);
    }
    return [...byLetter.entries()];
  }, [query]);

  // Bokstäver som har minst en term, i svensk bokstavsordning (Å/Ä/Ö sist).
  const letters = useMemo(
    () => [...new Set(TERMS.map(t => initial(t.term)))].sort((a, b) => a.localeCompare(b, 'sv')),
    []
  );

  const total = TERMS.length;
  const shown = groups.reduce((n, [, items]) => n + items.length, 0);

  return (
    <MarketingLayout>
      <PageMeta
        title="Bokföringsordlista — bokförings- och skattetermer förklarade | Bokix"
        description={`${total} bokförings-, skatte- och lönebegrepp förklarade på vanlig svenska: verifikation, periodisering, AGI, K2, SIE-fil, egenavgifter och fler.`}
        path="/ordlista"
      />
      <JsonLd data={GLOSSARY_SCHEMA} />
      <style>{`
        .bx-ord-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .bx-ord-jump { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
        .bx-ord-jump a { text-decoration: none; }
        @media (max-width: 1080px) { .bx-ord-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .bx-ord-search:focus { outline: none; border-color: var(--mkt-accent-green-fg); box-shadow: 0 0 0 3px var(--mkt-accent-green-soft); }
        @media (max-width: 780px) { .bx-ord-grid { grid-template-columns: 1fr; } }
      `}</style>

      <section style={{ padding: '150px 24px 44px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer stops={[['rgba(14,165,233,0.16)', '4% -8%'], ['rgba(20,184,166,0.14)', '97% 105%']]} />
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.6vw, 48px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.15 }}>
            Bokföringsord, på svenska
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, margin: '0 0 26px' }}>
            {total} begrepp ur bokföring, skatt och lön — förklarade utan att förklaringen kräver en egen förklaring.
          </p>

          <div style={{ position: 'relative', maxWidth: '440px', margin: '0 auto' }}>
            <Search size={17} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: MUTED, pointerEvents: 'none' }} />
            <input
              className="bx-ord-search"
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Sök efter ett ord…"
              aria-label="Sök i ordlistan"
              style={{
                width: '100%', padding: '13px 16px 13px 42px', fontSize: '15px', fontFamily: 'inherit',
                color: INK, background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`,
                borderRadius: '12px', transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
            />
          </div>
          {/* Bokstavsraden byggs ur de bokstäver som FAKTISKT har termer
              (inte hela alfabetet) — en död länk till "Q" hjälper ingen. */}
          {!query && (
            <nav className="bx-ord-jump" aria-label="Hoppa till bokstav" style={{ marginTop: '20px' }}>
              {letters.map(letter => (
                <a
                  key={letter}
                  href={`#bokstav-${letter.toLowerCase()}`}
                  style={{
                    minWidth: 30, padding: '5px 8px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                    color: INK_SOFT, background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, textAlign: 'center',
                  }}
                >
                  {letter}
                </a>
              ))}
            </nav>
          )}
          {query && (
            <p style={{ fontSize: '13px', color: MUTED, margin: '12px 0 0' }} aria-live="polite">
              {shown === 0 ? 'Inga träffar. Prova ett annat ord.' : `${shown} av ${total} begrepp matchar "${query}".`}
            </p>
          )}
        </Reveal>
      </section>

      <section style={{ padding: '30px 24px 60px', background: 'var(--mkt-page-bg)' }}>
        {/* Bredare än sajtens vanliga 900px — tre kolumner definitionstext
            behöver det för att inte varje kort ska bli en smal remsa. */}
        <div style={{ maxWidth: '1140px', margin: '0 auto' }}>
          {groups.map(([letter, items], gi) => (
            <div key={letter} style={{ marginBottom: '36px' }}>
              <h2 id={`bokstav-${letter.toLowerCase()}`} style={{
                fontFamily: SERIF, fontSize: '26px', fontWeight: 700, color: INK, margin: '0 0 16px',
                paddingBottom: '10px', borderBottom: `1px solid ${CARD_BORDER}`, scrollMarginTop: '96px',
              }}>
                {letter}
              </h2>
              <div className="bx-ord-grid">
                {items.map((t, i) => (
                  <Reveal
                    key={t.term}
                    delay={Math.min(i * 40, 160)}
                    id={`term-${t.term.toLowerCase().replace(/[^a-zåäö0-9]+/g, '-').replace(/^-|-$/g, '')}`}
                    style={{
                      background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`,
                      borderRadius: '14px', padding: '18px 20px', boxShadow: gi === 0 ? CARD_SHADOW : 'none',
                      scrollMarginTop: '90px',
                    }}
                  >
                    <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.005em' }}>{t.term}</h3>
                    <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{t.def}</p>
                    {t.tool && (
                      <Link to={t.tool} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '11px', fontSize: '13px', fontWeight: 700, color: ACCENT.green.fg, textDecoration: 'none' }}>
                        <Calculator size={13} /> Räkna på det
                      </Link>
                    )}
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ padding: '0 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '900px', margin: '0 auto', background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: 'clamp(28px, 5vw, 46px)', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.4vw, 32px)', fontWeight: 700, color: INK, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
            Slipp lära dig alltihop
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.7, margin: '0 auto 26px', maxWidth: '540px' }}>
            Du behöver inte kunna kontoplanen utantill för att sköta din bokföring. Bokix konterar automatiskt och frågar bara när något faktiskt är oklart.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis i 30 dagar
            </button>
            <Link to="/verktyg" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se gratisverktygen <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
