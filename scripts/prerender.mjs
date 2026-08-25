// Genererar statiska HTML-ögonblicksbilder av de publika marknadssidorna
// EFTER den vanliga `vite build`, körs som sista steget i `npm run build`
// (se package.json). Varför det här behövs alls: Bokix är en ren
// klient-renderad SPA (main.jsx: `createRoot(...).render()`, ingen SSR i
// produktion) — utan det här skriptet innehåller den byggda dist/index.html
// bara ett tomt <div id="root"></div>, och ALLA rutter (/priser,
// /funktioner, /om-oss, /kontakt m.fl.) serverar exakt samma tomma skal.
// Sökmotor-crawlers som faktiskt kör JavaScript (Googlebot) klarar det med
// en extra renderingsfördröjning, men de flesta AI-crawlers som tränar och
// driver svarsmotorer (GPTBot, ClaudeBot, PerplexityBot, CCBot/Common
// Crawl, Google-Extended) kör INTE JavaScript alls — de hämtar den råa
// HTML:en en gång och läser textinnehållet direkt. Utan riktigt textinnehåll
// i själva HTML-svaret är Bokix praktiskt taget osynligt för dem, oavsett
// hur bra texten på sidorna faktiskt är. Det här skriptet löser det genom
// att faktiskt server-rendera varje sida (via en separat SSR-bunt av
// src/entry-server.jsx) och skriva resultatet till en egen
// dist/<rutt>/index.html — Vercel serverar en exakt matchande statisk fil
// FÖRE den generella SPA-fallback-rewriten i vercel.json
// ("/((?!api).*)" → "/index.html"), så crawlern får riktig, färdig HTML.
//
// Riktiga besökare påverkas inte alls: main.jsx monterar fortfarande med
// `createRoot(...).render()` (aldrig `hydrateRoot`), så webbläsaren skriver
// ändå över hela sidan med sitt eget render-träd så fort JS-bunten laddat —
// den förrenderade HTML:en är bara ett snabbare, textfyllt förstaintryck
// (bra för Core Web Vitals också), aldrig något klienten behöver matcha
// exakt.
//
// "Fail open" rakt igenom, samma princip som api/_botid.js redan använder
// för BotID-kollen: den här pipelinen är en ren förbättring ovanpå en redan
// fullt fungerande SPA, aldrig en förutsättning för att sajten ska gå att
// bygga eller driftsätta. VARJE steg — SSR-bygget, varje enskild sidas
// rendering, varje filskrivning — är inkapslat så att ett fel där bara
// hoppar över just den delen (och loggar en varning) istället för att
// fälla `npm run build` med en icke-noll exitkod. Värsta tänkbara utfall om
// något här går sönder är exakt dagens beteende (tomt skal + klientrendering),
// aldrig en trasig driftsättning.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = resolve(ROOT, 'dist');
const SSR_OUT = resolve(ROOT, 'dist-ssr');

function safeRun(label, fn) {
  try {
    fn();
    return true;
  } catch (error) {
    console.warn(`[prerender] Hoppar över "${label}" (inte kritiskt — sidan serveras som vanligt via SPA-fallbacken): ${error?.message || error}`);
    return false;
  }
}

async function main() {
  if (!existsSync(resolve(DIST, 'index.html'))) {
    console.warn('[prerender] dist/index.html saknas — hoppar över hela förrenderingen (kör `vite build` först).');
    return;
  }

  const builtSsr = safeRun('SSR-bygge (vite build --ssr)', () => {
    execSync('npx vite build --ssr src/entry-server.jsx --outDir dist-ssr --emptyOutDir', {
      cwd: ROOT,
      stdio: 'inherit',
    });
  });
  if (!builtSsr) return;

  const entryPath = resolve(SSR_OUT, 'entry-server.js');
  if (!existsSync(entryPath)) {
    console.warn(`[prerender] Hittade inte ${entryPath} efter SSR-bygget — hoppar över.`);
    return;
  }

  const [{ render, FAQ, HOME_FAQ }, { ROUTE_META }, { getOrganizationJsonLd, getSoftwareApplicationJsonLd, getFaqJsonLd, SITE_URL }, { COMPARISONS }, { GUIDE_FAQ }] = await Promise.all([
    import(entryPath),
    import(resolve(ROOT, 'src/components/marketing/routeMeta.js')),
    import(resolve(ROOT, 'src/components/marketing/structuredData.js')),
    // Ren JS (ingen JSX) — importeras direkt, samma anledning som routeMeta.js.
    import(resolve(ROOT, 'src/components/marketing/comparisons/comparisonData.js')),
    import(resolve(ROOT, 'src/components/marketing/guides/guidesFaq.js')),
  ]);

  const template = readFileSync(resolve(DIST, 'index.html'), 'utf8');
  const orgJsonLd = JSON.stringify(getOrganizationJsonLd());
  const appJsonLd = JSON.stringify(getSoftwareApplicationJsonLd());

  const routes = Object.keys(ROUTE_META);
  let succeeded = 0;

  for (const route of routes) {
    const ok = safeRun(`rendera ${route}`, () => {
      const appHtml = render(route);
      if (typeof appHtml !== 'string') throw new Error('render() gav inget HTML-svar');

      const meta = ROUTE_META[route];
      const url = `${SITE_URL}${route}`;

      let html = template;
      // <title> — index.html har alltid exakt en.
      html = html.replace(/<title>.*?<\/title>/s, `<title>${escapeHtml(meta.title)}</title>`);
      // Befintlig <meta name="description"> (finns redan för startsidan i index.html).
      html = html.replace(
        /<meta name="description" content=".*?"\s*\/?>/s,
        `<meta name="description" content="${escapeHtml(meta.description)}" />`
      );

      const extraHead = [
        `<link rel="canonical" href="${url}">`,
        `<meta property="og:title" content="${escapeHtml(meta.title)}">`,
        `<meta property="og:description" content="${escapeHtml(meta.description)}">`,
        `<meta property="og:url" content="${url}">`,
        `<meta property="og:image" content="${SITE_URL}/icon-512.png">`,
        `<meta property="og:type" content="website">`,
        `<meta name="twitter:card" content="summary">`,
        `<meta name="twitter:title" content="${escapeHtml(meta.title)}">`,
        `<meta name="twitter:description" content="${escapeHtml(meta.description)}">`,
        `<script type="application/ld+json">${orgJsonLd}</script>`,
        `<script type="application/ld+json">${appJsonLd}</script>`,
      ];
      // FAQPage-schema — samma FAQ-array respektive sida faktiskt renderar,
      // aldrig egna påhittade frågor (se structuredData.js). Startsidans
      // FAQ_ITEMS börjar MEDVETET med en bokstavlig "Vad är Bokix?"-fråga
      // (se kommentaren i LandingPage.jsx) — det här är den sida där en
      // AI-svarsmotor som söker efter "vad är bokix" har störst chans att
      // hitta ett kort, citerbart, entydigt svar.
      if (route === '/priser' && Array.isArray(FAQ)) {
        extraHead.push(`<script type="application/ld+json">${JSON.stringify(getFaqJsonLd(FAQ))}</script>`);
      }
      if (route === '/' && Array.isArray(HOME_FAQ)) {
        extraHead.push(`<script type="application/ld+json">${JSON.stringify(getFaqJsonLd(HOME_FAQ))}</script>`);
      }
      const comparisonSlug = route.startsWith('/jamfor/') ? route.slice('/jamfor/'.length) : null;
      const comparison = comparisonSlug ? COMPARISONS[comparisonSlug] : null;
      if (comparison && Array.isArray(comparison.faq)) {
        extraHead.push(`<script type="application/ld+json">${JSON.stringify(getFaqJsonLd(comparison.faq))}</script>`);
      }
      const guideSlug = route.startsWith('/guider/') ? route.slice('/guider/'.length) : null;
      const guideFaq = guideSlug ? GUIDE_FAQ[guideSlug] : null;
      if (guideFaq) {
        extraHead.push(`<script type="application/ld+json">${JSON.stringify(getFaqJsonLd(guideFaq))}</script>`);
      }
      html = html.replace('</head>', `${extraHead.join('\n    ')}\n  </head>`);

      html = html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);

      const outDir = route === '/' ? DIST : resolve(DIST, route.slice(1));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(resolve(outDir, 'index.html'), html, 'utf8');
    });
    if (ok) succeeded++;
  }

  console.log(`[prerender] Klar: ${succeeded}/${routes.length} sidor förrenderade.`);

  safeRun('städa dist-ssr', () => rmSync(SSR_OUT, { recursive: true, force: true }));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

main().catch((error) => {
  console.warn('[prerender] Oväntat fel, hoppar över hela förrenderingen (bygget fortsätter ändå):', error?.message || error);
});
