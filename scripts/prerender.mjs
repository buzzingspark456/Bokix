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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const distDir = path.join(root, 'dist');
const ssrDir = path.join(root, 'dist-ssr');

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
  return html;
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

  // Engångsbygget behövs inte i den slutliga dist/-mappen som deployas.
  fs.rmSync(ssrDir, { recursive: true, force: true });
  console.log('Klart.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
