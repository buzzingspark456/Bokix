import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '../icons';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { NEWS_POSTS } from '../../content/marketing/news';

// ── Nyheter från Bokix (/nyheter) ───────────────────────────────────────
// Listan över NEWS_POSTS (content/marketing/news.js), senaste först. Varje
// nyhet renderas av BlogPostPage.jsx på /nyheter/<slug>. Till skillnad från
// bloggens rutnät är det här en tidslinje: datumet är det viktiga.
function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Senaste först. Samma datum: den som står längre ner i news.js är nyast
// (nya nyheter läggs till sist i listan), så den hamnar överst.
const POSTS = NEWS_POSTS
  .map((post, i) => ({ post, i }))
  .sort((a, b) => b.post.datePublished.localeCompare(a.post.datePublished) || b.i - a.i)
  .map(({ post }) => post);

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${SITE_URL}/nyheter`,
  name: 'Nyheter från Bokix',
  url: `${SITE_URL}/nyheter`,
  inLanguage: 'sv-SE',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  hasPart: POSTS.map(p => ({
    '@type': 'NewsArticle',
    headline: p.title,
    url: `${SITE_URL}${p.path}`,
    image: `${SITE_URL}${p.image}`,
    datePublished: p.datePublished,
    dateModified: p.dateModified,
    description: p.excerpt,
  })),
};

export default function NewsPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Nyheter | Bokix"
        description="Nyheter från Bokix: nya funktioner och förbättringar i bokföringsprogrammet, med datum och vad det betyder för dig."
        path="/nyheter"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-news { list-style: none; margin: 0 auto; padding: 0; max-width: 940px; display: grid; gap: 22px; }
        .bx-news-card { display: grid; grid-template-columns: 340px 1fr; align-items: center; background: var(--mkt-card-bg); border: 1px solid ${CARD_BORDER}; border-radius: 18px; overflow: hidden; box-shadow: ${CARD_SHADOW}; text-decoration: none; }
        .bx-news-card img { width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: cover; display: block; }
        .bx-news-body { padding: 24px 28px 26px; display: flex; flex-direction: column; justify-content: center; }
        @media (max-width: 760px) {
          .bx-news-card { grid-template-columns: 1fr; }
          .bx-news-body { padding: 20px 20px 22px; }
        }
      `}</style>

      <section style={{ padding: '140px 24px 20px', background: IVORY }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(31px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, marginBottom: '15px', lineHeight: 1.1 }}>
            Nyheter från Bokix
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.65, margin: 0 }}>
            Det som är nytt i Bokix, och vad det betyder för dig.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '46px 24px 100px', background: IVORY }}>
        <ul className="bx-news">
          {POSTS.map((post, i) => (
            <li key={post.slug}>
              <Reveal delay={i * 60}>
                <Link to={post.path} className="bx-news-card lp-card-hover">
                  <img src={post.image} alt={post.imageAlt} loading={i === 0 ? 'eager' : 'lazy'} width="1200" height="630" />
                  <div className="bx-news-body">
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 10px', fontSize: '12.5px', color: MUTED, fontWeight: 600, marginBottom: '11px' }}>
                      <span style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mkt-accent-green-fg)', background: 'var(--mkt-accent-green-soft)', padding: '3px 10px', borderRadius: '999px' }}>{post.category}</span>
                      <time dateTime={post.datePublished}>{formatDate(post.datePublished)}</time>
                    </div>
                    <h2 style={{ fontFamily: SERIF, fontSize: '21px', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 9px', lineHeight: 1.25 }}>
                      {post.title}
                    </h2>
                    <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.6, margin: '0 0 14px' }}>
                      {post.excerpt}
                    </p>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 700, color: INK }}>
                      Läs nyheten <ArrowRight size={14} />
                    </span>
                  </div>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>
    </MarketingLayout>
  );
}
