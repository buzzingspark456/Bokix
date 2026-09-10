import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { GRAD, grad, AuroraLayer } from './aurora';
import FeatureChainFlow from './FeatureChainFlow';
import { FeatureDemoStyles, DemoBokforing, DemoFakturering, DemoSkatt, DemoPersonal } from './featureDemos';
import ToolMotif, { ToolMotifStyles } from './toolMotifs';
import { PageMeta, JsonLd } from '../../utils/seo';

// Fördjupad version av startsidans fyra kolumner — samma fyra riktiga
// huvudsektioner (se globala sidomenyn i App.jsx), nu med de faktiska
// delfunktionerna under varje, inte bara en rad sammanfattning. Samma
// handritade illustrationer och accentfärger som Startsidans funktionskort
// (se marketingTokens.js/featureIllustrations.jsx) — större här, eftersom
// den här sidan ÄR funktionerna, inte en teaser till dem.
const SECTIONS = [
  {
    id: 'bokforing', demo: DemoBokforing, accentKey: 'green', title: 'Bokföring',
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
    id: 'fakturering', demo: DemoFakturering, accentKey: 'blue', title: 'Fakturering',
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
    id: 'skatt', demo: DemoSkatt, accentKey: 'red', title: 'Skatt och bokslut',
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
    id: 'personal', demo: DemoPersonal, accentKey: 'green', title: 'Personal',
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
];;

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
      <FeatureDemoStyles />
      <ToolMotifStyles />
      <style>{`
        /* Sektionsraden: illustrationsplattan och texten. Byter sida
           varannan sektion (.bx-ft-row-flip) — en lång sida med fyra
           identiska rader läser som ett formulär, samma sida med växlande
           tyngdpunkt läser som en genomgång. Under 720px staplas de, vilket
           den gamla fasta 164px-kolumnen aldrig gjorde. */
        .bx-ft-row { display: grid; grid-template-columns: minmax(0, 300px) 1fr; align-items: stretch; }
        .bx-ft-row-flip { grid-template-columns: 1fr minmax(0, 300px); }
        .bx-ft-art { display: flex; align-items: center; justify-content: center; padding: 20px; min-width: 0; }
        .bx-ft-row-flip .bx-ft-art { order: 2; }
        .bx-ft-body { padding: 32px; }
        .bx-ft-points { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px 24px; }
        @media (max-width: 720px) {
          .bx-ft-row, .bx-ft-row-flip { grid-template-columns: 1fr; }
          .bx-ft-art { padding: 22px; }
          .bx-ft-row-flip .bx-ft-art { order: 0; }
          .bx-ft-body { padding: 24px; }
        }

        /* Ankarraden under hjälten. Ger den långa sidan en ryggrad: man ser
           direkt vad den innehåller och kan hoppa dit, i stället för att
           skrolla förbi tre sektioner för att hitta lönedelen. */
        .bx-ft-jump { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; row-gap: 10px; }
        .bx-ft-chip {
          display: inline-flex; align-items: center; gap: 8px; padding: 0 clamp(12px, 2.4vw, 20px);
          color: var(--mkt-muted); text-decoration: none;
          font-size: clamp(11px, 2.2vw, 12.5px); font-weight: 800;
          letter-spacing: 0.08em; text-transform: uppercase;
          transition: color 0.25s;
        }
        .bx-ft-chip + .bx-ft-chip { border-left: 1px solid var(--mkt-card-border); }
        .bx-ft-chip:hover { color: var(--mkt-ink); }
        /* Pricken bär sektionens egen accentfärg — samma färg som möter
           en när man landat där nere. */
        .bx-ft-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; transition: transform 0.25s cubic-bezier(0.22,1,0.36,1); }
        .bx-ft-chip:hover .bx-ft-dot { transform: scale(1.45); }
      `}</style>
      <section style={{ padding: '150px 24px 56px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.18)', '4% -8%'], ['rgba(132,204,22,0.16)', '98% 108%']]}
          blob={{ gradient: grad(GRAD.blueTeal), top: '-160px', left: '-110px', size: '460px', opacity: 0.2 }}
        />
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, marginBottom: '16px', lineHeight: 1.12 }}>
            Allt ett företag gör varje månad
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.65, margin: '0 0 34px' }}>
            Fyra delar, ett verktyg, ett pris.
          </p>
          <div className="bx-ft-jump">
            {SECTIONS.map(s => (
              <a key={s.id} href={`#${s.id}`} className="bx-ft-chip">
                <span className="bx-ft-dot" aria-hidden style={{ background: ACCENT[s.accentKey].fg }} />
                {s.title}
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Sambandet, före uppräkningen ── */}
      <section style={{ padding: '10px 24px 74px', background: IVORY }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 9px' }}>
              Allt hänger ihop bakåt
            </h2>
            <p style={{ fontSize: '15.5px', color: MUTED, lineHeight: 1.6, margin: 0, maxWidth: '560px', marginLeft: 'auto', marginRight: 'auto' }}>
              Det är därför det är ett verktyg och inte fyra. Du gör en sak — resten följer med.
            </p>
          </Reveal>
          <Reveal scale delay={60}>
            <FeatureChainFlow />
          </Reveal>
        </div>
      </section>

      {/* ── De fyra delarna i sin helhet ── */}
      <section style={{ padding: '74px 24px 90px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '6px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
              De fyra delarna
            </h2>
          </Reveal>
          {SECTIONS.map((s, i) => {
            const accent = ACCENT[s.accentKey];
            return (
              <Reveal
                key={s.title} id={s.id} delay={i * 80}
                className={`lp-card-hover bx-ft-row${i % 2 ? ' bx-ft-row-flip' : ''}`}
                style={{
                  background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', overflow: 'hidden',
                  boxShadow: CARD_SHADOW, scrollMarginTop: '96px',
                }}
              >
                <div className="bx-ft-art" style={{ background: accent.soft }}>
                  <s.demo />
                </div>
                <div className="bx-ft-body">
                  <h3 style={{ fontSize: '21px', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.01em' }}>{s.title}</h3>
                  <p style={{ fontSize: '14.5px', color: MUTED, margin: '0 0 18px', lineHeight: 1.6 }}>{s.desc}</p>
                  <div className="bx-ft-points">
                    {s.points.map(point => (
                      <div key={point} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.55 }}>
                        <Check size={14} color={accent.fg} style={{ flexShrink: 0, marginTop: '3px' }} />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Resten av verktyget — se kommentaren vid MORE. */}
      <section style={{ padding: '74px 24px 90px', background: IVORY, borderTop: '1px solid var(--mkt-border-soft)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <Reveal>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, color: INK, margin: '0 0 10px', letterSpacing: '-0.01em' }}>
              Och resten av verktyget
            </h2>
            <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.7, margin: '0 0 26px', maxWidth: '640px' }}>
              Samma pris, inget tillägg. Allt nedan finns i appen i dag.
            </p>
          </Reveal>
          <div className="bx-tool-grid bx-tool-grid-4">
            {MORE.map((m, i) => {
              const card = (
                <>
                  <ToolMotif kind={m.motif} />
                  <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: '0 0 6px', letterSpacing: '-0.005em' }}>
                    {m.title}
                  </h3>
                  <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.6, margin: 0 }}>{m.body}</p>
                  {m.to && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '12px', fontSize: '13px', fontWeight: 600, color: BRAND.greenDark }}>
                      Se alla filformat <ArrowRight size={14} />
                    </span>
                  )}
                </>
              );
              const style = {
                display: 'block', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`,
                borderRadius: '16px', padding: '22px 24px', textDecoration: 'none', boxShadow: CARD_SHADOW,
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

      <section style={{ padding: '80px 24px 96px', background: 'var(--mkt-page-bg)', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: '1px solid var(--mkt-border-soft)' }}>
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
