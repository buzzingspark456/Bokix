import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { KitStyles, KitSection, KitFaq, GhostLink } from './subpageKit';
import { SERIF, INK, INK_SOFT, MUTED, ACCENT } from './marketingTokens';
import { BRAND } from '../../utils/brandColors';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import { NEWS_POSTS } from '../../content/marketing/news';

// ── Om oss (/om-oss) ────────────────────────────────────────────────────
// Femte versionen (2026-10-20): användaren ville ha sidan "mycket bättre".
// Uppbyggd som de godkända undersidorna (/koppla-bank): centrerad hjälte med
// EN egen animation, sedan lugna sektioner. Animationen är sidans tes:
// samma köp först som konton i debet och kredit, sedan som en mening.
// Varje princip under "Så bygger vi Bokix" visas med en liten ritad bit av
// appen i stället för brödtext i kort.
//
// Gäller fortfarande (kundens beslut 2026-09-16, fråga innan något ändras):
// inga grundarnamn, inget pris (129/179 kr står på /priser), inget om Ung
// Företagsamhet/UF, ingen säljande avslutning, inga nyckeltal, inga
// konkurrentnamn. Allt nedan är sådant som står i bokixFacts.js.

const PRINCIPLES = [
  { id: 'words', title: 'Du ska inte behöva kunna bokföring', body: 'Du väljer vad som har hänt. Kontona och momsen sköts åt dig.' },
  { id: 'ask', title: 'Hellre fråga än gissa', body: 'Det som är osäkert bokförs inte i det tysta. Det hamnar i Granskning med en förklaring.' },
  { id: 'all', title: 'Ett pris, allt ingår', body: 'Inga tillägg per funktion och inga avgifter per faktura eller kvitto.' },
  { id: 'yours', title: 'Din bokföring är din', body: 'Exportera allt som SIE4 när du vill. Deklarationerna lämnar du själv in med BankID.' },
];

const PLACE = [
  { big: 'Stockholm', small: 'Databasen och dina kvitton ligger i ett datacenter i Sverige.' },
  { big: 'Sju år', small: 'Bokföringen sparas så länge lagen kräver, även om du slutar använda Bokix.' },
  { big: 'SIE4', small: 'Du kan ladda ned allt och ta med det till ett annat program.' },
];

const FAQ = [
  { q: 'Vilka står bakom Bokix?', a: 'Två personer i Sverige som bygger och sköter Bokix själva, från koden till supporten. När du mejlar support@bokix.se är det vi som svarar.' },
  { q: 'Varför byggde ni Bokix?', a: 'Vi tyckte att bokföringsprogram var dyra för det man fick och skrivna för folk som redan kan bokföring. Bokix ska gå att förstå utan kurs.' },
  { q: 'Kan jag se debet och kredit om jag vill?', a: 'Ja. Allt bokförs med konton enligt BAS-kontoplanen. Slå på "Debet och kredit" så ser du och ändrar varje verifikation precis som i ett vanligt bokföringsprogram.' },
  { q: 'Var lagras min bokföring?', a: 'I Sverige, i Stockholm. Den sparas i sju år, så som bokföringslagen kräver, även om du slutar använda Bokix. Du kan alltid ladda ned den som SIE4.' },
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

function AboutStyles() {
  return (
    <style>{`
      #lp-root .ab { --ab-amber: oklch(55% 0.13 70); --ab-amber-soft: oklch(95% 0.05 85); }
      html[data-theme="dark"] #lp-root .ab { --ab-amber: oklch(82% 0.13 80); --ab-amber-soft: oklch(32% 0.05 80); }

      .ab-hero { padding: 140px 24px 72px; text-align: center; background: var(--mkt-page-bg); }
      .ab-h1 { font-family: ${SERIF}; font-size: clamp(34px, 5.4vw, 60px); font-weight: 700; letter-spacing: -0.025em; line-height: 1.05; color: ${INK}; margin: 0 auto 18px; max-width: 760px; }
      .ab-lead { font-size: 18px; line-height: 1.6; color: ${MUTED}; margin: 0 auto; max-width: 600px; }

      /* Hjältens tes: samma köp som tre kontorader, sedan som en mening. */
      .ab-tr { max-width: 640px; margin: 52px auto 0; text-align: left; border: 1px solid var(--mkt-card-border); border-radius: 18px; background: var(--mkt-ivory); box-shadow: var(--mkt-card-shadow); overflow: hidden; }
      .ab-tr-top { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--mkt-border-soft); }
      .ab-tr-label { font-size: 11.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${MUTED}; transition: opacity 0.4s ease; }
      .ab-switch { display: inline-flex; padding: 3px; border-radius: 999px; background: var(--mkt-page-bg); border: 1px solid var(--mkt-border-soft); }
      .ab-switch button { font-family: inherit; font-size: 12.5px; font-weight: 600; padding: 6px 12px; border-radius: 999px; border: none; background: transparent; color: ${MUTED}; cursor: pointer; }
      .ab-switch button[aria-pressed="true"] { background: ${BRAND.green}; color: #fff; }
      .ab-switch button:focus-visible { outline: 2px solid ${BRAND.green}; outline-offset: 2px; }
      .ab-tr-body { position: relative; height: 176px; }
      .ab-tr-pane { position: absolute; inset: 0; padding: 8px 20px 16px; transition: opacity 0.5s ease, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      .ab-tr-pane[data-on="false"] { opacity: 0; transform: translateY(8px); pointer-events: none; }
      .ab-acc { display: grid; grid-template-columns: 1fr 88px 88px; gap: 8px; padding: 11px 0; border-bottom: 1px solid var(--mkt-border-soft); font-size: 14.5px; color: ${INK_SOFT}; font-variant-numeric: tabular-nums; }
      .ab-acc:last-of-type { border-bottom: none; }
      .ab-acc span:nth-child(n+2) { text-align: right; font-weight: 600; color: ${INK}; }
      .ab-acc-head { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${MUTED}; padding: 10px 0 6px; }
      .ab-acc-head span:nth-child(n+2) { color: ${MUTED}; font-weight: 700; }
      .ab-plain { display: flex; flex-direction: column; justify-content: center; height: 100%; gap: 14px; }
      .ab-plain-q { font-size: 13px; font-weight: 600; color: ${MUTED}; }
      .ab-plain-s { font-family: ${SERIF}; font-size: clamp(22px, 3.4vw, 30px); font-weight: 700; letter-spacing: -0.015em; line-height: 1.2; color: ${INK}; }
      .ab-plain-s em { font-style: normal; color: ${ACCENT.green.fg}; }
      .ab-plain-note { font-size: 13.5px; color: ${MUTED}; }

      /* Berättelsen */
      .ab-story p { font-size: 17px; line-height: 1.75; color: ${INK_SOFT}; margin: 0 0 18px; max-width: 620px; }
      .ab-story .ab-quote { font-family: ${SERIF}; font-size: clamp(22px, 2.8vw, 28px); line-height: 1.35; letter-spacing: -0.01em; color: ${INK}; margin: 30px 0 0; padding-left: 20px; border-left: 3px solid ${BRAND.green}; max-width: 620px; }

      /* Principerna: rubrik och en mening till vänster, en bit av appen till höger. */
      .ab-pr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 56px; align-items: center; max-width: 1040px; margin: 0 auto; padding: 44px 0; border-bottom: 1px solid var(--mkt-border-soft); }
      .ab-pr:first-child { padding-top: 8px; }
      .ab-pr:last-child { border-bottom: none; }
      .ab-pr h3 { font-family: ${SERIF}; font-size: clamp(22px, 2.6vw, 28px); font-weight: 700; letter-spacing: -0.015em; line-height: 1.2; color: ${INK}; margin: 0 0 10px; }
      .ab-pr p { font-size: 16px; line-height: 1.65; color: ${MUTED}; margin: 0; max-width: 420px; }
      .ab-mini { border: 1px solid var(--mkt-card-border); border-radius: 14px; background: var(--mkt-ivory); padding: 16px; box-shadow: var(--mkt-card-shadow-sm); font-size: 14px; color: ${INK}; }
      .ab-mini-label { font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: ${MUTED}; margin-bottom: 10px; }
      .ab-choice { display: flex; justify-content: space-between; align-items: center; padding: 11px 12px; border-radius: 10px; border: 1px solid var(--mkt-border-soft); margin-top: 6px; font-weight: 600; color: ${INK_SOFT}; }
      .ab-choice[data-on="true"] { border-color: ${BRAND.green}; color: ${INK}; background: ${ACCENT.green.soft}; }
      .ab-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid var(--mkt-border-soft); }
      .ab-choice[data-on="true"] .ab-dot { border: 4px solid ${BRAND.green}; }
      .ab-review { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; align-items: center; }
      .ab-review b { font-weight: 700; }
      .ab-review small { grid-column: 1 / -1; font-size: 13px; color: ${MUTED}; }
      .ab-tag { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: var(--ab-amber-soft); color: var(--ab-amber); }
      .ab-tag-ok { background: ${ACCENT.green.soft}; color: ${ACCENT.green.fg}; }
      .ab-inc { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--mkt-border-soft); font-weight: 600; color: ${INK_SOFT}; }
      .ab-inc:last-child { border-bottom: none; }
      .ab-export { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .ab-btn-mini { font-size: 13px; font-weight: 700; padding: 8px 14px; border-radius: 9px; background: ${BRAND.green}; color: #fff; white-space: nowrap; }
      .ab-export + .ab-export { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--mkt-border-soft); }

      /* Var bokföringen finns */
      .ab-place { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 40px; max-width: 1040px; margin: 0 auto; }
      .ab-place-big { font-family: ${SERIF}; font-size: clamp(30px, 3.8vw, 44px); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; color: ${INK}; padding-bottom: 14px; margin-bottom: 14px; border-bottom: 2px solid ${BRAND.green}; }
      .ab-place-small { font-size: 15.5px; line-height: 1.6; color: ${MUTED}; margin: 0; }

      .ab-news { border-top: 1px solid var(--mkt-border-soft); }
      .ab-news a { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--mkt-border-soft); text-decoration: none; color: ${INK}; font-size: 16px; font-weight: 600; transition: color 0.15s ease; }
      .ab-news a:hover { color: ${ACCENT.green.fg}; }
      .ab-news small { font-size: 13px; font-weight: 600; color: ${MUTED}; white-space: nowrap; }
      .ab-link { color: ${ACCENT.green.fg}; font-weight: 600; }

      .ab-contact { padding: 96px 24px 110px; text-align: center; border-top: 1px solid var(--mkt-border-soft); background: var(--mkt-page-bg); }
      .ab-mail { display: inline-block; font-family: ${SERIF}; font-size: clamp(26px, 4vw, 40px); font-weight: 700; letter-spacing: -0.02em; color: ${INK}; text-decoration: none; border-bottom: 2px solid ${BRAND.green}; margin: 14px 0 28px; }
      .ab-mail:hover { color: ${ACCENT.green.fg}; }

      @media (max-width: 900px) {
        .ab-pr { grid-template-columns: 1fr; gap: 22px; padding: 34px 0; }
        .ab-place { grid-template-columns: 1fr; gap: 30px; }
      }
      @media (max-width: 560px) {
        .ab-hero { padding: 116px 18px 56px; }
        .ab-tr-top { flex-direction: column; align-items: flex-start; }
        .ab-tr-body { height: 196px; }
        .ab-acc { grid-template-columns: 1fr 70px 70px; font-size: 13.5px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .ab-tr-pane { transition: none; }
      }
    `}</style>
  );
}

/** Hjältens animation: växlar själv mellan kontona och meningen tills
 *  besökaren väljer själv med knapparna. */
function Translator() {
  const [plain, setPlain] = useState(false);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setPlain(true); return undefined; }
    const id = setInterval(() => setPlain(p => !p), 3600);
    return () => clearInterval(id);
  }, [auto]);
  const choose = (v) => { setAuto(false); setPlain(v); };
  return (
    <div className="ab-tr" role="group" aria-label="Samma köp av kontorsmaterial för 499 kronor, som konton och som det ser ut i Bokix">
      <div className="ab-tr-top">
        <span className="ab-tr-label">{plain ? 'Så ser det ut i Bokix' : 'Så ser bokföring ut för det mesta'}</span>
        <div className="ab-switch">
          <button type="button" aria-pressed={!plain} onClick={() => choose(false)}>Debet och kredit</button>
          <button type="button" aria-pressed={plain} onClick={() => choose(true)}>Med vanliga ord</button>
        </div>
      </div>
      <div className="ab-tr-body">
        <div className="ab-tr-pane" data-on={!plain} aria-hidden={plain}>
          <div className="ab-acc ab-acc-head"><span>Konto</span><span>Debet</span><span>Kredit</span></div>
          <div className="ab-acc"><span>6110 Kontorsmateriel</span><span>399,20</span><span /></div>
          <div className="ab-acc"><span>2641 Ingående moms</span><span>99,80</span><span /></div>
          <div className="ab-acc"><span>1930 Företagskonto</span><span /><span>499,00</span></div>
        </div>
        <div className="ab-tr-pane" data-on={plain} aria-hidden={!plain}>
          <div className="ab-plain">
            <span className="ab-plain-q">Vad har hänt?</span>
            <span className="ab-plain-s">Jag har köpt <em>kontorsmaterial</em> för <em>499 kr</em>.</span>
            <span className="ab-plain-note">Kontona och momsen sköts åt dig.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ id }) {
  if (id === 'words') {
    return (
      <div className="ab-mini" aria-hidden="true">
        <div className="ab-mini-label">Vad har hänt?</div>
        {['Jag har köpt något', 'Jag har fått betalt', 'Jag har betalat en faktura'].map((t, i) => (
          <div key={t} className="ab-choice" data-on={i === 0}>{t}<span className="ab-dot" /></div>
        ))}
      </div>
    );
  }
  if (id === 'ask') {
    return (
      <div className="ab-mini" aria-hidden="true">
        <div className="ab-mini-label">Granskning</div>
        <div className="ab-review">
          <b>Kvitto, 1 249 kr</b><span className="ab-tag">Kontrollera</span>
          <small>Momsen går inte att läsa på kvittot. Fyll i den så bokförs kvittot.</small>
        </div>
      </div>
    );
  }
  if (id === 'all') {
    return (
      <div className="ab-mini" aria-hidden="true">
        {['Fakturor', 'Kvitton', 'Lön', 'Moms och bokslut'].map(t => (
          <div key={t} className="ab-inc">{t}<span className="ab-tag ab-tag-ok">Ingår</span></div>
        ))}
      </div>
    );
  }
  return (
    <div className="ab-mini" aria-hidden="true">
      <div className="ab-export"><b>Hela bokföringen</b><span className="ab-btn-mini">Ladda ned SIE4</span></div>
      <div className="ab-export"><b>Momsdeklarationen</b><span className="ab-tag ab-tag-ok">Du lämnar in med BankID</span></div>
    </div>
  );
}

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
      <AboutStyles />

      <div className="ab">
        <section className="ab-hero">
          <Reveal>
            <div className="kx-eyebrow">Om Bokix</div>
            <h1 className="ab-h1">Bokföring som går att förstå</h1>
            <p className="ab-lead">Bokix är ett svenskt bokföringsprogram för småföretag. Du berättar vad som har hänt, med vanliga ord, och Bokix gör om det till bokföring.</p>
          </Reveal>
          <Reveal scale delay={120}><Translator /></Reveal>
        </section>

        <KitSection title="Därför finns Bokix" alt>
          <div className="ab-story">
            <p>Vi startade Bokix för att bokföring kändes krångligare än den behöver vara. Programmen vi provade var dyra för det man fick och skrivna för den som redan kan debet och kredit.</p>
            <p>Så vi byggde ett där du beskriver vad som har hänt, och programmet väljer konton och räknar ut momsen. Den som vill kan fortfarande se och ändra varje verifikation.</p>
            <p>Vi är två personer som bygger och sköter Bokix själva, från koden till supporten.</p>
            <p className="ab-quote">När du mejlar oss är det vi som har byggt Bokix som svarar.</p>
          </div>
        </KitSection>

        <section className="kx-section" style={{ background: 'var(--mkt-page-bg)' }}>
          <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 36px' }}>
            <h2 className="kx-h2" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>Så bygger vi Bokix</h2>
            <p className="kx-sub" style={{ fontSize: '17px' }}>Fyra saker som avgör hur varje del av programmet blir.</p>
          </Reveal>
          <div>
            {PRINCIPLES.map(p => (
              <Reveal key={p.id} className="ab-pr">
                <div>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
                <Mini id={p.id} />
              </Reveal>
            ))}
          </div>
        </section>

        <section className="kx-section" style={{ background: 'var(--mkt-ivory)' }}>
          <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 48px' }}>
            <h2 className="kx-h2" style={{ fontSize: 'clamp(28px, 4vw, 42px)' }}>Där din bokföring finns</h2>
            <p className="kx-sub" style={{ fontSize: '17px' }}>
              Mer om hur den skyddas på <Link to="/sakerhet" className="ab-link">Säkerhet</Link>.
            </p>
          </Reveal>
          <Reveal delay={60} className="ab-place">
            {PLACE.map(p => (
              <div key={p.big}>
                <div className="ab-place-big">{p.big}</div>
                <p className="ab-place-small">{p.small}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {latest.length > 0 && (
          <KitSection title="Det senaste vi byggt" lead="Bokix blir bättre hela tiden.">
            <div className="ab-news">
              {latest.map(p => (
                <Link key={p.path} to={p.path}>
                  <span>{p.title}</span>
                  <small>{p.category}</small>
                </Link>
              ))}
            </div>
            <p className="kx-row-body" style={{ marginTop: '18px' }}>
              <Link to="/nyheter" className="ab-link">Alla nyheter</Link>
              {' · '}
              <Link to="/bokix-i-korthet" className="ab-link">Bokix i korthet</Link>
            </p>
          </KitSection>
        )}

        <KitSection title="Vanliga frågor om oss" alt>
          <KitFaq items={FAQ} />
        </KitSection>

        <section className="ab-contact">
          <Reveal>
            <div className="kx-eyebrow">Prata med oss</div>
            <a className="ab-mail" href="mailto:support@bokix.se">support@bokix.se</a>
            <div className="kx-actions" style={{ justifyContent: 'center' }}>
              <GhostLink to="/boka-genomgang">Boka en genomgång</GhostLink>
            </div>
          </Reveal>
        </section>
      </div>
    </MarketingLayout>
  );
}
