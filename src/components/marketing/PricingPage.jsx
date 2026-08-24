import React, { useState, lazy } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, ArrowRight, ChevronDown, ShieldCheck, Zap, Check, BarChart3 } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal, RevealLazy } from './MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT_CYCLE } from './marketingTokens';
import { PageMeta, JsonLd, SITE_URL } from '../../utils/seo';
// Lazy: se samma resonemang i LandingPage.jsx — DemoWorkspace drar in
// hela den inloggade appens komponentträd.
const DemoWorkspace = lazy(() => import('../DemoWorkspace'));

const INCLUDED = [
  'Obegränsat med kund- och leverantörsfakturor',
  'Fyra fakturamallar med egen logotyp och accentfärg',
  'Löpande bokföring och full kontoplan (BAS)',
  'Granskning, så inget bokförs fel utan att du ser det',
  'Moms-, AGI- och kontrolluppgiftssammanställningar',
  'Lönekörningar för hela personalen, med rätt skatteavdrag',
  'Kortbetalningar via Stripe',
  'PDF-export av allt, fakturor, lönebesked, deklarationsunderlag',
];

// Ärliga, konkreta frågor — inga påhittade "99% nöjda kunder"-svar.
const FAQ = [
  { q: 'Behöver jag ange kortuppgifter för att prova?', a: 'Ja, du lägger in dina betaluppgifter hos Stripe redan vid registreringen — men du debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något.' },
  { q: 'Kan jag avsluta när som helst?', a: 'Ja. Det finns ingen uppsägningstid eller bindningstid, du avslutar när du vill.' },
  { q: 'Vilka bolagsformer stöds?', a: 'Bokix känner igen enskild firma, aktiebolag, handelsbolag/kommanditbolag och ekonomisk förening utifrån organisationsnumret, och bokför enligt rätt regler för respektive form.' },
  { q: 'Ingår support i priset?', a: 'Ja, support ingår. Du når oss på support@bokix.se.' },
];

// FAQPage-schema byggt direkt av FAQ ovan — samma fyra frågor/svar som
// faktiskt visas på sidan, aldrig en egen dubblett-lista som kan glida
// isär från vad besökaren ser. Google kan visa dessa som en utfällbar
// FAQ-rich-snippet direkt i sökresultatet, och det är precis den sortens
// strukturerade fråga/svar-data AI-svarsmotorer (Perplexity/ChatGPT/Claude
// när de faktiskt läser sidan) helst citerar rakt av.
const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

// SoftwareApplication-schema — priset (99 kr/mån exkl. moms) står redan
// hårdkodat i sidans eget UI nedan (samma tal, en enda källa att hålla i
// synk om priset någonsin ändras). Ger Google/AI-svarsmotorer ett exakt,
// strukturerat pris istället för att behöva läsa/gissa det ur brödtexten.
const SOFTWARE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Bokix',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  url: `${SITE_URL}/priser`,
  description: 'Bokföring, fakturering, lönehantering och momsredovisning för svenska småföretagare och enskilda firmor.',
  offers: {
    '@type': 'Offer',
    price: '99',
    priceCurrency: 'SEK',
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: '99',
      priceCurrency: 'SEK',
      unitText: 'MON',
      valueAddedTaxIncluded: false,
    },
  },
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
      <div style={{ maxHeight: open ? '200px' : '0px', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
        <p style={{ fontSize: '14px', color: MUTED, lineHeight: 1.65, padding: '0 4px 20px', margin: 0 }}>{a}</p>
      </div>
    </div>
  );
}

const TRUST_BITS = [
  { icon: ShieldCheck, text: 'Ingen bindningstid' },
  { icon: Zap, text: 'Igång på minuter' },
  { icon: CheckCircle, text: 'Alla funktioner ingår' },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const enterApp = () => navigate('/', { state: { enterApp: true } });

  return (
    <MarketingLayout>
      <PageMeta
        title="Priser — 99 kr/mån, allt ingår | Bokix"
        description="Ett pris, allt ingår: bokföring, fakturering, lön och moms. 99 kr/mån exkl. moms, ingen bindningstid, ingen dold avgift per funktion."
        path="/priser"
      />
      <JsonLd data={SOFTWARE_SCHEMA} />
      <JsonLd data={FAQ_SCHEMA} />
      <style>{`
        .pricing-feature-row { transition: transform 0.18s ease; }
        .pricing-feature-row:hover { transform: translateX(3px); }
      `}</style>

      <section style={{ padding: '150px 24px 70px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '7px 16px', borderRadius: '999px', background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '20px' }}>
            Inga dolda avgifter
          </div>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '16px', lineHeight: 1.14 }}>
            Ett pris. Allt ingår.
          </h1>
          <p style={{ fontSize: '17px', color: MUTED, lineHeight: 1.7 }}>
            Ingen "bas + tillägg per funktion"-modell att räkna ut. Ett pris, en faktura, allt du behöver.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '0 24px 60px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '460px', margin: '0 auto' }}>
          <div style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '26px', overflow: 'hidden', boxShadow: CARD_SHADOW }}>

            {/* Mörk topp-sektion för priset — bryter kortet i två zoner istället
                för en enda platt vit yta, så det känns som en riktig produkt
                snarare än en generisk prislista. Alltid samma solida gröna
                brandfärg oavsett tema (BRAND.green, inte BRAND.greenDark —
                den senare är en TEXT-token som blir ljusgrön i mörkt läge,
                fel som bakgrund här). */}
            <div style={{ background: BRAND.green, padding: '38px 36px 34px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'relative' }}>
                <span style={{ fontFamily: SERIF, fontSize: '52px', fontWeight: 700, letterSpacing: '-0.01em', color: 'white' }}>99 kr</span>
                <span style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}> /mån</span>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '6px' }}>Exkl. moms · avsluta när som helst</div>
              </div>
            </div>

            <div style={{ padding: '32px 36px 36px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '13px', marginBottom: '28px', borderTop: `1px solid ${CARD_BORDER}`, paddingTop: '22px' }}>
                {INCLUDED.map((f, i) => {
                  const accent = ACCENT_CYCLE[i % 3];
                  return (
                    <div key={f} className="pricing-feature-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                        <Check size={10} color={accent.fg} strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: '14px', color: INK_SOFT, fontWeight: 500, lineHeight: 1.5 }}>{f}</span>
                    </div>
                  );
                })}
              </div>
              <button className="lp-btn-primary" onClick={enterApp} style={{ width: '100%', padding: '16px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 2px 8px rgba(61,122,46,0.3)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                Kom igång gratis <ArrowRight size={16} />
              </button>
              <div style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--mkt-muted)', marginTop: '14px' }}>Gratis i 30 dagar · avsluta när som helst</div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={80} style={{ maxWidth: '460px', margin: '28px auto 0', display: 'flex', justifyContent: 'center', gap: '22px', flexWrap: 'wrap' }}>
          {TRUST_BITS.map((t, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            return (
              <div key={t.text} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', fontWeight: 600, color: INK_SOFT }}>
                <t.icon size={14} color={accent.fg} /> {t.text}
              </div>
            );
          })}
        </Reveal>
      </section>

      {/* ── PRODUKTVISNING — kundönskemål: samma riktiga, klickbara demo som
          finns på startsidan (DemoWorkspace.jsx), inte bara en beskrivning
          av vad som ingår. Identisk kopia av startsidans sektion (rubrik,
          text och komponent) med flit — samma "SAMMA app"-löfte ska hålla
          på båda sidorna. ── */}
      <section style={{ padding: '20px 24px 90px', background: 'var(--mkt-card-bg)', borderTop: `1px solid ${CARD_BORDER}` }}>
        <div style={{ maxWidth: '1220px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, borderRadius: '100px', fontSize: '12px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '16px' }}>
              <BarChart3 size={12} /> Så ser det ut
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              Bokföringen sköter sig själv
            </h2>
            <p style={{ fontSize: '16px', color: 'var(--mkt-muted)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Samma app som möter dig efter att du skapat konto, här med exempeldata. Verifikationer bokförs automatiskt i bakgrunden — klicka runt i menyn, allt går att testa på riktigt.
            </p>
          </Reveal>

          {/* RevealLazy (inte Reveal+Suspense) — samma Prestanda-fix som
              LandingPage.jsx, se RevealLazy:s egen kommentar i
              MarketingLayout.jsx. */}
          <RevealLazy>
            <DemoWorkspace />
          </RevealLazy>
        </div>
      </section>

      <section style={{ padding: '70px 24px 100px', background: IVORY }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK }}>Vanliga frågor</h2>
          </Reveal>
          <Reveal delay={100} className="lp-card-hover" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '8px 24px', boxShadow: '0 1px 3px rgba(28,36,32,0.05)' }}>
            {FAQ.map(item => <FaqItem key={item.q} {...item} />)}
          </Reveal>
          {/* Kontextuell länk (inte bara i footern) — hjälper både besökare
              som vill jämföra bredare och Google att hitta guiden via en
              redan indexerad sida, med beskrivande länktext istället för
              "läs mer". */}
          <Reveal delay={140} style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link to="/valja-bokforingsprogram" style={{ fontSize: '13.5px', fontWeight: 600, color: BRAND.greenDark, textDecoration: 'none' }}>
              Fler frågor att ställa? Läs vår guide: Så väljer du bokföringsprogram →
            </Link>
          </Reveal>
        </div>
      </section>
    </MarketingLayout>
  );
}
