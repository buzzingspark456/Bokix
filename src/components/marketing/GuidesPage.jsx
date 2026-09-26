import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Videoguider (/guider) ───────────────────────────────────────────────
// Riktiga skärminspelningar av appen (startsidans demo med exempeldata),
// inte animationer. Filmerna spelas in med scripts/record-guide-videos.mjs
// och ligger i public/videos/ (namn.mp4 + namn.jpg som affisch). Nytt flöde:
// lägg till det i GUIDES i skriptet, spela in, lägg till en rad här.

const GUIDES = [
  {
    slug: 'lagg-upp-kund',
    title: 'Lägg upp en kund',
    lead: 'Från tom lista till en kund du kan fakturera, på en dryg minut.',
    duration: 'PT1M15S',
    steps: ['Gå till Kunder', 'Tryck på Ny kund', 'Fyll i namn och kontakt', 'Adress och org.nummer', 'Spara'],
  },
  {
    slug: 'skapa-faktura',
    title: 'Skapa en faktura',
    lead: 'Välj kund, skriv vad du sålt. Moms och summa räknas ut åt dig.',
    duration: 'PT1M20S',
    steps: ['Gå till Kundfakturor', 'Tryck på Skapa faktura', 'Välj kund', 'Rader med antal och pris', 'Skapa faktura'],
  },
];

const UPLOADED = '2026-09-26';

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE_URL}/guider`,
  name: 'Videoguider för Bokix',
  url: `${SITE_URL}/guider`,
  inLanguage: 'sv-SE',
  hasPart: GUIDES.map(g => ({
    '@type': 'VideoObject',
    name: g.title,
    description: g.lead,
    thumbnailUrl: `${SITE_URL}/videos/${g.slug}.jpg`,
    contentUrl: `${SITE_URL}/videos/${g.slug}.mp4`,
    uploadDate: UPLOADED,
    duration: g.duration,
    inLanguage: 'sv-SE',
  })),
};

export default function GuidesPage() {
  const navigate = useNavigate();
  return (
    <MarketingLayout>
      <PageMeta
        title="Videoguider | Bokix"
        description="Korta videoguider som visar hur du gör i Bokix: lägg upp en kund, skapa en faktura och mer, steg för steg."
        path="/guider"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <style>{`
        .gd-list { max-width: 1040px; margin: 0 auto; display: grid; gap: 88px; }
        .gd-head { max-width: 640px; margin: 0 0 22px; }
        .gd-h2 { font-size: clamp(23px, 2.8vw, 30px); }
        .gd-video { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 880; border-radius: 16px; border: 1px solid var(--mkt-border-soft); background: #eef2ef; box-shadow: 0 30px 60px -36px rgba(15, 40, 25, 0.35); }
        .gd-steps { list-style: none; counter-reset: gd; display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 20px 0 0; padding: 0; }
        .gd-steps li { counter-increment: gd; display: flex; align-items: center; gap: 8px; font-size: 14.5px; color: var(--mkt-ink-soft, inherit); }
        .gd-steps li::before { content: counter(gd); display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #16803a; color: #fff; font-size: 12.5px; font-weight: 700; }
      `}</style>

      <section style={{ padding: '140px 24px 56px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <h1 className="kx-h1">Videoguider</h1>
          <p className="kx-lead" style={{ margin: '0 auto' }}>
            Se hur det går till i Bokix, steg för steg. Inspelat i appen, med exempeldata.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '24px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <div className="gd-list">
          {GUIDES.map(g => (
            <Reveal key={g.slug}>
              <article id={g.slug}>
                <div className="gd-head">
                  <h2 className="kx-h2 gd-h2">{g.title}</h2>
                  <p className="kx-sub">{g.lead}</p>
                </div>
                <video
                  className="gd-video"
                  src={`/videos/${g.slug}.mp4`}
                  poster={`/videos/${g.slug}.jpg`}
                  controls
                  playsInline
                  preload="none"
                  width="1600"
                  height="880"
                  aria-label={`Video: ${g.title}`}
                />
                <ol className="gd-steps">
                  {g.steps.map(s => <li key={s}>{s}</li>)}
                </ol>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <KitCta title="Prova själv" lead="Samma steg fungerar i ditt eget konto. Skapa ett och testa.">
        <PrimaryButton onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })}>Prova gratis</PrimaryButton>
        <GhostLink to="/funktioner">Se alla funktioner</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
