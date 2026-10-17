import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, X,
  ArrowRight, ChevronRight,
} from './icons';
import { BRAND } from '../utils/brandColors';
import MarketingLayout, { Reveal } from './marketing/MarketingLayout';
import ToolMotif, { ToolMotifStyles } from './marketing/toolMotifs';
import { FeatureDemoStyles, DemoBokforing, DemoFakturering, DemoSkatt, DemoPersonal } from './marketing/featureDemos';
import { SERIF, INK, INK_SOFT, MUTED, CARD_BORDER, ACCENT, ACCENT_CYCLE } from './marketing/marketingTokens';
import CloudShaderBackground from './marketing/CloudShaderBackground';
import { GRAD, grad } from './marketing/aurora';
import { StripeLogo, ZettleLogo, BolagsverketLogo, SkatteverketLogo } from './shared/BrandLogos';
import MigrationFlow from './marketing/MigrationFlow';
import BankFlow from './marketing/BankFlow';
import ReceiptFlow from './marketing/ReceiptFlow';
import { PRICING_TIERS } from './marketing/pricingTiers';
import { PageMeta, JsonLd, SITE_URL } from '../utils/seo';
import { FAQ_SCHEMA, FAQ_TOP } from './marketing/faqData';
import { LANDING_CONTENT } from '../content/marketing/landing';
import { BOKIX_FEATURES, BOKIX_PROFILES } from '../content/marketing/bokixFacts';
// Lazy: DemoWorkspace monterar en RIKTIG kopia av hela den inloggade
// appens komponentträd (Dashboard, Invoices, Bokföring, Skatt, m.fl.) för
// den interaktiva produktdemon längre ner på sidan (utanför den första
// skärmen). Statiskt importerad tvingade den in samma tunga bunt även
// för en besökare som aldrig scrollar dit — se App.jsx för samma
// resonemang kring den inloggade appens egna flikar.
const DemoWorkspace = lazy(() => import('./DemoWorkspace'));

// ── Faktiska bolagsformer Bokix kan identifiera/bokföra för (se
// src/utils/orgType.js) — inte en påhittad lista. Själva namnen bor numera
// per språk i content/marketing/landing.js (companyTypes), eftersom de
// engelska/norska/danska/finska sidorna beskriver dem med den officiella
// svenska termen i parentes (t.ex. "Limited company (aktiebolag, AB)")
// snarare än en 1:1-översättning — se filkommentaren där. ──

// Funktionskorten glider in efter rubriken: första kortet så här många ms
// efter att sektionen syns, sedan ett i taget med kort mellanrum.
const CARD_DELAY_MS = 320;
const CARD_STAGGER_MS = 110;

// ── Fyra kolumner, matchat mot appens faktiska huvudsektioner (se globala
// sidomenyn i App.jsx) — varje kort får en egen handritad illustration
// istället för samma enfärgade gröna chip fyra gånger. ──
const FEATURE_COLUMNS = [
  {
    demo: DemoBokforing, title: 'Bokföring', g: ACCENT.green,
    desc: 'Kvitton och fakturor blir verifikationer av sig själva. Det osäkra hamnar i Granskning i stället för att gissas.',
  },
  {
    demo: DemoFakturering, title: 'Fakturering', g: ACCENT.blue,
    desc: 'Fyra mallar, din logotyp, kortbetalning via Stripe.',
  },
  {
    demo: DemoSkatt, title: 'Skatt och bokslut', g: ACCENT.red,
    desc: 'Moms, AGI och ett bokslut som låser året.',
  },
  {
    demo: DemoPersonal, title: 'Personal', g: ACCENT.green,
    desc: 'Rätt skatteavdrag, lönebesked och betalfil till banken.',
  },
];


// Prisdata delad med PricingPage.jsx (se pricingTiers.js för resonemanget
// kring axeln/priset/den korrigerade "ingen bankkoppling"-texten) — en
// enda källa så de två sidorna aldrig kan glida isär, samma princip som
// FAQ_SCHEMA nedan redan följer.

// ── Riktiga tjänster/myndigheter Bokix faktiskt pratar med, inte en
// påhittad partnerlista. Stripe/Zettle: riktiga "Anslut X"-integrationer
// (se knapparna i Settings.jsx). Bolagsverket: en riktig datakoppling
// (FöretagsAPI-uppslaget i useCompanyLookup.js, körs redan vid konto-
// skapande). Skatteverket: Bokix bygger deras eget eSKD-filformat
// (vatDeclarationExport.js) som laddas upp manuellt på skatteverket.se.
// Kundbeslut — deras EGNA logotyper nu (BrandLogos.jsx), inte längre bara
// ikon+text; kunden skickade bilderna och stod fast vid det efter att
// avvägningen (antyder det ett officiellt partnerskap?) lagts fram. Kräver
// att bolagsverket-logo.png/skatteverket-logo.png faktiskt sparas i
// public/ — se BrandLogos.jsx.
// Två spalter, inte en hub-och-eker (se filkommentaren vid sektionen som
// använder de här) — "group" är vilken av de två kolumnerna (Betalningar/
// Myndigheter) kopplingen hör till, ordningen inom varje kolumn är
// ordningen i den här listan.
// Kundönskemål (2026-09-22, andra passet, "loggorna ser fortfarande
// small/svaga ut"): höjda igen (denna gång i en egen vit platta, se
// .lp-conn-badge) och samma inbördes balans mellan breda ordmärken
// (Stripe/Zettle) och smalare märken (Bolagsverket/Skatteverket) bevarad —
// höjdtalen är avvägda mot varandra, inte satta till samma tal.
const CONNECTIONS = [
  { key: 'stripe', kind: 'logo', Logo: StripeLogo, logoHeight: '34px', label: 'Kortbetalning och försäljning', group: 'Betalningar' },
  { key: 'zettle', kind: 'logo', Logo: ZettleLogo, logoHeight: '38px', label: 'Kassaförsäljning', group: 'Betalningar' },
  { key: 'bolagsverket', kind: 'logo', Logo: BolagsverketLogo, logoHeight: '48px', label: 'Företagsuppslag', group: 'Myndigheter' },
  { key: 'skatteverket', kind: 'logo', Logo: SkatteverketLogo, logoHeight: '48px', label: 'Rätt filformat', group: 'Myndigheter' },
];
const CONNECTION_GROUPS = ['Betalningar', 'Myndigheter'];

// TRUST_POINTS (bokföringslag/GDPR/BAS-badgarna) borttagen härifrån
// 2026-09-22, tredje passet — se kommentaren vid f.d. TROVÄRDIGHETSRADEN
// nedan för var påståendena bor i stället. BokforingslagLogo/GdprLogo/
// BasLogo-komponenterna finns kvar i BrandLogos.jsx om de behövs där.


// ── Sex delar av verktyget, med var sin rörelse ─────────────────────────
// Här stod tidigare sex LÖFTEN: "Mindre fel, mer tid", "Full insyn, i
// realtid", "Byggt för att alltid bli rätt". Kundens invändning i sak: de
// säger ingenting. Och det sista påstod dessutom "Sveriges mest robusta
// bokföringslogik" — ett superlativ vi inte kan belägga, alltså precis
// den sorts mening sajten i övrigt vägrar skriva.
//
// Nu är det sex namngivna delar av appen i stället, var och en med samma
// motiv som /funktioner använder (toolMotifs.jsx) — en rörelse som visar
// vad delen gör, och en rad text. Delade motiv betyder också att sidorna
// inte kan glida isär: ändrar man bilden ändras den på båda ställena.
//
// Banken har en egen sektion längre ner på sidan och är därför inte med
// här — den skulle bli en dubblett två skärmar isär.
const TOOL_ITEMS = [
  { motif: 'kvitton', title: 'Utgifter och kvitton', desc: 'Fota eller ladda upp kvittot, så läser OCR:en av datum, belopp och moms åt dig. Underlaget sitter kvar på verifikationen.' },
  { motif: 'offerter', title: 'Offerter', desc: 'Blir faktura med ett klick när kunden tackat ja.' },
  { motif: 'projekt', title: 'Projekt', desc: 'Se vilket uppdrag som faktiskt bär sig.' },
  { motif: 'kunder', title: 'Kunder och kontakter', desc: 'Fylls i från organisationsnumret.' },
  { motif: 'rapporter', title: 'Rapport och analys', desc: 'Resultat, balans, kassaflöde, huvudbok, nyckeltal.' },
  { motif: 'konto', title: 'Konto och behörighet', desc: 'Tvåfaktor, tre användare, flera företag.' },
];;

// Kundönskemål ("en färg, inte olika") — FAQ-raderna cyklade tidigare
// grönt/blått/turkos/rött (g-fältet per rad). En enda genomgående accent
// (ACCENT.green, samma som "Skapa konto"-knapparna och bockarna i
// prissektionen ovanför) håller listan lugn istället för brokig, och gör
// samma tanke som borttagningen av prissektionens "Inga tillägg"-badge:
// mindre dekoration som inte bär egen information.
const FAQ_ACCENT = ACCENT.green;

// FAQ_SCHEMA flyttad till egen fil (marketing/faqData.js) — delas nu med
// den nya /vanliga-fragor-sidan (FaqPage.jsx). FAQ_ITEMS/FaqItem-
// accordionen renderas inte längre här (se sektionens egen kommentar
// nedan) — bara schemat (JsonLd, för sökmotorer) är kvar från den filen.

// Kundönskemål (2026-09-22): FAQ-sektionen hade bara länken ut, inga
// frågor syntes. Tre av de viktigaste (bokföringsvana, pris, gratis provperiod)
// ur FAQ_TOP, samma text som /vanliga-fragor. Bara sv (samma begränsning som
// FAQ_SCHEMA ovan, se dess kommentar).
const FAQ_TEASER_PREVIEW = [FAQ_TOP[0].q, FAQ_TOP[2].q, FAQ_TOP[3].q];

// Organization-schema (Sida: AI:er/Google blandar ibop Bokix med Bokio i
// sökningar/svar — se konversationen där det här lades till). Det här är
// den enda platsen som faktiskt hjälper mot det: en tydlig, komplett
// entitetspost (namn, logga, beskrivning) är precis det Googles
// Knowledge Graph och en AI med live-websökning använder för att slå
// fast VEM Bokix är, i stället för att gissa utifrån brödtexten. En
// tränad språkmodells egen kunskap går inte att ändra i efterhand — det
// här hjälper bara sökningar/svar som faktiskt hämtar sidan på nytt.
//
// `sameAs` (länkar till LinkedIn/Instagram/Trustpilot/etc., samma
// mekanism Wikipedia-infoboxar bygger på) SAKNAS ännu — kunden har några
// profiler men har inte skickat länkarna än. Lägg till dem i arrayen så
// fort de finns; en tom/utelämnad sameAs är helt ofarlig (schema.org
// kräver den inte), men gör den här posten svagare än den kunde vara.
function buildOrganizationSchema(description) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: 'Bokix',
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    description,
    sameAs: BOKIX_PROFILES,
  };
}

// SoftwareApplication-schema för startsidan — samma produkt som
// PricingPage.jsx beskriver, men med url satt till startsidan så
// crawlers/AI-svarsmotorer som landar på "/" (den mest lästa sidan) också
// får ett strukturerat pris istället för att behöva gissa det ur brödtexten.
// AggregateOffer byggd direkt från PRICING_TIERS (samma mönster som
// PricingPage.jsx) — stod tidigare som en enda Offer på 179 kr, vilket
// blev fel/ofullständigt så fort en andra, billigare nivå (129 kr) fanns.
function buildSoftwareSchema(description) {
  return {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  '@id': `${SITE_URL}/#software`,
  name: 'Bokix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description,
  // Kopplar ihop de två posterna — samma "vem gör det här" som Google
  // annars hade fått gissa sig till separat för produkten kontra företaget.
  provider: { '@id': `${SITE_URL}/#organization` },
  featureList: BOKIX_FEATURES,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: String(Math.min(...PRICING_TIERS.map((t) => t.price))),
    highPrice: String(Math.max(...PRICING_TIERS.map((t) => t.price))),
    priceCurrency: 'SEK',
    offerCount: String(PRICING_TIERS.length),
    offers: PRICING_TIERS.map((t) => ({
      '@type': 'Offer',
      name: t.name,
      price: String(t.price),
      priceCurrency: 'SEK',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: String(t.price),
        priceCurrency: 'SEK',
        unitText: 'MON',
        // true, inte false: Bokix är inte momsregistrerat, så ingen moms
        // läggs på i checkouten (api/stripe/create-subscription-checkout.js
        // sätter varken tax_behavior eller automatic_tax). Priset ÄR alltså
        // slutbeloppet. `false` skulle säga åt Google och AI-svarsmotorer
        // att räkna upp det med 25 % och visa ett pris kunden aldrig betalar.
        valueAddedTaxIncluded: true,
      },
    })),
  },
  };
}

/** PRODUKTVISNING som EGEN yta, inte ett skrolla-till-avsnitt i sidflödet
 * (kundönskemål: "visa den som en egen sektion, bara synlig när man
 * trycker Demo"). En riktig lightbox ovanpå resten av sidan — Esc,
 * bakgrundsklick eller krysset stänger den, body-skrollen låses medan den
 * är öppen (samma mönster som mobilmenyns overflow-lås i
 * MarketingHeader). DemoWorkspace.jsx monterar de RIKTIGA appkomponenterna
 * med ett lokalt exempeldataset — lazy() + Suspense här (inte RevealLazy,
 * som styrs av scrollposition) eftersom synlighet nu helt avgörs av att
 * overlayen är öppen, inte av var i dokumentet man skrollat till. */
const SV_DEMO_LABELS = { ariaLabel: 'Produktdemo', title: 'Demo', sampleData: 'Exempeldata', close: 'Stäng demo' };

function DemoOverlay({ onClose, initialTab, labels = SV_DEMO_LABELS }) {
  const panelRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="lp-demo-overlay" role="dialog" aria-modal="true" aria-label={labels.ariaLabel}>
      <div className="lp-demo-overlay-backdrop" onClick={onClose} aria-hidden />
      <div className="lp-demo-overlay-panel" ref={panelRef} tabIndex={-1}>
        <div className="lp-demo-overlay-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <BarChart3 size={16} color={BRAND.green} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--mkt-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{labels.title}</span>
          </div>
          {/* "Exempeldata" satt tidigare inne i demons egen topbar, som en
              rad ovanför varje sidas rubrik — kundönskemål att ta bort den
              därifrån. Upplysningen får inte försvinna helt (ingen ska tro
              att siffrorna är en riktig bokföring), så den ligger nu här i
              demons rubrikrad i stället: utanför app-ytan, syns hela tiden,
              stör inget innehåll. */}
          <span style={{ marginLeft: 'auto', marginRight: '12px', flexShrink: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mkt-muted)' }}>{labels.sampleData}</span>
          <button className="lp-demo-overlay-close" onClick={onClose} aria-label={labels.close}>
            <X size={18} />
          </button>
        </div>
        <div className="lp-demo-overlay-body">
          <Suspense fallback={<div style={{ minHeight: '480px' }} />}>
            <DemoWorkspace initialTab={initialTab} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onEnterApp, locale = 'sv' }) {
  const c = LANDING_CONTENT[locale] || LANDING_CONTENT.sv;

  // Kundönskemål: produktvisningen (DemoWorkspace) ska inte ligga inline i
  // sidflödet längre — bara visas, som en EGEN fristående yta (lightbox,
  // se DemoOverlay ovan), när besökaren faktiskt trycker "Se demo" i Hero.
  // Stängs igen via krysset/Esc/bakgrundsklick i overlayen; fokus flyttas
  // tillbaka till knappen som öppnade den (demoTriggerRef) så tangentbords-
  // /skärmläsarnavigeringen inte tappar sin plats.
  // `showDemo`: false = stängd, annars vilken flik den ska öppnas på —
  // så samma overlay kan öppnas rakt in på Kvitton-fliken från "Kvitton
  // läser sig själva"-sektionen, inte bara på Startsidan som Hero-knappen
  // öppnar den på.
  const [showDemo, setShowDemo] = useState(false);
  const demoTriggerRef = useRef(null);
  const openDemo = (tab = 'dashboard') => setShowDemo(tab);
  const closeDemo = useCallback(() => {
    setShowDemo(false);
    demoTriggerRef.current?.focus();
  }, []);

  return (
    <MarketingLayout onEnterApp={onEnterApp}>
      <PageMeta
        title={c.meta.title}
        description={c.meta.description}
        path={locale === 'sv' ? '/' : `/${locale}`}
        basePath="/"
        locale={locale}
      />
      <JsonLd data={buildOrganizationSchema(c.schema.orgDescription)} />
      <JsonLd data={buildSoftwareSchema(c.schema.softwareDescription)} />
      {/* FAQ_SCHEMA (faqData.js) är bara skriven på svenska ännu — visas
          därför bara på den svenska sidan tills /vanliga-fragor själv får
          en översatt variant (Fas 2, se plan-dokumentet). Ett FAQPage-
          schema på engelska/norska/danska/finska sidor som i själva verket
          innehåller svenska frågor vore fel signal till Google/AI-
          svarsmotorer, värre än att bara utelämna det. */}
      {locale === 'sv' && <JsonLd data={FAQ_SCHEMA} />}
      <ToolMotifStyles />
      <FeatureDemoStyles />

      {/* ── HERO — levande gradientklot i loggans/Startsidans egna färger
          bakom en fetstilt rubrik, inget stillastående platt fält. ── */}
      <section style={{ display: 'flex', alignItems: 'center', background: 'var(--mkt-ivory)', position: 'relative', overflow: 'hidden', paddingTop: '140px', paddingBottom: '72px' }}>
        {/* Original returnerar en position:relative-wrapper (matchar
            Aceternitys egen API-yta) — här behöver den istället fylla
            hela Hero-sektionen som ett bakgrundslager, samma inset:0-
            mönster som blobbarna redan använder. */}
        <CloudShaderBackground style={{ position: 'absolute', inset: 0, minHeight: 0 }} />
        <div aria-hidden className="lp-blob" style={{ position: 'absolute', top: '-160px', left: '-120px', width: '440px', height: '440px', borderRadius: '50%', background: grad(GRAD.blueTeal), opacity: 0.16, filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div aria-hidden className="lp-blob lp-blob-slow" style={{ position: 'absolute', top: '-100px', right: '-140px', width: '480px', height: '480px', borderRadius: '50%', background: grad(GRAD.green), opacity: 0.16, filter: 'blur(70px)', pointerEvents: 'none' }} />
        {/* Kundönskemål: bort med den röda tonen i Hero. Här låg ett
            tredje klot i GRAD.pink (Dashboards kostnadsgradient) — det
            syntes som ett rödrosa skimmer längst ner i hjälten, och rött
            är dessutom reserverat för kostnads-/varningsinnehåll på resten
            av sajten (se GRAD-kommentaren i aurora.jsx). Hjälten har nu
            bara loggans egna blå/turkos och grönt. */}

        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 24px', textAlign: 'center', position: 'relative' }}>
          <h1 className="lp-fadeinup" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(36px, 7vw, 84px)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.01em', color: 'var(--mkt-ink)', marginBottom: '26px' }}>
            {/* Mellanslaget före <br />: utan det läses rubriken ihop till
                "bokföringska" av sökmotorer som ignorerar radbrytningen. */}
            {c.hero.titlePrefix}{' '}<br />{c.hero.titleSuffix}
            <em className="lp-gradient-text" style={{ fontStyle: 'italic', backgroundImage: 'linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16, #0ea5e9)' }}>{c.hero.titleEm}</em>
          </h1>

          <p className="lp-fadeinup lp-delay-1" style={{ fontSize: 'clamp(18px, 1.6vw, 21px)', color: INK_SOFT, lineHeight: 1.7, maxWidth: '600px', fontWeight: 400, margin: '0 auto 40px' }}>
            {c.hero.subtitle}
          </p>

          <div className="lp-fadeinup lp-delay-2 lp-cta-group" style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <span className="lp-moving-border-wrap">
              <button className="lp-btn-primary" onClick={() => onEnterApp('signup')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '18px 34px', background: BRAND.green, border: 'none', borderRadius: '13px', fontSize: '17px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 10px 26px -8px rgba(11,99,41,0.5)', minHeight: '48px' }}>
                {c.hero.ctaPrimary} <ArrowRight size={18} />
              </button>
            </span>
            <button ref={demoTriggerRef} className="lp-btn-secondary" onClick={() => openDemo()} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '18px 30px', background: 'var(--mkt-card-bg)', border: '1.5px solid var(--mkt-border-soft)', borderRadius: '13px', fontSize: '17px', fontWeight: 600, cursor: 'pointer', color: 'var(--mkt-ink-soft)', fontFamily: 'inherit', minHeight: '48px' }}>
              {c.hero.ctaSecondary} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FUNKTIONSÖVERSIKT — direkt efter nyckeltalen. ── */}
      <section id="funktioner-teaser" style={{ padding: '84px 24px', background: 'var(--mkt-card-bg)', borderTop: '1px solid var(--mkt-border-soft)', borderBottom: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        {/* Ren vit bakgrund utan räkenskapslinjer (kundönskemål 2026-09-29).
            Bredden: en FAST maxWidth ("gör den bredare") löser bara
            problemet vid EN specifik fönsterbredd — bredare än det ser det
            fortfarande tomt ut, smalare än det klipps det i onödan.
            min(vw, px) håller innehållet proportionellt mot den FAKTISKA
            fönsterbredden hela vägen (bra på halv skärm OCH helskärm),
            med px-talet bara som ett tak för orimligt breda skärmar.
            Samma mönster rakt igenom hela filen från och med nu. */}
        <div style={{ maxWidth: 'min(92vw, 1600px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--mkt-ink)', marginBottom: '16px' }}>
              {c.features.heading}
            </h2>
            <p style={{ fontSize: '17px', color: 'var(--mkt-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              {c.features.subheading}
            </p>
          </Reveal>

          {/* Bento-layout — Bokföring (kärnan i produkten) som ett brett
              flaggskeppskort ovanför, de tre andra som jämnstora kort
              under. Samma lp-lux-card-hover (lyft+skugga) som resten av
              sidan, ingen färgad muspekar-glöd (borttagen på
              kundönskemål). */}
          {/* Rubriken kommer först, korten strax efter och ett i taget
              (kundönskemål 2026-09-29). Kort väntan: ingen ska behöva sitta
              och vänta på att innehållet dyker upp. */}
          <div className="lp-bento-grid">
            {FEATURE_COLUMNS.map((f, i) => (
              i === 0 ? (
                <Reveal
                  key={f.title} delay={CARD_DELAY_MS}
                  className="lp-lux-card lp-bento-feature-full lp-bento-feature-row"
                  style={{ background: 'var(--mkt-card-bg)', border: '1px solid var(--mkt-card-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 14px 30px -20px rgba(28,36,32,0.26)', display: 'flex', alignItems: 'stretch' }}
                >
                  {/* Illustrationsspalten och texten storleksökta (kund-
                      önskemål: flaggskeppskortet såg glest ut på breda
                      skärmar — en 300px-bred bild i ett 1600px-brett kort
                      lämnade orimligt mycket tom yta runt en kort
                      textrad).
                      Kundfeedback (mobil, skärmdump): samma rad-layout
                      kvarstod rakt av på mobilen — bilden klämdes in i en
                      42%-bred remsa (drygt 160px) bredvid texten, för smalt
                      för att demots egna rader (ikon + etikett + tagg) ska
                      få plats, så de klipptes/syntes inte alls. Klassen
                      lp-bento-feature-row byter till kolumn under 640px
                      (se @media i MarketingLayout.jsx) — bilden får då HELA
                      kortets bredd i stället, samma bredd som texten under. */}
                  <div className="lp-bento-feature-media" style={{ background: f.g.soft, width: 'min(420px, 42%)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(20px, 3vw, 32px)' }}>
                    <f.demo />
                  </div>
                  <div style={{ padding: '36px 40px 36px 34px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '25px', fontWeight: 700, color: 'var(--mkt-ink)', marginBottom: '10px' }}>{c.features.items[i]?.title || f.title}</h3>
                    <p style={{ fontSize: '16px', color: 'var(--mkt-muted)', lineHeight: 1.65, maxWidth: '560px' }}>{c.features.items[i]?.desc || f.desc}</p>
                  </div>
                </Reveal>
              ) : (
                <Reveal
                  key={f.title} delay={CARD_DELAY_MS + i * CARD_STAGGER_MS}
                  className="lp-lux-card"
                  style={{ background: 'var(--mkt-card-bg)', border: '1px solid var(--mkt-card-border)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 14px 30px -20px rgba(28,36,32,0.26)' }}
                >
                  {/* Fast höjd, inte minHeight: de tre demona är olika
                      höga (fyra momsrutor mot tre lönerader), och utan ett
                      tak hamnade rubrikerna på olika nivå i de tre korten. */}
                  <div style={{ background: f.g.soft, height: '218px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '22px' }}>
                    <f.demo />
                  </div>
                  <div style={{ padding: '26px 26px 30px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--mkt-ink)', marginBottom: '9px' }}>{c.features.items[i]?.title || f.title}</h3>
                    <p style={{ fontSize: '14.5px', color: 'var(--mkt-muted)', lineHeight: 1.6 }}>{c.features.items[i]?.desc || f.desc}</p>
                  </div>
                </Reveal>
              )
            ))}
          </div>

          <Reveal style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14.5px', fontWeight: 700, color: BRAND.green, textDecoration: 'none' }}>
              {c.features.allLink} <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── BOLAGSFORMER — oändligt rullande rad istället för en statisk
          radbruten lista (se .lp-marquee/.lp-marquee-track i
          MarketingLayout.jsx). Listan dubblerad exakt en gång (inte fler)
          — -50% translateX landar prickar på var kopia 2 börjar, sömlöst.
          Pausar vid hover/tangentbordsfokus så den går att läsa. ── */}
      {/* Ren vit yta: här låg tidigare två tonade aurora-klot OCH en 160px
          hög blå vågdelare direkt under. Två färgeffekter i rad kring en rad
          som bara räknar upp bolagsformer — raden är innehållet, resten var
          dekor som konkurrerade med den. Hårfina linjer skiljer sektionerna
          åt i stället. */}
      <section style={{ padding: '64px 24px 72px', background: 'var(--mkt-section-mint)', borderBottom: `1px solid var(--mkt-border-soft)`, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '28px' }}>
            {c.companyTypesHeading}
          </h2>
        </Reveal>
        <Reveal scale className="lp-marquee" tabIndex={0} aria-label="Bolagsformer Bokix stödjer" style={{ position: 'relative' }}>
          <div className="lp-marquee-track">
            {[0, 1, 2, 3].map((copy) => (
              c.companyTypes.map((label, i) => {
                const accent = ACCENT_CYCLE[i % 3];
                // Bolagsformer med egen sida blir länkar (bara första kopian
                // av raden är nåbar med tabb, resten är dekor för rullningen).
                const to = c.companyTypeLinks?.[label];
                const Badge = to ? Link : 'div';
                return (
                  <Badge key={`${label}-${copy}`} {...(to ? { to, tabIndex: copy > 0 ? -1 : undefined } : {})} aria-hidden={copy > 0} className="lp-lux-card lp-marquee-badge" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '100px', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                    {/* En liten prick i accentfärgen i stället för en ikon:
                        den håller kvar färgrytmen i raden utan att påstå att
                        en symbol betyder "handelsbolag". */}
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: accent.fg, flexShrink: 0 }} />
                    <span className="lp-marquee-badge-label" style={{ fontSize: '14px', fontWeight: 600, color: INK_SOFT }}>{label}</span>
                  </Badge>
                );
              })
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── VAD DU FAKTISKT GÖR — kundönskemål: sluta jämföra mot konkurrenter,
          förklara vad man FÅR istället (se BENEFIT_ITEMS-kommentaren högst
          upp för resonemanget). Sex kort i samma lp-lux-card-språk som
          resten av sidan, ingen "vi vs dem"-tabell längre.
          Rubriken bytt (2026-09-22, andra passet) från "Det här får du med
          Bokix / Sex delar av verktyget" — kundens invändning: numrerings-
          känslan ("sex delar") och den sälj-vinklade rubriken. Nu en rakare
          rubrik på vad man FAKTISKT gör i verktyget, samma "hur ser
          produkten faktiskt ut"-ton som resten av sidan.
          Bakgrund: --mkt-section-mint, se tokenkommentaren i
          MarketingLayout.jsx för varför (kort: ersätter en varm beige/
          elfenbenston som varken matchade det kalla blå/turkos/lime-
          varumärket eller läste som annat än ett generiskt AI-sidmönster). */}
      <section style={{ padding: '84px 24px 92px', background: 'var(--mkt-section-mint)', position: 'relative', overflow: 'hidden' }}>
        {/* Solid bakgrund, utan räkenskapslinjer och färgad kantlist
            (kundönskemål 2026-09-29). */}
        <div style={{ maxWidth: 'min(92vw, 1600px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              {c.benefits.heading}
            </h2>
            <p style={{ fontSize: '17px', color: MUTED, maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              {c.benefits.subheading}
            </p>
          </Reveal>

          {/* minmax-golvet höjt (300→400px) i takt med den bredare
              behållaren ovan — annars bryter auto-fit till 4-5 kolumner på
              breda skärmar och lämnar sex kort som 4+2 istället för 3+3. */}
          <div className="bx-tool-grid bx-tool-grid-3" style={{ maxWidth: 'min(92vw, 1320px)', margin: '0 auto' }}>
            {TOOL_ITEMS.map((b, i) => (
              <Reveal key={b.title} delay={CARD_DELAY_MS + i * CARD_STAGGER_MS} className="lp-lux-card" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', padding: '20px 22px 24px', boxShadow: '0 18px 38px -26px rgba(28,36,32,0.4)' }}>
                <ToolMotif kind={b.motif} />
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: INK, marginBottom: '7px' }}>{c.benefits.items[i]?.title || b.title}</h3>
                <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{c.benefits.items[i]?.desc || b.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TROVÄRDIGHETSRADEN TOGS BORT HÄRIFRÅN (2026-09-22, tredje passet)
          — kundönskemål: "bygg efter svensk bokföringslag / GDPR / BAS-
          kontoplan" hör hemma någon annanstans, inte på startsidan. Inget
          flyttades i praktiken — alla tre påståendena finns redan, med mer
          sammanhang, på sidorna de faktiskt handlar om: BAS-kontoplanen på
          /funktioner ("Full kontoplan (BAS) med sökbara konton"), GDPR på
          /sakerhet (PUB-avtal enligt artikel 28), svensk bokföringslag på
          /byt-bokforingsprogram (arkivering/övergång). ── */}

      {/* ── KOPPLAT TILL — bytt ut mot två spalter (2026-09-22).
          Kundfeedback (utomstående: "ser vibe-codat/AI-genererat ut") pekade
          rakt på den här sektionens gamla form: en central logga med en
          mjukt pulserande glöd och böjda linjer ut till fyra runda noder —
          det exakta "hub-diagram"-mönstret som numera är själva
          signaturbilden för en AI-genererad SaaS-sida, oavsett hur äkta
          kopplingarna bakom är. Formen var dessutom ett tidigare
          kundönskemål (skickade referensbilder på just den sortens diagram
          från andra sajter) — bytt nu mot något som kommer ur ämnet
          självt i stället för ett importerat mönster.
          De fyra kopplingarna är äkta (Stripe/Zettle-loggor,
          Bolagsverket/Skatteverket, se CONNECTIONS-kommentaren högst upp)
          och delar sig redan naturligt i två sorter: PENGAR (Stripe/Zettle)
          och PAPPER (Bolagsverket/Skatteverket) — exakt bokföringens egen
          tvåkolumns-idé (debet | kredit, två sidor som ska stämma), inte en
          gissning. Två spalter med en tunn linje mellan är alltså både
          enklare att bygga och mer sant mot vad Bokix faktiskt gör: sitter
          mellan pengarna som rör sig och papperen som ska stämma.
          Ingen SVG, inget koordinatsystem att hålla i synk — CSS Grid
          faller själv ihop till en spalt på smal skärm (se .lp-conn-grid,
          MarketingLayout.jsx), ingen egen media query behövs här.
          Bakgrund (2026-09-22, femte passet): kundönskemål — HELT vit, inget
          blått kvar alls. Fjärde passet bytte den fasta bakgrundsfärgen till
          vit men lämnade kvar AuroraLayer-tomingen (mjuka blå/turkosa
          glöd-klot i hörnen) som fortfarande läste som "blått i sektionen".
          Den är nu borttagen — ingen dekor kvar här, bara vitt.
          Sjätte passet: bytt från bokstavligt '#ffffff' till
          var(--mkt-page-bg) — kundönskemål "behöver se bra ut i mörkt
          tema" också. Ett hårdkodat vitt hade blivit en lysande vit platta
          mitt i den annars mörkgröna sidan i mörkt läge; page-bg är samma
          vitt i ljust läge (oförändrat resultat där) men matchar sidans
          mörkgröna botten i mörkt läge i stället. ── */}
      <section style={{ padding: '76px 24px', background: 'var(--mkt-page-bg)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              {c.connections.heading}
            </h2>
            <p style={{ fontSize: '17px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
              {c.connections.subheading}
            </p>
          </Reveal>

          <Reveal delay={80} className="lp-conn-grid">
            {CONNECTION_GROUPS.map(group => (
              <div className="lp-conn-col" key={group}>
                <div className="lp-conn-col-label">{c.connections.groups?.[group] || group}</div>
                {CONNECTIONS.filter(conn => conn.group === group).map(conn => (
                  <div className="lp-conn-row" key={conn.key}>
                    {/* Kundönskemål (2026-09-22, andra passet): "loggorna är
                        små, de ser inte bra ut" — trots att förra passet
                        redan höjde logoHeight ~40%. Roten var inte bara
                        pixelhöjden: en bar logga direkt på den tonade
                        bakgrunden hade inget eget stopp för ögat. Samma
                        vita, ramade platta som trovärdighetsraden redan
                        fick godkänt för (se den sektionen) ger var logga
                        en egen yta att stå på i stället — det är plattan,
                        inte bara storleken, som ger "distinction". */}
                    <span className="lp-conn-badge"><conn.Logo height={conn.logoHeight} /></span>
                    <span className="lp-conn-name">{c.connections.labels[conn.key] || conn.label}</span>
                  </div>
                ))}
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── KVITTON LÄSER SIG SJÄLVA (kundönskemål, uttryckligt: OCR:n ska
          synas på startsidan som en egen "super cool" animation, inte bara
          nämnas i en textrad) — placerad direkt före bankanimationen, så
          de två "så här funkar det på riktigt"-sektionerna följer på
          varandra: kvittot in, banken in. Animationen bor i
          marketing/ReceiptFlow.jsx, egen fil eftersom den inte delas med
          någon hjälte-sektion (till skillnad från Bank-/MigrationFlow).
          Knappen länkar till en EGEN sida (/verktyg/skanna-kvitto,
          ScanReceiptPage.jsx), inte till produktdemon — kundönskemål,
          uttryckligt: en fristående sida där besökaren laddar upp ett
          RIKTIGT eget kvitto och får RIKTIGA värden tillbaka, i stället
          för att öppna hela app-demot med exempeldata. Samma
          utils/ocrReceipt.js som Expenses.jsx, ingen egen kopia. ── */}
      <section style={{ padding: '76px 24px', background: 'var(--mkt-page-bg)', borderTop: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '38px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              {c.receipts.heading}
            </h2>
            <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.65, maxWidth: '620px', margin: '0 auto' }}>
              {c.receipts.subheading}
            </p>
          </Reveal>

          <Reveal scale delay={80}>
            <ReceiptFlow />
          </Reveal>

          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '30px' }}>
            <Link
              to="/verktyg/skanna-kvitto"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
            >
              {c.receipts.cta} <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── BANKEN (kundönskemål: "en sektion om hur man kopplar sin bank,
          med bankernas loggor och en cool animation") — placerad direkt
          efter "Kopplat till", eftersom den besvarar den naturliga
          följdfrågan på det diagrammet: "okej, men hur kommer mina
          BANKrader in?". Animationen bor i marketing/BankFlow.jsx, delad
          med hjälten på /koppla-bank; sektionen här är bara ram, rubrik
          och vägen vidare — exakt samma arbetsdelning som bytessektionen
          längre ner har mot MigrationFlow.jsx.
          Ivory mot kortbakgrunden i sektionerna före och efter, så de tre
          flödesanimationerna på sidan inte flyter ihop till ett enda långt
          fält. ── */}
      <section style={{ padding: '76px 24px', background: 'var(--mkt-section-mint)', borderTop: '1px solid var(--mkt-border-soft)', borderBottom: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '38px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              {c.bank.heading}
            </h2>
            {/* Formuleringen är avsiktligt exakt (på alla språk): kontoutdraget
                är en FIL du exporterar, inte en direktkoppling mot banken (se
                filkommentaren i bankSources.js — sajten får aldrig antyda
                en funktion som inte finns). */}
            <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.65, maxWidth: '620px', margin: '0 auto' }}>
              {c.bank.subheading}
            </p>
          </Reveal>

          <Reveal scale delay={80}>
            {/* Utan "Annan bank"-brickan i loggväggen: den bor på
                /koppla-bank, där frågan "min bank saknas" faktiskt ska
                besvaras. Här räcker noten under väggen. */}
            <BankFlow otherTile={false} />
          </Reveal>

          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '30px' }}>
            <Link
              to="/koppla-bank"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
            >
              {c.bank.cta} <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── BYT FRÅN DITT NUVARANDE PROGRAM (kundönskemål: "en sektion före
          priserna med bokföringsprogrammens loggor och en animation där
          man byter till oss") — den vanligaste invändningen precis innan
          någon tittar på priset är "jag bokför redan någon annanstans",
          och det är exakt där den här står. Själva animationen bor i
          marketing/MigrationFlow.jsx, delad med hjälten på
          /byt-bokforingsprogram; sektionen här är bara ram, rubrik och
          vägen vidare. Ivory mot kortbakgrunden i sektionen ovanför, och
          en tunn underkant mot prissektionen (som också är ivory) så
          skarven syns. ── */}
      <section style={{ padding: '76px 24px', background: 'var(--mkt-card-bg)', borderBottom: `1px solid var(--mkt-border-soft)`, position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 'min(92vw, 1180px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '38px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              {c.switchProgram.heading}
            </h2>
            <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.65, maxWidth: '600px', margin: '0 auto' }}>
              {c.switchProgram.subheading}
            </p>
          </Reveal>

          <Reveal scale delay={80}>
            <MigrationFlow />
          </Reveal>

          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '30px' }}>
            <Link
              to="/byt-bokforingsprogram"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 700, fontSize: '15px', textDecoration: 'none' }}
            >
              {c.switchProgram.cta} <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Prissektionen är borttagen från startsidan (kundönskemål 2026-09-26: priset ska inte synas här). Priserna finns på /priser. */}

      {/* ── FAQ ── */}
      <section style={{ padding: '76px 24px', background: 'var(--mkt-section-mint)', position: 'relative', overflow: 'hidden' }}>
        {/* Kundönskemål (uppföljning): den fulla accordionen var tidigare
            bara dold på mobil (.lp-faq-full/.lp-faq-mobile-cta) — kunden
            bad om samma kompakta "gå till FAQ"-kort på desktop också, inte
            bara mobil. Bara det kompakta kortet kvar nu, på alla
            skärmstorlekar; den fulla accordionen (FaqItem/FAQ_SPLIT/
            openFaq) togs bort härifrån helt — finns kvar oförändrad på
            den egna sidan, /vanliga-fragor (FaqPage.jsx). */}
        <div style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.4vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              {c.faqTeaser.heading}
            </h2>
            <p style={{ fontSize: '18px', color: MUTED }}>{c.faqTeaser.subheading}</p>
          </Reveal>

          {/* Kundönskemål (2026-09-22): kortet nedan var det ENDA som syntes
              i sektionen — bara en länk ut, inga faktiska frågor. Tre
              riktiga frågor (samma FAQ_ITEMS som /vanliga-fragor, ingen ny
              lista) som ren text ovanför, inte en ny mini-accordion — den
              fulla, klickbara varianten togs bort härifrån med flit i en
              tidigare omgång (se kommentaren ovan) och ska inte komma
              tillbaka i förklädnad. Det här är bara en försmak.
              Bara sv — FAQ_ITEMS text finns bara på svenska, samma
              begränsning som FAQ_SCHEMA (se den JsonLd-raden ovan). */}
          {locale === 'sv' && (
            <Reveal style={{ maxWidth: '640px', margin: '0 auto 22px' }}>
              <div style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
                {FAQ_TEASER_PREVIEW.map((q, i) => (
                  <div key={i} style={{ padding: '17px 22px', fontSize: '15px', fontWeight: 600, color: INK_SOFT, borderTop: i > 0 ? `1px solid ${CARD_BORDER}` : 'none' }}>
                    {q}
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal scale style={{ maxWidth: '640px', margin: '0 auto' }}>
            <Link to="/vanliga-fragor" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '20px 22px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', boxShadow: '0 14px 30px -22px rgba(28,36,32,0.22)', textDecoration: 'none' }}>
              <span>
                <span style={{ display: 'block', fontSize: '15.5px', fontWeight: 700, color: INK, marginBottom: '3px' }}>{c.faqTeaser.cardTitle}</span>
                <span style={{ display: 'block', fontSize: '13px', color: MUTED }}>{c.faqTeaser.cardSubtitle}</span>
              </span>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: FAQ_ACCENT.soft, color: FAQ_ACCENT.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ChevronRight size={18} />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Egen fristående yta, inte en sektion i sidflödet ovan — se
          DemoOverlay:s egen kommentar högst upp i filen. */}
      {showDemo && <DemoOverlay onClose={closeDemo} initialTab={showDemo} labels={c.demoOverlay} />}
    </MarketingLayout>
  );
}
