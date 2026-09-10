import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, FileSpreadsheet, XCircle } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { AuroraLayer } from './aurora';
import { StripeIconLogo, ZettleLogo, BolagsverketLogo, SkatteverketLogo, BasLogo } from '../shared/BrandLogos';
import FormatExchange from './FormatExchange';
import { PageMeta, JsonLd } from '../../utils/seo';

// ── Integrationer och filformat (/integrationer) ────────────────────────
// Startsidans kopplingsdiagram visar FYRA logotyper i en snygg graf. Den
// här sidan är svaret på nästa fråga: "ja, men vad betyder det konkret —
// kan jag flytta in min gamla bokföring, och kan jag flytta ut den igen?"
//
// Två regler för innehållet här, samma som pricingTiers.js redan följer:
//   1. Bara sådant som FAKTISKT finns i produkten. Varje rad nedan går att
//      peka ut i koden (sieImport.js, salaryPaymentFile.js,
//      vatDeclarationExport.js, bankImport.js, companyLookup.js …).
//   2. Det vi INTE har står också, med namn. En besökare som kommer från
//      Fortnox letar efter bankkoppling — får hen inte veta att den
//      saknas här, får hen veta det efter att ha registrerat sig, och då
//      är det ett svek i stället för ett aktivt val.

const CONNECTIONS = [
  {
    key: 'stripe',
    Logo: StripeIconLogo,
    logoHeight: 26,
    name: 'Stripe',
    kind: 'Betalningar',
    accentKey: 'blue',
    body: 'Anslut ditt Stripe-konto och låt kunden betala fakturan med kort direkt från fakturalänken. Betalningen matchas mot rätt faktura och bokförs, med Stripes avgift som en egen kostnadspost i stället för en oförklarad differens.',
  },
  {
    key: 'zettle',
    Logo: ZettleLogo,
    logoHeight: 22,
    name: 'Zettle by PayPal',
    kind: 'Kassaförsäljning',
    accentKey: 'green',
    body: 'Säljer du i butik, på marknad eller i mässmontern kopplas kassaförsäljningen in i samma bokföring som fakturorna, i stället för att bokföras separat i efterhand.',
  },
  {
    key: 'bolagsverket',
    Logo: BolagsverketLogo,
    logoHeight: 34,
    name: 'Bolagsverket',
    kind: 'Företagsuppgifter',
    accentKey: 'teal',
    body: 'Företagsnamn, bolagsform, adress och registreringsuppgifter hämtas automatiskt från organisationsnumret när du skapar ditt konto. Bolagsformen avgör i sin tur vilka bokföringsregler som gäller — du slipper välja regelverk själv.',
  },
  {
    key: 'skatteverket',
    Logo: SkatteverketLogo,
    logoHeight: 34,
    name: 'Skatteverket',
    kind: 'Deklarationsunderlag',
    accentKey: 'red',
    body: 'Bokix bygger Skatteverkets egna filformat: eSKD för momsdeklarationen och SRU för inkomstdeklarationens räkenskapsscheman. Filerna laddar du själv upp och signerar hos Skatteverket — ingenting skickas i ditt namn automatiskt.',
  },
  {
    key: 'bas',
    Logo: BasLogo,
    logoHeight: 30,
    name: 'BAS-kontoplanen',
    kind: 'Standard',
    accentKey: 'green',
    body: 'Hela den svenska BAS-kontoplanen ligger inbyggd och sökbar. Det är samma kontoplan din revisor, din bank och nästa bokföringsprogram utgår från, vilket är förutsättningen för att en SIE-fil ska betyda samma sak överallt.',
  },
];

const IMPORTS = [
  {
    label: 'SIE4-fil',
    title: 'SIE4-fil från ditt gamla program',
    body: 'Kontoplan, verifikationer och ingående saldon läses in ur filen. SIE4 är en svensk standard, så Bokix läser filen — inte programmet den kom ur.',
    meta: 'SIE4I och SIE4E · .se-fil',
  },
  {
    label: 'Kontoutdrag',
    title: 'Kontoutdrag från banken',
    body: 'Ladda upp bankens CSV- eller Excel-export så tolkas kolumnerna automatiskt, oavsett om banken exporterar semikolon, kommatecken, en signerad beloppskolumn eller separata uttag och insättningar. Den föreslagna kolumnmappningen visas för godkännande innan något importeras.',
    meta: 'CSV och XLSX · UTF-8 eller Windows-1252',
  },
  {
    label: 'Kvitton och fakturor',
    title: 'Kvitton och leverantörsfakturor',
    body: 'Ladda upp underlaget och registrera posten direkt mot rätt konto. Underlaget ligger kvar kopplat till verifikationen, så det går att ta fram vid en granskning utan att leta i en pärm.',
    meta: 'PDF, JPG och PNG',
  },
  {
    label: 'Kundregister',
    title: 'Kunder och artiklar',
    body: 'Kundregister och artikellistor kan läsas in från CSV i stället för att skrivas in en rad i taget vid uppstart.',
    meta: 'CSV',
  },
];

const EXPORTS = [
  {
    label: 'SIE4-export',
    title: 'SIE4-export av hela bokföringen',
    body: 'Hela räkenskapsåret med kontoplan, verifikationer samt ingående och utgående balanser. Ge filen till din revisor, eller ta med den till ett annat program. Din bokföring är din, alltid.',
    meta: 'SIE4E · .se-fil',
  },
  {
    label: 'eSKD',
    title: 'Momsdeklaration som eSKD-fil',
    body: 'Momsdeklarationen byggs som Skatteverkets eget XML-format och laddas upp direkt i e-tjänsten, i stället för att siffrorna knappas in för hand ruta för ruta.',
    meta: 'eSKD · XML',
  },
  {
    label: 'Betalfil',
    title: 'Betalfil till banken',
    body: 'Nettolönerna i en lönekörning som en riktig ISO 20022-fil (pain.001), samma format de flesta svenska företagsbanker tar emot för filbaserade utbetalningar. Kräver IBAN och BIC per anställd.',
    meta: 'ISO 20022 pain.001.001.03 · XML',
  },
  {
    label: 'SRU',
    title: 'Räkenskapsscheman som SRU',
    body: 'Balans- och resultaträkning enligt INK2R, med fältkoder ur BAS-intressenternas officiella kopplingstabell, som SRU-filer till inkomstdeklarationen.',
    meta: 'INFO.SRU och BLANKETTER.SRU',
  },
  {
    label: 'PDF',
    title: 'PDF på allt du skickar vidare',
    body: 'Fakturor, lönebesked, AGI-sammanställningar, kontrolluppgifter och rapporter. PDF:en är alltid identisk med förhandsvisningen du godkände.',
    meta: 'PDF',
  },
  {
    label: 'CSV',
    title: 'Rapporter och register som CSV',
    body: 'Listvyer och rapporter går att ta ut som CSV för egen analys i Excel eller Google Kalkylark.',
    meta: 'CSV med BOM, öppnas rätt i svensk Excel',
  },
];

// Det vi inte har. Står på sidan med flit — se filkommentaren ovan.
const NOT_YET = [
  {
    title: 'Direkt bankkoppling (PSD2)',
    body: 'Bokix hämtar inte transaktioner automatiskt från din bank. Du importerar kontoutdraget som fil i stället, vilket tar någon minut i månaden. Vi säger hellre det rakt ut än beskriver en filimport som en "bankintegration".',
  },
  {
    title: 'Automatisk inlämning till Skatteverket',
    body: 'Bokix bygger filerna, men skickar dem aldrig i ditt namn. Uppladdning och signering gör du själv i Skatteverkets e-tjänst — en deklaration ska aldrig lämnas in utan att någon faktiskt tittat på den.',
  },
  {
    title: 'Kvittotolkning med AI (OCR)',
    body: 'Kvitton laddas upp och kopplas till posten, men beloppen läses inte av automatiskt ur bilden ännu.',
  },
  {
    title: 'Öppet API',
    body: 'Det finns inget publikt API att bygga egna integrationer mot i dag. SIE- och CSV-exporterna är vägen ut för den som vill flytta data till ett eget system.',
  },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  name: 'Integrationer och filformat i Bokix',
  itemListElement: [...CONNECTIONS.map(c => ({ name: c.name, description: c.body })), ...IMPORTS, ...EXPORTS].map((x, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: { '@type': 'Thing', name: x.name || x.title, description: x.body },
  })),
};


export default function IntegrationsPage() {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <PageMeta
        title="Integrationer och filformat — SIE, eSKD, ISO 20022, Stripe | Bokix"
        description="Vad Bokix kopplas ihop med och vilka filformat som stöds: SIE4-import och export, bankens CSV/Excel, Skatteverkets eSKD och SRU, betalfil till banken (ISO 20022), Stripe och Zettle."
        path="/integrationer"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-int-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
        @media (max-width: 860px) { .bx-int-grid { grid-template-columns: 1fr; gap: 18px; } }
      `}</style>

      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer stops={[['rgba(14,165,233,0.16)', '3% -8%'], ['rgba(20,184,166,0.14)', '98% 106%']]} />
        <Reveal style={{ maxWidth: '740px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 4.6vw, 48px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.15 }}>
            Kopplat till det du redan använder
          </h1>
          <p style={{ fontSize: '16.5px', color: MUTED, lineHeight: 1.7, margin: 0 }}>
            Betalningar, myndigheter och de filformat svensk bokföring faktiskt bygger på — plus en ärlig lista över det vi ännu inte har.
          </p>
        </Reveal>
      </section>

      {/* ── Riktiga kopplingar ── */}
      <section style={{ padding: '0 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div className="bx-int-grid" style={{ maxWidth: '900px', margin: '0 auto' }}>
          {CONNECTIONS.map((c, i) => {
            const accent = ACCENT[c.accentKey] || ACCENT.green;
            return (
              <Reveal key={c.key} delay={i * 60} className="lp-card-hover" style={{
                background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px',
                padding: '24px 26px', boxShadow: CARD_SHADOW,
                gridColumn: i === CONNECTIONS.length - 1 && CONNECTIONS.length % 2 === 1 ? '1 / -1' : undefined,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '14px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', height: 38 }}>
                    <c.Logo height={c.logoHeight} />
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: accent.fg, background: accent.soft, padding: '5px 10px', borderRadius: '7px', whiteSpace: 'nowrap' }}>
                    {c.kind}
                  </span>
                </div>
                <h2 style={{ fontSize: '17px', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.01em' }}>{c.name}</h2>
                <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{c.body}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── In och ut ── */}
      <section style={{ padding: '70px 24px', background: IVORY, borderTop: `1px solid var(--mkt-border-soft)`, marginTop: '50px' }}>
        <div style={{ maxWidth: '940px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 9px' }}>
              Tio filformat, in och ut
            </h2>
            <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.6, margin: 0, maxWidth: '540px', marginLeft: 'auto', marginRight: 'auto' }}>
              Välj ett så står det vad det är och vad det används till.
            </p>
          </Reveal>
          <Reveal scale delay={60}>
            <FormatExchange imports={IMPORTS} exports={EXPORTS} />
          </Reveal>
        </div>
      </section>

      {/* ── Ärlighetsavsnittet ── */}
      <section style={{ padding: '70px 24px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal style={{ maxWidth: '900px', margin: '0 auto', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: 'clamp(26px, 4.5vw, 40px)', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <span style={{ width: 38, height: 38, borderRadius: '11px', background: ACCENT.red.soft, color: ACCENT.red.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <XCircle size={18} />
            </span>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.01em' }}>Det här har vi inte</h2>
          </div>
          <p style={{ fontSize: '14.5px', color: MUTED, lineHeight: 1.65, margin: '0 0 22px' }}>
            Fyra saker konkurrenter har som Bokix inte har. Du ska kunna välja bort oss på rätt grund, inte upptäcka det efter att du flyttat in din bokföring.
          </p>
          <div className="bx-int-grid">
            {NOT_YET.map(item => (
              <div key={item.title} style={{ background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '18px 20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 6px' }}>{item.title}</h3>
                <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{item.body}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Byta program ── */}
      <section style={{ padding: '70px 24px 100px', background: IVORY, borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal scale style={{ maxWidth: '900px', margin: '0 auto', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '22px', padding: 'clamp(28px, 5vw, 46px)', textAlign: 'center', boxShadow: CARD_SHADOW }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '18px', padding: '8px 15px', borderRadius: '999px', background: ACCENT.blue.soft, color: ACCENT.blue.fg, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '13px', fontWeight: 700 }}>
            <FileSpreadsheet size={15} /> bokforing-2026.se
          </div>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.4vw, 32px)', fontWeight: 700, color: INK, margin: '0 0 12px', letterSpacing: '-0.01em' }}>
            Byter du från ett annat program?
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.7, margin: '0 auto 26px', maxWidth: '560px' }}>
            Exportera en SIE4-fil ur ditt nuvarande program och läs in den i Bokix. Kontoplan, verifikationer och ingående saldon följer med — du börjar inte om från noll mitt i ett räkenskapsår.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis
            </button>
            <Link to="/byt-bokforingsprogram" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Så går bytet till <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
