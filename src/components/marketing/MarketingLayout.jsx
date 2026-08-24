import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import { ACCENT_CYCLE } from './marketingTokens';
import { useDocumentMeta } from '../../hooks/useDocumentMeta';

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

// ── Bokix ordmärke — exakt samma gradient som sidopanelens logga i själva
// appen (App.jsx BokixLogo), så en besökare känner igen samma identitet på
// marknadssidan som i produkten. Loggan är alltid en länk till startsidan
// ("/"), oavsett vilken undersida man står på. ──
export function BokixWordmark({ height = 34 }) {
  const width = (height * 140) / 48;
  return (
    <svg viewBox="0 0 140 48" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bokixLpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      <text x="4" y="38" fontFamily="Georgia, 'Times New Roman', serif" fontSize="46" fontWeight="600" fill="url(#bokixLpGrad)" letterSpacing="-1.5">Bokix</text>
    </svg>
  );
}

// Sitemap — varje punkt är en RIKTIG egen sida/URL, inte ett skrolla-till-
// sektion-på-samma-sida-ankare som tidigare. Loggan är det enda som alltid
// går till startsidan; de här länkarna går var och en till sin egen sida.
export const MARKETING_PAGES = [
  { label: 'Funktioner', to: '/funktioner' },
  { label: 'Priser', to: '/priser' },
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
        --mkt-accent-blue-fg: oklch(56% 0.17 240);
        --mkt-accent-blue-soft: oklch(93% 0.045 240);
        --mkt-accent-red-fg: oklch(55% 0.19 25);
        --mkt-accent-red-soft: oklch(93% 0.05 25);
        --mkt-border-soft: #e5e7eb;
        --mkt-nav-text: #374151;
        --mkt-heading: #111827;
        --mkt-section-red-tint: oklch(97% 0.02 25);
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
        --mkt-accent-red-fg: oklch(73% 0.16 25);
        --mkt-accent-red-soft: oklch(30% 0.06 25);
        --mkt-border-soft: #2a3d2c;
        --mkt-nav-text: #c3d0bd;
        --mkt-heading: #eef3ea;
        --mkt-section-red-tint: oklch(20% 0.03 25);
      }
      #lp-root[data-theme="dark"] .lp-btn-secondary:hover { background: var(--mkt-ivory) !important; }
      #lp-root[data-theme="dark"] .lp-mobile-menu.lp-open { background: var(--mkt-page-bg) !important; }
      .lp-btn-primary { transition: all 0.2s !important; }
      .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(61,122,46,0.4) !important; }
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
      .lp-faq-item { border-bottom: 1px solid var(--mkt-border-soft); }
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

      @keyframes lpFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }
      .lp-float { animation: lpFloat 5s ease-in-out infinite; }

      @keyframes lpPulseRing {
        0% { box-shadow: 0 0 0 0 rgba(61,122,46,0.35); }
        70% { box-shadow: 0 0 0 14px rgba(61,122,46,0); }
        100% { box-shadow: 0 0 0 0 rgba(61,122,46,0); }
      }
      .lp-pulse { animation: lpPulseRing 2.4s cubic-bezier(0.4,0,0.6,1) infinite; }

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
      .lp-anim-gradient-bg { background-size: 200% 200% !important; animation: lpGradientMove 10s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .lp-blob, .lp-float, .lp-pulse, .lp-gradient-text, .lp-anim-gradient-bg { animation: none !important; }
      }

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
      .lp-features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
      .lp-stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
      .lp-bolagsform-row { display: flex; flex-wrap: nowrap; justify-content: center; gap: 10px; }
      @media (max-width: 900px) {
        .lp-bolagsform-row { flex-wrap: wrap; }
      }
      .lp-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; }
      .lp-footer-grid > *, .lp-features-grid > * { min-width: 0; }
      .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }

      @media (max-width: 860px) {
        .lp-nav-desktop { display: none; }
        .lp-hamburger-btn { display: flex; }
        /* Loggan (46px, uppskalad för desktop ovan) håller sig kvar på sin
           tidigare, mer kompakta mobilstorlek istället för att svälla i
           den smala mobil-headern tillsammans med hamburgerknappen. */
        nav .lp-logo-glow svg { height: 34px; width: auto; }
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
      .lp-demo-content { flex: 1; min-width: 0; padding: 20px; max-height: min(780px, 82vh); overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; background: var(--bg-page); }
      @media (max-width: 640px) {
        .lp-cta-group { flex-direction: column; }
        .lp-cta-group > button, .lp-cta-group > a { width: 100%; }
        .lp-features-grid { grid-template-columns: 1fr; }
        .lp-stat-grid { grid-template-columns: 1fr; }
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
      @media (min-width: 641px) and (max-width: 1024px) {
        .lp-features-grid { grid-template-columns: repeat(2, 1fr); }
      }
      @media (max-width: 768px) {
        .lp-footer-grid { grid-template-columns: 1fr; gap: 36px; }
        .lp-footer-bottom { flex-direction: column; text-align: center; }
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

  const handleEnterApp = () => {
    setMobileMenuOpen(false);
    if (onEnterApp) onEnterApp();
    else navigate('/', { state: { enterApp: true } });
  };

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'var(--mkt-header-bg)' : 'transparent',
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
        <div style={{ display: 'flex', alignItems: 'center', height: '76px', gap: '32px' }}>
          {/* Kundfeedback: loggan ska vara stor och tydlig på desktop (kvar
              till vänster, inte flyttad) — höjd upp i två omgångar, 38→46→
              52 (kunden tyckte fortfarande den kändes för liten, delvis för
              att den drunknade i det tomma utrymmet från maxWidth-buggen
              ovan). Navlänkarna centrerade i mellanrummet mellan logga och
              knappar (justifyContent:center tillagt) istället för att bara
              klibba fast till vänster om logon i sitt flex:1-utrymme. */}
          <Link to="/" className="lp-logo-glow" style={{ alignItems: 'center', flexShrink: 0 }} aria-label="Till startsidan">
            <BokixWordmark height={52} />
          </Link>

          <div className="lp-nav-desktop" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: '28px' }}>
            {MARKETING_PAGES.map((page, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              const isActive = location.pathname === page.to;
              return (
                <Link
                  key={page.to} to={page.to}
                  className={`lp-nav-link ${isActive ? 'active' : ''}`}
                  style={{ '--nav-accent': accent.fg, fontSize: '14px', fontWeight: 500, color: isActive ? accent.fg : 'var(--mkt-nav-text)', textDecoration: 'none', padding: '10px 0', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}
                >
                  {page.label}
                </Link>
              );
            })}
          </div>

          <div className="lp-nav-desktop" style={{ gap: '10px', alignItems: 'center' }}>
            <button onClick={onToggleTheme} aria-label={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, background: 'none', border: '1px solid var(--mkt-border-soft)', borderRadius: '9px', cursor: 'pointer', color: 'var(--mkt-nav-text)' }}>
              {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <button className="lp-btn-secondary" onClick={handleEnterApp} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid var(--mkt-border-soft)', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--mkt-nav-text)', fontFamily: 'inherit', minHeight: '44px' }}>
              Logga in
            </button>
            <button className="lp-btn-primary" onClick={handleEnterApp} style={{ padding: '11px 18px', background: BRAND.green, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 4px 15px -3px rgba(61,122,46,0.35)', minHeight: '44px' }}>
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
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="lp-logo-glow" aria-label="Till startsidan"><BokixWordmark height={32} /></Link>
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
          <button onClick={handleEnterApp} style={{ padding: '14px', background: 'transparent', border: '1px solid var(--mkt-border-soft)', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: 'var(--mkt-nav-text)', fontFamily: 'inherit' }}>
            Logga in
          </button>
          <button onClick={handleEnterApp} style={{ padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>
            Kom igång
          </button>
        </div>
      </div>
    </>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: '#0e2018', padding: '56px 24px 28px', color: 'rgba(255,255,255,0.6)' }}>
      <div className="lp-footer-grid" style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '48px' }}>
        <div style={{ maxWidth: '300px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Link to="/" className="lp-logo-glow" aria-label="Till startsidan"><BokixWordmark height={30} /></Link>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
            Bokföring, enkelt. Du växer.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Produkt</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['Funktioner', '/funktioner'], ['Priser', '/priser']].map(([label, to]) => (
              <Link key={to} to={to} className="lp-footer-link" style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Företag</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['Om oss', '/om-oss'], ['Kontakt', '/kontakt']].map(([label, to]) => (
              <Link key={to} to={to} className="lp-footer-link" style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Juridiskt</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { title: 'Integritetspolicy', to: '/privacy' },
              { title: 'Användarvillkor', to: '/terms' },
              { title: 'Cookiepolicy', to: '/cookies' },
            ].map(link => (
              <Link key={link.to} to={link.to} className="lp-footer-link" style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>
                {link.title}
              </Link>
            ))}
            {/* Öppnar CookieBanner.jsx igen (monterad globalt i App.jsx) via
                ett DOM-event — den här knappen och bannern delar annars
                ingen komponentförälder att skicka state genom. */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('bokix-open-cookie-prefs'))}
              className="lp-footer-link"
              style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cookieinställningar
            </button>
          </div>
        </div>
      </div>

      <div className="lp-footer-bottom" style={{ maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          © {year} Bokix. Alla rättigheter förbehållna.
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
export default function MarketingLayout({ onEnterApp, children, title, description, path }) {
  const [theme, toggleTheme] = useMarketingTheme();
  // title/description/path: valfria — sätts av varje undersida (se
  // useDocumentMeta.js) så titel/beskrivning/OG-taggar matchar den
  // faktiska sidan istället för att alla undersidor visar startsidans
  // <head>-taggar från index.html i sökträffar och delningskort.
  useDocumentMeta({ title, description, path });
  return (
    <div id="lp-root" data-theme={theme} style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: 'var(--mkt-heading)', background: 'var(--mkt-page-bg)', overflowX: 'hidden' }}>
      <MarketingStyles />
      <MarketingHeader onEnterApp={onEnterApp} theme={theme} onToggleTheme={toggleTheme} />
      {children}
      <MarketingFooter />
    </div>
  );
}
