import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, FileDown, UploadCloud, CheckCircle2, CircleSlash, ShieldCheck, CalendarClock } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import MigrationFlow from './MigrationFlow';
import { ProgramLogo } from '../shared/BrandLogos';
import { MIGRATION_SOURCES, OTHER_PROGRAM_HINT, MENU_MOVED_HINT } from '../../utils/migrationSources';

// ── "Byt till Bokix" (/byt-bokforingsprogram) — den publika sidan för
// någon som redan bokför någon annanstans och undrar om de kan ta med
// sig bokföringen hit. Skild från /alternativ, som svarar på en annan
// fråga (VARFÖR byta / vad Bokix är för något): den här sidan svarar
// bara på HUR, och är byggd runt en sak som faktiskt finns i produkten —
// SIE4-importen (SieImportModal.jsx + utils/sieImport.js).
//
// Programlistan (namn, logotyp, exportvägledning) kommer från
// src/utils/migrationSources.js, samma källa som importguiden inne i
// appen använder. Två listor hade garanterat glidit isär: en besökare
// som sett "Wint" här och sedan inte hittar Wint i modalen tappar
// förtroendet direkt.
//
// Om konkurrentloggorna: bara identifierande användning ("byt hit från
// X"), inga påståenden OM dem — inga priser, inga funktionsjämförelser,
// ingen "vi är bättre"-tabell. Se migrationSources.js och
// AlternativePage.jsx för hela resonemanget bakom den linjen.

// De fyra stegen i ett verkligt byte. Steg 2 beskriver den RIKTIGA
// importen (fyrstegsguiden i appen), inte ett påhittat "ett klick och
// allt är på plats" — den kräver en SIE4-fil, en kontomappning och en
// bekräftelse, och det ska sidan säga rakt ut.
const SWITCH_STEPS = [
  {
    icon: FileDown, title: 'Exportera en SIE4-fil ur ditt nuvarande program',
    body: 'Alla svenska bokföringsprogram kan exportera SIE — det är branschstandarden och din data är din. Välj ditt program ovan så visar vi var exporten brukar ligga.',
  },
  {
    icon: UploadCloud, title: 'Ladda upp filen i Bokix',
    body: 'Inställningar → Data → Importera från annat bokföringsprogram. Guiden läser filen och visar vad den hittade: konton, verifikationer och ingående balanser.',
  },
  {
    icon: CheckCircle2, title: 'Granska kontomappningen och bekräfta',
    body: 'Konton som saknas i din kontoplan, eller heter något annat än i filen, flaggas var för sig. Ingenting skrivs in i bokföringen förrän du bekräftar i sista steget.',
  },
  {
    icon: CalendarClock, title: 'Bokför vidare i Bokix',
    body: 'Historiken ligger inne, du fortsätter löpande härifrån. Och du kan när som helst exportera allt till SIE4 igen om du vill vidare — samma öppna format, ingen inlåsning.',
  },
];

// Ärligt om vad SIE4-formatet faktiskt bär med sig. Listan speglar exakt
// vad utils/sieImport.js läser respektive medvetet hoppar över — den får
// INTE bli en önskelista: en besökare som tror att kundregistret följer
// med och upptäcker motsatsen efter bytet är ett värre problem än en
// besökare som visste det i förväg.
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
    a: 'Ja. Exportera en SIE4-fil ur det program du använder idag och läs in den i Bokix under Inställningar → Data. Importen är en generell SIE4-läsare, inte en integration per leverantör, så den fungerar likadant oavsett vilket program som skapade filen.',
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
    a: 'Nej, och det kan vara klokt att låta bli tills du sett att allt kom med. Tänk också på att bokföringslagen kräver att räkenskapsinformationen bevaras i sju år — spara SIE-filen och det gamla systemets underlag oavsett vilket program du bokför i.',
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

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '20px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700, color: INK }}>{q}</span>
        <ChevronDown size={18} color={MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '340px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, padding: '0 4px 20px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

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
    headline: 'Byt bokföringsprogram till Bokix — ta med dig hela bokföringen',
    description: 'Så flyttar du bokföringen från Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger till Bokix med en SIE4-fil.',
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/byt-bokforingsprogram`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title="Byt bokföringsprogram till Bokix | Fortnox, Visma, Bokio m.fl."
        description="Byt från Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger till Bokix. Exportera en SIE4-fil, läs in den i Bokix och fortsätt bokföra — konton, verifikationer och ingående balanser följer med."
        path="/byt-bokforingsprogram"
        type="article"
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={HOWTO_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />

      <style>{`
        /* Programväljaren nedan (hjältens loggflöde bor i MigrationFlow.jsx
           och har sina egna stilar). */
        .bx-switch-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 10px; }
        @media (max-width: 560px) {
          .bx-switch-picker { grid-template-columns: repeat(auto-fill, minmax(102px, 1fr)); }
        }
      `}</style>

      {/* ── Hjälte: därifrån → hit ── */}
      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '780px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 4.6vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.15 }}>
            Byt till Bokix — ta med dig hela bokföringen
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7, margin: '0 0 34px' }}>
            Bokför du i Fortnox, Visma, Spiris, Bokio, Björn Lundén, Wint eller SpeedLedger idag? Exportera en SIE4-fil därifrån och läs in den i Bokix. Konton, verifikationer och ingående balanser följer med.
          </p>

          {/* Samma animerade flöde som startsidans bytessektion — en
              komponent, två placeringar (se MigrationFlow.jsx). "Något
              annat program?"-raden är avstängd här: sidans egen
              programväljare längre ner har en egen, utförligare
              "Annat program"-bricka. */}
          <MigrationFlow note={false} />
        </Reveal>
      </section>

      {/* ── Välj program → var ligger SIE-exporten där? ── */}
      <section style={{ padding: '56px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
              Vad bokför du i idag?
            </h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '560px', margin: '0 auto', lineHeight: 1.65 }}>
              Välj ditt program så visar vi var SIE-exporten brukar ligga. Själva importen fungerar likadant oavsett program — SIE4 är samma filstandard för alla.
            </p>
          </Reveal>

          <Reveal className="bx-switch-picker" style={{ marginBottom: '18px' }}>
            {MIGRATION_SOURCES.map(p => {
              const on = selected === p.id;
              return (
                <button
                  key={p.id} onClick={() => setSelected(p.id)} aria-pressed={on}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px',
                    padding: '16px 8px', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '13px', fontWeight: 700, color: on ? BRAND.greenDark : INK_SOFT,
                    background: on ? 'var(--mkt-accent-green-soft)' : 'var(--mkt-card-bg)',
                    border: `1.5px solid ${on ? BRAND.green : CARD_BORDER}`,
                    boxShadow: on ? 'none' : CARD_SHADOW, transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <LogoTile src={p.logo} alt={p.name} size={28} box={46} style={{ boxShadow: 'none' }} />
                  {p.name}
                </button>
              );
            })}
            <button
              onClick={() => setSelected('other')} aria-pressed={selected === 'other'}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '9px',
                padding: '16px 8px', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '13px', fontWeight: 700, color: selected === 'other' ? BRAND.greenDark : INK_SOFT,
                background: selected === 'other' ? 'var(--mkt-accent-green-soft)' : 'var(--mkt-card-bg)',
                border: `1.5px solid ${selected === 'other' ? BRAND.green : CARD_BORDER}`,
                boxShadow: selected === 'other' ? 'none' : CARD_SHADOW,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: '13px', background: IVORY, border: `1px solid ${CARD_BORDER}`, color: MUTED, fontSize: '19px', fontWeight: 700 }}>?</span>
              Annat program
            </button>
          </Reveal>

          <Reveal delay={80} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW }}>
            {active ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <LogoTile src={active.logo} alt={active.name} size={26} box={44} style={{ boxShadow: 'none' }} />
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.01em' }}>
                      Så exporterar du SIE4 ur {active.name}
                    </h3>
                    {active.note && <div style={{ fontSize: '12.5px', color: MUTED, marginTop: '2px' }}>{active.note}</div>}
                  </div>
                </div>
                <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: INK_SOFT, lineHeight: 1.8 }}>
                  {active.steps.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
                <p style={{ margin: '14px 0 0', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
                  {MENU_MOVED_HINT}
                </p>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: '0 0 10px', letterSpacing: '-0.01em' }}>Ditt program står inte i listan</h3>
                <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
                  {OTHER_PROGRAM_HINT} Bokix läser SIE4-filen oavsett vilket program som skapade den — importen är en generell läsare av filstandarden, inte en integration mot varje enskild leverantör.
                </p>
              </>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Fyra steg ── */}
      <section style={{ padding: '60px 24px', background: IVORY }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>Så går bytet till</h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '520px', margin: '0 auto', lineHeight: 1.65 }}>
              De flesta är klara på en kvart. Ingenting bokförs förrän du sett vad som kommer in och tryckt på bekräfta.
            </p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {SWITCH_STEPS.map((s, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              return (
                <Reveal key={s.title} delay={i * 60} className="lp-card-hover" style={{
                  display: 'flex', gap: '16px', alignItems: 'flex-start', background: 'var(--mkt-card-bg)',
                  border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '20px 22px', boxShadow: CARD_SHADOW,
                }}>
                  <div style={{ width: 38, height: 38, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.icon size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: '0 0 6px' }}>{i + 1}. {s.title}</h3>
                    <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>{s.body}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Vad följer med, och vad gör det inte ── */}
      <section style={{ padding: '60px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>Vad följer med i filen</h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '540px', margin: '0 auto', lineHeight: 1.65 }}>
              En SIE4-fil är bokföringen, inte hela det gamla systemet. Bättre att veta det nu än efter bytet.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            <Reveal className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.green.soft, color: ACCENT.green.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={17} /></span>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: 0 }}>Följer med</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.9 }}>
                {INCLUDED.map(x => <li key={x}>{x}</li>)}
              </ul>
            </Reveal>
            <Reveal delay={80} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.red.soft, color: ACCENT.red.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircleSlash size={17} /></span>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: 0 }}>Följer inte med</h3>
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.9 }}>
                {NOT_INCLUDED.map(x => <li key={x}>{x}</li>)}
              </ul>
              <p style={{ margin: '12px 0 0', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
                Kunder och leverantörer lägger du upp i Bokix, eller så skapas de när du fakturerar första gången.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '18px', background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '18px 22px' }}>
            <ShieldCheck size={18} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
              Spara SIE-filen och det gamla systemets underlag även efter bytet. Bokföringslagen kräver att räkenskapsinformationen bevaras i sju år, oavsett vilket program den skapades i.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '70px 24px 30px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor om att byta</h2>
          </Reveal>
          <Reveal delay={100} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '8px 24px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: MUTED }}>
            Vill du veta varför man byter, inte bara hur? Läs <Link to="/alternativ" style={{ color: BRAND.greenDark, fontWeight: 600 }}>alternativ till Fortnox, Bokio och Spiris</Link> eller <Link to="/valja-bokforingsprogram" style={{ color: BRAND.greenDark, fontWeight: 600 }}>så väljer du bokföringsprogram</Link>.
          </Reveal>
        </div>
      </section>

      <section style={{ padding: '30px 24px 100px', background: 'var(--mkt-page-bg)', textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Ta med dig bokföringen hit
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '28px', lineHeight: 1.65 }}>
            Skapa kontot, importera din SIE4-fil och se hela historiken på plats. 30 dagar kostnadsfritt, ingen bindningstid på månadsplanen.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={enterApp} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Kom igång gratis</button>
            <Link to="/boka-genomgang" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Boka hjälp med bytet <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
