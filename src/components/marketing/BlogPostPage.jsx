import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from '../icons';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { BLOG_POSTS } from '../../content/marketing/blog';

// ── En bloggartikel (/blogg/<slug>) ─────────────────────────────────────
// Renderar ett inlägg ur BLOG_POSTS (content/marketing/blog.js) som har ett
// `body`. Samma utseende som /enkel-bokforing (den artikeln är fortfarande
// handskriven i EnkelBokforingPage.jsx och bor på sin gamla sökväg). Ett nytt
// inlägg behöver alltså ingen ny komponent: lägg till det i blog.js.

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' });
}

// [länktext](/sökväg) i brödtext blir en riktig <Link>, så en artikel kan
// länka internt (viktigt för både läsaren och sökmotorn) utan att blocken
// behöver vara JSX.
function renderText(str) {
  const out = [];
  let last = 0;
  let k = 0;
  for (const m of str.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)) {
    if (m.index > last) out.push(str.slice(last, m.index));
    out.push(<Link key={k++} to={m[2]} style={{ color: BRAND.greenDark, fontWeight: 600 }}>{m[1]}</Link>);
    last = m.index + m[0].length;
  }
  if (last < str.length) out.push(str.slice(last));
  return out;
}

function Block({ block }) {
  if (block.t === 'h2') return <h2>{block.x}</h2>;
  if (block.t === 'p') return <p>{renderText(block.x)}</p>;
  if (block.t === 'ul') return <ul>{block.x.map((li, i) => <li key={i}>{renderText(li)}</li>)}</ul>;
  if (block.t === 'ol') return <ol>{block.x.map((li, i) => <li key={i}>{renderText(li)}</li>)}</ol>;
  return null;
}

export default function BlogPostPage({ slug }) {
  const navigate = useNavigate();
  const post = BLOG_POSTS.find(p => p.slug === slug && p.body);
  if (!post) return null;
  const others = BLOG_POSTS.filter(p => p.slug !== slug);

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: post.title,
      url: `${SITE_URL}${post.path}`,
      inLanguage: 'sv-SE',
      image: `${SITE_URL}${post.image}`,
      datePublished: post.datePublished,
      dateModified: post.dateModified,
      author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
      description: post.excerpt,
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}${post.path}` },
      isPartOf: { '@type': 'Blog', '@id': `${SITE_URL}/blogg`, name: 'Bokix-bloggen' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Bokix', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Blogg', item: `${SITE_URL}/blogg` },
        { '@type': 'ListItem', position: 3, name: post.title, item: `${SITE_URL}${post.path}` },
      ],
    },
  ];

  return (
    <MarketingLayout>
      <PageMeta
        title={`${post.title} | Bokix`}
        description={post.excerpt}
        path={post.path}
        image={`${SITE_URL}${post.image}`}
        type="article"
      />
      {schema.map((s, i) => <JsonLd key={i} data={s} />)}
      <style>{`
        .bx-post p, .bx-post li { font-size: clamp(16.5px, 2vw, 18.5px); line-height: 1.85; color: var(--mkt-ink-soft); }
        .bx-post p { margin: 0 0 20px; }
        .bx-post h2 { font-family: ${SERIF}; font-size: clamp(21px, 2.6vw, 27px); font-weight: 700; letter-spacing: -0.01em; color: var(--mkt-ink); margin: 44px 0 14px; }
        .bx-post h2:first-child { margin-top: 8px; }
        .bx-post ul, .bx-post ol { margin: 0 0 22px; padding-left: 1.3em; }
        .bx-post li { margin: 0 0 9px; }
        .bx-post-hero { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; object-position: top; display: block; }
        @media (max-width: 640px) { .bx-post-hero { aspect-ratio: 4 / 3; } }
      `}</style>

      <Reveal>
        <img className="bx-post-hero" src={post.image} alt={post.imageAlt} />
      </Reveal>

      <section style={{ padding: '40px 24px 8px', background: IVORY }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <Link to="/blogg" style={{ display: 'inline-block', fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: BRAND.greenDark, marginBottom: '14px', textDecoration: 'none' }}>
            Bokix-bloggen
          </Link>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.6vw, 44px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, margin: '0 0 16px', lineHeight: 1.15 }}>
            {post.title}
          </h1>
          <div style={{ fontSize: '13.5px', color: MUTED, fontWeight: 600 }}>
            Bokix-teamet · {formatDate(post.datePublished)} · {post.readTime}
          </div>
        </Reveal>
      </section>

      <section style={{ padding: '32px 24px 70px', background: IVORY }}>
        {/* Ett vanligt block, INTE <Reveal>: Reveal väntar tills 15 % av
            elementets höjd syns, och en hel artikeltext är flera tusen
            pixlar hög (ännu högre på mobil), så den låg osynlig tills man
            skrollat en bra bit. Brödtexten ska synas direkt. */}
        <div className="bx-post" style={{ maxWidth: '680px', margin: '0 auto' }}>
          {post.body.map((block, i) => <Block key={i} block={block} />)}
        </div>
      </section>

      {others.length > 0 && (
        <section style={{ padding: '0 24px 64px', background: IVORY }}>
          <Reveal style={{ maxWidth: '680px', margin: '0 auto', borderTop: `1px solid ${CARD_BORDER}`, paddingTop: '32px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: '14px' }}>
              Fler artiklar
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
              {others.map(o => (
                <li key={o.slug}>
                  <Link to={o.path} style={{ color: INK, fontWeight: 700, fontSize: '16.5px', textDecoration: 'none' }}>{o.title}</Link>
                </li>
              ))}
            </ul>
          </Reveal>
        </section>
      )}

      <section style={{ padding: '64px 24px 100px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 29px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 11px' }}>
            Se det på riktigt, inte bara läs om det
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.65, margin: '0 0 26px' }}>
            30 dagar gratis, inga kortuppgifter som debiteras i förväg. Avsluta innan dess och det kostar dig ingenting.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 26px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis <ArrowRight size={15} />
            </button>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '14.5px', textDecoration: 'none' }}>
              Alla funktioner
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}

// path -> sidkomponent för varje artikel med body. Läses av entry-server.jsx
// (förrendering) och AppRouter.jsx (klientroutes), så en ny artikel i
// blog.js får båda utan att de filerna behöver ändras.
export const BLOG_ARTICLE_PAGES = Object.fromEntries(
  BLOG_POSTS.filter(p => p.body).map(p => [p.path, () => <BlogPostPage slug={p.slug} />])
);
