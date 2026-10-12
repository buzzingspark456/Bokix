import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout from './MarketingLayout';
import { INK_SOFT, MUTED, CARD_BORDER, CARD_SHADOW } from './marketingTokens';
import { KitStyles, SubHero, KitSection, CenterSection, KitFaq, KitCta, PrimaryButton, GhostLink } from './subpageKit';
import { PageMeta, JsonLd, SITE_URL, DEFAULT_OG_IMAGE } from '../../utils/seo';
import MigrationFlow from './MigrationFlow';
import DemoPlayer, { DemoStyles, PlayOnView } from './DemoPlayer';
import { makeSwitchDemo } from './demoScenesOther';
import { ProgramLogo } from '../shared/BrandLogos';
import { MIGRATION_SOURCES, OTHER_PROGRAM_HINT, MENU_MOVED_HINT } from '../../utils/migrationSources';

// ── "Byt till Bokix" (/byt-bokforingsprogram) — den publika sidan för
// någon som redan bokför någon annanstans och undrar om de kan ta med
// sig bokföringen hit. Sidan svarar på HUR, och är byggd runt en sak som
// faktiskt finns i produkten — SIE4-importen (SieImportModal.jsx +
// utils/sieImport.js).
//
// Programlistan (namn, logotyp, exportvägledning) kommer från
// src/utils/migrationSources.js, samma källa som importguiden inne i
// appen använder. Två listor hade garanterat glidit isär: en besökare
// som sett "Wint" här och sedan inte hittar Wint i modalen tappar
// förtroendet direkt.
//
// Om konkurrentloggorna: bara identifierande användning ("byt hit från
// X"), inga påståenden OM dem — inga priser, inga funktionsjämförelser,
// ingen "vi är bättre"-tabell. Se migrationSources.js för hela
// resonemanget bakom den linjen.

// De fyra stegen i ett verkligt byte. Steg 2 beskriver den RIKTIGA
// importen (fyrstegsguiden i appen), inte ett påhittat "ett klick och
// allt är på plats" — den kräver en SIE4-fil, en kontomappning och en
// bekräftelse, och det ska sidan säga rakt ut.
const SWITCH_STEPS = [
  {
    title: 'Exportera en SIE4-fil ur ditt nuvarande program',
    body: 'Alla svenska bokföringsprogram kan exportera SIE — det är branschstandarden och din data är din. Välj ditt program ovan så visar vi var exporten brukar ligga.',
  },
  {
    title: 'Ladda upp filen i Bokix',
    body: 'Inställningar → Import och export → Flytta hit bokföringen. Guiden läser filen och visar vad den hittade: konton, verifikationer och ingående balanser.',
  },
  {
    title: 'Granska kontomappningen och bekräfta',
    body: 'Konton som saknas i din kontoplan, eller heter något annat än i filen, flaggas var för sig. Ingenting skrivs in i bokföringen förrän du bekräftar i sista steget.',
  },
  {
    title: 'Bokför vidare i Bokix',
    body: 'Historiken ligger inne, du fortsätter löpande härifrån. Och du kan när som helst exportera allt till SIE4 igen om du vill vidare — samma öppna format, ingen inlåsning.',
  },
];

// Ärligt om vad SIE4-formatet faktiskt bär med sig. Listan speglar exakt
// vad utils/sieImport.js läser respektive medvetet hoppar över — den får
// INTE bli en önskelista: en besökare som tror att kundregistret följer
// med och upptäcker motsatsen efter bytet är ett värre problem än en
// besökare som visste det i förväg.
const SWITCH_DEMO = makeSwitchDemo(SWITCH_STEPS);

const INCLUDED = [
  'Hela kontoplanen med kontonamn',
  'Verifikationer med alla konteringsrader',
  'Ingående balanser, som en egen verifikation',
  'Verifikationsserie, datum och text',
];
const NOT_INCLUDED = [
  'Kund- och leverantörsregister',
  'Öppna fakturor och deras betalstatus',
  'Kvitto- och fakturabilder (PDF/bilagor)',
  'Löneunderlag från det gamla systemet',
];

const FAQ = [
  {
    q: 'Kan jag flytta min bokföring från Fortnox, Visma eller Bokio till Bokix?',
    a: 'Ja. Exportera en SIE4-fil ur det program du använder idag och läs in den i Bokix under Inställningar → Import och export. Importen är en generell SIE4-läsare, inte en integration per leverantör, så den fungerar likadant oavsett vilket program som skapade filen.',
  },
  {
    q: 'Vad händer om ett konto i filen inte finns i Bokix kontoplan?',
    a: 'Det flaggas i importguidens kontomappning. Du väljer själv per konto om det ska läggas till som ett nytt konto eller bokas om till ett befintligt. Verifikationsraderna skrivs om enligt ditt val innan något sparas.',
  },
  {
    q: 'Skrivs något in i bokföringen innan jag har godkänt det?',
    a: 'Nej. Fram till sista steget är allt bara inläst och visat på skärmen. Först när du bekräftar förhandsgranskningen skapas konton och verifikationer. Guiden varnar också om samma fil ser ut att ha importerats tidigare.',
  },
  {
    q: 'Måste jag flytta all historik, eller kan jag börja om från ett datum?',
    a: 'Båda funkar. Många byter vid en periodgräns och tar bara med ingående balanser för det nya räkenskapsåret. Vill du ha hela historiken sökbar i Bokix importerar du hela SIE-filen istället.',
  },
  {
    q: 'Måste jag säga upp det gamla programmet direkt?',
    a: 'Nej, och det kan vara klokt att låta bli tills du sett att allt kom med. Tänk också på att bokföringslagen kräver att räkenskapsinformationen bevaras till och med det sjunde året efter utgången av det kalenderår då räkenskapsåret avslutades — spara SIE-filen och det gamla systemets underlag oavsett vilket program du bokför i.',
  },
  {
    q: 'Kostar bytet något?',
    a: 'Nej. Importen ingår, och de första 30 dagarna i Bokix kostar ingenting alls. Därefter 129 kr/mån utan anställda och 179 kr/mån med lönemodulen.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

// HowTo-schema för själva bytet — samma fyra steg som SWITCH_STEPS, en
// enda källa (map:ad, inte en handskriven kopia som kan glida isär).
const HOWTO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Så byter du bokföringsprogram till Bokix',
  description: 'Flytta din bokföring till Bokix med en SIE4-fil, i fyra steg.',
  step: SWITCH_STEPS.map((s, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: s.title,
    text: s.body,
  })),
};

// Vit platta bakom varje logotyp: flera av bildfilerna (Visma,
// SpeedLedger, Björn Lundén) har egen vit bakgrund inbakad och skulle se
// ut som klistermärken mot marknadssidans mörka tema. Samma lösning som
// i appens importguide.
function LogoTile({ src, alt, size = 30, box = 52, style }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: box, height: box, borderRadius: '13px', background: '#fff', border: `1px solid ${CARD_BORDER}`, boxShadow: CARD_SHADOW, flexShrink: 0, ...style }}>
      <ProgramLogo src={src} alt={alt} size={size} />
    </span>
  );
}

export default function SwitchPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  const [selected, setSelected] = useState(MIGRATION_SOURCES[0].id);

  // `null` = "annat program"-brickan, som har sin egen generella text i
  // stället för en leverantörsspecifik meny-väg.
  const active = MIGRATION_SOURCES.find(p => p.id === selected) || null;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Byt bokföringsprogram till Bokix: ta med dig hela bokföringen',
    description: 'Så flyttar du bokföringen från Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger till Bokix med en SIE4-fil.',
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/byt-bokforingsprogram`,
    image: DEFAULT_OG_IMAGE,
    datePublished: '2026-09-08',
  };

  const pickerButton = (on) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px',
    padding: '16px 8px', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: '13px', fontWeight: 700, color: on ? 'var(--mkt-accent-green-fg)' : INK_SOFT,
    background: 'var(--mkt-card-bg)',
    border: `1.5px solid ${on ? BRAND.green : CARD_BORDER}`,
    transition: 'border-color 0.15s',
  });

  return (
    <MarketingLayout>
      <PageMeta
        title="Byt bokföringsprogram: flytta från Fortnox, Visma, Bokio"
        description="Byt från Fortnox, Visma, Bokio, Björn Lundén eller något annat program till Bokix. Läs in en SIE4-fil, så följer konton, verifikationer och balanser med."
        path="/byt-bokforingsprogram"
        type="article"
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={HOWTO_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />
      <KitStyles />
      <DemoStyles />
      <style>{`
        .bx-switch-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(108px, 1fr)); gap: 10px; }
        .bx-switch-cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px; }
        @media (max-width: 620px) { .bx-switch-cols { grid-template-columns: 1fr; gap: 24px; } }
      `}</style>

      <SubHero
        eyebrow="Byt till Bokix"
        title="Ta med dig hela bokföringen"
        lead="Bokför du i Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger i dag? Exportera en SIE4-fil därifrån och läs in den i Bokix. Konton, verifikationer och ingående balanser följer med."
        actions={<>
          <PrimaryButton onClick={enterApp}>Kom igång gratis</PrimaryButton>
          <GhostLink to="/boka-genomgang">Boka hjälp med bytet</GhostLink>
        </>}
        visual={<MigrationFlow note={false} />}
      />

      <KitSection title="Vad bokför du i dag?" lead="Välj ditt program så visar vi var SIE-exporten brukar ligga. Själva importen fungerar likadant oavsett program.">
        <div className="bx-switch-picker" style={{ marginBottom: '24px' }}>
          {MIGRATION_SOURCES.map(p => (
            <button key={p.id} type="button" onClick={() => setSelected(p.id)} aria-pressed={selected === p.id} style={pickerButton(selected === p.id)}>
              <LogoTile src={p.logo} alt={p.name} size={28} box={46} style={{ boxShadow: 'none' }} />
              {p.name}
            </button>
          ))}
          <button type="button" onClick={() => setSelected('other')} aria-pressed={selected === 'other'} style={pickerButton(selected === 'other')}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: '13px', border: `1px solid ${CARD_BORDER}`, color: MUTED, fontSize: '19px', fontWeight: 700 }}>?</span>
            Annat program
          </button>
        </div>
        <div className="kx-list" style={{ paddingTop: '20px' }}>
          {active ? (
            <>
              <div className="kx-row-title" style={{ marginBottom: '10px' }}>
                Så exporterar du SIE4 ur {active.name}
                {active.note && <span className="kx-row-meta">{active.note}</span>}
              </div>
              <ol className="kx-row-body" style={{ margin: 0, paddingLeft: '20px', lineHeight: 1.85 }}>
                {active.steps.map((st, i) => <li key={i}>{st}</li>)}
              </ol>
              <p style={{ margin: '14px 0 0', fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>{MENU_MOVED_HINT}</p>
            </>
          ) : (
            <>
              <div className="kx-row-title" style={{ marginBottom: '10px' }}>Ditt program står inte i listan</div>
              <p className="kx-row-body">
                {OTHER_PROGRAM_HINT} Bokix läser SIE4-filen oavsett vilket program som skapade den — importen är en generell läsare av filstandarden, inte en integration mot varje enskild leverantör.
              </p>
            </>
          )}
        </div>
      </KitSection>

      <CenterSection title="Så går bytet till" lead="De flesta är klara på en kvart. Ingenting bokförs förrän du sett vad som kommer in och tryckt på bekräfta." alt>
        <DemoPlayer steps={SWITCH_DEMO} label="Demo: så flyttar du bokföringen till Bokix" />
      </CenterSection>

      <KitSection title="Vad följer med i filen" lead="En SIE4-fil är bokföringen, inte hela det gamla systemet. Bättre att veta det nu än efter bytet.">
        <PlayOnView minHeight={260}>
          <div className="bx-switch-cols">
            <div>
              <div className="kx-eyebrow" style={{ marginBottom: '8px' }}>Följer med</div>
              <div className="kx-list">
                {INCLUDED.map((x, i) => (
                  <p key={x} className="kx-row-body dp-slide" style={{ '--d': `${0.2 + i * 0.25}s`, padding: '14px 0', borderBottom: '1px solid var(--mkt-border-soft)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    {x}<span className="dp-ok dp-pop" style={{ '--d': `${0.5 + i * 0.25}s` }}>Följer med</span>
                  </p>
                ))}
              </div>
            </div>
            <div>
              <div className="kx-eyebrow" style={{ marginBottom: '8px' }}>Följer inte med</div>
              <div className="kx-list">
                {NOT_INCLUDED.map((x, i) => (
                  <p key={x} className="kx-row-body dp-in" style={{ '--d': `${1.3 + i * 0.25}s`, padding: '14px 0', borderBottom: '1px solid var(--mkt-border-soft)', color: MUTED }}>{x}</p>
                ))}
              </div>
            </div>
          </div>
        </PlayOnView>
        <p className="kx-row-body" style={{ marginTop: '24px', color: MUTED, fontSize: '14px' }}>
          Kunder och leverantörer lägger du upp i Bokix, eller så skapas de när du fakturerar första gången. Spara SIE-filen och det gamla systemets underlag även efter bytet: bokföringslagen kräver att räkenskapsinformationen bevaras till och med det sjunde året efter utgången av det kalenderår då räkenskapsåret avslutades.
        </p>
      </KitSection>

      <KitSection title="Vanliga frågor om att byta" alt>
        <KitFaq items={FAQ} />
        <p className="kx-row-body" style={{ marginTop: '20px', fontSize: '14px', color: MUTED }}>
          Osäker på vad SIE4 är? Läs <Link to="/blogg/sie4-flytta-bokforing" style={{ color: 'var(--mkt-accent-green-fg)', fontWeight: 600 }}>SIE4 förklarat: så flyttar du bokföringen</Link>.
        </p>
      </KitSection>

      <KitCta title="Ta med dig bokföringen hit" lead="Skapa kontot, importera din SIE4-fil och se hela historiken på plats. 30 dagar kostnadsfritt, ingen bindningstid på månadsplanen.">
        <PrimaryButton onClick={enterApp}>Kom igång gratis</PrimaryButton>
        <GhostLink to="/boka-genomgang">Boka hjälp med bytet</GhostLink>
      </KitCta>
    </MarketingLayout>
  );
}
