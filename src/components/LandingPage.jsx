import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, Check, X,
  ArrowRight, ChevronRight, ChevronDown,
  GraduationCap,
} from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import MarketingLayout, { Reveal, BokixWordmark } from './marketing/MarketingLayout';
import ToolMotif, { ToolMotifStyles } from './marketing/toolMotifs';
import { FeatureDemoStyles, DemoBokforing, DemoFakturering, DemoSkatt, DemoPersonal } from './marketing/featureDemos';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW_SM, ACCENT, ACCENT_CYCLE } from './marketing/marketingTokens';
import CloudShaderBackground from './marketing/CloudShaderBackground';
import { GRAD, grad, AuroraLayer } from './marketing/aurora';
import { StripeLogo, StripeIconLogo, ZettleLogo, BolagsverketLogo, SkatteverketLogo, BasLogo, GdprLogo, BokforingslagLogo } from './shared/BrandLogos';
import MigrationFlow from './marketing/MigrationFlow';
import BankFlow from './marketing/BankFlow';
import { UF_NAV_IDS, UF_NAV_LABELS, UF_FREE_MONTHS } from '../utils/ufMode';
import { PRICING_TIERS } from './marketing/pricingTiers';
import { resolvePlan, YEARLY_MINIMUM_MONTHS } from '../utils/plans';
import { PageMeta, JsonLd, SITE_URL } from '../utils/seo';
// Lazy: DemoWorkspace monterar en RIKTIG kopia av hela den inloggade
// appens komponentträd (Dashboard, Invoices, Bokföring, Skatt, m.fl.) för
// den interaktiva produktdemon längre ner på sidan (utanför den första
// skärmen). Statiskt importerad tvingade den in samma tunga bunt även
// för en besökare som aldrig scrollar dit — se App.jsx för samma
// resonemang kring den inloggade appens egna flikar.
const DemoWorkspace = lazy(() => import('./DemoWorkspace'));

// ── Faktiska bolagsformer Bokix kan identifiera/bokföra för (se
// src/utils/orgType.js) — inte en påhittad lista. ──
// Bara namnen. Här satt tidigare en ikon per bolagsform — en person med
// bock för enskild firma, en portfölj för handelsbolag, ett tempel för
// ekonomisk förening. Ingen av dem betyder något; de var fem olika sätt
// att säga "företag" bredvid ett ord som redan sa exakt vilket. Sätt inte
// tillbaka dem.
const COMPANY_TYPES = [
  { label: 'Enskild firma' },
  { label: 'Aktiebolag (AB)' },
  { label: 'Handelsbolag / KB' },
  { label: 'Ekonomisk förening' },
  { label: 'Ideell förening / stiftelse' },
];

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
// Korta etiketter med flit — långa fraser (tidigare t.ex. "Kortbetalningar
// direkt på fakturan") krockade med Bokix-mittnoden på smala mobilbredder,
// se kommentaren vid CONNECTION_POS nedan.
// Kundönskemål ("skatteverket/bolagsverket small på både mobil och
// dator, zettles 'by PayPal' syns inte bra på mobil") — ALLA fyra loggor
// fick nu en egen clamp()-höjd istället för ett fast pixeltal. Grundfelet
// var samma för alla: badgen krymper responsivt (clamp(56px,18vw,130px)),
// men en FAST loggohöjd gör det INTE — på ett smalt fönster blir loggan
// proportionellt STÖRRE än sin nu mindre badge (Bolagsverket klipptes rakt
// av, "olagsverke"; Zettles lilla "by PayPal"-rad hamnade nära/utanför den
// runda klippningen). Varje loggas clamp() skalar med SAMMA vw-takt som
// badgen (18vw), bara vid en egen andel av den — stående lockuper
// (Bolagsverket/Skatteverket, ikon OVANFÖR text) får en högre andel (65%)
// eftersom de annars ser små ut brevid Stripes/Zettles breda ordmärken;
// Stripe/Zettle (redan breda, fyller badgen bra) en lägre andel (~30%),
// höjda en aning från förra passets fasta 39/42px för att Zettles
// "by PayPal" ska gå att läsa även i den minsta badge-storleken.
const CONNECTIONS = [
  { key: 'stripe', kind: 'logo', Logo: StripeLogo, logoHeight: 'clamp(24px, 5.5vw, 40px)', label: 'Kortbetalningar', group: 'Betalningar' },
  // Zettle/Bolagsverket/Skatteverket renderar numera direkt på den mörka
  // cirkeln precis som Bokix/Stripe (kundönskemål) — BrandLogos.jsx:s
  // ThemedLogo hanterar ljust/mörkt bläck internt (två färdiga bildvarianter
  // + CSS i MarketingLayout.jsx), ingen ljus "chip" runt loggan behövs
  // längre här.
  { key: 'zettle', kind: 'logo', Logo: ZettleLogo, logoHeight: 'clamp(26px, 6vw, 44px)', label: 'Kassaförsäljning', group: 'Betalningar' },
  // Kundönskemål: Bolagsverket/Skatteverket större — andelen av badgens
  // egen clamp(56px,18vw,130px) höjd upp igen (var 65%, nu ~80%).
  { key: 'bolagsverket', kind: 'logo', Logo: BolagsverketLogo, logoHeight: 'clamp(46px, 14vw, 104px)', label: 'Företagsuppslag', group: 'Myndigheter' },
  { key: 'skatteverket', kind: 'logo', Logo: SkatteverketLogo, logoHeight: 'clamp(46px, 14vw, 104px)', label: 'Rätt filformat', group: 'Myndigheter' },
];

// Positioner i diagrammets EGNA koordinatsystem (viewBox 0 0 800 300) —
// samma koordinater används både för SVG-linjerna och för att räkna ut
// vänster/topp i procent åt de HTML-positionerade noderna (se sektionen
// nedan), så de alltid landar exakt på linjernas ändpunkter oavsett hur
// brett diagrammet faktiskt renderas (aspect-ratio håller proportionen).
// Kundönskemål ("lite ifrån varandra") — noderna sitter nu nära själva
// diagramkanten (x=70/730, y=15/285) istället för den försiktigare
// 110/690-varianten, tydligt mer luft mot Bokix-mittnoden. Inte ända ut
// till 40/760 (ett tidigare försök) — etikett-bredden (clamp(), se
// sektionen) klipptes då av sektionens egen overflow:hidden på smala
// mobilbredder.
const CONNECTION_CENTER = { x: 400, y: 150 };
const CONNECTION_POS = [
  { x: 70, y: 15 },    // Stripe — övre vänster
  { x: 70, y: 285 },   // Zettle — nedre vänster
  { x: 730, y: 15 },   // Bolagsverket — övre höger
  { x: 730, y: 285 },  // Skatteverket — nedre höger
];

// Kundönskemål ("och stripe logon") — riktiga ordmärken (StripeLogo,
// BasLogo) på en vit badge där en verklig logga faktiskt finns, `logo` är
// valfri och faller annars tillbaka på `icon` (se GDPR-raden nedan).
// GDPR-raden: kundbeslut i andra vändan — badgen visas nu (GdprLogo, se
// den kommentaren i BrandLogos.jsx för vad sigillet är och inte är), och
// etiketten kortades samtidigt från "GDPR: din data stannar din" till bara
// "GDPR". Kortare är dessutom ärligare här: bilden bär redan ordet, och
// raden slipper låta som ett eget löfte utöver förordningen.
// `logoHeight` per rad (kundönskemål: "större logo och se bättre") — samma
// höjd på alla tre hade INTE sett lika stora ut: en cirkel (GDPR) och ett
// brett ordmärke med inbyggd luft (BAS) läser optiskt mindre än en fylld
// kvadrat (Stripe-ikonen) på exakt samma pixelhöjd. Värdena är alltså
// balanserade mot varandra, inte satta till samma tal.
const TRUST_POINTS = [
  // Ritad flaggbricka, inte en myndighetslogotyp — se BrandLogos.jsx.
  // Här satt först en klubba ur ett ikonbibliotek (en domstolssymbol, inte
  // en bokföringssymbol) och sedan ingenting alls.
  { logo: BokforingslagLogo, logoHeight: 46, label: 'Byggt efter svensk bokföringslag' },
  { logo: GdprLogo, logoHeight: 56, label: 'GDPR' },
  // Kundönskemål: Stripe-ikonet HÄR, inte ordmärket — StripeIconLogo, INTE
  // StripeLogo (den senare används bara i "Kopplat till"-diagrammet
  // längre ner och ska uttryckligen förbli oförändrad, se BrandLogos.jsx).
  { logo: StripeIconLogo, logoHeight: 46, label: 'Kortbetalningar via Stripe' },
  { logo: BasLogo, logoHeight: 38, label: 'BAS-kontoplan' },
];


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
  { motif: 'kvitton', title: 'Utgifter och kvitton', desc: 'Underlaget sitter kvar på verifikationen.' },
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

// Kundönskemål ("fler frågor som bör finnas") — två nya rader tillagda
// (skillnaden mellan nivåerna, support), och prissvaret uppdaterat till de
// två faktiska nivåerna (129/179 kr) istället för det gamla enda priset.
const FAQ_ITEMS = [
  { q: 'Behöver jag kunna bokföring sedan innan?', a: 'Nej. Verifikationer skapas automatiskt utifrån dina kvitton och fakturor. Det enda som kräver din uppmärksamhet hamnar i Granskning, med tydlig anledning till varför. Resten sköts av Bokix.' },
  { q: 'Fungerar Bokix för min bolagsform?', a: 'Ja. Enskild firma, aktiebolag, handelsbolag/KB, ekonomisk förening och ideell förening/stiftelse: Bokix känner av rätt bolagsform automatiskt utifrån ditt organisationsnummer när du skapar konto.' },
  { q: 'Vad kostar det, och vad ingår?', a: 'Två priser, beroende på om du har personal: 129 kr/mån utan anställda, 179 kr/mån med. Obegränsat med kund- och leverantörsfakturor, fyra fakturamallar med egen logotyp, löpande bokföring och kortbetalningar via Stripe ingår i båda, ingen bindningstid på månadsplanen. Ingen moms tillkommer — Bokix är inte momsregistrerat.' },
  { q: 'Vad är skillnaden mellan de två prisnivåerna?', a: 'Samma bokföring och fakturering i båda. Med personal lägger till lönekörning med automatiskt skatteavdrag, AGI- och kontrolluppgiftssammanställningar samt en betalfil klar att ladda upp till banken: allt du behöver den dagen du har någon anställd.' },
  { q: 'Kan jag ta med mig min bokföring om jag vill byta bort från Bokix senare?', a: 'Ja. Din bokföring går att exportera som SIE4-fil, det standardformat svenska bokföringsprogram och redovisningskonsulter använder för att flytta data mellan system. Din data är aldrig inlåst.' },
  { q: 'Är Bokix anpassat efter svensk bokföringslag och Skatteverkets regler?', a: 'Ja, det är hela utgångspunkten. BAS-kontoplan, momsdeklaration per kvartal (25/12/6 %), AGI- och kontrolluppgiftssammanställningar samt skatteavdrag enligt Skatteverkets egna skattetabeller vid lönekörning.' },
  { q: 'Hur fungerar de 30 dagarna gratis?', a: 'Du lägger in dina betaluppgifter hos Stripe när du skapar konto, men debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något, annars börjar ditt månadspris dras automatiskt.' },
  { q: 'Ingår support i priset?', a: 'Ja, support ingår i båda nivåerna. Du når oss på support@bokix.se.' },
];

// FAQPage-schema byggt direkt av FAQ_ITEMS ovan — samma frågor/svar som
// faktiskt visas i FAQ-sektionen, aldrig en egen dubblettlista som kan
// glida isär från vad besökaren ser (samma mönster som PricingPage.jsx).
// Var listan delas i två spalter på breda skärmar. Udda antal hamnar i
// den vänstra, som läses först.
const FAQ_SPLIT = Math.ceil(FAQ_ITEMS.length / 2);

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

// SoftwareApplication-schema för startsidan — samma produkt som
// PricingPage.jsx beskriver, men med url satt till startsidan så
// crawlers/AI-svarsmotorer som landar på "/" (den mest lästa sidan) också
// får ett strukturerat pris istället för att behöva gissa det ur brödtexten.
// AggregateOffer byggd direkt från PRICING_TIERS (samma mönster som
// PricingPage.jsx) — stod tidigare som en enda Offer på 179 kr, vilket
// blev fel/ofullständigt så fort en andra, billigare nivå (129 kr) fanns.
const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bokix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: SITE_URL,
  description: 'Bokföring, fakturering, lönehantering och momsredovisning för svenska företag i alla bolagsformer.',
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

/** PRODUKTVISNING som EGEN yta, inte ett skrolla-till-avsnitt i sidflödet
 * (kundönskemål: "visa den som en egen sektion, bara synlig när man
 * trycker Demo"). En riktig lightbox ovanpå resten av sidan — Esc,
 * bakgrundsklick eller krysset stänger den, body-skrollen låses medan den
 * är öppen (samma mönster som mobilmenyns overflow-lås i
 * MarketingHeader). DemoWorkspace.jsx monterar de RIKTIGA appkomponenterna
 * med ett lokalt exempeldataset — lazy() + Suspense här (inte RevealLazy,
 * som styrs av scrollposition) eftersom synlighet nu helt avgörs av att
 * overlayen är öppen, inte av var i dokumentet man skrollat till. */
function DemoOverlay({ onClose }) {
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
    <div className="lp-demo-overlay" role="dialog" aria-modal="true" aria-label="Produktdemo">
      <div className="lp-demo-overlay-backdrop" onClick={onClose} aria-hidden />
      <div className="lp-demo-overlay-panel" ref={panelRef} tabIndex={-1}>
        <div className="lp-demo-overlay-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <BarChart3 size={16} color={BRAND.green} style={{ flexShrink: 0 }} />
            <span style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--mkt-heading)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Så ser det ut: testa på riktigt</span>
          </div>
          {/* "Exempeldata" satt tidigare inne i demons egen topbar, som en
              rad ovanför varje sidas rubrik — kundönskemål att ta bort den
              därifrån. Upplysningen får inte försvinna helt (ingen ska tro
              att siffrorna är en riktig bokföring), så den ligger nu här i
              demons rubrikrad i stället: utanför app-ytan, syns hela tiden,
              stör inget innehåll. */}
          <span style={{ marginLeft: 'auto', marginRight: '12px', flexShrink: 0, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mkt-muted)' }}>Exempeldata</span>
          <button className="lp-demo-overlay-close" onClick={onClose} aria-label="Stäng demo">
            <X size={18} />
          </button>
        </div>
        <div className="lp-demo-overlay-body">
          <Suspense fallback={<div style={{ minHeight: '480px' }} />}>
            <DemoWorkspace />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

// Kundönskemål ("gör FAQ större, en färg") — accent kommer nu in som EN
// gemensam prop (FAQ_ACCENT) istället för ett per-rad `g`-fält, och
// siffer-cirkel/fråga/svar är genomgående större.
function FaqItem({ item, index, isOpen, onToggle, accent }) {
  return (
    <div
      className="lp-faq-item"
      style={{
        borderRadius: '16px',
        background: isOpen ? `color-mix(in srgb, ${accent.fg} 7%, transparent)` : 'transparent',
        borderLeft: `3px solid ${isOpen ? accent.fg : 'transparent'}`,
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      <button className="lp-faq-question" onClick={onToggle} aria-expanded={isOpen} style={{ padding: '26px 16px 26px 20px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          <span style={{ width: 38, height: 38, borderRadius: '50%', background: accent.fg, color: 'white', fontSize: '14.5px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
          <span style={{ fontSize: '19.5px', fontWeight: 700, color: INK }}>{item.q}</span>
        </span>
        <ChevronDown size={22} className={`lp-faq-chevron ${isOpen ? 'lp-faq-open' : ''}`} style={{ color: isOpen ? accent.fg : undefined, flexShrink: 0 }} />
      </button>
      <div className={`lp-faq-answer ${isOpen ? 'lp-faq-open' : ''}`}>
        <div>
          <p style={{ margin: '0 16px 28px 74px', fontSize: '16.5px', color: MUTED, lineHeight: 1.7, maxWidth: '680px' }}>{item.a}</p>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onEnterApp }) {
  // Betalningsintervall i prissektionen. Samma val som /priser, samma
  // katalog (plans.js) — annars kan de två sidorna visa olika pris för
  // samma abonnemang, vilket var precis vad som hände innan katalogen
  // fanns.
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(0);

  // Kundönskemål: produktvisningen (DemoWorkspace) ska inte ligga inline i
  // sidflödet längre — bara visas, som en EGEN fristående yta (lightbox,
  // se DemoOverlay ovan), när besökaren faktiskt trycker "Se demo" i Hero.
  // Stängs igen via krysset/Esc/bakgrundsklick i overlayen; fokus flyttas
  // tillbaka till knappen som öppnade den (demoTriggerRef) så tangentbords-
  // /skärmläsarnavigeringen inte tappar sin plats.
  const [showDemo, setShowDemo] = useState(false);
  const demoTriggerRef = useRef(null);
  const openDemo = () => setShowDemo(true);
  const closeDemo = useCallback(() => {
    setShowDemo(false);
    demoTriggerRef.current?.focus();
  }, []);

  return (
    <MarketingLayout onEnterApp={onEnterApp}>
      <PageMeta
        title="Bokix: Smart & enkel bokföring online för småföretagare"
        description="Bokix samlar bokföring, fakturering, löner och moms i ett enda verktyg för svenska företag i alla bolagsformer. Kom igång på minuter, från 129 kr/mån."
        path="/"
      />
      <JsonLd data={SOFTWARE_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />
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
            För att bokföring<br />ska vara{' '}
            <em className="lp-gradient-text" style={{ fontStyle: 'italic', backgroundImage: 'linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16, #0ea5e9)' }}>enkelt</em>
          </h1>

          <p className="lp-fadeinup lp-delay-1" style={{ fontSize: 'clamp(18px, 1.6vw, 21px)', color: INK_SOFT, lineHeight: 1.7, maxWidth: '600px', fontWeight: 400, margin: '0 auto 40px' }}>
            Fakturor, löner, moms och bokslut i ett enda verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.
          </p>

          <div className="lp-fadeinup lp-delay-2 lp-cta-group" style={{ display: 'flex', justifyContent: 'center', gap: '14px' }}>
            <span className="lp-moving-border-wrap">
              <button className="lp-btn-primary" onClick={() => onEnterApp('signup')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '18px 34px', background: BRAND.green, border: 'none', borderRadius: '13px', fontSize: '17px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 10px 26px -8px rgba(11,99,41,0.5)', minHeight: '48px' }}>
                Prova gratis <ArrowRight size={18} />
              </button>
            </span>
            <button ref={demoTriggerRef} className="lp-btn-secondary" onClick={openDemo} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '18px 30px', background: 'var(--mkt-card-bg)', border: '1.5px solid var(--mkt-border-soft)', borderRadius: '13px', fontSize: '17px', fontWeight: 600, cursor: 'pointer', color: 'var(--mkt-ink-soft)', fontFamily: 'inherit', minHeight: '48px' }}>
              Se demo <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ── FUNKTIONSÖVERSIKT — flyttad upp direkt efter nyckeltalen (annan
          ordning än tidigare), varje kort med egen gradient-ikonchip. ── */}
      <section id="funktioner-teaser" style={{ padding: '84px 24px', background: 'var(--mkt-card-bg)', borderTop: '1px solid var(--mkt-border-soft)', borderBottom: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        {/* Kolumnräkneark-radband (kundönskemål: "cool", inte generisk) —
            en riktig bokföringsdetalj, reserverad för den här sektionen och
            jämförelsetabellen längre ner eftersom innehållet faktiskt
            HANDLAR om bokföring/tabelldata. */}
        {/* Räkenskapslinjerna kvar, aurora-klotet borta: sektionen ska
            vara REN VIT (kundönskemål). De tonade kloten gjorde den
            gulgrön i kanterna, vilket är precis den färg elfenbens-
            sektionerna redan har — och då syntes inte skiftet mellan dem. */}
        <div aria-hidden className="lp-ledger-lines" />
        {/* Kundönskemål: en FAST maxWidth ("gör den bredare") löser bara
            problemet vid EN specifik fönsterbredd — bredare än det ser det
            fortfarande tomt ut, smalare än det klipps det i onödan.
            min(vw, px) håller innehållet proportionellt mot den FAKTISKA
            fönsterbredden hela vägen (bra på halv skärm OCH helskärm),
            med px-talet bara som ett tak för orimligt breda skärmar.
            Samma mönster rakt igenom hela filen från och med nu. */}
        <div style={{ maxWidth: 'min(92vw, 1600px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--mkt-ink)', marginBottom: '16px' }}>
              Automatiskt, från kvitto till bokslut
            </h2>
            <p style={{ fontSize: '17px', color: 'var(--mkt-muted)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              Du lägger in underlaget. Bokix bokför, räknar moms och skatt, och håller koll på vad som behöver din uppmärksamhet. Resten sköts i bakgrunden.
            </p>
          </Reveal>

          {/* Bento-layout — Bokföring (kärnan i produkten) som ett brett
              flaggskeppskort ovanför, de tre andra som jämnstora kort
              under. Samma lp-lux-card-hover (lyft+skugga) som resten av
              sidan, ingen färgad muspekar-glöd (borttagen på
              kundönskemål). */}
          <div className="lp-bento-grid">
            {FEATURE_COLUMNS.map((f, i) => (
              i === 0 ? (
                <Reveal
                  key={f.title} delay={0}
                  className="lp-lux-card lp-bento-feature-full"
                  style={{ background: 'var(--mkt-card-bg)', border: '1px solid var(--mkt-card-border)', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 14px 30px -20px rgba(28,36,32,0.26)', display: 'flex', alignItems: 'stretch' }}
                >
                  {/* Illustrationsspalten och texten storleksökta (kund-
                      önskemål: flaggskeppskortet såg glest ut på breda
                      skärmar — en 300px-bred bild i ett 1600px-brett kort
                      lämnade orimligt mycket tom yta runt en kort
                      textrad). */}
                  <div style={{ background: f.g.soft, width: 'min(420px, 42%)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(20px, 3vw, 32px)' }}>
                    <f.demo />
                  </div>
                  <div style={{ padding: '36px 40px 36px 34px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <h3 style={{ fontSize: '25px', fontWeight: 700, color: 'var(--mkt-ink)', marginBottom: '10px' }}>{f.title}</h3>
                    <p style={{ fontSize: '16px', color: 'var(--mkt-muted)', lineHeight: 1.65, maxWidth: '560px' }}>{f.desc}</p>
                  </div>
                </Reveal>
              ) : (
                <Reveal
                  key={f.title} delay={i * 80}
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
                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--mkt-ink)', marginBottom: '9px' }}>{f.title}</h3>
                    <p style={{ fontSize: '14.5px', color: 'var(--mkt-muted)', lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </Reveal>
              )
            ))}
          </div>

          <Reveal style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14.5px', fontWeight: 700, color: BRAND.green, textDecoration: 'none' }}>
              Se alla funktioner i detalj <ArrowRight size={15} />
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
      <section style={{ padding: '64px 24px 72px', background: IVORY, borderBottom: `1px solid var(--mkt-border-soft)`, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '28px' }}>
            Oavsett vad Bolagsverket kallar dig
          </h2>
        </Reveal>
        <Reveal scale className="lp-marquee" tabIndex={0} aria-label="Bolagsformer Bokix stödjer" style={{ position: 'relative' }}>
          <div className="lp-marquee-track">
            {[0, 1, 2, 3].map((copy) => (
              COMPANY_TYPES.map((t, i) => {
                const accent = ACCENT_CYCLE[i % 3];
                return (
                  <div key={`${t.label}-${copy}`} aria-hidden={copy > 0} className="lp-lux-card lp-marquee-badge" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '100px', whiteSpace: 'nowrap' }}>
                    {/* En liten prick i accentfärgen i stället för en ikon:
                        den håller kvar färgrytmen i raden utan att påstå att
                        en symbol betyder "handelsbolag". */}
                    <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: accent.fg, flexShrink: 0 }} />
                    <span className="lp-marquee-badge-label" style={{ fontSize: '14px', fontWeight: 600, color: INK_SOFT }}>{t.label}</span>
                  </div>
                );
              })
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── DET HÄR FÅR DU — kundönskemål: sluta jämföra mot konkurrenter,
          förklara vad man FÅR istället (se BENEFIT_ITEMS-kommentaren högst
          upp för resonemanget). Sex kort i samma lp-lux-card-språk som
          resten av sidan, ingen "vi vs dem"-tabell längre. ── */}
      {/* Egen yta, men i tema-tokens: varm elfenbensbotten med sajtens
          räkenskapslinjer, en gradientrand överst och ett mjukt ljus i
          hörnen. Här låg ett fast mörkgrönt band ett tag — det såg likadant
          ut i ljust och mörkt läge, och kundkravet är att sektionen ska vara
          genomarbetad i BÅDA teman, inte identisk i båda. */}
      <section style={{ padding: '84px 24px 92px', background: 'var(--mkt-section-mint)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundImage: 'linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16)', opacity: 0.85 }} />
        <div aria-hidden className="lp-ledger-lines" />
        <div style={{ maxWidth: 'min(92vw, 1600px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              Det här får du med Bokix
            </h2>
            <p style={{ fontSize: '17px', color: MUTED, maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
              Sex delar av verktyget. Allt ingår, inget kostar extra.
            </p>
          </Reveal>

          {/* minmax-golvet höjt (300→400px) i takt med den bredare
              behållaren ovan — annars bryter auto-fit till 4-5 kolumner på
              breda skärmar och lämnar sex kort som 4+2 istället för 3+3. */}
          <div className="bx-tool-grid bx-tool-grid-3" style={{ maxWidth: 'min(92vw, 1320px)', margin: '0 auto' }}>
            {TOOL_ITEMS.map((b, i) => (
              <Reveal key={b.title} delay={i * 70} className="lp-lux-card" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', padding: '20px 22px 24px', boxShadow: '0 18px 38px -26px rgba(28,36,32,0.4)' }}>
                <ToolMotif kind={b.motif} />
                <h3 style={{ fontSize: '16.5px', fontWeight: 700, color: INK, marginBottom: '7px' }}>{b.title}</h3>
                <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── TROVÄRDIGHETSRAD — kundönskemål: samma oändligt rullande
          marquee som bolagsformer-raden ("dom rullar ju runt, gör samma
          där"), inte en stillastående flex-rad längre. Fyra kopior +
          -25%-translateX, exakt samma teknik som .lp-marquee-track redan
          etablerat (se kommentaren där). Badgearna fick också en lugnare
          yta (kundönskemål: "mindre tjock bakgrund") — mjuk, ljus
          tonad cirkel + accentfärgad ikon istället för en solid, mättad
          cirkel med vit ikon. ── */}
      <section style={{ padding: '48px 0 60px', background: IVORY, borderTop: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 'min(420px, 70%)', height: '2px', opacity: 0.5, background: `linear-gradient(90deg, transparent, ${ACCENT.green.fg}, ${ACCENT.blue.fg}, ${ACCENT.teal.fg}, transparent)` }} />
        <Reveal scale className="lp-marquee" tabIndex={0} aria-label="Bokix i korthet">
          <div className="lp-marquee-track">
            {[0, 1, 2, 3].map((copy) => (
              TRUST_POINTS.map((t, i) => {
                const accent = ACCENT_CYCLE[i % 3];
                return (
                  <div key={`${t.label}-${copy}`} aria-hidden={copy > 0} className="lp-lux-card" style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '10px 26px 10px 10px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '100px', boxShadow: '0 2px 8px rgba(28,36,32,0.05)', whiteSpace: 'nowrap' }}>
                    {t.logo ? (
                      // Kundönskemål ("inte för litet", sedan "större logo
                      // och se bättre") — en ordmärkeslogga (bredare än hög)
                      // klämd in i en cirkel blev mikroskopisk. En auto-bred
                      // pill i samma höjd som de andra badgearna ger loggan
                      // faktisk storlek istället. Höjden per logga kommer
                      // ur TRUST_POINTS.logoHeight, se kommentaren där.
                      <div style={{ height: 72, padding: '0 18px', borderRadius: '36px', background: '#ffffff', border: `1px solid ${CARD_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <t.logo height={t.logoHeight || 28} />
                      </div>
                    ) : (
                      // Alla fyra raderna har ett märke numera. Grenen står
                      // kvar som skydd om någon lägger till en rad utan.
                      <span aria-hidden style={{ width: 14, flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '15px', fontWeight: 700, color: INK_SOFT }}>{t.label}</span>
                  </div>
                );
              })
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── KOPPLAT TILL — Bokix-loggan i mitten, fyra riktiga kopplingar
          (Stripe/Zettle-loggor, Bolagsverket/Skatteverket som ikon+text,
          se CONNECTIONS-kommentaren högst upp) med linjer ut till varje.
          Ren HTML+SVG, inga bibliotek: linjerna ritas i SVG:ns eget
          koordinatsystem (viewBox 800×300), nodernas HTML-badges
          positioneras i EXAKT samma koordinater omräknat till procent —
          aspectRatio på ytterhöljet håller de två lagren i synk oavsett
          bredd. Kundönskemål: linjerna "rör sig hela tiden" (marscherande
          streck, .lp-flow-line i MarketingLayout.jsx) och en mjukt
          pulserande glöd bakom Bokix-noden — känns som att kopplingarna
          faktiskt är LIVE, inte en stillbild.
          Kundönskemål (skickade referensbilder på andra sajters "hub"-
          diagram) — samma äkta fyra kopplingar, INGA påhittade extra
          integrationer: raka linjer → mjuka Bezier-kurvor, runda noder
          istället för rundade kvadrater. ── */}
      <section style={{ padding: '76px 24px', background: 'var(--mkt-card-bg)', position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.16)', '4% -8%'], ['rgba(20,184,166,0.14)', '96% 108%']]}
          blob={{ gradient: grad(GRAD.blueTeal), top: '-150px', right: '-110px', left: 'auto', size: '420px', opacity: 0.18 }}
        />
        {/* Kundönskemål ("för mycket tomt utrymme på helskärm, men bra på
            halv skärm"): en FAST maxWidth ser bara bra ut vid EN
            fönsterbredd — min(vw,px) håller diagrammet proportionellt mot
            fönstret på VARJE bredd istället. Det här var sektionen som
            kändes mest övergiven på en bred skärm, ett litet diagram i ett
            stort mörkt hav. */}
        <div style={{ maxWidth: 'min(90vw, 1300px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              Kopplat till tjänsterna du redan använder
            </h2>
            <p style={{ fontSize: '17px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
              Betalningar, kassa och myndigheter: Bokix pratar med rätt system istället för att du ska hålla ordning själv.
            </p>
          </Reveal>

          <Reveal scale style={{ position: 'relative', width: '100%', maxWidth: 'min(88vw, 1280px)', margin: '0 auto', aspectRatio: '800 / 300' }}>

            <svg viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
              <defs>
                <linearGradient id="lp-connect-line" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#14b8a6" />
                </linearGradient>
              </defs>
              {/* Mjuka Bezier-kurvor istället för raka streck — samma
                  "kabel som svänger in" känsla som referensbilderna,
                  fortfarande samma marscherande streck-animation
                  (.lp-flow-line). Kontrollpunkterna ligger på halva
                  vägen horisontellt, vid start- respektive mål-y, vilket
                  ger en S-formad kurva som lämnar/anländer vågrätt. */}
              {CONNECTION_POS.map((p, i) => {
                const midX = (p.x + CONNECTION_CENTER.x) / 2;
                return (
                  <path
                    key={i} className="lp-flow-line"
                    d={`M ${p.x} ${p.y} C ${midX} ${p.y}, ${midX} ${CONNECTION_CENTER.y}, ${CONNECTION_CENTER.x} ${CONNECTION_CENTER.y}`}
                    fill="none" stroke="url(#lp-connect-line)" strokeWidth="3" strokeLinecap="round" opacity="0.55"
                  />
                );
              })}
            </svg>

            {/* Bokix — mitten. En mjukt pulserande glöd (.lp-hub-pulse)
                bakom badgen förstärker "allt flödar hit"-känslan.
                Badge/etikett-storlekar i clamp() (inte fasta px) — vid
                smala mobilbredder skulle breda etiketter annars svämma
                över diagrammets egen, då mycket smalare, procent-
                positionerade bredd. Taket (clamp:ens tredje värde) höjt
                rejält (156→190) i samma omgång som diagrammet självt fick
                bli bredare — annars hade klotet fortsatt kapa vid samma
                pixelstorlek och sett ÄNNU mindre ut i den nu bredare ramen,
                clamp() räknar mot fönsterbredden, inte diagram-behållarens
                egen bredd. */}
            <div style={{ position: 'absolute', left: `${(CONNECTION_CENTER.x / 800) * 100}%`, top: `${(CONNECTION_CENTER.y / 300) * 100}%`, transform: 'translate(-50%, -50%)', width: 'clamp(96px, 26vw, 190px)', height: 'clamp(96px, 26vw, 190px)' }}>
              <div aria-hidden className="lp-hub-pulse" style={{ position: 'absolute', inset: '-16px', borderRadius: '50%', background: grad(GRAD.blueTeal), opacity: 0.35, filter: 'blur(20px)', zIndex: 0 }} />
              {/* Kundönskemål: mörk bakgrund i mörkt läge (var alltid vit
                  oavsett tema) — Bokix-ordmärket är en gradient-fylld SVG
                  med transparent bakgrund, funkar direkt på var(--mkt-card-bg)
                  utan någon ljus "chip" runt sig, till skillnad från
                  loggorna nedan. */}
              <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '50%', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, boxShadow: '0 20px 40px -16px rgba(28,36,32,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                {/* Kundönskemål: större — var ett FAST 36px oavsett hur stor
                    den omslutande cirkeln (clamp(96px,26vw,190px)) blev, så
                    loggan såg liten ut brevid den på breda skärmar. Egen
                    clamp() nu, samma responsiva princip som CONNECTIONS-
                    loggorna ovan. */}
                <BokixWordmark height="clamp(34px, 10vw, 74px)" />
              </div>
            </div>

            {CONNECTIONS.map((c, i) => {
              const p = CONNECTION_POS[i];
              return (
                <div key={c.key} style={{ position: 'absolute', left: `${(p.x / 800) * 100}%`, top: `${(p.y / 300) * 100}%`, transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(6px, 2vw, 12px)', width: 'clamp(60px, 17vw, 170px)', zIndex: 2 }}>
                  <div style={{ width: 'clamp(56px, 18vw, 130px)', height: 'clamp(56px, 18vw, 130px)', borderRadius: '50%', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, boxShadow: '0 14px 28px -14px rgba(28,36,32,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    <c.Logo height={c.logoHeight} />
                  </div>
                  <span style={{ fontSize: 'clamp(10px, 2.8vw, 16px)', fontWeight: 600, color: MUTED, textAlign: 'center', lineHeight: 1.35 }}>{c.label}</span>
                </div>
              );
            })}
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
      <section style={{ padding: '76px 24px', background: IVORY, borderTop: '1px solid var(--mkt-border-soft)', borderBottom: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '38px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              Banken in i bokföringen
            </h2>
            {/* Formuleringen är avsiktligt exakt: kontoutdraget är en FIL
                du exporterar, inte en direktkoppling mot banken (se
                filkommentaren i bankSources.js — sajten får aldrig antyda
                en funktion som inte finns). */}
            <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.65, maxWidth: '620px', margin: '0 auto' }}>
              Exportera kontoutdraget ur din internetbank och läs in det i Bokix. Inbetalningar matchas mot dina obetalda fakturor, utbetalningar mot leverantörsfakturorna — och du lämnar aldrig ut någon bankinloggning.
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
              Se hur bankimporten fungerar <ArrowRight size={15} />
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
              Ta med dig bokföringen hit
            </h2>
            <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.65, maxWidth: '600px', margin: '0 auto' }}>
              Bokför du i Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger? Exportera en SIE4-fil därifrån och läs in den i Bokix. Konton, verifikationer och ingående balanser följer med.
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
              Se hur bytet går till <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── PRISSEKTION — kundönskemål: två prisnivåer ("folk vill
          jämföra"), flyttad hit UNDER "Igång på tre steg" (var innan
          Kopplat till-diagrammet). Axeln (har du anställda eller inte,
          se PRICING_TIERS-kommentaren högst upp) och 129 kr-priset är
          genomgångna med kunden, inte gissade.
          Kundönskemål ("vårt riktiga logo, andra färger, mindre space,
          större") — headern var tidigare en helfärgad gradient med
          loggan tvingad vit via CSS-filter. Bytt till en ljus, svagt
          färgtonad header (gradientens andra färg vid låg opacitet, en
          tunn 5px gradient-rand överst) så det RIKTIGA flerfärgade
          ordmärket syns i sina egna färger, stort. Sektionen och korten
          breddade (1020→1220px, 340→380px min) så det inte blir onödig
          tom yta i sidorna. Båda korten samma höjd (flex stretch) oavsett
          olika listlängd, och den dyrare nivån ("featured") får mer luft/
          större typsnitt för att kännas som "mer" utan att bli högre än
          sin granne. ── */}
      <section style={{ padding: '84px 24px', background: 'var(--mkt-section-blue)', borderTop: '1px solid var(--mkt-border-soft)', borderBottom: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>

        <Reveal style={{ textAlign: 'center', marginBottom: '44px', position: 'relative' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
            Ett pris för din situation
          </h2>
          <p style={{ fontSize: '17px', color: 'var(--mkt-ink-soft)', fontWeight: 500, maxWidth: '480px', margin: '0 auto' }}>Samma bokföring och fakturering i båda, skillnaden är om du har personal på lönelistan.</p>
        </Reveal>

        {/* Månadsvis eller årsvis — samma växlare som prissidan.
            Månadsvis är förvalt: den som inte aktivt väljer årsvis ska
            aldrig råka betala ett år i förskott. */}
        <Reveal style={{ display: 'flex', justifyContent: 'center', marginBottom: '34px', position: 'relative' }}>
          <div role="group" aria-label="Betalningsintervall" style={{ display: 'inline-flex', gap: '4px', padding: '5px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, boxShadow: CARD_SHADOW_SM }}>
            {[
              { id: 'monthly', label: 'Månadsvis' },
              { id: 'yearly', label: 'Årsplan', badge: 'spara upp till 360 kr/år' },
            ].map(opt => {
              const active = billingInterval === opt.id;
              return (
                <button
                  key={opt.id} type="button" onClick={() => setBillingInterval(opt.id)} aria-pressed={active}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '8px',
                    padding: '11px 22px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '14.5px', fontWeight: 700, border: 'none',
                    background: active ? 'var(--mkt-ivory)' : 'transparent',
                    color: active ? INK : MUTED,
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {opt.label}
                  {opt.badge && (
                    <span style={{ fontSize: '11.5px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', background: ACCENT.green.soft, color: ACCENT.green.fg }}>
                      {opt.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Reveal>

        <Reveal scale style={{ maxWidth: 'min(92vw, 1220px)', margin: '0 auto', padding: '0 4px', width: '100%', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '32px', alignItems: 'stretch' }}>
            {PRICING_TIERS.map((tier) => {
              const plan = resolvePlan(tier.key, billingInterval);
              return (
              <div
                key={tier.key}
                className="lp-lux-card"
                style={{
                  background: 'var(--mkt-card-bg)',
                  // Kundönskemål: 129-kortet ska ha SAMMA kant/outline-
                  // behandling som 179 (var tunnare/generisk innan) — båda
                  // får nu en 2px kant i sin egen accentfärg, "featured"
                  // känns ändå som "mer" via skuggan/paddingen nedan.
                  border: `2px solid ${tier.accent.fg}`,
                  borderRadius: '26px',
                  boxShadow: tier.featured ? '0 44px 76px -28px rgba(20,140,90,0.38), 0 4px 14px rgba(28,36,32,0.08)' : '0 32px 60px -30px rgba(28,36,32,0.32), 0 2px 8px rgba(28,36,32,0.05)',
                  width: '100%', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Ingen translateY-lyft längre — kundfeedback: den fick de
                    två kortens toppar att inte ligga i linje, vilket lästes
                    som "avskuret" istället för "höjt". Den dyrare nivån
                    känns fortfarande som "mer" via tjockare kant, skugga,
                    och mer luft/större typsnitt i headern nedan — bara inte
                    en fysisk förskjutning som bryter linjen mellan korten.
                    borderRadius matchar kortets EGNA 26px — utan den klipper
                    headerns egen overflow:hidden till ett rakt hörn, som
                    sedan klipps en gång till av kortets rundade mask, och de
                    två klippningarna möts inte exakt: den tunna gradient-
                    randen fick ett hackigt, "avskuret" hörn. */}
                <div style={{ background: `color-mix(in srgb, ${tier.accent.fg} 7%, var(--mkt-card-bg))`, padding: tier.featured ? '46px 28px 34px' : '38px 28px 28px', textAlign: 'center', position: 'relative', overflow: 'hidden', borderRadius: '26px 26px 0 0', flexShrink: 0 }}>
                  <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '5px', backgroundImage: grad(tier.gradient) }} />
                  <div style={{ marginBottom: tier.featured ? '20px' : '16px', position: 'relative' }}>
                    <BokixWordmark height={tier.featured ? 48 : 38} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'inline-flex', padding: '5px 14px', borderRadius: '100px', background: tier.accent.soft, fontSize: tier.featured ? '13.5px' : '12.5px', fontWeight: 700, color: tier.accent.fg, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px' }}>{tier.name}</div>
                    <div>
                      {/* Priset kommer ur samma katalog som checkouten
                          debiterar efter (plans.js) — kortet kan inte visa
                          ett annat belopp än det som dras. */}
                      <span style={{ fontFamily: SERIF, fontSize: tier.featured ? '58px' : '50px', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>
                        {plan.price} kr
                      </span>
                      <span style={{ fontSize: '15px', color: MUTED }}> /mån</span>
                    </div>
                    {billingInterval === 'yearly' ? (
                      <div style={{ fontSize: '13px', color: MUTED, marginTop: '6px', fontWeight: 600 }}>
                        Dras varje månad · du sparar {plan.savingPerYear} kr per år
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: MUTED, marginTop: '6px', fontWeight: 600 }}>{tier.subtitle} · gratis i 30 dagar</div>
                    )}
                  </div>
                </div>

                <div style={{ padding: '28px 24px 26px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                  {tier.recommend && (
                    <div style={{ fontSize: '13.5px', color: tier.accent.fg, fontWeight: 600, lineHeight: 1.5, marginBottom: '18px', paddingBottom: '18px', borderBottom: `1px solid ${CARD_BORDER}` }}>
                      {tier.recommend}
                    </div>
                  )}
                  {/* flex:1 — trycker knappen till samma vertikala position
                      i båda korten oavsett att listorna har olika längd. */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '22px', flex: 1 }}>
                    {tier.features.map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}`, borderRadius: '11px' }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: tier.accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Check size={11} color={tier.accent.fg} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: '14px', color: INK_SOFT, fontWeight: 500, lineHeight: 1.4 }}>{f}</span>
                      </div>
                    ))}
                    {/* Kundönskemål ("med den billigare ska man känna att
                        man missar något") — samma rader, gråtonade med ett
                        kryss istället för bock. */}
                    {tier.missing?.map((f) => (
                      <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '11px 12px', opacity: 0.55 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${MUTED}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <X size={11} color={MUTED} strokeWidth={3} />
                        </div>
                        <span style={{ fontSize: '14px', color: MUTED, fontWeight: 500, lineHeight: 1.4, textDecoration: 'line-through' }}>{f}</span>
                      </div>
                    ))}
                  </div>

                  {/* Solid BRAND.green, not the tier gradient — samma
                      knappfärg som "Kom igång" i navigation/CTA överallt
                      på sajten, istället för ett tredje eget färgspråk
                      bara här. */}
                  <button className="lp-btn-primary lp-pulse" onClick={() => onEnterApp('signup', plan.id)} style={{ width: '100%', padding: '16px', borderRadius: '13px', border: 'none', background: BRAND.green, fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 10px 24px -8px rgba(11,99,41,0.35)', minHeight: '48px', marginBottom: '14px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    Skapa konto gratis <ArrowRight size={16} />
                  </button>
                  {billingInterval === 'yearly' && (
                    <div style={{ textAlign: 'center', fontSize: '12px', color: MUTED, marginBottom: '10px', lineHeight: 1.5 }}>
                      Dras varje månad som vanligt. Minst {YEARLY_MINIMUM_MONTHS} månader, sedan säger du upp när du vill.
                    </div>
                  )}
                  <Link to="/priser" style={{ display: 'block', textAlign: 'center', fontSize: '13.5px', fontWeight: 600, color: MUTED, textDecoration: 'none' }}>
                    Se allt som ingår →
                  </Link>
                </div>
              </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── UF-FÖRETAG (kundönskemål: "en UF-sektion") — står direkt efter
          priserna med flit: den svarar på invändningen som uppstår i
          exakt det ögonblicket ("129 kr i månaden har vi inte") för den
          enda grupp som har ett annat erbjudande. Hela produkten är också
          en annan för dem, se utils/ufMode.js — sektionen säljer alltså
          inte samma sak billigare, den pekar på en egen sida.
          Siffrorna kommer ur ufMode.js, aldrig ur en handskriven text
          här: startsidan och /uf får inte kunna lova olika saker. ── */}
      <section style={{ padding: '68px 24px', background: 'var(--mkt-card-bg)', borderTop: '1px solid var(--mkt-border-soft)', position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '999px', background: 'var(--mkt-accent-green-soft)', color: BRAND.greenDark, fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '18px' }}>
            <GraduationCap size={14} /> För UF-företag
          </span>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.6vw, 36px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Driver ni ett UF-företag? Då är det gratis.
          </h2>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, maxWidth: '620px', margin: '0 auto 24px' }}>
            Gratis i {UF_FREE_MONTHS} månader, inget organisationsnummer och inga betaluppgifter. Ni får fakturering, kvitton, bokföring enligt BAS-kontoplanen och ett årsbokslut — men slipper offerter, projekt och löner som ett UF-år ändå aldrig innehåller.
          </p>

          <div style={{ display: 'flex', gap: '9px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '26px' }}>
            {UF_NAV_IDS.filter(id => id !== 'settings' && id !== 'review').map(id => (
              <span key={id} style={{ padding: '7px 13px', borderRadius: '999px', background: 'var(--mkt-ivory)', border: `1px solid ${CARD_BORDER}`, fontSize: '13px', fontWeight: 600, color: INK_SOFT }}>
                {UF_NAV_LABELS[id]}
              </span>
            ))}
          </div>

          <Link
            to="/uf"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15.5px', textDecoration: 'none' }}
          >
            Läs mer om Bokix för UF <ArrowRight size={16} />
          </Link>
        </Reveal>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '76px 24px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        {/* En FAQ-lista breddad till 1300px hade blivit löjligt gles
            (fråga vänsterjusterad, chevron ute vid högerkanten, hav av
            tomt mellanrum) — accordions är en läslista, hålls kompakta men
            fluid (min(vw,px)) så den ändå andas mer på ett halv-skärms-
            fönster än den tidigare fasta 760px gjorde. */}
        <div style={{ maxWidth: 'min(92vw, 1240px)', margin: '0 auto', position: 'relative' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.4vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              Vanliga frågor
            </h2>
            <p style={{ fontSize: '18px', color: MUTED }}>Det mesta du undrar över innan du sätter igång.</p>
          </Reveal>

          <Reveal scale style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: '8px 34px', boxShadow: '0 20px 40px -26px rgba(28,36,32,0.22), 0 2px 10px rgba(28,36,32,0.05)' }}>
            {/* Två spalter först över 1100px (se .lp-faq-grid), och som TVÅ
                egna staplar — inte ett rutnät med en fråga per cell. I ett
                rutnät växer hela raden när ett svar fälls ut, så grannfrågan
                får ett tomt hål under sig. Under brytpunkten ligger
                spalterna på varandra och ordningen blir densamma som förut. */}
            <div className="lp-faq-grid">
              {[FAQ_ITEMS.slice(0, FAQ_SPLIT), FAQ_ITEMS.slice(FAQ_SPLIT)].map((column, c) => (
                <div key={c}>
                  {column.map((item, j) => {
                    const i = c === 0 ? j : j + FAQ_SPLIT;
                    return (
                      <FaqItem key={item.q} item={item} index={i} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} accent={FAQ_ACCENT} />
                    );
                  })}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Egen fristående yta, inte en sektion i sidflödet ovan — se
          DemoOverlay:s egen kommentar högst upp i filen. */}
      {showDemo && <DemoOverlay onClose={closeDemo} />}
    </MarketingLayout>
  );
}
