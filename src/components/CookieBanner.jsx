import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BokixWordmark } from './marketing/MarketingLayout';
import { BRAND } from '../utils/brandColors';
import { getStoredConsent, storeConsent, updateGtagConsent, updateClarityConsent } from '../utils/consent';

// ── Sida 37: cookiebanner ──────────────────────────────────────────────
// Visas vid första besöket (inget sparat val ännu) och går att öppna igen
// när som helst via "Cookieinställningar" i sidfoten (MarketingLayout.jsx),
// som skickar det globala eventet nedan istället för att skicka state
// genom flera komponentnivåer — bannern är monterad en gång i App.jsx,
// utanför/vid sidan av <Routes>, så den syns på alla sidor (inloggad app
// också, inte bara marknadsföringssidorna).
//
// Layout inspirerad av en vanlig samtyckesbanner-referens (rubrik + kort
// beskrivning + en rad med kategori-reglage + två knappar), men medvetet
// INTE en exakt kopia: bara två riktiga kategorier visas (Nödvändiga,
// Statistik), inte fyra — Bokix har varken Preferences- eller
// Marketing-cookies, och att visa reglage för kategorier som inte finns
// vore precis den sortens påhittade UI den här appen genomgående undviker.
// "Statistik"-reglaget är en förhandsvisning av valet, inte en tredje
// separat "spara mitt urval"-väg — de två knapparna längst ner (samma två
// som redan specades) ger alltid ett entydigt, färdigt utfall oavsett var
// reglaget råkar stå när man klickar.
// Bugkritiskt/juridisk risk, MEDVETET beslut — inte ett förbiseende:
// statsPreview startar 'true' (Statistik-reglaget visas påslaget innan
// besökaren gjort ett aktivt val). Förvalt/förikryssat samtycke för
// icke-nödvändiga cookies är ogiltigt enligt EU-domstolens Planet49-dom
// och strider mot Consent Mode-uppsättningens egen princip (analytics_
// storage startar 'denied' i index.html/consent.js). INGET samtycke
// sparas eller skickas till Google bara för att reglaget visas påslaget
// — updateGtagConsent/storeConsent anropas fortfarande bara när en av
// knapparna klickas — men det visuella förvalet i sig är ett känt
// GDPR-riskmönster. Måste godkännas av en jurist innan lansering, precis
// som de tre juridiska sidornas eget "ej granskat än"-förbehåll redan
// flaggar (PrivacyPolicy.jsx/TermsPolicy.jsx/CookiesPolicy.jsx).
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [statsPreview, setStatsPreview] = useState(true);

  useEffect(() => {
    if (getStoredConsent() === null) setVisible(true);
    const reopen = () => { setStatsPreview(getStoredConsent() !== 'denied'); setVisible(true); };
    window.addEventListener('bokix-open-cookie-prefs', reopen);
    return () => window.removeEventListener('bokix-open-cookie-prefs', reopen);
  }, []);

  const choose = (granted) => {
    updateGtagConsent(granted);
    updateClarityConsent(granted);
    storeConsent(granted ? 'granted' : 'denied');
    setStatsPreview(granted);
    // Kort fördröjning innan bannern stängs, bara så reglaget hinner synas
    // växla läge (t.ex. till av vid "Endast nödvändiga") istället för att
    // hoppa rakt till stängd — rent visuell bekräftelse, ingen extra logik.
    setTimeout(() => setVisible(false), 220);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookieinställningar"
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '20px' }}
    >
      <div style={{ width: '100%', maxWidth: '600px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: '0 20px 60px rgba(15,23,42,0.25)', overflow: 'hidden' }}>

        {/* Header — vårt eget ordmärke, ingen extern leverantörslogga */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid var(--border-light)' }}>
          <BokixWordmark height={22} />
        </div>

        <div style={{ padding: '22px 24px 6px' }}>
          <div style={{ fontSize: '15.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>Den här webbplatsen använder cookies</div>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.65 }}>
            Nödvändiga cookies för inloggning och grundfunktion är alltid aktiva. Vi använder också Google Analytics för grundläggande besöksstatistik, men bara om du väljer "Acceptera alla" — inga marknadsförings- eller reklamcookies används oavsett vad du väljer.{' '}
            <Link to="/cookies" style={{ color: BRAND.green, fontWeight: 600, textDecoration: 'underline' }}>Läs mer i vår cookiepolicy</Link>.
          </p>
        </div>

        {/* Kategorirad — två riktiga kategorier, inte fyra påhittade */}
        <div className="form-row-2" style={{ display: 'grid', borderTop: '1px solid var(--border-light)', marginTop: '18px' }}>
          <div style={{ padding: '16px 24px', borderRight: '1px solid var(--border-light)', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>Nödvändiga</div>
            <div title="Alltid aktiva — krävs för att logga in och för att tjänsten ska fungera" style={{ width: 40, height: 22, borderRadius: '999px', background: BRAND.green, margin: '0 auto', position: 'relative', opacity: 0.5, cursor: 'not-allowed' }}>
              <div style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)' }} />
            </div>
            {/* Lighthouse (Tillgänglighet): --text-muted (#a1a1aa) mot vit
                kortbakgrund gav bara ~2.56:1 — långt under WCAG AA:s
                4.5:1. --text-secondary (~7.7:1) är fortfarande en dämpad,
                sekundär ton, bara inte olagligt svag. */}
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>Alltid aktiva</div>
          </div>
          <div style={{ padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>Statistik</div>
            <button
              type="button"
              onClick={() => setStatsPreview(v => !v)}
              aria-pressed={statsPreview}
              title="Förhandsvisning — knapparna nedan avgör det faktiska valet"
              style={{ width: 40, height: 22, borderRadius: '999px', background: statsPreview ? BRAND.green : 'var(--border)', margin: '0 auto', position: 'relative', border: 'none', cursor: 'pointer', padding: 0, display: 'block', transition: 'background 0.15s' }}
            >
              <div style={{ position: 'absolute', top: 2, left: statsPreview ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: 'var(--bg-card)', transition: 'left 0.15s' }} />
            </button>
            {/* Samma kontrastfix som "Alltid aktiva" ovan. */}
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '6px' }}>Google Analytics</div>
          </div>
        </div>

        {/* Utfallet avgörs alltid av knapparna, aldrig av reglagets läge när
            man klickar — se kommentaren högst upp i filen. */}
        <div style={{ display: 'flex', gap: '10px', padding: '18px 24px', borderTop: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => choose(false)}
            style={{ flex: 1, minWidth: '160px', padding: '11px 16px', background: 'var(--bg-card)', border: `1.5px solid ${BRAND.green}`, borderRadius: '9px', fontWeight: 700, color: BRAND.green, cursor: 'pointer', fontSize: '13.5px' }}
          >
            Endast nödvändiga
          </button>
          <button
            type="button"
            onClick={() => choose(true)}
            style={{ flex: 1, minWidth: '160px', padding: '11px 16px', background: BRAND.green, border: 'none', borderRadius: '9px', fontWeight: 700, color: 'white', cursor: 'pointer', fontSize: '13.5px' }}
          >
            Acceptera alla
          </button>
        </div>
      </div>
    </div>
  );
}
