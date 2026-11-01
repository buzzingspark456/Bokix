import React, { useState, useEffect, useRef, Suspense, useLayoutEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon, ChevronDown, ArrowRight } from '../icons';
import { BRAND } from '../../utils/brandColors';
import { SERIF } from './marketingTokens';
import { JsonLd, SITE_URL } from '../../utils/seo';
// Ordmärket flyttat till shared/ (delas nu även av App.jsx BokixLogo, se
// dess egen kommentar för varför). Importerad OCH återexporterad under
// samma namn här — importen ger den här filens EGNA <BokixWordmark>-bruk
// (headern/footern/mobilmenyn nedan) en lokal bindning, återexporten låter
// de sex ställen som redan gör `import { BokixWordmark } from
// './marketing/MarketingLayout'` fortsätta oförändrade.
import { TOOLS, TOOLS_HUB_PATH, TOOL_GROUPS } from './tools/toolsConfig';
import BokixWordmark from '../shared/BokixWordmark';
import { BOKIX_SUMMARY, BOKIX_PROFILES } from '../../content/marketing/bokixFacts';
import { ORG_TYPE_PAGES } from '../../content/marketing/orgTypes';
export { BokixWordmark };

// Organization-schema (schema.org) — samma på VARJE marknadssida (den här
// layouten wrappar alla fem, se botten av filen) eftersom en organisations
// identitet inte är sid-specifik. Ger Google/Bing ett tydligt, strukturerat
// "det här företaget heter Bokix, finns på den här domänen, nås på den här
// mejladressen" istället för att behöva gissa det ur brödtexten — samma sak
// AI-svarsmotorer (Claude/ChatGPT/Perplexity) hellre citerar än fritext.
// Bara verifierbara fält (namn, url, kontakt-mejl som redan står på
// /kontakt) — inga påhittade adresser/organisationsnummer/betyg.
// Samma @id på varje sida (och i startsidans schema), så att sökmotorer och
// AI-tjänster förstår att det är ett och samma företag överallt.
const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Bokix',
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.png`,
  slogan: 'Bokföring utan gissningar.',
  sameAs: BOKIX_PROFILES,
  description: BOKIX_SUMMARY,
  areaServed: { '@type': 'Country', name: 'Sverige' },
  knowsAbout: ['Bokföring', 'Fakturering', 'Moms', 'Momsdeklaration', 'Lön', 'Bokslut', 'Årsredovisning', 'Enskild firma', 'Aktiebolag', 'BAS-kontoplanen', 'SIE4'],
  email: 'bokixab@gmail.com',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'bokixab@gmail.com',
    contactType: 'customer support',
    areaServed: 'SE',
    availableLanguage: ['sv'],
  },
};

const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  url: SITE_URL,
  name: 'Bokix',
  inLanguage: 'sv-SE',
  publisher: { '@id': `${SITE_URL}/#organization` },
};

// Kundönskemål: en mörkt-läge-option på marknadssidan. Samma localStorage-
// nyckel som den inloggade appen (App.jsx: 'bokix_theme_pref', med den
// gamla 'bokix_theme' kvar som läs-fallback för en besökare som bara någonsin
// satt den förra nyckeln) — en besökare som redan valt mörkt läge där ska
// mötas av samma tema på den publika sajten också, istället för att behöva
// välja två gånger. Egen liten läsfunktion här (inte en delad hook mot
// App.jsx) eftersom marknadssidan är en helt fristående yta utan tillgång
// till App.jsx:s theme-state — men EXPORTERAD så DemoWorkspace.jsx kan
// anropa den en gång till för sitt eget `theme === 'dark'`-villkor
// (headerns bakgrund ska bara matcha sidomenyn i mörkt läge, se index.css
// :root[data-theme="dark"] .desktop-top-bar). Ofarligt att anropa två
// gånger — båda instanserna läser/skriver samma localStorage-nyckel och
// samma <html data-theme>, aldrig i otakt.
//
// INGEN OS-preferens som förval för en helt ny besökare (stod här tidigare,
// var bakgrunden till en blinkningsbugg): theme-init.js (körs INNAN
// webbläsaren målar något alls) och App.jsx:s egen useState-initierare
// defaultar båda till 'dark', oavsett OS-inställning — se motiveringen vid
// App.jsx:s themePreference. Den här hooken körde tidigare
// `prefers-color-scheme`-koll i stället för en ny besökare, vilket gjorde
// att en besökare med ljust OS-tema möttes av en <html> som theme-init.js
// redan hunnit sätta till 'dark' (innan målning), som sedan bytte till
// 'light' först efter att React hydrerat och den här useEffect:en hunnit
// köra — exakt den rapporterade "mörkt, sen ljust"-blinkningen. Måste
// defaulta till EXAKT samma värde som theme-init.js för en ny besökare,
// annars finns blinkningen kvar oavsett vilket håll den går.
function storedMarketingTheme() {
  try {
    const stored = localStorage.getItem('bokix_theme_pref') || localStorage.getItem('bokix_theme');
    if (stored === 'light' || stored === 'dark') return stored;
    if (stored === 'system') {
      return (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    }
  } catch { /* privat läge/blockerad storage — kör vidare med standardvalet */ }
  return 'dark';
}

export function useMarketingTheme() {
  // Startar på 'dark', samma som den förrenderade sidan, och byter till det
  // sparade valet innan något hunnit målas (useLayoutEffect). Startsidan
  // hydreras (main.jsx), och React rättar inte ett attribut som skiljer sig
  // vid hydrering: med det sparade valet direkt hade en besökare som valt
  // ljust fått startsidan mörk.
  const [theme, setTheme] = useState('dark');
  useLayoutEffect(() => {
    const stored = storedMarketingTheme();
    if (stored !== 'dark') setTheme(stored);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('bokix_theme_pref', theme);
      localStorage.removeItem('bokix_theme'); // samma migrering som App.jsx redan gör
    } catch { /* samma reservläge som ovan */ }
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

// Headerns nav — bara de tre sidorna en besökare faktiskt jämför INNAN de
// bestämmer sig (vad det gör, vad det kostar, vilka verktyg som är gratis).
// Om oss/Kontakt är inte beslutsstadiet, de är efterslag — de bor i
// sidfoten (FOOTER_COLUMNS nedan, "Företag"), inte här. Kundfeedback: fem
// länkar plus två knappar läste som en lista, inte som en huvudmeny —
// tre är vad en riktig SaaS-header faktiskt visar.
export const MARKETING_PAGES = [
  { label: 'Funktioner', to: '/funktioner' },
  { label: 'Priser', to: '/priser' },
  { label: 'Verktyg', to: '/verktyg' },
];

// Ren textmeny utan ikoner (kundönskemål, Apple-likt): varje rad är en
// titel plus en kort rad om vad sidan ger. Verktygens rad hämtas ur
// toolsConfig (`short`) så menyn och sidfoten aldrig säger olika saker.
const toolItem = (slug, title) => {
  const tool = TOOLS.find(t => t.slug === slug);
  return { title: title || tool.footerLabel, desc: tool.short, to: tool.path };
};

export const NAV_MENUS = [
  {
    key: 'features',
    label: 'Funktioner',
    to: '/funktioner',
    dropdownWidth: 580,
    sections: [
      {
        title: 'Produkten',
        items: [
          { title: 'Bokföring & fakturering', desc: 'Kvitton, fakturor, moms och bokslut', to: '/funktioner' },
          { title: 'Faktureringsprogram', desc: 'Egen logga, kortbetalning, ROT och RUT', to: '/faktureringsprogram' },
          { title: 'Lön & arbetsgivare', desc: 'Lönebesked, skatteavdrag och AGI-fil', to: '/lon' },
          { title: 'Lager & artiklar', desc: 'Lagervärde, FIFO och marginal', to: '/bokforingsprogram-med-lager' },
          { title: 'Koppla banken', desc: 'Läs in kontoutdraget från din bank', to: '/koppla-bank' },
          { title: 'Integrationer', desc: 'Stripe, Zettle och filformat', to: '/integrationer' },
        ],
      },
      {
        title: 'Kom igång',
        items: [
          { title: 'Nystartat företag', desc: 'Bokför rätt från dag ett', to: '/bokforingsprogram-nystartat-foretag' },
          { title: 'Byt till Bokix', desc: 'Flytta bokföringen med en SIE4-fil', to: '/byt-bokforingsprogram' },
          { title: 'Säkerhet', desc: 'Så skyddas din bokföring', to: '/sakerhet' },
        ],
      },
    ],
    footer: { label: 'Se alla funktioner', to: '/funktioner' },
  },
  {
    key: 'tools',
    label: 'Verktyg',
    to: TOOLS_HUB_PATH,
    dropdownWidth: 780,
    sections: TOOL_GROUPS.map(g => ({ title: g.title, items: g.items.map(([slug, title]) => toolItem(slug, title)) })),
    footer: { label: 'Alla gratis verktyg', to: TOOLS_HUB_PATH },
  },
  {
    key: 'pricing',
    label: 'Priser',
    to: '/priser',
  },
  {
    key: 'resources',
    label: 'Resurser',
    to: '/nyheter',
    dropdownWidth: 540,
    sections: [
      {
        title: 'Lär dig',
        items: [
          { title: 'Blogg & guider', desc: 'Bokföring förklarad steg för steg', to: '/blogg' },
          { title: 'Ordlista', desc: 'Ekonomiska begrepp från A till Ö', to: '/ordlista' },
          { title: 'Vanliga frågor', desc: 'Snabba svar om Bokix', to: '/vanliga-fragor' },
        ],
      },
      {
        title: 'Bokix',
        items: [
          { title: 'Nyheter', desc: 'Det senaste i Bokix', to: '/nyheter' },
          { title: 'Om oss', desc: 'Vilka som bygger Bokix', to: '/om-oss' },
          { title: 'Kontakt', desc: 'Hör av dig till oss', to: '/kontakt' },
        ],
      },
    ],
  },
];

// Inter laddas redan asynkront i index.html; ett @import här laddade den en
// gång till och blockerade renderingen. Stilblocket krymps (kommentarer och
// blanksteg bort) eftersom det skickas med i varje förrenderad sida.
const minifyCss = (css) => css
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .replace(/\s*([{};,])\s*/g, '$1')
  .trim();

/** Globala stilar + animationer, delade av ALLA marknadssidor — en enda
 * källa så knappar/kort/skroll-reveal aldrig kan divergera mellan sidorna. */
function MarketingStyles() {
  return (
    <style>{minifyCss(`
      #lp-root, #lp-root *, #lp-root *::before, #lp-root *::after { box-sizing: border-box; }
      /* overflow-x: hidden (inline-stilen på #lp-root) gör roten till en
         scrollcontainer, och då slutar position: sticky att fungera på
         hela marknadssajten (ordlistans bokstavsrad, FAQ-menyn,
         pristabellens rubrik). clip skär av lika bra men skapar ingen
         scrollcontainer. Äldre webbläsare behåller hidden. */
      @supports (overflow: clip) { #lp-root { overflow-x: clip !important; } }
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
        --mkt-btn-border: #9ca3af;
        --mkt-nav-text: #374151;
        --mkt-heading: #111827;
        --mkt-section-red-tint: oklch(97% 0.02 25);
        /* Kundönskemål (2026-09-22, tredje passet): "istället för grönt i
           ljust läge, ha vitt". Andra passet bytte startsidans beige mot en
           grön/turkos ton (se git-historiken för det resonemanget — kort:
           beigen matchade varken det kalla varumärket eller läste som annat
           än ett generiskt AI-mönster). Kunden vill nu ha ren vit i LJUST
           läge specifikt i stället — mörka läget är uttryckligen inte i
           fokus just nu (kundens egna ord, tidigare i samma tråd) och
           behåller sin gröna ton oförändrad (se html[data-theme="dark"]
           nedan). Sektionerna som använder token har redan hårfina
           border-top/bottom mot sina grannar, så rytmen syns ändå utan
           färgskillnad. */
        --mkt-section-mint: #ffffff;
        --mkt-section-blue: oklch(96.5% 0.032 242);
        /* Varannan sektion på startsidan. Neutral ljusgrå, inte grön eller
           beige (se --mkt-section-mint ovan för varför). */
        --mkt-section-alt: #f6f7f8;
      }
      /* html[data-theme="dark"] #lp-root (INTE bara #lp-root[data-theme=
         "dark"]) — se kommentaren vid useMarketingTheme() ovan för hela
         "varför": theme-init.js sätter <html>:s attribut INNAN webbläsaren
         målar något alls, men #lp-root:s EGET attribut sätts av React
         (useEffect, rad ~69) först EFTER hydrering/första målning. En
         förrenderad sida (entry-server.jsx, byggd i Node utan localStorage)
         skickar dessutom alltid #lp-root med data-theme="light" hårdkodat.
         Så länge den här regeln matchade på #lp-root:s EGET attribut var
         den mörka paletten alltid en studs efter: sidan målades ljus,
         hydrerade, och bytte SEDAN till mörk — den exakta "ljust, sen
         mörkt"-blinkningen kundrapporten beskrev, fast på marknadssajten
         i stället för den inloggade appen (som redan fixades separat via
         theme-init.js/<html>). Genom att matcha på <html>:s (redan
         korrekta) attribut i stället appliceras den mörka paletten redan
         vid FÖRSTA målningen, ingen blinkning kvar. */
      html[data-theme="dark"] #lp-root {
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
        --mkt-btn-border: #415944;
        --mkt-nav-text: #e8efe5;
        --mkt-heading: #eef3ea;
        --mkt-section-red-tint: oklch(20% 0.03 25);
        --mkt-section-mint: oklch(21% 0.03 165);
        --mkt-section-blue: oklch(21% 0.03 245);
        --mkt-section-alt: oklch(21% 0.03 165);
      }
      html[data-theme="dark"] #lp-root .lp-btn-secondary:hover { background: var(--mkt-ivory) !important; }
      /* Kundönskemål: Zettle/Bolagsverket/Skatteverkets loggor (BrandLogos.jsx,
         ThemedLogo) har en ljus- och en mörk-bläck-variant av samma bild —
         den här regeln väljer vilken som visas, styrt av samma
         #lp-root[data-theme]-attribut allt annat mörkt-läge redan använder. */
      .lp-logo-dark { display: none; }
      html[data-theme="dark"] #lp-root .lp-logo-light { display: none; }
      html[data-theme="dark"] #lp-root .lp-logo-dark { display: inline-block; }
      html[data-theme="dark"] #lp-root .lp-mobile-menu.lp-open { background: var(--mkt-page-bg) !important; }
      .lp-btn-primary { transition: all 0.2s !important; }
      .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(11,99,41,0.4) !important; }
      /* Hjältens knappar (Prova gratis / Se demo): samma höjd, radie och
         typografi så att de läses som ett par. Huvudknappen fylld, demon
         lugn och utan ikon. */
      .lp-hero-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; height: 54px; padding: 0 26px; border-radius: 12px; font-family: inherit; font-size: 16px; font-weight: 650; letter-spacing: -0.005em; white-space: nowrap; cursor: pointer; transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease, border-color 0.18s ease; }
      .lp-hero-btn svg { flex-shrink: 0; transition: transform 0.18s ease; }
      .lp-hero-btn:focus-visible { outline: 2px solid var(--mkt-accent-green-fg); outline-offset: 3px; }
      .lp-hero-btn-primary { min-width: 184px; border: none; color: #fff; background: var(--accent); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(11,99,41,0.25), 0 8px 20px -8px rgba(11,99,41,0.55); }
      .lp-hero-btn-primary:hover { background: var(--accent-hover, var(--accent)); transform: translateY(-1px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 4px rgba(11,99,41,0.25), 0 14px 28px -10px rgba(11,99,41,0.6); }
      .lp-hero-btn-primary:hover svg { transform: translateX(3px); }
      .lp-hero-btn-primary:active { transform: translateY(0); }
      .lp-hero-btn-ghost { min-width: 160px; color: var(--mkt-ink); background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); box-shadow: 0 1px 2px rgba(16,24,40,0.05); }
      .lp-hero-btn-ghost:hover { border-color: var(--mkt-btn-border); transform: translateY(-1px); box-shadow: 0 6px 16px -8px rgba(16,24,40,0.2); }
      .lp-hero-btn-row { display: flex; justify-content: center; align-items: center; gap: 12px; flex-wrap: wrap; }
      @media (max-width: 640px) {
        .lp-hero-btn-row { flex-direction: column; align-items: stretch; }
        .lp-hero-btn { width: 100%; }
      }
      .lp-btn-secondary { transition: all 0.2s !important; }
      .lp-btn-secondary:hover { background: #f9fafb !important; border-color: var(--mkt-nav-text) !important; }
      /* ── Sidhuvudets knappar (kundönskemål 2026-09-26: Logga in grön,
         tydligare ljus/mörk-val). Samma höjd och radie på alla tre. ── */
      .lp-login, .lp-signup {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        min-height: 46px; padding: 0 22px; border-radius: 12px; font-family: inherit;
        font-size: 15px; cursor: pointer; white-space: nowrap;
        transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
      }
      .lp-login { background: #f2f8ef; color: #0b6329; font-weight: 700; border: 1.5px solid color-mix(in srgb, #0b6329 55%, transparent); }
      .lp-login:hover { background: #eaf3de; border-color: #0b6329; }
      html[data-theme="dark"] #lp-root .lp-login { background: transparent; color: #3fc063; border-color: #1f9a4a; }
      html[data-theme="dark"] #lp-root .lp-login:hover { background: rgba(31, 154, 74, 0.12); border-color: #3fc063; }
      .lp-signup { background: #0b6329; color: #fff; font-weight: 700; border: none; box-shadow: 0 6px 18px -6px rgba(11, 99, 41, 0.55); }
      .lp-signup svg { transition: transform 0.2s ease; }
      .lp-signup:hover { background: #0a5523; }
      .lp-signup:hover svg { transform: translateX(3px); }
      html[data-theme="dark"] #lp-root .lp-signup { background: #16803a; box-shadow: 0 6px 22px -6px rgba(34, 197, 94, 0.45); }
      html[data-theme="dark"] #lp-root .lp-signup:hover { background: #1a9244; }
      .lp-hdr-sep { width: 1px; height: 24px; background: var(--mkt-border-soft); margin: 0 4px; }

      .lp-theme-switch { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: #eef3ec; border: 1px solid rgba(11, 99, 41, 0.12); }
      html[data-theme="dark"] #lp-root .lp-theme-switch { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.08); }
      .lp-theme-opt { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 36px; min-width: 36px; padding: 0 10px; border-radius: 999px; border: none; background: transparent; color: var(--mkt-muted); cursor: pointer; font-family: inherit; font-size: 13px; font-weight: 600; transition: background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease; }
      .lp-theme-opt:hover { color: var(--mkt-nav-text); }
      .lp-theme-opt.on { background: #fff; color: #0b6329; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(11, 99, 41, 0.08); }
      html[data-theme="dark"] #lp-root .lp-theme-opt.on { background: #1f3a26; color: #8fd67a; box-shadow: 0 0 0 1px rgba(143, 214, 122, 0.25); }
      .lp-theme-mini { width: 40px; height: 40px; border-radius: 999px; border: 1px solid rgba(11, 99, 41, 0.14); background: #eef3ec; color: #0b6329; cursor: pointer; align-items: center; justify-content: center; }
      html[data-theme="dark"] #lp-root .lp-theme-mini { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.1); color: #8fd67a; }
      .lp-theme-toggle { transition: all 0.2s !important; }
      .lp-theme-toggle:hover { background: #f9fafb !important; border-color: var(--mkt-nav-text) !important; }
      html[data-theme="dark"] #lp-root .lp-theme-toggle:hover { background: var(--mkt-ivory) !important; border-color: var(--mkt-nav-text) !important; }
      .lp-feature-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .lp-feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px -12px rgba(0,0,0,0.14) !important; border-color: transparent !important; }
      /* ── En enda accentfärg (BRAND.green) för alla nav-länkar, inte en
         per länk. Ett rullande grönt/blått/rött per länk (tidigare) kodar
         ingen verklig skillnad mellan Funktioner/Priser/Verktyg — det är
         bara dekoration, och gör headern rörigare i stället för att läsa
         som en avsiktlig varumärkesfärg. Samma logik som gjorde att den
         randiga linjen under hela navraden togs bort (se <nav> nedan). ── */
      .lp-nav-link { position: relative; }
      .lp-nav-link:hover, .lp-nav-link.active { color: ${BRAND.green} !important; }
      html[data-theme="dark"] #lp-root .lp-nav-link:hover,
      html[data-theme="dark"] #lp-root .lp-nav-link.active { color: #ffffff !important; }
      .lp-nav-link::after {
        content: ''; position: absolute; left: 0; right: 0; bottom: 4px; height: 2px;
        background: ${BRAND.green}; transform: scaleX(0); transform-origin: center;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      html[data-theme="dark"] #lp-root .lp-nav-link::after { background: #ffffff; }
      .lp-nav-link:hover::after, .lp-nav-link.active::after { transform: scaleX(1); }

      /* ── Megamenu dropdowns ── */
      .lp-nav-trigger {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: transparent;
        border: none;
        font-family: inherit;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        padding: 9px 14px;
        min-height: 42px;
        border-radius: 10px;
        color: var(--mkt-nav-text);
        transition: color 0.15s ease, background 0.15s ease;
      }
      .lp-nav-trigger:hover, .lp-nav-trigger.active {
        color: ${BRAND.green} !important;
        background: var(--mkt-ivory);
      }
      .lp-nav-trigger .chevron {
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        color: var(--mkt-muted);
      }
      .lp-nav-trigger:hover .chevron, .lp-nav-trigger.active .chevron {
        color: ${BRAND.green};
      }
      .lp-nav-trigger .chevron.open {
        transform: rotate(180deg);
      }
      html[data-theme="dark"] #lp-root .lp-nav-trigger:hover,
      html[data-theme="dark"] #lp-root .lp-nav-trigger.active {
        color: #ffffff !important;
        background: rgba(255, 255, 255, 0.05);
      }
      html[data-theme="dark"] #lp-root .lp-nav-trigger:hover .chevron,
      html[data-theme="dark"] #lp-root .lp-nav-trigger.active .chevron {
        color: #ffffff !important;
      }

      /* Megamenu Panel */
      .lp-megamenu-panel {
        position: absolute;
        top: calc(100% + 6px);
        background: var(--mkt-card-bg);
        border: 1px solid var(--mkt-border-soft);
        border-radius: 16px;
        box-shadow: 0 20px 50px -12px rgba(15, 23, 42, 0.16), 0 0 1px 1px rgba(15, 23, 42, 0.05);
        z-index: 1050;
        overflow: hidden;
        animation: lpMegamenuIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      html[data-theme="dark"] #lp-root .lp-megamenu-panel {
        background: #142218;
        border-color: #273b2d;
        box-shadow: 0 24px 60px -15px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.08);
      }
      @keyframes lpMegamenuIn {
        from {
          opacity: 0;
          transform: translate(-50%, -6px) scale(0.99);
        }
        to {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
        }
      }

      /* Panelens innehåll — ren text, inga ikoner. Kolumner per sektion
         med en tunn skiljelinje, rubrik i versaler, titel + kort rad. */
      .lp-mega-grid { display: grid; padding: 22px 14px 14px; }
      .lp-mega-col { display: flex; flex-direction: column; gap: 2px; padding: 0 8px; min-width: 0; }
      .lp-mega-col + .lp-mega-col { border-left: 1px solid var(--mkt-border-soft); padding-left: 16px; }
      html[data-theme="dark"] #lp-root .lp-mega-col + .lp-mega-col { border-left-color: #273b2d; }
      .lp-mega-heading {
        font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--mkt-muted); padding: 0 10px; margin-bottom: 8px;
      }
      .lp-megamenu-item {
        display: flex; flex-direction: column; gap: 2px;
        padding: 9px 10px; border-radius: 10px; text-decoration: none;
        transition: background 0.15s ease;
      }
      .lp-megamenu-item .item-title {
        font-size: 14.5px; font-weight: 600; line-height: 1.3; color: var(--mkt-heading);
        display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s ease;
      }
      .lp-megamenu-item .item-desc { font-size: 13px; line-height: 1.35; color: var(--mkt-muted); }
      .lp-megamenu-item .item-arrow {
        opacity: 0; transform: translateX(-3px); transition: opacity 0.15s ease, transform 0.2s ease;
      }
      .lp-megamenu-item:hover, .lp-megamenu-item:focus-visible, .lp-megamenu-item.is-active { background: var(--mkt-ivory); }
      .lp-megamenu-item:hover .item-title, .lp-megamenu-item.is-active .item-title { color: ${BRAND.green}; }
      .lp-megamenu-item:hover .item-arrow { opacity: 1; transform: translateX(0); }
      html[data-theme="dark"] #lp-root .lp-megamenu-item:hover,
      html[data-theme="dark"] #lp-root .lp-megamenu-item:focus-visible,
      html[data-theme="dark"] #lp-root .lp-megamenu-item.is-active { background: rgba(255, 255, 255, 0.06); }
      html[data-theme="dark"] #lp-root .lp-megamenu-item:hover .item-title,
      html[data-theme="dark"] #lp-root .lp-megamenu-item.is-active .item-title { color: #ffffff; }
      .lp-mega-footer {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 24px; border-top: 1px solid var(--mkt-border-soft);
        background: color-mix(in srgb, var(--mkt-ivory) 70%, transparent);
      }
      html[data-theme="dark"] #lp-root .lp-mega-footer { border-top-color: #273b2d; background: rgba(255, 255, 255, 0.03); }
      .lp-mega-footer a {
        font-size: 13.5px; font-weight: 700; color: ${BRAND.green}; text-decoration: none;
        display: inline-flex; align-items: center; gap: 6px;
      }
      .lp-mega-footer a svg { transition: transform 0.2s ease; }
      .lp-mega-footer a:hover svg { transform: translateX(3px); }
      html[data-theme="dark"] #lp-root .lp-mega-footer a { color: #ffffff; }

      /* Mobilmenyns dragspel — allt stängt från början, bara en sektion
         öppen åt gången. Höjden animeras med grid-rows 0fr → 1fr. */
      .lp-macc { border-bottom: 1px solid var(--mkt-border-soft); }
      .lp-macc-head {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        background: none; border: none; cursor: pointer; font-family: inherit;
        font-size: 19px; font-weight: 600; letter-spacing: -0.01em; color: var(--mkt-heading);
        padding: 17px 2px; text-align: left; text-decoration: none;
      }
      .lp-macc-head.is-current { color: ${BRAND.green}; }
      html[data-theme="dark"] #lp-root .lp-macc-head.is-current { color: #ffffff; }
      .lp-macc-head .chevron { color: var(--mkt-muted); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .lp-macc.is-open .lp-macc-head .chevron { transform: rotate(180deg); }
      .lp-macc-body {
        display: grid; grid-template-rows: 0fr;
        transition: grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s linear 0.32s;
        visibility: hidden;
      }
      .lp-macc.is-open .lp-macc-body {
        grid-template-rows: 1fr; visibility: visible;
        transition: grid-template-rows 0.32s cubic-bezier(0.16, 1, 0.3, 1), visibility 0s;
      }
      .lp-macc-inner { overflow: hidden; min-height: 0; }
      .lp-macc-content {
        display: flex; flex-direction: column; gap: 18px; padding: 2px 2px 20px;
        opacity: 0; transform: translateY(-4px); transition: opacity 0.2s ease, transform 0.3s ease;
      }
      .lp-macc.is-open .lp-macc-content { opacity: 1; transform: none; transition-delay: 0.06s; }
      .lp-macc-heading {
        font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
        color: var(--mkt-muted); margin-bottom: 4px;
      }
      .lp-macc-link {
        display: block; padding: 9px 0; font-size: 16px; font-weight: 500;
        color: var(--mkt-nav-text); text-decoration: none;
      }
      .lp-macc-link.is-active { color: ${BRAND.green}; font-weight: 600; }
      html[data-theme="dark"] #lp-root .lp-macc-link.is-active { color: #ffffff; }
      .lp-macc-all {
        display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
        font-size: 14px; font-weight: 700; color: ${BRAND.green}; text-decoration: none; padding: 4px 0;
      }
      html[data-theme="dark"] #lp-root .lp-macc-all { color: #ffffff; }
      /* Undersidorna: en accent (grönt) i stället för grönt/blått/turkos
         om vartannat. Rött står kvar, det betyder kostnad/skatt. */
      #lp-root.lp-sub, html[data-theme="dark"] #lp-root.lp-sub {
        --mkt-accent-blue-fg: var(--mkt-accent-green-fg);
        --mkt-accent-blue-soft: var(--mkt-accent-green-soft);
        --mkt-accent-teal-fg: var(--mkt-accent-green-fg);
        --mkt-accent-teal-soft: var(--mkt-accent-green-soft);
      }
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
      /* Samma flöde men för en CSS-gradient-"linje" (div, inte SVG) —
         leverantörsfaktura-pipen mellan de tre stegen. */
      @keyframes lpFlowGradient { 0% { background-position: 0% 0; } 100% { background-position: -200% 0; } }
      .lp-flow-connector { background-size: 200% 100%; animation: lpFlowGradient 2.4s linear infinite; }
      /* ── "Kopplat till"-sektionen: två spalter (Betalningar/Myndigheter),
         ersatte 2026-09-22 det gamla hub-diagrammet (glödande mittnod,
         böjda linjer ut) — se filkommentaren i LandingPage.jsx för varför.
         Faller själv ihop till en spalt under 680px, ingen JS behövs. ── */
      /* Startsidans tvådelade sektioner: text på ena sidan, animationen på
         den andra, och sidorna byter plats (lp-split-rev) så att sidan inte
         blir samma centrerade mall rakt igenom. Under 960px en spalt med
         texten vänsterställd även där (2026-10-20), så att telefonen inte ser
         ut som den gamla helt centrerade startsidan. */
      .lp-split { display: grid; grid-template-columns: minmax(0, 1fr); gap: 40px; align-items: center; max-width: min(92vw, 1180px); margin: 0 auto; position: relative; }
      .lp-split-text { text-align: left; }
      .lp-split-lead { margin: 0 0 28px; max-width: 540px; }
      @media (min-width: 960px) {
        .lp-split { grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 64px; }
        .lp-split.lp-split-rev { grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); }
        .lp-split.lp-split-rev > .lp-split-text { order: 2; }
        .lp-split .lp-conn-grid { margin: 0; }
      }
      .lp-conn-grid { display: grid; grid-template-columns: 1fr; gap: 8px 56px; max-width: 640px; margin: 0 auto; }
      .lp-conn-col { display: flex; flex-direction: column; }
      .lp-conn-col + .lp-conn-col { margin-top: 28px; padding-top: 28px; border-top: 1px solid var(--mkt-border-soft); }
      .lp-conn-col-label { font-size: 12px; font-weight: 800; letter-spacing: 0.09em; text-transform: uppercase; color: var(--mkt-muted); margin-bottom: 6px; }
      .lp-conn-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-top: 1px solid var(--mkt-border-soft); }
      .lp-conn-row:first-of-type { border-top: none; }
      /* Kundönskemål (2026-09-22, andra passet, "loggorna ser small ut") —
         en bar logga direkt på sektionens tonade bakgrund (förra passets
         .lp-conn-logo) läste svagt oavsett pixelhöjd: inget eget stopp för
         ögat. Samma vita, ramade platta som trovärdighetsradens badgar
         (LandingPage.jsx) ger var logga en egen yta i stället.
         var(--mkt-card-bg), INTE hårdkodat #ffffff (kundönskemål, tredje
         gången, "behöver se bra ut i mörkt tema"): Zettle/Bolagsverket/
         Skatteverkets mörka loggvarianter (ThemedLogo, BrandLogos.jsx) är
         avsiktligt färgade för att synas mot precis den mörkgröna
         kortbottnen — se den filens egen kommentar ("ljus nog att synas
         mot den mörkgröna cirkeln"). En kvarvarande vit platta hade gjort
         de vita loggdetaljerna osynliga i mörkt läge. */
      .lp-conn-badge { display: flex; align-items: center; justify-content: center; height: 64px; padding: 0 16px; min-width: 64px; border-radius: 14px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); box-shadow: 0 2px 8px rgba(28,36,32,0.06); flex-shrink: 0; }
      .lp-conn-name { font-size: 15px; font-weight: 600; color: var(--mkt-ink); }
      @media (min-width: 680px) {
        .lp-conn-grid { grid-template-columns: 1fr 1fr; max-width: 760px; }
        .lp-conn-col + .lp-conn-col { margin-top: 0; padding-top: 0; border-top: none; padding-left: 56px; border-left: 1px solid var(--mkt-border-soft); }
      }
      /* Kundönskemål ("denna ska vara moving") — jämförelsetabellens
         Bokix-vinnarkolumn får ett sakta svepande ljus över sin gradient-
         bakgrund istället för en helt stillastående ton, samma
         background-position-teknik som Heros .lp-gradient-text redan
         etablerat på sidan. */
      @keyframes lpColumnSweep { 0% { background-position: 0% 0; } 100% { background-position: -200% 0; } }
      .lp-column-sweep { background-size: 220% 100%; animation: lpColumnSweep 4.5s linear infinite; }

      /* En långsam, mjuk guppning så aktivitetskort känns levande utan att
         bli distraherande. */
      @keyframes lpToastFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
      .lp-toast-float { animation: lpToastFloat 4s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .lp-flow-connector, .lp-column-sweep, .lp-toast-float { animation: none !important; }
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

      .lp-bento-grid > * { min-width: 0; }

      /* Vanliga frågor: två spalter först när det finns plats. Under
         1100px är det en läslista som förut — en accordion i två smala
         spalter är sämre än en i en bred. */
      .lp-faq-grid { display: grid; grid-template-columns: 1fr; gap: 0 32px; align-items: start; }
      @media (min-width: 1100px) { .lp-faq-grid { grid-template-columns: 1fr 1fr; } }

      /* Brytpunkten mättes om (headern gick från fem länkar ner till tre,
         se MARKETING_PAGES ovan) i stället för att gissas: knapparna
         ("Logga in"/"Kom igång") bryter till två rader någonstans i
         ~750-820px-spannet (testat med Playwright-skärmdumpar vid 690/750/
         800/820/840px) — 840px var första bredden utan radbrytning. 860px
         satt här som brytpunkt ger samma marginal som tidigare (~20px)
         över den uppmätta gränsen, inte en rund gissning. Under 860px:
         hamburgermenyn, aldrig en hoppressad navrad däremellan — samma
         princip som förut (se historiken här), bara med rätt tal för tre
         länkar i stället för fyra. */
      @media (max-width: 960px) {
        .lp-nav-desktop { display: none !important; }
        .lp-hamburger-btn { display: flex !important; }
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
      /* Helskärm (2026-10-04): demot ska kännas som att man sitter i appen,
         inte som en ruta på sidan. Bara en tunn rad överst med krysset. */
      .lp-demo-overlay { position: fixed; inset: 0; z-index: 3000; display: flex; padding: 0; }
      .lp-demo-overlay-backdrop { position: absolute; inset: 0; background: rgba(9,20,14,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: lpFadeIn 0.22s ease both; }
      .lp-demo-overlay-panel { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; background: var(--bg-page); overflow: hidden; animation: lpDemoIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }
      .lp-demo-overlay-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 8px 12px 8px 18px; background: var(--mkt-card-bg); border-bottom: 1px solid var(--mkt-border-soft); flex-shrink: 0; }
      .lp-demo-overlay-close { width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--mkt-border-soft); background: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--mkt-nav-text); flex-shrink: 0; transition: background 0.15s ease; }
      .lp-demo-overlay-close:hover { background: var(--mkt-ivory); }
      .lp-demo-overlay-body { flex: 1; min-height: 0; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 0; }
      /* På dator fyller appen hela ytan: inga rundade hörn, ingen skugga, och
         sidomenyn och innehållet går ända ner (innehållet skrollar själv). */
      @media (min-width: 641px) {
        .lp-demo-overlay-body { overflow: hidden; display: flex; flex-direction: column; }
        .lp-demo-overlay-body > .lp-demo-card { flex: 1; min-height: 0; border-radius: 0 !important; box-shadow: none !important; }
        .lp-demo-overlay .lp-demo-content { max-height: none; }
        .lp-demo-overlay .lp-demo-sidebar { max-height: none !important; }
      }
      @keyframes lpFadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes lpDemoIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) { .lp-demo-overlay-backdrop, .lp-demo-overlay-panel { animation: none; } }
      @media (max-width: 640px) {
        .lp-demo-overlay { padding: 0; }
        .lp-demo-overlay-panel { max-height: 100vh; height: 100%; border-radius: 0; border: none; }
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
      /* Demons sidomeny: rubriker (Verksamhet, Ekonomi ...) och en lista som skrollar om kortet är lågt. */
      .lp-demo-nav { scrollbar-width: none; }
      .lp-demo-nav::-webkit-scrollbar { display: none; }
      .lp-demo-nav-title { padding: 8px 22px 2px 24px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255, 255, 255, 0.5); }
      .lp-demo-content { flex: 1; min-width: 0; max-height: min(780px, 82vh); overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background: var(--bg-page); }
      @media (max-width: 640px) {
        .lp-cta-group { flex-direction: column; }
        .lp-cta-group > button, .lp-cta-group > a, .lp-cta-group > .lp-moving-border-wrap { width: 100%; }
        .lp-cta-group > .lp-moving-border-wrap > button { width: 100%; }
        .lp-bento-grid { grid-template-columns: 1fr; }
        .lp-hide-mobile { display: none !important; }
        /* Kundfeedback (mobil, skärmdump): flaggskeppskortet ("Bokföring")
           stod kvar som en sida-vid-sida-rad även när gridet ovan redan
           staplat de tre andra korten — bilden fick bara ~42% av en redan
           smal telefonbredd, för trångt för att demots rader skulle synas.
           Samma brytpunkt som gridet: under den staplas bild-över-text som
           de tre andra korten redan gör, i stället för att tvinga in en
           skrivbordslayout på en telefon. */
        .lp-bento-feature-row { flex-direction: column; }
        .lp-bento-feature-media { width: 100% !important; }
        /* Produktvisningens demo-kort — istället för att bara försvinna på
           mobil (ingen meny alls) visas samma mobila navigeringsmönster som
           riktiga appen faktiskt använder på små skärmar: en enkel topbar
           (logga + tema, ingen hamburgermeny) och en bottennav med "Meny"-
           bottensheet (se DemoWorkspace.jsx, samma klasser/mönster som
           App.jsx:s .mobile-bottom-nav/.mobile-sheet), så demon ger en
           ärlig bild av hur Bokix ser ut på mobilen också. */
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
        /* .lp-demo-card:s overflow:hidden (satt inline, DemoWorkspace.jsx —
           klipper skrivbordskortets rundade hörn) bryter av samma skäl
           position:sticky på bottennaven därinne: VILKET overflow-värde
           som helst annat än "visible" gör sitt element till en egen
           "scrollcontainer" ur sticky-algoritmens synvinkel, även om det
           elementet aldrig själv skrollar (kortet växer bara i höjd här,
           det är SIDAN som skrollar) — naven fick då aldrig något att
           "fastna" mot, den stod kvar på sin vanliga (osynliga, långt ner)
           plats. "visible" här (bara på mobil) tar bort den falska
           scrollcontainern, så sticky räknar mot sidans EGEN scroll i
           stället, precis som tänkt. Ingen hörn-urklippning behövs kvar på
           mobil — kortet är i praktiken redan kant-till-kant där. */
        /* !important krävs: overflow:hidden sätts som React inline style i
           DemoWorkspace.jsx (klipper skrivbordskortets rundade hörn), och
           en inline style vinner alltid över en vanlig klass-regel, en
           media query eller inte — samma skäl .lp-hide-mobile ovan
           redan är !important. */
        .lp-demo-card { overflow: visible !important; }
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
      /* ── Sidfoten. Samma mörka botten i båda teman, en färg (elfenben)
         i tre styrkor: rubriker dämpade, länkar mellan, hover vit. Ingen
         gradientlist eller färgade fläckar. */
      .lp-footer { background: #1b4332; color: rgba(255,255,255,0.62); padding: 64px 24px 28px; position: relative; overflow: hidden; border-top: 1px solid rgba(255,255,255,0.06); }
      .lp-footer-inner { max-width: 1120px; margin: 0 auto; position: relative; }
      .lp-footer-grid { display: grid; grid-template-columns: 1.2fr repeat(5, minmax(0, 1fr)); gap: 40px 28px; }
      .lp-footer-grid > * { min-width: 0; }
      .lp-footer-brand { display: flex; flex-direction: column; align-items: flex-start; gap: 18px; }
      .lp-footer-heading { font-size: 12px; font-weight: 600; letter-spacing: 0.02em; color: #ffffff; margin: 0 0 16px; }
      .lp-footer-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
      .lp-footer-link { font-size: 14px; line-height: 1.4; color: rgba(255,255,255,0.62); text-decoration: none; transition: color 0.15s ease; }
      .lp-footer-link:hover, .lp-footer-link:focus-visible { color: #ffffff; }
      .lp-footer-mail { font-weight: 500; color: rgba(255,255,255,0.78); }
      .lp-footer-btn { background: none; border: none; padding: 0; cursor: pointer; font-family: inherit; }
      .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px 28px; margin-top: 56px; padding-top: 28px; border-top: 1px solid rgba(255,255,255,0.1); }
      .lp-footer-start { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
      .lp-footer-copy { margin: 0; font-size: 13px; color: rgba(255,255,255,0.55); }
      .lp-footer-book { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.16); color: #ffffff; font-size: 13px; font-weight: 500; text-decoration: none; transition: background 0.15s ease, border-color 0.15s ease; }
      .lp-footer-book svg { transition: transform 0.15s ease; }
      .lp-footer-book:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.28); }
      .lp-footer-book:hover svg { transform: translateX(2px); }
      /* Policyerna: jämna mellanrum och en liten punkt mellan varje, ritad
         med ::before så punkten aldrig blir en egen klickyta. */
      .lp-footer-legal { display: flex; flex-wrap: wrap; align-items: center; row-gap: 8px; }
      .lp-footer-legal > * { font-size: 13px; color: rgba(255,255,255,0.55); display: inline-flex; align-items: center; }
      .lp-footer-legal > * + *::before { content: ''; width: 3px; height: 3px; border-radius: 50%; background: rgba(255,255,255,0.25); margin: 0 12px; }
      .lp-footer-legal > *:hover { color: #ffffff; }
      /* Halvbrett: loggan på egen rad, fyra kolumner under. */
      @media (max-width: 1000px) {
        .lp-footer-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px 24px; }
        .lp-footer-brand { grid-column: 1 / -1; flex-direction: row; align-items: center; justify-content: space-between; }
      }
      /* Telefon: två jämna kolumner (2 + 2), centrerad bottenrad. */
      @media (max-width: 720px) {
        .lp-footer { padding: 48px 20px 28px; }
        .lp-footer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 36px 16px; }
        .lp-footer-brand { padding-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        .lp-footer-bottom { margin-top: 40px; }
        .lp-footer-bottom { flex-direction: column; align-items: center; text-align: center; gap: 18px; }
        .lp-footer-start { display: contents; }
        .lp-footer-book { order: 1; }
        .lp-footer-legal { order: 2; }
        .lp-footer-copy { order: 3; }
        .lp-footer-legal { justify-content: center; gap: 12px 20px; }
        .lp-footer-legal > * + *::before { display: none; }
      }
      .lp-mobile-menu.lp-open {
        display: flex; position: fixed; inset: 0; background: white; z-index: 2000;
        flex-direction: column; padding: 20px 24px 32px;
      }
    `)}</style>
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


/** Ljust/mörkt som två synliga val i stället för en ensam ikon: man ser
 * direkt vilka lägen som finns och vilket som är valt. */
function ThemeSwitch({ theme, onToggleTheme, labels = false }) {
  const opts = [
    { id: 'light', label: 'Ljust', Icon: Sun },
    { id: 'dark', label: 'Mörkt', Icon: Moon },
  ];
  return (
    <div className="lp-theme-switch" role="group" aria-label="Utseende">
      {opts.map(({ id, label, Icon }) => (
        <button
          key={id} type="button" aria-pressed={theme === id} title={`${label} läge`} aria-label={`${label} läge`}
          className={`lp-theme-opt${theme === id ? ' on' : ''}`}
          onClick={() => { if (theme !== id) onToggleTheme(); }}
        >
          <Icon size={16} />{labels && label}
        </button>
      ))}
    </div>
  );
}

export function MarketingHeader({ onEnterApp, theme, onToggleTheme }) {
  const [scrolled, setScrolled] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [mobileOpenKey, setMobileOpenKey] = useState(null);

  const navRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Headern glider undan när man scrollar nedåt och kommer tillbaka så fort
  // man scrollar uppåt (2026-10-21, ersatte "bara undan i sidfoten").
  // Alltid synlig högst upp på sidan. En liten tröskel så att
  // skakningar på pekskärm inte får den att blinka.
  useEffect(() => {
    let lastY = window.scrollY;
    const handler = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      if (y < 80) setScrollHidden(false);
      else if (y > lastY + 6) setScrollHidden(true);
      else if (y < lastY - 6) setScrollHidden(false);
      else return;
      lastY = y;
    };
    handler();
    window.addEventListener('scroll', handler, { passive: true });
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  // Stäng dropdown vid sidnavigering
  useEffect(() => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Stäng dropdown vid klick utanför nav eller vid Escape
  useEffect(() => {
    const onMouseDown = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);



  const handleEnterApp = (mode) => {
    setMobileMenuOpen(false);
    setOpenDropdown(null);
    if (onEnterApp) onEnterApp(mode);
    else navigate('/', { state: { enterApp: true, authMode: mode } });
  };

  const activeMenu = NAV_MENUS.find(m => m.key === openDropdown && m.sections?.length);
  // Aldrig gömd medan en meny är öppen. visibility (inte bara transform) så
  // att tabb inte hamnar på länkar man inte ser.
  const hidden = scrollHidden && !mobileMenuOpen && !openDropdown;

  return (
    <>
      <nav ref={navRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'var(--mkt-header-bg)' : 'color-mix(in srgb, var(--mkt-header-bg) 55%, transparent)',
        backdropFilter: scrolled ? undefined : 'blur(14px)',
        WebkitBackdropFilter: scrolled ? undefined : 'blur(14px)',
        borderBottom: scrolled ? '1px solid var(--mkt-border-soft)' : 'none',
        padding: '0 24px', transition: 'all 0.3s',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.06)' : 'none',
        transform: hidden ? 'translateY(-100%)' : 'none',
        visibility: hidden ? 'hidden' : 'visible',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', height: '84px', gap: '32px' }}>
          <Link to="/" className="lp-logo-glow" style={{ alignItems: 'center', flexShrink: 0 }} aria-label="Till startsidan" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <BokixWordmark height={58} />
          </Link>

          <div
            className="lp-nav-desktop"
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: '8px', position: 'relative' }}
          >
            {NAV_MENUS.map((menu) => {
              const hasDropdown = Boolean(menu.sections?.length);
              const allItems = hasDropdown ? menu.sections.flatMap(s => s.items) : [];
              const isCurrentRouteActive = hasDropdown
                ? (location.pathname === menu.to || allItems.some(it => location.pathname === it.to))
                : location.pathname === menu.to;
              const isOpen = openDropdown === menu.key;

              if (!hasDropdown) {
                return (
                  <Link
                    key={menu.key}
                    to={menu.to}
                    className={`lp-nav-link ${isCurrentRouteActive ? 'active' : ''}`}
                    style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: 'var(--mkt-nav-text)',
                      textDecoration: 'none',
                      padding: '10px 14px',
                      minHeight: '44px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      borderRadius: '8px',
                    }}
                  >
                    {menu.label}
                  </Link>
                );
              }

              return (
                <div
                  key={menu.key}
                >
                  <button
                    type="button"
                    className={`lp-nav-trigger ${isOpen || isCurrentRouteActive ? 'active' : ''}`}
                    onClick={() => setOpenDropdown(isOpen ? null : menu.key)}
                    style={{ }}
                    aria-expanded={isOpen}
                    aria-haspopup="true"
                  >
                    {menu.label}
                    <ChevronDown size={14} className={`chevron ${isOpen ? 'open' : ''}`} />
                  </button>
                </div>
              );
            })}

            {/* Active Mega Menu Panel — click-only, no hover */}
            {activeMenu && (
              <div
                className="lp-megamenu-panel"
                style={{
                  width: activeMenu.dropdownWidth || 600,
                  maxWidth: 'calc(100vw - 32px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  top: 'calc(100% + 6px)',
                }}
              >
                <div className="lp-mega-grid" style={{ gridTemplateColumns: `repeat(${activeMenu.sections.length}, minmax(0, 1fr))` }}>
                  {activeMenu.sections.map((section) => (
                    <div key={section.title} className="lp-mega-col">
                      <div className="lp-mega-heading">{section.title}</div>
                      {section.items.map((item) => (
                        <Link
                          key={item.to + item.title}
                          to={item.to}
                          className={`lp-megamenu-item ${location.pathname === item.to ? 'is-active' : ''}`}
                          onClick={() => setOpenDropdown(null)}
                        >
                          <span className="item-title">
                            {item.title}
                            <ArrowRight size={13} className="item-arrow" />
                          </span>
                          {item.desc && <span className="item-desc">{item.desc}</span>}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>

                {activeMenu.footer && (
                  <div className="lp-mega-footer">
                    <Link to={activeMenu.footer.to} onClick={() => setOpenDropdown(null)}>
                      {activeMenu.footer.label}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lp-nav-desktop" style={{ gap: '10px', alignItems: 'center' }}>
            <ThemeSwitch theme={theme} onToggleTheme={onToggleTheme} />
            <span className="lp-hdr-sep" aria-hidden />
            <button type="button" className="lp-login" onClick={() => handleEnterApp('login')}>
              Logga in
            </button>
            <button type="button" className="lp-btn-primary lp-signup" onClick={() => handleEnterApp('signup')}>
              Kom igång <ArrowRight size={16} />
            </button>
          </div>

          <button onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} className="lp-hamburger-btn lp-theme-mini" style={{ marginLeft: 'auto' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="lp-hamburger-btn" onClick={() => { setMobileOpenKey(null); setMobileMenuOpen(true); }} aria-label="Öppna meny" style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, color: 'var(--mkt-nav-text)' }}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      <div className={`lp-mobile-menu ${mobileMenuOpen ? 'lp-open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Link to="/" onClick={() => { setMobileMenuOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="lp-logo-glow" aria-label="Till startsidan"><BokixWordmark height={32} /></Link>
          <button onClick={() => setMobileMenuOpen(false)} aria-label="Stäng meny" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--mkt-nav-text)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {NAV_MENUS.map((menu) => {
            const hasDropdown = Boolean(menu.sections?.length);
            const allItems = hasDropdown ? menu.sections.flatMap(s => s.items) : [];
            const isCurrent = location.pathname === menu.to || allItems.some(it => location.pathname === it.to);

            if (!hasDropdown) {
              return (
                <div key={menu.key} className="lp-macc">
                  <Link
                    to={menu.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`lp-macc-head ${isCurrent ? 'is-current' : ''}`}
                  >
                    {menu.label}
                  </Link>
                </div>
              );
            }

            // Bara en sektion öppen åt gången: ett tryck på Verktyg
            // fäller ihop Funktioner och öppnar Verktyg.
            const isOpen = mobileOpenKey === menu.key;
            const panelId = `lp-macc-${menu.key}`;
            return (
              <div key={menu.key} className={`lp-macc ${isOpen ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className={`lp-macc-head ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => setMobileOpenKey(isOpen ? null : menu.key)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                >
                  {menu.label}
                  <ChevronDown size={20} className="chevron" />
                </button>
                <div className="lp-macc-body" id={panelId}>
                  <div className="lp-macc-inner">
                    <div className="lp-macc-content">
                      {menu.sections.map((section) => (
                        <div key={section.title}>
                          <div className="lp-macc-heading">{section.title}</div>
                          {section.items.map((item) => (
                            <Link
                              key={item.to + item.title}
                              to={item.to}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`lp-macc-link ${location.pathname === item.to ? 'is-active' : ''}`}
                            >
                              {item.title}
                            </Link>
                          ))}
                        </div>
                      ))}
                      {menu.footer && (
                        <Link to={menu.footer.to} onClick={() => setMobileMenuOpen(false)} className="lp-macc-all">
                          {menu.footer.label}
                          <ArrowRight size={14} />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--mkt-muted)' }}>Utseende</span>
            <ThemeSwitch theme={theme} onToggleTheme={onToggleTheme} labels />
          </div>
          <button type="button" className="lp-login" style={{ width: '100%', minHeight: '50px' }} onClick={() => handleEnterApp('login')}>
            Logga in
          </button>
          <button type="button" className="lp-btn-primary lp-signup" style={{ width: '100%', minHeight: '50px' }} onClick={() => handleEnterApp('signup')}>
            Kom igång <ArrowRight size={16} />
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
      { label: 'Fakturering', to: '/faktureringsprogram' },
      { label: 'Lön och arbetsgivare', to: '/lon' },
      { label: 'Lager och artiklar', to: '/bokforingsprogram-med-lager' },
      { label: 'Integrationer', to: '/integrationer' },
    ],
  },
  {
    // En sida per bolagsform (content/marketing/orgTypes.js): interna länkar
    // från varje sida till de sidor som ska synas på "bokföringsprogram".
    heading: 'Bokföringsprogram för',
    links: [...ORG_TYPE_PAGES.map(p => ({ label: p.short, to: p.path })), { label: 'Nystartade företag', to: '/bokforingsprogram-nystartat-foretag' }],
  },
  {
    // Bara de fyra mest sökta verktygen + "Alla verktyg", inte alla nio,
    // så kolumnen blir lika lång som sina grannar.
    heading: 'Gratis verktyg',
    links: [
      ...TOOLS.filter(t => ['skanna-kvitto', 'momskalkylator', 'lonekalkylator', 'rot-rut'].includes(t.slug)).map(t => ({ label: t.footerLabel || t.title, to: t.path })),
      { label: 'Alla verktyg', to: TOOLS_HUB_PATH },
    ],
  },
  {
    // UF-sidan finns kvar men länkas inte härifrån (inte i fokus just nu).
    heading: 'Resurser',
    links: [
      { label: 'Blogg', to: '/blogg' },
      { label: 'Videoguider', to: '/guider' },
      { label: 'Vanliga frågor', to: '/vanliga-fragor' },
      { label: 'Bokföringsordlista', to: '/ordlista' },
      { label: 'Byt till Bokix', to: '/byt-bokforingsprogram' },
      { label: 'Bokix på mobilen', to: '/lagg-till-pa-hemskarmen' },
    ],
  },
  {
    heading: 'Företag',
    links: [
      { label: 'Om oss', to: '/om-oss' },
      { label: 'Nyheter', to: '/nyheter' },
      { label: 'Bokix i korthet', to: '/bokix-i-korthet' },
      { label: 'Säkerhet', to: '/sakerhet' },
      { label: 'Driftstatus', href: 'https://status.bokix.se/sv' },
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

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-grid">
          {/* Varumärkesblocket: logga och supportadress, inget mer. Adressen
              står här eftersom den vanligaste anledningen att skrolla hit är
              att man vill nå en människa. */}
          <div className="lp-footer-brand">
            <Link to="/" className="lp-logo-glow" aria-label="Till startsidan" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <BokixWordmark height={30} />
            </Link>
            <a href="mailto:bokixab@gmail.com" className="lp-footer-link lp-footer-mail">bokixab@gmail.com</a>
          </div>

          {/* Sidans sista rubrik före footern är alltid en <h2> (CTA-
              sektionen), så kolumnrubrikerna är <h3>. */}
          {FOOTER_COLUMNS.map(column => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="lp-footer-heading">{column.heading}</h3>
              <ul className="lp-footer-list">
                {column.links.map(link => (
                  <li key={link.to || link.href}>{link.href
                    ? <a href={link.href} className="lp-footer-link">{link.label}</a>
                    : <Link to={link.to} className="lp-footer-link">{link.label}</Link>}</li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="lp-footer-bottom">
          <div className="lp-footer-start">
            <p className="lp-footer-copy">© {year} Bokix</p>
            <Link to="/boka-genomgang" className="lp-footer-book">
              Boka en genomgång
              <ArrowRight size={14} aria-hidden />
            </Link>
          </div>
          <div className="lp-footer-legal">
            {FOOTER_LEGAL.map(link => (
              <Link key={link.to} to={link.to} className="lp-footer-link">{link.label}</Link>
            ))}
            {/* Öppnar CookieBanner.jsx igen (monterad globalt i AppRouter.jsx)
                via ett DOM-event. */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('bokix-open-cookie-prefs'))}
              className="lp-footer-link lp-footer-btn"
            >
              Cookieinställningar
            </button>
          </div>
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
  const { pathname } = useLocation();
  // Undersidorna (allt utom startsidan) kör en accentfärg och solida ytor,
  // se .lp-sub i MarketingStyles.
  const isHome = /^\/(en|no|dk|fi)?\/?$/.test(pathname);
  return (
    <div id="lp-root" className={isHome ? undefined : 'lp-sub'} data-theme={theme} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: 'var(--mkt-heading)', background: 'var(--mkt-page-bg)', overflowX: 'hidden' }}>
      <JsonLd data={ORGANIZATION_SCHEMA} />
      <JsonLd data={WEBSITE_SCHEMA} />
      <MarketingStyles />
      <MarketingHeader onEnterApp={onEnterApp} theme={theme} onToggleTheme={toggleTheme} />
      {children}
      <MarketingFooter />
    </div>
  );
}
