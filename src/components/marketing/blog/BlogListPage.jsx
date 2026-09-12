import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW_SM, ACCENT_CYCLE } from '../marketingTokens';
import { AuroraLayer } from '../aurora';
import { PageMeta, JsonLd, SITE_URL } from '../../../utils/seo';
import { estimateReadingMinutes } from '../../../utils/markdown';

// ── /blogg — den publika listsidan ──────────────────────────────────────
// Läser direkt mot Supabase med anon-nyckeln (samma klient som resten av
// den publika sajten aldrig annars använder direkt, men RLS-policyn
// "Publik läsning av publicerade blogginlägg" — supabase-setup.sql —
// öppnar ENDAST status='published', så det finns inget att läcka här.
// Skrivning går aldrig via den här vägen, bara via api/admin/index.js
// (service-role, e-postspärrad).
function formatDateSv(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function BlogListPage() {
  const [posts, setPosts] = useState(null); // null = laddar
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('blog_posts')
      .select('slug, title, excerpt, cover_image_url, published_at, tags, content')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError('Kunde inte hämta blogginläggen just nu.'); setPosts([]); return; }
        setPosts(data || []);
      });
    return () => { cancelled = true; };
  }, []);

  const listSchema = posts?.length ? {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Bokix blogg',
    url: `${SITE_URL}/blogg`,
    blogPost: posts.map(p => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `${SITE_URL}/blogg/${p.slug}`,
      datePublished: p.published_at,
    })),
  } : null;

  return (
    <MarketingLayout>
      <PageMeta
        title="Blogg — bokföring, moms och företagande | Bokix"
        description="Nyheter, guider och praktiska tips om bokföring, moms, lön och företagande i Sverige — skrivet av teamet bakom Bokix."
        path="/blogg"
      />
      {listSchema && <JsonLd data={listSchema} />}

      <section style={{ padding: '140px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer stops={[['rgba(11,99,41,0.14)', '6% -8%'], ['rgba(14,165,233,0.10)', '96% 106%']]} />
        <Reveal style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.15 }}>
            Bloggen
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, margin: 0 }}>
            Bokföring, moms, lön och företagande — skrivet så att det faktiskt går att använda, inte bara läsa.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 90px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          {posts === null && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED, fontSize: '14px' }}>Laddar…</div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: MUTED, fontSize: '14px' }}>{error}</div>
          )}
          {posts?.length === 0 && !error && (
            <Reveal style={{ textAlign: 'center', padding: '80px 24px', background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '22px' }}>
              <FileText size={28} color={MUTED} style={{ marginBottom: '14px' }} />
              <div style={{ fontSize: '16px', fontWeight: 700, color: INK, marginBottom: '6px' }}>Inga inlägg än</div>
              <div style={{ fontSize: '13.5px', color: MUTED }}>Första blogginlägget är på gång — kom tillbaka snart.</div>
            </Reveal>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '22px' }}>
            {posts?.map((post, i) => {
              const accent = ACCENT_CYCLE[i % ACCENT_CYCLE.length];
              return (
                <Reveal key={post.slug} delay={i * 60} as={Link} to={`/blogg/${post.slug}`} className="lp-card-hover" style={{
                  display: 'flex', flexDirection: 'column', textDecoration: 'none',
                  background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px',
                  overflow: 'hidden', boxShadow: CARD_SHADOW_SM,
                }}>
                  {post.cover_image_url ? (
                    <div style={{ aspectRatio: '16/9', background: IVORY, overflow: 'hidden' }}>
                      <img src={post.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : (
                    <div style={{ aspectRatio: '16/9', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <FileText size={28} color={accent.fg} />
                    </div>
                  )}
                  <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', fontWeight: 700, color: accent.fg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      <Calendar size={12} /> {formatDateSv(post.published_at)} · {estimateReadingMinutes(post.content)} min läsning
                    </div>
                    <h2 style={{ fontSize: '18px', fontWeight: 700, color: INK, margin: 0, lineHeight: 1.35 }}>{post.title}</h2>
                    {post.excerpt && <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.6, margin: 0, flex: 1 }}>{post.excerpt}</p>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', fontWeight: 700, color: accent.fg, marginTop: '6px' }}>
                      Läs mer <ArrowRight size={13} />
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
