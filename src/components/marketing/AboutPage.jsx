import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, Layers, ArrowRight, BookOpen, FileText, Landmark, Users } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';
import MarketingLayout, { Reveal } from './MarketingLayout';
import { SERIF, INK, MUTED, IVORY, CARD_BORDER, CARD_SHADOW, ACCENT_CYCLE } from './marketingTokens';
import { GRAD, grad, AuroraLayer } from './aurora';
import { PageMeta } from '../../utils/seo';

// Genuina, konkreta principer — inte påhittade grundare-citat eller en
// uppdiktad företagshistoria vi inte har. Tre principer, samma tre
// accentfärger som nyckeltalens grönt/blått/rött (marketingTokens.js).
const PRINCIPLES = [
  {
    icon: Eye, title: 'Aldrig påhittade siffror',
    desc: 'En ny bokföring i Bokix visar 0 kr tills du faktiskt bokfört något. Aldrig en snygg exempel-graf som ser ut som riktig data men inte är det.',
  },
  {
    icon: ShieldCheck, title: 'Bokföring du kan lita på',
    desc: 'Det som kan bokföras automatiskt bokförs automatiskt. Det som är osäkert läggs i Granskning för en snabb bekräftelse, aldrig en tyst gissning.',
  },
  {
    icon: Layers, title: 'En funktion i taget, klar hela vägen',
    desc: 'Vi bygger hellre färre funktioner som fungerar fullt ut än många halvfärdiga. Om något inte är klart säger vi det, istället för att låtsas.',
  },
];

// Samma fyra pelare som Startsidans funktions-sektion (LandingPage.jsx,
// FEATURE_COLUMNS) — kort version här, så "Om oss" faktiskt förklarar vad
// Bokix gör istället för att bara prata om principer i luften.
const PILLARS = [
  { icon: BookOpen, title: 'Bokföring', desc: 'Automatisk från kvitton och fakturor, BAS-kontoplan.' },
  { icon: FileText, title: 'Fakturering', desc: 'Kund- och leverantörsfakturor, kortbetalning via Stripe.' },
  { icon: Landmark, title: 'Skatt och bokslut', desc: 'Momsdeklaration, AGI och ett bokslut som låser året.' },
  { icon: Users, title: 'Personal', desc: 'Lönekörning med skatteavdrag och betalfil till banken.' },
];

export default function AboutPage() {
  const navigate = useNavigate();
  // Samma väg in i registreringen som övriga marknadssidor använder
  // (AppRouter.jsx:s RootRoute läser enterApp/authMode ur location.state).
  const enterApp = () => navigate('/', { state: { enterApp: true, authMode: 'signup' } });
  return (
    <MarketingLayout>
      <PageMeta
        title="Om oss | Bokix"
        description="Bokix byggs för svenska småföretagare som vill lägga tid på verksamheten, inte pappersarbete. Läs varför vi finns och principerna vi bygger produkten efter."
        path="/om-oss"
      />
      <style>{`
        .about-principle-card { position: relative; }
        .about-principle-card:hover { border-color: transparent !important; box-shadow: 0 4px 16px rgba(11,99,41,0.18) !important; }
      `}</style>

      <section style={{ padding: '150px 24px 100px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(47,138,58,0.18)', '4% -8%'], ['rgba(14,165,233,0.16)', '98% 108%']]}
          blob={{ gradient: grad(GRAD.green), top: '-160px', left: '-110px', size: '460px', opacity: 0.2 }}
        />
        <Reveal style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h1 style={{ fontFamily: SERIF, fontSize: 'clamp(38px, 6vw, 62px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '22px', lineHeight: 1.1 }}>
            Om oss
          </h1>
          <p style={{ fontSize: 'clamp(17px, 1.6vw, 20px)', color: MUTED, lineHeight: 1.75 }}>
            Bokix byggs för svenska småföretagare som vill lägga sin tid på verksamheten, inte på pappersarbete. Vi tror att bokföring, fakturering och lön kan vara enkelt utan att bli otydligt.
          </p>
        </Reveal>
      </section>

      <section style={{ padding: '20px 24px 100px', background: 'var(--mkt-page-bg)' }}>
        <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 40px' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
            Hur vi jobbar
          </h2>
        </Reveal>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '26px' }}>
          {PRINCIPLES.map((p, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            return (
              <Reveal key={p.title} delay={i * 100} className="lp-card-hover about-principle-card" style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '20px', padding: '34px', boxShadow: CARD_SHADOW }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                  <div style={{ width: 54, height: 54, borderRadius: '15px', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p.icon size={25} color={accent.fg} />
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--mkt-muted)' }}>0{i + 1}</span>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: INK, margin: '0 0 10px' }}>{p.title}</h3>
                <p style={{ fontSize: '14.5px', color: MUTED, lineHeight: 1.7, margin: 0 }}>{p.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section style={{ padding: '20px 24px 100px', background: IVORY, position: 'relative', overflow: 'hidden' }}>
        <AuroraLayer
          stops={[['rgba(14,165,233,0.12)', '96% 0%'], ['rgba(132,204,22,0.12)', '4% 100%']]}
        />
        <Reveal style={{ textAlign: 'center', maxWidth: '640px', margin: '0 auto 40px', position: 'relative' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '10px' }}>
            Vad Bokix gör
          </h2>
          <p style={{ fontSize: '16px', color: MUTED }}>Fyra delar, samma verktyg.</p>
        </Reveal>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '20px', position: 'relative' }}>
          {PILLARS.map((p, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            return (
              <Reveal key={p.title} delay={i * 80} style={{ background: 'var(--mkt-card-bg)', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px 22px' }}>
                <div style={{ width: 40, height: 40, borderRadius: '11px', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <p.icon size={19} color={accent.fg} />
                </div>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, margin: '0 0 6px' }}>{p.title}</h3>
                <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{p.desc}</p>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section style={{ padding: '20px 24px 110px', background: 'var(--mkt-page-bg)' }}>
        <Reveal scale style={{ maxWidth: '760px', margin: '0 auto' }}>
          {/* Samma mörka botten och gradientrand som sidfoten (kundönskemål:
              bort från det helgröna fältet) — sidans sista block läser då
              som en avslutning ner mot sidfoten i stället för en grön platta
              mitt i. Fast mörk hex, inte en tema-token: kortet ska se
              likadant ut i ljust och mörkt läge, precis som sidfoten. */}
          <div style={{ background: '#0e2018', borderRadius: '24px', padding: '52px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundImage: 'linear-gradient(90deg, #0ea5e9, #14b8a6, #84cc16)' }} />
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: 700, letterSpacing: '-0.01em', color: 'white', marginBottom: '12px', position: 'relative' }}>
              Frågor om Bokix?
            </h2>
            {/* Svarar på rubriken OCH säger vad man faktiskt får — samma
                siffror som /priser och PRICING_TIERS, aldrig egna. Ingen
                momsformulering: Bokix är inte momsregistrerat, priserna ÄR
                slutbeloppet. */}
            <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, maxWidth: '520px', margin: '0 auto 26px', position: 'relative' }}>
              Testa 30 dagar kostnadsfritt med din egen bokföring. Sedan 129 kr/mån utan anställda och 179 kr/mån med lönemodulen — allt ingår, ingen bindningstid på månadsplanen. Undrar du något innan dess svarar vi själva.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
              {/* color: BRAND.green (inte BRAND.greenDark) — samma fix som
                  LandingPage.jsx:s CTA-knapp: greenDark är en TEXT-token som
                  blir ljusgrön i mörkt läge, fel ihopparad med en bakgrund
                  som alltid är vit. */}
              <button
                onClick={enterApp} className="lp-btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 26px', borderRadius: '11px', background: 'white', border: 'none', fontFamily: 'inherit', fontSize: '14.5px', fontWeight: 700, color: BRAND.green, cursor: 'pointer' }}
              >
                Kom igång gratis <ArrowRight size={15} />
              </button>
              <Link
                to="/kontakt"
                style={{ display: 'inline-flex', alignItems: 'center', padding: '13px 22px', borderRadius: '11px', border: '1.5px solid rgba(255,255,255,0.25)', fontSize: '14.5px', fontWeight: 600, color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}
              >
                Kontakta oss
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
