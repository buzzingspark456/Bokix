import React from 'react';
import { useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, SubHero, KitSection, CenterSection, SpecList, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import IntegrationFeed from './IntegrationFeed';
import DemoPlayer, { DemoStyles } from './DemoPlayer';
import { makeIntegrationDemo } from './demoScenesOther';
import { StripeIconLogo, ZettleLogo, GmailLogo, BolagsverketLogo, SkatteverketLogo, BasLogo } from '../shared/BrandLogos';
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
    body: 'Anslut ditt Stripe-konto och låt kunden betala fakturan med kort direkt från fakturalänken. Betalningen matchas mot rätt faktura och bokförs, med Stripes avgift som en egen kostnadspost i stället för en oförklarad differens.',
  },
  {
    key: 'zettle',
    Logo: ZettleLogo,
    logoHeight: 22,
    name: 'Zettle by PayPal',
    kind: 'Kassaförsäljning',
    body: 'Säljer du i butik, på marknad eller i mässmontern kopplas kassaförsäljningen in i samma bokföring som fakturorna, i stället för att bokföras separat i efterhand.',
  },
  {
    key: 'gmail',
    Logo: GmailLogo,
    logoHeight: 24,
    name: 'Gmail',
    kind: 'E-post',
    body: 'Koppla ditt Gmail-konto så går fakturor, offerter och påminnelser från din egen adress, och svaren hamnar i din inkorg. Bokix får bara rätt att skicka e-post, aldrig att läsa den. Mejl på egen domän kopplas med ett app-lösenord.',
  },
  {
    key: 'bolagsverket',
    Logo: BolagsverketLogo,
    logoHeight: 34,
    name: 'Bolagsverket',
    kind: 'Företagsuppgifter',
    body: 'Företagsnamn, bolagsform, adress och registreringsuppgifter hämtas automatiskt från organisationsnumret när du skapar ditt konto. Bolagsformen avgör i sin tur vilka bokföringsregler som gäller — du slipper välja regelverk själv.',
  },
  {
    key: 'skatteverket',
    Logo: SkatteverketLogo,
    logoHeight: 34,
    name: 'Skatteverket',
    kind: 'Deklarationsunderlag',
    body: 'Bokix bygger Skatteverkets egna filformat: eSKD för momsdeklarationen och SRU för inkomstdeklarationens räkenskapsscheman. Filerna laddar du själv upp och signerar hos Skatteverket — ingenting skickas i ditt namn automatiskt.',
  },
  {
    key: 'bas',
    Logo: BasLogo,
    logoHeight: 30,
    name: 'BAS-kontoplanen',
    kind: 'Standard',
    body: 'Hela den svenska BAS-kontoplanen ligger inbyggd och sökbar. Det är samma kontoplan din revisor, din bank och nästa bokföringsprogram utgår från, vilket är förutsättningen för att en SIE-fil ska betyda samma sak överallt.',
  },
];

const INTEGRATION_DEMO = makeIntegrationDemo(CONNECTIONS);

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
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });

  return (
    <MarketingLayout>
      <PageMeta
        title="Integrationer: Stripe, Zettle, Gmail och SIE | Bokix"
        description="Vad Bokix kopplas ihop med: Stripe, Zettle och Gmail, SIE4-import och export, kontoutdrag från banken, Skatteverkets eSKD och SRU samt betalfil."
        path="/integrationer"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <DemoStyles />

      <SubHero
        eyebrow="Integrationer"
        title="Kopplat till det du redan använder"
        lead="Betalningar, myndigheter och de filformat svensk bokföring faktiskt bygger på. Plus en ärlig lista över det vi ännu inte har."
        actions={<>
          <PrimaryButton onClick={enterApp}>Prova gratis</PrimaryButton>
          <GhostLink href="#inte">Det här har vi inte</GhostLink>
        </>}
        visual={<IntegrationFeed />}
      />

      <CenterSection title="Kopplingar" lead="Fem saker Bokix pratar med. Så här ser det ut när de gör sitt jobb.">
        <DemoPlayer steps={INTEGRATION_DEMO} label="Demo: Bokix kopplingar" />
      </CenterSection>

      <section className="kx-section" style={{ background: 'var(--mkt-ivory)' }}>
        <div style={{ maxWidth: '940px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '34px' }}>
            <h2 className="kx-h2">Tio filformat, in och ut</h2>
            <p className="kx-sub">Välj ett så står det vad det är och vad det används till.</p>
          </Reveal>
          <Reveal scale delay={60}>
            <FormatExchange imports={IMPORTS} exports={EXPORTS} />
          </Reveal>
        </div>
      </section>

      <KitSection id="inte" title="Det här har vi inte" lead="Du ska kunna välja bort oss på rätt grund, inte upptäcka det efter att du flyttat in din bokföring.">
        <SpecList items={NOT_YET} />
      </KitSection>

      <KitCta title="Byter du från ett annat program?" lead="Exportera en SIE4-fil ur ditt nuvarande program och läs in den i Bokix. Kontoplan, verifikationer och ingående saldon följer med.">
        <PrimaryButton onClick={enterApp}>Prova gratis</PrimaryButton>
        <GhostLink to="/byt-bokforingsprogram">Så går bytet till</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
