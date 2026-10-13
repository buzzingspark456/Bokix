import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED } from './marketingTokens';
import { blogThumb } from '../../utils/blogThumb';
import { PageMeta, JsonLd, SITE_URL, schemaDate } from '../../utils/seo';
import { BLOG_POSTS } from '../../content/marketing/blog';

// ── Bokix-bloggen (/blogg) — den riktiga listan ─────────────────────────
// Fanns tidigare bara som ordet "Bokix-bloggen" ovanpå ETT inlägg
// (/enkel-bokforing), utan en sida som faktiskt listade det eller några
// andra — dvs. sidan påstod sig vara en blogg utan att vara en. Den här
// sidan är listan; varje inlägg (BLOG_POSTS, content/marketing/blog.js)
// bor kvar på sin egen sökväg (se filkommentaren där för varför), den här
// sidan bara länkar dit. Nya inlägg läggs till i BLOG_POSTS — de dyker upp
// här automatiskt, ingen ändring behövs i den här filen.
//
// Upplägg som en vanlig blogg (2026-10-13): senaste inlägget stort överst,
// resten i ett rutnät med bild, kategori, kort rubrik och datum. Ingress
// bara på det stora inlägget, inga kort med ram eller "Läs inlägget".
function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

const POSTS = [...BLOG_POSTS].sort((a, b) => b.datePublished.localeCompare(a.datePublished));
const [FEATURED, ...REST] = POSTS;

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  '@id': `${SITE_URL}/blogg`,
  name: 'Bokix-bloggen',
  url: `${SITE_URL}/blogg`,
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  blogPost: BLOG_POSTS.map(p => ({
    '@type': 'BlogPosting',
    headline: p.title,
    url: `${SITE_URL}${p.path}`,
    image: `${SITE_URL}${p.image}`,
    datePublished: schemaDate(p.datePublished),
    dateModified: schemaDate(p.dateModified),
    description: p.excerpt,
    // Samma författare som på själva artikelsidan (BlogPostPage.jsx).
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
  })),
};

const CSS = `
  .bxb-wrap { max-width: 1120px; margin: 0 auto; }
  .bxb-head { padding: 132px 24px 8px; }
  .bxb-h1 { font-family: ${SERIF}; font-size: clamp(38px, 6vw, 60px); font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1.05; margin: 0 0 12px; }
  .bxb-sub { font-size: 17px; color: ${MUTED}; margin: 0; }
  .bxb-link { display: block; text-decoration: none; color: inherit; }
  .bxb-img { width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: cover; display: block; border-radius: 14px; background: var(--mkt-ivory); transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
  .bxb-imgbox { overflow: hidden; border-radius: 14px; }
  .bxb-link:hover .bxb-img { transform: scale(1.025); }
  .bxb-link:hover .bxb-title { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
  .bxb-meta { display: flex; gap: 10px; align-items: center; font-size: 13px; color: ${MUTED}; font-weight: 500; }
  .bxb-cat { font-weight: 700; color: var(--mkt-accent-green-fg); }
  .bxb-title { font-family: ${SERIF}; color: ${INK}; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; margin: 0; }

  .bxb-feat { display: grid; grid-template-columns: 1.35fr 1fr; gap: 44px; align-items: center; padding: 40px 0 56px; border-bottom: 1px solid var(--mkt-border-soft); }
  .bxb-feat .bxb-title { font-size: clamp(28px, 3.4vw, 40px); margin: 14px 0 12px; }
  .bxb-feat p { font-size: 17px; line-height: 1.55; color: var(--mkt-ink-soft); margin: 0; }

  .bxb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px 32px; padding: 52px 0 110px; }
  .bxb-grid .bxb-meta { margin-top: 16px; }
  .bxb-grid .bxb-title { font-size: 21px; margin-top: 8px; }

  @media (max-width: 900px) {
    .bxb-feat { grid-template-columns: 1fr; gap: 22px; padding-top: 28px; }
    .bxb-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .bxb-head { padding-top: 108px; }
    .bxb-grid { grid-template-columns: 1fr; gap: 38px; }
  }
`;

function Meta({ post }) {
  return (
    <div className="bxb-meta">
      {post.category ? <span className="bxb-cat">{post.category}</span> : null}
      <time dateTime={post.datePublished}>{formatDate(post.datePublished)}</time>
    </div>
  );
}

export default function BlogPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Blogg om bokföring, moms och bokslut | Bokix"
        description="Praktiska guider om bokföring, fakturering, moms och bokslut för svenska småföretag, skrivna av teamet bakom Bokix."
        path="/blogg"
        image={`${SITE_URL}${FEATURED.image}`}
      />
      <JsonLd data={SCHEMA} />
      <style>{CSS}</style>

      <header className="bxb-head">
        <div className="bxb-wrap">
          <h1 className="bxb-h1">Blogg</h1>
          <p className="bxb-sub">Bokföring, moms och skatt för småföretag.</p>
        </div>
      </header>

      <section style={{ padding: '0 24px' }}>
        <div className="bxb-wrap">
          <Reveal>
            <Link to={FEATURED.path} className="bxb-link bxb-feat">
              <div className="bxb-imgbox">
                <img className="bxb-img" src={FEATURED.image} alt={FEATURED.imageAlt} width="1200" height="630" fetchPriority="high" />
              </div>
              <div>
                <Meta post={FEATURED} />
                <h2 className="bxb-title">{FEATURED.title}</h2>
                <p>{FEATURED.excerpt}</p>
              </div>
            </Link>
          </Reveal>

          <div className="bxb-grid">
            {REST.map((post, i) => (
              <Reveal key={post.slug} delay={(i % 3) * 60}>
                <Link to={post.path} className="bxb-link">
                  <div className="bxb-imgbox">
                    <img className="bxb-img" src={blogThumb(post.image)} alt={post.imageAlt} loading="lazy" width="800" height="420" />
                  </div>
                  <Meta post={post} />
                  <h2 className="bxb-title">{post.title}</h2>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
