import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Landmark, Receipt, FileSpreadsheet, Briefcase, Users, BarChart3, ShieldCheck, FileDown } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { GRAD, grad, AuroraLayer } from './aurora';
import { IllBokforing, IllFakturering, IllSkatt, IllPersonal } from './featureIllustrations';
import { PageMeta, JsonLd } from '../../utils/seo';

// Fördjupad version av startsidans fyra kolumner — samma fyra riktiga
// huvudsektioner (se globala sidomenyn i App.jsx), nu med de faktiska
// delfunktionerna under varje, inte bara en rad sammanfattning. Samma
// handritade illustrationer och accentfärger som Startsidans funktionskort
// (se marketingTokens.js/featureIllustrations.jsx) — större här, eftersom
// den här sidan ÄR funktionerna, inte en teaser till dem.
const SECTIONS = [
  {
    art: IllBokforing, accentKey: 'green', title: 'Bokföring',
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
    art: IllFakturering, accentKey: 'blue', title: 'Fakturering',
    desc: 'Kund- och leverantörsfakturor i samma flöde, med ditt eget varumärke på fakturan.',
    points: [
      'Fyra fakturamallar (Klassisk, Kraftfull, Minimal, Rutnät) med egen logotyp och accentfärg',
      'Leverantörsfakturor registreras snabbt och bokförs automatiskt när konto är valt',
      'Kortbetalningar direkt på fakturan via Stripe',
      'ROT- och RUT-avdrag räknas på arbetskostnaden och visas både på fakturan och i underlaget till Skatteverket',
      'Automatiska betalningspåminnelser till kunden när en faktura passerat förfallodatum',
      'Utskick från din egen e-postdomän, inte en delad avsändaradress',
      'PDF-export som alltid matchar exakt det du ser i förhandsvisningen',
    ],
  },
  {
    art: IllSkatt, accentKey: 'red', title: 'Skatt och bokslut',
    desc: 'Det som faktiskt ska in rätt hos Skatteverket, förberett åt dig men aldrig skickat automatiskt utan din signatur.',
    points: [
      'Momsdeklaration ruta för ruta — som PDF, och som eSKD-fil att ladda upp hos Skatteverket',
      'AGI-sammanställning per lönekörning',
      'Kontrolluppgifter (KU) sammanställda per anställd och år',
      'Inkomstdeklaration 2: räkenskapsschema (INK2R) och skattemässiga justeringar (INK2S), med SRU-filer',
      'Påminnelse i god tid före varje moms- och AGI-deadline',
      'Ett bokslutsflöde som stämmer av och låser räkenskapsåret',
    ],
  },
  {
    art: IllPersonal, accentKey: 'green', title: 'Personal',
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
  {
    icon: Landmark, accentKey: 'blue', title: 'Bank',
    body: 'Importera kontoutdrag som CSV eller Excel, matcha raderna mot dina kund- och leverantörsfakturor och bokför direkt. Själva filen sparas aldrig — bara de transaktionsrader du bokför.',
  },
  {
    icon: Receipt, accentKey: 'green', title: 'Utgifter och kvitton',
    body: 'Registrera kvitton och leverantörsfakturor med underlaget bifogat. Saknas konto hamnar posten i Granskning i stället för att bokföras fel.',
  },
  {
    icon: FileSpreadsheet, accentKey: 'red', title: 'Offerter',
    body: 'Skriv offerter i samma mall som dina fakturor och konvertera dem till faktura med ett klick när kunden tackat ja.',
  },
  {
    icon: Briefcase, accentKey: 'blue', title: 'Projekt',
    body: 'Följ lönsamhet, tid och kostnader per projekt, så du ser vilket uppdrag som faktiskt bär sig.',
  },
  {
    icon: Users, accentKey: 'green', title: 'Kunder och kontakter',
    body: 'Ett register för kunder och leverantörer som fylls i åt dig från organisationsnumret och följer med till fakturor, offerter och projekt.',
  },
  {
    icon: BarChart3, accentKey: 'red', title: 'Rapport och analys',
    body: 'Resultat- och balansräkning, kassaflöde, nyckeltal, huvudbok, momsrapport, fakturarapporter och färdiga års-, kvartals- och månadssammanställningar.',
  },
  {
    icon: ShieldCheck, accentKey: 'blue', title: 'Konto och behörighet',
    body: 'Tvåfaktorsautentisering med valfri autentiseringsapp, upp till tre användare per företag med inbjudan, och flera företag på samma inloggning.',
  },
  {
    icon: FileDown, accentKey: 'green', title: 'Filformat och export',
    body: 'SIE4, eSKD, SRU, ISO 20022, PDF och CSV. Hela listan över vad Bokix läser och skriver — och vad det inte gör — står på Integrationer.',
    to: '/integrationer',
  },
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
        description="Allt som ingår i Bokix: löpande bokföring med full BAS-kontoplan, fakturor med ROT/RUT, offerter, projekt, bankimport, lönekörning med betalfil, moms- och AGI-underlag och elva rapporter — i ett verktyg."
        path="/funktioner"
      />
      <JsonLd data={FEATURE_LIST_SCHEMA} />
      <section style={{ padding: '150px 24px 80px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.18)', '4% -8%'], ['rgba(132,204,22,0.16)', '98% 108%']]}
          blob={{ gradient: grad(GRAD.blueTeal), top: '-160px', left: '-110px', size: '460px', opacity: 0.2 }}
        />
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.14 }}>
            Allt du behöver, ingenting du inte behöver
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            Bokix är byggt kring fyra saker ett svenskt företag faktiskt gör varje månad. Här står de i sin helhet — och längst ner allt annat som ingår, utan tillägg att köpa till.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '20px 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {SECTIONS.map((s, i) => {
            const accent = ACCENT[s.accentKey];
            return (
              <Reveal key={s.title} delay={i * 80} className="lp-card-hover" style={{
                display: 'grid', gridTemplateColumns: '164px 1fr', gap: '28px', alignItems: 'stretch',
                background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', overflow: 'hidden',
                boxShadow: CARD_SHADOW,
              }}>
                <div style={{ background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
                  <s.art accent={accent} />
                </div>
                <div style={{ padding: '32px 32px 32px 0' }}>
                  <h2 style={{ fontSize: '21px', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{s.title}</h2>
                  <p style={{ fontSize: '14.5px', color: MUTED, margin: '0 0 18px', lineHeight: 1.6 }}>{s.desc}</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '9px 24px' }}>
                    {s.points.map(p => (
                      <div key={p} style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.55 }}>{p}</div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Resten av verktyget — se kommentaren vid MORE. */}
      <section style={{ padding: '0 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: INK, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Och resten av verktyget
            </h2>
            <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.7, margin: '0 0 26px', maxWidth: '640px' }}>
              Samma pris, ingen av dem är ett tillägg. Allt nedan är sidor som finns i appen i dag — inget som är på väg.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {MORE.map((m, i) => {
              const accent = ACCENT[m.accentKey];
              const card = (
                <>
                  <span style={{ width: 36, height: 36, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    <m.icon size={17} />
                  </span>
                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: '0 0 7px', letterSpacing: '-0.005em' }}>
                    {m.title}
                  </h3>
                  <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{m.body}</p>
                  {m.to && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: BRAND.greenDark }}>
                      Se alla filformat <ArrowRight size={14} />
                    </span>
                  )}
                </>
              );
              const style = {
                display: 'block', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px', padding: '22px 24px', textDecoration: 'none',
              };
              return (
                <Reveal key={m.title} delay={i * 40} className="lp-card-hover" style={style}>
                  {m.to ? <Link to={m.to} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>{card}</Link> : card}
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 24px', background: IVORY, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.14)', '96% 100%'], ['rgba(20,184,166,0.16)', '4% 0%']]}
          blob={{ gradient: grad(GRAD.tealLime), bottom: '-140px', top: 'auto', right: '-100px', left: 'auto', size: '380px', opacity: 0.18, slow: true }}
        />
        <Reveal style={{ position: 'relative' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Allt ovan ingår
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '28px' }}>
            Inga tillägg per funktion. Två priser, beroende på om du har personal på lönelistan — lönedelen är det enda som skiljer nivåerna åt.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={enterApp} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Prova gratis</button>
            <Link to="/priser" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Se prissättning <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
