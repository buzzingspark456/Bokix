import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ScanLine, Receipt, SearchCheck, Landmark, Calculator, FileDown } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── Så gör Bokix bokföring enkelt (/enkel-bokforing) ────────────────────
// Statisk artikelsida, INTE en blogg — kundbeslut (se konversationen: fler
// statiska sidor i stället för att återuppliva blogg-CMS:et som just
// togs bort). Samma "en sak i taget, inga stycken brödtext"-princip som
// /sakerhet redan lägger fast (se den filens kommentar) — sex fakta,
// var och en en mening, ingen av dem påhittad.
//
// Absolut regel, samma som SecurityPage: varje påstående nedan motsvarar
// något som faktiskt finns i koden (utils/ocrReceipt.js för OCR-delen,
// ReviewQueue.jsx för Granskning, utils/bankSources.js för bankimporten,
// FAQ_ITEMS i LandingPage.jsx för moms/AGI/skattetabeller). Nämner ALDRIG
// vad andra bokföringsprogram gör eller inte gör — bara vad Bokix gör,
// exakt kundönskemålet ("du behöver inte specificera vad de gör").
const FACTS = [
  { icon: ScanLine, title: 'OCR läser kvittot åt dig', body: 'Fota eller ladda upp. Datum, belopp, moms och konto föreslås automatiskt utifrån vem kvittot är från.' },
  { icon: Receipt, title: 'Fakturor bokförs av sig själva', body: 'Betalning via Stripe matchas mot fakturan och blir en färdig verifikation — ingen manuell avstämning.' },
  { icon: SearchCheck, title: 'Granskning i stället för gissning', body: 'Det OCR:n eller matchningen är osäker på hamnar i en egen kö, med anledning. Inget bokförs blint.' },
  { icon: Landmark, title: 'Kontoutdraget matchar sig själv', body: 'Ladda upp filen från din internetbank — transaktionerna matchas mot dina fakturor automatiskt.' },
  { icon: Calculator, title: 'Moms, löner och bokslut inbyggt', body: 'Kvartalsmoms, AGI, kontrolluppgifter och Skatteverkets skattetabeller — inget tillägg, inget extra pris.' },
  { icon: FileDown, title: 'Ingen inlåsning', body: 'Hela bokföringen ut som SIE4 när du vill. Du behöver inte fråga oss om lov.' },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Så gör Bokix bokföring enkelt',
  url: `${SITE_URL}/enkel-bokforing`,
  inLanguage: 'sv-SE',
  description: 'Sex saker Bokix faktiskt gör för att bokföring ska vara enkelt: OCR-läsning av kvitton, automatiska verifikationer, en granskningskö för det osäkra, bankimport som matchar sig själv, och moms/löner/bokslut inbyggt.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

export default function EnkelBokforingPage() {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <PageMeta
        title="Så gör Bokix bokföring enkelt | Bokix"
        description="OCR-läsning av kvitton, automatiska verifikationer, en granskningskö för det osäkra, bankimport som matchar sig själv, och moms/löner/bokslut inbyggt. Sex saker som faktiskt gör skillnad."
        path="/enkel-bokforing"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-ebf-facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
        @media (max-width: 900px) { .bx-ebf-facts { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 700px) { .bx-ebf-facts { grid-template-columns: 1fr; } }
      `}</style>

      {/* ── Hjälte: samma löfte som startsidans hero, en mening ── */}
      <section style={{ padding: '140px 24px 46px', background: IVORY }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(30px, 5vw, 50px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, marginBottom: '15px', lineHeight: 1.1 }}>
            För att bokföring ska vara enkelt
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.65, margin: 0 }}>
            Inte för att vi säger det. För att sex konkreta saker i verktyget faktiskt gör jobbet åt dig.
          </p>
        </Reveal>
      </section>

      {/* ── Sex fakta, en mening var ── */}
      <section style={{ padding: '10px 24px 72px', background: IVORY }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <div className="bx-ebf-facts">
            {FACTS.map((f, i) => (
              <Reveal key={f.title} delay={i * 40} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '19px 20px', boxShadow: CARD_SHADOW }}>
                <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: '9px', background: ACCENT.green.soft, color: ACCENT.green.fg, alignItems: 'center', justifyContent: 'center', marginBottom: '11px' }}>
                  <f.icon size={16} />
                </span>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 5px' }}>{f.title}</h3>
                <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{f.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Avslutning ── */}
      <section style={{ padding: '64px 24px 100px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 29px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '0 0 11px' }}>
            Se det på riktigt, inte bara läs om det
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.65, margin: '0 0 26px' }}>
            30 dagar gratis, inga kortuppgifter som debiteras i förväg. Avsluta innan dess och det kostar dig ingenting.
          </p>
          <div className="lp-cta-group" style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => navigate('/', { state: { enterApp: true, authMode: 'signup' } })} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '13px 26px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Prova gratis <ArrowRight size={15} />
            </button>
            <button onClick={() => navigate('/funktioner')} style={{ padding: '13px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '14.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Alla funktioner
            </button>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
