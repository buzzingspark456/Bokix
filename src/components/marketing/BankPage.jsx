import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronDown, ChevronRight, FileDown, UploadCloud, Columns3, CheckCircle2,
  ShieldCheck, KeyRound, Undo2, Copy, Landmark, Sparkles,
} from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import BankFlow from './BankFlow';
import { BankLogo } from '../shared/BrandLogos';
import { BANK_SOURCES, OTHER_BANK_HINT, MAX_BANK_FILE_MB, splitBankPath } from '../../utils/bankSources';

// ── "Koppla banken" (/koppla-bank) — den publika sidan för någon som
// undrar hur banktransaktionerna ska ta sig in i bokföringen. Systersida
// till /byt-bokforingsprogram och byggd på exakt samma sätt: en delad
// animation i hjälten (BankFlow.jsx, som också sitter på startsidan), en
// väljare som svarar på "var ligger knappen i MIN bank", och ärliga
// avsnitt om vad som faktiskt händer med filen.
//
// Sidans SVÅRASTE mening är rubriken. "Koppla din bank" är vad besökaren
// söker på, men får INTE läsas som "logga in med BankID i Bokix så
// hämtas transaktionerna automatiskt" — den funktionen finns inte, och
// hela avsnittet "Vi frågar aldrig efter dina bankuppgifter" nedan
// bygger tvärtom på att den inte gör det. Därför säger hjälten rakt ut
// vad det ÄR (en exportfil från internetbanken) redan i ingressen, och
// säkerhetsavsnittet vänder frånvaron av en direktkoppling till det den
// faktiskt är för en småföretagare: ingen tredje part som sitter på
// inloggningen till företagskontot.
//
// All faktatext här är kontrollerad mot koden, inte mot en broschyr:
// filformaten och 10 MB-taket kommer ur samma konstanter som
// uppladdningen kontrollerar (bankSources.js), kolumngissningen och
// teckenkodningen finns i utils/bankImport.js (guessColumnMapping,
// decodeBankCsvText), dubblettskyddet i dedupeAgainstExisting, ångra-
// knappen och de fyra statusarna i Bank.jsx.

const STEPS = [
  {
    icon: FileDown, title: 'Exportera kontoutdraget ur din internetbank',
    body: 'Alla svenska internetbanker kan spara transaktionslistan som en fil. Välj din bank nedan så visar vi var knappen brukar sitta. Du laddar ner filen precis som vanligt — Bokix är inte inblandat i det steget.',
  },
  {
    icon: UploadCloud, title: 'Ladda upp filen i Bokix',
    body: `Bank → Importera transaktioner. Dra in filen eller välj den från datorn. CSV, TXT, XLSX eller XLS, upp till ${MAX_BANK_FILE_MB} MB. Svenska tecken klarar sig även i äldre exporter, och både kommatecken och semikolon som avgränsare funkar.`,
  },
  {
    icon: Columns3, title: 'Bekräfta kolumnerna',
    body: 'Bokix gissar vilken kolumn som är datum, text och belopp — även när rubrikerna är på engelska, och även när uttag och insättning ligger i två skilda kolumner. Gissningen visas för dig att rätta innan något läses in.',
  },
  {
    icon: CheckCircle2, title: 'Matcha och bokför',
    body: 'Varje rad hamnar som "ej hanterad" tills du gör något med den. Inbetalningar föreslås mot dina obetalda kundfakturor, utbetalningar mot leverantörsfakturor, och resten kan du snabbokföra på ett konto direkt i listan.',
  },
];

// Det som skiljer en import som går att lita på från en som bara läser en
// fil. Varje punkt motsvarar en funktion som finns i koden, ingen är en
// avsiktsförklaring.
const SAFEGUARDS = [
  {
    icon: KeyRound, accent: ACCENT.green, title: 'Vi frågar aldrig efter dina bankuppgifter',
    body: 'Ingen BankID-inloggning till banken, inget lösenord, ingen direktkoppling som ligger kvar och läser ditt konto. Du exporterar en fil och laddar upp den. Bokix kan bara se det du själv skickar med.',
  },
  {
    icon: Copy, accent: ACCENT.blue, title: 'Samma period två gånger gör ingen skada',
    body: 'Importen jämför varje rad mot det som redan ligger inne och hoppar över dubbletter. Du kan alltså ta med lite marginal i datumintervallet utan att kontoutdraget fylls av dubbla rader.',
  },
  {
    icon: Undo2, accent: ACCENT.teal, title: 'En import går att ångra',
    body: 'Varje uppladdning sparas som en egen omgång. Blev det fel fil eller fel konto tar du bort hela omgången med en knapp, utan att röra något du importerat tidigare.',
  },
  {
    icon: ShieldCheck, accent: ACCENT.green, title: 'Ingenting bokförs bakom ryggen på dig',
    body: 'Matchningarna är förslag. En rad blir en verifikation först när du har tryckt på den — och rader du inte vill ha kvar kan markeras som ignorerade i stället för att bli halvfärdiga.',
  },
];

const FAQ = [
  {
    q: 'Kopplar Bokix till min bank direkt?',
    a: 'Nej. Bokix läser kontoutdraget som en fil du själv exporterar från din internetbank. Det betyder att du aldrig lämnar ut dina bankinloggningsuppgifter till oss, och att inget system utanför banken har löpande läsrättigheter på ditt företagskonto. Nackdelen är att du hämtar filen själv i stället för att den kommer automatiskt — en gång i veckan eller en gång i månaden räcker för de flesta.',
  },
  {
    q: 'Vilka banker fungerar?',
    a: 'Alla. Vi har färdiga klickvägar för Nordea, SEB, Swedbank, Handelsbanken, Länsförsäkringar, ICA Banken, Skandia, Lunar och Northmill, men importen är en generell CSV- och Excel-läsare där du kopplar kolumnerna själv. Har du en bank som inte står i listan — eller ett utländskt konto — läses filen på precis samma sätt.',
  },
  {
    q: 'Min bank exporterar med engelska rubriker, spelar det roll?',
    a: 'Nej. Kolumngissningen känner igen både svenska och engelska rubriker, och den hanterar både en enda signerad beloppskolumn och separata kolumner för uttag och insättning. Skulle gissningen bli fel rättar du den i steg två innan något läses in.',
  },
  {
    q: 'Vad händer med en inbetalning från en kund?',
    a: 'Den föreslås mot dina obetalda kundfakturor utifrån belopp, datum och text. Godkänner du förslaget registreras betalningen på fakturan och verifikationen skapas. Hittas ingen bra kandidat ligger raden kvar som ej hanterad tills du bokför den själv.',
  },
  {
    q: 'Kan jag importera flera konton?',
    a: 'Ja, ladda upp en fil per konto. Raderna hamnar i samma kontoutdrag i Bokix och du bokför dem mot det konto de hör hemma på.',
  },
  {
    q: 'Kostar bankimporten extra?',
    a: 'Nej, den ingår. Bokix kostar 129 kr/mån utan anställda och 179 kr/mån med lönemodulen, och de första 30 dagarna kostar ingenting.',
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

// HowTo-schemat byggs ur STEPS (map:ad, inte en handskriven kopia som kan
// glida isär) — samma mönster som SwitchPage.jsx.
const HOWTO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Så får du in banktransaktionerna i Bokix',
  description: 'Exportera kontoutdraget ur internetbanken och läs in det i Bokix, i fyra steg.',
  step: STEPS.map((s, i) => ({
    '@type': 'HowToStep', position: i + 1, name: s.title, text: s.body,
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
      <div style={{ maxHeight: open ? '440px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, padding: '0 4px 20px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

// Vit platta bakom varje logotyp, av samma skäl som LogoTile i
// SwitchPage.jsx: flera av bildfilerna har egen vit bakgrund inbakad och
// hade sett ut som klistermärken mot marknadssajtens mörka tema. Bredare
// än hög här — banklogotyperna är ordbilder, inte kvadratiska symboler
// (se BankLogo).
//
// Namnet som reserv när en bank saknar bildfil: alla nio har en idag, men
// nästa bank som läggs till i bankSources.js kommer sannolikt in som en
// rad med klickväg innan någon hittat en logotyp åt den — och då ska
// väljaren visa "Nordnet", inte en trasig bild-ikon.
function BankTile({ bank, active }) {
  return (
    <span style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100%', height: 86, padding: '0 12px', borderRadius: '13px',
      background: bank.logo ? '#fff' : IVORY,
      border: `1px solid ${active ? BRAND.green : CARD_BORDER}`, flexShrink: 0,
      fontSize: '15px', fontWeight: 800, letterSpacing: '-0.01em', color: active ? BRAND.greenDark : INK_SOFT,
    }}>
      {bank.logo ? <BankLogo bank={bank} maxW={90} maxH={74} /> : bank.name}
    </span>
  );
}

export default function BankPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  const [selected, setSelected] = useState(BANK_SOURCES[0].id);

  // `null` = "Annan bank"-brickan, som har sin egen generella text i
  // stället för en bankspecifik klickväg.
  const active = BANK_SOURCES.find(b => b.id === selected) || null;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Koppla banken till bokföringen i Bokix',
    description: 'Så får du in banktransaktionerna i Bokix: exportera kontoutdraget ur internetbanken och läs in filen. Fungerar med alla svenska banker.',
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/koppla-bank`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title="Koppla banken till bokföringen | Importera kontoutdrag i Bokix"
        description="Exportera kontoutdraget ur Nordea, Swedbank, Handelsbanken, Länsförsäkringar, ICA Banken, SEB, Skandia, Lunar eller Northmill och läs in det i Bokix. Transaktionerna matchas mot dina fakturor — och vi frågar aldrig efter dina bankuppgifter."
        path="/koppla-bank"
        type="article"
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={HOWTO_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />

      <style>{`
        /* Bankväljaren nedan. Hjältens flöde bor i BankFlow.jsx och har
           sina egna stilar. Brickorna är bredare än programväljarens på
           /byt-bokforingsprogram — ordbilder behöver bredd, inte höjd, och
           det är BREDDEN som avgör hur stor en ordbild faktiskt blir (den
           slår i sitt breddtak långt innan sitt höjdtak). Måtten hänger
           ihop med sektionens 1000px: 5×184 + 4×11 går precis in, så de tio
           brickorna hamnar på 5+5 i stället för 4+4+2 med en halvtom sista
           rad. Ändras det ena måste det andra räknas om. */
        .bx-bank-picker { display: grid; grid-template-columns: repeat(auto-fill, minmax(184px, 1fr)); gap: 11px; }
        .bx-bank-path { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; }
        @media (max-width: 560px) {
          .bx-bank-picker { grid-template-columns: repeat(auto-fill, minmax(148px, 1fr)); }
        }
      `}</style>

      {/* ── Hjälte: banken → filen → bokförda rader ── */}
      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 4.6vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.15 }}>
            Få in banken i bokföringen
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7, margin: '0 0 34px' }}>
            Exportera kontoutdraget ur din internetbank och läs in det i Bokix. Transaktionerna matchas mot dina fakturor och blir färdiga verifikationer — utan att du lämnar ut en enda bankinloggning.
          </p>

          {/* Samma animerade flöde som startsidans banksektion — en
              komponent, två placeringar (se BankFlow.jsx). "Annan bank"-
              raden är avstängd här: sidans egen väljare längre ner har en
              egen, utförligare "Annan bank"-bricka. */}
          <BankFlow note={false} />
        </Reveal>
      </section>

      {/* ── Välj bank → var ligger exporten där? ── */}
      <section style={{ padding: '56px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
              Var ligger exporten i din bank?
            </h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.65 }}>
              Välj din bank så visar vi klickvägen. Själva importen fungerar likadant oavsett bank — filen är bara rader med datum, text och belopp.
            </p>
          </Reveal>

          <Reveal className="bx-bank-picker" style={{ marginBottom: '18px' }}>
            {BANK_SOURCES.map(b => {
              const on = selected === b.id;
              return (
                <button
                  key={b.id} onClick={() => setSelected(b.id)} aria-pressed={on} aria-label={b.name}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    padding: '10px 10px 12px', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: '12.5px', fontWeight: 700, color: on ? BRAND.greenDark : INK_SOFT,
                    background: on ? 'var(--mkt-accent-green-soft)' : 'var(--mkt-card-bg)',
                    border: `1.5px solid ${on ? BRAND.green : CARD_BORDER}`,
                    boxShadow: on ? 'none' : CARD_SHADOW, transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <BankTile bank={b} active={on} />
                  {b.name}
                </button>
              );
            })}
            <button
              onClick={() => setSelected('other')} aria-pressed={selected === 'other'}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                padding: '10px 10px 12px', borderRadius: '14px', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '12.5px', fontWeight: 700, color: selected === 'other' ? BRAND.greenDark : INK_SOFT,
                background: selected === 'other' ? 'var(--mkt-accent-green-soft)' : 'var(--mkt-card-bg)',
                border: `1.5px solid ${selected === 'other' ? BRAND.green : CARD_BORDER}`,
                boxShadow: selected === 'other' ? 'none' : CARD_SHADOW,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: 86, borderRadius: '13px', background: IVORY, border: `1px solid ${CARD_BORDER}`, color: MUTED }}>
                <Landmark size={34} strokeWidth={1.6} />
              </span>
              Annan bank
            </button>
          </Reveal>

          <Reveal delay={80} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW }}>
            {active ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                  {active.logo && (
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 176, height: 72, padding: '0 12px', borderRadius: '12px', background: '#fff', border: `1px solid ${CARD_BORDER}` }}>
                      <BankLogo bank={active} maxW={90} maxH={74} />
                    </span>
                  )}
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.01em' }}>
                    Så hämtar du kontoutdraget från {active.name}
                  </h3>
                </div>
                {/* Klickvägen som brickor med pilar emellan — samma sträng
                    som appens importguide visar, bara uppdelad på
                    separatorn (splitBankPath). */}
                <div className="bx-bank-path">
                  {splitBankPath(active.path).map((part, i) => (
                    <React.Fragment key={part}>
                      {i > 0 && <ChevronRight size={14} color={MUTED} style={{ flexShrink: 0 }} />}
                      <span style={{ padding: '7px 12px', borderRadius: '9px', background: IVORY, border: `1px solid ${CARD_BORDER}`, fontSize: '13px', fontWeight: 600, color: INK_SOFT }}>{part}</span>
                    </React.Fragment>
                  ))}
                </div>
                <p style={{ margin: '16px 0 0', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
                  Hittar du inte knappen? Menyplaceringen kan ha ändrats sedan guiden skrevs — sök på "exportera" eller "kontoutdrag" i bankens egen hjälp. {OTHER_BANK_HINT}
                </p>
              </>
            ) : (
              <>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, margin: '0 0 10px', letterSpacing: '-0.01em' }}>Din bank står inte i listan</h3>
                <p style={{ fontSize: '14px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
                  {OTHER_BANK_HINT} Bokix läser filen oavsett vilken bank som skapade den — importen är en generell CSV- och Excel-läsare, inte en integration mot varje enskild bank. Det gäller även utländska konton.
                </p>
              </>
            )}
          </Reveal>
        </div>
      </section>

      {/* ── Fyra steg ── */}
      <section style={{ padding: '60px 24px', background: IVORY }}>
        <div style={{ maxWidth: '780px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>Så går det till</h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '540px', margin: '0 auto', lineHeight: 1.65 }}>
              Första gången tar ett par minuter. Sedan är det en fil att dra in, ungefär lika ofta som du vill ha bokföringen uppdaterad.
            </p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {STEPS.map((s, i) => {
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

      {/* ── Vad som skyddar dig ── */}
      <section style={{ padding: '60px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
              En fil är en trygghet, inte en begränsning
            </h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.65 }}>
              Bokix har ingen direktkoppling in i din bank — och det är ett medvetet val, inte en lucka.
            </p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {SAFEGUARDS.map((s, i) => (
              <Reveal key={s.title} delay={i * 60} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '22px 24px', boxShadow: CARD_SHADOW }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <span style={{ width: 34, height: 34, borderRadius: '9px', background: s.accent.soft, color: s.accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <s.icon size={17} />
                  </span>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.005em' }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal delay={120} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '18px', background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '18px 22px' }}>
            <Sparkles size={18} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
              Betalar dina kunder med kort? Då behöver du inte filen för de raderna — <Link to="/integrationer" style={{ color: BRAND.greenDark, fontWeight: 600 }}>Stripe och Zettle</Link> lämnar sina underlag direkt till Bokix.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '70px 24px 30px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor om bankimporten</h2>
          </Reveal>
          <Reveal delay={100} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '8px 24px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px', color: MUTED }}>
            Byter du program samtidigt? Ta med dig historiken via <Link to="/byt-bokforingsprogram" style={{ color: BRAND.greenDark, fontWeight: 600 }}>en SIE4-fil</Link>, och läs om <Link to="/sakerhet" style={{ color: BRAND.greenDark, fontWeight: 600 }}>hur vi hanterar din data</Link>.
          </Reveal>
        </div>
      </section>

      <section style={{ padding: '30px 24px 100px', background: 'var(--mkt-page-bg)', textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Testa med förra månadens kontoutdrag
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '28px', lineHeight: 1.65 }}>
            Skapa kontot, ladda upp filen och se hur många rader som matchar sig själva. 30 dagar kostnadsfritt, ingen bindningstid på månadsplanen.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={enterApp} style={{ padding: '14px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: 'pointer' }}>Kom igång gratis</button>
            <Link to="/boka-genomgang" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '14px 24px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '15px', textDecoration: 'none' }}>
              Boka en genomgång <ArrowRight size={15} />
            </Link>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
