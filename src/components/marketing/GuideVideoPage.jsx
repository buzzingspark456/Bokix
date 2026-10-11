import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import TRANSCRIPTS from '../../content/marketing/guideTranscripts.json';
import { GUIDE_GROUPS, GUIDE_UPLOAD_DATE } from '../../content/marketing/guides';

const GUIDES = GUIDE_GROUPS.flatMap(group => group.guides);

export default function GuideVideoPage({ slug }) {
  const guide = GUIDES.find(item => item.slug === slug);
  if (!guide) return null;

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
        title={`${guide.title} – videoguide | Bokix`}
        description={description}
        path={`/guider/${guide.slug}`}
        image={thumbnailUrl}
      />
      <JsonLd data={schema} />
      <style>{`
        .gd-watch { max-width: 1040px; margin: 0 auto; }
        .gd-watch-back { display: inline-flex; align-items: center; min-height: 44px; color: var(--mkt-accent-green-fg); font-weight: 700; text-decoration: none; }
        .gd-watch-video { display: block; width: 100%; height: auto; aspect-ratio: 1600 / 880; border-radius: 16px; border: 1px solid var(--mkt-border-soft); background: #101913; }
        .gd-watch-transcript { margin-top: 26px; border-top: 1px solid var(--mkt-border-soft); padding-top: 18px; }
        .gd-watch-transcript summary { cursor: pointer; min-height: 44px; display: flex; align-items: center; font-weight: 700; color: var(--mkt-accent-green-fg); }
        .gd-watch-transcript p { margin: 8px 0 0; max-width: 780px; line-height: 1.75; color: var(--mkt-ink-soft); }
        @media (max-width: 700px) { .gd-watch-video { border-radius: 10px; } }
      `}</style>
      <section style={{ padding: '126px 24px 88px', background: 'var(--mkt-page-bg)' }}>
        <main className="gd-watch">
          <Link className="gd-watch-back" to="/guider">← Alla videoguider</Link>
          <h1 className="kx-h1" style={{ margin: '16px 0 10px' }}>{guide.title}</h1>
          <p className="kx-lead" style={{ margin: '0 0 26px' }}>{guide.lead}</p>
          <video
            className="gd-watch-video"
            src={`/videos/${guide.slug}.mp4`}
            poster={`/videos/${guide.slug}.jpg`}
            controls
            playsInline
            preload="none"
            width="1600"
            height="880"
            aria-label={`Videoguide: ${guide.title}`}
          />
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
