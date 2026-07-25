import React, { useState, useEffect } from 'react';
import {
  FileText, BarChart3, Users, Clock, Shield, Zap, CheckCircle,
  ArrowRight, ChevronRight, Star, TrendingUp, Receipt, BookOpen,
  Calculator, ChevronDown, Menu, X
} from 'lucide-react';

const NAV_LINKS = ['Funktioner', 'Priser', 'Om oss'];

const FEATURES = [
  {
    icon: FileText, color: '#3a8fc1', bg: '#eef6fb', border: '#b9dcf2',
    title: 'Fakturor & Offerter',
    desc: 'Skapa professionella fakturor och offerter på sekunder. Automatisk momsberäkning och PDF-export.'
  },
  {
    icon: BarChart3, color: '#5ba85a', bg: '#f1f8f1', border: '#bce4bc',
    title: 'Resultat & Balans',
    desc: 'Realtidsöversikt av ditt företags ekonomi. Resultat- och balansräkning med ett klick.'
  },
  {
    icon: Users, color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe',
    title: 'Löner & Anställda',
    desc: 'Automatiska lönekörningar med skatt och arbetsgivaravgifter. Enkel hantering av hela personalstyrkan.'
  },
  {
    icon: Receipt, color: '#d97706', bg: '#fffbeb', border: '#fde68a',
    title: 'Utgifter & Kvitton',
    desc: 'Dra och släpp dina kvitton för att registrera utgifter. Kategorisering och momsavdrag automatiskt.'
  },
  {
    icon: Clock, color: '#ea580c', bg: '#fff7ed', border: '#fdba74',
    title: 'Tidrapportering',
    desc: 'Manuell tidloggning med tim- och startkostand. Omvandla direkt till kundfakturor.'
  },
  {
    icon: Shield, color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc',
    title: 'Skatt & Bokslut',
    desc: 'Generera momsdeklarationer och skatteunderlag som PDF. Redo att lämna till Skatteverket.'
  },
];

const PRICING = [
  {
    name: 'Start', price: 99, desc: 'Perfekt för soloföretagare och nystartade',
    features: ['5 fakturor/mån', 'Grundläggande rapporter', 'Manuell bokföring', 'E-postsupport'],
    cta: 'Kom igång gratis', highlight: false
  },
  {
    name: 'Pro', price: 299, desc: 'För växande företag med fler behov',
    features: ['Obegränsade fakturor', 'Lönehantering', 'Auto-moms', 'PDF-deklarationer', 'Tidrapportering', 'Prioriterad support'],
    cta: 'Prova Pro gratis i 30 dagar', highlight: true
  },
  {
    name: 'Företag', price: 599, desc: 'Skräddarsytt för etablerade bolag',
    features: ['Allt i Pro', 'Obegränsade bolag', 'API-access', 'Dedikerad support', 'Anpassad onboarding', 'SLA-garanti'],
    cta: 'Kontakta oss', highlight: false
  },
];

const TESTIMONIALS = [
  { name: 'Maria Lindgren', company: 'ML Konsult AB', text: 'Bokföring.io har sparat mig minst 4 timmar i veckan. Fakturering och moms är ett nöje nu.', stars: 5, initials: 'ML' },
  { name: 'Johan Persson', company: 'Persson & Partners', text: 'Äntligen ett bokföringsprogram som faktiskt är enkelt. Rekommenderar det till alla mina kunder!', stars: 5, initials: 'JP' },
  { name: 'Sara Ahmed', company: 'Ahmed Design Studio', text: 'Lönehanteringen är fantastisk. Jag hanterar 8 anställda och det tar bara några minuter per månad.', stars: 5, initials: 'SA' },
];

export default function LandingPage({ onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  };

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: '#111827', background: 'white', overflowX: 'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .lp-btn-primary { transition: all 0.2s !important; }
        .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(91,168,90,0.4) !important; }
        .lp-btn-secondary:hover { background: #f9fafb !important; }
        .feature-card { transition: all 0.2s; }
        .feature-card:hover { transform: translateY(-3px); box-shadow: 0 12px 30px -8px rgba(0,0,0,0.1) !important; }
        .price-card { transition: all 0.2s; }
        .price-card:hover { transform: translateY(-4px); }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        .animate-float { animation: float 4s ease-in-out infinite; }
        .animate-fadeinup { animation: fadeInUp 0.6s ease both; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        @keyframes pulse-ring { 0% { transform: scale(0.9); opacity: 0.8; } 100% { transform: scale(1.4); opacity: 0; } }
        .pulse-ring::after { content: ''; position: absolute; inset: 0; border-radius: 50%; border: 2px solid #5ba85a; animation: pulse-ring 2s ease-out infinite; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'rgba(255,255,255,0.95)' : 'transparent',
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
        padding: '0 24px', transition: 'all 0.3s',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.06)' : 'none'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '68px', gap: '32px' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={18} color="white" />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827' }}>Bokföring<span style={{ color: '#5ba85a' }}>.io</span></span>
          </div>

          {/* Desktop nav */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '28px', display: 'flex' }}>
            {[['Funktioner', 'features'], ['Priser', 'pricing'], ['Omdömen', 'testimonials']].map(([label, id]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', fontSize: '14px', fontWeight: 500, color: '#374151', cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#5ba85a'}
                onMouseLeave={e => e.currentTarget.style.color = '#374151'}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button className="lp-btn-secondary" onClick={onEnterApp} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
              Logga in
            </button>
            <button className="lp-btn-primary" onClick={onEnterApp} style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #5ba85a, #4a9e49)', border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 4px 15px -3px rgba(91,168,90,0.3)' }}>
              Prova gratis
            </button>
            {/* Mobile menu toggle */}
            <button onClick={() => setMobileMenuOpen(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'none', padding: '4px' }}>
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: 'linear-gradient(160deg, #f8fffe 0%, #f0f7ff 50%, #f5fff5 100%)', position: 'relative', overflow: 'hidden', paddingTop: '68px' }}>
        {/* Background blobs */}
        <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,168,90,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-80px', left: '-80px', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(58,143,193,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '30%', left: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,168,90,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '80px 24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center', width: '100%' }}>
          {/* Left: Text */}
          <div>
            <div className="animate-fadeinup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: '#f1f8f1', border: '1px solid #bce4bc', borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: '#5ba85a', marginBottom: '24px' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#5ba85a' }} />
              Nytt: PDF-deklarationer direkt till Skatteverket
            </div>

            <h1 className="animate-fadeinup delay-1" style={{ fontSize: 'clamp(36px, 5vw, 58px)', fontWeight: 900, lineHeight: 1.08, letterSpacing: '-0.04em', color: '#0f172a', marginBottom: '24px' }}>
              Bokföring som<br />
              <span style={{ background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                faktiskt är enkel
              </span>
            </h1>

            <p className="animate-fadeinup delay-2" style={{ fontSize: '18px', color: '#475569', lineHeight: 1.7, marginBottom: '36px', maxWidth: '480px', fontWeight: 400 }}>
              Fakturor, löner, moms och bokslut i ett enda snyggt verktyg. Byggt för svenska småföretagare som hellre fokuserar på sin verksamhet än sin bokföring.
            </p>

            <div className="animate-fadeinup delay-3" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '40px' }}>
              <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 28px', background: 'linear-gradient(135deg, #5ba85a, #4a9e49)', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 6px 20px -4px rgba(91,168,90,0.4)' }}>
                Prova gratis i 30 dagar <ArrowRight size={16} />
              </button>
              <button className="lp-btn-secondary" onClick={() => scrollTo('features')} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '14px 24px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                Se funktioner <ChevronRight size={16} />
              </button>
            </div>

            <div className="animate-fadeinup delay-3" style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {[['✓ Inget kreditkort', null], ['✓ Gratis i 30 dagar', null], ['✓ Avsluta när som helst', null]].map(([text]) => (
                <span key={text} style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>{text}</span>
              ))}
            </div>
          </div>

          {/* Right: App mockup */}
          <div className="animate-float" style={{ position: 'relative' }}>
            {/* Main app card */}
            <div style={{ background: 'white', borderRadius: '20px', boxShadow: '0 40px 80px -20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden', position: 'relative' }}>
              {/* Fake sidebar + content */}
              <div style={{ display: 'flex', height: '380px' }}>
                {/* Sidebar */}
                <div style={{ width: '130px', background: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '16px 10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', padding: '0 4px' }}>
                    <div style={{ width: 22, height: 22, borderRadius: '6px', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)' }} />
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#111827' }}>Bokföring.io</span>
                  </div>
                  {[
                    { label: 'Översikt', active: false },
                    { label: 'Fakturor', active: true },
                    { label: 'Kunder', active: false },
                    { label: 'Utgifter', active: false },
                    { label: 'Löner', active: false },
                    { label: 'Rapporter', active: false },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '7px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: item.active ? 700 : 500, color: item.active ? '#5ba85a' : '#6b7280', background: item.active ? '#f1f8f1' : 'transparent', marginBottom: '2px' }}>
                      {item.label}
                    </div>
                  ))}
                </div>
                {/* Main content */}
                <div style={{ flex: 1, padding: '20px', background: '#fafafa', overflowY: 'hidden' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827', marginBottom: '14px' }}>Senaste fakturor</div>
                  {[
                    { name: 'Nordström Konsult', amount: '24 500 kr', status: 'Betald', color: '#5ba85a', bg: '#f1f8f1' },
                    { name: 'Digital Solutions', amount: '18 200 kr', status: 'Skickad', color: '#3a8fc1', bg: '#eef6fb' },
                    { name: 'Kund AB', amount: '9 800 kr', status: 'Förfallen', color: '#dc2626', bg: '#fef2f2' },
                  ].map((inv, i) => (
                    <div key={i} style={{ background: 'white', borderRadius: '10px', padding: '10px 12px', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e5e7eb' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>{inv.name}</div>
                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>{inv.amount}</div>
                      </div>
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '3px 7px', borderRadius: '20px', background: inv.bg, color: inv.color }}>{inv.status}</span>
                    </div>
                  ))}
                  <div style={{ background: 'white', borderRadius: '10px', padding: '12px', marginTop: '12px', border: '1px solid #e5e7eb' }}>
                    <div style={{ fontSize: '10px', color: '#9ca3af', marginBottom: '6px' }}>MÅNADSRESULTAT</div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end', height: '50px' }}>
                      {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                        <div key={i} style={{ flex: 1, background: i === 6 ? '#5ba85a' : '#e2e8f0', borderRadius: '3px 3px 0 0', height: `${h}%`, transition: 'all 0.3s' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div style={{ position: 'absolute', top: '-20px', right: '-20px', background: 'white', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#f1f8f1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color="#5ba85a" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>+42% intäkter</div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>Jämfört med förra månaden</div>
              </div>
            </div>

            <div style={{ position: 'absolute', bottom: '-16px', left: '-16px', background: 'white', borderRadius: '14px', padding: '12px 16px', boxShadow: '0 10px 30px -5px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '10px', background: '#eef6fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Zap size={18} color="#3a8fc1" />
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#111827' }}>Moms beräknad</div>
                <div style={{ fontSize: '10px', color: '#5ba85a', fontWeight: 600 }}>16 925 kr att betala</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF TICKER ── */}
      <section style={{ background: '#0f172a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', gap: '48px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            ['2 400+', 'aktiva företag'],
            ['98%', 'nöjda kunder'],
            ['450 000+', 'fakturor skickade'],
            ['99.9%', 'drifttid'],
          ].map(([num, label]) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#5ba85a', letterSpacing: '-0.03em' }}>{num}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" style={{ padding: '100px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: '#eef6fb', border: '1px solid #b9dcf2', borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: '#3a8fc1', marginBottom: '16px' }}>
              <Zap size={12} /> Allt du behöver
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#0f172a', marginBottom: '16px' }}>
              Komplett bokföring i ett verktyg
            </h2>
            <p style={{ fontSize: '17px', color: '#64748b', maxWidth: '550px', margin: '0 auto', lineHeight: 1.6 }}>
              Allt du behöver för att driva ditt svenska företag – samlat i ett intuitivt system.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', cursor: 'default' }}>
                <div style={{ width: 48, height: 48, borderRadius: '12px', background: f.bg, border: `1px solid ${f.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
                  <f.icon size={22} color={f.color} />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section id="pricing" style={{ padding: '100px 24px', background: '#f8fafc' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: '#f1f8f1', border: '1px solid #bce4bc', borderRadius: '100px', fontSize: '12px', fontWeight: 600, color: '#5ba85a', marginBottom: '16px' }}>
              <Star size={12} /> Transparent prissättning
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#0f172a', marginBottom: '16px' }}>
              Välj din plan
            </h2>
            <p style={{ fontSize: '17px', color: '#64748b', maxWidth: '500px', margin: '0 auto' }}>
              Inga dolda avgifter. Avsluta när som helst. Välj det som passar ditt företag.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
            {PRICING.map((plan) => (
              <div key={plan.name} className="price-card" style={{
                background: plan.highlight ? 'linear-gradient(160deg, #0f172a, #1e293b)' : 'white',
                border: plan.highlight ? 'none' : '1px solid #e5e7eb',
                borderRadius: '20px', padding: '32px',
                boxShadow: plan.highlight ? '0 30px 60px -15px rgba(15,23,42,0.3)' : '0 2px 8px rgba(0,0,0,0.04)',
                position: 'relative', overflow: 'hidden'
              }}>
                {plan.highlight && (
                  <>
                    <div style={{ position: 'absolute', top: 0, right: 0, background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', padding: '6px 16px', borderRadius: '0 20px 0 12px', fontSize: '11px', fontWeight: 700, color: 'white' }}>
                      POPULÄRAST
                    </div>
                    <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'rgba(91,168,90,0.08)' }} />
                  </>
                )}
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: plan.highlight ? '#5ba85a' : '#6b7280' }}>{plan.name}</span>
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '42px', fontWeight: 900, letterSpacing: '-0.04em', color: plan.highlight ? 'white' : '#0f172a' }}>{plan.price === 0 ? 'Gratis' : plan.price}</span>
                  {plan.price > 0 && <span style={{ fontSize: '14px', color: plan.highlight ? '#94a3b8' : '#9ca3af' }}> kr/mån</span>}
                </div>
                <p style={{ fontSize: '13px', color: plan.highlight ? '#94a3b8' : '#6b7280', marginBottom: '24px', lineHeight: 1.5 }}>{plan.desc}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: plan.highlight ? 'rgba(91,168,90,0.2)' : '#f1f8f1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <CheckCircle size={11} color={plan.highlight ? '#5ba85a' : '#5ba85a'} />
                      </div>
                      <span style={{ fontSize: '13px', color: plan.highlight ? '#cbd5e1' : '#374151', fontWeight: 500 }}>{f}</span>
                    </div>
                  ))}
                </div>

                <button className="lp-btn-primary" onClick={onEnterApp} style={{
                  width: '100%', padding: '13px', borderRadius: '12px', border: 'none',
                  background: plan.highlight ? 'linear-gradient(135deg, #5ba85a, #4a9e49)' : 'transparent',
                  border: plan.highlight ? 'none' : '1.5px solid #e5e7eb',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  color: plan.highlight ? 'white' : '#374151',
                  boxShadow: plan.highlight ? '0 6px 20px -4px rgba(91,168,90,0.4)' : 'none'
                }}>
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" style={{ padding: '100px 24px', background: 'white' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '64px' }}>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-0.04em', color: '#0f172a', marginBottom: '12px' }}>
              Vad våra kunder säger
            </h2>
            <p style={{ fontSize: '17px', color: '#64748b' }}>Tusentals nöjda svenska företagare</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="feature-card" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '18px', padding: '28px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} size={14} color="#f59e0b" fill="#f59e0b" />
                  ))}
                </div>
                <p style={{ fontSize: '15px', color: '#374151', lineHeight: 1.65, marginBottom: '20px', fontStyle: 'italic' }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '14px' }}>
                    {t.initials}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '14px', color: '#111827' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: '#9ca3af' }}>{t.company}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA SECTION ── */}
      <section style={{ padding: '100px 24px', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,168,90,0.12) 0%, transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: '700px', margin: '0 auto', textAlign: 'center', position: 'relative' }}>
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 900, letterSpacing: '-0.04em', color: 'white', marginBottom: '20px', lineHeight: 1.1 }}>
            Redo att förenkla din bokföring?
          </h2>
          <p style={{ fontSize: '18px', color: '#94a3b8', marginBottom: '40px', lineHeight: 1.6 }}>
            Kom igång idag – helt gratis i 30 dagar. Inget kreditkort krävs.
          </p>
          <button className="lp-btn-primary" onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', padding: '16px 36px', background: 'linear-gradient(135deg, #5ba85a, #4a9e49)', border: 'none', borderRadius: '14px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 10px 30px -5px rgba(91,168,90,0.5)' }}>
            Starta din gratis provperiod <ArrowRight size={18} />
          </button>
          <div style={{ marginTop: '20px', fontSize: '13px', color: '#64748b' }}>
            Inga dolda avgifter · Avsluta när du vill · Kom igång på 2 minuter
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: '#0a0f1a', padding: '80px 24px 32px', color: '#94a3b8' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px', marginBottom: '64px' }}>
            {/* Column 1: Brand & Intro */}
            <div style={{ gridColumn: 'span 2' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BookOpen size={18} color="white" />
                </div>
                <span style={{ fontSize: '20px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>Bokföring<span style={{ color: '#5ba85a' }}>.io</span></span>
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#64748b', maxWidth: '300px' }}>
                Det moderna bokföringsprogrammet byggt för svenska småföretagare. Gör det svåra enkelt och spara tid.
              </p>
            </div>
            
            {/* Column 2: Product */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '20px' }}>Produkt</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Funktioner', 'Priser', 'Säkerhet', 'Bankintegrationer', 'Uppdateringar'].map(link => (
                  <li key={link}>
                    <a href="#" style={{ fontSize: '14px', color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#5ba85a'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Company */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '20px' }}>Företag</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Om oss', 'Karriär', 'Press', 'Kontakt'].map(link => (
                  <li key={link}>
                    <a href="#" style={{ fontSize: '14px', color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#5ba85a'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{link}</a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Legal */}
            <div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'white', marginBottom: '20px' }}>Juridiskt</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {['Användarvillkor', 'Integritetspolicy', 'GDPR', 'Cookies'].map(link => (
                  <li key={link}>
                    <a href="#" style={{ fontSize: '14px', color: '#64748b', textDecoration: 'none', transition: 'color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#5ba85a'}
                      onMouseLeave={e => e.currentTarget.style.color = '#64748b'}
                    >{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
            <div style={{ fontSize: '13px', color: '#475569' }}>
              © 2026 Bokföring.io. Utvecklat med ❤️ i Stockholm, Sverige.
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>in</span>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8' }}>X</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
