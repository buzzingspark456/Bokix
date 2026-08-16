import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, BarChart3, Users, Shield, Zap,
  ArrowRight, ChevronRight, Inbox,
  Building2, Briefcase, Landmark, HeartHandshake, UserCheck,
} from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import MarketingLayout, { Reveal } from './marketing/MarketingLayout';
import DemoWorkspace from './DemoWorkspace';

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
// sidomenyn i App.jsx) — inte referensens engelska "Accounting/Billing/
// Declarations/Personnel management". ──
const FEATURE_COLUMNS = [
  {
    icon: BarChart3, title: 'Bokföring',
    desc: 'Verifikationer bokförs automatiskt utifrån dina kvitton och fakturor, med en tydlig kontoplan och en egen Granskning för det som behöver ses över manuellt.',
  },
  {
    icon: FileText, title: 'Fakturering',
    desc: 'Skapa kundfakturor med den fakturamall som passar ditt varumärke, registrera leverantörsfakturor och ta emot kortbetalningar direkt via Stripe.',
  },
  {
    icon: Shield, title: 'Skatt och bokslut',
    desc: 'Momsdeklaration, AGI- och kontrolluppgiftssammanställningar samt ett bokslutsflöde som låser räkenskapsåret, redo att lämna till Skatteverket.',
  },
  {
    icon: Users, title: 'Personal',
    desc: 'Lönekörningar med automatiskt skatteavdrag enligt Skatteverkets skattetabeller, lönebesked och en riktig betalfil (ISO 20022) till banken, klar att ladda upp utan manuella summeringar.',
  },
];

const ONBOARDING_STEPS = [
  { n: '1', title: 'Skapa ditt konto', desc: 'Ange företagsnamn och organisationsnummer. Bokix känner själv igen om det är en enskild firma, ett aktiebolag eller en annan bolagsform.' },
  { n: '2', title: 'Fyll i företagsuppgifter', desc: 'Adress, räkenskapsår, momsperiod och kontoplan (BAS), klart på ett par minuter med rimliga förval redan ifyllda.' },
  { n: '3', title: 'Kom igång med fakturering', desc: 'Skicka din första kundfaktura eller registrera ett kvitto. Du landar direkt i en fungerande bokföring, inte en tom sida.' },
];

export default function LandingPage({ onEnterApp }) {
  const scrollToFeatures = () => {
    const el = document.getElementById('funktioner-teaser');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MarketingLayout onEnterApp={onEnterApp}>
      {/* ── HERO ── */}
      <section style={{ display: 'flex', alignItems: 'center', background: BRAND.greenLight, position: 'relative', overflow: 'hidden', paddingTop: '128px', paddingBottom: '80px' }}>
        {/* Enkolumns hero — ingen app-mockup längre (se "Så ser det ut"
            -sektionen nedan för den riktiga produktvisningen, med den
            faktiska Dashboard-komponenten istället för en handbyggd yta här). */}
        <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px', textAlign: 'center' }}>
          <h1 className="lp-fadeinup" style={{ fontSize: 'clamp(32px, 5.5vw, 58px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '24px' }}>
            För att bokföring<br />ska vara<span style={{ color: BRAND.green }}> enkelt</span>
          </h1>

          <p className="lp-fadeinup lp-delay-1" style={{ fontSize: '18px', color: '#475569', lineHeight: 1.7, marginBottom: '36px', maxWidth: '480px', fontWeight: 400, margin: '0 auto 36px' }}>
            Fakturor, löner, moms och bokslut i ett enda verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.
          </p>

          <div className="lp-fadeinup lp-delay-2 lp-cta-group" style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(61,122,46,0.3)', minHeight: '44px' }}>
              Prova gratis <ArrowRight size={16} />
            </button>
            <button className="lp-btn-secondary" onClick={scrollToFeatures} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 24px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', minHeight: '44px' }}>
              Se demo <ChevronRight size={16} />
            </button>
          </div>

          {/* Prisrad — samma siffra som prissektionen och /priser-sidan
              (99 kr/mån), aldrig en egen avvikande uppgift. */}
          <div className="lp-fadeinup lp-delay-2" style={{ marginTop: '20px', fontSize: '13.5px', color: '#64748b', fontWeight: 600 }}>
            Från <span style={{ color: BRAND.greenDark, fontWeight: 800 }}>99 kr/mån</span> · 30 dagar gratis
          </div>
        </div>
      </section>

      {/* ── BOLAGSFORMER ── */}
      <section style={{ padding: '64px 24px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <Reveal style={{ maxWidth: '1080px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: '28px' }}>
            Oavsett vad Bolagsverket kallar dig
          </h2>
          <div className="lp-bolagsform-row">
            {COMPANY_TYPES.map((t, i) => (
              <Reveal key={t.label} delay={i * 60} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 15px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '100px', whiteSpace: 'nowrap' }}>
                <t.icon size={15} color={BRAND.green} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#374151' }}>{t.label}</span>
              </Reveal>
            ))}
          </div>

          {/* Kopplar ihop bolagsformslistan med samma automatik som redan
              beskrivs i steg 1 nedan ("Igång på tre steg") — synligt på två
              ställen istället för bara i onboardingtexten. */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', marginTop: '20px', fontSize: '13px', fontWeight: 600, color: BRAND.greenDark }}>
            <Zap size={14} />
            Känns av automatiskt utifrån ditt organisationsnummer, du behöver inte välja själv
          </div>
        </Reveal>
      </section>

      {/* ── PRODUKTVISNING — DemoWorkspace.jsx monterar de RIKTIGA
          komponenterna (Dashboard, Fakturering, Kunder, Utgifter, Projekt,
          Granskning, Bokföring, Lön, Skatt och bokslut, Rapporter — samma
          komponenter inloggade användare ser) med ett lokalt exempeldataset,
          inte en passiv screenshot-liknande förhandsvisning. Går att klicka
          runt och faktiskt testa funktionerna (skapa en faktura, betala ett
          kvitto, bokföra en lönekörning …) — allt lever bara i komponentens
          eget state, ingen backend, återställs vid omladdning. ── */}
      <section style={{ padding: '90px 24px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '48px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, border: `1px solid ${BRAND.green}33`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark, marginBottom: '16px' }}>
              <BarChart3 size={12} /> Så ser det ut
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '14px' }}>
              Din ekonomi, på ett ställe
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
              Samma app som möter dig efter att du skapat konto, här med exempeldata. Klicka runt i menyn — alla funktioner går att testa på riktigt.
            </p>
          </Reveal>

          <Reveal scale style={{ position: 'relative' }}>
            <DemoWorkspace onEnterApp={onEnterApp} />
          </Reveal>
        </div>
      </section>

      {/* ── ENDA FLÖDET: LEVERANTÖRSFAKTUROR ── */}
      <section style={{ padding: '90px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '48px' }}>
          <Reveal style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, border: `1px solid ${BRAND.green}33`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark, marginBottom: '16px' }}>
              <Inbox size={12} /> Ett flöde, hela vägen
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '14px' }}>
              Leverantörsfakturor, utan krångel
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
              Registrera det du är skyldig. Bokix håller reda på resten.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {[
              { n: '1', title: 'Registrera fakturan', desc: 'Leverantör, belopp, fakturadatum och förfallodatum, med möjlighet att lägga till en ny leverantör direkt i fältet.' },
              { n: '2', title: 'Bokförs eller flaggas', desc: 'Har konteringen redan valts bokförs fakturan direkt. Saknas den läggs den i Granskning tills rätt konto är valt. Aldrig tyst fel.' },
              { n: '3', title: 'Markera som betald', desc: 'Ett klick när fakturan är reglerad. Hela vägen bokförd, aldrig bara en lapp i en hög.' },
            ].map((step, i) => (
              <Reveal key={step.n} delay={i * 100} className="lp-card-hover" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '24px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '9px', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', marginBottom: '14px' }}>{step.n}</div>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>{step.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNKTIONSÖVERSIKT (teaser — full detalj på /funktioner) ── */}
      <section id="funktioner-teaser" style={{ padding: '100px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, border: `1px solid ${BRAND.green}33`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark, marginBottom: '16px' }}>
              <Zap size={12} /> Allt du behöver
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px' }}>
              En plattform för hela ekonomin
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '550px', margin: '0 auto', lineHeight: 1.6 }}>
              Allt du behöver för att driva ditt svenska företag, samlat på ett ställe.
            </p>
          </Reveal>

          <div className="lp-features-grid">
            {FEATURE_COLUMNS.map((f, i) => (
              <Reveal key={f.title} delay={i * 80} className="lp-feature-card" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '26px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 46, height: 46, borderRadius: '12px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <f.icon size={21} color={BRAND.greenDark} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
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

      {/* ── PRISSEKTION (teaser — full detalj på /priser) ── */}
      <section style={{ padding: '100px 24px', background: '#f8fafc' }}>
        <Reveal scale style={{ maxWidth: '480px', margin: '0 auto', padding: '0 4px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '12px' }}>
              Ett pris. Allt ingår.
            </h2>
            <p style={{ fontSize: '15.5px', color: '#64748b' }}>Inga tillägg, inga dolda avgifter. Avsluta när som helst.</p>
          </div>

          <div style={{ background: 'white', border: `1.5px solid ${BRAND.green}`, borderRadius: '20px', padding: '40px 32px', boxShadow: '0 4px 16px rgba(61,122,46,0.15)', width: '100%', maxWidth: '380px', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a' }}>99 kr</span>
              <span style={{ fontSize: '15px', color: '#9ca3af' }}> /mån</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
              {[
                'Obegränsat med kund- och leverantörsfakturor',
                'Fyra fakturamallar med egen logotyp och accentfärg',
                'Löpande bokföring och kontoplan',
                'Kortbetalningar via Stripe',
              ].map(f => (
                <div key={f} style={{ fontSize: '13.5px', color: '#374151', fontWeight: 500, lineHeight: 1.6 }}>{f}</div>
              ))}
            </div>
            <button className="lp-btn-primary" onClick={onEnterApp} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 2px 8px rgba(61,122,46,0.3)', minHeight: '44px', marginBottom: '14px' }}>
              Kom igång gratis
            </button>
            <Link to="/priser" style={{ display: 'block', textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#6b7280', textDecoration: 'none' }}>
              Se allt som ingår →
            </Link>
          </div>
        </Reveal>
      </section>

      {/* ── ONBOARDING I TRE STEG ── */}
      <section style={{ padding: '90px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <Reveal style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '12px' }}>
              Igång på tre steg
            </h2>
            <p style={{ fontSize: '15.5px', color: '#64748b' }}>Ingen krånglig uppsättning, bara det som faktiskt behövs.</p>
          </Reveal>
          {/* Numrerad tidslinje — rundade sifferbadges förbundna med en tunn
              linje, istället för tre likadana kort ELLER en platt textlista.
              Solid bakgrund/kant, ingen gradient eller glow (Sida 36). */}
          <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '640px', margin: '0 auto' }}>
            {ONBOARDING_STEPS.map((step, i) => {
              const isLast = i === ONBOARDING_STEPS.length - 1;
              return (
                <Reveal key={step.n} delay={i * 100} style={{ display: 'flex', gap: '22px', alignItems: 'stretch' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 42, height: 42, borderRadius: '50%', background: BRAND.greenLight, border: `2px solid ${BRAND.green}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 800, color: BRAND.greenDark, flexShrink: 0 }}>
                      {step.n}
                    </div>
                    {!isLast && <div style={{ width: '2px', flex: 1, background: '#e2e8f0', margin: '6px 0' }} />}
                  </div>
                  <div style={{ paddingBottom: isLast ? 0 : '32px', paddingTop: '6px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>{step.title}</h3>
                    <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>{step.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '90px 24px', background: '#142a1f', position: 'relative', overflow: 'hidden' }}>
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'white', marginBottom: '18px', lineHeight: 1.15 }}>
            Redo att förenkla din ekonomi?
          </h2>
          <p style={{ fontSize: '17px', color: '#94a3b8', marginBottom: '36px', lineHeight: 1.6 }}>
            Kom igång idag, helt gratis i 30 dagar. Inget kreditkort krävs.
          </p>
          <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 34px', background: BRAND.green, border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 2px 10px rgba(61,122,46,0.35)', minHeight: '44px' }}>
            Prova gratis <ArrowRight size={18} />
          </button>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
