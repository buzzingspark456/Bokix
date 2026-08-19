import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3, Check,
  ArrowRight, ChevronRight, ChevronDown, Inbox,
  Building2, Briefcase, Landmark, HeartHandshake, UserCheck,
  ShieldCheck, FileCheck2, CreditCard, ScrollText,
  TrendingUp, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import MarketingLayout, { Reveal, useReveal } from './marketing/MarketingLayout';
import { SERIF, INK, INK_SOFT, MUTED, IVORY, CARD_BORDER, CARD_SHADOW_SM, ACCENT, ACCENT_CYCLE } from './marketing/marketingTokens';
import { IllBokforing, IllFakturering, IllSkatt, IllPersonal } from './marketing/featureIllustrations';
import DemoWorkspace from './DemoWorkspace';

// ── Bokix egna gradienter, hämtade rakt från produkten — INTE en importerad
// extern designreferens. Loggans blå→turkos→lime (BokixWordmark i
// MarketingLayout.jsx) och Startsidans KPI-kortgradienter (Dashboard.jsx:
// KPI_GRAD_POSITIVE/KPI_GRAD_NEGATIVE) — samma färger en inloggad användare
// redan ser i appen, så landningssidan känns som SAMMA produkt, inte en
// annan stämning på toppen av den. Rosarött är medvetet reserverat för
// kostnads-/utgiftsrelaterat innehåll (samma betydelse som i Dashboard),
// inte utsmyckning på slumpmässiga kort. ──
const GRAD = {
  green: ['#2f8a3a', '#54b854'],       // Dashboard KPI_GRAD_POSITIVE
  pink: ['#e0527a', '#c8305a'],        // Dashboard KPI_GRAD_NEGATIVE — bara kostnader/utgifter
  blueTeal: ['#0ea5e9', '#14b8a6'],    // Loggans första hälft
  tealLime: ['#14b8a6', '#84cc16'],    // Loggans andra hälft
  limeGreen: ['#84cc16', BRAND.green],
};
const grad = (c, deg = 135) => `linear-gradient(${deg}deg, ${c[0]}, ${c[1]})`;

// ── Faktiska bolagsformer Bokix kan identifiera/bokföra för (se
// src/utils/orgType.js) — inte en påhittad lista. ──
const COMPANY_TYPES = [
  { icon: UserCheck, label: 'Enskild firma' },
  { icon: Building2, label: 'Aktiebolag (AB)' },
  { icon: Briefcase, label: 'Handelsbolag / KB' },
  { icon: Landmark, label: 'Ekonomisk förening' },
  { icon: HeartHandshake, label: 'Ideell förening / stiftelse' },
];

// ── Fyra kolumner, matchat mot appens faktiska huvudsektioner (se globala
// sidomenyn i App.jsx) — varje kort får en egen handritad illustration
// istället för samma enfärgade gröna chip fyra gånger. ──
const FEATURE_COLUMNS = [
  {
    art: IllBokforing, title: 'Bokföring', g: ACCENT.green,
    desc: 'Verifikationer bokförs automatiskt utifrån dina kvitton och fakturor, med en tydlig kontoplan (BAS, ~92 konton) och en egen Granskning för det som behöver ses över manuellt.',
  },
  {
    art: IllFakturering, title: 'Fakturering', g: ACCENT.blue,
    desc: 'Skapa kundfakturor med den fakturamall som passar ditt varumärke, registrera leverantörsfakturor och ta emot kortbetalningar direkt via Stripe.',
  },
  {
    art: IllSkatt, title: 'Skatt och bokslut', g: ACCENT.red,
    desc: 'Momsdeklaration, AGI- och kontrolluppgiftssammanställningar samt ett bokslutsflöde som låser räkenskapsåret, redo att lämna till Skatteverket.',
  },
  {
    art: IllPersonal, title: 'Personal', g: ACCENT.green,
    desc: 'Lönekörningar med automatiskt skatteavdrag enligt Skatteverkets skattetabeller, lönebesked och en riktig betalfil (ISO 20022) till banken, klar att ladda upp utan manuella summeringar.',
  },
];

const ONBOARDING_STEPS = [
  { n: '1', title: 'Skapa ditt konto', desc: 'Ange företagsnamn och organisationsnummer. Bokix känner själv igen om det är en enskild firma, ett aktiebolag eller en annan bolagsform.', g: ACCENT.blue },
  { n: '2', title: 'Fyll i företagsuppgifter', desc: 'Adress, räkenskapsår, momsperiod och kontoplan (BAS), klart på ett par minuter med rimliga förval redan ifyllda.', g: ACCENT.red },
  { n: '3', title: 'Kom igång med fakturering', desc: 'Skicka din första kundfaktura eller registrera ett kvitto. Du landar direkt i en fungerande bokföring, inte en tom sida.', g: ACCENT.green },
];

const TRUST_POINTS = [
  { icon: ScrollText, label: 'Byggt efter svensk bokföringslag' },
  { icon: ShieldCheck, label: 'GDPR — din data stannar din' },
  { icon: CreditCard, label: 'Kortbetalningar via Stripe' },
  { icon: FileCheck2, label: 'BAS-kontoplan, ~92 konton' },
];

// ── Jämförelse — Bokix egna arbetssätt mot kalkylark/anlita en byrå, inga
// namngivna konkurrentprogram, inga påhittade siffror om dem. ──
const COMPARISON_ROWS = [
  { label: 'Moms och skattetabeller', sheet: 'Du håller reda på procentsatserna själv', firm: 'Byrån sköter det, med viss fördröjning', bokix: 'Räknas automatiskt, alltid aktuellt' },
  { label: 'Syns när du bokför fel', sheet: 'Upptäcks först vid bokslut, om alls', firm: 'Upptäcks när byrån går igenom underlaget', bokix: 'Granskning flaggar direkt, inget tyst fel' },
  { label: 'Tillgänglighet', sheet: 'Alltid, men allt manuellt arbete', firm: 'Kontorstider, e-post fram och tillbaka', bokix: 'Dygnet runt, från vilken enhet som helst' },
  { label: 'Din data om du vill byta', sheet: 'Redan ditt eget kalkylark', firm: 'Beror på byrån och deras system', bokix: 'SIE4-export, tar den med dig när du vill' },
];

const FAQ_ITEMS = [
  { q: 'Behöver jag kunna bokföring sedan innan?', a: 'Nej. Verifikationer skapas automatiskt utifrån dina kvitton och fakturor. Det enda som kräver din uppmärksamhet hamnar i Granskning, med tydlig anledning till varför — resten sköts av Bokix.', g: ACCENT.green },
  { q: 'Fungerar Bokix för min bolagsform?', a: 'Ja. Enskild firma, aktiebolag, handelsbolag/KB, ekonomisk förening och ideell förening/stiftelse — Bokix känner av rätt bolagsform automatiskt utifrån ditt organisationsnummer när du skapar konto.', g: ACCENT.blue },
  { q: 'Vad kostar det, och vad ingår?', a: 'Ett pris, 99 kr/mån — obegränsat med kund- och leverantörsfakturor, fyra fakturamallar med egen logotyp, löpande bokföring och kortbetalningar via Stripe. Inga tillägg eller dolda avgifter.', g: ACCENT.red },
  { q: 'Kan jag ta med mig min bokföring om jag vill byta bort från Bokix senare?', a: 'Ja. Din bokföring går att exportera som SIE4-fil, det standardformat svenska bokföringsprogram och redovisningskonsulter använder för att flytta data mellan system — din data är aldrig inlåst.', g: ACCENT.green },
  { q: 'Är Bokix anpassat efter svensk bokföringslag och Skatteverkets regler?', a: 'Ja, det är hela utgångspunkten. BAS-kontoplan, momsdeklaration per kvartal (25/12/6 %), AGI- och kontrolluppgiftssammanställningar samt skatteavdrag enligt Skatteverkets egna skattetabeller vid lönekörning.', g: ACCENT.blue },
  { q: 'Hur fungerar de 30 dagarna gratis?', a: 'Du lägger in dina betaluppgifter hos Stripe när du skapar konto, men debiteras ingenting under de första 30 dagarna. Avslutar du innan dess kostar det dig aldrig något — annars börjar 99 kr/mån dras automatiskt.', g: ACCENT.red },
];

function FaqItem({ item, index, isOpen, onToggle }) {
  return (
    <div className="lp-faq-item" style={{ background: isOpen ? item.g.soft : 'transparent', borderRadius: '12px', transition: 'background 0.3s ease' }}>
      <button className="lp-faq-question" onClick={onToggle} aria-expanded={isOpen} style={{ padding: '18px 12px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: item.g.fg, color: 'white', fontSize: '12px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</span>
          <span style={{ fontSize: '16px', fontWeight: 700, color: INK }}>{item.q}</span>
        </span>
        <ChevronDown size={18} className={`lp-faq-chevron ${isOpen ? 'lp-faq-open' : ''}`} />
      </button>
      <div className={`lp-faq-answer ${isOpen ? 'lp-faq-open' : ''}`}>
        <div>
          <p style={{ margin: '0 12px 20px 54px', fontSize: '14.5px', color: MUTED, lineHeight: 1.7, maxWidth: '600px' }}>{item.a}</p>
        </div>
      </div>
    </div>
  );
}

/** Räknar upp från 0 till target när kortet blir synligt — samma
 * IntersectionObserver-hook som resten av sidans skroll-reveal (useReveal),
 * så den bara triggar en gång, i takt med att kortet faktiskt syns. */
function CountUp({ target, prefix = '', suffix = '', duration = 1200 }) {
  const [ref, inView] = useReveal();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let raf;
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return <span ref={ref}>{prefix}{value.toLocaleString('sv-SE')}{suffix}</span>;
}

// ── Gradient-KPI-kort — SAMMA visuella språk som Startsidans riktiga
// nyckeltalskort (Dashboard.jsx: fyllda gradientytor, vit text, ikon-chip
// uppe till höger), här som ett illustrativt "exempel"-läge på
// landningssidan. Tydligt märkt "Exempel" (samma konvention som
// DemoWorkspace redan använder för sitt exempeldata-märke), aldrig
// framställt som en riktig kunds faktiska siffror. ──
function StatCard({ label, value, sub, icon: Icon, accent, delay }) {
  return (
    <Reveal delay={delay} className="lp-lux-card" style={{
      background: 'white', border: '1px solid #eee8dc', borderRadius: '20px', padding: '28px', position: 'relative', overflow: 'hidden',
      boxShadow: '0 24px 44px -30px rgba(28,36,32,0.24), 0 2px 8px rgba(28,36,32,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: accent.fg }}>{label}</span>
        <div style={{ width: 38, height: 38, borderRadius: '11px', background: accent.soft, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} color={accent.fg} />
        </div>
      </div>
      <div style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '32px', fontWeight: 700, letterSpacing: '-0.01em', color: '#1c2420', marginBottom: '4px' }}>
        <CountUp target={value} suffix=" kr" />
      </div>
      <div style={{ fontSize: '12.5px', color: '#6b7568', fontWeight: 500 }}>{sub}</div>
    </Reveal>
  );
}

export default function LandingPage({ onEnterApp }) {
  const [openFaq, setOpenFaq] = useState(0);

  const scrollToFeatures = () => {
    const el = document.getElementById('funktioner-teaser');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MarketingLayout onEnterApp={onEnterApp}>
      {/* ── HERO — levande gradientklot i loggans/Startsidans egna färger
          bakom en fetstilt rubrik, inget stillastående platt fält. ── */}
      <section style={{ display: 'flex', alignItems: 'center', background: '#faf9f5', position: 'relative', overflow: 'hidden', paddingTop: '140px', paddingBottom: '72px' }}>
        <div aria-hidden className="lp-blob" style={{ position: 'absolute', top: '-160px', left: '-120px', width: '440px', height: '440px', borderRadius: '50%', background: grad(GRAD.blueTeal), opacity: 0.16, filter: 'blur(60px)', pointerEvents: 'none' }} />
        <div aria-hidden className="lp-blob lp-blob-slow" style={{ position: 'absolute', top: '-100px', right: '-140px', width: '480px', height: '480px', borderRadius: '50%', background: grad(GRAD.green), opacity: 0.16, filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div aria-hidden className="lp-blob lp-blob-slower" style={{ position: 'absolute', bottom: '-180px', left: '30%', width: '420px', height: '420px', borderRadius: '50%', background: grad(GRAD.pink), opacity: 0.1, filter: 'blur(70px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '0 24px', textAlign: 'center', position: 'relative' }}>
          <h1 className="lp-fadeinup" style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(34px, 6vw, 60px)', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.01em', color: '#1c2420', marginBottom: '24px' }}>
            För att bokföring<br />ska vara{' '}
            <em style={{ fontStyle: 'italic', color: BRAND.greenDark }}>enkelt</em>
          </h1>

          <p className="lp-fadeinup lp-delay-1" style={{ fontSize: '18px', color: '#475569', lineHeight: 1.7, marginBottom: '36px', maxWidth: '500px', fontWeight: 400, margin: '0 auto 36px' }}>
            Fakturor, löner, moms och bokslut i ett enda verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.
          </p>

          <div className="lp-fadeinup lp-delay-2 lp-cta-group" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="lp-btn-primary lp-pulse" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 30px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '15.5px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 10px 26px -8px rgba(61,122,46,0.5)', minHeight: '44px' }}>
              Prova gratis <ArrowRight size={16} />
            </button>
            <button className="lp-btn-secondary" onClick={scrollToFeatures} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '16px 26px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15.5px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', minHeight: '44px' }}>
              Se demo <ChevronRight size={16} />
            </button>
          </div>

          <div className="lp-fadeinup lp-delay-2" style={{ marginTop: '22px', fontSize: '13.5px', color: '#64748b', fontWeight: 600 }}>
            Från <span style={{ color: BRAND.greenDark, fontWeight: 800 }}>99 kr/mån</span> · 30 dagar gratis · avsluta när som helst
          </div>
        </div>
      </section>

      {/* ── EXEMPEL-KPI:ER — mirrorar Startsidans riktiga gradientkort
          (Resultat/Intäkter/Kostnader), tydligt märkta som exempel. Visar
          samma produktkänsla direkt, innan man ens når demon längre ner. ── */}
      <section style={{ padding: '56px 24px 88px', background: '#faf9f5' }}>
        <div style={{ maxWidth: '920px', margin: '0 auto' }}>
          <Reveal style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '0.04em', color: '#9ca3af', textTransform: 'uppercase' }}>Så ser dina nyckeltal ut</span>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: BRAND.greenDark, background: BRAND.greenLight, padding: '2px 8px', borderRadius: '100px' }}>Exempel</span>
          </Reveal>
          <div className="lp-stat-grid">
            <StatCard label="Resultat" value={247400} sub="Vinst 2026" icon={TrendingUp} accent={ACCENT.green} delay={0} />
            <StatCard label="Intäkter" value={571800} sub="Hittills 2026" icon={ArrowUpRight} accent={ACCENT.blue} delay={100} />
            <StatCard label="Kostnader" value={324400} sub="Hittills 2026" icon={ArrowDownRight} accent={ACCENT.red} delay={200} />
          </div>
        </div>
      </section>

      {/* ── FUNKTIONSÖVERSIKT — flyttad upp direkt efter nyckeltalen (annan
          ordning än tidigare), varje kort med egen gradient-ikonchip. ── */}
      <section id="funktioner-teaser" style={{ padding: '96px 24px', background: 'white', borderTop: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700, letterSpacing: '-0.01em', color: '#1c2420', marginBottom: '16px' }}>
              Automatiskt, från kvitto till bokslut
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Du lägger in underlaget. Bokix bokför, räknar moms och skatt, och håller koll på vad som behöver din uppmärksamhet — resten sköts i bakgrunden.
            </p>
          </Reveal>

          <div className="lp-features-grid">
            {FEATURE_COLUMNS.map((f, i) => (
              <Reveal key={f.title} delay={i * 80} className="lp-lux-card" style={{ background: 'white', border: '1px solid #eee8dc', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 14px 30px -20px rgba(28,36,32,0.26)' }}>
                <div style={{ background: f.g.soft, height: '148px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px' }}>
                  <f.art accent={f.g} />
                </div>
                <div style={{ padding: '22px 24px 26px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1c2420', marginBottom: '8px' }}>{f.title}</h3>
                  <p style={{ fontSize: '13.5px', color: '#6b7568', lineHeight: 1.6 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link to="/funktioner" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '14.5px', fontWeight: 700, color: BRAND.green, textDecoration: 'none' }}>
              Se alla funktioner i detalj <ArrowRight size={15} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── BOLAGSFORMER ── */}
      <section style={{ padding: '64px 24px', background: IVORY, borderBottom: `1px solid ${CARD_BORDER}` }}>
        <Reveal style={{ maxWidth: '1080px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '28px' }}>
            Oavsett vad Bolagsverket kallar dig
          </h2>
          <div className="lp-bolagsform-row">
            {COMPANY_TYPES.map((t, i) => {
              const accent = ACCENT_CYCLE[i % 3];
              return (
                <Reveal key={t.label} delay={i * 60} className="lp-lux-card" style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 16px 8px 8px', background: 'white', border: `1px solid ${CARD_BORDER}`, borderRadius: '100px', whiteSpace: 'nowrap' }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <t.icon size={13} color="white" />
                  </div>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: INK_SOFT }}>{t.label}</span>
                </Reveal>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* ── PRODUKTVISNING — DemoWorkspace.jsx monterar de RIKTIGA
          komponenterna med ett lokalt exempeldataset, klickbar på riktigt.
          Rörs inte i den här omgången. ── */}
      <section style={{ padding: '90px 24px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, borderRadius: '100px', fontSize: '12px', fontWeight: 700, color: BRAND.greenDark, marginBottom: '16px' }}>
              <BarChart3 size={12} /> Så ser det ut
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              Bokföringen sköter sig själv
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Samma app som möter dig efter att du skapat konto, här med exempeldata. Verifikationer bokförs automatiskt i bakgrunden — klicka runt i menyn, allt går att testa på riktigt.
            </p>
          </Reveal>

          <Reveal scale style={{ position: 'relative' }}>
            <DemoWorkspace />
          </Reveal>
        </div>
      </section>

      {/* ── ENDA FLÖDET: LEVERANTÖRSFAKTUROR — rödtonen (ACCENT.red) som
          accent här är medvetet: det här flödet HANDLAR om kostnader/
          utgifter, samma betydelse som färgen redan har i Dashboard/
          nyckeltalskorten ovan. ── */}
      <section style={{ padding: '90px 24px', background: 'oklch(97% 0.02 25)' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '48px' }}>
          <Reveal style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: ACCENT.red.soft, borderRadius: '100px', fontSize: '12px', fontWeight: 700, color: ACCENT.red.fg }}>
              <Inbox size={12} /> Ett flöde, hela vägen
            </div>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, margin: '16px 0 14px' }}>
              Leverantörsfakturor, utan krångel
            </h2>
            <p style={{ fontSize: '16px', color: MUTED, maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
              Registrera det du är skyldig. Bokix håller reda på resten.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {[
              { n: '1', title: 'Registrera fakturan', desc: 'Leverantör, belopp, fakturadatum och förfallodatum, med möjlighet att lägga till en ny leverantör direkt i fältet.' },
              { n: '2', title: 'Bokförs eller flaggas', desc: 'Har konteringen redan valts bokförs fakturan direkt. Saknas den läggs den i Granskning tills rätt konto är valt. Aldrig tyst fel.' },
              { n: '3', title: 'Markera som betald', desc: 'Ett klick när fakturan är reglerad. Hela vägen bokförd, aldrig bara en lapp i en hög.' },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 100} className="lp-lux-card" style={{ background: 'white', border: `1px solid ${CARD_BORDER}`, borderRadius: '16px', padding: '24px', boxShadow: CARD_SHADOW_SM }}>
                <div style={{ width: 32, height: 32, borderRadius: '9px', background: ACCENT.red.fg, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', marginBottom: '14px' }}>{step.n}</div>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: INK, marginBottom: '6px' }}>{step.title}</h3>
                <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6 }}>{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── JÄMFÖRELSE ── */}
      <section style={{ padding: '96px 24px', background: 'white' }}>
        <div style={{ maxWidth: '980px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '14px' }}>
              Jämfört med hur du gör det idag
            </h2>
            <p style={{ fontSize: '16px', color: MUTED, maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Ett kalkylark kostar ingenting men kostar tid. En byrå kostar tid att kommunicera med. Bokix gör jobbet medan du fokuserar på verksamheten.
            </p>
          </Reveal>

          <Reveal scale style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: '640px', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', overflow: 'hidden', background: 'white' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', background: IVORY, borderBottom: `1px solid ${CARD_BORDER}` }}>
                <div style={{ padding: '18px 22px' }} />
                <div style={{ padding: '18px 16px', fontSize: '13.5px', fontWeight: 700, color: '#a8a297', textAlign: 'center' }}>Kalkylark</div>
                <div style={{ padding: '18px 16px', fontSize: '13.5px', fontWeight: 700, color: '#a8a297', textAlign: 'center' }}>Redovisningsbyrå</div>
                <div style={{ padding: '18px 16px', fontSize: '13.5px', fontWeight: 800, color: 'white', textAlign: 'center', background: BRAND.green }}>Bokix</div>
              </div>
              {COMPARISON_ROWS.map((row, i) => (
                <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr 1fr', borderBottom: i === COMPARISON_ROWS.length - 1 ? 'none' : `1px solid ${CARD_BORDER}` }}>
                  <div style={{ padding: '18px 22px', fontSize: '13.5px', fontWeight: 700, color: INK, display: 'flex', alignItems: 'center' }}>{row.label}</div>
                  <div style={{ padding: '18px 14px', fontSize: '12.5px', color: '#a8a297', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.5 }}>{row.sheet}</div>
                  <div style={{ padding: '18px 14px', fontSize: '12.5px', color: '#a8a297', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.5 }}>{row.firm}</div>
                  <div style={{ padding: '18px 14px', fontSize: '12.5px', fontWeight: 700, color: BRAND.greenDark, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1.5, background: `${BRAND.green}0c` }}>{row.bokix}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TROVÄRDIGHETSRAD — varje punkt en egen accentfärgad ikonchip
          (cyklar genom nyckeltalens grönt/blått/rött) istället för
          enfärgad text, med hover-lyft och stegrad inanimering. ── */}
      <section style={{ padding: '56px 24px 72px', background: IVORY }}>
        <div style={{ maxWidth: '980px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '16px' }}>
          {TRUST_POINTS.map((t, i) => {
            const accent = ACCENT_CYCLE[i % 3];
            return (
              <Reveal key={t.label} delay={i * 70} className="lp-lux-card" style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '12px 20px 12px 12px', background: 'white', border: `1px solid ${CARD_BORDER}`, borderRadius: '100px', boxShadow: '0 2px 8px rgba(28,36,32,0.05)' }}>
                <div className="lp-float" style={{ width: 32, height: 32, borderRadius: '50%', background: accent.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animationDelay: `${i * 0.4}s` }}>
                  <t.icon size={15} color="white" />
                </div>
                <span style={{ fontSize: '13.5px', fontWeight: 700, color: INK_SOFT, whiteSpace: 'nowrap' }}>{t.label}</span>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── PRISSEKTION — gradientklot bakom kortet, priset räknas upp, och
          varje rad i checklistan får en egen färgad bock istället för
          enfärgad text. ── */}
      <section style={{ padding: '96px 24px', background: '#faf9f5', position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="lp-blob lp-blob-slow" style={{ position: 'absolute', top: '10%', left: '8%', width: '340px', height: '340px', borderRadius: '50%', background: grad(GRAD.blueTeal), opacity: 0.08, filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div aria-hidden className="lp-blob lp-blob-slower" style={{ position: 'absolute', bottom: '5%', right: '8%', width: '340px', height: '340px', borderRadius: '50%', background: grad(GRAD.green), opacity: 0.08, filter: 'blur(70px)', pointerEvents: 'none' }} />

        <Reveal scale style={{ maxWidth: '480px', margin: '0 auto', padding: '0 4px', width: '100%', position: 'relative' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <p style={{ fontSize: '17px', color: '#374151', fontWeight: 600, maxWidth: '380px', margin: '0 auto' }}>Inga tillägg, inga dolda avgifter. Avsluta när som helst.</p>
          </div>

          <div className="lp-lux-card" style={{ background: 'white', border: '1px solid #eee8dc', borderRadius: '20px', padding: '40px 32px 32px', boxShadow: '0 24px 44px -30px rgba(28,36,32,0.24), 0 2px 8px rgba(28,36,32,0.05)', width: '100%', maxWidth: '380px', margin: '0 auto', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
            <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: BRAND.green }} />
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontFamily: 'Georgia, "Times New Roman", serif', fontSize: '46px', fontWeight: 700, letterSpacing: '-0.01em', color: '#1c2420' }}><CountUp target={99} suffix=" kr" /></span>
              <span style={{ fontSize: '14.5px', color: '#6b7568' }}> /mån</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '28px', borderTop: '1px solid #eee8dc', paddingTop: '24px' }}>
              {[
                'Obegränsat med kund- och leverantörsfakturor',
                'Fyra fakturamallar med egen logotyp och accentfärg',
                'Löpande bokföring och kontoplan',
                'Kortbetalningar via Stripe',
              ].map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '11px' }}>
                  <div style={{ width: 19, height: 19, borderRadius: '50%', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <Check size={11} color={BRAND.greenDark} strokeWidth={3} />
                  </div>
                  <span style={{ fontSize: '13.5px', color: '#3a453e', fontWeight: 500, lineHeight: 1.55 }}>{f}</span>
                </div>
              ))}
            </div>
            <button className="lp-btn-primary lp-pulse" onClick={onEnterApp} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 8px 20px -6px rgba(61,122,46,0.4)', minHeight: '44px', marginBottom: '14px' }}>
              Kom igång gratis
            </button>
            <Link to="/priser" style={{ display: 'block', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#6b7280', textDecoration: 'none' }}>
              Se allt som ingår →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── ONBOARDING I TRE STEG — gradient-numrerade badges istället för
          enfärgat grönt. ── */}
      <section style={{ padding: '90px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              Igång på tre steg
            </h2>
            <p style={{ fontSize: '15.5px', color: MUTED }}>Ingen krånglig uppsättning, bara det som faktiskt behövs.</p>
          </Reveal>
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '640px', margin: '0 auto' }}>
            {ONBOARDING_STEPS.map((step, i) => {
              const isLast = i === ONBOARDING_STEPS.length - 1;
              const next = ONBOARDING_STEPS[i + 1];
              return (
                <Reveal key={step.n} delay={i * 100} className="lp-lux-card" style={{ display: 'flex', gap: '22px', alignItems: 'stretch', borderRadius: '14px', padding: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div className="lp-float" style={{ width: 42, height: 42, borderRadius: '50%', background: step.g.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: 'white', flexShrink: 0, animationDelay: `${i * 0.5}s` }}>
                      {step.n}
                    </div>
                    {!isLast && <div style={{ width: '3px', borderRadius: '2px', flex: 1, background: `linear-gradient(180deg, ${step.g.fg}, ${next.g.fg})`, margin: '6px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: isLast ? 0 : '32px', paddingTop: '6px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: INK, marginBottom: '6px' }}>{step.title}</h3>
                    <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding: '96px 24px', background: IVORY }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 700, letterSpacing: '-0.01em', color: INK, marginBottom: '12px' }}>
              Vanliga frågor
            </h2>
            <p style={{ fontSize: '15.5px', color: MUTED }}>Det mesta du undrar över innan du sätter igång.</p>
          </Reveal>

          <Reveal style={{ background: 'white', border: `1px solid ${CARD_BORDER}`, borderRadius: '18px', padding: '6px 26px', boxShadow: '0 2px 10px rgba(28,36,32,0.05)' }}>
            {FAQ_ITEMS.map((item, i) => (
              <FaqItem key={item.q} item={item} index={i} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── CTA — levande flerfärgad gradient (loggans blå→turkos→lime),
          inte längre ett stillastående mörkgrönt fält. ── */}
      <section className="lp-anim-gradient-bg" style={{ padding: '96px 24px', backgroundImage: `linear-gradient(120deg, #0c1f14, ${BRAND.greenHover}, #0e3a2a, #0c1f14)`, position: 'relative', overflow: 'hidden' }}>
        <div aria-hidden className="lp-blob lp-blob-slow" style={{ position: 'absolute', top: '-140px', right: '10%', width: '380px', height: '380px', borderRadius: '50%', background: grad(GRAD.blueTeal), opacity: 0.25, filter: 'blur(70px)', pointerEvents: 'none' }} />
        <div aria-hidden className="lp-blob lp-blob-slower" style={{ position: 'absolute', bottom: '-160px', left: '10%', width: '380px', height: '380px', borderRadius: '50%', background: grad(GRAD.tealLime), opacity: 0.2, filter: 'blur(70px)', pointerEvents: 'none' }} />
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontFamily: SERIF, fontSize: 'clamp(28px, 5vw, 44px)', fontWeight: 700, letterSpacing: '-0.01em', color: 'white', marginBottom: '18px', lineHeight: 1.18 }}>
            Redo att förenkla din ekonomi?
          </h2>
          <p style={{ fontSize: '17px', color: 'rgba(255,255,255,0.7)', marginBottom: '36px', lineHeight: 1.6 }}>
            Kom igång idag, helt gratis i 30 dagar. Inget kreditkort krävs.
          </p>
          <button className="lp-btn-primary lp-pulse" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 34px', background: 'white', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: BRAND.greenDark, fontFamily: 'inherit', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.35)', minHeight: '44px' }}>
            Prova gratis <ArrowRight size={18} />
          </button>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
