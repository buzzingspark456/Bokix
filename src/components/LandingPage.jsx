import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, BarChart3, Users, Shield, Zap, CheckCircle,
  ArrowRight, ChevronRight, Receipt, Inbox,
  Building2, Briefcase, Landmark, HeartHandshake, UserCheck,
} from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import MarketingLayout, { BokixWordmark, Reveal } from './marketing/MarketingLayout';

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
    desc: 'Momsdeklaration, AGI- och kontrolluppgiftssammanställningar samt ett bokslutsflöde som låser räkenskapsåret — redo att lämna till Skatteverket.',
  },
  {
    icon: Users, title: 'Personal',
    desc: 'Lönekörningar med automatiskt skatteavdrag enligt Skatteverkets skattetabeller, lönebesked och en sammanställning per anställd.',
  },
];

const ONBOARDING_STEPS = [
  { n: '1', title: 'Skapa ditt konto', desc: 'Ange företagsnamn och organisationsnummer — Bokix känner själv igen om det är en enskild firma, ett aktiebolag eller en annan bolagsform.' },
  { n: '2', title: 'Fyll i företagsuppgifter', desc: 'Adress, räkenskapsår, momsperiod och kontoplan (BAS) — klart på ett par minuter, med rimliga förval redan ifyllda.' },
  { n: '3', title: 'Kom igång med fakturering', desc: 'Skicka din första kundfaktura eller registrera ett kvitto — du landar direkt i en fungerande bokföring, inte en tom sida.' },
];

export default function LandingPage({ onEnterApp }) {
  const scrollToFeatures = () => {
    const el = document.getElementById('funktioner-teaser');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <MarketingLayout onEnterApp={onEnterApp}>
      {/* ── HERO ── */}
      <section style={{ display: 'flex', alignItems: 'center', background: `linear-gradient(160deg, #f8fffe 0%, ${BRAND.greenLight}55 50%, #f8fffe 100%)`, backgroundSize: '200% 200%', animation: 'lpGradientShift 12s ease-in-out infinite', position: 'relative', overflow: 'hidden', paddingTop: '128px', paddingBottom: '64px' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.greenLight} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div className="lp-hero-grid" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', alignItems: 'center', width: '100%' }}>
          <div>
            <h1 className="lp-fadeinup" style={{ fontSize: 'clamp(32px, 5.5vw, 58px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '24px' }}>
              För att bokföring<br />ska vara<span style={{ color: BRAND.green }}> enkelt</span>
            </h1>

            <p className="lp-fadeinup lp-delay-1" style={{ fontSize: '18px', color: '#475569', lineHeight: 1.7, marginBottom: '36px', maxWidth: '480px', fontWeight: 400 }}>
              Fakturor, löner, moms och bokslut i ett enda verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.
            </p>

            <div className="lp-fadeinup lp-delay-2 lp-cta-group">
              <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 6px 20px -4px rgba(61,122,46,0.4)', minHeight: '44px' }}>
                Prova gratis <ArrowRight size={16} />
              </button>
              <button className="lp-btn-secondary" onClick={scrollToFeatures} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 24px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', minHeight: '44px' }}>
                Se demo <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Höger: en verklig, tom nystartad Bokix-skärm — inte påhittade siffror. */}
          <div className="lp-animate-float" style={{ position: 'relative' }}>
            <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ display: 'flex', height: '380px' }}>
                <div style={{ width: '150px', background: BRAND.green, padding: '16px 10px', flexShrink: 0 }}>
                  <div style={{ marginBottom: '18px', padding: '0 4px' }}>
                    <BokixWordmark height={20} />
                  </div>
                  {['Startsida', 'Kunder', 'Fakturering', 'Utgifter', 'Projekt'].map((label, i) => (
                    <div key={label} style={{ padding: '7px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? BRAND.greenDark : 'rgba(255,255,255,0.85)', background: i === 0 ? BRAND.greenLight : 'transparent', marginBottom: '2px' }}>
                      {label}
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, padding: '22px', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>Välkommen till Bokix</div>
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '18px' }}>Ditt nya företag — redo att komma igång</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                    {['Att fakturera', 'Bokfört saldo'].map(label => (
                      <div key={label} style={{ background: 'white', borderRadius: '10px', padding: '14px', border: '1px solid #e5e7eb' }}>
                        <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>{label.toUpperCase()}</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#111827' }}>0 kr</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ flex: 1, background: 'white', borderRadius: '10px', border: '1px dashed #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '6px' }}>
                    <Receipt size={22} color="#cbd5e1" />
                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>Inga fakturor ännu</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Flytande badge — samma "cool"-känsla som referensen, men bara
                statiskt statustext, aldrig påhittade siffror. */}
            <div className="lp-reveal lp-in" style={{ position: 'absolute', top: '-16px', right: '-16px', background: 'white', borderRadius: '14px', padding: '10px 14px', boxShadow: '0 12px 28px -6px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px', animationDelay: '0.5s' }}>
              <div style={{ position: 'relative', width: 10, height: 10 }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: BRAND.green }} />
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${BRAND.green}`, animation: 'lpPulseRing 1.8s ease-out infinite' }} />
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#111827' }}>Redo på minuter</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── BOLAGSFORMER ── */}
      <section style={{ padding: '64px 24px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <Reveal style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: '28px' }}>
            Oavsett vad Bolagsverket kallar dig
          </h2>
          <div className="lp-bolagsform-row">
            {COMPANY_TYPES.map((t, i) => (
              <Reveal key={t.label} delay={i * 60} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '100px' }}>
                <t.icon size={15} color={BRAND.green} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#374151' }}>{t.label}</span>
              </Reveal>
            ))}
          </div>
        </Reveal>
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
              Registrera det du är skyldig — Bokix håller reda på resten.
            </p>
          </Reveal>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {[
              { n: '1', title: 'Registrera fakturan', desc: 'Leverantör, belopp, fakturadatum och förfallodatum — med möjlighet att lägga till en ny leverantör direkt i fältet.' },
              { n: '2', title: 'Bokförs eller flaggas', desc: 'Har konteringen redan valts bokförs fakturan direkt. Saknas den läggs den i Granskning tills rätt konto är valt — aldrig tyst fel.' },
              { n: '3', title: 'Markera som betald', desc: 'Ett klick när fakturan är reglerad. Hela vägen bokförd — aldrig bara en lapp i en hög.' },
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
              Allt du behöver för att driva ditt svenska företag — samlat på ett ställe.
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

          <div style={{ background: 'white', border: `1.5px solid ${BRAND.green}`, borderRadius: '20px', padding: '40px 32px', boxShadow: '0 20px 50px -15px rgba(61,122,46,0.25)', width: '100%', maxWidth: '380px', margin: '0 auto', boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <span style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a' }}>199 kr</span>
              <span style={{ fontSize: '15px', color: '#9ca3af' }}> /mån</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '28px' }}>
              {[
                'Obegränsat med kund- och leverantörsfakturor',
                'Fyra fakturamallar med egen logotyp och accentfärg',
                'Löpande bokföring och kontoplan',
                'Kortbetalningar via Stripe',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                    <CheckCircle size={11} color={BRAND.greenDark} />
                  </div>
                  <span style={{ fontSize: '13.5px', color: '#374151', fontWeight: 500, lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
            <button className="lp-btn-primary" onClick={onEnterApp} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 6px 20px -4px rgba(61,122,46,0.4)', minHeight: '44px', marginBottom: '14px' }}>
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
            <p style={{ fontSize: '15.5px', color: '#64748b' }}>Ingen krånglig uppsättning — bara det som faktiskt behövs.</p>
          </Reveal>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '28px' }}>
            {ONBOARDING_STEPS.map((step, i) => (
              <Reveal key={step.n} delay={i * 100} style={{ textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: BRAND.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px', margin: '0 auto 16px' }}>{step.n}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{step.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto' }}>{step.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '90px 24px', background: 'linear-gradient(135deg, #0f172a 0%, #10241a 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.green}22 0%, transparent 60%)`, pointerEvents: 'none' }} />
        <Reveal style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'white', marginBottom: '18px', lineHeight: 1.15 }}>
            Redo att förenkla din ekonomi?
          </h2>
          <p style={{ fontSize: '17px', color: '#94a3b8', marginBottom: '36px', lineHeight: 1.6 }}>
            Kom igång idag — helt gratis i 30 dagar. Inget kreditkort krävs.
          </p>
          <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 34px', background: BRAND.green, border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 10px 30px -5px rgba(61,122,46,0.5)', minHeight: '44px' }}>
            Prova gratis <ArrowRight size={18} />
          </button>
        </Reveal>
      </section>
    </MarketingLayout>
  );
}
