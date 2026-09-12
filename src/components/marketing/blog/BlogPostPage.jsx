import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { supabase } from '../../../supabaseClient';
import MarketingLayout, { Reveal } from '../MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER } from '../marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../../utils/seo';
import { markdownToHtml, estimateReadingMinutes } from '../../../utils/markdown';

function formatDateSv(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('sv-SE', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post, setPost] = useState(null); // null = laddar, false = hittades inte
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPost(null);
    supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) { setError('Kunde inte hämta inlägget just nu.'); setPost(false); return; }
        setPost(data || false);
      });
    return () => { cancelled = true; };
  }, [slug]);

  if (post === null) {
    return (
      <MarketingLayout>
        <PageMeta title="Bokix blogg" path={`/blogg/${slug}`} />
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: '14px' }}>Laddar…</div>
      </MarketingLayout>
    );
  }

  if (!post) {
    return (
      <MarketingLayout>
        <PageMeta title="Inlägget hittades inte | Bokix" path={`/blogg/${slug}`} />
        <div style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '0 24px', textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: INK }}>{error || 'Det här inlägget finns inte, eller är inte publicerat.'}</div>
          <Link to="/blogg" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--mkt-accent-green-fg)', fontWeight: 700, textDecoration: 'none' }}>
            <ArrowLeft size={15} /> Till bloggen
          </Link>
        </div>
      </MarketingLayout>
    );
  }

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seo_description || post.excerpt || undefined,
    image: post.cover_image_url || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: { '@type': 'Organization', name: post.author_name || 'Bokix' },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blogg/${post.slug}`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title={`${post.title} | Bokix`}
        description={post.seo_description || post.excerpt || post.title}
        path={`/blogg/${post.slug}`}
        {...(post.cover_image_url ? { image: post.cover_image_url } : {})}
        type="article"
      />
      <JsonLd data={articleSchema} />

      <article style={{ padding: '140px 24px 90px', background: IVORY }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Link to="/blogg" style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 15px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '12.5px', fontWeight: 700, color: 'var(--mkt-accent-green-fg)', marginBottom: '24px', textDecoration: 'none' }}>
            <ArrowLeft size={13} /> Bloggen
          </Link>

          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.5vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px', lineHeight: 1.2 }}>
            {post.title}
          </h1>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px', fontSize: '13px', color: MUTED, marginBottom: '32px', paddingBottom: '24px', borderBottom: `1px solid ${CARD_BORDER}` }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Calendar size={13} /> {formatDateSv(post.published_at)}</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><Clock size={13} /> {estimateReadingMinutes(post.content)} min läsning</span>
            {post.author_name && <span>Av {post.author_name}</span>}
          </div>

          {post.cover_image_url && (
            <img src={post.cover_image_url} alt="" style={{ width: '100%', borderRadius: '18px', marginBottom: '36px', display: 'block' }} />
          )}

          <div
            className="bx-blog-content"
            style={{ fontSize: '16px', color: INK_SOFT, lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
          />

          {post.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '40px', paddingTop: '24px', borderTop: `1px solid ${CARD_BORDER}` }}>
              {post.tags.map(tag => (
                <span key={tag} style={{ fontSize: '12px', fontWeight: 700, color: MUTED, background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '999px', padding: '5px 12px' }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </Reveal>
      </article>

      <style>{`
        .bx-blog-content h2 { font-family: ${SERIF}; font-size: 26px; font-weight: 700; color: ${INK}; margin: 40px 0 14px; letter-spacing: -0.01em; }
        .bx-blog-content h3 { font-family: ${SERIF}; font-size: 21px; font-weight: 700; color: ${INK}; margin: 32px 0 12px; }
        .bx-blog-content h4 { font-size: 16px; font-weight: 700; color: ${INK}; margin: 24px 0 10px; }
        .bx-blog-content p { margin: 0 0 18px; }
        .bx-blog-content a { color: var(--mkt-accent-green-fg); font-weight: 600; }
        .bx-blog-content ul, .bx-blog-content ol { margin: 0 0 18px; padding-left: 22px; }
        .bx-blog-content li { margin-bottom: 8px; }
        .bx-blog-content blockquote { margin: 24px 0; padding: 4px 20px; border-left: 3px solid var(--mkt-accent-green-fg); color: ${MUTED}; font-style: italic; }
        .bx-blog-content code { background: ${IVORY}; border: 1px solid ${CARD_BORDER}; padding: 2px 6px; border-radius: 5px; font-size: 0.9em; }
        .bx-blog-content pre { background: ${INK}; color: #f3f4f0; padding: 18px 20px; border-radius: 12px; overflow-x: auto; margin: 0 0 18px; }
        .bx-blog-content pre code { background: none; border: none; padding: 0; color: inherit; }
        .bx-blog-content img { max-width: 100%; border-radius: 12px; margin: 8px 0; }
        .bx-blog-content hr { border: none; border-top: 1px solid ${CARD_BORDER}; margin: 32px 0; }
      `}</style>
    </MarketingLayout>
  );
}
