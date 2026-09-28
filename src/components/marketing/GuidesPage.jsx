import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
// Det berättarrösten säger, skrivet av scripts/record-guide-videos.mjs.
import TRANSCRIPTS from '../../content/marketing/guideTranscripts.json';

// ── Videoguider (/guider) ───────────────────────────────────────────────
// Riktiga skärminspelningar av appen (startsidans demo med påhittade
// exempelföretag), inte animationer, med berättarröst och klickljud. Filmerna spelas in med
// scripts/record-guide-videos.mjs och ligger i public/videos/: namn.mp4 och
// namn-dark.mp4, med namn.jpg / namn-dark.jpg som affischbild. Sidan visar
// den mörka filmen när sajten står i mörkt läge. Ny guide: lägg till den i
// GUIDES i skriptet, spela in, lägg till en rad här.

const GROUPS = [
  {
    title: 'Sälja och fakturera',
    guides: [
      { slug: 'lagg-upp-kund', title: 'Lägg upp en kund', lead: 'Namn, e-post och organisationsnummer.', duration: 'PT38S' },
      { slug: 'skapa-faktura', title: 'Skapa en faktura', lead: 'Välj kund, skriv vad du sålt. Momsen räknas ut.', duration: 'PT45S' },
      { slug: 'skicka-faktura', title: 'Skicka en faktura', lead: 'Välj mall, skicka med e-post och en Betala nu-knapp via Stripe.', duration: 'PT59S' },
      { slug: 'registrera-betalning', title: 'Registrera en betalning', lead: 'Markera som betald med ett klick, eller registrera en delbetalning.', duration: 'PT40S' },
      { slug: 'skapa-offert', title: 'Skapa en offert', lead: 'Blir det ja gör du om den till en faktura.', duration: 'PT32S' },
      { slug: 'ny-artikel', title: 'Spara en artikel', lead: 'Det du säljer ofta, klart att välja på fakturan.', duration: 'PT29S' },
    ],
  },
  {
    title: 'Kostnader och bokföring',
    guides: [
      { slug: 'ladda-upp-kvitto', title: 'Ladda upp ett kvitto', lead: 'Datum, belopp och moms läses av åt dig.', duration: 'PT32S' },
      { slug: 'ny-verifikation', title: 'Bokför ett köp', lead: 'Utan debet och kredit. Bokix sköter kontona.', duration: 'PT41S' },
    ],
  },
  {
    title: 'Personal och projekt',
    guides: [
      { slug: 'ny-anstalld', title: 'Lägg till en anställd', lead: 'Lön, kommun och skattetabell, sedan kan du köra lön.', duration: 'PT47S' },
      { slug: 'nytt-projekt', title: 'Starta ett projekt', lead: 'Samla tid och fakturor per uppdrag.', duration: 'PT25S' },
    ],
  },
  {
    title: 'Moms och rapporter',
    guides: [
      { slug: 'momsdeklaration', title: 'Gör momsdeklarationen', lead: 'Kontrollera, granska, bokför och lämna in.', duration: 'PT49S' },
      { slug: 'rapporter', title: 'Gå igenom rapporterna', lead: 'Företagsöversikt, resultaträkning, balansräkning, nyckeltal och moms.', duration: 'PT85S' },
    ],
  },
];

const UPLOADED = '2026-09-28';

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE_URL}/guider`,
  name: 'Videoguider för Bokix',
  url: `${SITE_URL}/guider`,
  inLanguage: 'sv-SE',
  hasPart: GROUPS.flatMap(g => g.guides).map(g => ({
    '@type': 'VideoObject',
    name: g.title,
    description: g.lead,
    thumbnailUrl: `${SITE_URL}/videos/${g.slug}.jpg`,
    contentUrl: `${SITE_URL}/videos/${g.slug}.mp4`,
    uploadDate: UPLOADED,
    duration: g.duration,
    inLanguage: 'sv-SE',
    transcript: (TRANSCRIPTS[g.slug] || []).join(' '),
  })),
};

// Sajtens tema sitter på <html data-theme>, och kan bytas medan man står på
// sidan. Förrenderingen och första renderingen visar alltid ljust, sedan
// byts det efter montering, så hydreringen blir densamma.
function useSiteTheme() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const root = document.documentElement;
    const read = () => setTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function GuideVideo({ slug, title, theme }) {
  const file = theme === 'dark' ? `${slug}-dark` : slug;
  return (
    <video
      key={file}
      className="gd-video"
      src={`/videos/${file}.mp4`}
      poster={`/videos/${file}.jpg`}
      controls
      playsInline
      preload="none"
      width="1600"
      height="880"
      aria-label={`Video: ${title}`}
    />
  );
}

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
        .gd-video { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 880; border-radius: 14px; border: 1px solid var(--mkt-border-soft); background: #eef2ef; box-shadow: 0 24px 50px -34px rgba(15, 40, 25, 0.35); }
        html[data-theme="dark"] #lp-root .gd-video { background: #0f1a13; box-shadow: none; }
        .gd-title { font-size: 17px; font-weight: 700; margin: 16px 0 4px; }
        .gd-lead { font-size: 15px; line-height: 1.55; margin: 0; }
        .gd-text { margin-top: 10px; font-size: 14px; }
        .gd-text summary { cursor: pointer; font-weight: 600; color: var(--mkt-accent-green-fg); width: fit-content; }
        .gd-text p { margin: 8px 0 0; line-height: 1.6; color: var(--mkt-ink-soft); }
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
                      <GuideVideo slug={g.slug} title={g.title} theme={theme} />
                      <h3 className="kx-row-title gd-title">{g.title}</h3>
                      <p className="kx-sub gd-lead">{g.lead}</p>
                      {TRANSCRIPTS[g.slug] && (
                        <details className="gd-text">
                          <summary>Visa vad som sägs</summary>
                          <p>{TRANSCRIPTS[g.slug].join(' ')}</p>
                        </details>
                      )}
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
