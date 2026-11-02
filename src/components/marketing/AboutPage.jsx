import React from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles } from './subpageKit';
import { SERIF, INK, INK_SOFT, MUTED } from './marketingTokens';
import { BRAND } from '../../utils/brandColors';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { BOKIX_SUMMARY, BOKIX_NOT_FOR, BOKIX_NOT_BOKIO } from '../../content/marketing/bokixFacts';

// ── Om oss (/om-oss) ────────────────────────────────────────────────────
// Sjunde versionen (2026-10-21): användaren ville ha "en riktig och bra om
// oss-sida", inte en säljsida. Debet/kredit-animationen togs bort härifrån
// (gillad, men passade inte på en om-sida). Uppbyggnad: vilka vi är, varför
// Bokix finns, vad vi bryr oss om, vad Bokix inte gör, och kort fakta. Ingen
// avslutning; footern har mejladressen.
//
// Gäller fortfarande (kundens beslut 2026-09-16 och 2026-10-21, fråga innan
// något ändras): inga grundarnamn, inget om "två personer" eller "vi som
// svarar", inget pris, inget om Ung Företagsamhet/UF, ingen säljande
// avslutning, inga nyckeltal, inga konkurrentnamn. Bara uppgifter som står i
// bokixFacts.js.

const VALUES = [
  { title: 'Hellre fråga än gissa', body: 'Det som är osäkert bokförs inte i det tysta. Det hamnar i Granskning med en förklaring, så att du bestämmer.' },
  { title: 'Ingen inlåsning', body: 'Bokföringen är din. Du kan ladda ned hela den som SIE4 när du vill och ta med den till ett annat program.' },
  { title: 'Du behåller kontrollen', body: 'Bokix skickar aldrig in något åt dig. Deklarationerna lämnar du själv in hos Skatteverket med BankID.' },
];

const FACTS = [
  { label: 'Företaget', value: 'Svenskt, med webbplatsen bokix.se' },
  { label: 'Namnet', value: BOKIX_NOT_BOKIO },
  { label: 'Programmet', value: 'Körs i webbläsaren på dator och telefon, på svenska och engelska' },
  { label: 'Din data', value: 'Lagras i Stockholm och sparas i sju år, som bokföringslagen kräver' },
  { label: 'Kontakt', value: 'bokixab@gmail.com', href: 'mailto:bokixab@gmail.com' },
];

const TRUSTPILOT_PAGE_URL = 'https://se.trustpilot.com/review/bokix.se';
const TRUSTPILOT_WRITE_URL = 'https://se.trustpilot.com/evaluate/bokix.se';

// Trustpilots stjärna i deras gröna färg.
function TrustpilotStar() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#00b67a" d="M12 1.5l2.62 8.06h8.48l-6.86 4.98 2.62 8.06L12 17.62l-6.86 4.98 2.62-8.06L.9 9.56h8.48z" />
    </svg>
  );
}

const SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  name: 'Om Bokix',
  url: `${SITE_URL}/om-oss`,
  inLanguage: 'sv-SE',
  description: BOKIX_SUMMARY,
  publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
};

function AboutStyles() {
  return (
    <style>{`
      .ab-hero { padding: 150px 24px 84px; background: var(--mkt-page-bg); }
      .ab-wrap { max-width: 1040px; margin: 0 auto; }
      .ab-h1 { font-family: ${SERIF}; font-size: clamp(36px, 5.6vw, 64px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.05; color: ${INK}; margin: 0 0 24px; max-width: 820px; }
      .ab-lead { font-size: clamp(18px, 1.6vw, 20px); line-height: 1.65; color: ${INK_SOFT}; margin: 0; max-width: 640px; }

      .ab-sec { padding: 96px 24px; background: var(--mkt-page-bg); }
      .ab-sec-alt { background: var(--mkt-section-alt, var(--mkt-ivory)); }
      .ab-h2 { font-family: ${SERIF}; font-size: clamp(28px, 3.6vw, 40px); font-weight: 700; letter-spacing: -0.015em; line-height: 1.15; color: ${INK}; margin: 0; }
      .ab-sub { font-size: 16.5px; line-height: 1.65; color: ${MUTED}; margin: 14px 0 0; max-width: 420px; }

      /* Rubrik till vänster, innehåll till höger. En spalt på smal skärm. */
      .ab-split { display: grid; grid-template-columns: minmax(0, 4fr) minmax(0, 7fr); gap: 64px; align-items: start; }

      .ab-story p { font-size: 18px; line-height: 1.75; color: ${INK_SOFT}; margin: 0 0 20px; }
      .ab-story p:last-child { margin-bottom: 0; }

      .ab-values { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px; margin-top: 52px; }
      .ab-value { padding-top: 20px; border-top: 2px solid ${BRAND.green}; }
      .ab-value h3 { font-size: 18px; font-weight: 700; color: ${INK}; margin: 0 0 10px; letter-spacing: -0.005em; }
      .ab-value p { font-size: 15.5px; line-height: 1.65; color: ${MUTED}; margin: 0; }

      .ab-not { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--mkt-border-soft); }
      .ab-not li { display: flex; gap: 14px; padding: 18px 0; border-bottom: 1px solid var(--mkt-border-soft); font-size: 16.5px; line-height: 1.6; color: ${INK_SOFT}; }
      .ab-not li::before { content: ''; flex-shrink: 0; width: 8px; height: 8px; margin-top: 10px; border-radius: 50%; background: var(--mkt-muted); opacity: 0.6; }
      .ab-note { font-size: 14.5px; line-height: 1.6; color: ${MUTED}; margin: 18px 0 0; }
      .ab-link { color: var(--mkt-accent-green-fg); font-weight: 600; }

      .ab-facts { display: grid; grid-template-columns: 1fr; margin: 0; border-top: 1px solid var(--mkt-border-soft); }
      .ab-fact { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 7fr); gap: 24px; padding: 18px 0; border-bottom: 1px solid var(--mkt-border-soft); }
      .ab-fact dt { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; padding-top: 3px; }
      .ab-fact dd { margin: 0; font-size: 16.5px; line-height: 1.55; color: ${INK}; }
      .ab-fact a { color: ${INK}; text-decoration: none; border-bottom: 1.5px solid ${BRAND.green}; }
      .ab-fact a:hover { color: var(--mkt-accent-green-fg); }

      .ab-tp { display: flex; flex-direction: column; gap: 22px; padding: 28px 30px; border-radius: 20px; background: var(--mkt-card-bg); border: 1px solid var(--mkt-border-soft); }
      .ab-tp-brand { display: inline-flex; align-items: center; gap: 9px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; color: ${INK}; }
      .ab-tp-text { font-size: 16.5px; line-height: 1.6; color: ${INK_SOFT}; margin: 0; }
      .ab-tp-actions { display: flex; gap: 12px; flex-wrap: wrap; }
      .ab-tp-btn { display: inline-flex; align-items: center; justify-content: center; padding: 13px 22px; border-radius: 12px; font-size: 15px; font-weight: 600; text-decoration: none; transition: filter 0.15s, border-color 0.15s; }
      .ab-tp-primary { background: #00b67a; color: #fff; }
      .ab-tp-primary:hover { filter: brightness(0.94); }
      .ab-tp-secondary { background: transparent; color: ${INK}; border: 1px solid var(--mkt-border-soft); }
      .ab-tp-secondary:hover { border-color: var(--mkt-btn-border); }

      @media (max-width: 900px) {
        .ab-split { grid-template-columns: 1fr; gap: 28px; }
        .ab-values { grid-template-columns: 1fr; gap: 28px; margin-top: 36px; }
        .ab-sub { max-width: none; }
      }
      @media (max-width: 560px) {
        .ab-hero { padding: 120px 20px 60px; }
        .ab-sec { padding: 68px 20px; }
        .ab-fact { grid-template-columns: 1fr; gap: 4px; }
      }
    `}</style>
  );
}

export default function AboutPage() {
  return (
    <MarketingLayout>
      <PageMeta
        title="Om Bokix: svenskt bokföringsprogram för småföretag"
        description="Om Bokix: varför vi bygger ett svenskt bokföringsprogram för småföretag, vad vi bryr oss om och vad Bokix inte gör."
        path="/om-oss"
      />
      <JsonLd data={SCHEMA} />
      <KitStyles />
      <AboutStyles />

      <section className="ab-hero">
        <Reveal className="ab-wrap">
          <h1 className="ab-h1">Om Bokix</h1>
          <p className="ab-lead">Ett svenskt bokföringsprogram för småföretag, med bokföring, fakturor, kvitton, moms, lön och bokslut på ett ställe.</p>
        </Reveal>
      </section>

      <section className="ab-sec ab-sec-alt">
        <Reveal className="ab-wrap ab-split">
          <h2 className="ab-h2">Därför finns Bokix</h2>
          <div className="ab-story">
            <p>Vi startade Bokix för att bokföring kändes krångligare än den behöver vara. Programmen vi provade var dyra för det man fick och skrivna för den som redan kan debet och kredit.</p>
            <p>Så vi byggde ett där du beskriver vad som har hänt, och programmet väljer konton och räknar ut momsen. Den som vill kan fortfarande se och ändra varje verifikation.</p>
          </div>
        </Reveal>
      </section>

      <section className="ab-sec">
        <div className="ab-wrap">
          <Reveal>
            <h2 className="ab-h2">Det vi bryr oss om</h2>
          </Reveal>
          <Reveal delay={80} className="ab-values">
            {VALUES.map(v => (
              <div key={v.title} className="ab-value">
                <h3>{v.title}</h3>
                <p>{v.body}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <section className="ab-sec ab-sec-alt">
        <Reveal className="ab-wrap ab-split">
          <div>
            <h2 className="ab-h2">Det Bokix inte gör</h2>
            <p className="ab-sub">Bokix passar inte alla. Hellre att du vet det nu än efter att du har börjat.</p>
          </div>
          <div>
            <ul className="ab-not">
              {BOKIX_NOT_FOR.map(t => <li key={t}>{t}</li>)}
            </ul>
            <p className="ab-note">
              Allt Bokix gör finns på <Link to="/funktioner" className="ab-link">Funktioner</Link>.
            </p>
          </div>
        </Reveal>
      </section>

      <section className="ab-sec">
        <Reveal className="ab-wrap ab-split">
          <h2 className="ab-h2">Kort om Bokix</h2>
          <dl className="ab-facts">
            {FACTS.map(f => (
              <div key={f.label} className="ab-fact">
                <dt>{f.label}</dt>
                <dd>{f.href ? <a href={f.href}>{f.value}</a> : f.value}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </section>

      {/* Omdömen på Trustpilot. Bara länkar, inget betyg: vi hämtar det inte
          därifrån och skriver aldrig in en siffra för hand. */}
      <section className="ab-sec ab-sec-alt">
        <Reveal className="ab-wrap ab-split">
          <div>
            <h2 className="ab-h2">Vad tycker du?</h2>
            <p className="ab-sub">Använder du Bokix? Ett ärligt omdöme hjälper oss att bli bättre och andra företagare att välja.</p>
          </div>
          <div className="ab-tp">
            <span className="ab-tp-brand">
              <TrustpilotStar /> Trustpilot
            </span>
            <p className="ab-tp-text">Allt som skrivs om Bokix på Trustpilot syns öppet, både det bra och det som kan bli bättre.</p>
            <div className="ab-tp-actions">
              <a className="ab-tp-btn ab-tp-primary" href={TRUSTPILOT_WRITE_URL} target="_blank" rel="noopener noreferrer">Skriv ett omdöme</a>
              <a className="ab-tp-btn ab-tp-secondary" href={TRUSTPILOT_PAGE_URL} target="_blank" rel="noopener noreferrer">Läs omdömen</a>
            </div>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
