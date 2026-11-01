import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BokixWordmark } from './marketing/MarketingLayout';
import { BRAND } from '../utils/brandColors';
import { CookieFilled } from './icons';
import { getStoredConsent, storeConsent, updateGtagConsent, updateClarityConsent, updatePosthogConsent } from '../utils/consent';

// ── Sida 37: cookiebanner ──────────────────────────────────────────────
// Visas vid första besöket (inget sparat val ännu) och går att öppna igen
// när som helst via "Cookieinställningar" i sidfoten (MarketingLayout.jsx),
// som skickar det globala eventet nedan istället för att skicka state
// genom flera komponentnivåer — bannern är monterad en gång i App.jsx,
// utanför/vid sidan av <Routes>, så den syns på alla sidor (inloggad app
// också, inte bara marknadsföringssidorna).
//
// Ett kort med loggan, en kort förklaring av våra två sorters cookies och två
// lika knappar: Endast nödvändiga till vänster, Acceptera alla till höger.
// Inget är förvalt, så knapparna är hela valet. Sidan bakom går att använda
// under tiden; statistiken startar först efter ett godkännande (consent-init.js).
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (getStoredConsent() === null) setVisible(true);
    const reopen = () => setVisible(true);
    window.addEventListener('bokix-open-cookie-prefs', reopen);
    return () => window.removeEventListener('bokix-open-cookie-prefs', reopen);
  }, []);

  const choose = (granted) => {
    updateGtagConsent(granted);
    updateClarityConsent(granted);
    updatePosthogConsent(granted);
    storeConsent(granted ? 'granted' : 'denied');
    setVisible(false);
  };

  // Kortet sitter mot botten. Ritades det synligt direkt och typsnittet (eller
  // en fet vikt som bara bannern använder) laddades in efteråt, blev texten
  // högre och hela kortet hoppade uppåt: CLS 0,15 på långsam mobil för varje
  // förstagångsbesökare (Googles gräns för "bra" är 0,1). Därför ritas det
  // först när typsnitten det använder är hämtade (högst 2,5 s). Ett element
  // som dyker upp räknas inte som layoutskift, bara ett som flyttar sig.
  // (Att rita kortet osynligt först och visa det sedan räckte inte: Chrome
  // räknade ändå skiftet, och document.fonts.ready var klar för tidigt.)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!visible || ready) return;
    let done = false;
    const show = () => { if (!done) { done = true; setReady(true); } };
    // Google Fonts-länken laddas asynkront (media="print" → "all", se
    // font-swap.js), och dess typsnitt registreras först en stund efter att
    // länken bytt till "all". Fram till dess svarar document.fonts.load/ready
    // "klart" direkt, eftersom det inte finns något Inter att vänta på. Så:
    // titta var 100:e ms tills Inter finns registrerat och de vikter bannern
    // använder (400 brödtext, 600 länk, 700 rubrik och knappar) är hämtade.
    const SPECS = ['400 13.5px Inter', '600 13.5px Inter', '700 16px Inter'];
    const f = document.fonts;
    const poll = () => {
      if (done) return;
      if (!f?.check) return show();
      const hasInter = [...f].some((x) => x.family.replace(/["']/g, '') === 'Inter');
      if (hasInter) {
        SPECS.forEach((s) => f.load(s, 'Åäö').catch(() => {}));
        if (SPECS.every((s) => f.check(s, 'Åäö'))) return show();
      }
      setTimeout(poll, 100);
    };
    poll();
    const t = setTimeout(show, 2500);
    return () => { done = true; clearTimeout(t); };
  }, [visible, ready]);

  if (!visible || !ready) return null;

  const buttonStyle = {
    flex: 1, minWidth: '140px', minHeight: '44px', padding: '10px 8px', whiteSpace: 'nowrap', background: BRAND.green, border: 'none',
    borderRadius: '9px', color: '#fff', fontWeight: 700, fontSize: '14px', fontFamily: 'inherit', cursor: 'pointer',
  };

  const kinds = [
    { title: 'Nödvändiga', text: 'Behövs för inloggning och för att Bokix ska fungera.' },
    { title: 'Statistik', text: 'Google Analytics, Microsoft Clarity och PostHog visar oss hur Bokix används, så att vi kan göra det bättre.' },
  ];

  // pointerEvents: ytan runt kortet släpper igenom klick, sidan bakom går att använda.
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px', pointerEvents: 'none' }}>
      <div
        role="dialog"
        aria-label="Cookies"
        style={{
          width: '100%', maxWidth: '560px', maxHeight: '100%', overflowY: 'auto', pointerEvents: 'auto', boxSizing: 'border-box',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 16px 48px rgba(15,23,42,0.28)',
        }}
      >
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border-light)' }}>
          <BokixWordmark height={24} />
        </div>
        <div style={{ padding: '16px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span aria-hidden="true" style={{ width: 34, height: 34, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '10px', background: 'color-mix(in srgb, #d9a441 18%, transparent)' }}>
              <CookieFilled size={21} color="#c98a2b" />
            </span>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>Den här webbplatsen använder cookies</div>
          </div>
          <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            Vi använder cookies för att Bokix ska fungera och för att förstå hur tjänsten används.{' '}
            <Link to="/cookies" style={{ color: BRAND.greenDark, fontWeight: 600, textDecoration: 'underline' }}>Läs vår cookiepolicy</Link>
          </p>
          <div style={{ margin: '12px 0 16px', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
            {kinds.map((k, i) => (
              <div key={k.title} style={{ padding: '10px 12px', borderTop: i ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>{k.title}</div>
                <div style={{ marginTop: '2px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.45 }}>{k.text}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', padding: '0 22px 18px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => choose(false)} style={buttonStyle}>Endast nödvändiga</button>
          <button type="button" onClick={() => choose(true)} style={buttonStyle}>Acceptera alla</button>
        </div>
      </div>
    </div>
  );
}
