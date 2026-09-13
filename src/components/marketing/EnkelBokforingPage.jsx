import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';

// ── "Så gör Bokix bokföring enkelt" (/enkel-bokforing) ──────────────────
// Artikelformat (Sida: "det ska se ut och läsas som en riktig blogg, inte
// en sida med kort") — kundönskemål, uttryckligt, efter att den första
// versionen (sex fakta-kort) visades. INGEN återupplivning av det
// borttagna admin-CMS:et (blog_posts/BlogAdmin.jsx) — den RLS-felsökningen
// tog timmar och löste sig aldrig stabilt. Det här är samma mönster som
// varje annan marknadssida: innehållet skrivs direkt i JSX, ingen databas,
// ingen adminvy att underhålla. Skillnaden mot förra versionen är bara
// FORMEN — löpande stycken under rubriker i en smal spalt (samma
// `.bx-ab-letter`-teknik som AboutPage.jsx:s brev), inte en kortrutnät.
//
// Rubrikbilden (public/blog/enkel-bokforing-hero.jpg) är kundens egen —
// samma bild/text som redan används som og:image-motivet (mörk himmel,
// gradientordmärket). Riktig <h1>-text finns ÄNDÅ under bilden (inte bara
// pixlar i en bild) — en skärmläsare eller sökmotor kan inte läsa text
// inbränd i en bild.
//
// Absolut regel, samma som /sakerhet och förra versionen av den här
// sidan: varje påstående motsvarar något som faktiskt finns i koden
// (utils/ocrReceipt.js, ReviewQueue.jsx, utils/bankSources.js, FAQ_ITEMS
// i LandingPage.jsx). Nämner aldrig vad andra bokföringsprogram gör eller
// inte gör — bara vad Bokix gör.
const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'BlogPosting',
  headline: 'Så gör Bokix bokföring enkelt',
  url: `${SITE_URL}/enkel-bokforing`,
  inLanguage: 'sv-SE',
  image: `${SITE_URL}/blog/enkel-bokforing-hero.jpg`,
  datePublished: '2026-09-13',
  dateModified: '2026-09-13',
  author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
  description: 'Sex konkreta saker Bokix faktiskt gör så att bokföring inte kräver att du kan bokföring: OCR-läsning av kvitton, automatiska verifikationer, en granskningskö för det osäkra, bankimport som matchar sig själv, och moms/löner/bokslut inbyggt.',
  mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/enkel-bokforing` },
};

export default function EnkelBokforingPage() {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      <PageMeta
        title="Så gör Bokix bokföring enkelt | Bokix"
        description="OCR-läsning av kvitton, automatiska verifikationer, en granskningskö för det osäkra, bankimport som matchar sig själv, och moms/löner/bokslut inbyggt. Så här jobbar Bokix i praktiken."
        path="/enkel-bokforing"
        image={`${SITE_URL}/blog/enkel-bokforing-hero.jpg`}
        type="article"
      />
      <JsonLd data={SCHEMA} />
      <style>{`
        .bx-ebf-article p { font-size: clamp(16.5px, 2vw, 18.5px); line-height: 1.85; margin: 0 0 20px; color: var(--mkt-ink-soft); }
        .bx-ebf-article h2 { font-family: ${SERIF}; font-size: clamp(21px, 2.6vw, 27px); font-weight: 700; letter-spacing: -0.01em; color: var(--mkt-ink); margin: 44px 0 14px; }
        .bx-ebf-article h2:first-of-type { margin-top: 8px; }
        .bx-ebf-hero-img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; }
        @media (max-width: 640px) { .bx-ebf-hero-img { aspect-ratio: 4 / 3; } }
      `}</style>

      {/* ── Rubrikbild — kundens egen, hela bredden, direkt under headern ── */}
      <Reveal>
        <img
          className="bx-ebf-hero-img"
          src="/blog/enkel-bokforing-hero.jpg"
          alt="För att bokföring ska vara enkelt — Bokix"
        />
      </Reveal>

      {/* ── Kicker + rubrik + byline ── */}
      <section style={{ padding: '40px 24px 8px', background: IVORY }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: BRAND.greenDark, marginBottom: '14px' }}>
            Bokix-bloggen
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 4.6vw, 44px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, margin: '0 0 16px', lineHeight: 1.15 }}>
            Så gör Bokix bokföring enkelt
          </h1>
          <div style={{ fontSize: '13.5px', color: MUTED, fontWeight: 600 }}>
            Bokix-teamet · 13 september 2026 · ~4 min läsning
          </div>
        </Reveal>
      </section>

      {/* ── Artikeln ── */}
      <section style={{ padding: '32px 24px 90px', background: IVORY }}>
        <Reveal className="bx-ebf-article" style={{ maxWidth: '680px', margin: '0 auto' }}>
          <p>
            De flesta som startar ett företag är experter på det de faktiskt gör — inte på dubbel bokföring, kontoplaner eller momsrutor. Bokix bygger vi utifrån en enda regel: det du inte kan ska vi göra åt dig, och det som är osäkert ska aldrig gissas fram tyst. Här är sex konkreta saker i verktyget som gör att skillnaden faktiskt märks, inte bara i marknadsföringen.
          </p>

          <h2>Kvittot läser sig självt</h2>
          <p>
            Fota kvittot med mobilen eller ladda upp en bild eller PDF. Bokix läser texten direkt i webbläsaren och fyller i datum, belopp och momssats automatiskt. Känner OCR-läsningen igen handlaren — en bensinmack, en matbutik, ett vanligt molntjänstabonnemang — föreslås även rätt bokföringskonto, inte bara siffrorna. Varje fält som fyllts i av OCR:n märks med en liten badge, och försvinner så fort du redigerar fältet för hand: det är alltid ett förslag, aldrig ett påstående.
          </p>

          <h2>Fakturor bokförs av sig själva</h2>
          <p>
            När en kund betalar en faktura via kortbetalning matchas betalningen automatiskt mot rätt faktura och blir en färdig verifikation — utan att du behöver stämma av något manuellt i efterhand. Fyra fakturamallar finns med din egen logotyp, så fakturan ser ut som ditt företag, inte som en generisk mall.
          </p>

          <h2>Det osäkra hamnar i en kö — inte i bokföringen</h2>
          <p>
            En Swish-betalning utan tydlig avsändare, ett suddigt kvitto OCR:n inte kunde tolka fullt ut, en summa som inte går ihop — det här är precis de fallen där gissningar blir dyra. I stället för att bokföra fel i tysthet hamnar dessa poster i en egen granskningskö, med anledningen tydligt utskriven. Du bokför dem själv, med rätt underlag framför dig, i stället för att upptäcka felet månader senare.
          </p>

          <h2>Kontoutdraget matchar sig självt</h2>
          <p>
            Exportera kontoutdraget som en fil ur din internetbank — samma sätt oavsett vilken bank du har — och läs in det i Bokix. Transaktionerna matchas automatiskt mot dina obetalda fakturor och leverantörsfakturor. Ingen inloggningsuppgift till banken lämnas någonsin ut; filen läser du in precis som vanligt.
          </p>

          <h2>Moms, löner och bokslut sköts på sina egna villkor</h2>
          <p>
            Momsdeklarationen fylls i enligt de svenska satserna (25/12/6 %) varje kvartal. Har du anställda sköter Bokix löneutbetalning med automatiskt skatteavdrag enligt Skatteverkets egna skattetabeller, plus AGI- och kontrolluppgiftssammanställningar. Inget av detta är ett tillägg eller ett högre pris — det ingår i abonnemanget du redan har.
          </p>

          <h2>Ingen inlåsning</h2>
          <p>
            Vill du någon gång gå vidare till ett annat system går hela bokföringen att exportera som en SIE4-fil — branschstandarden svenska bokföringsprogram och redovisningskonsulter redan använder för att flytta data. Du behöver inte fråga oss om lov, och du behöver aldrig skriva av allt för hand.
          </p>

          <p style={{ marginTop: '36px' }}>
            Ingenting av det här är komplicerat att sätta upp — det är hela poängen. 30 dagar är gratis, och om du avslutar innan dess har det inte kostat dig något.
          </p>
        </Reveal>
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
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '14.5px', textDecoration: 'none' }}>
              Alla funktioner
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
