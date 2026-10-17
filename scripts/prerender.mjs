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
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_ARTICLES } from '../src/content/marketing/news.js';
import { FAQ_GROUPS } from '../src/components/marketing/faqData.js';
import { BOKIX_SUMMARY, BOKIX_FACTS, BOKIX_FEATURES, BOKIX_DIFFERENT, BOKIX_NOT_FOR } from '../src/content/marketing/bokixFacts.js';
import { GUIDE_GROUPS, GUIDE_UPLOAD_DATE } from '../src/content/marketing/guides.js';
import { schemaDate } from '../src/utils/schemaDate.js';
import { ORG_TYPE_PAGES } from '../src/content/marketing/orgTypes.js';
import { FEATURE_PAGES, HERO_VIDEO_DATE, HERO_VIDEO_DURATION, heroVideoFile } from '../src/content/marketing/featurePages.js';
import { MARKETING_ROUTES, DEFAULT_LOCALE, LOCALE_META, availableLocalesFor, localizedPath } from '../src/content/marketing/routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');
const SITE_URL = 'https://www.bokix.se';

const templatePath = path.join(distDir, 'index.html');
const template = fs.readFileSync(templatePath, 'utf-8');

// Appskalet (inloggning, registrering, okända adresser) är tomt tills
// JavaScriptet körts, och Bings webbplatsgenomsökning läser rå HTML: utan
// rubrik flaggas "H1 tag missing". En dold h1 i #root ger den en rubrik
// (även för skärmläsare under laddningen); createRoot ersätter den direkt.
const APP_SHELL_H1 = '<h1 style="position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">Bokix: enkel bokföring online för småföretagare</h1>';
if (!template.includes('<div id="root"></div>')) throw new Error('Hittade inte <div id="root"></div> i dist/index.html för appskalet.');
fs.writeFileSync(path.join(distDir, 'app-shell.html'), template.replace('<div id="root"></div>', `<div id="root">${APP_SHELL_H1}</div>`));

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

const xmlEscape = (value) => String(value).replace(/[<>&'"]/g, (char) => ({
  '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
})[char]);

// Loggor (vår egen ikon, partners, banker, andra program) är inte bilder vi
// vill synas med i bildsök, och de står på många sidor.
const NOT_CONTENT_IMAGE = /^\/(?:icon-|favicon|apple-touch|logos\/|flags\/)|logo|wordmark|stripe-icon|zettle-|gmail-icon/i;

// Ett omslag hör till sitt eget inlägg (och listorna /blogg och /nyheter),
// inte till alla sidor där det syns som ett litet relaterat kort. Annars står
// samma bild under tio adresser och Google väljer själv vilken sida den
// visas för.
const COVER_OWNER = new Map(ALL_ARTICLES.map(a => [`${SITE_URL}${a.image}`, a.path]));
const COVER_LISTS = new Set(['/blogg', '/nyheter']);
function keepImageOn(route, image) {
  // Listorna visar WebP-miniatyren (utils/blogThumb.js), som hör till samma inlägg.
  const owner = COVER_OWNER.get(image.replace(/\/blog\/thumb\/(.+)\.webp$/, '/blog/$1.jpg'));
  return !owner || owner === route || COVER_LISTS.has(route);
}

function imagesFromHtml(html) {
  const images = new Set();
  const addImage = (src) => {
    if (!src || /^(data:|blob:)/i.test(src)) return;
    const imageUrl = new URL(src, SITE_URL);
    if (!['www.bokix.se', 'bokix.se'].includes(imageUrl.hostname)) return;
    if (!/\.(?:avif|gif|jpe?g|png|webp)$/i.test(imageUrl.pathname)) return;
    if (NOT_CONTENT_IMAGE.test(imageUrl.pathname)) return;
    images.add(imageUrl.href);
  };
  for (const [, attributes] of html.matchAll(/<img\b([^>]*)>/gi)) {
    const src = attributes.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const alt = attributes.match(/\balt=["']([^"']*)["']/i)?.[1]?.trim();
    if (alt) addImage(src);
  }
  for (const [, attributes] of html.matchAll(/<video\b([^>]*)>/gi)) {
    addImage(attributes.match(/\bposter=["']([^"']+)["']/i)?.[1]);
  }
  return [...images];
}

const pageImages = new Map();

// Bara sidor som är riktigt förrenderade (egen <h1>, egen canonical) ska stå
// här. /boka-genomgang, /privacy, /terms, /cookies och /pub levererar bara
// app-skalet med canonical mot startsidan, så Google ser dem som kopior av
// startsidan och indexerar dem aldrig; de hålls utanför sitemapen tills de
// förrenderas.
// Senaste ändringsdatum för bloggen och nyheterna: det nyaste inlägget.
const latest = (posts) => posts.map(p => p.dateModified || p.datePublished).sort().at(-1);
// ── lastmod för sidor utan eget datum (startsidan, priser, verktygen …) ──
// Bing och Google litar bara på lastmod som stämmer: ett datum som byts vid
// varje bygge ignoreras. Därför sparas ett fingeravtryck av varje sidas
// synliga innehåll (text, title, description) i scripts/page-dates.json, och
// datumet byts bara när fingeravtrycket ändras. Ett lokalt bygge skriver
// filen (checka in den); Vercels bygge skriver inte, men en sida som ändrats
// sedan filen checkades in får dagens datum, vilket också stämmer.
const PAGE_DATES_PATH = path.join(__dirname, 'page-dates.json');
const pageDates = fs.existsSync(PAGE_DATES_PATH) ? JSON.parse(fs.readFileSync(PAGE_DATES_PATH, 'utf-8')) : {};
const pageLastmod = {};
const seenRoutes = new Set();
let pageDatesChanged = false;
function recordPageDate(route, html) {
  seenRoutes.add(route);
  const pick = (re) => (html.match(re) || [])[1] || '';
  const body = html.slice(html.indexOf('<div id="root">'))
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const content = [pick(/<title>([^<]*)<\/title>/i), pick(/<meta name="description" content="([^"]*)"/i), body].join('\n');
  const hash = crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  const today = new Date().toISOString().slice(0, 10);
  const stored = pageDates[route];
  if (stored?.hash === hash) {
    pageLastmod[route] = stored.date;
  } else {
    pageLastmod[route] = today;
    pageDates[route] = { hash, date: today };
    pageDatesChanged = true;
  }
}

const SITEMAP_MANIFEST = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/funktioner', changefreq: 'monthly', priority: '0.8' },
  { path: '/priser', changefreq: 'monthly', priority: '0.8' },
  { path: '/byt-bokforingsprogram', changefreq: 'monthly', priority: '0.8' },
  ...ORG_TYPE_PAGES.map(p => ({ path: p.path, changefreq: 'monthly', priority: '0.8' })),
  ...FEATURE_PAGES.map(p => ({
    path: p.path, changefreq: 'monthly', priority: '0.8',
    video: p.video ? { url: `${SITE_URL}/videos/hero/${heroVideoFile(p)}.mp4`, thumbnail: `${SITE_URL}/videos/hero/${heroVideoFile(p)}.jpg`, title: p.video.title, description: p.video.description, duration: HERO_VIDEO_DURATION, date: HERO_VIDEO_DATE } : null,
  })),
  { path: '/koppla-bank', changefreq: 'monthly', priority: '0.8' },
  { path: '/uf', changefreq: 'monthly', priority: '0.8' },
  { path: '/lon', changefreq: 'monthly', priority: '0.7' },
  { path: '/om-oss', changefreq: 'monthly', priority: '0.5' },
  { path: '/bokix-i-korthet', changefreq: 'monthly', priority: '0.7' },
  { path: '/lagg-till-pa-hemskarmen', changefreq: 'monthly', priority: '0.6' },
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
  { path: '/guider', changefreq: 'monthly', priority: '0.6', lastmod: GUIDE_UPLOAD_DATE },
  ...GUIDE_GROUPS.flatMap(group => group.guides.map(guide => ({
    path: `/guider/${guide.slug}`,
    changefreq: 'monthly',
    priority: '0.6',
    // lastmod från sidans innehåll (page-dates.json), inte filmens datum:
    // ändras visningssidan ska Google se det och läsa om den.
    video: guide,
  }))),
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
        lastmod: entry.lastmod || pageLastmod[localizedPath(locale, entry.path)],
        changefreq: entry.changefreq,
        priority: entry.priority,
        images: pageImages.get(localizedPath(locale, entry.path)) || [],
        video: entry.video || null,
        alternates: isMarketingRoute && locales.length > 1
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
    const imageTags = u.images.map(image =>
      `\n    <image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>`,
    ).join('');
    const videoTags = u.video ? (() => {
      const durationParts = u.video.duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
      const duration = durationParts
        ? Number(durationParts[1] || 0) * 3600 + Number(durationParts[2] || 0) * 60 + Number(durationParts[3] || 0)
        : 0;
      // Videoguider har slug/lead; filmerna på funktionssidorna har färdiga url:er.
      const videoUrl = u.video.url || `${SITE_URL}/videos/${u.video.slug}.mp4`;
      const thumbnailUrl = u.video.thumbnail || `${SITE_URL}/videos/${u.video.slug}.jpg`;
      const description = u.video.url ? u.video.description : `${u.video.lead} Se videon och läs hela instruktionen.`;
      return `\n    <video:video>\n      <video:thumbnail_loc>${xmlEscape(thumbnailUrl)}</video:thumbnail_loc>\n      <video:title>${xmlEscape(u.video.title)}</video:title>\n      <video:description>${xmlEscape(description)}</video:description>\n      <video:content_loc>${xmlEscape(videoUrl)}</video:content_loc>\n      <video:duration>${duration}</video:duration>\n      <video:publication_date>${schemaDate(u.video.date || GUIDE_UPLOAD_DATE)}</video:publication_date>\n    </video:video>`;
    })() : '';
    return `  <url>\n    <loc>${xmlEscape(u.loc)}</loc>${alternateTags}${lastmod}${imageTags}${videoTags}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
  }).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${body}\n</urlset>\n`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);
  console.log(`✓ sitemap.xml (${urls.length} URL:er, ${urls.filter(u => u.images.length).length} med bilder, ${urls.filter(u => u.video).length} med video)`);
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
    recordPageDate(route, html);
    // Miniatyren i listorna ersätts av originalet: samma bild, större.
    const fullSize = imagesFromHtml(html).map(image => image.replace(/\/blog\/thumb\/(.+)\.webp$/, '/blog/$1.jpg'));
    pageImages.set(route, [...new Set(fullSize)].filter(image => keepImageOn(route, image)));
    console.log(`✓ Förrenderade ${route} -> ${path.relative(distDir, outPath) || 'index.html'} (${(html.length / 1024).toFixed(1)} kB)`);
  }

  generateSitemap();
  // Sidor som inte längre byggs (borttagna språk m.m.) tas bort ur filen.
  for (const route of Object.keys(pageDates)) {
    if (!seenRoutes.has(route)) { delete pageDates[route]; pageDatesChanged = true; }
  }
  if (pageDatesChanged && !process.env.VERCEL) {
    fs.writeFileSync(PAGE_DATES_PATH, JSON.stringify(pageDates, null, 2) + '\n');
    console.log('✓ scripts/page-dates.json uppdaterad (checka in den)');
  }
  writeLlmsFiles();

  // Engångsbygget behövs inte i den slutliga dist/-mappen som deployas.
  fs.rmSync(ssrDir, { recursive: true, force: true });
  console.log('Klart.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
