import React from 'react';
import MarketingLayout from './MarketingLayout';
import ArticleIndex from './ArticleIndex';
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
// Själva listan ritas av ArticleIndex.jsx, samma som /nyheter.
const POSTS = BLOG_POSTS.filter(p => !p.hidden).sort((a, b) => b.datePublished.localeCompare(a.datePublished));

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  '@id': `${SITE_URL}/blogg`,
  name: 'Bokix-bloggen',
  url: `${SITE_URL}/blogg`,
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  blogPost: POSTS.map(p => ({
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
        image={`${SITE_URL}${POSTS[0].image}`}
      />
      <JsonLd data={SCHEMA} />
      <ArticleIndex title="Blogg" posts={POSTS} />
    </MarketingLayout>
  );
}
