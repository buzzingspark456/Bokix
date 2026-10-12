import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import TRANSCRIPTS from '../../content/marketing/guideTranscripts.json';
import { GUIDE_GROUPS, GUIDE_UPLOAD_DATE } from '../../content/marketing/guides';

const GUIDES = GUIDE_GROUPS.flatMap(group => group.guides);

// Förrenderingen (det Google läser) visar alltid den ljusa filmen. Står
// sajten i mörkt läge byts filmen till namn-dark.mp4 efter montering.
function useSiteTheme() {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    const root = document.documentElement;
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

export default function GuideVideoPage({ slug }) {
  const guide = GUIDES.find(item => item.slug === slug);
  const theme = useSiteTheme();
  if (!guide) return null;
  const file = theme === 'dark' ? `${guide.slug}-dark` : guide.slug;

  const transcript = TRANSCRIPTS[guide.slug]?.join(' ') || '';
  const videoUrl = `${SITE_URL}/videos/${guide.slug}.mp4`;
  const thumbnailUrl = `${SITE_URL}/videos/${guide.slug}.jpg`;
  const description = `${guide.lead} Se videon och läs hela instruktionen.`;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: guide.title,
    description,
    thumbnailUrl: [thumbnailUrl],
    uploadDate: GUIDE_UPLOAD_DATE,
    duration: guide.duration,
    contentUrl: videoUrl,
    inLanguage: 'sv-SE',
    transcript,
    isFamilyFriendly: true,
    publisher: {
      '@type': 'Organization',
      name: 'Bokix',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` },
    },
  };

  return (
    <MarketingLayout>
      <PageMeta
        title={`Videoguide: ${guide.title.charAt(0).toLowerCase()}${guide.title.slice(1)} | Bokix`}
        description={description}
        path={`/guider/${guide.slug}`}
        image={thumbnailUrl}
      />
      <JsonLd data={schema} />
      <style>{`
        .gd-watch { max-width: 1040px; margin: 0 auto; }
        .gd-watch-back { display: inline-flex; align-items: center; min-height: 44px; margin-bottom: 8px; color: var(--mkt-accent-green-fg); font-weight: 700; text-decoration: none; }
        .gd-watch-video { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 880; border-radius: 16px; border: 1px solid var(--mkt-border-soft); background: #101913; }
        .gd-watch-transcript { margin-top: 26px; border-top: 1px solid var(--mkt-border-soft); padding-top: 18px; }
        .gd-watch-transcript summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 700; color: var(--mkt-accent-green-fg); }
        .gd-watch-transcript p { margin: 8px 0 0; max-width: 780px; line-height: 1.75; color: var(--mkt-ink-soft); }
        @media (max-width: 700px) { .gd-watch-video { border-radius: 10px; } }
      `}</style>
      <section style={{ padding: '104px 24px 88px', background: 'var(--mkt-page-bg)' }}>
        <main className="gd-watch">
          <Link className="gd-watch-back" to="/guider">← Alla videoguider</Link>
          {/* Videon först och direkt synlig: Google indexerar bara videor på
              en visningssida, där filmen är det första och största på sidan.
              Rubriken och ingressen ligger under, som på en videotjänst. */}
          <video
            key={file}
            className="gd-watch-video"
            src={`/videos/${file}.mp4`}
            poster={`/videos/${file}.jpg`}
            controls
            playsInline
            preload="metadata"
            width="1600"
            height="880"
            aria-label={`Videoguide: ${guide.title}`}
          />
          <h1 className="kx-h1" style={{ margin: '22px 0 10px' }}>{guide.title}</h1>
          <p className="kx-lead" style={{ margin: 0 }}>{guide.lead}</p>
          {transcript && (
            <details className="gd-watch-transcript">
              <summary>Visa texten i videon</summary>
              <p>{transcript}</p>
            </details>
          )}
        </main>
      </section>
    </MarketingLayout>
  );
}
