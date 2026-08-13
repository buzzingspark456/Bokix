import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, BarChart3, Users, Shield, Zap, CheckCircle,
  ArrowRight, ChevronRight, Receipt, Inbox, Menu, X,
  Building2, Briefcase, Landmark, HeartHandshake, UserCheck,
} from 'lucide-react';
import { BRAND } from '../utils/brandColors';

// ── Bokix ordmärke — exakt samma gradient som sidopanelens logga i själva
// appen (App.jsx BokixLogo), så en besökare känner igen samma identitet på
// marknadssidan som i produkten. ──
function BokixWordmark({ height = 34, light = false }) {
  const width = (height * 140) / 48;
  return (
    <svg viewBox="0 0 140 48" width={width} height={height} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bokixLpGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      <text x="4" y="38" fontFamily="Georgia, 'Times New Roman', serif" fontSize="46" fontWeight="600" fill="url(#bokixLpGrad)" letterSpacing="-1.5">Bokix</text>
    </svg>
  );
}

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

const NAV_ITEMS = [
  ['Funktioner', 'features'],
  ['Priser', 'pricing'],
  ['Om oss', 'om-oss'],
  ['Kontakt', 'kontakt'],
];

export default function LandingPage({ onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    // Låser bakgrundsscroll när den fullskärms mobilmenyn är öppen.
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  const year = new Date().getFullYear();

  return (
    <div id="lp-root" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: '#111827', background: 'white', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        #lp-root, #lp-root *, #lp-root *::before, #lp-root *::after { box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .lp-btn-primary { transition: all 0.2s !important; }
        .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(61,122,46,0.4) !important; }
        .lp-btn-secondary:hover { background: #f9fafb !important; }
        .lp-feature-card { transition: all 0.2s; }
        .lp-feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px -8px rgba(0,0,0,0.1) !important; }
        .lp-nav-link:hover { color: ${BRAND.green} !important; }
        .lp-footer-link:hover { color: white !important; }
        @keyframes lpFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes lpFadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .lp-animate-float { animation: lpFloat 4s ease-in-out infinite; }
        .lp-fadeinup { animation: lpFadeInUp 0.6s ease both; }
        .lp-delay-1 { animation-delay: 0.1s; }
        .lp-delay-2 { animation-delay: 0.2s; }
        .lp-delay-3 { animation-delay: 0.3s; }

        /* ── Mobilanpassning ── */
        .lp-nav-desktop { display: flex; }
        .lp-hamburger-btn { display: none; }
        .lp-mobile-menu { display: none; }
        .lp-hero-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 64px; }
        .lp-hero-grid > * { min-width: 0; }
        .lp-cta-group { display: flex; gap: 12px; flex-wrap: wrap; }
        .lp-features-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .lp-bolagsform-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
        .lp-footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 40px; }
        .lp-footer-grid > *, .lp-features-grid > * { min-width: 0; }
        .lp-footer-bottom { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; }

        @media (max-width: 860px) {
          .lp-nav-desktop { display: none; }
          .lp-hamburger-btn { display: flex; }
        }
        @media (max-width: 900px) {
          .lp-hero-grid { grid-template-columns: 1fr; gap: 44px; }
        }
        @media (max-width: 640px) {
          .lp-cta-group { flex-direction: column; }
          .lp-cta-group > button, .lp-cta-group > a { width: 100%; }
          .lp-features-grid { grid-template-columns: 1fr; }
        }
        @media (min-width: 641px) and (max-width: 1024px) {
          .lp-features-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .lp-footer-grid { grid-template-columns: 1fr; gap: 36px; }
          .lp-footer-bottom { flex-direction: column; text-align: center; }
        }
        .lp-mobile-menu.lp-open {
          display: flex; position: fixed; inset: 0; background: white; z-index: 2000;
          flex-direction: column; padding: 20px 24px 32px;
        }
      `}</style>

      {/* ── HEADER / NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
        padding: '0 24px', transition: 'all 0.3s',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '68px', gap: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <BokixWordmark height={30} />
          </div>

          <div className="lp-nav-desktop" style={{ flex: 1, alignItems: 'center', gap: '28px' }}>
            {NAV_ITEMS.map(([label, id]) => (
              <button key={id} className="lp-nav-link" onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', padding: '10px 0', transition: 'color 0.15s', minHeight: '44px' }}>
                {label}
              </button>
            ))}
          </div>

          <div className="lp-nav-desktop" style={{ gap: '10px', alignItems: 'center' }}>
            <button className="lp-btn-secondary" onClick={onEnterApp} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', minHeight: '44px' }}>
              Logga in
            </button>
            <button className="lp-btn-primary" onClick={onEnterApp} style={{ padding: '11px 18px', background: BRAND.green, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 4px 15px -3px rgba(61,122,46,0.35)', minHeight: '44px' }}>
              Kom igång
            </button>
          </div>

          <button className="lp-hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Öppna meny" style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, marginLeft: 'auto' }}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* ── MOBILMENY (fullskärm overlay) ── */}
      <div className={`lp-mobile-menu ${mobileMenuOpen ? 'lp-open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <BokixWordmark height={28} />
          <button onClick={() => setMobileMenuOpen(false)} aria-label="Stäng meny" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {NAV_ITEMS.map(([label, id]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', textAlign: 'left', fontSize: '17px', fontWeight: 600, color: '#111827', cursor: 'pointer', fontFamily: 'inherit', padding: '16px 4px' }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '24px' }}>
          <button onClick={() => { setMobileMenuOpen(false); onEnterApp(); }} style={{ padding: '14px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            Logga in
          </button>
          <button onClick={() => { setMobileMenuOpen(false); onEnterApp(); }} style={{ padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>
            Kom igång
          </button>
        </div>
      </div>

      {/* ── HERO ── */}
      <section style={{ display: 'flex', alignItems: 'center', background: `linear-gradient(160deg, #f8fffe 0%, ${BRAND.greenLight}55 50%, #f8fffe 100%)`, position: 'relative', overflow: 'hidden', paddingTop: '128px', paddingBottom: '64px' }}>
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.greenLight} 0%, transparent 70%)`, pointerEvents: 'none' }} />

        <div className="lp-hero-grid" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', alignItems: 'center', width: '100%' }}>
          <div>
            <div className="lp-fadeinup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: BRAND.greenLight, border: `1px solid ${BRAND.green}33`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark, marginBottom: '24px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: BRAND.green }} />
              Byggt för svenska småföretagare
            </div>

            <h1 className="lp-fadeinup lp-delay-1" style={{ fontSize: 'clamp(32px, 5.5vw, 58px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '24px' }}>
              För att bokföring<br />ska vara<span style={{ color: BRAND.green }}> enkelt</span>
            </h1>

            <p className="lp-fadeinup lp-delay-2" style={{ fontSize: '18px', color: '#475569', lineHeight: 1.7, marginBottom: '36px', maxWidth: '480px', fontWeight: 400 }}>
              Fakturor, löner, moms och bokslut i ett enda verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.
            </p>

            <div className="lp-fadeinup lp-delay-3 lp-cta-group" style={{ marginBottom: '32px' }}>
              <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 28px', background: BRAND.green, border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 6px 20px -4px rgba(61,122,46,0.4)', minHeight: '44px' }}>
                Prova gratis <ArrowRight size={16} />
              </button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('features')} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '15px 24px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', minHeight: '44px' }}>
                Se demo <ChevronRight size={16} />
              </button>
            </div>

            <div className="lp-fadeinup lp-delay-3" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              {['Inget kreditkort krävs', 'Gratis i 30 dagar', 'Avsluta när som helst'].map(text => (
                <span key={text} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                  <CheckCircle size={13} color={BRAND.green} /> {text}
                </span>
              ))}
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
          </div>
        </div>
      </section>

      {/* ── BOLAGSFORMER ── */}
      <section style={{ padding: '64px 24px', background: 'white', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3vw, 28px)', fontWeight: 800, letterSpacing: '-0.02em', color: '#0f172a', marginBottom: '28px' }}>
            Oavsett vad Bolagsverket kallar dig
          </h2>
          <div className="lp-bolagsform-row">
            {COMPANY_TYPES.map(t => (
              <div key={t.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '100px' }}>
                <t.icon size={15} color={BRAND.green} />
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#374151' }}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ENDA FLÖDET: LEVERANTÖRSFAKTUROR ── */}
      <section style={{ padding: '90px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '48px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, border: `1px solid ${BRAND.green}33`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark, marginBottom: '16px' }}>
              <Inbox size={12} /> Ett flöde, hela vägen
            </div>
            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '14px' }}>
              Leverantörsfakturor, utan krångel
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '580px', margin: '0 auto', lineHeight: 1.6 }}>
              Registrera det du är skyldig — Bokix håller reda på resten.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
            {[
              { n: '1', title: 'Registrera fakturan', desc: 'Leverantör, belopp, fakturadatum och förfallodatum — med möjlighet att lägga till en ny leverantör direkt i fältet.' },
              { n: '2', title: 'Bokförs eller flaggas', desc: 'Har konteringen redan valts bokförs fakturan direkt. Saknas den läggs den i Granskning tills rätt konto är valt — aldrig tyst fel.' },
              { n: '3', title: 'Markera som betald', desc: 'Ett klick när fakturan är reglerad. Hela vägen bokförd — aldrig bara en lapp i en hög.' },
            ].map(step => (
              <div key={step.n} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '24px' }}>
                <div style={{ width: 32, height: 32, borderRadius: '9px', background: BRAND.greenLight, color: BRAND.greenDark, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px', marginBottom: '14px' }}>{step.n}</div>
                <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#111827', marginBottom: '6px' }}>{step.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FUNKTIONSÖVERSIKT ── */}
      <section id="features" style={{ padding: '100px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: BRAND.greenLight, border: `1px solid ${BRAND.green}33`, borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: BRAND.greenDark, marginBottom: '16px' }}>
              <Zap size={12} /> Allt du behöver
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px' }}>
              En plattform för hela ekonomin
            </h2>
            <p style={{ fontSize: '16px', color: '#64748b', maxWidth: '550px', margin: '0 auto', lineHeight: 1.6 }}>
              Allt du behöver för att driva ditt svenska företag — samlat på ett ställe.
            </p>
          </div>

          <div className="lp-features-grid">
            {FEATURE_COLUMNS.map(f => (
              <div key={f.title} className="lp-feature-card" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '26px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ width: 46, height: 46, borderRadius: '12px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <f.icon size={21} color={BRAND.greenDark} />
                </div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRISSEKTION — ett enda pris, inget tre-nivå-kort ── */}
      <section id="pricing" style={{ padding: '100px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '480px', margin: '0 auto', padding: '0 4px', width: '100%' }}>
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
                'Moms-, AGI- och kontrolluppgiftssammanställningar',
                'Lönekörningar för hela personalen',
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
            <button className="lp-btn-primary" onClick={onEnterApp} style={{ width: '100%', padding: '15px', borderRadius: '12px', border: 'none', background: BRAND.green, fontSize: '15px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', color: 'white', boxShadow: '0 6px 20px -4px rgba(61,122,46,0.4)', minHeight: '44px' }}>
              Kom igång gratis
            </button>
          </div>
        </div>
      </section>

      {/* ── ONBOARDING I TRE STEG ── */}
      <section style={{ padding: '90px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '56px' }}>
            <h2 style={{ fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '12px' }}>
              Igång på tre steg
            </h2>
            <p style={{ fontSize: '15.5px', color: '#64748b' }}>Ingen krånglig uppsättning — bara det som faktiskt behövs.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '28px' }}>
            {ONBOARDING_STEPS.map(step => (
              <div key={step.n} style={{ textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: BRAND.green, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '16px', margin: '0 auto 16px' }}>{step.n}</div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{step.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#6b7280', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto' }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── OM OSS / KONTAKT — korta, ärliga sektioner så navlänkarna inte pekar i tomma intet ── */}
      <section id="om-oss" style={{ padding: '80px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px' }}>Om oss</h2>
          <p style={{ fontSize: '15.5px', color: '#475569', lineHeight: 1.75 }}>
            Bokix byggs för svenska småföretagare som vill lägga sin tid på verksamheten, inte på pappersarbete. Vi tror att bokföring, fakturering och lön kan vara enkelt utan att bli otydligt — och bygger hellre en funktion som fungerar hela vägen än tio halvfärdiga.
          </p>
        </div>
      </section>

      <section id="kontakt" style={{ padding: '80px 24px', background: 'white' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 34px)', fontWeight: 900, letterSpacing: '-0.03em', color: '#0f172a', marginBottom: '16px' }}>Kontakt</h2>
          <p style={{ fontSize: '15.5px', color: '#475569', lineHeight: 1.75, marginBottom: '20px' }}>
            Har du frågor om Bokix, eller behöver du hjälp med ditt konto?
          </p>
          <a href="mailto:support@bokix.se" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '13px 24px', background: BRAND.greenLight, color: BRAND.greenDark, borderRadius: '12px', fontWeight: 700, fontSize: '14.5px', textDecoration: 'none', minHeight: '44px' }}>
            support@bokix.se
          </a>
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '90px 24px', background: 'linear-gradient(135deg, #0f172a 0%, #10241a 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', borderRadius: '50%', background: `radial-gradient(circle, ${BRAND.green}22 0%, transparent 60%)`, pointerEvents: 'none' }} />
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(28px, 5vw, 46px)', fontWeight: 900, letterSpacing: '-0.03em', color: 'white', marginBottom: '18px', lineHeight: 1.15 }}>
            Redo att förenkla din ekonomi?
          </h2>
          <p style={{ fontSize: '17px', color: '#94a3b8', marginBottom: '36px', lineHeight: 1.6 }}>
            Kom igång idag — helt gratis i 30 dagar. Inget kreditkort krävs.
          </p>
          <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 34px', background: BRAND.green, border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 10px 30px -5px rgba(61,122,46,0.5)', minHeight: '44px' }}>
            Prova gratis <ArrowRight size={18} />
          </button>
        </div>
      </section>

      {/* ── FOOTER — mörkgrön, samma ton som sidopanelen i appen ── */}
      <footer style={{ background: '#0e2018', padding: '56px 24px 28px', color: 'rgba(255,255,255,0.6)' }}>
        <div className="lp-footer-grid" style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '48px' }}>
          <div style={{ maxWidth: '300px' }}>
            <div style={{ marginBottom: '16px' }}>
              <BokixWordmark height={28} />
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
              Bokföring, enkelt. Du växer.
            </p>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Produkt</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[['Funktioner', 'features'], ['Priser', 'pricing']].map(([label, id]) => (
                <button key={id} className="lp-footer-link" onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.2s' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Företag</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[['Om oss', 'om-oss'], ['Kontakt', 'kontakt']].map(([label, id]) => (
                <button key={id} className="lp-footer-link" onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontFamily: 'inherit', transition: 'color 0.2s' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Juridiskt</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { title: 'Integritetspolicy', to: '/privacy' },
                { title: 'Användarvillkor', to: '/terms' },
                { title: 'Cookiepolicy', to: '/cookies' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="lp-footer-link" style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>
                  {link.title}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom" style={{ maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            © {year} Bokix. Alla rättigheter förbehållna.
          </div>
        </div>
      </footer>
    </div>
  );
}
