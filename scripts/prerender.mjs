#!/usr/bin/env node
// ── SSG-byggsteg — kör EFTER `vite build` (klient) och `vite build --ssr
// src/entry-server.jsx` (server), se package.json "build". Producerar
// statisk, förrenderad HTML för de sex publika marknadssidorna (samma som
// public/sitemap.xml prioriterar ≥0.5) så en crawler som aldrig kör
// JavaScript (GPTBot/ClaudeBot/PerplexityBot m.fl. — till skillnad från
// Googlebot, som renderar JS i en fördröjd andra våg) faktiskt ser rubriker/
// brödtext/JSON-LD i den råa HTML:en, inte bara ett tomt <div id="root">.
//
// Rör ALDRIG den inloggade appen: App.jsx/AppRouter.jsx importeras aldrig
// här, bara de sex fristående marknadssidkomponenterna via entry-server.jsx.
//
// dist/index.html (byggd av vanliga `vite build`) sparas orörd som
// dist/app-shell.html INNAN den skrivs över — det är den filen som numera
// är catch-all-fallbacken i vercel.json (varje route som INTE är en av de
// sex nedan: den inloggade appen, gamla djuplänkar, /privacy m.fl.).
// dist/index.html själv blir istället den riktiga, förrenderade startsidan.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_ARTICLES } from '../src/content/marketing/news.js';
import { FAQ_GROUPS } from '../src/components/marketing/faqData.js';
import { BOKIX_SUMMARY, BOKIX_FACTS, BOKIX_FEATURES, BOKIX_DIFFERENT, BOKIX_NOT_FOR } from '../src/content/marketing/bokixFacts.js';
import { GUIDE_GROUPS } from '../src/content/marketing/guides.js';
import { MARKETING_ROUTES, DEFAULT_LOCALE, LOCALE_META, availableLocalesFor, localizedPath } from '../src/content/marketing/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');
const SITE_URL = 'https://www.bokix.se';

const templatePath = path.join(distDir, 'index.html');
const template = fs.readFileSync(templatePath, 'utf-8');

fs.writeFileSync(path.join(distDir, 'app-shell.html'), template);

const HEAD_START = '<!-- BOKIX_SEO_META_START -->';
const HEAD_END = '<!-- BOKIX_SEO_META_END -->';

function buildPage(render, routePath) {
  const rendered = render(routePath);
  if (rendered == null) throw new Error(`entry-server.render() gav inget för ${routePath} — saknas i PAGES-mappen i entry-server.jsx?`);

  // React 19 hissar <title>/<meta>/<link> (från <PageMeta>, se src/utils/seo.jsx)
  // till BÖRJAN av renderToString-utdata automatiskt, oavsett hur djupt
  // nästlade de är i komponentträdet — <div id="lp-root"> (MarketingLayouts
  // rot, alla sex sidorna) är därför en pålitlig delningspunkt: allt FÖRE
  // den är hissade head-taggar, allt FRÅN OCH MED den är den riktiga
  // sidkroppen som ska in i #root.
  const rootMarkerIndex = rendered.indexOf('<div id="lp-root"');
  if (rootMarkerIndex === -1) {
    throw new Error(`Kunde inte hitta <div id="lp-root"> i renderad HTML för ${routePath} — har MarketingLayout.jsx:s rot-div bytt id? Se entry-server.jsx/prerender.mjs.`);
  }
  const headTags = rendered.slice(0, rootMarkerIndex);
  const bodyHtml = rendered.slice(rootMarkerIndex);

  const headStartIdx = template.indexOf(HEAD_START);
  const headEndIdx = template.indexOf(HEAD_END);
  if (headStartIdx === -1 || headEndIdx === -1) {
    throw new Error('BOKIX_SEO_META_START/END-markörerna saknas i dist/index.html — se index.html.');
  }

  let html = template.slice(0, headStartIdx) + headTags + template.slice(headEndIdx + HEAD_END.length);
  html = html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
  // Marknadssidor får zooma (index.html har user-scalable=no för appen).
  // AppViewportLock i AppRouter.jsx låser den igen när själva appen monteras.
  html = html.replace(/<meta name="viewport"[^>]*>/, (tag) => tag.replace(/, maximum-scale=1(?:\.0)?/, '').replace(/, user-scalable=no/, ''));
  return html;
}

// Bara sidor som är riktigt förrenderade (egen <h1>, egen canonical) ska stå
// här. /boka-genomgang, /privacy, /terms, /cookies och /pub levererar bara
// app-skalet med canonical mot startsidan, så Google ser dem som kopior av
// startsidan och indexerar dem aldrig; de hålls utanför sitemapen tills de
// förrenderas.
// Senaste ändringsdatum för bloggen och nyheterna: det nyaste inlägget.
const latest = (posts) => posts.map(p => p.dateModified || p.datePublished).sort().at(-1);
// Uppdateras när videoguiderna spelas in på nytt (samma datum som UPLOADED i GuidesPage.jsx).
const GUIDES_UPDATED = '2026-09-28';

const SITEMAP_MANIFEST = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/funktioner', changefreq: 'monthly', priority: '0.8' },
  { path: '/priser', changefreq: 'monthly', priority: '0.8' },
  { path: '/byt-bokforingsprogram', changefreq: 'monthly', priority: '0.8' },
  { path: '/koppla-bank', changefreq: 'monthly', priority: '0.8' },
  { path: '/uf', changefreq: 'monthly', priority: '0.8' },
  { path: '/lon', changefreq: 'monthly', priority: '0.7' },
  { path: '/om-oss', changefreq: 'monthly', priority: '0.5' },
  { path: '/bokix-i-korthet', changefreq: 'monthly', priority: '0.7' },
  { path: '/kontakt', changefreq: 'monthly', priority: '0.5' },
  { path: '/verktyg', changefreq: 'monthly', priority: '0.7' },
  { path: '/verktyg/skanna-kvitto', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/momskalkylator', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/lonekalkylator', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/egenavgifter', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/rot-rut', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/drojsmalsranta', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/utdelning', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/momsdatum', changefreq: 'monthly', priority: '0.6' },
  { path: '/verktyg/arsredovisning', changefreq: 'monthly', priority: '0.6' },
  { path: '/ordlista', changefreq: 'monthly', priority: '0.6' },
  { path: '/guider', changefreq: 'monthly', priority: '0.6', lastmod: GUIDES_UPDATED },
  { path: '/blogg', changefreq: 'weekly', priority: '0.6', lastmod: latest(ALL_ARTICLES.filter(p => p.body && !p.news)) },
  { path: '/nyheter', changefreq: 'weekly', priority: '0.6', lastmod: latest(ALL_ARTICLES.filter(p => p.body && p.news)) },
  // Artiklarna härleds ur blog.js och news.js, samma lista som routing/förrendering.
  ...ALL_ARTICLES.filter(post => post.body).map(post => ({ path: post.path, changefreq: 'monthly', priority: '0.6', lastmod: post.dateModified || post.datePublished })),
  { path: '/vanliga-fragor', changefreq: 'monthly', priority: '0.6' },
  { path: '/integrationer', changefreq: 'monthly', priority: '0.6' },
  { path: '/sakerhet', changefreq: 'yearly', priority: '0.4' },
];

/** Skriver dist/sitemap.xml — samma sidor/priority/changefreq som förut,
 * plus en egen <url> per språkvariant (se TRANSLATED_ROUTES i
 * content/marketing/routes.js) med <xhtml:link hreflang> till alla sina
 * systersidor, exakt samma alternates som PageMeta (src/utils/seo.jsx)
 * redan sätter i <head> på varje sida — de två kan aldrig glida isär
 * eftersom båda läser samma TRANSLATED_ROUTES/localizedPath(). */
function generateSitemap() {
  const urls = [];
  for (const entry of SITEMAP_MANIFEST) {
    const isMarketingRoute = MARKETING_ROUTES.includes(entry.path);
    const locales = isMarketingRoute ? availableLocalesFor(entry.path) : [DEFAULT_LOCALE];
    for (const locale of locales) {
      urls.push({
        loc: `${SITE_URL}${localizedPath(locale, entry.path)}`,
        lastmod: entry.lastmod,
        changefreq: entry.changefreq,
        priority: entry.priority,
        alternates: isMarketingRoute
          ? [...locales.map((l) => ({ hreflang: LOCALE_META[l].hreflang, href: `${SITE_URL}${localizedPath(l, entry.path)}` })),
             { hreflang: 'x-default', href: `${SITE_URL}${entry.path}` }]
          : [],
      });
    }
  }

  const body = urls.map((u) => {
    const alternateTags = u.alternates.length
      ? '\n' + u.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`).join('\n')
      : '';
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${u.loc}</loc>${alternateTags}${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);
  console.log(`✓ sitemap.xml (${urls.length} URL:er, ${urls.filter(u => u.alternates.length).length} med hreflang-alternates)`);
}

// Artikeltext som ren text: **fet** och [länk](url) blir läsbar text.
const plain = (s) => String(s).replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => `${t} (${u.startsWith('/') ? SITE_URL + u : u})`);
function blockText(b) {
  const x = b.x;
  switch (b.t) {
    case 'h2': return `\n### ${plain(x)}\n`;
    case 'p': case 'code': return plain(x);
    case 'ul': case 'checklist': return (Array.isArray(x) ? x : []).map(i => `- ${plain(typeof i === 'string' ? i : i.x || i.h || '')}`).join('\n');
    case 'steps': return (x || []).map((s, i) => `${i + 1}. ${plain(s.h)}: ${plain(s.p)}`).join('\n');
    case 'callout': return `${b.title ? plain(b.title) + ': ' : ''}${plain(x)}`;
    case 'table': return [b.caption && plain(b.caption), (b.head || []).join(' | '), ...(b.rows || []).map(r => r.map(plain).join(' | '))].filter(Boolean).join('\n');
    case 'diagram': return b.caption ? plain(b.caption) : '';
    default: return typeof x === 'string' ? plain(x) : '';
  }
}

/** Fyller i dist/llms.txt (markörerna {{FAQ}} och {{ARTIKLAR}} i
 * public/llms.txt) och skriver dist/llms-full.txt med all text: fakta,
 * alla frågor och svar, videoguidernas rösttext och hela artiklarna. Allt
 * läses ur samma källor som sajten, så att filerna aldrig halkar efter. */
function writeLlmsFiles() {
  const file = path.join(distDir, 'llms.txt');
  if (!fs.existsSync(file)) return;
  const line = (p) => `- [${p.title}](${SITE_URL}${p.path}): ${p.seoDescription || p.excerpt}`;
  const byDate = (a, b) => b.datePublished.localeCompare(a.datePublished);
  const posts = ALL_ARTICLES.filter(p => p.body);
  const blog = posts.filter(p => !p.news);
  const news = posts.filter(p => p.news).sort(byDate);
  const articles = [
    '### Bloggen', '', ...blog.map(line), '',
    '### Nyheter', '', ...news.map(line),
  ].join('\n');
  const faq = FAQ_GROUPS.map(g => [`### ${g.title}`, ...g.items.map(i => `**${i.q}** ${i.a}`)].join('\n\n')).join('\n\n');
  const llms = fs.readFileSync(file, 'utf8').replace('{{FAQ}}', faq).replace('{{ARTIKLAR}}', articles);
  fs.writeFileSync(file, llms);

  const transcripts = JSON.parse(fs.readFileSync(path.join(__dirname, '../src/content/marketing/guideTranscripts.json'), 'utf8'));
  const full = [
    '# Bokix: all text för AI-tjänster', '',
    `> ${BOKIX_SUMMARY}`, '',
    `Källa: ${SITE_URL}. Den här filen skapas automatiskt från webbplatsens innehåll vid varje publicering.`, '',
    '## Fakta', '', ...BOKIX_FACTS.map(f => `- ${f.title}: ${f.body}`), '',
    '## Det här ingår', '', ...BOKIX_FEATURES.map(f => `- ${f}`), '',
    '## Så skiljer sig Bokix', '', ...BOKIX_DIFFERENT.map(f => `- ${f.title}: ${f.body}`), '',
    '## Passar inte för', '', ...BOKIX_NOT_FOR.map(f => `- ${f}`), '',
    '## Vanliga frågor', '', faq, '',
    '## Videoguider', '', `Alla filmer: ${SITE_URL}/guider`, '',
    ...GUIDE_GROUPS.flatMap(g => g.guides).flatMap(g => [`### ${g.title}`, '', (transcripts[g.slug] || []).join(' '), '']),
    '## Artiklar', '',
    ...[...blog, ...news].flatMap(p => [
      `### ${p.title}`, '', `${SITE_URL}${p.path} (publicerad ${p.datePublished})`, '',
      p.excerpt, '', ...p.body.map(blockText).filter(Boolean), '',
      ...(p.faq || []).map(f => `**${f.q}** ${f.a}`), '',
    ]),
  ].join('\n').replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(path.join(distDir, 'llms-full.txt'), full);
  console.log(`✓ llms.txt och llms-full.txt (${Math.round(full.length / 1024)} kB)`);
}

async function main() {
  const entryPath = path.join(ssrDir, 'entry-server.js');
  if (!fs.existsSync(entryPath)) {
    throw new Error(`Hittar inte ${entryPath} — kör "vite build --ssr src/entry-server.jsx --outDir dist-ssr" innan detta scriptet.`);
  }
  const { render, PRERENDER_ROUTES } = await import(`${'file://' + entryPath.replace(/\\/g, '/')}`);

  for (const route of PRERENDER_ROUTES) {
    const html = buildPage(render, route);
    const outPath = route === '/'
      ? templatePath
      : path.join(distDir, route.replace(/^\//, ''), 'index.html');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html);
    console.log(`✓ Förrenderade ${route} -> ${path.relative(distDir, outPath) || 'index.html'} (${(html.length / 1024).toFixed(1)} kB)`);
  }

  generateSitemap();
  writeLlmsFiles();

  // Engångsbygget behövs inte i den slutliga dist/-mappen som deployas.
  fs.rmSync(ssrDir, { recursive: true, force: true });
  console.log('Klart.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
