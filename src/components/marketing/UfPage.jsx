import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ChevronDown, Check, X, Users, FileText, Receipt, BookOpen,
  Landmark, BarChart3, ShieldCheck, CreditCard, LayoutDashboard, ScanLine,
} from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal, BokixWordmark } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
import UfYearFlow from './UfYearFlow';
import { UF_BLOCKED_PAGES, UF_FREE_MONTHS, UF_INVOICE_LIMIT_PER_DAY } from '../../utils/ufMode';

// ── "Bokix för UF-företag" (/uf) ────────────────────────────────────────
// En sida för ETT segment, byggd som ett segment ska byggas: den visar hur
// deras år ser ut i produkten och vad de får, den förklarar inte hela
// Bokix en gång till med andra ord.
//
// Kundönskemål efter första versionen, ordagrant i sak: sidan ska vara
// "en hel sida bara för dem", inte en punktlista med sju FAQ-frågor.
// Därför är den byggd runt UfYearFlow (läsåret som en tidslinje) och korta
// rader i stället för brödtext. Tre FAQ-frågor, inte sju — resten var
// sådant ingen läser.
//
// Innehållet är fortfarande knutet till utils/ufMode.js där det ska vara:
// gratisperioden, fakturataket och de avstängda funktionerna kommer
// därifrån, så sidan inte kan lova något appen inte gör. Listan över vad
// man FÅR är däremot handskriven här med korta, konkreta formuleringar —
// menyetiketterna ("Rapport och analys") säger vad en sida heter, inte vad
// man kan göra med den, och det senare är vad den här sidan ska svara på.
//
// ── OM UNG FÖRETAGSAMHETS LOGOTYP ───────────────────────────────────────
// Logotypen visas efter ett uttryckligt kundbeslut, taget igen efter att
// invändningen lagts fram: Bokix har inget avtal med Ung Företagsamhet,
// och en logotyp på en kommersiell produktsida kan läsas som ett
// godkännande. Kunden står fast vid att den ska vara med. Den används
// därför på det sätt som är mest försvarbart — som en identifierande
// hänvisning till företagsformen sidan handlar om, aldrig som en
// partnerbadge — och friskrivningen längst ner säger rakt ut att Bokix är
// fristående. Filen är deras egen SVG (public/logos/uf-logo.svg).

// Vad man faktiskt gör i produkten, inte vad menyposterna heter. Fyra ord
// var — sidan ska gå att skumma på tio sekunder.
const INCLUDED = [
  { icon: FileText, label: 'Fakturor', note: 'Skicka på mejl, få betalt' },
  { icon: Receipt, label: 'Kvitton', note: 'Fota och lägg upp' },
  { icon: BookOpen, label: 'Bokföring', note: 'BAS-kontoplanen, automatiskt' },
  { icon: Landmark, label: 'Bank', note: 'Läs in kontoutdraget' },
  { icon: Users, label: 'Kunder', note: 'Register med alla köpare' },
  { icon: BarChart3, label: 'Rapporter', note: 'Resultat och balans' },
  { icon: ScanLine, label: 'Granskning', note: 'Fångar det som ser fel ut' },
  { icon: LayoutDashboard, label: 'Årsbokslut', note: 'Stäng året när ni är klara' },
];

// Tre frågor. Allt annat som stod här förut besvaras av sidan i sig.
const FAQ = [
  {
    q: 'Vad händer när de tre månaderna är slut?',
    a: 'Ingenting dras. Vi har inga kortuppgifter, så det finns inget att debitera — kontot slutar helt enkelt släppa in er, och bokföringen ligger kvar. Vill ni fortsätta hör ni av er så löser vi det.',
  },
  {
    q: 'Vi har inget organisationsnummer.',
    a: 'Det behövs inte. Registreringen frågar efter företagsnamn och skola, inget mer. Har ni fått ett nummer kan ni fylla i det senare under Inställningar.',
  },
  {
    q: 'Får vi med oss bokföringen efteråt?',
    a: 'Ja. Exportera hela året som en SIE4-fil — standardformatet varje bokföringsprogram kan läsa. Spara den: räkenskapsinformation ska bevaras till och med det sjunde året efter utgången av det kalenderår då räkenskapsåret avslutades, även för ett UF-företag.',
  },
];

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: `1px solid ${CARD_BORDER}` }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '19px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
      >
        <span style={{ fontSize: '15px', fontWeight: 700, color: INK }}>{q}</span>
        <ChevronDown size={18} color={MUTED} style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      <div style={{ maxHeight: open ? '320px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, padding: '0 4px 19px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

/** Ung Företagsamhets egen logotyp. Vit platta bakom av samma skäl som
 * övriga tredjepartsmärken (BrandLogos.jsx): bläcket är mörk marinblå och
 * skulle försvinna mot sajtens mörka tema. */
function UfLogo({ height = 44 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', boxShadow: CARD_SHADOW }}>
      <img
        src="/logos/uf-logo.svg" alt="Ung Företagsamhet"
        style={{ height, width: 'auto', display: 'block' }}
        draggable={false} onContextMenu={e => e.preventDefault()} onDragStart={e => e.preventDefault()}
      />
    </span>
  );
}

export default function UfPage() {
  const navigate = useNavigate();
  // Registreringen startar i UF-läge — samma väg som prissidans plan-val
  // (location.state → App.jsx → <Auth initialUf>), ingen egen mekanism.
  const startUfSignup = () => navigate('/', { state: { enterApp: true, authMode: 'signup', uf: true } });

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Bokix för UF-företag — gratis bokföring under UF-året',
    description: `Bokföring, fakturering och bokslut för UF-företag. Gratis i ${UF_FREE_MONTHS} månader, inget organisationsnummer.`,
    author: { '@type': 'Organization', name: 'Bokix', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Bokix', url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png` } },
    mainEntityOfPage: `${SITE_URL}/uf`,
  };

  return (
    <MarketingLayout>
      <PageMeta
        title="Bokix för UF-företag | Gratis bokföring under UF-året"
        description={`Fakturor, kvitton, bokföring och bokslut för ert UF-företag. Gratis i ${UF_FREE_MONTHS} månader, inget organisationsnummer och inga betaluppgifter.`}
        path="/uf"
        type="article"
      />
      <JsonLd data={articleSchema} />
      <JsonLd data={FAQ_SCHEMA} />

      <style>{`
        .bx-uf-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 14px; }
        .bx-uf-pair { display: flex; align-items: center; justify-content: center; gap: clamp(14px, 3vw, 26px); flex-wrap: wrap; }
        .bx-uf-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 18px; }
        .bx-uf-off { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
        @media (max-width: 480px) { .bx-uf-pair { flex-direction: column; gap: 10px; } }
      `}</style>

      {/* ── Hjälte: vem sidan är för, i en bild ── */}
      <section style={{ padding: '140px 24px 56px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '820px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          {/* Bokix × UF — sidans hela premiss utan en enda mening. */}
          <div className="bx-uf-pair" style={{ marginBottom: '28px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', padding: '14px 20px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', boxShadow: CARD_SHADOW }}>
              <BokixWordmark height={34} />
            </span>
            <span style={{ fontSize: '20px', fontWeight: 700, color: MUTED }}>för</span>
            <UfLogo height={58} />
          </div>

          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(31px, 5vw, 52px)', fontWeight: 700, letterSpacing: '-0.015em', color: INK, marginBottom: '16px', lineHeight: 1.1 }}>
            Ert UF-år, bokfört
          </h1>
          <p style={{ fontSize: '17.5px', color: MUTED, lineHeight: 1.65, margin: '0 auto 30px', maxWidth: '520px' }}>
            Gratis i {UF_FREE_MONTHS} månader. Inget organisationsnummer, inga betaluppgifter — och bara de delar av Bokix ni faktiskt kommer använda.
          </p>

          <button onClick={startUfSignup} style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '16px 32px', background: BRAND.green, border: 'none', borderRadius: '13px', color: 'white', fontWeight: 700, fontSize: '16.5px', cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 10px 26px -8px rgba(11,99,41,0.5)' }}>
            Starta gratis <ArrowRight size={17} />
          </button>
        </Reveal>
      </section>

      {/* ── Läsåret som en tidslinje — sidans huvudbild ── */}
      <section style={{ padding: '64px 24px 72px', background: 'var(--mkt-page-bg)', borderTop: `1px solid var(--mkt-border-soft)` }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '38px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
              Så ser året ut
            </h2>
          </Reveal>
          <Reveal scale delay={60}>
            <UfYearFlow />
          </Reveal>
        </div>
      </section>

      {/* ── Vad ni får ── */}
      <section style={{ padding: '68px 24px', background: IVORY, borderTop: `1px solid var(--mkt-border-soft)` }}>
        <div style={{ maxWidth: '920px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(23px, 3.2vw, 32px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: 0 }}>
              Åtta saker ni får
            </h2>
          </Reveal>
          <div className="bx-uf-grid">
            {INCLUDED.map((item, idx) => (
              <Reveal key={item.label} delay={idx * 40} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '14px', padding: '18px 20px', boxShadow: CARD_SHADOW }}>
                <span style={{ display: 'inline-flex', width: 34, height: 34, borderRadius: '9px', background: ACCENT.green.soft, color: ACCENT.green.fg, alignItems: 'center', justifyContent: 'center', marginBottom: '11px' }}>
                  <item.icon size={17} />
                </span>
                <div style={{ fontSize: '15px', fontWeight: 700, color: INK, marginBottom: '3px' }}>{item.label}</div>
                <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.5 }}>{item.note}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Vad som inte finns — en rad, inte tre stycken ── */}
      <section style={{ padding: '56px 24px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(21px, 2.8vw, 27px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
            Och det här är borta
          </h2>
          <p style={{ fontSize: '15px', color: MUTED, lineHeight: 1.65, margin: '0 0 22px' }}>
            Ett UF-år innehåller inga anställda, inga offerter och inga uppdrag att tidrapportera. Så menyn gör det inte heller.
          </p>
          <div className="bx-uf-off">
            {Object.values(UF_BLOCKED_PAGES).map(page => (
              <span key={page.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 16px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '14px', fontWeight: 600, color: MUTED }}>
                <X size={14} /> {page.label}
              </span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Priset ── */}
      <section style={{ padding: '56px 24px 68px', background: IVORY, borderTop: `1px solid var(--mkt-border-soft)` }}>
        <Reveal scale style={{ maxWidth: '560px', margin: '0 auto', background: 'var(--mkt-card-bg)', border: `1.5px solid ${BRAND.green}`, borderRadius: '20px', padding: 'clamp(28px, 5vw, 40px)', boxShadow: CARD_SHADOW, textAlign: 'center' }}>
          <div style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: BRAND.greenDark, marginBottom: '10px' }}>UF-konto</div>
          <div style={{ fontSize: 'clamp(44px, 8vw, 64px)', fontWeight: 800, color: INK, lineHeight: 1, letterSpacing: '-0.03em' }}>0 kr</div>
          <div style={{ fontSize: '16px', color: MUTED, marginTop: '8px', marginBottom: '24px' }}>i {UF_FREE_MONTHS} månader</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px', textAlign: 'left', marginBottom: '26px' }}>
            {[
              'Inga kortuppgifter — det finns inget att debitera',
              'Inget organisationsnummer',
              `Upp till ${UF_INVOICE_LIMIT_PER_DAY} fakturor per dygn`,
            ].map(row => (
              <div key={row} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14.5px', color: INK_SOFT }}>
                <Check size={16} color={BRAND.green} style={{ flexShrink: 0 }} /> {row}
              </div>
            ))}
          </div>

          <button onClick={startUfSignup} style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '9px', padding: '15px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', color: 'white', fontWeight: 700, fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Skapa kontot <ArrowRight size={16} />
          </button>
        </Reveal>
      </section>

      {/* ── Två saker som är värda en egen ruta ── */}
      <section style={{ padding: '0 24px 64px', background: IVORY }}>
        <div className="bx-uf-two" style={{ maxWidth: '880px', margin: '0 auto' }}>
          <Reveal className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '22px 24px', boxShadow: CARD_SHADOW }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.blue.soft, color: ACCENT.blue.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CreditCard size={17} /></span>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: 0 }}>Ta betalt med kort</h3>
            </div>
            <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>
              Koppla Stripe, så får fakturan en betalningslänk. Stripes egen avgift per betalning är mellan er och dem.
            </p>
          </Reveal>
          <Reveal delay={70} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '22px 24px', boxShadow: CARD_SHADOW }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <span style={{ width: 34, height: 34, borderRadius: '9px', background: ACCENT.teal.soft, color: ACCENT.teal.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Landmark size={17} /></span>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: INK, margin: 0 }}>Få in banken</h3>
            </div>
            <p style={{ fontSize: '13.5px', color: INK_SOFT, lineHeight: 1.65, margin: 0 }}>
              Exportera kontoutdraget och läs in det — raderna matchas mot era fakturor. <Link to="/koppla-bank" style={{ color: BRAND.greenDark, fontWeight: 600 }}>Så funkar det</Link>.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Tre frågor ── */}
      <section style={{ padding: '0 24px 40px', background: IVORY }}>
        <Reveal style={{ maxWidth: '680px', margin: '0 auto', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '6px 24px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
          {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
        </Reveal>
      </section>

      {/* ── Sista knuffen ── */}
      <section style={{ padding: '24px 24px 96px', background: IVORY, textAlign: 'center' }}>
        <Reveal style={{ maxWidth: '520px', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginBottom: '18px', fontSize: '13.5px', color: MUTED }}>
            <ShieldCheck size={16} color={BRAND.greenDark} /> Bokföringen är er — exportera när ni vill
          </div>
          <button onClick={startUfSignup} style={{ display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '16px 32px', background: BRAND.green, border: 'none', borderRadius: '13px', color: 'white', fontWeight: 700, fontSize: '16.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Starta gratis <ArrowRight size={17} />
          </button>
          {/* Se filkommentaren om logotypen: sidan gör inga anspråk på ett
              samarbete med organisationen bakom företagsformen. */}
          <p style={{ fontSize: '12px', color: MUTED, marginTop: '26px', lineHeight: 1.6 }}>
            Bokix är ett fristående bokföringsprogram och drivs inte av och är inte i samarbete med Ung Företagsamhet.
          </p>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
