import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { GUIDE_GROUPS } from '../../content/marketing/guides';
import useSiteTheme from '../../utils/useSiteTheme';

// ── Videoguider (/guider) ───────────────────────────────────────────────
// Riktiga skärminspelningar av appen med berättarröst och klickljud ligger
// i public/videos/. Varje film har en egen, förrenderad visningssida.

const GROUPS = GUIDE_GROUPS;

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE_URL}/guider`,
  name: 'Videoguider för Bokix',
  url: `${SITE_URL}/guider`,
  inLanguage: 'sv-SE',
  hasPart: GROUPS.flatMap(group => group.guides).map(guide => ({
    '@type': 'WebPage',
    name: guide.title,
    description: guide.lead,
    url: `${SITE_URL}/guider/${guide.slug}`,
  })),
};

export default function GuidesPage() {
  const navigate = useNavigate();
  const theme = useSiteTheme();
  return (
    <MarketingLayout>
      <PageMeta
        title="Videoguider: så gör du i Bokix"
        description="Korta filmer med berättarröst som visar hur du gör i Bokix: kunder, fakturor, offerter, kvitton, bokföring, lön, moms och rapporter."
        path="/guider"
        image={`${SITE_URL}/videos/skicka-faktura.jpg`}
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <style>{`
        .gd-wrap { max-width: 1120px; margin: 0 auto; }
        .gd-group + .gd-group { margin-top: 72px; }
        .gd-group-title { margin: 0 0 22px; }
        .gd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 40px 32px; }
        .gd-card { display: block; color: inherit; text-decoration: none; }
        .gd-poster { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 940; object-fit: cover; border-radius: 14px; border: 1px solid var(--mkt-border-soft); background: #eef2ef; box-shadow: 0 24px 50px -34px rgba(15, 40, 25, 0.35); }
        .gd-card:focus-visible .gd-poster { outline: 3px solid var(--mkt-accent-green-fg); outline-offset: 3px; }
        .gd-title { font-size: 17px; font-weight: 700; margin: 16px 0 4px; }
        .gd-lead { font-size: 15px; line-height: 1.55; margin: 0; }
        .gd-watch-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 7px; color: var(--mkt-accent-green-fg); font-size: 14px; font-weight: 700; text-decoration: none; }
        @media (max-width: 760px) {
          .gd-grid { grid-template-columns: 1fr; gap: 36px; }
        }
      `}</style>

      <section style={{ padding: '140px 24px 56px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <h1 className="kx-h1">Videoguider</h1>
          <p className="kx-lead" style={{ margin: '0 auto' }}>
            Se hur det går till i Bokix. Korta filmer med berättarröst, inspelade i appen med påhittade exempelföretag.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '24px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <div className="gd-wrap">
          {GROUPS.map(group => (
            <div key={group.title} className="gd-group">
              <h2 className="kx-h2 gd-group-title">{group.title}</h2>
              <div className="gd-grid">
                {group.guides.map(g => (
                  <Reveal key={g.slug}>
                    <article id={g.slug}>
                      <Link className="gd-card" to={`/guider/${g.slug}`} aria-label={`Spela videon: ${g.title}`}>
                        <img className="gd-poster" src={`/videos/${g.slug}${theme === 'dark' ? '-dark' : ''}.jpg`} alt={`Videoguide: ${g.title}`} loading="lazy" width="1600" height="940" />
                      </Link>
                      <h3 className="kx-row-title gd-title">{g.title}</h3>
                      <p className="kx-sub gd-lead">{g.lead}</p>
                      <Link className="gd-watch-link" to={`/guider/${g.slug}`}>Se videon</Link>
                    </article>
                  </Reveal>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <KitCta title="Prova själv" lead="Samma steg fungerar i ditt eget konto.">
        <PrimaryButton onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })}>Prova gratis</PrimaryButton>
        <GhostLink to="/funktioner">Se alla funktioner</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
