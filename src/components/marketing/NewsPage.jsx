import React from 'react';
import MarketingLayout from './MarketingLayout';
import ArticleIndex from './ArticleIndex';
import { PageMeta, JsonLd, SITE_URL, schemaDate } from '../../utils/seo';
import { NEWS_POSTS } from '../../content/marketing/news';

// ── Nyheter från Bokix (/nyheter) ───────────────────────────────────────
// Listan över NEWS_POSTS (content/marketing/news.js), senaste först. Varje
// nyhet renderas av BlogPostPage.jsx på /nyheter/<slug>. Listan ritas av
// ArticleIndex.jsx, samma som bloggen.

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
    datePublished: schemaDate(p.datePublished),
    dateModified: schemaDate(p.dateModified),
    description: p.excerpt,
    // Samma författare som på själva artikelsidan (BlogPostPage.jsx).
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
  })),
};

export default function NewsPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Nyheter: det senaste i Bokix"
        description="Nya funktioner och förbättringar i Bokix, med datum och vad de betyder för dig och ditt företag."
        path="/nyheter"
        image={`${SITE_URL}${POSTS[0].image}`}
      />
      <JsonLd data={SCHEMA} />
      <ArticleIndex title="Nyheter" posts={POSTS} />
    </MarketingLayout>
  );
}
