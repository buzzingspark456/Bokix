import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from '../icons';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
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
function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

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

export default function BlogPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Blogg om bokföring, moms och bokslut | Bokix"
        description="Praktiska guider om bokföring, fakturering, moms och bokslut för svenska småföretag, skrivna av teamet bakom Bokix."
        path="/blogg"
        image={`${SITE_URL}${BLOG_POSTS[0].image}`}
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 26px; }
        .bx-blog-card-img { width: 100%; aspect-ratio: 1200 / 630; object-fit: cover; display: block; }
      `}</style>

      <section style={{ padding: '140px 24px 20px', background: IVORY }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(31px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, marginBottom: '15px', lineHeight: 1.1 }}>
            Bokix-bloggen
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.65, margin: 0 }}>
            Praktiska guider om bokföring, fakturering, moms och bokslut — skrivet av teamet som byggt Bokix, inte en byrå.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '46px 24px 100px', background: IVORY }}>
        <div className="bx-blog-grid" style={{ maxWidth: '980px', margin: '0 auto' }}>
          {BLOG_POSTS.map((post, i) => (
            <Reveal key={post.slug} delay={i * 60}>
              <Link
                to={post.path}
                className="lp-card-hover"
                style={{ display: 'block', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', overflow: 'hidden', boxShadow: CARD_SHADOW, textDecoration: 'none', height: '100%' }}
              >
                <img className="bx-blog-card-img" src={blogThumb(post.image)} alt={post.imageAlt} loading="lazy" width="800" height="420" />
                <div style={{ padding: '22px 24px 26px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 10px', fontSize: '12.5px', color: MUTED, fontWeight: 600, marginBottom: '11px' }}>
                    {post.category ? <span style={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--mkt-accent-green-fg)', background: 'var(--mkt-accent-green-soft)', padding: '3px 10px', borderRadius: '999px' }}>{post.category}</span> : null}
                    <span>{formatDate(post.datePublished)} · {post.readTime}</span>
                  </div>
                  <h2 style={{ fontFamily: SERIF, fontSize: '20px', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 9px', lineHeight: 1.25 }}>
                    {post.title}
                  </h2>
                  <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.6, margin: '0 0 14px' }}>
                    {post.excerpt}
                  </p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 700, color: INK }}>
                    Läs inlägget <ArrowRight size={14} />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
