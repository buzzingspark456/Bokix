import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
// Det berättarrösten säger, skrivet av scripts/record-guide-videos.mjs.
import TRANSCRIPTS from '../../content/marketing/guideTranscripts.json';
import { GUIDE_GROUPS } from '../../content/marketing/guides';

// ── Videoguider (/guider) ───────────────────────────────────────────────
// Riktiga skärminspelningar av appen (startsidans demo med påhittade
// exempelföretag), inte animationer, med berättarröst och klickljud. Filmerna spelas in med
// scripts/record-guide-videos.mjs och ligger i public/videos/: namn.mp4 och
// namn-dark.mp4, med namn.jpg / namn-dark.jpg som affischbild. Sidan visar
// den mörka filmen när sajten står i mörkt läge. Ny guide: lägg till den i
// GUIDES i skriptet, spela in, lägg till en rad här.

const GROUPS = GUIDE_GROUPS;

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
    // Utan data-theme (temat "System") gäller datorns läge, som i index.css.
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const read = () => {
      const attr = root.getAttribute('data-theme');
      setTheme((attr ? attr === 'dark' : !!mq?.matches) ? 'dark' : 'light');
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    mq?.addEventListener?.('change', read);
    return () => { obs.disconnect(); mq?.removeEventListener?.('change', read); };
  }, []);
  return theme;
}

// Affischbild och film sätts först när spelaren närmar sig skärmen. Förut
// stod affischen redan i den förrenderade HTML:en (alltid ljus), så webbläsaren
// hämtade alla tolv ljusa bilder direkt och sedan de tolv mörka när temat lästs
// in: 24 bilder, ~3 MB, på en mobil. Rutan har fast bildformat (aspect-ratio)
// så inget hoppar när bilden kommer.
// `key` är videons nyckel: när temat lästs in byts <video> ut (key={file}),
// och då måste observatören sättas på det nya elementet.
function useNearViewport(key) {
  const ref = useRef(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setNear(true); io.disconnect(); }
    }, { rootMargin: '600px 0px' });
    io.observe(node);
    return () => io.disconnect();
  }, [near, key]);
  return [ref, near];
}

function GuideVideo({ slug, title, theme }) {
  const file = theme === 'dark' ? `${slug}-dark` : slug;
  const [ref, near] = useNearViewport(file);
  return (
    <video
      ref={ref}
      key={file}
      className="gd-video"
      src={near ? `/videos/${file}.mp4` : undefined}
      poster={near ? `/videos/${file}.jpg` : undefined}
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
