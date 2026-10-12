import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout from './MarketingLayout';
import { KitStyles, SubHero, KitSection, SpecList, KitFaq, GhostLink } from './subpageKit';
import { AboutVisual } from './OrgTypeVisuals';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { NEWS_POSTS } from '../../content/marketing/news';

// ── Om oss (/om-oss) ────────────────────────────────────────────────────
// Fjärde versionen (2026-10-12): den förra var en rubrik och en mening, och
// användaren sa att man "fattar nästan ingenting". Nu i samma uppbyggnad som
// de godkända undersidorna (/uf, /koppla-bank): en hjälte med en animerad
// bild som visar idén, korta rader i stället för stycken, tre frågor.
//
// Gäller fortfarande (kundens beslut 2026-09-16, fråga innan något ändras):
// inga grundarnamn, inget pris (129/179 kr står på /priser), inget om Ung
// Företagsamhet/UF, ingen säljande avslutning, inga nyckeltal, inga
// konkurrentnamn. Allt nedan är sådant som står i bokixFacts.js.

const BELIEFS = [
  { title: 'Du ska inte behöva kunna bokföring', body: 'Du väljer vad som har hänt, som att du har köpt något eller fått betalt. Kontona och momsen sköts åt dig.' },
  { title: 'Hellre fråga än gissa', body: 'Det som är osäkert bokförs inte i det tysta. Det hamnar i Granskning, med en förklaring av vad som behöver kollas.' },
  { title: 'Ett pris, allt ingår', body: 'Inga tillägg per funktion och inga avgifter per faktura eller kvitto.' },
  { title: 'Din bokföring är din', body: 'Du kan exportera allt som SIE4 när du vill, och du lämnar själv in till Skatteverket med BankID.' },
];

const FACTS = [
  { title: 'För vem', body: 'Svenska småföretag: enskild firma, aktiebolag, handelsbolag, kommanditbolag och ekonomisk förening.' },
  { title: 'Vad det är', body: 'Ett bokföringsprogram i webbläsaren, på dator och telefon, med bokföring, fakturor, kvitton, moms, lön och bokslut.' },
  { title: 'Var datan finns', body: 'Inom EU, i Frankfurt. Bokföringen sparas i sju år, även om du slutar använda Bokix.' },
  { title: 'Språk', body: 'Appen finns på svenska och engelska.' },
  { title: 'Support', body: 'Ingår, och svaren kommer från oss som bygger Bokix: support@bokix.se.' },
];

const FAQ = [
  { q: 'Vilka står bakom Bokix?', a: 'Två personer i Sverige som bygger och sköter Bokix själva, från koden till supporten. När du mejlar support@bokix.se är det vi som svarar.' },
  { q: 'Var lagras min bokföring?', a: 'Inom EU, i Frankfurt. Den sparas i sju år, så som bokföringslagen kräver, även om du slutar använda Bokix. Du kan alltid ladda ned den som SIE4.' },
  { q: 'Varför byggde ni Bokix?', a: 'Vi tyckte att bokföringsprogram var dyra för det man fick och skrivna för folk som redan kan bokföring. Bokix ska gå att förstå utan kurs.' },
];

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Om Bokix',
  url: `${SITE_URL}/om-oss`,
  inLanguage: 'sv-SE',
  description: 'Bokix är ett svenskt bokföringsprogram för småföretag, byggt av två personer. Bokföring ska gå att förstå utan att man kan debet och kredit.',
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
};

export default function AboutPage() {
  const latest = NEWS_POSTS.filter(p => p.body).slice(0, 5);
  return (
    <MarketingLayout>
      <PageMeta
        title="Om Bokix: svenskt bokföringsprogram för småföretag"
        description="Bokix är ett svenskt bokföringsprogram för småföretag, byggt av två personer. Bokföring ska gå att förstå, utan debet och kredit och utan tillägg."
        path="/om-oss"
      />
      <JsonLd data={SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />
      <KitStyles />
      <style>{`
        .ab-news { border-top: 1px solid var(--mkt-border-soft); }
        .ab-news a { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mkt-border-soft); text-decoration: none; color: var(--mkt-ink); font-size: 16px; font-weight: 600; transition: color 0.15s ease; }
        .ab-news a:hover { color: var(--mkt-accent-green-fg); }
        .ab-news small { font-size: 13px; font-weight: 600; color: var(--mkt-muted); white-space: nowrap; }
      `}</style>

      <SubHero
        eyebrow="Om Bokix"
        title="Bokföring som går att förstå"
        lead="Bokix är ett svenskt bokföringsprogram för småföretag. Vi är två personer som bygger det, för att vi tyckte att bokföringsprogram var dyra för det man fick och skrivna för folk som redan kan bokföring."
        actions={<GhostLink to="/enkel-bokforing">Så fungerar Bokix</GhostLink>}
        visual={<AboutVisual />}
      />

      <KitSection title="Det här tror vi på" lead="Fyra saker som styr hur Bokix byggs.">
        <SpecList items={BELIEFS} />
      </KitSection>

      <KitSection title="Bokix i korthet" lead="Fakta, utan säljprat." alt>
        <SpecList items={FACTS} />
        <p className="kx-row-body" style={{ marginTop: '18px' }}>
          Mer fakta på <Link to="/bokix-i-korthet" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Bokix i korthet</Link>.
        </p>
      </KitSection>

      {latest.length > 0 && (
        <KitSection title="Det senaste vi byggt" lead="Bokix blir bättre hela tiden. Här är några av de senaste nyheterna.">
          <div className="ab-news">
            {latest.map(p => (
              <Link key={p.path} to={p.path}>
                <span>{p.title}</span>
                <small>{p.category}</small>
              </Link>
            ))}
          </div>
          <p className="kx-row-body" style={{ marginTop: '18px' }}>
            <Link to="/nyheter" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>Alla nyheter</Link>
          </p>
        </KitSection>
      )}

      <KitSection title="Vanliga frågor om oss" alt>
        <KitFaq items={FAQ} />
      </KitSection>
    </MarketingLayout>
  );
}
