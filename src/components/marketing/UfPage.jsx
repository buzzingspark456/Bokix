import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronDown, Check, X, GraduationCap, Rocket, FileText,
  Receipt, BookOpen, PieChart, ShieldCheck, Landmark, CreditCard,
} from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import {
  UF_NAV_IDS, UF_NAV_LABELS, UF_BLOCKED_PAGES, UF_FREE_MONTHS, UF_INVOICE_LIMIT_PER_DAY,
} from '../../utils/ufMode';

// ── "Bokix för UF-företag" (/uf) ────────────────────────────────────────
// Den publika sidan för gymnasieelever som driver ett UF-företag och
// behöver bokföra det. Egen sida, inte en punkt på prissidan, av två skäl:
// erbjudandet är ett annat (gratis i UF_FREE_MONTHS månader, inget
// organisationsnummer, inga betaluppgifter) och PRODUKTEN är en annan —
// en avsevärt mindre app, se utils/ufMode.js.
//
// Allt som står här om vad som ingår och inte ingår byggs ur ufMode.js,
// inte ur en handskriven lista: sidan lovar då exakt det appen levererar,
// och kan inte glida isär när UF-läget ändras. Det är hela poängen med att
// listorna bor i en datafil.
//
// ── OM UNG FÖRETAGSAMHET (organisationen) ───────────────────────────────
// Sidan använder ordet "UF-företag" som det allmänt vedertagna namnet på
// företagsformen — det är nominativ användning och helt i sin ordning.
// Vad den INTE gör är att visa Ung Företagsamhets logotyp eller på annat
// sätt antyda ett samarbete: Bokix har inget avtal med dem, och en logotyp
// på en kommersiell produktsida läses som ett godkännande. Finns ett
// samarbete på riktigt är det en trevlig ändring att göra då — men det
// måste vara sant först. Sidfoten säger det rakt ut.

// Vad ett UF-företag faktiskt gör under läsåret, i den ordning det
// händer. Beskrivningarna är knutna till funktioner som finns i appen —
// ingen av dem lovar något UF-läget inte har.
const STEPS = [
  {
    icon: Rocket, title: 'Registrera UF-företaget',
    body: `Namn på företaget och vilken skola ni går på — det är allt. Inget organisationsnummer, inga betaluppgifter, ingen förälder som behöver skriva under. Kontot är igång på någon minut och gratis i ${UF_FREE_MONTHS} månader.`,
  },
  {
    icon: FileText, title: 'Fakturera det ni säljer',
    body: `Skriv fakturan i Bokix och mejla den direkt till kunden. Vill ni ta betalt med kort kopplar ni Stripe, så kan kunden betala fakturan med en länk. Upp till ${UF_INVOICE_LIMIT_PER_DAY} fakturor per dygn på gratiskontot.`,
  },
  {
    icon: Receipt, title: 'Spara kvitton och utgifter',
    body: 'Fota kvittot och lägg upp utgiften direkt. Underlaget ligger kvar kopplat till bokföringen, så ni har det kvar när det är dags att redovisa — och när läraren frågar.',
  },
  {
    icon: BookOpen, title: 'Bokför löpande',
    body: 'Varje faktura och utgift blir en verifikation enligt BAS-kontoplanen, samma kontoplan som riktiga företag använder. Kontoutdraget från banken kan ni läsa in som fil och matcha mot fakturorna.',
  },
  {
    icon: PieChart, title: 'Avsluta året',
    body: 'Resultaträkning och balansräkning för hela UF-året, och ett bokslutsflöde som stänger räkenskapsåret. Underlaget ni behöver till årsredovisningen finns där, färdigräknat.',
  },
];

const FAQ = [
  {
    q: `Är det verkligen gratis?`,
    a: `Ja, i ${UF_FREE_MONTHS} månader från att ni registrerar kontot. Vi frågar inte efter något kort, och ingenting börjar kosta automatiskt när perioden tar slut — kontot slutar helt enkelt att släppa in er, och bokföringen ligger kvar. Vill ni fortsätta efter UF-året hör ni av er så löser vi det.`,
  },
  {
    q: 'Vi har inget organisationsnummer. Går det ändå?',
    a: 'Ja. UF-registreringen frågar inte efter något organisationsnummer — bara vad företaget heter och vilken skola ni går på. Har ni fått ett organisationsnummer kan ni fylla i det senare under Inställningar → Företag, men ingenting kräver det.',
  },
  {
    q: 'Varför finns inte offerter, projekt och lön?',
    a: 'För att ni inte behöver dem, och för att en meny med tolv punkter där sju aldrig ska användas gör det svårare att hitta de fem som gäller. UF-läget är hela Bokix bokföringsmotor med de delar som hör till ett UF-år framme — inte en nedbantad testversion.',
  },
  {
    q: `Varför bara ${UF_INVOICE_LIMIT_PER_DAY} fakturor om dagen?`,
    a: `Det är ett gratiskonto, och taket finns för att det ska förbli rimligt att ge bort. Ett UF-företag som säljer på en mässa skriver några fakturor i veckan — ${UF_INVOICE_LIMIT_PER_DAY} per dygn räcker med god marginal. Taket nollställs vid midnatt.`,
  },
  {
    q: 'Kan flera i gruppen jobba i samma konto?',
    a: 'Ni delar ett konto under läsåret: samma inloggning, samma bokföring. Att bjuda in fler egna konton hör till de betalande företagen och ingår inte i UF-läget.',
  },
  {
    q: 'Kan vi ta betalt med kort?',
    a: 'Ja. Koppla ert Stripe-konto under Inställningar → Integrationer, så kan varje faktura få en betalningslänk som kunden betalar med kort. Stripe tar sin egen avgift per betalning — den delen är mellan er och Stripe.',
  },
  {
    q: 'Vad händer med bokföringen när UF-året är slut?',
    a: 'Den är er. Exportera allt som en SIE4-fil under Inställningar → Din data, så har ni hela året i ett format vilket bokföringsprogram som helst kan läsa. Kom ihåg att räkenskapsinformation ska sparas i sju år, även för ett UF-företag.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const HOWTO_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'Så bokför ni ert UF-företag i Bokix',
  description: 'Från registrering till färdigt UF-år: fakturera, spara kvitton, bokför löpande och avsluta året.',
  step: STEPS.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.body })),
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

export default function UfPage() {
  const navigate = useNavigate();
  // Registreringen ska starta i UF-läge. Samma väg som prissidans plan-val
  // (location.state → App.jsx → <Auth initialUf>), inte en egen mekanism —
  // se AppRouter.jsx:s onEnterApp och App.jsx:s signupAsUf.
  const startUfSignup = () => navigate('/', { state: { enterApp: true, authMode: 'signup', uf: true } });

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Bokix för UF-företag — gratis bokföring under UF-året',
    description: `Bokföring, fakturering och årsbokslut för UF-företag. Gratis i ${UF_FREE_MONTHS} månader, inget organisationsnummer krävs.`,
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/uf`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title="Bokix för UF-företag | Gratis bokföring under UF-året"
        description={`Bokföring, fakturering, kvitton och årsbokslut för ert UF-företag. Gratis i ${UF_FREE_MONTHS} månader, inget organisationsnummer och inga betaluppgifter.`}
        path="/uf"
        type="article"
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={HOWTO_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />

      <style>{`
        .bx-uf-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
        .bx-uf-split { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 18px; }
      `}</style>

      {/* ── Hjälte ── */}
      <section style={{ padding: '150px 24px 60px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '999px', background: BRAND.greenLight, color: BRAND.greenDark, fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '20px' }}>
            <GraduationCap size={15} /> För UF-företag
          </span>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(29px, 4.6vw, 46px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '18px', lineHeight: 1.15 }}>
            Riktig bokföring för ert UF-företag
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7, margin: '0 0 30px' }}>
            Samma bokföringsmotor som de betalande företagen använder, tillskuren för ett UF-år. Gratis i {UF_FREE_MONTHS} månader — inget organisationsnummer, inga betaluppgifter, inget som börjar kosta automatiskt.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '26px' }}>
            <button onClick={startUfSignup} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '15px 30px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Starta gratis UF-konto <ArrowRight size={16} />
            </button>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '15px 26px', background: 'var(--mkt-card-bg)', border: `1.5px solid ${CARD_BORDER}`, borderRadius: '12px', color: INK_SOFT, fontWeight: 600, fontSize: '16px', textDecoration: 'none' }}>
              Se alla funktioner
            </Link>
          </div>

          {/* De tre sakerna som faktiskt skiljer erbjudandet från det
              vanliga. Inga påhittade siffror — alla tre kommer ur
              ufMode.js. */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { icon: Check, text: `Gratis i ${UF_FREE_MONTHS} månader` },
              { icon: Check, text: 'Inget organisationsnummer' },
              { icon: Check, text: 'Inga betaluppgifter' },
            ].map(item => (
              <span key={item.text} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '13.5px', fontWeight: 700, color: INK_SOFT }}>
                <item.icon size={14} color={BRAND.green} /> {item.text}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Så går UF-året till ── */}
      <section style={{ padding: '60px 24px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '34px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
              Hela UF-året, från första försäljningen till bokslutet
            </h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.65 }}>
              Ni bokför på riktigt, enligt BAS-kontoplanen. Skillnaden mot ett vanligt Bokix-konto är att allt ni inte behöver är borta.
            </p>
          </Reveal>
          <div className="bx-uf-steps">
            {STEPS.map((s, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              return (
                <Reveal key={s.title} delay={i * 60} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '22px 24px', boxShadow: CARD_SHADOW }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '12px' }}>
                    <span style={{ width: 36, height: 36, borderRadius: '10px', background: accent.soft, color: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <s.icon size={18} />
                    </span>
                    <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: 0, letterSpacing: '-0.005em' }}>{i + 1}. {s.title}</h3>
                  </div>
                  <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>{s.body}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Vad som ingår, och vad som inte gör det ──
          Båda listorna byggs ur utils/ufMode.js — samma data som appen
          faktiskt gatear på. En handskriven lista här hade varit ett löfte
          som kan bli osant vid nästa ändring. */}
      <section style={{ padding: '60px 24px', background: IVORY }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '30px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
              Precis det ni behöver — och inget mer
            </h2>
            <p style={{ fontSize: '14.5px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.65 }}>
              Vi listar också det som INTE ingår. Bättre att veta nu än att leta efter en knapp som inte finns.
            </p>
          </Reveal>

          <div className="bx-uf-split">
            <Reveal className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.green.soft, color: ACCENT.green.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={17} /></span>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: 0 }}>Det här har ni</h3>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px' }}>
                {UF_NAV_IDS.map(id => (
                  <li key={id} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px', color: INK_SOFT }}>
                    <Check size={15} color={BRAND.green} style={{ flexShrink: 0 }} /> {UF_NAV_LABELS[id]}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={80} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 26px', boxShadow: CARD_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ width: 34, height: 34, borderRadius: '9px', background: 'var(--mkt-ivory)', color: MUTED, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${CARD_BORDER}` }}><X size={17} /></span>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: 0 }}>Det här är avstängt</h3>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(UF_BLOCKED_PAGES).map(([id, page]) => (
                  <li key={id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px', fontWeight: 700, color: INK }}>
                      <X size={15} color={MUTED} style={{ flexShrink: 0 }} /> {page.label}
                    </div>
                    <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, marginTop: '3px', paddingLeft: '24px' }}>{page.body}</div>
                  </li>
                ))}
                <li>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '14px', fontWeight: 700, color: INK }}>
                    <X size={15} color={MUTED} style={{ flexShrink: 0 }} /> Obegränsad fakturering
                  </div>
                  <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, marginTop: '3px', paddingLeft: '24px' }}>
                    Gratiskontot får skapa {UF_INVOICE_LIMIT_PER_DAY} fakturor per dygn. Räknaren nollställs vid midnatt.
                  </div>
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Kort om betalningar och bank ── */}
      <section style={{ padding: '60px 24px 20px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div className="bx-uf-split">
            <Reveal className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '22px 24px', boxShadow: CARD_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.blue.soft, color: ACCENT.blue.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={17} /></span>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: 0 }}>Ta betalt med kort</h3>
              </div>
              <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
                Koppla ert Stripe-konto under Inställningar → Integrationer, så kan fakturan få en betalningslänk som kunden betalar med kort. Stripes egen avgift per betalning är mellan er och Stripe.
              </p>
            </Reveal>
            <Reveal delay={80} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '22px 24px', boxShadow: CARD_SHADOW }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.teal.soft, color: ACCENT.teal.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Landmark size={17} /></span>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: 0 }}>Få in banken</h3>
              </div>
              <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
                Exportera kontoutdraget ur internetbanken och läs in det — transaktionerna matchas mot era fakturor. <Link to="/koppla-bank" style={{ color: BRAND.greenDark, fontWeight: 600 }}>Så funkar bankimporten</Link>.
              </p>
            </Reveal>
          </div>

          <Reveal delay={120} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginTop: '18px', background: IVORY, border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '18px 22px' }}>
            <ShieldCheck size={18} color={BRAND.greenDark} style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.7, margin: 0 }}>
              Bokföringen är er. Exportera hela året som en SIE4-fil när ni vill — och spara den: räkenskapsinformation ska bevaras i sju år, även för ett UF-företag.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '60px 24px 30px', background: 'var(--mkt-page-bg)' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor</h2>
          </Reveal>
          <Reveal delay={100} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '8px 24px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
        </div>
      </section>

      <section style={{ padding: '30px 24px 100px', background: 'var(--mkt-page-bg)', textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
            Kom igång med ert UF-företag
          </h2>
          <p style={{ fontSize: '15.5px', color: MUTED, marginBottom: '26px', lineHeight: 1.65 }}>
            Företagsnamn, skola och ett lösenord. Sedan är ni igång — gratis i {UF_FREE_MONTHS} månader.
          </p>
          <button onClick={startUfSignup} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '15px 30px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Starta gratis UF-konto <ArrowRight size={16} />
          </button>
          {/* Se filkommentaren: sidan använder ordet UF-företag, men gör
              inga anspråk på ett samarbete med organisationen bakom det. */}
          <p style={{ fontSize: '12px', color: MUTED, marginTop: '22px', lineHeight: 1.6 }}>
            Bokix är ett fristående bokföringsprogram och drivs inte av och är inte i samarbete med Ung Företagsamhet.
          </p>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
