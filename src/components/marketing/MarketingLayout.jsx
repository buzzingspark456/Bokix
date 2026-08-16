import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, ChevronRight } from 'lucide-react';
import { BRAND } from '../../utils/brandColors';

// ── Bokix ordmärke — exakt samma gradient som sidopanelens logga i själva
// appen (App.jsx BokixLogo), så en besökare känner igen samma identitet på
// marknadssidan som i produkten. Loggan är alltid en länk till startsidan
// ("/"), oavsett vilken undersida man står på. ──
export function BokixWordmark({ height = 34 }) {
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

// Sitemap — varje punkt är en RIKTIG egen sida/URL, inte ett skrolla-till-
// sektion-på-samma-sida-ankare som tidigare. Loggan är det enda som alltid
// går till startsidan; de här länkarna går var och en till sin egen sida.
export const MARKETING_PAGES = [
  { label: 'Funktioner', to: '/funktioner' },
  { label: 'Priser', to: '/priser' },
  { label: 'Om oss', to: '/om-oss' },
  { label: 'Kontakt', to: '/kontakt' },
];

/** Globala stilar + animationer, delade av ALLA marknadssidor — en enda
 * källa så knappar/kort/skroll-reveal aldrig kan divergera mellan sidorna. */
function MarketingStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
      #lp-root, #lp-root *, #lp-root *::before, #lp-root *::after { box-sizing: border-box; }
      html { scroll-behavior: smooth; }
      .lp-btn-primary { transition: all 0.2s !important; }
      .lp-btn-primary:hover { transform: translateY(-1px); box-shadow: 0 8px 25px -5px rgba(61,122,46,0.4) !important; }
      .lp-btn-secondary:hover { background: #f9fafb !important; }
      .lp-feature-card { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
      .lp-feature-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px -12px rgba(0,0,0,0.14) !important; border-color: transparent !important; }
      .lp-nav-link { position: relative; }
      .lp-nav-link:hover, .lp-nav-link.active { color: ${BRAND.green} !important; }
      .lp-nav-link::after {
        content: ''; position: absolute; left: 0; right: 0; bottom: 4px; height: 2px;
        background: ${BRAND.green}; transform: scaleX(0); transform-origin: center;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .lp-nav-link:hover::after, .lp-nav-link.active::after { transform: scaleX(1); }
      .lp-footer-link:hover { color: white !important; }
      .lp-card-hover { transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease; }
      .lp-card-hover:hover { transform: translateY(-3px); }

      .lp-logo-glow { display: inline-flex; transition: transform 0.25s ease; }
      .lp-logo-glow:hover { transform: scale(1.04); }
      @keyframes lpFadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
      .lp-fadeinup { animation: lpFadeInUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
      .lp-delay-1 { animation-delay: 0.1s; }
      .lp-delay-2 { animation-delay: 0.2s; }
      .lp-delay-3 { animation-delay: 0.3s; }

      /* Skroll-reveal — se useReveal()-hooken. Elementet startar dolt/
         förskjutet och animeras in mjukt första gången det blir synligt,
         istället för att allt bara redan finns där när sidan laddar. */
      .lp-reveal { opacity: 0; transform: translateY(28px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
      .lp-reveal.lp-in { opacity: 1; transform: translateY(0); }
      .lp-reveal-scale { opacity: 0; transform: scale(0.94); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
      .lp-reveal-scale.lp-in { opacity: 1; transform: scale(1); }

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
  );
}

/** Skroll-reveal-hook — IntersectionObserver som lägger till "lp-in" på
 * elementet första gången det blir synligt i viewporten (bara en gång,
 * avslutar bevakningen direkt efteråt istället för att trigga om och om). */
export function useReveal() {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, inView];
}

/** Wrapper-komponent för det vanliga fallet — döljer boilerplaten ovan för
 * varje sektion som bara vill fadas/glida in vid skroll. */
export function Reveal({ as: Tag = 'div', scale = false, delay = 0, style, className = '', children, ...rest }) {
  const [ref, inView] = useReveal();
  return (
    <Tag
      ref={ref}
      className={`${scale ? 'lp-reveal-scale' : 'lp-reveal'} ${inView ? 'lp-in' : ''} ${className}`}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms', ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Header/nav, delad av alla marknadssidor. Loggan går alltid till "/".
 * Nav-punkterna går till sina egna sidor (sitemap) — aldrig ett skroll-
 * ankare på samma sida. `onEnterApp`: skickas bara in av startsidan (som
 * redan har den lokala showLanding-toggeln); undersidor har den inte och
 * navigerar istället till "/" med en state-flagga som App.jsx läser av för
 * att hoppa direkt till inloggning — se MarketingLayout-kommentaren nedan. */
export function MarketingHeader({ onEnterApp }) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    handler();
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  const handleEnterApp = () => {
    setMobileMenuOpen(false);
    if (onEnterApp) onEnterApp();
    else navigate('/', { state: { enterApp: true } });
  };

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
        background: scrolled ? 'white' : 'transparent',
        borderBottom: scrolled ? '1px solid rgba(0,0,0,0.06)' : 'none',
        padding: '0 24px', transition: 'all 0.3s',
        boxShadow: scrolled ? '0 1px 20px rgba(0,0,0,0.06)' : 'none',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', height: '68px', gap: '32px' }}>
          <Link to="/" className="lp-logo-glow" style={{ alignItems: 'center', flexShrink: 0 }} aria-label="Till startsidan">
            <BokixWordmark height={38} />
          </Link>

          <div className="lp-nav-desktop" style={{ flex: 1, alignItems: 'center', gap: '28px' }}>
            {MARKETING_PAGES.map(page => (
              <Link
                key={page.to} to={page.to}
                className={`lp-nav-link ${location.pathname === page.to ? 'active' : ''}`}
                style={{ fontSize: '14px', fontWeight: 500, color: location.pathname === page.to ? BRAND.green : '#374151', textDecoration: 'none', padding: '10px 0', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}
              >
                {page.label}
              </Link>
            ))}
          </div>

          <div className="lp-nav-desktop" style={{ gap: '10px', alignItems: 'center' }}>
            <button className="lp-btn-secondary" onClick={handleEnterApp} style={{ padding: '11px 16px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit', minHeight: '44px' }}>
              Logga in
            </button>
            <button className="lp-btn-primary" onClick={handleEnterApp} style={{ padding: '11px 18px', background: BRAND.green, border: 'none', borderRadius: '9px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit', boxShadow: '0 4px 15px -3px rgba(61,122,46,0.35)', minHeight: '44px' }}>
              Kom igång
            </button>
          </div>

          <button className="lp-hamburger-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Öppna meny" style={{ background: 'none', border: 'none', cursor: 'pointer', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, marginLeft: 'auto' }}>
            <Menu size={24} />
          </button>
        </div>
      </nav>

      <div className={`lp-mobile-menu ${mobileMenuOpen ? 'lp-open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <Link to="/" onClick={() => setMobileMenuOpen(false)} className="lp-logo-glow" aria-label="Till startsidan"><BokixWordmark height={32} /></Link>
          <button onClick={() => setMobileMenuOpen(false)} aria-label="Stäng meny" style={{ background: 'none', border: 'none', cursor: 'pointer', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={24} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {MARKETING_PAGES.map(page => (
            <Link
              key={page.to} to={page.to} onClick={() => setMobileMenuOpen(false)}
              style={{ background: 'none', border: 'none', borderBottom: '1px solid #f1f5f9', textAlign: 'left', fontSize: '17px', fontWeight: 600, color: location.pathname === page.to ? BRAND.green : '#111827', textDecoration: 'none', fontFamily: 'inherit', padding: '16px 4px' }}
            >
              {page.label}
            </Link>
          ))}
        </div>
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '24px' }}>
          <button onClick={handleEnterApp} style={{ padding: '14px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
            Logga in
          </button>
          <button onClick={handleEnterApp} style={{ padding: '14px', background: BRAND.green, border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: 'white', fontFamily: 'inherit' }}>
            Kom igång
          </button>
        </div>
      </div>
    </>
  );
}

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer style={{ background: '#0e2018', padding: '56px 24px 28px', color: 'rgba(255,255,255,0.6)' }}>
      <div className="lp-footer-grid" style={{ maxWidth: '1200px', margin: '0 auto', marginBottom: '48px' }}>
        <div style={{ maxWidth: '300px' }}>
          <div style={{ marginBottom: '16px' }}>
            <Link to="/" className="lp-logo-glow" aria-label="Till startsidan"><BokixWordmark height={30} /></Link>
          </div>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'rgba(255,255,255,0.5)' }}>
            Bokföring, enkelt. Du växer.
          </p>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Produkt</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['Funktioner', '/funktioner'], ['Priser', '/priser']].map(([label, to]) => (
              <Link key={to} to={to} className="lp-footer-link" style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>Företag</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[['Om oss', '/om-oss'], ['Kontakt', '/kontakt']].map(([label, to]) => (
              <Link key={to} to={to} className="lp-footer-link" style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>
                {label}
              </Link>
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
            {/* Öppnar CookieBanner.jsx igen (monterad globalt i App.jsx) via
                ett DOM-event — den här knappen och bannern delar annars
                ingen komponentförälder att skicka state genom. */}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('bokix-open-cookie-prefs'))}
              className="lp-footer-link"
              style={{ fontSize: '13.5px', color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Cookieinställningar
            </button>
          </div>
        </div>
      </div>

      <div className="lp-footer-bottom" style={{ maxWidth: '1200px', margin: '0 auto', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
          © {year} Bokix. Alla rättigheter förbehållna.
        </div>
      </div>
    </footer>
  );
}

/** Ramen alla marknadssidor renderas i — header, delade stilar/animationer,
 * innehåll, footer. `onEnterApp` skickas bara med från startsidan (App.jsx
 * äger den lokala showLanding-togglen där); undersidor lämnar den odefinierad
 * och headern navigerar då till "/" med `state:{enterApp:true}` istället —
 * App.jsx:s rot-route läser av den flaggan och hoppar direkt till
 * inloggningsskärmen så "Kom igång"/"Logga in" känns likadant oavsett
 * vilken sida man klickade från. */
export default function MarketingLayout({ onEnterApp, children }) {
  return (
    <div id="lp-root" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", color: '#111827', background: 'white', overflowX: 'hidden' }}>
      <MarketingStyles />
      <MarketingHeader onEnterApp={onEnterApp} />
      {children}
      <MarketingFooter />
    </div>
  );
}
