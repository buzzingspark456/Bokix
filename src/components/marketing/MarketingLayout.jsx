import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { ACCENT_CYCLE, SERIF } from './marketingTokens';
import { JsonLd, SITE_URL } from '../../utils/seo';
// Ordmärket flyttat till shared/ (delas nu även av App.jsx BokixLogo, se
// dess egen kommentar för varför). Importerad OCH återexporterad under
// samma namn här — importen ger den här filens EGNA <BokixWordmark>-bruk
// (headern/footern/mobilmenyn nedan) en lokal bindning, återexporten låter
// de sex ställen som redan gör `import { BokixWordmark } from
// './marketing/MarketingLayout'` fortsätta oförändrade.
import { TOOLS, TOOLS_HUB_PATH } from './tools/toolsConfig';
import BokixWordmark from '../shared/BokixWordmark';
export { BokixWordmark };

// Organization-schema (schema.org) — samma på VARJE marknadssida (den här
// layouten wrappar alla fem, se botten av filen) eftersom en organisations
// identitet inte är sid-specifik. Ger Google/Bing ett tydligt, strukturerat
// "det här företaget heter Bokix, finns på den här domänen, nås på den här
// mejladressen" istället för att behöva gissa det ur brödtexten — samma sak
// AI-svarsmotorer (Claude/ChatGPT/Perplexity) hellre citerar än fritext.
// Bara verifierbara fält (namn, url, kontakt-mejl som redan står på
// /kontakt) — inga påhittade adresser/organisationsnummer/betyg.
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Bokix',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  description: 'Bokix är ett modernt, enkelt och kraftfullt bokföringsprogram för svenska företag i alla bolagsformer: bokföring, fakturering och lön i samma verktyg.',
  email: 'support@bokix.se',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@bokix.se',
    contactType: 'customer support',
    areaServed: 'SE',
    availableLanguage: ['sv'],
  },
};

// Kundönskemål: en mörkt-läge-option på marknadssidan. Samma localStorage-
// nyckel som den inloggade appen (App.jsx) — en besökare som redan valt
// mörkt läge där ska mötas av samma tema på den publika sajten också,
// istället för att behöva välja två gånger. Egen liten läsfunktion här
// (inte en delad hook mot App.jsx) eftersom marknadssidan är en helt
// fristående yta utan tillgång till App.jsx:s theme-state — men EXPORTERAD
// så DemoWorkspace.jsx kan anropa den en gång till för sitt eget
// `theme === 'dark'`-villkor (headerns bakgrund ska bara matcha sidomenyn i
// mörkt läge, se index.css :root[data-theme="dark"] .desktop-top-bar).
// Ofarligt att anropa två gånger — båda instanserna läser/skriver samma
// localStorage-nyckel och samma <html data-theme>, aldrig i otakt.
export function useMarketingTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('bokix_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* privat läge/blockerad storage — kör vidare med OS-valet */ }
    return (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  });
  useEffect(() => {
    try { localStorage.setItem('bokix_theme', theme); } catch { /* samma reservläge som ovan */ }
    // Sätts även på <html> (inte bara #lp-root nedan) — DemoWorkspace.jsx
    // (den inbäddade "såhär ser appen ut"-produktvisningen på startsidan)
    // återanvänder appens EGNA var(--bg-card)/var(--text-main) osv från
    // index.css, som bara skriver om sig via :root[data-theme="dark"] på
    // det riktiga rot-elementet — utan det här skulle demokortet stå kvar
    // ljust även när resten av marknadssidan gått mörk.
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return [theme, () => setTheme(t => (t === 'dark' ? 'light' : 'dark'))];
}

// Loggan är alltid en länk till startsidan ("/"), oavsett vilken undersida
// man står på — se användningarna av <BokixWordmark> nedan.

// Sitemap — varje punkt är en RIKTIG egen sida/URL, inte ett skrolla-till-
// sektion-på-samma-sida-ankare som tidigare. Loggan är det enda som alltid
// går till startsidan; de här länkarna går var och en till sin egen sida.
export const MARKETING_PAGES = [
  { label: 'Funktioner', to: '/funktioner' },
  { label: 'Priser', to: '/priser' },
  { label: 'Verktyg', to: '/verktyg' },
  { label: 'Blogg', to: '/blogg' },
  { label: 'Om oss', to: '/om-oss' },
  { label: 'Kontakt', to: '/kontakt' },
];

/** Globala stilar + animationer, delade av ALLA marknadssidor — en enda
 * källa så knappar/kort/skroll-reveal aldrig kan divergera mellan sidorna. */
function MarketingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      #lp-root, #lp-root *, #lp-root *::before, #lp-root *::after { box-sizing: border-box; }
      /* Rubriker bryter jämnt i stället för att lämna ett ensamt ord
         på sista raden ("...varje / månad"). Stöds brett; webbläsare utan
         stöd bryter som förut. */
      #lp-root h1, #lp-root h2, #lp-root h3 { text-wrap: balance; }
      html { scroll-behavior: smooth; }

      /* ── Marknadssajtens egna tema-tokens (marketingTokens.js pekar hit) —
         se kommentaren där för varför det här är en SEPARAT palett från
         appens index.css. Ljust läge (default) oförändrat mot tidigare
         literala värden; mörkt läge speglar samma djupgröna identitet som
         den inloggade appens mörka tema, så de två känns som samma
         varumärke även om paletterna är fristående. */
      #lp-root {
        --mkt-page-bg: #ffffff;
        --mkt-header-bg: #ffffff;
        --mkt-card-bg: #ffffff;
        --mkt-ink: #1c2420;
        --mkt-ink-soft: #3a453e;
        --mkt-muted: #6b7568;
        --mkt-ivory: #faf9f5;
        --mkt-card-border: #eee8dc;
        --mkt-card-shadow: 0 24px 44px -30px rgba(28,36,32,0.24), 0 2px 8px rgba(28,36,32,0.05);
        --mkt-card-shadow-sm: 0 10px 24px -18px rgba(28,36,32,0.2);
        --mkt-accent-green-fg: oklch(52% 0.17 145);
        --mkt-accent-green-soft: oklch(93% 0.05 145);
        /* Lighthouse (Tillgänglighet): 56% ljushet gav rgb(0,124,204) mot
           vit kortbakgrund = 4.42:1 — precis under WCAG AA:s 4.5:1-krav
           för text i den här storleken (Nyckeltalskortens "INTÄKTER"-
           etikett, 12px fet). 52% ger rgb(0,112,191) = 5.16:1, samma blå
           ton bara någon nyans mörkare. Röd/grön (raderna nedan) klarade
           redan 4.5:1 utan ändring, rörda inte. */
        --mkt-accent-blue-fg: oklch(52% 0.17 240);
        --mkt-accent-blue-soft: oklch(93% 0.045 240);
        /* Turkos — loggans mellanfärg (blå→TURKOS→lime), tredje hjulet i
           ACCENT_CYCLE (marketingTokens.js) sedan rött plockades ur den
           cykeln på kundönskemål. Samma ljushet/mättnad som blått ovan,
           bara skiftad hue mellan grönt (145) och blått (240). */
        --mkt-accent-teal-fg: oklch(52% 0.15 190);
        --mkt-accent-teal-soft: oklch(93% 0.045 190);
        --mkt-accent-red-fg: oklch(55% 0.19 25);
        --mkt-accent-red-soft: oklch(93% 0.05 25);
        --mkt-border-soft: #e5e7eb;
        --mkt-nav-text: #374151;
        --mkt-heading: #111827;
        --mkt-section-red-tint: oklch(97% 0.02 25);
        --mkt-section-mint: oklch(97.5% 0.022 165);
        --mkt-section-blue: oklch(97.5% 0.02 245);
      }
      #lp-root[data-theme="dark"] {
        --mkt-page-bg: #0f1a13;
        --mkt-header-bg: #0f1a13;
        --mkt-card-bg: #17281c;
        --mkt-ink: #eef3ea;
        --mkt-ink-soft: #c3d0bd;
        --mkt-muted: #8fa088;
        --mkt-ivory: #141f18;
        --mkt-card-border: #2a3d2c;
        --mkt-card-shadow: 0 24px 44px -30px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
        --mkt-card-shadow-sm: 0 10px 24px -18px rgba(0,0,0,0.5);
        --mkt-accent-green-fg: oklch(76% 0.15 145);
        --mkt-accent-green-soft: oklch(30% 0.06 145);
        --mkt-accent-blue-fg: oklch(76% 0.13 240);
        --mkt-accent-blue-soft: oklch(30% 0.05 240);
        --mkt-accent-teal-fg: oklch(76% 0.12 190);
        --mkt-accent-teal-soft: oklch(30% 0.05 190);
        --mkt-accent-red-fg: oklch(73% 0.16 25);
        --mkt-accent-red-soft: oklch(30% 0.06 25);
        --mkt-border-soft: #2a3d2c;
        --mkt-nav-text: #c3d0bd;
        --mkt-heading: #eef3ea;
        --mkt-section-red-tint: oklch(20% 0.03 25);
        --mkt-section-mint: oklch(21% 0.03 165);
        --mkt-section-blue: oklch(21% 0.03 245);
      }
      #lp-root[data-theme="dark"] .lp-btn-secondary:hover { background: var(--mkt-ivory) !important; }
      /* Kundönskemål: Zettle/Bolagsverket/Skatteverkets loggor (BrandLogos.jsx,
         ThemedLogo) har en ljus- och en mörk-bläck-variant av samma bild —
         den här regeln väljer vilken som visas, styrt av samma
         #lp-root[data-theme]-attribut allt annat mörkt-läge redan använder. */
      .lp-logo-dark { display: none; }
      #lp-root[data-theme="dark"] .lp-logo-light { display: none; }
      #lp-root[data-theme="dark"] .lp-logo-dark { display: inline-block; }
      #lp-root[data-theme="dark"] .lp-mobile-menu.lp-open { background: var(--mkt-page-bg) !important; }
      .lp-btn-primary { transition: all 0.2s !important; }
      .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(11,99,41,0.4) !important; }
      .lp-btn-secondary:hover { background: #f9fafb !important; }
      .lp-feature-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .lp-feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px -12px rgba(0,0,0,0.14) !important; border-color: transparent !important; }
      /* ── Varje nav-länk (Funktioner/Priser/Om oss/Kontakt) bär sin egen
         accentfärg via --nav-accent (satt inline per länk, se MARKETING_PAGES
         nedan) — samma grönt/blått/rött-triad som resten av sajten,
         istället för att alla fyra hovrar till samma enfärgade grönt. ── */
      .lp-nav-link { position: relative; }
      .lp-nav-link:hover, .lp-nav-link.active { color: var(--nav-accent, ${BRAND.green}) !important; }
      .lp-nav-link::after {
        content: ''; position: absolute; left: 0; right: 0; bottom: 4px; height: 2px;
        background: var(--nav-accent, ${BRAND.green}); transform: scaleX(0); transform-origin: center;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .lp-nav-link:hover::after, .lp-nav-link.active::after { transform: scaleX(1); }
      .lp-footer-link:hover { color: white !important; }
      .lp-card-hover { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
      .lp-card-hover:hover { transform: translateY(-3px); }

      /* ── Färgstark uppdatering — Bokix egna logga-/dashboard-gradienter
         (blå→turkos→lime i loggan, grönt/rosarött i Startsidans KPI-kort)
         istället för en enfärgad grön accent. FAQ-dragspel + kort-hover
         är det enda som behöver riktig CSS här, resten sätts som inline-
         style-gradients i respektive sida (samma konvention som redan
         gäller). */
      .lp-faq-item { border-bottom: 1px solid var(--mkt-border-soft); overflow: hidden; }
      /* Kundönskemål ("gör färgerna på Vanliga frågor bättre") — en hel
         mättad bakgrundston bakom en ÖPPEN fråga (tidigare) läste som
         "för mycket färg" på en annars ljus lista. En vänsterkant + en
         mycket svag ton (color-mix i FaqItem, LandingPage.jsx) räcker för
         att visa vilken som är öppen, plus en riktig hover-respons på de
         STÄNGDA raderna (fanns inte innan — UX-lucka, ingen visuell
         feedback innan man faktiskt klickade). */
      .lp-faq-question:hover { background: var(--mkt-ivory); }
      .lp-faq-question {
        width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
        background: none; border: none; text-align: left; cursor: pointer; font-family: inherit;
        padding: 22px 4px; color: var(--mkt-heading);
      }
      .lp-faq-chevron { transition: transform 0.25s cubic-bezier(0.16,1,0.3,1); flex-shrink: 0; color: var(--mkt-muted); }
      .lp-faq-chevron.lp-faq-open { transform: rotate(180deg); }
      .lp-faq-answer { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.35s cubic-bezier(0.16,1,0.3,1); }
      .lp-faq-answer.lp-faq-open { grid-template-rows: 1fr; }
      .lp-faq-answer > div { overflow: hidden; }

      .lp-lux-card { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1), box-shadow 0.35s ease, border-color 0.35s ease; }
      .lp-lux-card:hover { transform: translateY(-6px) scale(1.01); box-shadow: 0 24px 48px -20px rgba(15,23,42,0.2) !important; }

      /* Jämförelsetabellen (LandingPage.jsx) — subtil radmarkering vid
         hover, samma "det här är interaktivt/levande" känsla som resten av
         sidan istället för en helt statisk tabell. */
      .lp-compare-row { transition: background-color 0.15s ease; }
      .lp-compare-row:hover { background-color: var(--mkt-ivory); }

      /* Levande hero-bakgrund — tre färgade klot (loggans blå/turkos/lime +
         ett rosarött) som sakta driver och pulserar, aldrig helt stilla.
         prefers-reduced-motion respekteras — se media-queryn längst ner. */
      @keyframes lpBlobDrift {
        0%   { transform: translate(0, 0) scale(1); }
        33%  { transform: translate(3%, -4%) scale(1.06); }
        66%  { transform: translate(-3%, 3%) scale(0.97); }
        100% { transform: translate(0, 0) scale(1); }
      }
      .lp-blob { animation: lpBlobDrift 14s ease-in-out infinite; will-change: transform; }
      .lp-blob-slow { animation-duration: 20s; }
      .lp-blob-slower { animation-duration: 26s; }


      /* ── Kundönskemål ("linjer till Bokix som rör sig hela tiden",
         "mer automation"): marscherande streck längs SVG-linjer — samma
         teknik båda "Kopplat till"-diagrammet (LandingPage.jsx) och
         leverantörsfaktura-flödets kopplingslinjer använder, så hela
         sidan känns som EN konsekvent "levande koppling"-idé istället för
         två olika lösningar. stroke-dashoffset är en riktig compositor-
         vänlig SVG-egenskap (ingen omritning av hela linjen varje bildruta
         som en background-position-animation på en <div> hade krävt). ── */
      @keyframes lpFlowDash { to { stroke-dashoffset: -24; } }
      .lp-flow-line { stroke-dasharray: 5 7; animation: lpFlowDash 1.1s linear infinite; }
      /* Samma flöde men för en CSS-gradient-"linje" (div, inte SVG) —
         leverantörsfaktura-pipen mellan de tre stegen. */
      @keyframes lpFlowGradient { 0% { background-position: 0% 0; } 100% { background-position: -200% 0; } }
      .lp-flow-connector { background-size: 200% 100%; animation: lpFlowGradient 2.4s linear infinite; }
      @keyframes lpHubPulse { 0%, 100% { transform: scale(1); opacity: 0.5; } 50% { transform: scale(1.12); opacity: 0.9; } }
      .lp-hub-pulse { animation: lpHubPulse 2.6s ease-in-out infinite; }
      /* Kundönskemål ("denna ska vara moving") — jämförelsetabellens
         Bokix-vinnarkolumn får ett sakta svepande ljus över sin gradient-
         bakgrund istället för en helt stillastående ton, samma
         background-position-teknik som Heros .lp-gradient-text redan
         etablerat på sidan. */
      @keyframes lpColumnSweep { 0% { background-position: 0% 0; } 100% { background-position: -200% 0; } }
      .lp-column-sweep { background-size: 220% 100%; animation: lpColumnSweep 4.5s linear infinite; }

      /* "Kopplat till"-diagrammets aktivitetskort — en långsam, mjuk
         guppning så de känns levande utan att bli distraherande, samma
         princip som .lp-hub-pulse. */
      @keyframes lpToastFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
      .lp-toast-float { animation: lpToastFloat 4s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .lp-flow-line, .lp-flow-connector, .lp-hub-pulse, .lp-column-sweep, .lp-toast-float { animation: none !important; }
      }

      /* ── Onboarding-flödet ("Igång på tre steg", LandingPage.jsx) — samma
         kopplad-pipeline-idé som resten av sidans flöden (kund-
         önskemål: "gör den snyggare"), men utan skärmdumpar (det här är
         signup-flödet, inte ett produktfönster) så noderna hålls smalare.
         Egna klasser eftersom de behöver en annan
         bredd än skärmdump-korten. */
      .lp-step-flow { display: flex; align-items: flex-start; justify-content: center; gap: 0; }
      .lp-step-node { flex: 0 1 340px; display: flex; flex-direction: column; align-items: center; text-align: center; }
      .lp-step-connector { flex: 1 1 30px; max-width: 90px; min-width: 20px; height: 3px; border-radius: 2px; margin-top: 42px; }
      @media (max-width: 720px) {
        .lp-step-flow { flex-direction: column; align-items: center; }
        .lp-step-node { flex: none; max-width: 360px; }
        .lp-step-connector { width: 3px; height: 32px; min-width: 0; max-width: none; flex: none; margin: 2px 0; }
      }

      /* ── "Ljus genom molnen" — Bokix egen tråd genom HELA sidan
         (kundönskemål: sektionerna under Hero kändes för tama mot Heros
         levande molnshader). Hero visar en tät, riktig himmel; varje
         sektion därunder får en egen mjuk färgvåg i SAMMA blå→turkos→lime-
         gradient (+ grönt/rosarött från nyckeltalskorten) som om ljuset från
         den himlen bryter igenom — inte en ny stämning, ett eko av den
         första. Färgvågorna själva byggs som lagrade radial-gradients
         direkt i respektive sektions egen bakgrund (se auroraWash() i
         LandingPage.jsx) — ingen filter:blur över hela ytan, betydligt
         billigare än Heros WebGL och tidigare klot. .lp-ledger-lines
         nedan är den ENDA rena dekoren som fått vara kvar: ett städat
         radmönster likt kassabokspapper, en riktig bokföringsdetalj,
         reserverad för de två sektioner vars innehåll faktiskt HANDLAR om
         bokföring/tabelldata (inte tapetserat över hela sidan). */
      .lp-ledger-lines {
        position: absolute; inset: 0; pointer-events: none;
        background-image: repeating-linear-gradient(180deg, var(--mkt-ink) 0px, var(--mkt-ink) 1px, transparent 1px, transparent 34px);
        opacity: 0.055;
        -webkit-mask-image: linear-gradient(180deg, transparent, black 14%, black 86%, transparent);
        mask-image: linear-gradient(180deg, transparent, black 14%, black 86%, transparent);
      }

      /* Finkornig, HELT stillastående filmkorn-textur över hela marknads-
         sajten (fixed, inte per sektion) — samma "det här är genomarbetat,
         inte en mall"-känsla premium-SaaS-sajter ofta har, i mikroskopisk
         styrka (3.5% opacitet + overlay-blend) så den aldrig stör
         läsbarheten, bara ger ytan lite liv utöver de platta färgerna.
         pointer-events:none + pseudo-element så den aldrig kan fånga en
         klick/touch. */
      #lp-root::before {
        content: ''; position: fixed; inset: 0; z-index: 1; pointer-events: none;
        opacity: 0.035; mix-blend-mode: overlay;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        background-size: 140px 140px;
      }

      @keyframes lpFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      .lp-float { animation: lpFloat 5s ease-in-out infinite; }

      /* Lighthouse (Prestanda-granskning, "Undvik icke sammansatta
         animationer"): box-shadow-pulsen nedan animerade box-shadow direkt
         på knappen — box-shadow är INTE en "sammansatt" (compositor-only)
         egenskap, så webbläsaren fick måla om knappens hela yta varje
         frame istället för att bara flytta ett GPU-lager, i alla tre
         "Prova gratis"-knapparna samtidigt. Samma pulserande ring, men
         byggd av en ::after-pseudoelement som skalas upp och tonas bort
         (transform+opacity, båda äkta compositor-egenskaper) istället för
         att måla en växande skugga. .lp-pulse behöver position:relative
         för att pseudoelementets inset:0 ska positioneras mot KNAPPEN,
         inte mot närmsta positionerade förälder längre upp i trädet. */
      .lp-pulse { position: relative; }
      .lp-pulse::after {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        border: 2px solid rgba(11,99,41,0.45);
        opacity: 0.7;
        animation: lpPulseRing 2.4s cubic-bezier(0.4,0,0.6,1) infinite;
        pointer-events: none;
      }
      @keyframes lpPulseRing {
        0% { transform: scale(1); opacity: 0.7; }
        70% { transform: scale(1.16); opacity: 0; }
        100% { transform: scale(1.16); opacity: 0; }
      }

      /* Samma sak för CTA-sektionens rörliga gradientbakgrund — animerade
         tidigare background-position (målning varje frame över hela
         sektionens yta) istället för transform (compositor). Nu ligger
         gradienten på ett eget, överdimensionerat lager (se .lp-anim-
         gradient-layer i LandingPage.jsx) som bara TRANSLATERAS sida till
         sida — overflow:hidden på sektionen klipper det som glider utanför. */
      @keyframes lpGradientMove {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .lp-gradient-text {
        background-size: 200% auto;
        animation: lpGradientMove 6s ease-in-out infinite;
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
      }
      .lp-anim-gradient-layer {
        position: absolute; inset: -20% -50%;
        background-size: 200% 200%;
        animation: lpGradientShift 10s ease-in-out infinite;
        will-change: transform;
      }
      @keyframes lpGradientShift {
        0%   { transform: translate3d(0%, 0, 0); }
        50%  { transform: translate3d(-20%, 0, 0); }
        100% { transform: translate3d(0%, 0, 0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .lp-blob, .lp-float, .lp-pulse::after, .lp-gradient-text, .lp-anim-gradient-layer { animation: none !important; }
      }

      /* ── Inspirerat av Aceternity UI (ui.aceternity.com) — "moving
         border"-knappen nedan, ombyggd i sidans EGET formspråk istället
         för kopierad rakt av: inga Tailwind-klasser/framer-motion
         (Tailwind är medvetet avstängt utanför Tremor-diagrammen, se
         vite.config.js), bara CSS-variabler, och Bokix egna märkesfärger
         istället för Aceternitys lila/svarta standardpalett (samma
         princip som GRAD-kommentaren i LandingPage.jsx: känns som SAMMA
         produkt, inte en importerad stämning ovanpå den). Hero-
         bakgrundens grid+beams-lager (tidigare version av den här
         kommentaren) är ersatt av CloudShaderBackground.jsx — en riktig
         WebGL-molnshader, se dess egen kommentar för varför.

         Kundfeedback: den tidigare muspekar-spotlighten (Hero-bakgrunden
         och per-kort-glöden i varje korts egen accentfärg, grönt/blått/
         rött) kändes rörig — borttagen helt, korten/sektionerna faller
         tillbaka på sin vanliga .lp-lux-card-hover (lyft + skugga, ingen
         färg). ── */

      /* "Moving border"-knapp — Aceternitys roterande gradientram, gjord
         med @property (animerbar CSS-variabel) + conic-gradient istället
         för deras SVG/motion-path-version. En padding-box-wrapper (inte
         en ::before bakom knappen): CSS:ens stapelordning målar en
         negativt z-indexerad pseudo-element OVANPÅ sitt eget elements
         bakgrund, inte bakom den (Appendix E), så en ::before-variant på
         knappen själv svämmade över hela ytan istället för att bli en
         tunn ram. Wrappern nedan bär gradienten som sin EGNA bakgrund och
         lämnar bara 2px padding synlig runt den solida knappen inuti —
         garanterat en ram, oavsett stapelordning. Stödjer webbläsaren
         inte @property faller det bara tillbaka på en stillastående
         gradientram — aldrig trasigt, bara mindre levande. */
      @property --lp-angle {
        syntax: '<angle>';
        inherits: false;
        initial-value: 0deg;
      }
      .lp-moving-border-wrap {
        display: inline-block; padding: 2px; border-radius: 14px;
        background: conic-gradient(from var(--lp-angle), #0ea5e9, #14b8a6, #84cc16, #0ea5e9);
        animation: lpRotateBorder 2.8s linear infinite;
      }
      @keyframes lpRotateBorder { to { --lp-angle: 360deg; } }
      @media (prefers-reduced-motion: reduce) { .lp-moving-border-wrap { animation: none; } }

      .lp-logo-glow { display: inline-flex; transition: transform 0.25s ease; }
      .lp-logo-glow:hover { transform: scale(1.04); }
      @keyframes lpFadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      .lp-fadeinup { animation: lpFadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
      .lp-delay-1 { animation-delay: 0.1s; }
      .lp-delay-2 { animation-delay: 0.2s; }
      .lp-delay-3 { animation-delay: 0.3s; }

      /* Skroll-reveal — se useReveal()-hooken. Elementet startar dolt/
         förskjutet och animeras in mjukt första gången det blir synligt,
         istället för att allt bara redan finns där när sidan laddar. */
      .lp-reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
      .lp-reveal.lp-in { opacity: 1; transform: translateY(0); }
      .lp-reveal-scale { opacity: 0; transform: scale(0.94); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
      .lp-reveal-scale.lp-in { opacity: 1; transform: scale(1); }

      /* ── Mobilanpassning ── */
      .lp-nav-desktop { display: flex; }
      .lp-hamburger-btn { display: none; }
      .lp-mobile-menu { display: none; }
      .lp-cta-group { display: flex; gap: 12px; flex-wrap: wrap; }
      /* Kundfeedback: funktionskorten fick en tydligare hierarki — ett
         brett "flaggskepps"-kort (Bokföring, kärnan i produkten) ovanför
         tre jämnstora kort, istället för fyra identiska rutor i rad.
         .lp-bento-feature-full spänner alla kolumner oavsett hur många
         det är (grid-column: 1 / -1), så samma regel funkar i både
         desktop- och den enkolumns-mobila layouten nedan. */
      .lp-bento-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
      .lp-bento-feature-full { grid-column: 1 / -1; }

      /* Bolagsformer — oändligt rullande rad (Aceternitys "Infinite Moving
         Cards", här ren CSS: innehållet upprepat FYRA gånger (inte två)
         och translateX:at till -25%, vilket landar exakt på kopia 2 =
         sömlös loop utan hopp. Kundfeedback (skärmdump på en bred/
         ultrabred skärm): med bara två kopior av fem badgear var en
         ENDA kopias bredd smalare än själva raden på breda skärmar, så
         högra delen stod tom istället för att vara fylld hela vägen ut.
         Fyra kopior garanterar gott om marginal även på riktigt breda
         monitorer. Samma 28s-varaktighet som innan (en cykel = en kopias
         bredd = samma hastighet, oavsett hur många kopior som finns). */
      .lp-marquee { overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, black 6%, black 94%, transparent); mask-image: linear-gradient(90deg, transparent, black 6%, black 94%, transparent); }
      .lp-marquee-track { display: flex; gap: 12px; width: max-content; animation: lpMarqueeScroll 28s linear infinite; }
      /* Kundönskemål ("den ska inte stanna för musen, den ska fortsätta
         rulla") — pausar INTE längre på :hover. Behåller pausen på
         :focus-within (tangentbordsfokus) — det är den WCAG 2.2.2 faktiskt
         bryr sig om (en riktig paus-mekanism för den som navigerar med
         tangentbord/skärmläsare), inte muspekaren. */
      .lp-marquee:focus-within .lp-marquee-track { animation-play-state: paused; }
      @keyframes lpMarqueeScroll { from { transform: translateX(0); } to { transform: translateX(-25%); } }
      @media (prefers-reduced-motion: reduce) { .lp-marquee-track { animation: none; } }

      /* Kundönskemål ("denna på desktop") — badgearna växer en bit på
         desktopbredder (samma 1024px-brytpunkt som resten av navigationen
         nu använder, se kommentaren vid .lp-nav-desktop nedan), fortfarande
         samma kompakta piller på mobil/halvbrett. */
      @media (min-width: 1025px) {
        .lp-marquee-badge { padding: 11px 22px 11px 11px !important; gap: 12px !important; }
        .lp-marquee-badge-icon { width: 34px !important; height: 34px !important; }
        .lp-marquee-badge-icon svg { width: 17px !important; height: 17px !important; }
        .lp-marquee-badge-label { font-size: 16px !important; }
      }

      /* Varumärkesblocket + FYRA länkkolumner (FOOTER_COLUMNS nedan).
         Kundfeedback: kolumnerna stod för glest isär. Länktexterna är
         korta (ett till två ord), så fyra lika breda 1fr-kolumner över
         hela sidbredden gav en tom remsa efter varje länk. Kolumnerna tar
         nu sin EGNA bredd (max-content) och fördelas jämnt med
         space-between i stället — texten står tätt, mellanrummet hamnar
         mellan kolumnerna där det hör hemma. minmax(0, max-content) håller
         kvar skyddet mot att en ovanligt lång etikett trycker ut raden. */
      .lp-footer-grid { display: grid; grid-template-columns: repeat(5, minmax(0, max-content)); gap: 32px 40px; justify-content: space-between; }
      .lp-footer-legal { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; }
      .lp-footer-grid > *, .lp-bento-grid > * { min-width: 0; }

      /* Vanliga frågor: två spalter först när det finns plats. Under
         1100px är det en läslista som förut — en accordion i två smala
         spalter är sämre än en i en bred. */
      .lp-faq-grid { display: grid; grid-template-columns: 1fr; gap: 0 32px; align-items: start; }
      @media (min-width: 1100px) { .lp-faq-grid { grid-template-columns: 1fr 1fr; } }
      .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px 28px; }

      /* Kolumnrubrikerna: versaler, spärrad, dämpad — de ska LÄSAS som
         etiketter över sina länkar, inte konkurrera med dem. Länkarna är
         det man faktiskt klickar på och får därför vara ljusast. */
      .lp-footer-heading { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.42); margin: 0 0 14px; }

      /* Det stora ordmärket längst ner. Ligger som en dämpad vattenstämpel
         i sidfotens egen gradient (avmättad + uppljusad till elfenben, se
         MarketingFooter) — inte ett andra, skrikande varumärkesblock
         ovanpå det lilla högst upp i sidfoten. Klippt på höjden mot
         underkanten så det känns som en yta man ser en bit av, inte en
         logotyp som råkat bli för stor. */
      .lp-footer-mark { max-width: 1120px; margin: 8px auto 20px; position: relative; line-height: 0; }
      .lp-footer-mark svg { display: block; width: 100%; height: auto; }

      /* Kundfeedback (skärmdump, halvbred skrivbordsyta/tablet, ~640-1024px):
         den fulla desktop-navraden (logo + fyra länkar + tema-knapp +
         "Logga in" + "Kom igång", alla med sina fasta 32px/12px-mellanrum)
         hade inte plats att andas i det här spannet — kändes hopklämd
         jämfört med både riktig fullskärm (gott om plats) och mobil (egen,
         glesare hamburgermeny). Brytpunkten höjd 860px → 1024px så samma
         spann som redan gör bento-gridet ovan tightare (.lp-bento-grid,
         "min-width: 641px och max-width: 1024px") går över till
         hamburgermenyn ISTÄLLET FÖR att pressa ihop den fulla navraden —
         ingen ny cramped mellanzon kvar, bara "gott om plats" eller
         "hamburgermeny", aldrig något hopklämt däremellan. Fullskärm och
         ren mobil (redan bra, enligt kunden) helt oförändrade. */
      @media (max-width: 1024px) {
        .lp-nav-desktop { display: none; }
        .lp-hamburger-btn { display: flex; }
        /* Loggan (46px, uppskalad för desktop ovan) håller sig kvar på sin
           tidigare, mer kompakta mobilstorlek istället för att svälla i
           den smala mobil-headern tillsammans med hamburgerknappen. */
        nav .lp-logo-glow svg { height: 34px; width: auto; }
      }
      /* ── DEMO-OVERLAY (kundönskemål: produktvisningen ska INTE ligga
         inline i sidflödet längre, bara visas som en egen, fristående yta
         när man trycker "Se demo") — en riktig lightbox, inte ett
         skrollankare. Bakgrund + panel som två separata lager (samma
         "positionerad bakgrund målas före positionerat innehåll i DOM-
         ordning"-mönster som resten av filen) så panelen alltid hamnar
         ovanpå. Egna in-animationer (fade på bakgrunden, skala+lyft på
         panelen) — en enda orkestrerad öppning, ingen löpande animation
         efteråt. Se DemoOverlay i LandingPage.jsx. */
      .lp-demo-overlay { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 28px; }
      .lp-demo-overlay-backdrop { position: absolute; inset: 0; background: rgba(9,20,14,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: lpFadeIn 0.22s ease both; }
      .lp-demo-overlay-panel { position: relative; width: min(1440px, 100%); max-height: min(880px, 92vh); display: flex; flex-direction: column; background: var(--mkt-ivory); border: 1px solid var(--mkt-card-border); border-radius: 20px; overflow: hidden; box-shadow: 0 50px 110px -24px rgba(0,0,0,0.55); animation: lpDemoIn 0.32s cubic-bezier(0.16,1,0.3,1) both; }
      .lp-demo-overlay-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 18px; background: var(--mkt-card-bg); border-bottom: 1px solid var(--mkt-border-soft); flex-shrink: 0; }
      .lp-demo-overlay-close { width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--mkt-border-soft); background: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--mkt-nav-text); flex-shrink: 0; transition: background 0.15s ease; }
      .lp-demo-overlay-close:hover { background: var(--mkt-ivory); }
      .lp-demo-overlay-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 20px; }
      @keyframes lpFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes lpDemoIn { from { opacity: 0; transform: scale(0.96) translateY(14px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .lp-demo-overlay-backdrop, .lp-demo-overlay-panel { animation: none; } }
      @media (max-width: 640px) {
        .lp-demo-overlay { padding: 0; }
        .lp-demo-overlay-panel { max-height: 100vh; height: 100%; border-radius: 0; border: none; }
        .lp-demo-overlay-body { padding: 12px; }
      }

      /* .lp-demo-card: yttre kortet, alltid en kolumn nu — en riktig
         skrivbords-header (ikoner, se DemoWorkspace.jsx) ovanpå, .lp-demo-body
         (sidomeny+innehåll) därunder. .lp-demo-body bär den gamla rad/kolumn-
         växlingen som .lp-demo-card hade själv innan headern fanns. */
      .lp-demo-card { display: flex; flex-direction: column; }
      .lp-demo-body { display: flex; flex: 1; min-height: 0; }
      .lp-demo-mobile-topbar { display: none; }
      /* Skrivbordet: fast höjd + egen scroll så kortet inte skuttar runt i
         storlek när man byter flik. Se mobilöverskriften nedan för varför
         det INTE gäller på mobil.
         Bugkritiskt (kundfeedback, med skärmdump): utan egen bakgrund ärvde
         den här ytan bg-card från .lp-demo-card (samma ton som topbaren
         ovanför) — MÖRKARE bg-sidebar bredvid och LJUSARE bg-card här
         skapade en tydlig, hela-höjden-lång fog nedför hela gränsen mot
         sidomenyn, precis den "space" som cirklades in i skärmdumpen.
         Riktiga appen har INTE det problemet: där ligger bara den 52px
         höga .desktop-top-bar-remsan på bg-card, medan själva
         innehållsytan (.main-content-inner) visar body-elementets bg-page
         rakt igenom (ingen egen bakgrund satt där heller) — bg-page och
         bg-sidebar ligger mycket närmare varandra i mörkt läge, så fogen
         syns knappt. Samma bg-page här återskapar exakt det. */
      /* Ingen padding kvar (samma "ingen space överallt"-regel som
         .main-content-inner i index.css, den riktiga appens motsvarande
         skal) — demot ska visa exakt samma kant-till-kant-yta som en
         inloggad användare faktiskt ser, inte en bredare (för smickrande)
         attrapp med egen marginal skalet aldrig har på riktigt. */
      .lp-demo-content { flex: 1; min-width: 0; max-height: min(780px, 82vh); overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background: var(--bg-page); }
      @media (max-width: 640px) {
        .lp-cta-group { flex-direction: column; }
        .lp-cta-group > button, .lp-cta-group > a, .lp-cta-group > .lp-moving-border-wrap { width: 100%; }
        .lp-cta-group > .lp-moving-border-wrap > button { width: 100%; }
        .lp-bento-grid { grid-template-columns: 1fr; }
        .lp-hide-mobile { display: none !important; }
        /* Produktvisningens demo-kort — istället för att bara försvinna på
           mobil (ingen meny alls) visas samma mobila topbar-mönster som
           riktiga appen faktiskt använder på små skärmar (hamburgerikon +
           sidtitel, se .global-top-bar/.topbar-page-title i index.css),
           så demon ger en ärlig bild av hur Bokix ser ut på mobilen också. */
        .lp-demo-body { flex-direction: column; }
        .lp-demo-mobile-topbar { display: flex; }
        /* Bugkritiskt: en fast maxHeight + intern scroll (bra på ett brett
           skrivbordskort) blev på mobil en liten kikhål-ruta som gömde det
           mesta av innehållet bakom en trög nästlad scroll — exakt det som
           gjorde demon kännas "trasig, ser knappt något". På mobil får
           kortet istället växa naturligt och HELA sidan skrollar, som
           vilken annan sektion på landningssidan som helst. Horisontellt
           overflow blir skrollbart (inte dolt) som en säkerhetsventil om
           någon inbäddad komponent ändå råkar bli bredare än skärmen. */
        .lp-demo-content { max-height: none; overflow-y: visible; overflow-x: auto; }
      }
      /* Kundfeedback (skärmdump, halvbred skrivbordsyta/tablet): 2-kolumns-
         brytpunkten nedan lämnade det tredje jämnstora kortet ("Personal")
         ensamt i en egen rad, vänsterjusterat med tom yta bredvid — bara
         full skärm (3 kolumner, allt fyller ut) och mobil (1 kolumn, allt
         staplat) var redan bra, halvbrett var det enda glappet. Sista
         kortet spänner nu båda kolumnerna i just DEN HÄR brytpunkten
         (samma grid-column-teknik som .lp-bento-feature-full ovan redan
         använder för flaggskeppskortet), så det fyller ut raden istället
         för att lämna tomrum. */
      @media (min-width: 641px) and (max-width: 1024px) {
        .lp-bento-grid { grid-template-columns: repeat(2, 1fr); }
        .lp-bento-grid > *:last-child { grid-column: 1 / -1; }
      }
      /* Sidfotens egna brytpunkter. Halvbred skrivbordsyta: fyra kolumner
         på en rad (fem gav 3 + 2 med ett tomrum bredvid den sista), med
         varumärkesblocket på en egen rad ovanför så fort det inte ryms
         bredvid. Här får kolumnerna tillbaka lika bredd (1fr) — utrymmet
         är begränsat, då ska de fylla ut raden, inte klumpa ihop sig till
         vänster. */
      @media (max-width: 1080px) {
        .lp-footer-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 30px 20px; }
        .lp-footer-brand { grid-column: 1 / -1; }
      }
      /* Mobil: två jämna kolumner (2 + 2, aldrig en halvtom rad), tätare
         radavstånd och en centrerad bottenrad. Varumärkesblocket får en
         tunn avskiljare under sig i stället för mer luft — det som
         tidigare kändes rörigt var att logga, löfte, adress och rubriker
         låg i en enda oavbruten spalt utan någon synlig gruppering. */
      @media (max-width: 720px) {
        .lp-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px 16px; }
        .lp-footer-brand { padding-bottom: 22px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .lp-footer-bottom { flex-direction: column; text-align: center; gap: 12px; }
        .lp-footer-legal { justify-content: center; gap: 8px 14px; }
      }
      @media (max-width: 400px) {
        .lp-footer-grid { gap: 24px 12px; }
      }
      .lp-mobile-menu.lp-open {
        display: flex; position: fixed; inset: 0; background: white; z-index: 2000;
        flex-direction: column; padding: 20px 24px 32px;
      }
    `}</style>
  );
}

/** Skroll-reveal-hook — IntersectionObserver som lägger till "lp-in" på
 * elementet första gången det blir synligt i viewporten (bara en gång,
 * avslutar bevakningen direkt efteråt istället för att trigga om och om). */
export function useReveal() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, inView];
}

/** Wrapper-komponent för det vanliga fallet — döljer boilerplaten ovan för
 * varje sektion som bara vill fadas/glida in vid skroll. */
export function Reveal({ as: Tag = 'div', scale = false, delay = 0, style, className = '', children, ...rest }) {
  const [ref, inView] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`${scale ? 'lp-reveal-scale' : 'lp-reveal'} ${inView ? 'lp-in' : ''} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms', ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Som Reveal (scale), men för TUNGA React.lazy()-komponenter (t.ex.
 * DemoWorkspace) — mountar barnen först när sektionen faktiskt är på väg
 * in i vy, inte bara vid mount. Lighthouse (Prestanda-granskningen):
 * `lazy()` delar bara upp KODEN i en egen bunt, det avgör INTE när den
 * hämtas — en <Suspense><DemoWorkspace/></Suspense> som renderas
 * ovillkorligt (vilket LandingPage.jsx/PricingPage.jsx gjorde, bara
 * visuellt längre ner på sidan) triggar importen direkt vid mount ändå,
 * så en besökare som ALDRIG scrollar dit laddade den ~235 KB tunga
 * bunten (jspdf/html2canvas/BarChart/orgType, PDF-export- och
 * diagramberoenden DemoWorkspace drar in) helt i onödan. `{inView &&
 * children}` löser det: JSX-uttrycket <DemoWorkspace/> hos anroparen
 * SKAPAR bara ett element-objekt (billigt, ingen import) — det är först
 * när React faktiskt FÖRSÖKER RENDERA det (reconciliation) som lazy()
 * triggar sin dynamiska import, och så länge inView är false inkluderas
 * elementet aldrig i det som returneras här, så det når aldrig dit. */
export function RevealLazy({ children, fallbackMinHeight = 480, style, ...rest }) {
  const [ref, inView] = useReveal();
  return (
    <div ref={ref} className={`lp-reveal-scale ${inView ? 'lp-in' : ''}`} style={{ position: 'relative', ...style }} {...rest}>
      <Suspense fallback={<div style={{ minHeight: `${fallbackMinHeight}px` }} />}>
        {inView && children}
      </Suspense>
    </div>
  );
}

/** Header/nav, delad av alla marknadssidor. Loggan går alltid till "/".
 * Nav-punkterna går till sina egna sidor (sitemap) — aldrig ett skroll-
 * ankare på samma sida. `onEnterApp`: skickas bara in av startsidan (som
 * redan har den lokala showLanding-toggeln); undersidor har den inte och
 * navigerar istället till "/" med en state-flagga som App.jsx läser av för
 * att hoppa direkt till inloggning — se MarketingLayout-kommentaren nedan. */
export function MarketingHeader({ onEnterApp, theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    handler();
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // mode: 'login' | 'signup' — vilken Auth-flik som ska visas när man
  // landar där (kundönskemål: "Skapa konto gratis" ska INTE gå till
  // inloggning). "Logga in" och "Kom igång" delade tidigare samma
  // parameterlösa handler, så båda alltid öppnade samma (hårdkodade
  // login-)flik oavsett vilken knapp man klickade.
  const handleEnterApp = (mode) => {
    setMobileMenuOpen(false);
    if (onEnterApp) onEnterApp(mode);
    else navigate('/', { state: { enterApp: true, authMode: mode } });
  };

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        // Kundfeedback: loggan/knapparna gick knappt att se ovanpå Heros
        // molnbakgrund (CloudShaderBackground) i ljust läge, riktigt mörkt
        // läge var okej men fortfarande på marginalen. En helt genomskinlig
        // nav (tidigare) litade på att BAKGRUNDEN alltid var mörk/ljus nog
        // — funkar mot en stillastående ivory-yta, inte mot en levande
        // himmel. Ett dämpat frostat glas (halvgenomskinlig
        // header-bg-ton + blur) istället för helt transparent innan man
        // skrollar: garanterad kontrast mot VILKEN bakgrund som helst
        // (moln, blobbar, framtida bilder), utan att gissa scenens färg.
        background: scrolled ? 'var(--mkt-header-bg)' : 'color-mix(in srgb, var(--mkt-header-bg) 55%, transparent)',
        backdropFilter: scrolled ? undefined : 'blur(14px)',
        WebkitBackdropFilter: scrolled ? undefined : 'blur(14px)',
        borderBottom: scrolled ? '1px solid var(--mkt-border-soft)' : 'none',
        padding: '0 24px', transition: 'all 0.3s',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.06)' : 'none',
      }}>
        {/* ── Tunn flerfärgad linje under navraden — samma grönt/blått/rött-
            triad som nyckeltalskorten (marketingTokens.js ACCENT), så
            färgerna syns redan i headern, inte bara längre ner. ── */}
        <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '2px', opacity: 0.55, background: `linear-gradient(90deg, ${ACCENT_CYCLE[0].fg}, ${ACCENT_CYCLE[1].fg} 45%, ${ACCENT_CYCLE[2].fg} 75%, ${BRAND.green})` }} />
        {/* Kundfeedback (skärmdump på en bred skärm): max-width:1200px
            centrerat lämnade stora tomma mörka fält på var sida på breda
            skrivbordsskärmar — loggan såg inte ut att sitta till vänster
            alls, bara mitt i en ö av innehåll mitt på skärmen. Ingen
            maxWidth/margin:auto längre — raden fyller hela bredden (samma
            24px sidopadding som <nav> redan hade), så loggan/knapparna
            landar på de FAKTISKA kanterna oavsett skärmbredd. Navlänkarna
            (justifyContent:center) håller sig ändå kompakta i mitten,
            sträcks inte ut bara för att raden är bredare. */}
        <div style={{ display: 'flex', alignItems: 'center', height: '84px', gap: '32px' }}>
          {/* Kundönskemål: loggan ska alltid ta dig till Hero-sektionen —
              <Link to="/"> ensam är ett no-op om man redan står på
              startsidan (samma bugg som Auth.jsx:s logga hade, se
              kommentaren där), t.ex. efter att ha scrollat ner till FAQ
              eller priser. scrollTo körs alltid vid klick: no-op-fallet
              scrollar upp till Hero, och när en faktisk sidnavigering sker
              (från en annan sida) är den ändå ofarlig — den nya sidan
              monteras redan scrollad högst upp. */}
          <Link to="/" className="lp-logo-glow" style={{ alignItems: 'center', flexShrink: 0 }} aria-label="Till startsidan" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <BokixWordmark height={58} />
          </Link>

          <div className="lp-nav-desktop" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: '32px' }}>
            {MARKETING_PAGES.map((page, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              const isActive = location.pathname === page.to;
              return (
                <Link
                  key={page.to} to={page.to}
                  className={`lp-nav-link ${isActive ? 'active' : ''}`}
                  style={{ '--nav-accent': accent.fg, fontSize: '17px', fontWeight: 500, color: isActive ? accent.fg : 'var(--mkt-nav-text)', textDecoration: 'none', padding: '10px 0', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}
                >
                  {page.label}
                </Link>
              );
            })}
          </div>

          <div className="lp-nav-desktop" style={{ gap: '12px', alignItems: 'center' }}>
            <button onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, background: 'none', border: '1px solid var(--mkt-border-soft)', borderRadius: '10px', cursor: 'pointer', color: 'var(--mkt-nav-text)', flexShrink: 0 }}>
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button className="lp-btn-secondary" onClick={() => handleEnterApp('login')} style={{ padding: '14px 22px', background: 'transparent', border: '1px solid var(--mkt-border-soft)', borderRadius: '10px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', color: 'var(--mkt-nav-text)', fontFamily: 'inherit', minHeight: '48px' }}>
              Logga in
            </button>
            <button className="lp-btn-primary" onClick={() => handleEnterApp('signup')} style={{ padding: '14px 24px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 4px 15px -3px rgba(11,99,41,0.35)', minHeight: '48px' }}>
              Kom igång
            </button>
          </div>

          <button onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} className="lp-hamburger-btn" style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, marginLeft: 'auto', color: 'var(--mkt-nav-text)' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="lp-hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Öppna meny" style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, color: 'var(--mkt-nav-text)' }}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      <div className={`lp-mobile-menu ${mobileMenuOpen ? 'lp-open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <Link to="/" onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="lp-logo-glow" aria-label="Till startsidan"><BokixWordmark height={32} /></Link>
          <button onClick={() => setMobileMenuOpen(false)} aria-label="Stäng meny" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mkt-nav-text)' }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {MARKETING_PAGES.map((page, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            const isActive = location.pathname === page.to;
            return (
              <Link
                key={page.to} to={page.to} onClick={() => setMobileMenuOpen(false)}
                style={{ background: 'none', border: 'none', borderBottom: '1px solid var(--mkt-border-soft)', textAlign: 'left', fontSize: '17px', fontWeight: 600, color: isActive ? accent.fg : 'var(--mkt-heading)', textDecoration: 'none', fontFamily: 'inherit', padding: '16px 4px' }}
              >
                {page.label}
              </Link>
            );
          })}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '24px' }}>
          <button onClick={() => handleEnterApp('login')} style={{ padding: '14px', background: 'transparent', border: '1px solid var(--mkt-border-soft)', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: 'var(--mkt-nav-text)', fontFamily: 'inherit' }}>
            Logga in
          </button>
          <button onClick={() => handleEnterApp('signup')} style={{ padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>
            Kom igång
          </button>
        </div>
      </div>
    </>
  );
}

// Fyra länkkolumner, inte fem. Juridik-länkarna (integritet, villkor,
// cookies, PUB) ligger i bottenraden tillsammans med copyrighten och
// cookieinställningarna — det är det man letar efter när man redan
// skrollat längst ner, inte något man ska välja MELLAN produktsidor och
// verktyg. Fyra kolumner går dessutom jämnt ut i både två (mobil) och
// fyra (halv och full skärm), vilket fem aldrig gjorde: femte kolumnen
// hamnade ensam på en egen rad med tomrum bredvid sig.
//
// Verktygslistan byggs ur TOOLS (tools/toolsConfig.js), aldrig ur en egen
// kopia här: ett nytt verktyg dyker upp i sidfoten av sig självt.
// `footerLabel` (kortformen) används i stället för `title` eftersom
// kolumnerna är smala, särskilt på mobil.
const FOOTER_COLUMNS = [
  {
    heading: 'Produkt',
    links: [
      { label: 'Funktioner', to: '/funktioner' },
      { label: 'Priser', to: '/priser' },
      { label: 'Integrationer', to: '/integrationer' },
      { label: 'Koppla banken', to: '/koppla-bank' },
      { label: 'Säkerhet', to: '/sakerhet' },
    ],
  },
  {
    heading: 'Gratis verktyg',
    links: [
      ...TOOLS.map(t => ({ label: t.footerLabel || t.title, to: t.path })),
      { label: 'Alla verktyg', to: TOOLS_HUB_PATH },
    ],
  },
  {
    heading: 'Lär dig',
    links: [
      { label: 'Blogg', to: '/blogg' },
      { label: 'Bokföringsordlista', to: '/ordlista' },
      { label: 'Byt till Bokix', to: '/byt-bokforingsprogram' },
      { label: 'För UF-företag', to: '/uf' },
    ],
  },
  {
    heading: 'Företag',
    links: [
      { label: 'Om oss', to: '/om-oss' },
      { label: 'Kontakt', to: '/kontakt' },
    ],
  },
];

// Juridiken bor i bottenraden (se kommentaren ovan). Cookieinställningar är
// INTE med i den här listan — den är en knapp, inte en länk, och renderas
// separat sist i samma rad.
// Exporterad: PolicyLayout.jsx hade en egen, identisk kopia av samma fyra
// länkar för raden längst ner på policysidorna. Två listor över juridiken
// glider isär i samma sekund en femte policy tillkommer — nu finns den på
// ETT ställe, och sidfoten och policysidorna kan inte visa olika saker.
export const FOOTER_LEGAL = [
  { label: 'Integritetspolicy', to: '/privacy' },
  { label: 'Användarvillkor', to: '/terms' },
  { label: 'Cookiepolicy', to: '/cookies' },
  { label: 'PUB-avtal', to: '/pub' },
];

const footerLinkStyle = { fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s', lineHeight: 1.4 };
const footerLegalStyle = { ...footerLinkStyle, fontSize: '12.5px' };

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: '#0e2018', padding: '52px 24px 26px', color: 'rgba(255,255,255,0.6)', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundImage: 'linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16)' }} />
      <div aria-hidden className="lp-blob lp-blob-slower" style={{ position: 'absolute', bottom: '-200px', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)', opacity: 0.06, filter: 'blur(100px)', pointerEvents: 'none' }} />

      {/* Varumärkesblocket är tre rader totalt — logga, löfte,
          supportadress — och inget mer. Allt utöver det (produkt-
          beskrivning, "byggt i Sverige"-rad) hör hemma på sidorna det
          handlar om, inte i sidfoten.
          OMVÄND KUNDÖNSKAN: här stod tidigare "inget stort ordmärke längst
          ner" (ett uttryckligt önskemål då). Kunden har sedan bett om
          motsatsen, med en referenssidfot som förebild — det stora
          ordmärket finns därför längre ner igen, men som dämpad
          vattenstämpel, inte som ett andra varumärkesblock. Noterat här
          så ingen "återställer" det till det gamla önskemålet. */}
      <div className="lp-footer-grid" style={{ maxWidth: '1120px', margin: '0 auto', marginBottom: '34px', position: 'relative' }}>
        <div className="lp-footer-brand">
          <Link to="/" className="lp-logo-glow" aria-label="Till startsidan" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} style={{ display: 'inline-block', marginBottom: '14px' }}>
            <BokixWordmark height={32} />
          </Link>
          <p style={{ fontFamily: SERIF, fontSize: '18px', lineHeight: 1.35, color: 'white', margin: '0 0 14px', letterSpacing: '-0.01em' }}>
            Bokföring utan gissningar.
          </p>
          {/* Supportadressen direkt i sidfoten, inte bara bakom /kontakt —
              den vanligaste anledningen att skrolla hit är att man vill nå
              en människa, och ett extra klick dit hjälper ingen. */}
          <a href="mailto:support@bokix.se" className="lp-footer-link" style={{ ...footerLinkStyle, display: 'inline-block', fontWeight: 600, color: 'rgba(255,255,255,0.72)' }}>
            support@bokix.se
          </a>
        </div>

        {/* Sidans sista rubrik före footern är alltid en <h2>
            (CTA-sektionen) — footerns kolumnrubriker är <h3>, samma
            nivå sidans övriga <h2>-till-<h3>-underrubriker redan använder. */}
        {FOOTER_COLUMNS.map(column => (
          <div key={column.heading}>
            <h3 className="lp-footer-heading">{column.heading}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {column.links.map(link => (
                <Link key={link.to} to={link.to} className="lp-footer-link" style={footerLinkStyle}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Ordmärket som vattenstämpel (se .lp-footer-mark). Ordmärket är en
          gradient-SVG (blå→turkos→lime) och blir grumligt om man bara
          sänker opaciteten mot den mörkgröna bottnen — avmättat och
          uppljusat blir det i stället elfenben, samma ton som resten av
          sidfotens text. aria-hidden: ren dekor, "Bokix" står redan i
          varumärkesblocket ovanför. */}
      <div className="lp-footer-mark" aria-hidden>
        <BokixWordmark height="auto" style={{ width: '100%', height: 'auto', filter: 'saturate(0) brightness(2.4)', opacity: 0.13 }} />
      </div>

      <div className="lp-footer-bottom" style={{ maxWidth: '1120px', margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px', position: 'relative' }}>
        {/* 0.55 opacity ≈ 5.9:1 against #0e2018 — meets WCAG AA. */}
        <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.55)' }}>
          © {year} Bokix. Alla rättigheter förbehållna.
          {' · '}
          {/* Den enda "handlingen" i bottenraden: en riktig, bokningsbar tid
              (/boka-genomgang). Längden är sidans egen uppgift (20–30
              minuter), inte en påhittad siffra. */}
          <Link to="/boka-genomgang" className="lp-footer-link" style={{ ...footerLegalStyle, display: 'inline' }}>
            Boka en genomgång · 20–30 min
          </Link>
        </div>
        <div className="lp-footer-legal">
          {FOOTER_LEGAL.map(link => (
            <Link key={link.to} to={link.to} className="lp-footer-link" style={footerLegalStyle}>
              {link.label}
            </Link>
          ))}
          {/* Öppnar CookieBanner.jsx igen (monterad globalt i AppRouter.jsx)
              via ett DOM-event — enda vägen att dela state utan en gemensam
              komponentförälder. Ligger sist bland juridiklänkarna här nere
              (kundönskemål) i stället för i en egen kolumn ovanför: det är
              en inställning man söker upp när man behöver den, inte något
              att bli erbjuden mitt i navigeringen. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event('bokix-open-cookie-prefs'))}
            className="lp-footer-link"
            style={{ ...footerLegalStyle, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cookieinställningar
          </button>
        </div>
      </div>
    </footer>
  );
}

/** Ramen alla marknadssidor renderas i — header, delade stilar/animationer,
 * innehåll, footer. `onEnterApp` skickas bara med från startsidan (App.jsx
 * äger den lokala showLanding-togglen där); undersidor lämnar den odefinierad
 * och headern navigerar då till "/" med `state:{enterApp:true}` istället —
 * App.jsx:s rot-route läser av den flaggan och hoppar direkt till
 * inloggningsskärmen så "Kom igång"/"Logga in" känns likadant oavsett
 * vilken sida man klickade från. */
export default function MarketingLayout({ onEnterApp, children }) {
  const [theme, toggleTheme] = useMarketingTheme();
  return (
    <div id="lp-root" data-theme={theme} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: 'var(--mkt-heading)', background: 'var(--mkt-page-bg)', overflowX: 'hidden' }}>
      <JsonLd data={ORGANIZATION_SCHEMA} />
      <MarketingStyles />
      <MarketingHeader onEnterApp={onEnterApp} theme={theme} onToggleTheme={toggleTheme} />
      {children}
      <MarketingFooter />
    </div>
  );
}
