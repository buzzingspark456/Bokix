import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CookieFilled } from './icons';
import BokixWordmark from './shared/BokixWordmark';
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

  // Liten och lugn (2026-11-27, grundaren: 'stör inte, inte så mycket plats'):
  // en ruta nere till vänster med en rad text och två lika knappar. Inget är
  // förvalt och knapparna väger lika, så valet är fortfarande ärligt.
  return (
    <div className="ck" role="dialog" aria-label="Cookies">
      <div className="ck-brand"><BokixWordmark height={18} /><span className="ck-ico" aria-hidden="true"><CookieFilled size={16} color="#c98a2b" /></span></div>
      <p className="ck-text">
        Vi använder cookies för inloggning och för att förstå hur Bokix används.{' '}
        <Link to="/cookies">Läs mer</Link>
      </p>
      <div className="ck-actions">
        <button type="button" onClick={() => choose(false)}>Endast nödvändiga</button>
        <button type="button" onClick={() => choose(true)}>Acceptera alla</button>
      </div>
    </div>
  );
}
