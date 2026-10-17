import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import FeatureChainFlow from './FeatureChainFlow';
import InvoiceFlow from './InvoiceFlow';
import DemoPlayer, { DemoStyles } from './DemoPlayer';
import { BOKFORING_DEMO, FAKTURERING_DEMO, SKATT_DEMO, LON_DEMO } from './demoScenesFeatures';
import { KitStyles, SubHero, KitSection, SpecList, PointList, KitCta, PrimaryButton, GhostLink, ProductShots } from './subpageKit';
import { shotsFor } from '../../content/marketing/screenshots';
import { PageMeta, JsonLd } from '../../utils/seo';

// Bokföring & fakturering (/funktioner). Omgjord 2026-09-26 (kundönskemål:
// solida ytor, inga ikoner, en egen animation per sida): hjälten visar en
// faktura som betalas och bokförs (InvoiceFlow), sedan en tvåspaltig rad per
// huvuddel (subpageKit.jsx). Skärmbilderna är riktiga, tagna ur appen med
// exempeldata. Sedan 2026-09-26 visar varje del en demo (DemoPlayer +
// demoScenesFeatures.jsx) i stället för en skärmbild, på kundens begäran.
const SECTIONS = [
  {
    id: 'bokforing', demo: BOKFORING_DEMO, title: 'Bokföring',
    desc: 'Löpande bokföring som sköter sig själv när den kan, och flaggar tydligt när den inte kan.',
    points: [
      'Verifikationer bokförs automatiskt utifrån kvitton, fakturor och lönekörningar',
      'Full kontoplan (BAS) med sökbara konton',
      'Granskning samlar allt som saknar kontering på ett ställe, med kontoförslag ur dina egna tidigare bokföringar',
      'SIE4-import av en befintlig bokföring, och SIE4-export när du vill ta med dig allt',
      'Låsning av räkenskapsår vid bokslut',
    ],
  },
  {
    id: 'fakturering', demo: FAKTURERING_DEMO, title: 'Fakturering',
    desc: 'Kund- och leverantörsfakturor i samma flöde, med ditt eget varumärke på fakturan.',
    points: [
      'Fyra fakturamallar (Klassisk, Kraftfull, Minimal, Rutnät) med egen logotyp och accentfärg',
      'Leverantörsfakturor registreras snabbt och bokförs automatiskt när konto är valt',
      'Kortbetalningar direkt på fakturan via Stripe',
      'Stripe-försäljning, avgifter och utbetalningar hämtas in varje morgon',
      'ROT- och RUT-avdrag räknas på arbetskostnaden och visas både på fakturan och i underlaget till Skatteverket',
      'Automatiska betalningspåminnelser till kunden när en faktura passerat förfallodatum',
      'Utskick från din egen e-postdomän, inte en delad avsändaradress',
      'PDF-export som alltid matchar exakt det du ser i förhandsvisningen',
    ],
  },
  {
    id: 'skatt', demo: SKATT_DEMO, title: 'Skatt och bokslut',
    desc: 'Det som faktiskt ska in rätt hos Skatteverket, förberett åt dig men aldrig skickat automatiskt utan din signatur.',
    points: [
      'Momsdeklaration ruta för ruta, som PDF, och som eSKD-fil att ladda upp hos Skatteverket',
      'AGI-fil per lönekörning att ladda upp hos Skatteverket, med arbetsgivaravgift efter ålder',
      'Kontrolluppgifter (KU) sammanställda per anställd och år',
      'Inkomstdeklaration 2: räkenskapsschema (INK2R) ifyllt ur bokföringen, med SRU-filer',
      'Påminnelse i god tid före varje moms- och AGI-deadline',
      'Ett bokslutsflöde som stämmer av och låser räkenskapsåret',
    ],
  },
  {
    id: 'personal', aliasId: 'lon', demo: LON_DEMO, title: 'Lön & personal',
    desc: 'Lönekörning med rätt skatteavdrag från start, inte en gissning som rättas i efterhand.',
    points: [
      'Automatiskt skatteavdrag enligt Skatteverkets skattetabeller',
      'Lönebesked som PDF per anställd',
      'Semesteravsättning och arbetsgivaravgifter beräknade per körning',
      'Betalfil till banken för nettolönerna (ISO 20022 pain.001)',
      'Flera anställda i samma lönekörning, en tydlig sammanställning för hela företaget',
    ],
  },
];

// Resten av appens sidor. De fyra sektionerna ovan är produktens tyngdpunkt,
// men sidan påstod sig visa "allt som ingår" och hoppade ändå över halva
// vänstermenyn (Bank, Offerter, Projekt, Kunder, Rapport och analys,
// kontodelen) — kundönskemål: ha med allt Bokix faktiskt erbjuder. De får
// ett kompakt rutnät i stället för egna illustrerade sektioner, eftersom de
// är verkliga men mindre delar: ingen ny illustration behöver hittas på, och
// listan går att fylla på utan att sidans rytm bryts.
//
// Varje rad nedan motsvarar en RIKTIG sida eller funktion i appen
// (App.jsx:s meny) — inget som "planeras".
const MORE = [
  { motif: 'bank', title: 'Bank', body: 'Läs in kontoutdraget, matcha raderna, bokför.' },
  { motif: 'kvitton', title: 'Utgifter och kvitton', body: 'Underlaget sitter kvar på verifikationen.' },
  { motif: 'offerter', title: 'Offerter', body: 'Blir faktura med ett klick när kunden tackat ja.' },
  { motif: 'projekt', title: 'Projekt', body: 'Se vilket uppdrag som faktiskt bär sig.' },
  { motif: 'kunder', title: 'Kunder och kontakter', body: 'Fylls i från organisationsnumret.' },
  { motif: 'rapporter', title: 'Rapport och analys', body: 'Resultat, balans, kassaflöde, huvudbok, nyckeltal.' },
  { motif: 'konto', title: 'Konto och behörighet', body: 'Tvåfaktor, tre användare, flera företag.' },
  { motif: 'format', title: 'Filformat och export', body: 'SIE4, eSKD, SRU, ISO 20022, PDF och CSV.', to: '/integrationer' },
];

// ItemList-schema byggt direkt av SECTIONS + MORE ovan — exakt det sidan
// visar, aldrig en egen dubblettlista. Ger Google/AI-svarsmotorer en
// strukturerad lista över vad produkten faktiskt gör, inte bara brödtext.
// MORE är med av samma skäl som den finns på sidan: en lista som utelämnar
// halva produkten är sämre indata än ingen lista alls.
const FEATURE_LIST_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'ItemList',
  itemListElement: [
    ...SECTIONS.map(s => ({ name: s.title, description: [s.desc, ...s.points].join(' ') })),
    ...MORE.map(m => ({ name: m.title, description: m.body })),
  ].map((entry, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: { '@type': 'Thing', ...entry },
  })),
};

export default function FeaturesPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  return (
    <MarketingLayout>
      <PageMeta
        title="Funktioner: bokföring, fakturering, lön och moms | Bokix"
        description="Allt som ingår i Bokix: bokföring med BAS-kontoplan, fakturor med ROT/RUT, offerter, projekt, bankimport, lön, moms, AGI och elva rapporter."
        path="/funktioner"
      />
      <JsonLd data={FEATURE_LIST_SCHEMA} />
      <KitStyles />
      <DemoStyles />
      <style>{`
        .bx-ft-points { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 40px; max-width: 820px; margin: 44px auto 0; }
        @media (max-width: 700px) { .bx-ft-points { grid-template-columns: 1fr; } .bx-ft-points .kx-list + .kx-list { border-top: none; } }
      `}</style>

      <SubHero
        eyebrow="Bokföring & fakturering"
        title="Du fakturerar. Bokföringen följer med."
        lead="Kvitton, fakturor, moms och bokslut i ett och samma verktyg. Det som går att bokföra automatiskt gör det, och det som är osäkert hamnar i Granskning med ett förslag i stället för en gissning."
        actions={<>
          <PrimaryButton onClick={enterApp}>Prova gratis</PrimaryButton>
          <GhostLink to="/priser">Se priser</GhostLink>
        </>}
        visual={<InvoiceFlow />}
      />

      {/* ── Sambandet: en händelse, tre ställen ── */}
      <section className="kx-section" style={{ background: 'var(--mkt-ivory)' }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 className="kx-h2">Allt hänger ihop</h2>
            <p className="kx-sub" style={{ maxWidth: '520px', margin: '0 auto' }}>
              Det är därför det är ett verktyg och inte fyra. Du gör en sak, resten följer med.
            </p>
          </Reveal>
          <Reveal scale delay={60}>
            <FeatureChainFlow />
          </Reveal>
        </div>
      </section>

      {SECTIONS.map((sec, i) => (
        <section key={sec.id} id={sec.id} className="kx-section" style={{ background: i % 2 ? 'var(--mkt-ivory)' : 'var(--mkt-page-bg)', scrollMarginTop: '84px' }}>
          {sec.aliasId && <div id={sec.aliasId} />}
          <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 40px' }}>
            <h2 className="kx-h2" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>{sec.title}</h2>
            <p className="kx-sub" style={{ fontSize: '17px' }}>{sec.desc}</p>
          </Reveal>
          <Reveal scale delay={60}>
            <DemoPlayer steps={sec.demo} stepMs={7000} label={`Demo: ${sec.title}`} />
          </Reveal>
          <Reveal delay={80} className="bx-ft-points">
            <PointList items={sec.points.slice(0, Math.ceil(sec.points.length / 2))} />
            <PointList items={sec.points.slice(Math.ceil(sec.points.length / 2))} />
          </Reveal>
          {sec.id === 'personal' && (
            <p style={{ textAlign: 'center', marginTop: '24px' }}>
              <Link to="/lon" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 700, textDecoration: 'none' }}>Mer om lön och arbetsgivare →</Link>
            </p>
          )}
        </section>
      ))}

      <KitSection title="Och resten av verktyget" lead="Samma pris, inget tillägg. Allt nedan finns i appen i dag." alt>
        <SpecList items={MORE.map(m => ({ title: m.title, body: m.body }))} />
        <p className="kx-row-body" style={{ marginTop: '18px' }}>
          <Link to="/integrationer" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 700, textDecoration: 'none' }}>Se alla filformat och kopplingar →</Link>
        </p>
      </KitSection>

      <ProductShots shots={shotsFor('/funktioner')} lead="Riktiga bilder ur appen, med exempeldata." />

      <KitCta title="Allt ovan ingår" lead="Inga tillägg per funktion. Två priser, beroende på om du har personal på lönelistan.">
        <PrimaryButton onClick={enterApp}>Prova gratis</PrimaryButton>
        <GhostLink to="/priser">Se priser</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
