import React from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED } from './marketingTokens';
import { blogThumb } from '../../utils/blogThumb';

// Listan på /blogg och /nyheter (2026-10-13): senaste inlägget stort
// överst, resten i ett rutnät med bild, kategori, datum och kort rubrik.
// Ingress bara på det stora, inga kort med ram eller "Läs mer".
// `posts` ska redan vara sorterade, senaste först.
function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

const CSS = `
  .bxb-wrap { max-width: 1200px; margin: 0 auto; }
  .bxb-head { padding: 116px 24px 0; }
  .bxb-h1 { font-family: ${SERIF}; font-size: clamp(38px, 6vw, 60px); font-weight: 700; letter-spacing: -0.02em; color: ${INK}; line-height: 1.05; margin: 0; }
  .bxb-link { display: block; text-decoration: none; color: inherit; }
  .bxb-img { width: 100%; height: auto; aspect-ratio: 1200 / 630; object-fit: cover; display: block; border-radius: 14px; background: var(--mkt-ivory); transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
  .bxb-imgbox { overflow: hidden; border-radius: 14px; }
  .bxb-link:hover .bxb-img { transform: scale(1.025); }
  .bxb-link:hover .bxb-title { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 4px; }
  .bxb-meta { display: flex; gap: 10px; align-items: center; font-size: 13px; color: ${MUTED}; font-weight: 500; }
  .bxb-cat { font-weight: 700; color: var(--mkt-accent-green-fg); }
  .bxb-title { font-family: ${SERIF}; color: ${INK}; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2; margin: 0; }

  .bxb-feat { display: grid; grid-template-columns: 1.35fr 1fr; gap: 44px; align-items: center; padding: 28px 0 40px; border-bottom: 1px solid var(--mkt-border-soft); }
  .bxb-feat .bxb-title { font-size: clamp(28px, 3.4vw, 40px); margin: 14px 0 12px; }
  .bxb-feat p { font-size: 17px; line-height: 1.55; color: var(--mkt-ink-soft); margin: 0; }

  .bxb-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px 32px; padding: 40px 0 80px; }
  .bxb-grid .bxb-meta { margin-top: 16px; }
  .bxb-grid .bxb-title { font-size: 21px; margin-top: 8px; }

  @media (max-width: 900px) {
    .bxb-feat { grid-template-columns: 1fr; gap: 22px; padding-top: 28px; }
    .bxb-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .bxb-head { padding-top: 100px; }
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

export default function ArticleIndex({ title, posts }) {
  const [featured, ...rest] = posts;
  return (
    <>
      <style>{CSS}</style>
      <header className="bxb-head">
        <div className="bxb-wrap">
          <h1 className="bxb-h1">{title}</h1>
        </div>
      </header>

      <section style={{ padding: '0 24px' }}>
        <div className="bxb-wrap">
          <Reveal>
            <Link to={featured.path} className="bxb-link bxb-feat">
              <div className="bxb-imgbox">
                <img className="bxb-img" src={featured.image} alt={featured.imageAlt} width="1200" height="630" fetchPriority="high" />
              </div>
              <div>
                <Meta post={featured} />
                <h2 className="bxb-title">{featured.title}</h2>
                <p>{featured.excerpt}</p>
              </div>
            </Link>
          </Reveal>

          <div className="bxb-grid">
            {rest.map((post, i) => (
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
    </>
  );
}
