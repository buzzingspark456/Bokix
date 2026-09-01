import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import {
  LayoutDashboard,
  FileText,
  Receipt,
  Loader2,
  Users,
  BookOpen,
  FolderTree,
  BarChart3,
  Settings as SettingsIcon,
  Building2,
  ChevronDown,
  ChevronRight,
  Plus,
  X,
  Calculator,
  Clock,
  DollarSign,
  FileCheck,
  Menu,
  Sun,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
  CheckSquare,
  Shield,
  User,
  UsersRound,
  Bell,
  HelpCircle,
  Briefcase,
  Timer,
  FileSpreadsheet,
  LogOut,
  Moon,
  AlertTriangle,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './components/AccountsData';
import { getNextInvoiceNumber } from './utils/invoiceNumbering';
import { createStripeCheckoutSession } from './stripeApi';
import { createEmailDomain, getEmailDomainStatus } from './emailApi';
import { getDebet, getKredit } from './utils/verificationAmounts';
import { BRAND } from './utils/brandColors';
import { COMPANY_WRITABLE_FIELDS } from './utils/companyFields.js';
import { deleteFileFromStorage } from './utils/fileUpload';
import BokixWordmark from './components/shared/BokixWordmark';

// ── Bokix Logo Component (light sidebar) ──
// Klickbar — tar till startsidan precis som varumärkeslogotyper brukar göra.
// Egen <button> (inte bara onClick på diven) så den blir tangentbords-
// åtkomlig och får en riktig hover/aktiv-känsla, inte bara en klickbar yta
// utan visuell respons.
//
// `compact`: den vanliga sidomenyn är dold bakom hamburgermenyn på mobil
// (ren CSS-transform, alltid kvar i DOM:en) — så mobilens topbar hade ingen
// logotyp alls förrän man öppnat menyn. `compact` renderar samma logotyp i
// en liten variant utan blockpadding, till mobilens topbar (56px hög).
// Själva ordmärket (shared/BokixWordmark.jsx) delas nu med marknadssidan
// — se dess egen kommentar för varför det bytt från levande <text> till
// fasta vektorkonturer (kundfeedback: "inte stabil ... på alla platser").
function BokixLogo({ onClick, compact = false }) {
  return (
    <button
      onClick={onClick}
      title="Till startsidan"
      style={compact ? {
        display: 'flex', alignItems: 'center', padding: 0,
        background: 'none', border: 'none', cursor: 'pointer',
        transition: 'opacity 0.15s', flexShrink: 0,
      } : {
        // Kundfeedback ("den ska vara i mitten, inte for mycket at hoger
        // eller vanster"): loggan satt vansterjusterad i sin fullbredds-
        // ruta (flex-column utan alignItems stracker BARNET, men en SVG
        // har egen intrinsic bredd sa den hamnade kvar vid startkanten
        // istallet). alignItems:'center' centrerar den horisontellt i
        // sidomenyns logga-yta, textAlign inte langre relevant utan en
        // textnod att justera.
        padding: '22px 14px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: 'none', border: 'none', cursor: 'pointer', width: '100%',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {/* Ingen tagline längre — den hör hemma på marknadssidan, inte i det
          dagliga arbetsverktyget. Loggan får nu eget utrymme och är
          märkbart större eftersom den inte längre delar ytan med en rad text.
          Kundfeedback (upprepad): fortfarande för liten både i sidomenyn och
          i mobil-topbaren — ytterligare en storleksökning här, samma
          proportion bevarad på båda varianterna. */}
      <BokixWordmark height={compact ? 37 : 62} />
    </button>
  );
}

// ── Tvåstegsverifiering vid inloggning (säkerhetsgranskningen) ──
// Visas mellan "rätt lösenord" och "faktiskt inne i appen" för en
// användare som aktiverat TOTP i Inställningar (TwoFactorSection,
// Settings.jsx) — annars var 2FA bara möjligt att registrera, aldrig
// efterfrågat igen vid nästa inloggning. Samma varumärkesbakgrund som
// Auth.jsx/OnboardingFlow.jsx.
//
// Kundfeedback: "finare och bättre UI/UX" — bytt den enda textrutan (skriv
// alla sex siffror i en generisk <input>) mot sex separata sifferrutor,
// samma mönster som SMS-/app-kodverifiering i de flesta appar man redan
// känner igen — auto-hoppar till nästa ruta när man skriver, hoppar
// tillbaka vid backspace i en tom ruta, och klistrar man in en hel kod
// fördelas den automatiskt över alla sex. Skickas automatiskt så fort sjätte
// siffran är ifylld — inget extra klick på "Verifiera" behövs i normalfallet.
function MfaChallengeScreen({ onVerify, onCancel }) {
  const [digits, setDigits] = React.useState(['', '', '', '', '', '']);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const inputRefs = React.useRef([]);

  React.useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const verify = React.useCallback(async (code) => {
    setError('');
    setLoading(true);
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.message || 'Fel kod. Försök igen.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }, [onVerify]);

  // Bugkritiskt: `setDigits(prev => { ...sidoeffekter (fokusbyte, verify()-
  // anrop)...; return next; })` — sidoeffekter INUTI en state-updater-
  // funktion är inte tillåtet enligt Reacts kontrakt (den funktionen måste
  // vara ren) och StrictMode (main.jsx) kör därför avsiktligt varje sådan
  // updater två gånger i dev för att avslöja exakt det här — vilket i
  // praktiken gjorde att fokusbytet aldrig hann hända innan nästa
  // knapptryckning kom in (siffra 2, 3, 4... skrevs i tomma intet). `digits`
  // läses direkt ur closure-state istället (säkert här: varje anrop triggas
  // av en enskild användarhändelse, aldrig flera snabba uppdateringar i
  // samma tick) och sidoeffekterna körs EFTER `setDigits(next)`, i vanlig
  // funktionskropp — aldrig inuti updatern.
  const setDigitAt = (index, value) => {
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && next.every(d => d !== '')) verify(next.join(''));
  };

  const handleChange = (index, raw) => {
    const value = raw.replace(/\D/g, '');
    if (!value) { setDigitAt(index, ''); return; }
    // Klistras/skrivs flera siffror in i en ruta (t.ex. hela koden inklistrad
    // i första rutan, eller snabb mobiltangentbords-autofyll) — sprid ut dem
    // över rutorna från och med denna istället för att bara behålla den
    // sista siffran.
    const next = [...digits];
    let i = index;
    for (const ch of value) {
      if (i > 5) break;
      next[i] = ch;
      i++;
    }
    setDigits(next);
    const focusIndex = Math.min(i, 5);
    requestAnimationFrame(() => inputRefs.current[focusIndex]?.focus());
    if (next.every(d => d !== '')) verify(next.join(''));
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    handleChange(0, pasted);
  };

  const code = digits.join('');
  const handleSubmit = (e) => {
    e.preventDefault();
    if (code.length === 6 && !loading) verify(code);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, padding: '24px', fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '22px', padding: '36px 32px', boxShadow: '0 12px 40px -8px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', boxSizing: 'border-box' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '16px', flexShrink: 0,
          background: `linear-gradient(160deg, ${BRAND.green}, #0e3a2a)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 20px -6px ${BRAND.green}99`,
        }}>
          <ShieldCheck size={26} color="white" strokeWidth={2.2} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Tvåstegsverifiering</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>Ange den 6-siffriga koden från din autentiseringsapp.</p>
        </div>

        <div style={{ display: 'flex', gap: '9px' }} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={1}
              value={d}
              disabled={loading}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              onFocus={e => e.target.select()}
              aria-label={`Siffra ${i + 1} av 6`}
              style={{
                width: '44px', height: '54px', textAlign: 'center', fontSize: '22px', fontWeight: 700,
                fontFamily: 'monospace', color: 'var(--text-main)', background: 'var(--bg-muted)',
                border: error ? '1.5px solid var(--status-red-text)' : d ? `1.5px solid ${BRAND.green}` : '1.5px solid var(--border)',
                borderRadius: '10px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
            />
          ))}
        </div>

        {error ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
            <AlertTriangle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} /> {error}
          </div>
        ) : (
          loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: BRAND.green, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Verifierar...
            </div>
          )
        )}

        {/* Skickas normalt automatiskt så fort sjätte siffran fylls i (se
            setDigitAt) — knappen är kvar som en tydlig, manuell reserv om
            t.ex. mobilens autofyll fyller rutorna på ett sätt som inte
            triggar auto-skicket. */}
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          style={{ width: '100%', padding: '13px', background: BRAND.green, border: 'none', borderRadius: '10px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: loading || code.length !== 6 ? 'default' : 'pointer', opacity: loading || code.length !== 6 ? 0.5 : 1, fontFamily: 'inherit', transition: 'opacity 0.15s' }}
        >
          Verifiera
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
          Avbryt och logga ut
        </button>
      </form>
    </div>
  );
}

// Visas när Supabase-sessionen kommer från en "Glömt lösenord"-länk i
// mejlet (PASSWORD_RECOVERY-eventet, se onAuthStateChange och
// passwordRecovery-state:t nedan) — annars skulle en klickad återställnings-
// länk bara logga in användaren tyst med det GAMLA lösenordet fortfarande
// kvar, utan att någonsin faktiskt fråga efter ett nytt. Samma
// gate-mönster (och samma "Avbryt och logga ut"-reserv) som
// MfaChallengeScreen ovan.
function PasswordRecoveryScreen({ onSubmit, onCancel }) {
  const [password, setPassword] = React.useState('');
  const [password2, setPassword2] = React.useState('');
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { setError('Lösenordet måste vara minst 8 tecken.'); return; }
    if (password !== password2) { setError('Lösenorden matchar inte.'); return; }
    setError('');
    setLoading(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message || 'Kunde inte uppdatera lösenordet. Försök igen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, padding: '24px', fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '22px', padding: '36px 32px', boxShadow: '0 12px 40px -8px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', boxSizing: 'border-box' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '16px', flexShrink: 0,
          background: `linear-gradient(160deg, ${BRAND.green}, #0e3a2a)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 8px 20px -6px ${BRAND.green}99`,
        }}>
          <Lock size={26} color="white" strokeWidth={2.2} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>Skapa nytt lösenord</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>Ange ett nytt lösenord för ditt konto.</p>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password" autoFocus autoComplete="new-password" placeholder="Nytt lösenord (minst 8 tecken)"
            value={password} onChange={e => setPassword(e.target.value)} disabled={loading} minLength={8} required
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14.5px', color: 'var(--text-main)', background: 'var(--bg-muted)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <input
            type="password" autoComplete="new-password" placeholder="Upprepa nytt lösenord"
            value={password2} onChange={e => setPassword2(e.target.value)} disabled={loading} required
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14.5px', color: 'var(--text-main)', background: 'var(--bg-muted)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 12px', background: 'var(--status-red-bg)', color: 'var(--status-red-text)', borderRadius: '8px', fontSize: '13px', fontWeight: 600, width: '100%', boxSizing: 'border-box' }}>
            <AlertTriangle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '13px', background: BRAND.green, border: 'none', borderRadius: '10px', color: 'white', fontWeight: 700, fontSize: '15px', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'inherit', transition: 'opacity 0.15s' }}
        >
          {loading ? 'Uppdaterar...' : 'Uppdatera lösenord'}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
          Avbryt och logga ut
        </button>
      </form>
    </div>
  );
}
// Kod-splittring (Sida ~14, bunt-storleksvarningen från `vite build`):
// alla flikar i den inloggade appen, plus de rena marknadsförings-/
// juridiksidorna, laddas numera lazy — själva startbunten behöver inte
// längre innehålla t.ex. hela Löne- eller Bokförings-modulen bara för
// att visa inloggningssidan. Kvar som vanliga (icke-lazy) imports: allt
// som hör till den KRITISKA första renderingen (Auth/OnboardingFlow) eller
// alltid är monterat som appens "skal" (HelpDrawer/Toast/
// PaymentRequiredGate) — att göra DEM lazy hade bara lagt till en onödig
// Suspense-flimmer på den väg alla inloggade användare går. CookieBanner
// är INTE kvar här längre — den monteras nu en gång för alla i
// AppRouter.jsx (marknad OCH inloggad app delar samma instans där).
const Dashboard = lazy(() => import('./components/Dashboard'));
const Invoices = lazy(() => import('./components/Invoices'));
const Quotes = lazy(() => import('./components/Quotes'));
const Expenses = lazy(() => import('./components/Expenses'));
const SupplierInvoices = lazy(() => import('./components/SupplierInvoices'));
const Contacts = lazy(() => import('./components/Contacts'));
const Verifications = lazy(() => import('./components/Verifications'));
const Accounts = lazy(() => import('./components/Accounts'));
const Reports = lazy(() => import('./components/Reports'));
const Settings = lazy(() => import('./components/Settings'));
const Projects = lazy(() => import('./components/Projects'));
const TimeTracking = lazy(() => import('./components/TimeTracking'));
const Payroll = lazy(() => import('./components/Payroll'));
const Taxes = lazy(() => import('./components/Taxes'));
// Alla ANDRA marknads-/juridiksidor (FeaturesPage/PricingPage/AboutPage/
// ContactPage/ChooseSoftwareGuidePage/PrivacyPolicy/TermsPolicy/
// CookiesPolicy/PersonuppgiftsBitradesAvtal) flyttade till AppRouter.jsx
// (Prestanda-fixet: se kommentaren vid App-komponentens topp) — den här
// filen (och allt DEN importerar: Stripe, alla sidomeny-ikoner nedan,
// lönehantering osv.) laddas nu bara när någon faktiskt loggar in eller
// registrerar sig, inte för varje besökare som bara läser startsidan.
//
// LandingPage är UNDANTAGET och stannar kvar som ett vanligt (icke-lazy)
// import här också, trots att AppRouter.jsx ÄVEN har en egen kopia: om
// App.jsx laddas för att localStorage råkade ha en sparad session-nyckel
// (RootRoute i AppRouter.jsx antar då inloggad) men den sessionen visar sig
// vara utgången/ogiltig när den riktiga koll:en (nedan) körs, hamnar
// `isLoggedIn` ändå kvar på false — och showLanding är fortfarande sant
// (ingen `enterApp`-flagga sattes den vägen in). Grenen längre ner
// (`!isLoggedIn ? showLanding ? <LandingPage/> : <Auth/> ...`) MÅSTE alltså
// kunna rendera LandingPage helt själv, utan att förlita sig på att
// AppRouter redan gjorde det — annars kraschar just den situationen
// (utgången session) med en ReferenceError.
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import OnboardingFlow from './components/OnboardingFlow';
import { supabase } from './supabaseClient';
import { useLocation, useNavigate } from 'react-router-dom';
const ReviewQueue = lazy(() => import('./components/ReviewQueue'));
const CompanySettings = lazy(() => import('./components/CompanySettings'));
import HelpDrawer from './components/HelpDrawer';
import Toast from './components/shared/Toast';
import PaymentRequiredGate from './components/PaymentRequiredGate';

// Fallback under den enda <Suspense> som omsluter App-komponentens JSX (se
// return-satsen längre ner) — visas bara under den korta stund en lazy-flik
// (t.ex. Skatt och bokslut) laddar sin egen JS-bunt för första gången,
// aldrig vid vanlig flikväxling efteråt (webbläsaren har den cachad då).
// AppRouter.jsx har en egen, identisk minimalkopia som Suspense-fallback
// medan HELA den här filen (App.jsx, lazy-laddad därifrån) hämtas första
// gången — kan inte importera den härifrån, den filen är ju precis det som
// fortfarande laddas i det ögonblicket.
function RouteLoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <Loader2 size={28} color="var(--text-muted)" style={{ animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

// Sidomenyns grupper/etiketter speglade från den RIKTIGA <nav> längre ner
// (samma tre grupper, samma ordning) — bara så AppLoadingSkeleton kan visa
// exakt samma radlängder OCH markera rätt rad som aktiv, istället för sex
// gissade streck utan koppling till vilken sida man faktiskt ska in på.
const SKELETON_NAV_GROUPS = [
  ['dashboard', 'contacts', 'quotes', 'invoices', 'expenses', 'projects'],
  ['review', 'verifications', 'payroll', 'reports', 'taxes'],
  ['settings'],
];
// Bredd i % per nav-rad (samma etiketter som riktiga <nav>:en, fast som
// streck) — statiska tal räcker, det är bara en siluett.
const SKELETON_NAV_WIDTHS = { dashboard: 62, contacts: 50, quotes: 56, invoices: 68, expenses: 58, projects: 52, review: 66, verifications: 60, payroll: 78, reports: 82, taxes: 70, settings: 64 };

// Vilken innehålls-siluett (se DashboardSkeletonContent/ListSkeletonContent/
// SettingsSkeletonContent nedan) som bäst speglar respektive sidas FAKTISKA
// form — kort+graf för Startsida/Rapporter, tabellrader för de flesta
// listsidorna (inkl. Skatt och bokslut, som är en radlista av deklarations-
// steg, inte ett formulär), och etikett/fält-par för Inställningar/Företag.
const SKELETON_VARIANT_BY_TAB = {
  dashboard: 'dashboard',
  reports: 'dashboard',
  settings: 'settings',
  company: 'settings',
};
function skeletonVariantForTab(tab) {
  return SKELETON_VARIANT_BY_TAB[resolveNavGroup(tab)] || 'list';
}

function DashboardSkeletonContent() {
  return (
    <>
      {/* "Hej, ..."-rubriken */}
      <div className="skeleton-shape" style={{ width: '240px', height: '28px' }} />

      {/* KPI-korten (Intäkter/Kostnader/Resultat) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shape" style={{ height: '108px', borderRadius: '16px' }} />
        ))}
      </div>

      {/* Grafen */}
      <div className="skeleton-shape" style={{ height: '260px', borderRadius: '16px' }} />

      {/* Listrader (t.ex. "Senast bokfört") */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="skeleton-shape" style={{ height: '46px', borderRadius: '10px' }} />
        ))}
      </div>
    </>
  );
}

// Kunder/Offerter/Fakturering/Utgifter/Projekt/Granskning/Bokföring/
// Anställda och lön/Skatt och bokslut — samma grundform på alla: en rubrik,
// en verktygsrad (sök + en primärknapp), sen en tabell/lista av rader.
function ListSkeletonContent() {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div className="skeleton-shape" style={{ width: '200px', height: '26px' }} />
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton-shape" style={{ width: '180px', height: '34px', borderRadius: '8px' }} />
          <div className="skeleton-shape" style={{ width: '110px', height: '34px', borderRadius: '8px' }} />
        </div>
      </div>

      {/* Statisk ram (som riktiga tabellkortet), skimret hör hemma på
          INNEHÅLLET i varje rad, inte på själva behållaren — annars döljs
          det mesta av skimret bakom radernas egna, täckande bakgrunder. */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div className="skeleton-shape" style={{ width: '32%', height: '13px' }} />
              <div className="skeleton-shape" style={{ width: '16%', height: '13px' }} />
              <div className="skeleton-shape" style={{ width: '14%', height: '13px', marginLeft: 'auto' }} />
              <div className="skeleton-shape" style={{ width: '60px', height: '20px', borderRadius: '999px' }} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Inställningar/Företag — etikett+fält-par grupperade i ett par kortsektioner,
// samma form som Settings.jsx/CompanySettings.jsx faktiska formulär.
function SettingsSkeletonContent() {
  return (
    <>
      <div className="skeleton-shape" style={{ width: '180px', height: '28px' }} />
      {[0, 1].map(section => (
        <div key={section} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="skeleton-shape" style={{ width: '40%', height: '11px' }} />
                <div className="skeleton-shape" style={{ height: '36px', borderRadius: '8px' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

const SKELETON_CONTENT_BY_VARIANT = {
  dashboard: DashboardSkeletonContent,
  list: ListSkeletonContent,
  settings: SettingsSkeletonContent,
};

// Fallback för <Suspense> RUNT {renderContent()} (se main-content-inner
// längre ner) — bara innehållsytans egen siluett, INTE sidomeny/topbar.
// Säkerhetsgranskningen/UX-fixet: de riktiga sidkomponenterna (Dashboard,
// Invoices, Taxes, m.fl.) är alla React.lazy() — första gången man klickar
// sig till en flik vars JS-bunt inte redan hämtats den här sessionen
// SUSPENDAR den komponenten. Innan den här inre gränsen fanns bubblade det
// upp till den enda <Suspense> som omslöt HELA App-komponentens JSX
// (RouteLoadingFallback, en ensam cirkel) — vilket monterade bort
// sidomeny+topbar+ALLT och ersatte
// dem med en tom sida med en snurra, på VARJE flik man inte redan besökt.
// Den här inre gränsen fångar suspendet lokalt: sidomeny/topbar förblir
// monterade och stilla, bara innehållsytan visar en siluett av sidan man
// faktiskt är på väg till (samma variant-mappning som AppLoadingSkeleton).
function PageContentSkeleton({ tab }) {
  const ContentSkeleton = SKELETON_CONTENT_BY_VARIANT[skeletonVariantForTab(tab)];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} aria-busy="true">
      <ContentSkeleton />
    </div>
  );
}

// Startskärmen medan inloggning/datainhämtning pågår (App.jsx, se
// `if (isLoadingAuth) return <AppLoadingSkeleton tab={activeTab} />` längre
// ner) — en tyst siluett av sidomeny + topbar + INNEHÅLLET på sidan man
// faktiskt är på väg in på (activeTab, redan känt vid omladdning tack vare
// URL-hashen — se useState(activeTab) ovan), inte alltid Startsidans form.
// Återanvänder samma klassnamn som den riktiga layouten (.app-container/
// .sidebar/.main-wrapper/.desktop-top-bar/.global-top-bar) för att få EXAKT
// samma bredd/höjd/responsivitet gratis från index.css — inget hopp i
// layouten när den riktiga sidan (med data) sen tar över samma platser.
function AppLoadingSkeleton({ tab }) {
  const activeGroup = resolveNavGroup(tab);
  const ContentSkeleton = SKELETON_CONTENT_BY_VARIANT[skeletonVariantForTab(tab)];

  return (
    <div className="app-container" aria-busy="true" aria-label="Laddar Bokix…">
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div className="logo-container" style={{ padding: '22px 24px 18px' }}>
          <div className="skeleton-shape--on-sidebar" style={{ width: '104px', height: '26px' }} />
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 20px 12px', flexShrink: 0 }} />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: '4px 0', flexShrink: 0 }}>
          {SKELETON_NAV_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 20px' }} />}
              {group.map(id => {
                const isActive = resolveTab(id) === activeGroup;
                return (
                  <div key={id} style={{ padding: '9px 24px', background: isActive ? 'rgba(255,255,255,0.14)' : 'none' }}>
                    <div className="skeleton-shape--on-sidebar" style={{ width: `${SKELETON_NAV_WIDTHS[id] || 60}%`, height: '13px', opacity: isActive ? 1 : 0.75 }} />
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </nav>
      </aside>

      <main className="main-wrapper">
        <div className="desktop-top-bar">
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="skeleton-shape" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            <div className="skeleton-shape" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            <div className="skeleton-shape" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            <div className="skeleton-shape" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
          </div>
        </div>

        <div className="global-top-bar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center' }}>
            <div className="skeleton-shape" style={{ width: '30px', height: '30px', borderRadius: '8px' }} />
            <div className="skeleton-shape" style={{ width: '84px', height: '20px', marginLeft: '10px' }} />
          </div>
          <div className="global-actions" style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton-shape" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
            <div className="skeleton-shape" style={{ width: '34px', height: '34px', borderRadius: '8px' }} />
          </div>
        </div>

        <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1100px' }}>
          <ContentSkeleton />
        </div>
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────
// Default company data factory
// ──────────────────────────────────────────────
function createEmptyCompanyData(companyInfo) {
  return {
    company: {
      // Slumpsuffix utöver tidsstämpeln (samma mönster som t.ex. Invoices.jsx
      // newRowId/Expenses.jsx) — säkerhetsgranskningen: company_id skickas
      // oautentiserat till create-checkout-session.js (kundens fakturalänk,
      // se App.jsx getInvoicePaymentLinkUrl), så en ren Date.now()-baserad id
      // vore gissningsbar inom ett smalt tidsfönster. user_id (en riktig
      // Supabase-UUID) är fortfarande huvudspärren, det här är bara ett extra
      // lager.
      id: `company_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: companyInfo.name || 'Nytt företag',
      orgNr: companyInfo.orgNr || '',
      vatNr: '',
      address: '',
      email: '',
      phone: '',
      logoUrl: companyInfo.logoUrl || '',
      fSkatt: 'Innehar F-skattsedel',
      bankgiro: '',
      plusgiro: '',
      iban: '',
      bic: '',
      stripeAccountId: '',
      // ── E-postavsändare (Sida 33) ── Företagets egen domän för utgående
      // fakturor/kvitton/notiser via Resend. `emailDomainStatus` är BARA en
      // display-cache för Inställningar-sidan — själva utskicket litar
      // aldrig på den (se resolveSenderAddress i api/email/*), den frågar
      // alltid Resend live innan varje utskick.
      emailDomain: '',
      resendDomainId: '',
      emailDomainStatus: '', // '' | 'pending' | 'verified' | 'failed'
      emailDomainRecords: [],
      defaultVat: 25,
      fiscalYear: `${new Date().getFullYear()}-01-01`,
      vatPeriod: 'quarterly',
      chartPlan: 'bas2025',
      // Automatiska påminnelser (api/cron/reminders.js) — inga inställningar
      // i UI:t än (Sida: "ship without settings UI"), bara vettiga
      // hårdkodade förvalsvärden. `agiRemindersSent` markerar redan
      // skickade AGI-deadline-påminnelser per periodKey (t.ex. "2026-08")
      // — momsens motsvarande markörer ligger istället på respektive
      // vatPeriods[periodKey].remindersSent (se cron-jobbet), och en
      // fakturas på invoice.remindersSent — olika platser eftersom
      // vatPeriods/invoices redan är egna, adresserbara poster, medan AGI
      // saknar en egen post per period att fästa markören på.
      notifications: {
        enabled: true,
        invoiceReminderDays: 3,
        declarationReminderDays: 7,
        agiRemindersSent: {},
      },
    },
    accounts: [...DEFAULT_ACCOUNTS],
    verifications: [],
    invoices: [],
    // Egen lista, inte samma array som `invoices` med ett `type`-fält som
    // urskiljare — se normalizeCompanyData nedan för varför. Fortnox/Bokio
    // och alla andra stora håller offerter och fakturor helt åtskilda så
    // att en offert aldrig kan räknas som bokföringsunderlag av misstag.
    quotes: [],
    expenses: [],
    contacts: [],
    // Sparade fakturarader (artikelnr/benämning/pris/momssats) att återanvända
    // i stället för att skriva om samma rad för hand varje gång — se
    // Invoices.jsx: ArticleRegisterModal + artikelvalet i radernas
    // avancerade fält.
    articles: [],
    projects: [],
    timeEntries: [],
    // Godkännande-status per (person, månad, kund) för Tidrapportering →
    // Tidrapporter-vyn (Projects.jsx). Skild från `timeEntries` (de
    // faktiska loggade raderna) — det här är bara VILKET LÄGE varje
    // persons månadsrapport befinner sig i (Pågående/Inskickad/Attesterad/
    // Godkänd), skapas först när någon faktiskt ändrar status (se
    // getReportStatus i Projects.jsx: frånvaro av en post = "Pågående").
    timeReportStatuses: [],
    billableTimeEntries: [],
    recurringTemplates: [],
    verificationTemplates: [],
    vatPeriods: {},
    reviewHistory: [],
    employees: [],
    payrollRuns: [],
  };
}

// ──────────────────────────────────────────────
// MIGRERING: offerter/fakturor från EN delad lista till TVÅ separata
// ──────────────────────────────────────────────
// Innan detta låg offerter och fakturor i samma `invoices`-array, urskilda
// bara av ett `type: 'quote'`-fält. Problemet var inte kosmetiskt: Dashboard
// och Taxes filtrerade aldrig bort quote-poster, så en osparad offert med
// status 'draft'/'sent' kunde se ut som en obokförd faktura i de vyerna.
// Sparad data (localStorage eller Supabase) kan fortfarande ha allt i en
// enda lista — den splittas här en gång, permanent, vid inläsning.
function splitInvoicesAndQuotes(list) {
  const quotes = [];
  const invoices = [];
  (list || []).forEach(item => {
    (item.type === 'quote' ? quotes : invoices).push(item);
  });
  return { invoices, quotes };
}

function normalizeCompanyData(companyData) {
  if (!companyData) return companyData;
  const { invoices, quotes: strayQuotes } = splitInvoicesAndQuotes(companyData.invoices);
  const quotes = Array.isArray(companyData.quotes)
    ? [...companyData.quotes, ...strayQuotes]
    : strayQuotes;
  if (invoices.length === (companyData.invoices || []).length && Array.isArray(companyData.quotes)) {
    return companyData; // redan migrerat, inget att göra
  }
  return { ...companyData, invoices, quotes };
}

function normalizeStore(store) {
  if (!store || !store.companies) return store;
  const companies = {};
  Object.entries(store.companies).forEach(([id, companyData]) => {
    companies[id] = normalizeCompanyData(companyData);
  });
  return { ...store, companies };
}

// ──────────────────────────────────────────────
// STORAGE
// ──────────────────────────────────────────────
const STORAGE_KEY = 'bokforing_data';
// Säkerhetsfix (säkerhetsgranskningen): en enda global localStorage-nyckel
// för hela bokförings-blobben (kunder, fakturor, löner — riktig PII/
// ekonomidata) rensades tidigare ALDRIG vid utloggning, och lästes rakt av
// utan att kolla VEM den tillhörde. På en delad dator: nästa person som
// öppnade samma webbläsare (inloggad eller ej) kunde läsa föregångarens
// data via localStorage — och i undantagsfallet "Supabase tillfälligt
// otillgängligt" (isSupabaseUnavailableError) skulle en ANNAN inloggad
// användare rentav få föregångarens cachade data laddad som sin egen. Den
// här ägar-taggen (en separat, liten nyckel — INTE inbakad i själva
// data-blobben, så den aldrig råkar följa med till Supabase state-kolumnen)
// gör att cachen bara återanvänds om den redan tillhör den nu inloggade
// användaren; annars börjar man om från tomt istället för att riskera att
// visa (eller spara över) någon annans siffror. clearLocalData() rensar
// båda nycklarna vid utloggning, se alla supabase.auth.signOut()-anrop.
const STORAGE_OWNER_KEY = 'bokforing_data_owner';

function blankData() {
  const defaultData = createEmptyCompanyData({});
  return {
    activeCompanyId: defaultData.company.id,
    companies: {
      [defaultData.company.id]: defaultData,
    },
  };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.companies && parsed.activeCompanyId) {
        return normalizeStore(parsed);
      }
    }
  } catch {
    // ignore
  }

  // Initialize blank company data for new users
  return blankData();
}

// Som loadData(), men returnerar bara den cachade datan om den redan är
// taggad med SAMMA userId — annars null, så anropande kod kan falla
// tillbaka på en tom, oskriven state istället för en annan användares.
// Utan känt userId (t.ex. mock-/demo-läge utan riktig inloggning) tillåts
// cachen som förut — det finns inget konto den skulle kunna läcka från.
function loadDataForUser(userId) {
  if (!userId) return loadData();
  try {
    const owner = localStorage.getItem(STORAGE_OWNER_KEY);
    if (owner && owner !== userId) return null;
  } catch {
    // ignore
  }
  return loadData();
}

function saveData(data, ownerId) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  if (ownerId) {
    try { localStorage.setItem(STORAGE_OWNER_KEY, ownerId); } catch { /* privat läge etc. */ }
  }
}

function clearLocalData() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_OWNER_KEY);
  } catch {
    // ignore
  }
}

function isSupabaseUnavailableError(error) {
  if (!error) return false;

  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || '').toLowerCase();

  return (
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('does not exist') ||
    message.includes('relation') ||
    message.includes('schema cache')
  );
}

// ──────────────────────────────────────────────
// TAB ROUTING & ALIASES
// ──────────────────────────────────────────────
const tabAliases = { 
  profile:          'settings', 
  users:            'settings',
  bank:             'dashboard',
  taxes_vat:        'taxes',
  taxes_yearend:    'taxes',
  time:             'projects',
  accounts:         'verifications',
  revenue:          'invoices',
  expense_overview: 'expenses',
  receipts:         'expenses',
  supplierInvoices: 'expenses',
  transfers:        'verifications',
  dashboard:        'dashboard',
  contacts:         'contacts',
  invoices:         'invoices',
  // Offerter var tidigare en flik INUTI Invoices.jsx (därav aliaset till
  // 'invoices' som stod här) — men sedan offerter/fakturor blev separata
  // listor (App.jsx: normalizeStore) är Quotes.jsx en egen sida, och
  // 'quotes' måste peka på sig själv för att navmenyn nedan ska kunna
  // länka dit istället för att fastna på fakturasidan.
  quotes:           'quotes',
  expenses:         'expenses',
  projects:         'projects',
  review:           'review',
  verifications:    'verifications',
  payroll:          'payroll',
  taxes:            'taxes',
  reports:          'reports',
  company:          'company',
  settings:         'settings',
};
const resolveTab = (id) => tabAliases[id] || id;
// "Leverantörsfakturor" (SupplierInvoices.jsx) har ingen egen sidopunkt i
// sidomenyn — den nås via Faktureringens ("invoices") egen Leverantörer-
// flik/genväg (Invoices.jsx: SupplierInvoicesPanel), som navigerar hit med
// det fristående tab-id:t 'supplier_invoices' så att rätt sida (inte bara
// rätt underflik) öppnas. Här, för meny-highlight/rubrik, ska den därför
// räknas som "invoices" — INTE "expenses": den hörde tidigare hemma som en
// flik under Utgifter, men sen den flyttades till Fakturering ska
// sidomenyn markera "Fakturering", inte hoppa till "Utgifter" och se ut
// att navigera bort till en annan sida (kundrapporterad förvirring).
const resolveNavGroup = (id) => resolveTab(id === 'supplier_invoices' ? 'invoices' : id);

// ──────────────────────────────────────────────
// APP COMPONENT
// ──────────────────────────────────────────────
// Prestandafix (Lighthouse: mobil 62, FCP/LCP 5–6.6s på marknadssidan):
// den här komponenten är hela den INLOGGADE bokföringsappen — sidomeny,
// Stripe, lönehantering, alla ~35 ikoner nedan m.m. — och laddades tidigare
// eagert för VARJE besökare, även någon som bara tittar på startsidan och
// aldrig loggar in. main.jsx importerade den här filen direkt (inte lazy),
// så hela den bunten (620+ KB) laddades innan hero-sektionen ens hann
// målas, på en långsam mobilanslutning flera sekunders extra väntan för
// inget en anonym besökare faktiskt behövde.
//
// Routingen (tidigare <Routes> här i filen, med både "/" OCH marknads-/
// juridiksidorna som syskon-Route) är flyttad till AppRouter.jsx, som nu
// är det som main.jsx faktiskt monterar. AppRouter.jsx äger marknads-/
// juridiksidorna direkt (LandingPage m.fl., aldrig via den här filen) och
// lazy-laddar den HÄR komponenten (App) bara när någon faktiskt klickar
// "Kom igång"/"Logga in", redan har en sparad inloggning, eller kommer in
// via en Supabase-/Stripe-callback-länk — se AppRouter.jsx:s RootRoute för
// exakt villkoren. Den här filens EGEN logik (isLoggedIn/showLanding/
// Auth/Onboarding/Dashboard-växlingen nedan) är HELT oförändrad — den vet
// inte ens att den numera monteras lite senare än förr.
function App() {
  const [data, setData] = useState(loadData);
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '');
      if (hash) return resolveTab(hash);
    }
    return 'dashboard';
  });
  
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash) setActiveTab(resolveTab(hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  // null = ingen bedömning gjord än / inte blockerad. 'blocked' = inloggad
  // Supabase-användare UTAN giltig public.subscriptions-rad (trialing/
  // active/past_due) — se PaymentRequiredGate.jsx. Satt i fetchUserData,
  // FÖRE isLoggedIn(true), så appen aldrig hinner visas ens ett ögonblick.
  const [subscriptionGate, setSubscriptionGate] = useState(null);
  // Bugkritiskt (kundrapport): vilken användare den HÄR fliken senast satte
  // igång fetchUserData för. En `ref`, inte state — måste kunna läsas
  // synkront inne i onAuthStateChange-lyssnaren nedan, inte vänta in en
  // re-render. Supabase delar inloggningen via localStorage mellan ALLA
  // flikar av samma origin: loggar man in på ETT konto i en flik medan en
  // ANNAN flik redan visar ett annat, inloggat konto, sänder Supabase ett
  // SIGNED_IN-event även till den andra fliken. Att bara köra
  // fetchUserData(session.user) rakt av där kapplöper mot en redan pågående
  // fetchUserData för den gamla användaren — exakt det som hände en kund:
  // ett konto utan avslutad betalning visade betalspärren, ett klick
  // landade istället på instrumentpanelen, för att den kapplöpande
  // fetchUserData-körningen för det GAMLA (redan betalande) kontot hann
  // svara sist och skrev över gaten. Se onAuthStateChange längre ner.
  const loadedUserIdRef = useRef(null);
  // Säkerhetsfix (säkerhetsgranskningen): TwoFactorSection (Settings.jsx)
  // lät användare registrera TOTP, men login-flödet kollade aldrig
  // "authenticator assurance level" efteråt — en inloggning med rätt
  // lösenord gick alltså rakt igenom och visade appen ÄVEN för en
  // användare som aktiverat 2FA, ingenstans efterfrågades koden. Satt i
  // fetchUserData, FÖRE isLoggedIn(true) (samma mönster som
  // subscriptionGate ovan), så appens data aldrig hinner hämtas ens om
  // en angripare har rätt lösenord men inte enhetens TOTP-kod.
  const [mfaChallenge, setMfaChallenge] = useState(null); // { factorId, challengeId } | null
  // Sant medan sessionen kommer från en klickad "Glömt lösenord"-länk
  // (PASSWORD_RECOVERY-eventet, se onAuthStateChange nedan och
  // PasswordRecoveryScreen ovan) — tills användaren faktiskt satt ett nytt
  // lösenord. Samma gate-mönster som mfaChallenge ovan, kollas FÖRE
  // !isLoggedIn-grenen i renderingen av samma skäl.
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  // Fångas EN gång vid första renderingen — innan den andra useEffect-hooken
  // längre ner (?subscription_checkout=success-toasten) hinner städa bort
  // parametern ur URL:en. fetchUserData körs asynkront (efter getSession()-
  // anropet), så om den istället läste window.location.search direkt skulle
  // den nästan alltid komma efter att toast-hooken redan rensat den.
  const [initialSubscriptionCheckoutParam] = useState(
    () => new URLSearchParams(window.location.search).get('subscription_checkout')
  );

  // "Kom igång"/"Logga in" klickat på en av de fristående marknadssidorna
  // (Funktioner/Priser/Om oss/Kontakt, se MarketingLayout) navigerar hit
  // till "/" med en state-flagga istället för att kunna anropa den lokala
  // showLanding-togglen direkt (den lever bara här). Läses av en gång och
  // rensas direkt så en omladdning/bakåtknapp inte råkar trigga om den.
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.state?.enterApp) {
      setShowLanding(false);
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bugkritiskt: react-router byter INTE scrollposition automatiskt vid
  // navigering — utan detta kunde man t.ex. scrolla långt ner på /priser,
  // klicka till startsidan, och landa mitt i startsidan istället för högst
  // upp där hjälten faktiskt visas. Bara marknadssidorna (inte den
  // inloggade appens egna flikbyten, som redan hanterar sin egen scroll).
  useEffect(() => {
    const marketingPaths = ['/', '/funktioner', '/priser', '/om-oss', '/kontakt', '/privacy', '/terms', '/cookies'];
    if (marketingPaths.includes(location.pathname)) {
      window.scrollTo(0, 0);
    }
  }, [location.pathname]);

  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [newCompanyModal, setNewCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyOrg, setNewCompanyOrg] = useState('');
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => localStorage.getItem('bokix_onboarding_completed') === 'true');
  const [hasSkippedOnboarding, setHasSkippedOnboarding] = useState(() => localStorage.getItem('bokix_onboarding_skipped') === 'true');
  const [dbSupportsProfileColumns, setDbSupportsProfileColumns] = useState(false);
  const [supabaseEnabled, setSupabaseEnabled] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // ── Tema (ljust/mörkt) ── Sparat val vinner; annars OS-inställningen
  // (prefers-color-scheme) första gången, precis som webbläsaren själv
  // gör för formulärkontroller etc. `data-theme` sätts på <html> i
  // effekten nedan — index.css läser den attributen för att slå om hela
  // CSS-variabelpaletten (se ":root[data-theme='dark']" där).
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('bokix_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch { /* privat läge/blockerad storage — kör vidare med OS-valet */ }
    return (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('bokix_theme', theme); } catch { /* samma reservläge som ovan */ }
  }, [theme]);
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  // ── Scrollbar på/av (desktop) ── Kundönskemål: en Inställningar-växel
  // för att dölja webbläsarens synliga scrollbar på DATORN — mobilen
  // döljer sin redan ovillkorligt (se index.css @media 768px). Samma
  // spara-i-localStorage/sätt-attribut-på-<html>-mönster som temat ovan;
  // index.css läser `data-hide-scrollbar` på <html> för att slå av/på den.
  const [hideScrollbar, setHideScrollbar] = useState(() => {
    try { return localStorage.getItem('bokix_hide_scrollbar') === 'true'; }
    catch { return false; /* privat läge/blockerad storage — visa scrollbaren (standard) */ }
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-hide-scrollbar', hideScrollbar ? 'true' : 'false');
    try { localStorage.setItem('bokix_hide_scrollbar', String(hideScrollbar)); } catch { /* samma reservläge som temat */ }
  }, [hideScrollbar]);
  const toggleHideScrollbar = () => setHideScrollbar(v => !v);

  // ── Sidomenyns färg i LJUST läge ── Kundönskemål: i ljust läge är
  // sidomenyn Bokix-grön (--bg-sidebar: #3d7a2e, index.css); vissa vill
  // hellre ha samma mörka sidomeny som mörkt läge redan använder
  // (--bg-sidebar: #0c1f14) UTAN att byta hela appens tema till mörkt. Ren
  // preferens, ingen effekt i mörkt läge (sidomenyn är redan mörk där) —
  // se index.css: ":root:not([data-theme='dark'])[data-sidebar-style='dark']".
  // Samma spara-i-localStorage/sätt-attribut-på-<html>-mönster som temat/
  // scrollbaren ovan.
  const [sidebarStyle, setSidebarStyle] = useState(() => {
    try {
      const stored = localStorage.getItem('bokix_sidebar_style');
      if (stored === 'green' || stored === 'dark') return stored;
    } catch { /* privat läge/blockerad storage — kör vidare med förvalet */ }
    return 'green';
  });
  useEffect(() => {
    document.documentElement.setAttribute('data-sidebar-style', sidebarStyle);
    try { localStorage.setItem('bokix_sidebar_style', sidebarStyle); } catch { /* samma reservläge som ovan */ }
  }, [sidebarStyle]);
  const toggleSidebarStyle = () => setSidebarStyle(s => (s === 'dark' ? 'green' : 'dark'));

  // Global intent state
  const [globalAction, setGlobalAction] = useState(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({ sales: true, purchases: true, accounting: true, reports: true });
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // { message, variant } | null — se Toast.jsx samt stripe_connect-
  // useEffect nedan, som satte en blockerande alert() innan.
  const [toast, setToast] = useState(null);
  const [highlightVerificationId, setHighlightVerificationId] = useState(null);

  const toggleMenu = (menuId) => {
    setOpenMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const handleGlobalAction = (action, tab) => {
    const rTab = resolveTab(tab);
    setActiveTab(rTab);
    if (typeof window !== 'undefined') window.location.hash = rTab;
    setGlobalAction(action);
    setSidebarOpen(false);
  };

  // Close sidebar when tab changes on mobile
  const handleNavTabChange = (tabId) => {
    const rTab = resolveTab(tabId);
    setActiveTab(rTab);
    if (typeof window !== 'undefined') window.location.hash = rTab;
    setSidebarOpen(false);
  };

  // ── Helpers ──
  // Bugkritiskt: `value` kan vara en funktion (fn(prevFieldValue) => next), och
  // den MÅSTE evalueras här inne mot prev.companies[...][field] — inte mot
  // en const som lästs från render-scope innan anropet. Annars, om samma
  // fält uppdateras flera gånger synkront i samma händelse (t.ex. tre
  // handleAddVerification-anrop efter varandra vid lönebokföring), läser
  // varje anrop samma gamla värde och den sista skriver över de andra —
  // två av tre bokförda verifikationer försvann tyst på det sättet.
  const updateCompanyField = useCallback((field, value) => {
    setData(prev => {
      const company = prev.companies[prev.activeCompanyId];
      const nextFieldValue = typeof value === 'function' ? value(company[field]) : value;
      return {
        ...prev,
        companies: {
          ...prev.companies,
          [prev.activeCompanyId]: {
            ...company,
            [field]: nextFieldValue,
          },
        },
      };
    });
  }, []);

  const syncCompanyDataToBackend = useCallback(async (companyId, payload) => {
    // Mock removed to avoid 404
    return null;
  }, [])

  const loadCompanyDataFromBackend = useCallback(async (companyId) => {
    // Mock removed to avoid 404
    return null;
  }, [])

  // ── Delade företag (max 3 användare/företag — se supabase-setup.sql:
  // company_members) ──────────────────────────────────────────────────────
  // Fältlistan är importerad från api/_companyFields.js — samma källa som
  // api/company-access.js och server.js använder, inte längre en tredje
  // kopia att glömma synka. SQL-funktionen set_company_field har fortfarande
  // sin egen PL/pgSQL-vitlista (kan inte importera JS) och måste synkas dit
  // manuellt.
  const SHARED_COMPANY_WRITABLE_FIELDS = COMPANY_WRITABLE_FIELDS;

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Löser in en väntande inbjudan (se InviteRedeem.jsx, som lägger tokenet
  // här) — MÅSTE köras med en riktig, redan etablerad session (annars
  // matchar ingen RLS-policy nedan), så anropas allra först i fetchUserData
  // nedan, aldrig från Auth.jsx direkt: en nyregistrerad person har inte
  // nödvändigtvis en session förrän e-posten är bekräftad (beror på
  // projektets Supabase-inställningar), men fetchUserData körs bara när en
  // session FAKTISKT finns (SIGNED_IN eller en redan aktiv session vid
  // sidladdning) — se auth-effekten ovan.
  const PENDING_INVITE_KEY = 'bokix_pending_invite_token';
  const redeemPendingInvite = async (authUser) => {
    if (typeof window === 'undefined' || !supabaseEnabled) return;
    const token = sessionStorage.getItem(PENDING_INVITE_KEY);
    if (!token) return;
    try {
      const { data: invite } = await supabase
        .from('company_members')
        .select('id, status, expires_at')
        .eq('invite_token', token)
        .maybeSingle();
      if (!invite || invite.status !== 'pending') {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        return;
      }
      if (new Date(invite.expires_at) <= new Date()) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setToast({ message: 'Inbjudan har gått ut. Be den som bjöd in dig att skicka en ny.', variant: 'error' });
        return;
      }
      // .select('id') efter UPDATE så vi kan se OM raden faktiskt träffades
      // — RLS filtrerar tyst bort en UPDATE som inte matchar (t.ex. inloggad
      // med fel e-post) UTAN att returnera ett fel, så utan detta hade koden
      // trott att inlösen lyckades och visat en falsk "accepterad"-toast.
      const { data: redeemedRows, error: redeemError } = await supabase
        .from('company_members')
        .update({ member_user_id: authUser.id, status: 'active', redeemed_at: new Date().toISOString() })
        .eq('id', invite.id)
        .select('id');
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      if (redeemError) {
        console.error('Kunde inte lösa in inbjudan:', redeemError);
        setToast({ message: 'Kunde inte lösa in inbjudan. Kontakta den som bjöd in dig, eller att din inloggade e-postadress matchar den inbjudan skickades till.', variant: 'error' });
        return;
      }
      if (!redeemedRows || redeemedRows.length === 0) {
        console.error('Inlösen av inbjudan matchade ingen rad (fel inloggad e-post?)');
        setToast({ message: 'Kunde inte lösa in inbjudan. Kontrollera att du är inloggad med samma e-postadress som inbjudan skickades till.', variant: 'error' });
        return;
      }
      setToast({ message: 'Inbjudan accepterad — du har nu åtkomst till företaget.', variant: 'success' });
    } catch (err) {
      console.error('Fel vid inlösen av inbjudan:', err);
      sessionStorage.removeItem(PENDING_INVITE_KEY);
    }
  };

  // Hämtar varje AKTIVT delat företag (company_members, status='active',
  // member_user_id = jag) via api/company-access.js — ALDRIG genom att läsa
  // en annan users user_data-rad direkt (RLS tillåter inte det, och ska
  // inte). En inbjudan som återkallats eller vars ägare försvunnit ger bara
  // ett icke-OK svar för just den posten — hoppas tyst över (inloggningen
  // ska aldrig blockeras av EN trasig inbjudan bland flera).
  const fetchSharedCompanies = async (authUserId, accessToken) => {
    if (!accessToken) return {};
    const { data: memberships } = await supabase
      .from('company_members')
      .select('company_id, owner_user_id, role')
      .eq('member_user_id', authUserId)
      .eq('status', 'active');
    if (!memberships || memberships.length === 0) return {};

    // Parallellt, inte sekventiellt — en person som är inbjuden till FLERA
    // olika ägares företag (t.ex. en redovisningskonsult med flera kunder)
    // ska inte behöva vänta ett nätverks-tur-och-retur PER företag i följd
    // vid varje inloggning.
    const results = {};
    await Promise.all(memberships.map(async (m) => {
      try {
        const res = await fetch(`/api/company-access?company_id=${encodeURIComponent(m.company_id)}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        if (json?.company) {
          // __shared markerar företaget som INTE mitt eget — se
          // persist-effekten längre ner, som aldrig får skriva in det här i
          // min egen user_data-rad, bara via set_company_field.
          results[m.company_id] = { ...json.company, __shared: { ownerUserId: m.owner_user_id, role: json.role } };
        }
      } catch (err) {
        console.error('Kunde inte hämta delat företag', m.company_id, err);
      }
    }));
    return results;
  };

  // Läser om ETT av mina EGNA företag direkt från min egen user_data-rad
  // (tillåtet av RLS — jag läser bara min egen rad). Används bara precis
  // innan en helblobs-sparning av ett företag jag delar med andra (se
  // persist-effekten) — en färsk kopia här, istället för min ev. förlegade
  // lokala state, är det som faktiskt stänger kapplöpningen mot en samtidig
  // editor-ändring (som gick via set_company_field och alltså inte syns i
  // min lokala `data` förrän jag laddar om).
  const fetchFreshOwnCompany = async (companyId) => {
    if (!user) return null;
    const { data: row, error } = await supabase.from('user_data').select('state').eq('user_id', user.id).maybeSingle();
    if (error || !row?.state?.companies?.[companyId]) return null;
    return row.state.companies[companyId];
  };

  // Sparar ETT delat företags ändrade fält via api/company-access.js — ett
  // POST per FÄLT SOM FAKTISKT ÄNDRATS sedan förra sparningen (jämfört med
  // referenslikhet, inte djup jämförelse — fungerar eftersom
  // updateCompanyField alltid byter ut hela fältets array/objekt-referens,
  // aldrig muterar den befintliga, exakt samma mönster som resten av appen
  // redan bygger på). Rollen kollas här också (inte bara servern) rent för
  // att slippa ett garanterat-att-misslyckas nätverksanrop för en viewer —
  // den RIKTIGA spärren är ändå servern (api/company-access.js 403:ar).
  const lastPersistedSharedFieldsRef = useRef({});
  const persistSharedCompanyFields = async (companyId, companyData) => {
    if (companyData.__shared?.role !== 'editor') return;

    // Första gången det här företaget dyker upp i en sparningscykel den här
    // sessionen (precis inläst via fetchSharedCompanies) finns inget
    // "senast sparat" att jämföra mot — utan den här grenen skulle VARJE
    // fält räknas som "ändrat" (undefined !== companyData[f] för alla 18
    // fält) och POST:as i onödan, trots att inget faktiskt redigerats.
    // Etablerar bara referenspunkten, sparar ingenting.
    if (!lastPersistedSharedFieldsRef.current[companyId]) {
      lastPersistedSharedFieldsRef.current[companyId] = Object.fromEntries(
        SHARED_COMPANY_WRITABLE_FIELDS.map(f => [f, companyData[f]])
      );
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) return;

    const last = lastPersistedSharedFieldsRef.current[companyId];
    const changedFields = SHARED_COMPANY_WRITABLE_FIELDS.filter(f => companyData[f] !== last[f]);
    if (changedFields.length === 0) return;

    for (const field of changedFields) {
      try {
        const res = await fetch('/api/company-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ company_id: companyId, field, value: companyData[field] }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`Kunde inte spara ${field} för delat företag ${companyId}:`, body?.error);
          // Sparas inte in i "last" — försöks igen nästa gång effekten körs,
          // istället för att tyst ge upp på ett fält som faktiskt inte gick
          // igenom (t.ex. rollen nedgraderades till viewer mitt i sessionen).
          continue;
        }
        lastPersistedSharedFieldsRef.current[companyId] = { ...lastPersistedSharedFieldsRef.current[companyId], [field]: companyData[field] };
      } catch (err) {
        console.error(`Nätverksfel vid sparning av ${field} för delat företag ${companyId}:`, err);
      }
    }
  };

  const saveUserDataToSupabase = async (stateData, extras = {}) => {
    if (!user || !supabaseEnabled) return;

    const payload = {
      user_id: user.id,
      state: stateData,
    };

    if (dbSupportsProfileColumns) {
      Object.assign(payload, extras);
    }

    const { error } = await supabase.from('user_data').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        setSupabaseEnabled(false);
        return;
      }

      const missingColumn = String(error.message || '').toLowerCase().includes('column');
      if (missingColumn && !dbSupportsProfileColumns) {
        const fallback = await supabase.from('user_data').upsert({
          user_id: user.id,
          state: stateData,
        }, { onConflict: 'user_id' });
        if (fallback.error && isSupabaseUnavailableError(fallback.error)) {
          setSupabaseEnabled(false);
        }
      } else {
        console.error('Supabase save error:', error);
      }
    }
  };

  // Auth effect
  useEffect(() => {
    // Failsafe: never hang forever on loading screen
    const loadingTimeout = setTimeout(() => {
      setIsLoadingAuth(false);
    }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        // Bugkritiskt (kodgranskning/Playwright-test): en klickad
        // återställningslänk ger ocksa en "riktig" (om än tillfällig)
        // session redan HÄR, innan den separata onAuthStateChange-
        // lyssnaren längre ner ens hinner reagera på sitt eget
        // PASSWORD_RECOVERY-event. Utan den här kollen anropade koden
        // fetchUserData rakt av för VILKEN session som helst — vilket för
        // en kund med utgången prov-/uppsagd prenumeration satte
        // subscriptionGate='blocked' INNAN passwordRecovery ens hunnit bli
        // sant, och render-ordningen (se ternary-kedjan längre ner) räckte
        // inte ensam: state:t fastnade på "blocked" permanent eftersom
        // inget senare någonsin nollställer det. Samma hash-baserade
        // detektering som AppRouter.jsx:s shouldLoadAppImmediately redan
        // använder — om länken är en återställningslänk, hoppa över
        // fetchUserData HELT här och lita på PASSWORD_RECOVERY-eventet
        // nedan istället.
        const isPasswordRecoveryUrl = /type=recovery/.test(window.location.hash || '');
        if (isPasswordRecoveryUrl) {
          clearTimeout(loadingTimeout);
          setIsLoadingAuth(false);
        } else if (session?.user) {
          fetchUserData(session.user);
        } else {
          clearTimeout(loadingTimeout);
          setIsLoadingAuth(false);
        }
      })
      .catch(err => {
        console.error('Session error:', err);
        clearTimeout(loadingTimeout);
        setIsLoadingAuth(false);
      });

    // Bugkritiskt: `onAuthStateChange` triggar inte bara på en riktig
    // inloggning — den kör lika gärna vid TOKEN_REFRESHED (Supabase byter
    // ut access-token automatiskt i bakgrunden, bland annat så fort fliken
    // återfår fokus) och USER_UPDATED (t.ex. när Inställningar sparar
    // förnamn/avatar). Innan denna guard anropade koden `fetchUserData` på
    // ALLA dessa händelser — vilket läste in det SENAST SPARADE
    // molntillståndet och skrev över `data` rakt av. Om det hände inom den
    // 2-sekunders debounce-fönstret för sparning (se persist-effekten
    // nedan) hann den nya kunden/fakturan aldrig sparas OCH försvann ur
    // vyn i samma veva — ett tyst dataförlust-scenario som lätt kunde
    // träffas bara genom att växla flik och komma tillbaka mitt i jobbet.
    // `fetchUserData` ska bara köras vid en FAKTISK ny inloggning.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        loadedUserIdRef.current = null;
        setIsLoggedIn(false);
        setShowOnboarding(false);
        setSubscriptionGate(null);
      } else if (event === 'PASSWORD_RECOVERY') {
        // Klickad återställningslänk (Auth.jsx: "Glömt lösenord?") —
        // Supabase loggar in med en TILLFÄLLIG session från själva länken,
        // men det ska aldrig räcka för att komma in i appen med det gamla
        // lösenordet fortfarande kvar. fetchUserData körs INTE här (det är
        // bara 'SIGNED_IN' ovan som gör det) — se passwordRecovery-state:t
        // och PasswordRecoveryScreen.
        setPasswordRecovery(true);
      } else if (event === 'SIGNED_IN') {
        // Kodgranskning/Playwright-test: en klickad återställningslänk kan
        // trigga BÅDE PASSWORD_RECOVERY och SIGNED_IN (ordningen mellan
        // supabase-js-events är inte garanterad) — utan den här kollen
        // kunde SIGNED_IN-grenen köra fetchUserData rakt över
        // PASSWORD_RECOVERY-grenens redan satta passwordRecovery=true,
        // exakt samma "hamnar på betalningsspärren istället för
        // återställningsformuläret"-bugg som mount-effektens getSession()
        // ovan redan skyddas mot. Samma hash-kontroll här.
        if (/type=recovery/.test(window.location.hash || '')) return;
        // Se loadedUserIdRef-kommentaren ovan: den här fliken har redan en
        // annan (eller ingen) användare inläst sedan tidigare. Skiljer
        // mellan "första inloggningen i den här fliken" (loadedUserIdRef
        // fortfarande null, kör fetchUserData som vanligt, oförändrat) och
        // "ett ANNAT konto loggades in i en annan flik" (kör bara en hård
        // omladdning istället — den enda garanterat race-fria vägen: den
        // här fliken monteras om helt från scratch och läser precis den
        // session som faktiskt ligger i localStorage NU, ingen kvarbliven
        // state, ingen kapplöpning mellan två samtidiga fetchUserData).
        if (loadedUserIdRef.current && loadedUserIdRef.current !== session.user.id) {
          window.location.reload();
          return;
        }
        fetchUserData(session.user);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (authUser) => {
    // Se loadedUserIdRef-kommentaren vid subscriptionGate ovan — satt HÄR,
    // innan något asynkront ens hinner starta, så en cross-tab SIGNED_IN
    // för ett annat konto som hinner före upptäcks av nästa jämförelse.
    loadedUserIdRef.current = authUser.id;
    try {
      // MFA-spärr — se kommentaren vid mfaChallenge ovan. Körs FÖRST, före
      // allt annat (även demo-läget nedan har en riktig Supabase-session
      // bakom sig när supabaseEnabled är sant, så kollen gäller lika mycket
      // där). currentLevel === nextLevel för alla utan aktiverad 2FA —
      // no-op för de allra flesta inloggningarna.
      if (supabaseEnabled) {
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aal && aal.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
          const { data: factorsData } = await supabase.auth.mfa.listFactors();
          const factor = factorsData?.totp?.[0];
          if (factor) {
            const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
            if (!challengeError && challenge) {
              setMfaChallenge({ factorId: factor.id, challengeId: challenge.id });
              setIsLoadingAuth(false);
              return; // Väntar på kod — resten av inloggningen pausas här.
            }
          }
        }
      }

      if (!supabaseEnabled) {
        const cached = loadDataForUser(authUser.id) ?? blankData();
        setData(cached);
        setHasCompletedOnboarding(localStorage.getItem('bokix_onboarding_completed') === 'true');
        setHasSkippedOnboarding(localStorage.getItem('bokix_onboarding_skipped') === 'true');
        setIsLoggedIn(true);
        setIsLoadingAuth(false);
        return;
      }

      // Löser in en väntande inbjudan (om någon finns, se InviteRedeem.jsx)
      // INNAN vi ens frågar efter delade företag nedan — annars skulle en
      // nyss inlöst inbjudan inte synas förrän NÄSTA inloggning.
      await redeemPendingInvite(authUser);

      // ── Delade företag (company_members) — hämtas FÖRE betalspärren, för
      // att en inbjuden användare utan egen prenumeration aldrig ska
      // blockeras: de rider på ÄGARENS aktiva prenumeration, se
      // hasSharedAccess-villkoret nedan. ──
      const sessionForAccessToken = supabaseEnabled ? (await supabase.auth.getSession()).data.session : null;
      const sharedCompanies = supabaseEnabled
        ? await fetchSharedCompanies(authUser.id, sessionForAccessToken?.access_token)
        : {};
      const hasSharedAccess = Object.keys(sharedCompanies).length > 0;

      // ── Betalspärr: en inloggad Supabase-användare får bara in i appen med
      // en giltig prenumeration (trialing/active/past_due — past_due är
      // Stripes egen automatiska betalningsomförsök, inte samma sak som
      // uppsagd) ELLER minst ett aktivt delat företag (se ovan — de betalar
      // aldrig separat, de rider på ägarens prenumeration). Kollas FÖRE all
      // annan datainhämtning nedan, så ett blockerat konto aldrig hinner se
      // sina egna företagsdata ens kort. ──
      const ALLOWED_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];
      const fetchSubscriptionStatus = async () => {
        const { data } = await supabase
          .from('subscriptions')
          .select('status')
          .eq('user_id', authUser.id)
          .maybeSingle();
        return data;
      };

      let subRow = await fetchSubscriptionStatus();

      // Precis kommen tillbaka från en lyckad Stripe Checkout
      // (?subscription_checkout=success, se Auth.jsx/create-subscription-
      // checkout.js) — webhooken (customer.subscription.created) kan hinna
      // efter med några sekunder. Väntar in den istället för att blockera
      // någon som precis betalade, max ~9 sekunder innan vi ger upp. En
      // inbjuden användare med hasSharedAccess väntar aldrig in det här —
      // de har redan sin väg in.
      const justSubscribed = initialSubscriptionCheckoutParam === 'success';
      if (!hasSharedAccess && justSubscribed && (!subRow || !ALLOWED_SUBSCRIPTION_STATUSES.includes(subRow.status))) {
        for (let attempt = 0; attempt < 6 && (!subRow || !ALLOWED_SUBSCRIPTION_STATUSES.includes(subRow.status)); attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          subRow = await fetchSubscriptionStatus();
        }
      }

      if (!hasSharedAccess && (!subRow || !ALLOWED_SUBSCRIPTION_STATUSES.includes(subRow.status))) {
        setSubscriptionGate('blocked');
        setIsLoadingAuth(false);
        return;
      }
      setSubscriptionGate(null);

      // Mina EGNA företag som JAG delar med andra (company_members,
      // owner_user_id = jag, status='active') — taggas __hasActiveMembers
      // nedan så persist-effekten vet att den måste läsa om just DE
      // företagen precis innan varje helblobs-sparning (se
      // fetchFreshOwnCompany/persist-effekten) istället för att lita blint
      // på min lokala, ev. förlegade kopia.
      const { data: ownedMemberships } = supabaseEnabled
        ? await supabase.from('company_members').select('company_id').eq('owner_user_id', authUser.id).eq('status', 'active')
        : { data: null };
      const ownedSharedCompanyIds = new Set((ownedMemberships || []).map(m => m.company_id));

      const { data: dbData, error } = await supabase
        .from('user_data')
        .select('state,onboarding_completed,onboarding_skipped,company_name,company_orgnr,contact_details,company_settings')
        .eq('user_id', authUser.id)
        .maybeSingle();

      let resultData = dbData;
      if (error) {
        if (isSupabaseUnavailableError(error)) {
          setSupabaseEnabled(false);
          const cached = loadDataForUser(authUser.id) ?? blankData();
          setData(cached);
          setHasCompletedOnboarding(localStorage.getItem('bokix_onboarding_completed') === 'true');
          setHasSkippedOnboarding(localStorage.getItem('bokix_onboarding_skipped') === 'true');
          setIsLoggedIn(true);
          setIsLoadingAuth(false);
          return;
        }

        const fallback = await supabase
          .from('user_data')
          .select('state')
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (fallback.error && fallback.error.code !== 'PGRST116' && !isSupabaseUnavailableError(fallback.error)) {
          console.error('Error fetching data:', fallback.error);
        }

        if (isSupabaseUnavailableError(fallback.error)) {
          setSupabaseEnabled(false);
          const cached = loadDataForUser(authUser.id) ?? blankData();
          setData(cached);
          setHasCompletedOnboarding(localStorage.getItem('bokix_onboarding_completed') === 'true');
          setHasSkippedOnboarding(localStorage.getItem('bokix_onboarding_skipped') === 'true');
          setIsLoggedIn(true);
          setIsLoadingAuth(false);
          return;
        }

        resultData = fallback.data;
      } else {
        setDbSupportsProfileColumns(true);
      }

      if (resultData && resultData.state) {
        const backendState = await loadCompanyDataFromBackend(resultData.state.activeCompanyId);
        // normalizeStore: samma engångsmigrering av offerter/fakturor som
        // loadData() kör för localStorage-vägen — måste köras här också,
        // annars stannar ett Supabase-konto kvar på den gamla delade listan
        // för evigt eftersom den vägen aldrig går via loadData().
        const resolvedState = normalizeStore(backendState || resultData.state);
        // Taggar mina EGNA företag som har aktiva delningar (se ovan) och
        // slår in de företag jag är INBJUDEN till (hämtade via
        // api/company-access.js, aldrig från min egen rad — se
        // fetchSharedCompanies). Om activeCompanyId råkar peka på ett delat
        // företag löser det sig automatiskt här, eftersom det nu finns med
        // i companies igen.
        Object.keys(resolvedState.companies || {}).forEach(id => {
          if (ownedSharedCompanyIds.has(id)) {
            resolvedState.companies[id] = { ...resolvedState.companies[id], __hasActiveMembers: true };
          }
        });
        resolvedState.companies = { ...resolvedState.companies, ...sharedCompanies };
        setData(resolvedState);
        const completed = Boolean(resultData.onboarding_completed);
        const skipped = Boolean(resultData.onboarding_skipped);
        setHasCompletedOnboarding(completed);
        setHasSkippedOnboarding(skipped);
        localStorage.setItem('bokix_onboarding_completed', String(completed));
        localStorage.setItem('bokix_onboarding_skipped', String(skipped));
        await syncCompanyDataToBackend(resolvedState.activeCompanyId, resolvedState);
        setIsLoggedIn(true);
      } else if (hasSharedAccess) {
        // Ingen egen user_data-rad ännu (aldrig skapat ett eget företag),
        // men minst ett aktivt delat företag — vanligast för en nyinbjuden
        // person utan tidigare Bokix-konto. Skapar INGEN egen rad/blankt
        // företag här (till skillnad från grenen nedan) — den personen
        // behöver inget eget företag bara för att logga in och redigera
        // det de blivit inbjudna till, och en spurious tom user_data-rad
        // hade bara varit förvirrande om de senare skapar sitt EGET företag.
        const firstSharedId = Object.keys(sharedCompanies)[0];
        setData({ activeCompanyId: firstSharedId, companies: sharedCompanies });
        setHasCompletedOnboarding(true);
        setHasSkippedOnboarding(true);
        setIsLoggedIn(true);
      } else {
        // First login, create blank company data based on metadata
        const metadata = authUser.user_metadata || {};
        const newData = createEmptyCompanyData({
          name: metadata.company_name || 'Mitt Företag AB',
          orgNr: metadata.org_nr || ''
        });
        const initialStore = {
          activeCompanyId: newData.company.id,
          companies: { [newData.company.id]: newData },
        };
        setData(initialStore);

        await syncCompanyDataToBackend(initialStore.activeCompanyId, initialStore);

        await saveUserDataToSupabase(initialStore, {
          onboarding_completed: false,
          onboarding_skipped: false,
          company_name: newData.company.name,
          company_orgnr: newData.company.orgNr,
          contact_details: {
            email: newData.company.email,
            phone: newData.company.phone,
            address: newData.company.address,
          },
          company_settings: {
            fiscalYear: newData.company.fiscalYear,
            vatPeriod: 'quarterly',
            chartPlan: 'bas2025',
          },
        });

        localStorage.setItem('bokix_onboarding_completed', 'false');
        localStorage.setItem('bokix_onboarding_skipped', 'false');
        setIsLoggedIn(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  // MFA-verifiering (MfaChallengeScreen ovan). Fel kod kastar ett fel som
  // skärmen själv visar — hämtar samtidigt en NY challenge, eftersom en
  // redan felaktig challengeId inte går att återanvända för nästa försök.
  const handleMfaVerify = async (code) => {
    if (!mfaChallenge) return;
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaChallenge.factorId,
      challengeId: mfaChallenge.challengeId,
      code,
    });
    if (error) {
      const { data: retry } = await supabase.auth.mfa.challenge({ factorId: mfaChallenge.factorId });
      if (retry) setMfaChallenge({ factorId: mfaChallenge.factorId, challengeId: retry.id });
      throw new Error('Fel kod. Försök igen.');
    }
    // Bugkritiskt (kundfeedback): mellan att `mfaChallenge` nollställs här
    // och att `fetchUserData` nedan hinner sätta `isLoggedIn(true)` fanns
    // ett kort men fullt renderat mellanläge — mfaChallenge null OCH
    // isLoggedIn fortfarande false — som föll rakt in i !isLoggedIn-grenen
    // (Landing/Auth). Användaren såg alltså landningssidan blinka till
    // innan dashboarden laddades, trots rätt kod. `isLoadingAuth(true)` här
    // stänger det gapet med samma "Laddar Bokix…"-spinner som normal
    // inloggning använder (se `if (isLoadingAuth) return …` längre ner) —
    // fetchUserData sätter själv isLoadingAuth(false) när den är klar.
    setMfaChallenge(null);
    setIsLoadingAuth(true);
    if (user) fetchUserData(user);
  };

  const handleMfaCancel = async () => {
    await supabase.auth.signOut();
    clearLocalData();
    setMfaChallenge(null);
    setIsLoggedIn(false);
  };

  // Lösenordsåterställning (PasswordRecoveryScreen ovan). Kastar vidare ett
  // fel om updateUser misslyckas — skärmen visar det själv, samma mönster
  // som handleMfaVerify.
  const handleSetNewPassword = async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    // Samma isLoadingAuth-brygga som handleMfaVerify använder: utan den
    // hinner ett kort ögonblick (passwordRecovery redan false, isLoggedIn
    // fortfarande false) falla igenom till !isLoggedIn-grenen och blinka
    // till Auth-skärmen innan fetchUserData hinner sätta isLoggedIn(true).
    setPasswordRecovery(false);
    setIsLoadingAuth(true);
    if (user) fetchUserData(user);
  };

  const handlePasswordRecoveryCancel = async () => {
    await supabase.auth.signOut();
    clearLocalData();
    setPasswordRecovery(false);
    setIsLoggedIn(false);
  };

  useEffect(() => {
    if (!isLoggedIn || isLoadingAuth) return;
    // Onboarding is handled during account creation - always skip it here
    setShowOnboarding(false);
  }, [isLoggedIn, isLoadingAuth]);

  // Läs av statusflaggan Stripe-callbacken skickar tillbaka
  // (?stripe_connect=connected|cancelled|error|not_configured) och visa ett
  // meddelande — sedan bort med parametern ur URL:en så en omladdning inte
  // visar den igen. Ingen känslig data i URL:en, bara statusordet.
  //
  // Bugkritiskt: måste stå INNAN `if (isLoadingAuth) return ...` nedan —
  // en hook efter en villkorlig early return anropas bara på vissa
  // renderingar, vilket bryter Reacts regel att samma hooks måste anropas
  // i samma ordning varje gång ("Rendered more hooks than during the
  // previous render").
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('stripe_connect');
    if (!status) return;

    const messages = {
      connected: 'Stripe är nu anslutet till Bokix.',
      cancelled: 'Anslutningen avbröts, du kan försöka igen när du vill.',
      error: 'Något gick fel vid Stripe-anslutningen. Försök igen, eller kontakta support om felet kvarstår.',
      not_configured: 'Stripe-anslutning är inte konfigurerad ännu. Kontakta support.',
    };
    const variants = { connected: 'success', cancelled: 'info', error: 'error', not_configured: 'info' };
    const debugDetail = params.get('debug'); // temporärt diagnos-fält, se api/stripe/callback.js
    setToast({
      message: (messages[status] || messages.error) + (debugDetail ? ` (${debugDetail})` : ''),
      variant: variants[status] || 'error',
    });

    params.delete('stripe_connect');
    params.delete('debug');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash);
  }, []);

  // Samma mönster som stripe_connect-useEffect ovan, för Zettle (api/zettle/
  // callback.js). Egen useEffect (inte samma som Stripe-varianten) så en
  // status-parameter aldrig kan förväxlas med den andra leverantörens.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('zettle_connect');
    if (!status) return;

    const messages = {
      connected: 'Zettle är nu anslutet till Bokix.',
      cancelled: 'Anslutningen avbröts, du kan försöka igen när du vill.',
      error: 'Något gick fel vid Zettle-anslutningen. Försök igen, eller kontakta support om felet kvarstår.',
    };
    const variants = { connected: 'success', cancelled: 'info', error: 'error' };
    const debugDetail = params.get('debug'); // temporärt diagnos-fält, se api/zettle/callback.js
    setToast({
      message: (messages[status] || messages.error) + (debugDetail ? ` (${debugDetail})` : ''),
      variant: variants[status] || 'error',
    });

    params.delete('zettle_connect');
    params.delete('debug');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash);
  }, []);

  // Samma mönster som stripe_connect-useEffect ovan, för registreringens
  // Stripe-betalningssteg (Auth.jsx → create-subscription-checkout.js).
  // "success" betyder bara att kortet lades till och provperioden startade
  // i Stripe Checkout — inget vi behöver invänta här, webhooken
  // (customer.subscription.created) sätter den faktiska statusen separat.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get('subscription_checkout');
    if (!status) return;

    const messages = {
      success: 'Klart! 30 dagar gratis, sedan 99 kr/mån. Logga in för att komma igång.',
      cancelled: 'Betalningen avbröts — kontot är skapat, men provperioden startar först när betalningsuppgifter är tillagda. Logga in och försök igen.',
    };
    setToast({
      message: messages[status] || messages.cancelled,
      variant: status === 'success' ? 'success' : 'info',
    });

    params.delete('subscription_checkout');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash);
  }, []);

  // Persist
  useEffect(() => {
    // Taggar cachen med den inloggade användaren (se loadDataForUser/
    // STORAGE_OWNER_KEY-kommentaren ovan) — utan user (mock-/demo-läge)
    // sparas den precis som förut, otaggad.
    saveData(data, user?.id);

    const timeoutIds = [];

    if (data?.activeCompanyId) {
      timeoutIds.push(setTimeout(() => {
        syncCompanyDataToBackend(data.activeCompanyId, data);
      }, 600));
    }

    // Sync to Supabase debounced — this is the actual persistence path;
    // it must always run for a logged-in user, independent of the
    // (currently no-op) per-company sync above.
    //
    // Delade företag (company_members): `data.companies` kan innehålla en
    // BLANDNING av mina EGNA företag och företag jag bara är INBJUDEN till
    // (__shared) — en person kan äga sitt eget företag OCH samtidigt vara
    // t.ex. redovisningskonsult åt någon annans. De två sorterna sparas helt
    // olika, aldrig genom samma anrop:
    //   1) __shared-företag sparas ALDRIG i min egen user_data-rad (data
    //      hör hemma hos ägaren) — ett fält i taget via
    //      persistSharedCompanyFields (api/company-access.js).
    //   2) Mina EGNA företag sparas som förut, en helblobs-upsert — MEN om
    //      jag själv har delat ett av dem med andra (__hasActiveMembers),
    //      läses just DET företaget om FÄRSKT precis innan skrivningen
    //      (fetchFreshOwnCompany) istället för att lita på min ev.
    //      förlegade lokala kopia — annars skulle min egen periodiska
    //      sparning kunna tysta skriva över en samtidig editors ändring som
    //      gick via spår (1) ovan sekunder tidigare. Se kommentaren vid
    //      set_company_field i supabase-setup.sql för samma resonemang från
    //      andra hållet.
    if (user && isLoggedIn) {
      timeoutIds.push(setTimeout(async () => {
        const entries = Object.entries(data.companies || {});
        const sharedEntries = entries.filter(([, c]) => c.__shared);
        const ownEntries = entries.filter(([, c]) => !c.__shared);

        await Promise.all(sharedEntries.map(([id, c]) => persistSharedCompanyFields(id, c)));

        const ownCompanies = {};
        await Promise.all(ownEntries.map(async ([id, c]) => {
          ownCompanies[id] = c.__hasActiveMembers ? ((await fetchFreshOwnCompany(id)) || c) : c;
        }));
        await saveUserDataToSupabase({ ...data, companies: ownCompanies });
      }, 2000));
    }

    return () => timeoutIds.forEach(clearTimeout);
  }, [data, user, isLoggedIn, syncCompanyDataToBackend]);

  // ── Avstämning av Stripe-betalningshändelser ────────────────────────────
  // Se den långa kommentaren ovanför stripe_payment_events i
  // supabase-setup.sql för varför det här steget finns: webhooken (webhook.js/
  // server.js) skriver ALDRIG "betald" direkt in i den delade state-blobben
  // (klientens egen debounce-save skulle kunna skriva över det igen), utan
  // bara en hållbar loggrad. Klienten hämtar sina egna oapplicerade
  // händelser här och applicerar dem genom det VANLIGA betalningsflödet
  // (handleRegisterInvoicePayment) — så det blir en del av klientens eget
  // state INNAN nästa debounce-save, precis som en manuell "Markera betald".
  //
  // Bara det just nu aktiva företagets fakturor kan matchas (invoices-arrayen
  // i minnet tillhör bara data.activeCompanyId) — händelser för andra företag
  // lämnas oapplicerade och stäms av nästa gång DET företaget är aktivt.
  // Medvetet enkel avvägning: körs en gång per inloggning/företagsbyte, inte
  // en realtids-prenumeration (ingen sådan finns i appen ännu).
  //
  // Bugkritiskt: måste stå INNAN `if (isLoadingAuth) return ...` längre ner
  // (samma regel som stripe_connect-useEffect ovan) — annars anropas hooken
  // bara på vissa renderingar och bryter Reacts hooks-ordning.
  useEffect(() => {
    if (!user || !supabaseEnabled || !data.activeCompanyId) return;
    let cancelled = false;

    (async () => {
      const { data: events, error } = await supabase
        .from('stripe_payment_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', data.activeCompanyId)
        .is('applied_at', null);

      if (error || cancelled || !events?.length) return;

      for (const event of events) {
        const invoiceExists = invoices.some(i => i.id === event.invoice_id);
        // Fakturan kan redan ha markerats betald manuellt innan webhooken
        // hann fram (handleRegisterInvoicePayment är själv ett no-op om
        // inget återstår) — kvitteras ändå som applicerad, den ska inte
        // dyka upp och försöka appliceras om och om igen.
        if (invoiceExists && event.amount_total) {
          handleRegisterInvoicePayment(event.invoice_id, event.amount_total, event.paid_at?.split('T')[0]);
        }
        await supabase.from('stripe_payment_events').update({ applied_at: new Date().toISOString() }).eq('id', event.id);
      }
    })();

    return () => { cancelled = true; };
  }, [user, supabaseEnabled, data.activeCompanyId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => {
      setIsProfileMenuOpen(false);
      setIsNotifMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleLogin = (companyInfo, isNew) => {
    // Auth component now handles Supabase calls. We just rely on onAuthStateChange.
  };

  const handleSwitchCompany = (companyId) => {
    if (!data.companies[companyId] || companyId === data.activeCompanyId) return;
    setData(prev => ({ ...prev, activeCompanyId: companyId }));
    setActiveTab('dashboard');
    if (typeof window !== 'undefined') window.location.hash = 'dashboard';
  };

  const handleCreateCompany = () => {
    const name = newCompanyName.trim();
    if (!name) return;

    const newCompanyData = createEmptyCompanyData({
      name,
      orgNr: newCompanyOrg.trim(),
    });

    setData(prev => ({
      ...prev,
      activeCompanyId: newCompanyData.company.id,
      companies: {
        ...prev.companies,
        [newCompanyData.company.id]: newCompanyData,
      },
    }));
    setNewCompanyName('');
    setNewCompanyOrg('');
    setNewCompanyModal(false);
    setActiveTab('dashboard');
  };

  const handleOnboardingComplete = async (profile) => {
    const name = profile.companyName?.trim() || company.name || 'Mitt Företag AB';
    const nextState = {
      ...data,
      companies: {
        ...data.companies,
        [data.activeCompanyId]: {
          ...data.companies[data.activeCompanyId],
          company: {
            ...data.companies[data.activeCompanyId].company,
            name,
            orgNr: profile.orgNr || data.companies[data.activeCompanyId].company.orgNr,
            address: profile.address || data.companies[data.activeCompanyId].company.address,
            email: profile.email || data.companies[data.activeCompanyId].company.email,
            phone: profile.phone || data.companies[data.activeCompanyId].company.phone,
            logoUrl: profile.logoUrl || data.companies[data.activeCompanyId].company.logoUrl,
            fiscalYear: profile.fiscalYear || data.companies[data.activeCompanyId].company.fiscalYear,
            vatPeriod: profile.vatPeriod || data.companies[data.activeCompanyId].company.vatPeriod,
            chartPlan: profile.chartPlan || data.companies[data.activeCompanyId].company.chartPlan || 'bas2025',
          },
        },
      },
    };

    setData(nextState);
    setHasCompletedOnboarding(true);
    setHasSkippedOnboarding(false);
    setShowOnboarding(false);
    setActiveTab('dashboard');
    localStorage.setItem('bokix_onboarding_completed', 'true');
    localStorage.setItem('bokix_onboarding_skipped', 'false');

    await saveUserDataToSupabase(nextState, {
      onboarding_completed: true,
      onboarding_skipped: false,
      company_name: name,
      company_orgnr: profile.orgNr || data.companies[data.activeCompanyId].company.orgNr,
      contact_details: {
        email: profile.email || data.companies[data.activeCompanyId].company.email,
        phone: profile.phone || data.companies[data.activeCompanyId].company.phone,
        address: profile.address || data.companies[data.activeCompanyId].company.address,
      },
      company_settings: {
        fiscalYear: profile.fiscalYear || data.companies[data.activeCompanyId].company.fiscalYear,
        vatPeriod: profile.vatPeriod || data.companies[data.activeCompanyId].company.vatPeriod,
        chartPlan: profile.chartPlan || data.companies[data.activeCompanyId].company.chartPlan || 'bas2025',
      },
    });
  };

  const handleSkipOnboarding = async () => {
    setShowOnboarding(false);
    setHasSkippedOnboarding(true);
    localStorage.setItem('bokix_onboarding_skipped', 'true');

    await saveUserDataToSupabase(data, {
      onboarding_skipped: true,
      onboarding_completed: false,
    });
  };

  if (isLoadingAuth) {
    // Tidigare stod en felsökningstext ("Kontrollera att Supabase-nycklar
    // är inlagda") här permanent, synlig för alla vid varje sidladdning —
    // en intern debug-notering som aldrig skulle vara användarvänd.
    // Visade tidigare bara en ensam snurrande cirkel mitt på en tom sida —
    // ersatt med en skelettsiluett av sidan man är på väg in i (sidomeny +
    // topbar + Startsidans kort/graf/lista), se AppLoadingSkeleton ovan.
    return <AppLoadingSkeleton tab={activeTab} />;
  }

  // Current company data
  const currentCompany = data.companies[data.activeCompanyId];
  const company = currentCompany.company;
  const accounts = currentCompany.accounts;
  const verifications = currentCompany.verifications;
  const invoices = currentCompany.invoices;
  // `|| []` som skyddsnät: ett företag inloggat sedan innan denna migrering
  // och som ännu inte hunnit spara/ladda om kan sakna fältet ett ögonblick.
  const quotes = currentCompany.quotes || [];
  const expenses = currentCompany.expenses;
  const contacts = currentCompany.contacts;
  // `|| []`: samma skyddsnät som quotes ovan — fältet finns inte i sparad
  // data för konton skapade innan artikelregistret fanns.
  const articles = currentCompany.articles || [];
  const projects = currentCompany.projects || [];
  const verificationTemplates = currentCompany.verificationTemplates || [];
  const vatPeriods = currentCompany.vatPeriods || {};
  const reviewHistory = currentCompany.reviewHistory || [];
  const employees = currentCompany.employees || [];
  const payrollRuns = currentCompany.payrollRuns || [];
  const timeEntries = currentCompany.timeEntries || [];
  const timeReportStatuses = currentCompany.timeReportStatuses || [];
  // Separat från `timeEntries` (Projekt-fliken, "hur mycket tid gick åt på
  // projekt X") — det här är Tidrapporterings-sidans egna poster (kund att
  // fakturera ELLER anställd att lönebasera), en annan fråga än
  // projektlönsamhet. Att blanda dem i samma array skulle antingen läcka
  // faktureringsposter in i projektveckorutnätet (märkta "Okänt projekt")
  // eller kräva att Projekt-fliken filtrerar bort dem — enklare och
  // säkrare att hålla isär dem.
  const billableTimeEntries = currentCompany.billableTimeEntries || [];
  const recurringTemplates = currentCompany.recurringTemplates || [];

  // ── Helpers ──
  // Bugkritiskt: skicka `fn` rakt igenom till updateCompanyField istället för
  // att evaluera den här mot en const läst från render-scope (t.ex.
  // `verifications`) — annars ser flera synkrona anrop av samma setter i
  // samma händelse alla samma gamla värde, och bara det sista anropets
  // resultat sparas (se kommentar vid updateCompanyField för hela historien).
  const setAccounts = (fn) => updateCompanyField('accounts', fn);
  const setVerifications = (fn) => updateCompanyField('verifications', fn);
  const setInvoices = (fn) => updateCompanyField('invoices', fn);
  const setQuotes = (fn) => updateCompanyField('quotes', (prev) => (typeof fn === 'function' ? fn(prev || []) : fn));
  const setExpenses = (fn) => updateCompanyField('expenses', fn);
  const setContacts = (fn) => updateCompanyField('contacts', fn);
  const setArticles = (fn) => updateCompanyField('articles', (prev) => (typeof fn === 'function' ? fn(prev || []) : fn));
  const setProjects = (fn) => updateCompanyField('projects', fn);
  const setEmployees = (fn) => updateCompanyField('employees', fn);
  const setPayrollRuns = (fn) => updateCompanyField('payrollRuns', fn);
  const setTimeEntries = (fn) => updateCompanyField('timeEntries', fn);
  const setTimeReportStatuses = (fn) => updateCompanyField('timeReportStatuses', fn);
  const setBillableTimeEntries = (fn) => updateCompanyField('billableTimeEntries', fn);
  const setRecurringTemplates = (fn) => updateCompanyField('recurringTemplates', fn);

  const handleSaveVerificationTemplate = ({ name, description, projectId, costCenter, rows }) => {
    updateCompanyField('verificationTemplates', [
      ...verificationTemplates,
      { id: `tpl_${Date.now()}`, name, description, projectId, costCenter, rows },
    ]);
  };

  // Bokför en moms-period mot 2650 (Sida 11, Steg 3). Spärrad mot
  // dubbelbokföring — om perioden redan finns i vatPeriods görs ingenting.
  const handleBookVatPeriod = ({ periodKey, periodStart, periodEnd, quarter, year, rounded }) => {
    if (vatPeriods[periodKey]) return; // redan bokförd — förhindrar dubbelklick/dubbelbokföring
    const verRows = [];
    [25, 12, 6].forEach(rate => {
      const amount = rounded.outputVatByRate[rate];
      if (amount) verRows.push({ account: { 25: '2611', 12: '2612', 6: '2613' }[rate], debet: Math.round(amount), kredit: 0 });
    });
    if (rounded.inputVat) verRows.push({ account: '2641', debet: 0, kredit: Math.round(rounded.inputVat) });
    if (rounded.netToPay > 0) verRows.push({ account: '2650', debet: 0, kredit: Math.round(rounded.netToPay) });
    else if (rounded.netToPay < 0) verRows.push({ account: '2650', debet: Math.round(-rounded.netToPay), kredit: 0 });

    const verId = `ver_vat_${periodKey}_${Date.now()}`;
    handleAddVerification({
      date: new Date().toISOString().split('T')[0],
      description: `Momsdeklaration ${periodKey}`,
      source: 'vat_declaration',
      sourceId: verId,
      rows: verRows,
    });

    updateCompanyField('vatPeriods', {
      ...vatPeriods,
      [periodKey]: { periodStart, periodEnd, quarter, year, bookedAt: new Date().toISOString(), netToPay: rounded.netToPay },
    });
  };

  // Hoppa direkt till en verifikation från momsdeklarationens felposter (Steg 1)
  const handleNavigateToVerification = (id) => {
    handleNavTabChange('verifications');
    setHighlightVerificationId(id);
  };

  const setCompanyInfo = (fn) => updateCompanyField('company', fn);

  // Calculate account balances
  const getAccountBalances = () => {
    const balances = {};
    accounts.forEach(acc => { balances[acc.code] = 0; });
    verifications.forEach(ver => {
      // Utkast är inte bokförda ännu — de ska inte påverka riktiga saldon,
      // Dashboard-nyckeltal eller rapporter förrän de faktiskt bokförs.
      if ((ver.status || 'booked') === 'draft') return;
      ver.rows.forEach(row => {
        const val = getDebet(row) - getKredit(row);
        if (balances[row.account] !== undefined) {
          balances[row.account] += val;
        } else {
          balances[row.account] = val;
        }
      });
    });
    return balances;
  };

  const balances = getAccountBalances();

  // Klassiskt Stripe Connect OAuth ("Standard"-konton) — hela poängen är
  // fortfarande att lämna Bokix och landa på Stripes egen hostade sida,
  // men själva starten är nu ett autentiserat POST-anrop (säkerhetsfix,
  // se api/stripe/connect.js) istället för en ren länk-navigering:
  // en GET med bara user_id/company_id i URL:en gick tidigare att avfyra
  // för VILKEN användare/företag som helst, utan att verifiera vem som
  // faktiskt klickade — kunde koppla en angripares Stripe-konto till
  // någon annans Bokix-företag. Backend sköter state-generering och
  // cookien precis som förut, bara returnerar adressen som JSON istället
  // för att själv göra 302:an, så vi kan skicka med sessionens token.
  //
  // /api/stripe/connect (inte /oauth-start längre) — start och disconnect
  // slogs ihop till en fil för att göra plats under Vercels 12-funktions-
  // gräns (Hobby), se filkommentaren i connect.js. action: 'start' väljer
  // grenen.
  // reauthToken (Settings.jsx: Betalning-flikens ReauthCodeStep, se den
  // filens kommentar vid "Ta emot kortbetalningar") — vem som helst med en
  // kapad browser-session skulle annars kunna koppla om vart pengarna går
  // med bara ett klick. connect.js:s handler avvisar anropet med 403 om
  // token:en saknas/är ogiltig, se verifyReauthGrant i _signedToken.js.
  const handleOpenStripeOnboarding = async (reauthToken) => {
    if (!user) {
      alert('Logga in för att ansluta Stripe.');
      return;
    }
    if (company.stripeAccountId) return; // redan anslutet — inget att göra
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ company_id: data.activeCompanyId, action: 'start', reauthToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) throw new Error(payload?.error || `Kunde inte starta Stripe-anslutningen (${response.status})`);
      window.location.href = payload.url;
    } catch (error) {
      console.error(error);
      alert(`Kunde inte ansluta Stripe: ${error.message || error}`);
    }
  };

  // reauthToken — se kommentaren vid handleOpenStripeOnboarding ovan, samma
  // resonemang gäller frånkoppling.
  const handleDisconnectStripe = async (reauthToken) => {
    if (!company.stripeAccountId) return;
    if (!window.confirm('Koppla från Stripe? Bokix kan då inte längre ta emot kortbetalningar till det här kontot.')) return;

    try {
      // Säkerhetsfix: user_id och stripe_account_id skickas inte längre med
      // — servern verifierar nu vem som anropar via sessionens access-token
      // och slår själv upp vilket konto som faktiskt är kopplat till
      // företaget (se connect.js: handleDisconnect), istället för att lita
      // på body:n. Samma /api/stripe/connect-endpoint som start ovan,
      // action: 'disconnect' väljer grenen.
      const { data: { session } = {} } = await supabase.auth.getSession();
      const response = await fetch('/api/stripe/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ company_id: data.activeCompanyId, action: 'disconnect', reauthToken }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Frånkoppling misslyckades (${response.status})`);
      setCompanyInfo({ ...company, stripeAccountId: '' });
    } catch (error) {
      console.error(error);
      alert(`Kunde inte koppla från Stripe: ${error.message || error}`);
    }
  };

  // Zettle (PayPal Zettle/iZettle) OAuth — samma mönster som Stripe Connect
  // ovan (autentiserad POST returnerar auktoriseringsadressen som JSON,
  // frontend navigerar dit själv), se api/zettle/callback.js. Ingen
  // "action"-body-parameter behövs här (till skillnad från Stripes
  // connect.js) — POST på den vägen betyder alltid "starta", GET är
  // reserverat för Zettles egen redirect tillbaka.
  const handleOpenZettleOnboarding = async () => {
    if (!user) {
      alert('Logga in för att ansluta Zettle.');
      return;
    }
    if (company.zettleAccessToken) return; // redan anslutet — inget att göra
    try {
      const { data: { session } = {} } = await supabase.auth.getSession();
      const response = await fetch('/api/zettle/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ company_id: data.activeCompanyId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.url) throw new Error(payload?.error || `Kunde inte starta Zettle-anslutningen (${response.status})`);
      window.location.href = payload.url;
    } catch (error) {
      console.error(error);
      alert(`Kunde inte ansluta Zettle: ${error.message || error}`);
    }
  };

  // ── E-postavsändare (Sida 33, Steg 2) ──────────────────────────────────
  // Kastar vidare vid fel istället för att larma här — Settings.jsx äger
  // sin egen busy/fel-state runt dessa anrop så den kan visa felet inline
  // bredvid domänfältet, inte som en global alert().
  const handleConnectEmailDomain = async (domain) => {
    const result = await createEmailDomain(domain);
    setCompanyInfo({
      ...company,
      emailDomain: domain,
      resendDomainId: result.id,
      emailDomainStatus: result.status || 'pending',
      emailDomainRecords: result.records || [],
    });
    return result;
  };

  // Samma live-koll som servern gör vid varje utskick (se resolveSenderAddress
  // i server.js/api/email/*) — `emailDomainStatus` som sparas här är bara en
  // display-cache för sidan, aldrig det utskicket självt litar på.
  const handleCheckEmailDomainStatus = async () => {
    if (!company.resendDomainId) return null;
    const result = await getEmailDomainStatus(company.resendDomainId, company.id);
    setCompanyInfo({
      ...company,
      emailDomainStatus: result.status || company.emailDomainStatus,
      emailDomainRecords: result.records?.length ? result.records : company.emailDomainRecords,
    });
    return result;
  };

  const handleDisconnectEmailDomain = () => {
    if (!window.confirm('Koppla från den här avsändardomänen? Fakturor skickas via Bokix reservadress igen tills en ny domän kopplas och verifieras.')) return;
    setCompanyInfo({ ...company, emailDomain: '', resendDomainId: '', emailDomainStatus: '', emailDomainRecords: [] });
  };

  // Bygger Checkout-radrar och skapar en Stripe-betalningssession, returnerar
  // bara URL:en — kastar (istället för att larma med alert) så anroparen
  // själv avgör hur ett fel ska visas. Delad av två flöden i Invoices.jsx:
  // dels PaymentLinkModal ("Skapa betalningslänk" i radmenyn — visar länken
  // för kopiering/e-postutskick istället för att navigera bort ifrån appen),
  // dels handleSendEmail (lägger samma länk direkt i fakturamejlet).
  const getInvoicePaymentLinkUrl = async (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Fakturan kunde inte hittas.');
    if (!company.stripeAccountId) throw new Error('Stripe är inte anslutet.');

    const customer = contacts.find(c => c.id === invoice.customerId);
    // Bugfix (kundrapport: "Skapa betalningslänk funkar inte" — knappen var
    // grå för en faktura vars kund/företag saknade e-post): en e-postadress
    // krävdes tidigare hårt här, trots att den bara är valfri förifyllnad
    // i Stripe Checkout (create-checkout-session.js: `customer_email:
    // body.customer_email || undefined`) — Stripe frågar payern om den
    // saknas, kräver den aldrig i förväg. Länken är till för att KOPIERAS/
    // delas manuellt (SMS, i person, m.m.), inte bara ett automatiskt
    // mejlutskick, så den ska gå att skapa oavsett om en e-post råkar
    // finnas sparad eller inte.
    const customerEmail = customer?.email || company.email || undefined;

    // Säkerhetsfix (se säkerhetsgranskningen): raderna/beloppet/avgiften
    // byggdes tidigare här och skickades med i requesten — backend litade
    // blint på dem, så ett manipulerat anrop kunde debitera vad som helst
    // och ändå markera den riktiga fakturan som betald. Backend
    // (create-checkout-session.js / _invoiceLineItems.js) slår nu istället
    // upp fakturan själv via invoice_id och räknar om beloppet server-side
    // — vi skickar bara med IDN, inte längre några belopp.
    const { session } = await createStripeCheckoutSession({
      customer_email: customerEmail,
      // Klarna (och andra köp-nu-betala-senare-metoder) stödjer inte B2B enligt
      // Stripes/Klarnas egna regler — skickar med kundtypen så backend kan
      // avgöra om Klarna m.fl. får erbjudas, eller om det måste vara kort
      // (se create-checkout-session.js). "se_individual" är den enda
      // privatperson-varianten i customerType, se Contacts.jsx.
      customer_type: customer?.customerType,
      // Sätts som Stripe-sessionens metadata (create-checkout-session.js) —
      // enda kopplingen webhooken (webhook.js/server.js) har mellan en
      // bekräftad Stripe-betalning och VILKEN Bokix-faktura den gäller.
      // Samma tre ID:n är också vad backend använder för att slå upp
      // fakturan och det anslutna Stripe-kontot server-side.
      user_id: user?.id,
      company_id: data.activeCompanyId,
      invoice_id: invoiceId,
    });

    if (!session?.url) throw new Error('Betalningslänk skapad, men ingen länk mottogs.');
    return session.url;
  };

  // Add (or continue-update) a verification.
  const handleAddVerification = (newVer) => {
    setVerifications(prev => {
      // Bugkritiskt: "Fortsätt redigera utkastet" i Verifications.jsx skickar
      // med sitt EGET id (bara en verifikation som redan hade ett tilldelat
      // nummer gör det, se kommentaren i handleSave där). Utan den här
      // grenen skapades alltid en NY post — det gamla utkastet blev kvar
      // orört i listan, så varje "fortsätt och spara" dubblerade
      // verifikationen istället för att uppdatera den.
      if (newVer.id) {
        const idx = prev.findIndex(v => v.id === newVer.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...prev[idx], ...newVer };
          return updated;
        }
      }
      // Respektera ett nummer som redan beräknats (t.ex. med rätt serie från
      // "Ny verifikation"-formuläret) — bygg bara ett eget som fallback för
      // auto-bokförda verifikationer från fakturor/utgifter, som inte skickar med ett.
      const number = newVer.number || `V${prev.length + 1}`;
      // `Date.now()` ensam krockar när flera verifikationer skapas synkront
      // efter varandra (t.ex. lönekörningens tre block) — de hamnar lätt
      // inom samma millisekund. `prev.length` som suffix räcker för att
      // hålla id:t unikt inom samma synkrona batch.
      const id = `${Date.now()}_${prev.length}`;
      return [...prev, { ...newVer, id, number }];
    });
  };

  // Auto-book invoice creation
  const handleAddInvoice = (invoice) => {
    const invType = invoice.type || 'invoice';
    // Slumpsuffix (se motsvarande kommentar vid company_id ovan) — invoice_id
    // skickas precis som company_id oautentiserat till create-checkout-
    // session.js via fakturans betalningslänk.
    const inv = { ...invoice, id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: invType };
    setInvoices(prev => [...prev, inv]);

    if (invType === 'quote') return;

    let totalNet = 0;
    let vatByRate = {};
    inv.rows.forEach(r => {
      const lineNet = r.qty * r.unitPrice;
      const lineVat = lineNet * (r.vatRate / 100);
      totalNet += lineNet;
      if (!vatByRate[r.vatRate]) vatByRate[r.vatRate] = 0;
      vatByRate[r.vatRate] += lineVat;
    });
    const totalGross = totalNet + Object.values(vatByRate).reduce((s, v) => s + v, 0);

    const verRows = [
      { account: '1510', debet: Math.round(totalGross), kredit: 0 },
    ];

    inv.rows.forEach(r => {
      const lineNet = r.qty * r.unitPrice;
      const revAcc = REVENUE_ACCOUNTS[r.vatRate] || '3001';
      const existing = verRows.find(vr => vr.account === revAcc && vr.kredit > 0);
      if (existing) {
        existing.kredit += Math.round(lineNet);
      } else {
        verRows.push({ account: revAcc, debet: 0, kredit: Math.round(lineNet) });
      }
    });

    Object.entries(vatByRate).forEach(([rate, amount]) => {
      const vatAcc = VAT_ACCOUNTS[parseInt(rate)];
      if (vatAcc && amount > 0) {
        verRows.push({ account: vatAcc, debet: 0, kredit: Math.round(amount) });
      }
    });

    handleAddVerification({
      date: inv.date,
      description: `Faktura ${inv.invoiceNumber}`,
      source: 'invoice',
      sourceId: inv.id,
      rows: verRows,
    });
  };

  // Konvertering offert → faktura är det ENDA stället en post flyttas mellan
  // de två listorna, och det är också den punkt där en bokföringsrelevant
  // händelse faktiskt uppstår — så den bokförs automatiskt precis som en
  // direkt-skapad faktura gör i handleAddInvoice ovan, istället för att bara
  // flytta posten tyst utan verifikation (vilket den gamla, aldrig
  // ihopkopplade versionen av denna funktion också gjorde fel — den skrev
  // om posten på plats i `invoices` som om offerter redan låg där).
  const handleConvertQuoteToInvoice = (quoteId) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return null;

    const invoiceNumber = getNextInvoiceNumber(invoices, company);
    const today = new Date().toISOString().split('T')[0];
    const dueDate = (() => {
      const d = new Date();
      d.setDate(d.getDate() + (Number(company?.paymentTermsDays) || 30));
      return d.toISOString().split('T')[0];
    })();

    const updatedInvoice = {
      ...quote,
      type: 'invoice',
      status: 'draft',
      date: today,
      dueDate,
      invoiceNumber,
      // Offertrader saknar `discount`/`account` — fälten Invoices.jsx
      // förutsätter finns på varje rad (se raderingsfältet där).
      rows: (quote.rows || []).map(r => ({ discount: 0, account: '3001', ...r })),
    };

    setQuotes(prev => prev.filter(q => q.id !== quoteId));
    setInvoices(prev => [...prev, updatedInvoice]);

    let totalNet = 0;
    let vatByRate = {};
    updatedInvoice.rows.forEach(r => {
      const lineNet = r.qty * r.unitPrice;
      const lineVat = lineNet * (r.vatRate / 100);
      totalNet += lineNet;
      if (!vatByRate[r.vatRate]) vatByRate[r.vatRate] = 0;
      vatByRate[r.vatRate] += lineVat;
    });
    const totalGross = totalNet + Object.values(vatByRate).reduce((s, v) => s + v, 0);

    const verRows = [
      { account: '1510', debet: Math.round(totalGross), kredit: 0 },
    ];

    updatedInvoice.rows.forEach(r => {
      const lineNet = r.qty * r.unitPrice;
      const revAcc = REVENUE_ACCOUNTS[r.vatRate] || '3001';
      const existing = verRows.find(vr => vr.account === revAcc && vr.kredit > 0);
      if (existing) {
        existing.kredit += Math.round(lineNet);
      } else {
        verRows.push({ account: revAcc, debet: 0, kredit: Math.round(lineNet) });
      }
    });

    Object.entries(vatByRate).forEach(([rate, amount]) => {
      const vatAcc = VAT_ACCOUNTS[parseInt(rate)];
      if (vatAcc && amount > 0) {
        verRows.push({ account: vatAcc, debet: 0, kredit: Math.round(amount) });
      }
    });

    handleAddVerification({
      date: updatedInvoice.date,
      description: `Faktura ${updatedInvoice.invoiceNumber}`,
      source: 'invoice',
      sourceId: updatedInvoice.id,
      rows: verRows,
    });

    return updatedInvoice;
  };

  const invoiceGross = (inv) => inv.rows.reduce((sum, r) => {
    const lineNet = r.qty * r.unitPrice;
    return sum + lineNet + lineNet * (r.vatRate / 100);
  }, 0);

  // Registrera betalning — stödjer delbetalning. Beloppet som faktiskt
  // betalas denna gång bokförs för sig (1930/1510), och fakturan markeras
  // som fullt betald först när det ackumulerade betalda beloppet når hela
  // fakturabeloppet. Kan aldrig ta emot mer än vad som återstår.
  const handleRegisterInvoicePayment = (invoiceId, amount, date) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv || !amount || amount <= 0) return;

    const totalGross = invoiceGross(inv);
    const alreadyPaid = inv.paidAmount || 0;
    const remaining = Math.max(0, totalGross - alreadyPaid);
    const paymentAmount = Math.min(amount, remaining);
    if (paymentAmount <= 0) return;

    const newPaid = alreadyPaid + paymentAmount;
    const isFullyPaid = newPaid >= totalGross - 0.5; // avrundningsmarginal (öre)
    const paidDate = date || new Date().toISOString().split('T')[0];

    setInvoices(prev => prev.map(i =>
      i.id === invoiceId
        ? { ...i, paidAmount: newPaid, status: isFullyPaid ? 'paid' : i.status, paidDate: isFullyPaid ? paidDate : i.paidDate }
        : i
    ));

    handleAddVerification({
      date: paidDate,
      description: alreadyPaid > 0 || !isFullyPaid
        ? `Delbetalning faktura ${inv.invoiceNumber}`
        : `Betalning faktura ${inv.invoiceNumber}`,
      source: 'invoice_payment',
      sourceId: invoiceId,
      rows: [
        { account: '1930', debet: Math.round(paymentAmount), kredit: 0 },
        { account: '1510', debet: 0, kredit: Math.round(paymentAmount) },
      ],
    });
  };

  // Bekvämlighetsgenväg som betalar hela kvarvarande beloppet idag — det
  // snabbknappen i listan och bulk-"Markera som betalda" använder.
  const handleMarkInvoicePaid = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const remaining = Math.max(0, invoiceGross(inv) - (inv.paidAmount || 0));
    if (remaining <= 0) return;
    handleRegisterInvoicePayment(invoiceId, remaining, new Date().toISOString().split('T')[0]);
  };

  // "Markera som obetald" ångrar en registrerad betalning — status och
  // betalt belopp återställs, och betalningsverifikationerna tas faktiskt
  // bort (inte bara döljs), eftersom det är precis vad en ångrad
  // betalningsregistrering innebär. Kräver bekräftelse i UI:t innan den anropas.
  const handleUnmarkInvoicePaid = (invoiceId) => {
    setInvoices(prev => prev.map(i =>
      i.id === invoiceId ? { ...i, status: 'sent', paidDate: undefined, paidAmount: 0 } : i
    ));
    setVerifications(prev => prev.filter(v => !(v.source === 'invoice_payment' && v.sourceId === invoiceId)));
  };

  // Add expense with auto-booking
  //
  // Bugkritiskt (Sida 34): kvitton skapas numera direkt vid uppladdning i
  // Expenses.jsx, INNAN användaren fyllt i något i detaljvyn — costAccount
  // är då tomt. Utan den här spärren skulle varje uppladdning bokföra en
  // ogiltig verifikation direkt (tom kontokod, 0 kr) innan kontot ens
  // valts. Ett kvitto utan konto ska bara hamna i listan som "Ej hanterat"
  // (samma tillstånd handleFixExpenseAccount/handleSaveReceiptDetails
  // nedan redan förutsätter), exakt samma mönster som
  // handleAddSupplierInvoice redan använder för en leverantörsfaktura utan
  // kontering.
  const handleAddExpense = (expense) => {
    const exp = { ...expense, id: `exp_${Date.now()}` };
    setExpenses(prev => [...prev, exp]);
    if (!exp.costAccount) return;

    const verRows = [
      { account: exp.costAccount, debet: Math.round(exp.netAmount), kredit: 0 },
    ];
    if (exp.vatAmount > 0) {
      verRows.push({ account: '2641', debet: Math.round(exp.vatAmount), kredit: 0 });
    }
    verRows.push({ account: '1930', debet: 0, kredit: Math.round(exp.amount) });

    handleAddVerification({
      date: exp.date,
      description: exp.description,
      source: 'expense',
      sourceId: exp.id,
      rows: verRows,
    });
  };

  // Registrera en leverantörsfaktura. Stödjer flera konteringsrader (inte
  // bara ett konto), betalning från egen ficka (bokförs mot 2018 istället
  // för 2440 — en skuld till ägaren, inte till leverantören) och avrundning
  // till hel krona (mellanskillnaden bokförs mot 3740, aldrig bara avrundas
  // bort tyst).
  //
  // Omvänd skattskyldighet: fakturan bokförs utan moms (precis som
  // leverantörens egen faktura saknar moms i det läget). Den självdeklarerade
  // momsen som egentligen ska redovisas bokförs INTE automatiskt ännu — det
  // kräver konton/rutor vi inte har verifierat, så vi gissar hellre inte än
  // bokför fel. Formuläret varnar om detta innan man sparar.
  const handleAddSupplierInvoice = (invoice) => {
    const status = invoice.status === 'paid' ? 'paid' : 'unpaid';
    const inv = {
      ...invoice, id: `exp_${Date.now()}`, type: 'supplier_invoice', status,
      paidDate: status === 'paid' ? new Date().toISOString().split('T')[0] : undefined,
    };
    setExpenses(prev => [...prev, inv]);

    // Snabbregistreringen (Kvitto och utgifter > Leverantörsfakturor-fliken)
    // samlar bara in leverantör/belopp/datum, inget konto — fakturan sparas
    // direkt men bokförs inte förrän kontot väljs via "Granska" i listan
    // (handleFixExpenseAccount, längre ner), exakt samma mönster som ett
    // kvitto utan kontering. Utan detta skulle en tom kontoraden bokas som
    // en obalanserad verifikation (kredit utan matchande debet).
    if (!inv.rows?.length && !inv.costAccount) return;

    const rows = inv.rows?.length ? inv.rows : [{ account: inv.costAccount, netAmount: inv.netAmount, vatAmount: inv.vatAmount }];
    const verRows = rows
      .filter(r => r.account && r.netAmount)
      .map(r => ({ account: r.account, debet: Math.round(r.netAmount), kredit: 0, costCenter: inv.costCenter || undefined, projectId: inv.projectId || undefined }));

    const totalVat = inv.reverseCharge ? 0 : rows.reduce((s, r) => s + (r.vatAmount || 0), 0);
    if (totalVat > 0) {
      verRows.push({ account: '2641', debet: Math.round(totalVat), kredit: 0 });
    }

    const payableAccount = inv.paidByOwnerPrivately ? '2018' : '2440';
    const netTotal = rows.reduce((s, r) => s + (r.netAmount || 0), 0);
    const payableAmount = Math.round(netTotal + totalVat);
    verRows.push({ account: payableAccount, debet: 0, kredit: payableAmount });

    if (inv.roundToKrona && Math.round(inv.roundingDiff * 100) !== 0) {
      // Positiv diff (avrundat uppåt) krediteras 3740, negativ (nedåt) debiteras.
      const diff = Math.round(inv.roundingDiff);
      if (diff !== 0) verRows.push({ account: '3740', debet: diff < 0 ? -diff : 0, kredit: diff > 0 ? diff : 0 });
    }

    handleAddVerification({
      date: inv.date,
      description: inv.description || `Leverantörsfaktura ${inv.invoiceNumber}`,
      source: 'supplier_invoice',
      sourceId: inv.id,
      rows: verRows,
    });

    // Har ägaren redan betalat privat är leverantören redan löst (skulden
    // ligger istället mot ägaren via 2018 ovan) — ingen separat betalnings-
    // verifikation ska bokas mot bankkontot för det.
    if (status === 'paid' && !inv.paidByOwnerPrivately) {
      handleAddVerification({
        date: inv.paidDate,
        description: `Betalning leverantörsfaktura ${inv.invoiceNumber}`,
        source: 'supplier_invoice_payment',
        sourceId: inv.id,
        rows: [
          { account: '2440', debet: payableAmount, kredit: 0 },
          { account: '1930', debet: 0, kredit: payableAmount },
        ],
      });
    }
  };

  // Markera en leverantörsfaktura som betald: flyttar skulden (2440) till bank (1930).
  //
  // Sida 35: paymentMethod sparas per transaktion (inte en global
  // inställning) så historiken visar korrekt hur betalningen faktiskt
  // gjordes. Defaultar till 'bank' — det enda som faktiskt går att
  // slutföra idag (se PaySupplierInvoiceModal i SupplierInvoices.jsx för
  // varför "kort" fortfarande är "Kommer snart" och aldrig skickar hit
  // 'card').
  const handleMarkSupplierInvoicePaid = (expenseId, paymentMethod = 'bank') => {
    const inv = expenses.find(e => e.id === expenseId);
    if (!inv) return;
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'paid', paidDate: new Date().toISOString().split('T')[0], paymentMethod } : e));

    handleAddVerification({
      date: new Date().toISOString().split('T')[0],
      description: `Betalning leverantörsfaktura ${inv.invoiceNumber}`,
      source: 'supplier_invoice_payment',
      sourceId: inv.id,
      rows: [
        { account: '2440', debet: Math.round(inv.amount), kredit: 0 },
        { account: '1930', debet: 0, kredit: Math.round(inv.amount) },
      ],
    });
  };

  // "Markera som obetald" för en leverantörsfaktura — samma princip som
  // handleUnmarkInvoicePaid (kundfaktura) ovan: status/betaldatum
  // återställs och betalningsverifikationen tas faktiskt bort, inte bara
  // döljs. En faktura betald privat (paidByOwnerPrivately) skapade aldrig
  // någon supplier_invoice_payment-verifikation (skulden ligger redan mot
  // 2018, se handleAddSupplierInvoice) — filtret nedan är då ett no-op,
  // vilket är rätt: det finns ingen betalning att ångra där.
  const handleUnmarkSupplierInvoicePaid = (expenseId) => {
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'unpaid', paidDate: undefined, paymentMethod: undefined } : e));
    setVerifications(prev => prev.filter(v => !(v.source === 'supplier_invoice_payment' && v.sourceId === expenseId)));
  };

  // Sätter konto på en utgift som saknar kontering — antingen via det gamla
  // "Fixa manuellt"-läget i Kvitto och utgifter, eller via Granskningssidans
  // Godkänn/Avvisa (som båda i slutändan bara väljer rätt konto).
  //
  // Bugkritiskt: idempotent. Om posten redan har fått ett konto (t.ex. för
  // att den redan hanterades i en annan flik, eller ett dubbelklick hann
  // igenom innan UI:t uppdaterades) görs ingenting — annars skulle en andra
  // körning bokföra ytterligare en rättelseverifikation för samma utgift.
  const handleFixExpenseAccount = (expenseId, accountCode, meta = {}) => {
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp || exp.costAccount) return;
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, costAccount: accountCode } : e));

    const verRows = [{ account: accountCode, debet: Math.round(exp.netAmount || exp.amount), kredit: 0 }];
    if (exp.vatAmount > 0) verRows.push({ account: '2641', debet: Math.round(exp.vatAmount), kredit: 0 });
    verRows.push({ account: exp.type === 'supplier_invoice' ? '2440' : '1930', debet: 0, kredit: Math.round(exp.amount) });

    handleAddVerification({
      date: new Date().toISOString().split('T')[0],
      description: `Rättad kontering: ${exp.description}`,
      source: 'expense_fix',
      sourceId: exp.id,
      rows: verRows,
    });

    const accountName = accounts.find(a => a.code === accountCode)?.name || accountCode;
    updateCompanyField('reviewHistory', [
      {
        id: `rh_${Date.now()}`,
        expenseId,
        title: exp.type === 'supplier_invoice' ? `Leverantörsfaktura — ${exp.supplier || exp.description || 'Okänd'}` : `Kvitto — ${exp.supplier || exp.description || 'Okänd'}`,
        amount: exp.amount,
        account: accountCode,
        accountName,
        method: meta.method || 'manual', // 'suggested' | 'bulk' | 'manual'
        resolvedBy: user?.email || 'Okänd användare',
        resolvedAt: new Date().toISOString(),
      },
      ...reviewHistory,
    ]);
  };

  // Sparar detaljvyns formulär (Sida 34) på ett kvitto som redan skapades
  // i listan vid uppladdningstillfället (se Expenses.jsx: filen laddas upp
  // och läggs till direkt med tomma placeholder-fält, innan användaren
  // hunnit fylla i något). Till skillnad från handleFixExpenseAccount ovan
  // — som bara sätter kontot på en post vars övriga fält redan var
  // kompletta — måste den här uppdatera SAMTLIGA fält (datum, leverantör,
  // belopp, momssats, konto, projekt, anteckning) eftersom kvittot kan
  // sparas med i princip allt fortfarande tomt.
  //
  // Bugkritiskt: idempotent på bokföringen precis som handleFixExpenseAccount
  // — om kvittot redan har en verifikation (source 'expense'/'expense_fix')
  // uppdateras bara fälten, ingen ny verifikation skapas. Att rätta belopp/
  // konto på ett redan bokfört kvitto i efterhand (och därmed behöva
  // korrigera den befintliga verifikationen) är utanför scope här.
  const handleSaveReceiptDetails = (expenseId, formValues) => {
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return;
    const alreadyBooked = verifications.some(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);

    const amount = formValues.amount;
    const vatRate = formValues.vatRate;
    const netAmount = vatRate > 0 ? Math.round((amount / (1 + vatRate / 100)) * 100) / 100 : amount;
    const vatAmount = Math.round((amount - netAmount) * 100) / 100;

    const updated = {
      ...exp,
      date: formValues.date,
      supplier: formValues.supplier,
      description: formValues.supplier,
      amount, netAmount, vatAmount, vatRate,
      costAccount: formValues.costAccount,
      projectId: formValues.projectId || undefined,
      notes: formValues.notes || undefined,
    };
    setExpenses(prev => prev.map(e => e.id === expenseId ? updated : e));

    if (alreadyBooked) return;

    const verRows = [{ account: updated.costAccount, debet: Math.round(updated.netAmount), kredit: 0, projectId: updated.projectId }];
    if (updated.vatAmount > 0) verRows.push({ account: '2641', debet: Math.round(updated.vatAmount), kredit: 0 });
    verRows.push({ account: '1930', debet: 0, kredit: Math.round(updated.amount) });

    handleAddVerification({
      date: updated.date,
      description: updated.description,
      source: 'expense',
      sourceId: updated.id,
      rows: verRows,
    });
  };

  // Tar bort ett kvitto som laddats upp men aldrig bokförts (t.ex. en
  // felaktig uppladdning användaren ångrar innan de fyllt i detaljvyn).
  // Bugkritiskt: vägrar radera ett redan bokfört kvitto — det skulle lämna
  // en obalanserad/föräldralös verifikation kvar. Att ta bort ett bokfört
  // kvitto kräver att man först ångrar bokföringen (utanför scope här,
  // samma sorts skydd som redan finns för fakturor/löner).
  const handleDeleteExpense = (expenseId) => {
    const alreadyBooked = verifications.some(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);
    if (alreadyBooked) return;
    // Kostnadsgranskning: kvittofilen i Storage följde tidigare inte med
    // härifrån — bara raden i state togs bort, filen blev kvar och betalade
    // hyra för evigt. "Best effort" (se deleteFileFromStorage) — väntar inte
    // in svaret, ett misslyckat städförsök ska aldrig fördröja eller blockera
    // att kvittot faktiskt försvinner ur listan.
    const expense = expenses.find(e => e.id === expenseId);
    if (expense?.receiptUrl) deleteFileFromStorage(expense.receiptUrl);
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
  };

  // Rättar ett redan bokfört kvitto genom att skapa en NY, länkad
  // motverifikation istället för att radera eller ändra originalet —
  // Bokföringslagen tillåter inte att en bokförd verifikation raderas/
  // ändras i efterhand. Samma princip som fakturors "Skapa en
  // kreditfaktura" (Invoices.jsx, redan implementerad) och samma
  // debet/kredit-bytesmönster som Verifikationer-sidans manuella
  // "Rätta"-knapp (Verifications.jsx) redan använder, fast här automatiskt
  // och länkat till kvittot istället för ett manuellt öppnat formulär.
  //
  // Idempotent: no-op om kvittot inte är bokfört (inget att rätta) eller
  // redan har rättats en gång — annars skulle ett dubbelklick skapa två
  // motverifikationer och nolla ut kontot dubbelt.
  const handleReverseExpense = (expenseId) => {
    const originalVer = verifications.find(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);
    if (!originalVer) return;
    const alreadyReversed = verifications.some(v => v.source === 'expense_reversal' && v.sourceId === expenseId);
    if (alreadyReversed) return;

    const reversedRows = (originalVer.rows || []).map(r => ({ ...r, debet: r.kredit || 0, kredit: r.debet || 0 }));
    handleAddVerification({
      date: new Date().toISOString().split('T')[0],
      description: `Rättelse: ${originalVer.description}`,
      source: 'expense_reversal',
      sourceId: expenseId,
      rows: reversedRows,
    });
  };

  // ── Lön (Sida 12 & 13) ──────────────────────────────────────────────────
  const handleSaveEmployee = (employeeId, data) => {
    if (employeeId) {
      setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, ...data } : e));
    } else {
      setEmployees(prev => [...prev, { ...data, id: `emp_${Date.now()}` }]);
    }
  };

  // Skapar en ny lönekörning. Fryser en ögonblicksbild av varje anställds
  // lönerelevanta fält vid skapandet — en historisk körning ska alltid visa
  // exakt det som gällde då, även om den anställdas profil ändras senare
  // (samma princip som för fakturor).
  const handleCreateRun = ({ period, payDate, employees: employeesForRun }) => {
    const runId = `run_${Date.now()}`;
    const rows = employeesForRun.map(e => ({
      employeeId: e.id,
      period,
      hoursWorked: 0,
      additions: 0, absenceDeduction: 0, grossDeduction: 0, benefits: 0, netDeduction: 0,
      employeeSnapshot: { ...e },
    }));
    setPayrollRuns(prev => [...prev, { id: runId, period, payDate, completedSteps: [], rows, createdAt: new Date().toISOString() }]);
    return runId;
  };

  const handleUpdateRunRow = (runId, employeeId, patch) => {
    setPayrollRuns(prev => prev.map(r => r.id !== runId ? r : {
      ...r,
      rows: r.rows.map(row => row.employeeId === employeeId ? { ...row, ...patch } : row),
    }));
  };

  // Fryser om employeeSnapshot från den anställdas NUVARANDE profil — bara
  // tillåtet på ett fortfarande obekräftat utkast ('calculated' inte
  // uppnått), så en redan beräknad/bokförd körnings historik aldrig ändras
  // i efterhand (samma frysningsprincip som skapandet, se handleCreateRun).
  // Behövs eftersom en felaktig/saknad skattetabell på den anställda annars
  // fryses in permanent i utkastet och aldrig kan rättas till utan att
  // skapa om hela körningen.
  // `currentEmployees` tas emot som parameter (samma mönster som
  // handleCreateRun ovan, som får sin anställdlista från anroparen) istället
  // för att läsa den fångade `employees`-variabeln från render-scope —
  // annars skulle ett anställd-sparande och en uppdatering av samma
  // körnings ögonblicksbild i samma synkrona händelsekedja kunna se
  // olika (den senare inaktuell) versioner av samma company-state.
  const handleRefreshRunSnapshots = (runId, currentEmployees) => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes('calculated')) return r;
      return {
        ...r,
        rows: r.rows.map(row => {
          const current = (currentEmployees || employees).find(e => e.id === row.employeeId);
          return current ? { ...row, employeeSnapshot: { ...current } } : row;
        }),
      };
    }));
  };

  const handleAdvanceRunStep = (runId, stepId) => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes(stepId)) return r; // idempotent
      return { ...r, completedSteps: [...r.completedSteps, stepId] };
    }));
  };

  // Bokför en lönekörning som tre summerade verifikationer (inte en per
  // anställd). Spärrad mot dubbelbokföring precis som momsdeklarationen.
  const handleBookRun = (runId, verBlocks) => {
    const run = payrollRuns.find(r => r.id === runId);
    if (!run || run.completedSteps.includes('booked')) return;

    const period = run.period;
    handleAddVerification({ date: run.payDate || new Date().toISOString().split('T')[0], description: `Lön ${period}: Lön`, source: 'payroll', sourceId: `${runId}_lon`, rows: verBlocks.block1 });
    handleAddVerification({ date: run.payDate || new Date().toISOString().split('T')[0], description: `Lön ${period}: Arbetsgivaravgifter`, source: 'payroll', sourceId: `${runId}_agifter`, rows: verBlocks.block2 });
    handleAddVerification({ date: run.payDate || new Date().toISOString().split('T')[0], description: `Lön ${period}: Semesteravsättning`, source: 'payroll', sourceId: `${runId}_semester`, rows: verBlocks.block3 });

    setPayrollRuns(prev => prev.map(r => r.id === runId ? { ...r, completedSteps: [...r.completedSteps, 'booked'] } : r));
  };

  // Sida 35: markerar en lönekörning som betald OCH sparar vilken metod
  // som faktiskt användes (per körning, inte en global inställning) —
  // till skillnad från handleAdvanceRunStep, som bara lägger till en flagga
  // utan att spara någon ytterligare information. Idempotent, samma mönster
  // som handleAdvanceRunStep redan använder.
  // paidAt (kundfeedback: "all information" ska synas efter betalning,
  // inte bara att steget bockats av) — samma "spara VAD/NÄR, inte bara
  // klar/ej klar"-princip som paymentMethod redan är byggd på.
  const handleMarkRunPaid = (runId, paymentMethod = 'bank') => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes('paid')) return r;
      return { ...r, completedSteps: [...r.completedSteps, 'paid'], paymentMethod, paidAt: new Date().toISOString() };
    }));
  };

  // End of logic

  // Import/export (for settings)
  const handleImportData = (importedData) => {
    if (importedData.accounts) updateCompanyField('accounts', importedData.accounts);
    if (importedData.verifications) updateCompanyField('verifications', importedData.verifications);
    if (importedData.invoices) {
      // En äldre backup kan ha offerter inbakade i samma `invoices`-lista
      // (från innan migreringen till separata listor, se normalizeStore) —
      // splitta den precis som normalizeStore gör, annars återintroducerar
      // en återställd backup exakt det problem separationen skulle lösa.
      const { invoices, quotes: strayQuotes } = splitInvoicesAndQuotes(importedData.invoices);
      updateCompanyField('invoices', invoices);
      const importedQuotes = importedData.quotes || strayQuotes;
      if (importedQuotes.length > 0 || importedData.quotes) updateCompanyField('quotes', importedQuotes);
    } else if (importedData.quotes) {
      updateCompanyField('quotes', importedData.quotes);
    }
    if (importedData.expenses) updateCompanyField('expenses', importedData.expenses);
    if (importedData.contacts) updateCompanyField('contacts', importedData.contacts);
    if (importedData.projects) updateCompanyField('projects', importedData.projects);
    if (importedData.company) updateCompanyField('company', { ...company, ...importedData.company });
  };

  const handleResetData = () => {
    if (window.confirm('Är du säker på att du vill återställa all data? Detta tar bort eventuella sparade uppgifter och startar om med tomt företag.')) {
      const defaultData = createEmptyCompanyData({ id: data.activeCompanyId });
      setData(prev => ({
        ...prev,
        companies: {
          ...prev.companies,
          [prev.activeCompanyId]: defaultData,
        },
      }));
    }
  };

  // Count for review badge (must be before navSections)
  // Granskningskön (Sida "Granskning") = kvitton/leverantörsfakturor utan
  // kontering — samma underlag som ReviewQueue.jsx faktiskt visar.
  const reviewCount = expenses.filter(e => !e.costAccount).length;
  const notificationCount = reviewCount + expenses.filter(e => ['draft', 'pending'].includes(e.status)).length;

  // Notis-klockan hade ingen panel bakom sig — bara ett antal, ingen väg att
  // se VAD som väntar eller klicka sig dit. Samma tre underlag som Startsidans
  // "Att göra idag" (Dashboard.jsx) redan räknar fram, men enklare — ingen
  // moms-deadline/lönekörning här, notisklockan behöver inte duplicera HELA
  // den logiken för att vara användbar, bara ge en klickbar genväg.
  const overdueInvoicesForNotif = invoices.filter(i => i.status === 'sent' && new Date(i.dueDate) < new Date());
  const draftOrPendingExpenses = expenses.filter(e => ['draft', 'pending'].includes(e.status));
  const notifications = [
    ...(overdueInvoicesForNotif.length > 0 ? [{
      icon: AlertTriangle, tone: 'red', tab: 'invoices',
      text: overdueInvoicesForNotif.length === 1 ? '1 faktura har förfallit' : `${overdueInvoicesForNotif.length} fakturor har förfallit`,
    }] : []),
    ...(reviewCount > 0 ? [{
      icon: Receipt, tone: 'green', tab: 'review',
      text: `${reviewCount} kvitto${reviewCount > 1 ? 'n' : ''} väntar på granskning`,
    }] : []),
    ...(draftOrPendingExpenses.length > 0 ? [{
      icon: FileText, tone: 'amber', tab: 'expenses',
      text: `${draftOrPendingExpenses.length} utgift${draftOrPendingExpenses.length > 1 ? 'er' : ''} väntar på hantering`,
    }] : []),
  ];

  // ── Navigation config (flat) ──
  const navSections = [
    {
      label: 'Arbetsyta',
      items: [
        { id: 'dashboard', label: 'Startsida',           icon: LayoutDashboard },
        { id: 'quotes',    label: 'Offerter',            icon: FileSpreadsheet },
        { id: 'invoices',  label: 'Fakturering',         icon: FileText },
        { id: 'contacts',  label: 'Kunder',              icon: Users },
        { id: 'expenses',  label: 'Utgifter',            icon: Receipt },
        { id: 'projects',  label: 'Projekt',             icon: Briefcase },
      ],
    },
    {
      label: 'Bokföring och ekonomi',
      items: [
        { id: 'review',    label: 'Granskning',          icon: CheckSquare, badge: reviewCount },
        { id: 'verifications', label: 'Bokföring',       icon: BookOpen },
        { id: 'payroll',   label: 'Anställda och lön',   icon: UsersRound },
        { id: 'taxes',     label: 'Skatt och bokslut',   icon: Shield },
        { id: 'reports',   label: 'Rapporter',           icon: BarChart3 },
      ],
    },
    {
      label: 'Fristående',
      items: [
        { id: 'company',   label: 'Företag',             icon: Building2 },
        { id: 'settings',  label: 'Inställningar',       icon: SettingsIcon },
      ],
    },
  ];

  const navItems = navSections.flatMap(s => s.items);

  // Mobile bottom nav (4 vanligaste + "Mer") — Sida 26. "Mer" öppnar en
  // bottensheet med resten av huvudpunkterna istället för att själv peka på
  // en specifik sida, så dess ikon nedan hanteras separat (se mobileSheetItems).
  const mobileNavItems = [
    { id: 'dashboard', label: 'Hem',      icon: LayoutDashboard },
    { id: 'invoices',  label: 'Fakturor', icon: FileText },
    { id: 'expenses',  label: 'Utgifter', icon: Receipt },
    { id: 'contacts',  label: 'Kunder',   icon: Users },
  ];
  const mobileSheetItems = [
    { id: 'quotes',        label: 'Offerter',            icon: FileSpreadsheet },
    { id: 'projects',      label: 'Projekt',             icon: Briefcase },
    { id: 'verifications', label: 'Bokföring',           icon: BookOpen },
    { id: 'payroll',       label: 'Anställda och lön',   icon: UsersRound },
    { id: 'taxes',         label: 'Skatt och bokslut',   icon: Shield },
    { id: 'reports',       label: 'Rapport och analys',  icon: BarChart3 },
    { id: 'settings',      label: 'Inställningar',       icon: SettingsIcon },
  ];
  const isMobileSheetItemActive = mobileSheetItems.some(item => resolveNavGroup(activeTab) === resolveTab(item.id));

  const companyList = Object.values(data.companies).map(c => c.company);

  // Active tab label for topbar
  const activeNavLabel = navItems.find(n => resolveTab(n.id) === resolveNavGroup(activeTab))?.label || 'Hem';


  // ── Render content ──
  const renderContent = () => {
    const commonProps = {
      accounts, balances, verifications,
      globalAction, clearGlobalAction: () => setGlobalAction(null)
    };

    switch (resolveTab(activeTab)) {
      case 'dashboard':
        return (
          <Dashboard
            {...commonProps}
            invoices={invoices}
            expenses={expenses}
            contacts={contacts}
            setActiveTab={setActiveTab}
            company={company}
            profileIncomplete={!hasCompletedOnboarding}
            onResumeOnboarding={() => setShowOnboarding(true)}
            vatPeriods={vatPeriods}
            payrollRuns={payrollRuns}
          />
        );
      case 'time':
        return (
          <TimeTracking
            key={company?.id || data.activeCompanyId}
            timeEntries={billableTimeEntries}
            setTimeEntries={setBillableTimeEntries}
            contacts={contacts}
            employees={employees}
            projects={projects}
            user={user}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            handleGlobalAction={handleGlobalAction}
          />
        );
      case 'payroll':
        return (
          <Payroll
            key={company?.id || data.activeCompanyId}
            company={company}
            employees={employees}
            onSaveEmployee={handleSaveEmployee}
            accounts={accounts}
            projects={projects}
            payrollRuns={payrollRuns}
            onCreateRun={handleCreateRun}
            onUpdateRunRow={handleUpdateRunRow}
            onAdvanceRunStep={handleAdvanceRunStep}
            onBookRun={handleBookRun}
            onMarkRunPaid={handleMarkRunPaid}
            onRefreshRunSnapshots={handleRefreshRunSnapshots}
          />
        );
      case 'taxes':
        return (
          <Taxes
            key={company?.id || data.activeCompanyId}
            company={company}
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            accounts={accounts}
            balances={balances}
            payrollRuns={payrollRuns}
            vatPeriods={vatPeriods}
            onBookVatPeriod={handleBookVatPeriod}
            onNavigateToVerification={handleNavigateToVerification}
            onAddVerification={handleAddVerification}
            setCompanyInfo={setCompanyInfo}
            onNavigateToTab={handleNavTabChange}
          />
        );
      case 'invoices':
        // Bugkritiskt: `resolveTab('revenue')` returnerar redan 'invoices'
        // (se tabAliases ovan), så en tidigare `case 'revenue':`-gren här var
        // permanent odödbar kod — den kunde aldrig träffas, men hade av
        // misstag en ANNAN, fattigare uppsättning props (bl.a. saknades
        // onUnmarkPaid/onRegisterPayment/verifications) än den här grenen.
        // Om någon råkat kopiera fel gren i framtiden hade det tyst gjort
        // "Markera som obetald" m.fl. verkningslösa. Bara EN gren nu.
        return (
          <Invoices
            key={company?.id || data.activeCompanyId}
            invoices={invoices}
            contacts={contacts}
            articles={articles}
            setArticles={setArticles}
            verifications={verifications}
            expenses={expenses}
            onAdd={handleAddInvoice}
            onMarkPaid={handleMarkInvoicePaid}
            onRegisterPayment={handleRegisterInvoicePayment}
            onUnmarkPaid={handleUnmarkInvoicePaid}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            handleGlobalAction={handleGlobalAction}
            onGetPaymentLinkUrl={getInvoicePaymentLinkUrl}
            stripeAccountId={company.stripeAccountId}
            setInvoices={setInvoices}
            company={company}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            onNavigate={handleNavTabChange}
          />
        );
      case 'expense_overview':
        return (
          <Expenses
            expenses={expenses}
            accounts={accounts}
            verifications={verifications}
            contacts={contacts}
            setContacts={setContacts}
            projects={projects}
            user={user}
            onAdd={handleAddExpense}
            onAddSupplierInvoice={handleAddSupplierInvoice}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onFixExpenseAccount={handleFixExpenseAccount}
            onSaveReceiptDetails={handleSaveReceiptDetails}
            onDeleteExpense={handleDeleteExpense}
            onReverseExpense={handleReverseExpense}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            pageTitle="Kostnader"
            pageSubtitle="Registrera och följ företagets kostnader"
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={expenses}
            accounts={accounts}
            verifications={verifications}
            projects={projects}
            user={user}
            onAdd={handleAddExpense}
            onFixExpenseAccount={handleFixExpenseAccount}
            onSaveReceiptDetails={handleSaveReceiptDetails}
            onDeleteExpense={handleDeleteExpense}
            onReverseExpense={handleReverseExpense}
            pageTitle="Utgifter"
            pageSubtitle="Alla registrerade utgifter"
          />
        );
      case 'supplier_invoices':
        return (
          <SupplierInvoices
            key={company?.id || data.activeCompanyId}
            expenses={expenses}
            accounts={accounts}
            contacts={contacts}
            setContacts={setContacts}
            projects={projects}
            user={user}
            onAddSupplierInvoice={handleAddSupplierInvoice}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onUnmarkSupplierInvoicePaid={handleUnmarkSupplierInvoicePaid}
            onFixExpenseAccount={handleFixExpenseAccount}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            onNavigate={handleNavTabChange}
          />
        );
      case 'quotes':
        return <Quotes key={company?.id || data.activeCompanyId} quotes={quotes} setQuotes={setQuotes} onConvert={handleConvertQuoteToInvoice} contacts={contacts} projects={projects} company={company} user={user} globalAction={globalAction} clearGlobalAction={() => setGlobalAction(null)} handleGlobalAction={handleGlobalAction} />;
      case 'projects':
        return (
          <Projects
            key={company?.id || data.activeCompanyId}
            projects={projects}
            setProjects={setProjects}
            contacts={contacts}
            setContacts={setContacts}
            timeEntries={timeEntries}
            setTimeEntries={setTimeEntries}
            employees={employees}
            timeReportStatuses={timeReportStatuses}
            setTimeReportStatuses={setTimeReportStatuses}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
          />
        );
      case 'contacts':
        return (
          <Contacts
            contacts={contacts}
            setContacts={setContacts}
            accounts={accounts}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
          />
        );
      case 'transfers':
        return (
          <Verifications
            user={user}
            verifications={verifications}
            accounts={accounts}
            balances={balances}
            contacts={contacts}
            projects={projects}
            templates={verificationTemplates}
            onSaveTemplate={handleSaveVerificationTemplate}
            onAdd={handleAddVerification}
            setVerifications={setVerifications}
            pageTitle="Överföringar"
            pageSubtitle="Hantera kontoöverföringar och transaktioner"
            vatPeriods={vatPeriods}
            highlightVerificationId={highlightVerificationId}
            onClearHighlight={() => setHighlightVerificationId(null)}
          />
        );
      case 'review':
        return (
          <ReviewQueue
            expenses={expenses}
            accounts={accounts}
            reviewHistory={reviewHistory}
            onResolve={handleFixExpenseAccount}
            user={user}
            company={company}
            onAddVerification={handleAddVerification}
          />
        );

      case 'verifications':
        return (
          <Verifications
            user={user}
            verifications={verifications}
            accounts={accounts}
            balances={balances}
            contacts={contacts}
            projects={projects}
            templates={verificationTemplates}
            onSaveTemplate={handleSaveVerificationTemplate}
            onAdd={handleAddVerification}
            setVerifications={setVerifications}
            setAccounts={setAccounts}
            vatPeriods={vatPeriods}
            highlightVerificationId={highlightVerificationId}
            onClearHighlight={() => setHighlightVerificationId(null)}
          />
        );
      case 'accounts':
        return (
          <Accounts
            accounts={accounts}
            balances={balances}
            setAccounts={setAccounts}
          />
        );
      case 'reports':
        return (
          <Reports
            accounts={accounts}
            verifications={verifications}
            invoices={invoices}
            payrollRuns={payrollRuns}
            contacts={contacts}
            company={company}
            setCompanyInfo={setCompanyInfo}
            onNavigate={handleNavTabChange}
          />
        );
      case 'company':
        return (
          <CompanySettings 
            company={company} 
            updateCompany={setCompanyInfo} 
          />
        );
      case 'settings':
        return (
          <Settings
            company={company}
            setCompanyInfo={setCompanyInfo}
            accounts={accounts}
            verifications={verifications}
            invoices={invoices}
            quotes={quotes}
            expenses={expenses}
            contacts={contacts}
            projects={projects}
            onImport={handleImportData}
            onReset={handleResetData}
            stripeAccountId={company.stripeAccountId}
            onConnectStripe={handleOpenStripeOnboarding}
            onDisconnectStripe={handleDisconnectStripe}
            zettleConnected={Boolean(company.zettleAccessToken)}
            onConnectZettle={handleOpenZettleOnboarding}
            onConnectEmailDomain={handleConnectEmailDomain}
            onCheckEmailDomainStatus={handleCheckEmailDomainStatus}
            onDisconnectEmailDomain={handleDisconnectEmailDomain}
            user={user}
            companyList={companyList}
            activeCompanyId={data.activeCompanyId}
            onSwitchCompany={handleSwitchCompany}
            onAddCompany={() => setNewCompanyModal(true)}
            hideScrollbar={hideScrollbar}
            onToggleHideScrollbar={toggleHideScrollbar}
            sidebarStyle={sidebarStyle}
            onToggleSidebarStyle={toggleSidebarStyle}
            sharedAccess={currentCompany.__shared || null}
          />
        );
      default:
        return <Dashboard {...commonProps} invoices={invoices} expenses={expenses} contacts={contacts} setActiveTab={setActiveTab} company={company} />;
    }
  };

  return (
    <>
    <Suspense fallback={<RouteLoadingFallback />}>
      <>
            {passwordRecovery ? (
              // Klickad "Glömt lösenord?"-länk — MÅSTE vara FÖRSTA grenen,
              // före subscriptionGate/mfaChallenge nedan (kodgranskning/
              // Playwright-test: mount-effektens getSession()-anrop kör
              // fetchUserData rakt av så fort NÅGON session finns, inklusive
              // en tillfällig recovery-session — så subscriptionGate kunde
              // redan hinna bli 'blocked' innan denna grens egen check ens
              // hann köra. Utan den här ordningen såg en användare med
              // utgången provperiod/uppsagd prenumeration betalningsspärren
              // istället för att kunna återställa lösenordet — inlåst i en
              // cirkel (kan inte betala utan att kunna logga in, kan inte
              // återställa lösenordet för att komma in och betala).
              <PasswordRecoveryScreen onSubmit={handleSetNewPassword} onCancel={handlePasswordRecoveryCancel} />
            ) : subscriptionGate === 'blocked' ? (
              <PaymentRequiredGate user={user} />
            ) : mfaChallenge ? (
              // Rätt lösenord, men 2FA aktiverad och koden inte verifierad
              // än — se kommentaren vid mfaChallenge-state:t och
              // MfaChallengeScreen ovan. Måste ligga FÖRE !isLoggedIn-grenen
              // nedan: isLoggedIn blir aldrig true medan detta pågår
              // (fetchUserData pausar sig själv här), så utan den här grenen
              // hade Auth-skärmen bara visats igen.
              <MfaChallengeScreen onVerify={handleMfaVerify} onCancel={handleMfaCancel} />
            ) : !isLoggedIn ? (
              showLanding
                ? <LandingPage onEnterApp={() => setShowLanding(false)} />
                : <Auth onLogin={handleLogin} onBackToLanding={() => setShowLanding(true)} />
            ) : showOnboarding ? (
              // Bugkritiskt: `showOnboarding`/handleOnboardingComplete/
              // handleSkipOnboarding fanns redan helt färdigkopplade (även
              // "Fortsätt registreringen"-banderollen i Dashboard.jsx satte
              // showOnboarding=true) — men <OnboardingFlow> renderades
              // aldrig någonstans, så klicket gjorde bokstavligen ingenting.
              <OnboardingFlow
                onComplete={handleOnboardingComplete}
                onSkip={handleSkipOnboarding}
                initialCompanyName={company?.name}
                initialCompanyData={data.companies[data.activeCompanyId]}
              />
            ) : (
            <div className="app-container">

              {/* ── Sidebar overlay (mobil) ── */}

      {sidebarOpen && (
        <div
          className="sidebar-overlay visible"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        {/* Logo — klickbar till startsidan, med en tunn linje under (samma
            låg-kontrast-ton som skiljer nav-grupperna åt nedanför) så den
            känns avskild från "Startsida" istället för att glida ihop. */}
        <div className="logo-container">
          <BokixLogo onClick={() => handleNavTabChange('dashboard')} />
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 20px 8px', flexShrink: 0 }}></div>

        {/* Företagsväxlaren flyttad till Inställningar → Företag (Sida 38) —
            fanns tidigare här som en dropdown i sidomenyn. Byt-företag/
            lägg-till-företag är kvar (handleSwitchCompany, setNewCompanyModal),
            bara UI:t flyttat, se <Settings companyList/activeCompanyId/
            onSwitchCompany/onAddCompany> ovan. */}

        {/* Huvudnavigering — tre grupper, ingen linje mellan rader inom en grupp,
            bara en tunn låg-kontrast linje mellan grupperna. */}
        <nav className="nav-links" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, flexShrink: 0 }}>
          {[
            {
              // Grupp 1 — det dagliga arbetet
              items: [
                { id: 'dashboard', label: 'Startsida' },
                { id: 'contacts', label: 'Kunder' },
                { id: 'quotes', label: 'Offerter' },
                { id: 'invoices', label: 'Fakturering' },
                { id: 'expenses', label: 'Utgifter' },
                { id: 'projects', label: 'Projekt' },
              ],
            },
            {
              // Grupp 2 — bokföring och administration
              items: [
                { id: 'review', label: 'Granskning', badge: reviewCount },
                { id: 'verifications', label: 'Bokföring' },
                { id: 'payroll', label: 'Anställda och lön' },
                { id: 'reports', label: 'Rapport och analys' },
                { id: 'taxes', label: 'Skatt och bokslut' },
              ],
            },
            {
              // Grupp 3 — inställningar, ensam i sin egen grupp
              items: [
                { id: 'settings', label: 'Inställningar' },
              ],
            },
          ].map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 20px', flexShrink: 0 }}></div>}
              {group.items.map((item) => {
                const isActive = resolveNavGroup(activeTab) === resolveTab(item.id);
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavTabChange(item.id)}
                    style={{
                      padding: '13px 24px',
                      width: '100%',
                      textAlign: 'left',
                      background: isActive ? 'rgba(255,255,255,0.14)' : 'none',
                      border: 'none',
                      color: isActive ? '#ffffff' : 'rgba(255,255,255,0.88)',
                      fontSize: '15px',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <span>{item.label}</span>
                    {item.badge > 0 && (
                      <span style={{
                        minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px',
                        background: '#22c55e', color: 'white', fontSize: '12px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* Flexibelt tomt utrymme — trycker botten-sektionen längst ner oavsett skärmhöjd */}
        <div style={{ flex: 1 }}></div>

        {/* Fastsatt botten-sektion: Hjälp och support, sedan Logga ut */}
        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button
            className="nav-item"
            onClick={() => setIsHelpDrawerOpen(true)}
            style={{
              padding: '13px 24px', width: '100%', textAlign: 'left', background: 'none',
              border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
            }}
          >
            <HelpCircle size={17} /> Hjälp och support
          </button>
          <button
            className="nav-item logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              padding: '13px 24px', width: '100%', textAlign: 'left', background: 'none',
              border: 'none', color: '#fca5a5', fontSize: '15px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
            }}
          >
            <LogOut size={17} /> Logga ut
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-wrapper" key={activeTab}>

        {/* Desktop Top Bar */}
        <div className="desktop-top-bar">
          <div className="desktop-topbar-left" style={{ flex: 1, marginRight: '32px' }}>
            {/* Hamburger (mobil) */}
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Öppna meny"
            >
              <Menu size={22} />
            </button>
            {/* Företagsnamnet i topbaren togs bort på uttrycklig kundönskan
                (upplevdes som onödig text i huvudet på varje sida). Vilket
                företag man jobbar i syns fortfarande via profilmenyns
                "{company?.name}"-rad och vid företagsbyte (companyList/
                onSwitchCompany) — bara den passiva textetiketten här är
                borta. */}
          </div>

          <div className="desktop-topbar-right">
            <button className="topbar-icon-btn" title="Hjälp & support" onClick={() => setIsHelpDrawerOpen(true)}>
              <HelpCircle size={18} />
            </button>
            <button className="topbar-icon-btn" title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button className="topbar-icon-btn" title="Notiser" onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}>
                <Bell size={18} />
              </button>
              {notificationCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  {notificationCount}
                </span>
              )}
              {isNotifMenuOpen && (
                <div className="profile-dropdown notif-dropdown">
                  <div className="profile-header" style={{ paddingBottom: 4 }}>
                    <div className="profile-name">Notiser</div>
                  </div>
                  <div className="dropdown-divider"></div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>Inget nytt just nu</div>
                  ) : notifications.map((n, i) => (
                    <button key={i} onClick={() => { handleNavTabChange(n.tab); setIsNotifMenuOpen(false); }}>
                      <span style={{ width: 26, height: 26, borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--status-${n.tone}-bg)`, color: `var(--status-${n.tone}-text)` }}>
                        <n.icon size={13} />
                      </span>
                      {n.text}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div
                className="topbar-profile-trigger"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}
              >
                <div className="topbar-avatar" title={user?.email || 'Profil'}>
                  {(company?.name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={14} style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)' }} />
              </div>
              
              {isProfileMenuOpen && (
                <div className="profile-dropdown">
                  <div className="profile-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.green, color: 'white', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {(company?.name || user?.email || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="profile-name">{company?.name || 'Mitt Företag'}</div>
                        <div className="profile-role">{user?.email || 'användare@bokix.se'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { handleNavTabChange('profile'); setIsProfileMenuOpen(false); }}><User size={14} /> Profil</button>
                  <button onClick={() => { handleNavTabChange('settings'); setIsProfileMenuOpen(false); }}><SettingsIcon size={14} /> Inställningar</button>
                  <button onClick={() => { toggleTheme(); setIsProfileMenuOpen(false); }}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}
                  </button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { handleNavTabChange('accounts'); setIsProfileMenuOpen(false); }}><FolderTree size={14} /> Kontoplaner</button>
                  {/* Ingen egen "viktiga datum"-sida finns — Skatt & bokslut är
                      redan där deadlines (momsdeklaration, bokslut) visas, så
                      det är dit den rimligen ska peka istället för att inte
                      göra något alls. */}
                  <button onClick={() => { handleNavTabChange('taxes'); setIsProfileMenuOpen(false); }}><FileCheck size={14} /> Viktiga datum</button>
                  <button onClick={() => { handleNavTabChange('taxes_yearend'); setIsProfileMenuOpen(false); }}><Shield size={14} /> Bokslut & årsredovisning</button>
                  <button onClick={() => { handleNavTabChange('taxes_vat'); setIsProfileMenuOpen(false); }}><Calculator size={14} /> Momsredovisning</button>
                  <div className="dropdown-divider"></div>
                  {/* Samma mejladress/ämnesrad som felrapport-länken i
                      HelpDrawer.jsx — en riktig kanal istället för att bara
                      stänga menyn utan att göra något. */}
                  <button onClick={() => { window.location.href = 'mailto:support@bokix.se?subject=Felrapport%20-%20Bokix'; setIsProfileMenuOpen(false); }}><AlertTriangle size={14} /> Rapportera fel</button>
                  <button onClick={() => { setIsHelpDrawerOpen(true); setIsProfileMenuOpen(false); }}><HelpCircle size={14} /> Hjälp & support</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setNewCompanyModal(true); setIsProfileMenuOpen(false); }}><UsersRound size={14} /> Lägg till företag</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={async () => {
                    await supabase.auth.signOut();
                    clearLocalData();
                    setIsLoggedIn(false);
                    setShowOnboarding(false);
                  }} className="text-danger"><LogOut size={14} /> Logga ut</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile Top Bar */}
        <div className="global-top-bar">
          <div className="topbar-left">
            <button
              className="hamburger-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Öppna meny"
            >
              <Menu size={22} />
            </button>
            {/* Loggan syntes annars bara efter att man öppnat hamburgermenyn
                — den vanliga sidomenyn ligger dold bakom en CSS-transform på
                mobil, inte omonterad. Kompakt variant, samma klick till
                startsidan som i sidomenyn. */}
            <BokixLogo compact onClick={() => handleNavTabChange('dashboard')} />
            {/* topbar-page-title (sidnamnet, t.ex. "Kunder") togs bort här —
                kundfeedback: det dubblerade sidans egen <h1>-rubrik direkt
                under, så mobil-topbaren visade "Kunder" två gånger i rad. */}
          </div>
          <div className="global-actions">
            {/* Kundönskemål: hjälp/tema/notiser/profilmenyn fanns bara i
                .desktop-top-bar — på mobil fanns ingen väg dit alls förutom
                Hjälp & support som redan låg i sidomenyns fot. Tema och
                notiser är för vardagliga för att gömmas bakom hamburgaren,
                så de får egna ikoner här också; resten av profilmenyns
                punkter (Profil/Inställningar/Kontoplaner m.fl.) nås via
                samma avatar-knapp och .profile-dropdown som på desktop —
                se den mobilanpassade positioneringen i index.css. */}
            <button className="topbar-icon-btn" title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button className="topbar-icon-btn" title="Notiser" onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}>
                <Bell size={18} />
              </button>
              {notificationCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  {notificationCount}
                </span>
              )}
              {isNotifMenuOpen && (
                <div className="profile-dropdown notif-dropdown">
                  <div className="profile-header" style={{ paddingBottom: 4 }}>
                    <div className="profile-name">Notiser</div>
                  </div>
                  <div className="dropdown-divider"></div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>Inget nytt just nu</div>
                  ) : notifications.map((n, i) => (
                    <button key={i} onClick={() => { handleNavTabChange(n.tab); setIsNotifMenuOpen(false); }}>
                      <span style={{ width: 26, height: 26, borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--status-${n.tone}-bg)`, color: `var(--status-${n.tone}-text)` }}>
                        <n.icon size={13} />
                      </span>
                      {n.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div
                className="topbar-profile-trigger"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}
              >
                <div className="topbar-avatar" title={user?.email || 'Profil'}>
                  {(company?.name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
              </div>
              {isProfileMenuOpen && (
                <div className="profile-dropdown">
                  <div className="profile-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.green, color: 'white', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {(company?.name || user?.email || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="profile-name">{company?.name || 'Mitt Företag'}</div>
                        <div className="profile-role">{user?.email || 'användare@bokix.se'}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { handleNavTabChange('profile'); setIsProfileMenuOpen(false); }}><User size={14} /> Profil</button>
                  <button onClick={() => { handleNavTabChange('settings'); setIsProfileMenuOpen(false); }}><SettingsIcon size={14} /> Inställningar</button>
                  <button onClick={() => { toggleTheme(); setIsProfileMenuOpen(false); }}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}
                  </button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { handleNavTabChange('accounts'); setIsProfileMenuOpen(false); }}><FolderTree size={14} /> Kontoplaner</button>
                  <button onClick={() => { handleNavTabChange('taxes'); setIsProfileMenuOpen(false); }}><FileCheck size={14} /> Viktiga datum</button>
                  <button onClick={() => { handleNavTabChange('taxes_yearend'); setIsProfileMenuOpen(false); }}><Shield size={14} /> Bokslut & årsredovisning</button>
                  <button onClick={() => { handleNavTabChange('taxes_vat'); setIsProfileMenuOpen(false); }}><Calculator size={14} /> Momsredovisning</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { window.location.href = 'mailto:support@bokix.se?subject=Felrapport%20-%20Bokix'; setIsProfileMenuOpen(false); }}><AlertTriangle size={14} /> Rapportera fel</button>
                  <button onClick={() => { setIsHelpDrawerOpen(true); setIsProfileMenuOpen(false); }}><HelpCircle size={14} /> Hjälp & support</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setNewCompanyModal(true); setIsProfileMenuOpen(false); }}><UsersRound size={14} /> Lägg till företag</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={async () => {
                    await supabase.auth.signOut();
                    clearLocalData();
                    setIsLoggedIn(false);
                    setShowOnboarding(false);
                  }} className="text-danger"><LogOut size={14} /> Logga ut</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="main-content-inner">
          <Suspense fallback={<PageContentSkeleton tab={activeTab} />}>
            {/* Kundfeedback ("menyn står i vägen"): den fasta bottennaven
                (.mobile-bottom-nav, en syskon-yta UTANFÖR .main-wrapper)
                döljer alltid de sista ~100px av VILKEN mobilsida som helst.
                Tre steg innan den här löste det INTE:
                1) padding-bottom på .main-wrapper (den skrollande
                   behållaren själv) — bekräftat i test (höjde
                   --mobile-nav-height till 400px, scrollHeight ändrades
                   inte alls) att Chromium inte räknar en flex-behållares
                   EGEN slut-padding som skrollbart innehåll.
                2) padding-bottom på .main-content-inner (flex-BARNET) —
                   samma resultat, av ett djupare skäl: .main-content-inner
                   > * (index.css) ger sidans rot-div `flex:1; min-height:0`,
                   vilket tvingar NER dess egen box till bara den yta som
                   får plats (oavsett hur högt innehållet egentligen är) —
                   resten "sticker ut" via overflow:visible. Padding på
                   FÖRÄLDERN till en sådan hopklämd box syns aldrig i
                   scrollHeight, bara innehållets EGEN overflow gör det.
                3) ett riktigt spacer-element som SYSKON till
                   .main-content-inner — samma icke-effekt, av samma skäl
                   fast ur en annan vinkel: ett syskon positioneras efter
                   den hopklämda boxens EGEN (lilla) höjd, inte efter var
                   dess overflow-innehåll faktiskt slutar längre ner.
                Lösningen: ett EXTRA lager HÄR, INNANFÖR Suspense, som
                sidans rot-div (renderContent()) och spacern delar. Den
                nya diven ÄRVER `.main-content-inner > *`s flex:1/min-
                height:0 (den är nu den direkta barnet) och kläms ihop
                precis som förut — men eftersom den själv bara är ett
                vanligt block-element (ingen egen flex/min-height-regel
                på DESS barn) läggs sidans rot-div och spacern ut i
                NORMALT dokumentflöde inuti den. Sidans rot-div får då
                växa till sin RIKTIGA innehållshöjd (ingen min-height:0
                tvingar ihop den längre på den här nivån), och spacern
                hamnar äntligen genuint EFTER den — vilket räknas in i
                .main-wrapper:s scrollHeight på riktigt, exakt samma
                mekanism som redan lät sidans overflow nå upp genom alla
                lager till .main-wrapper innan den här fixen. */}
            <div className="page-content-with-spacer">
              {renderContent()}
              <div className="mobile-nav-spacer" aria-hidden="true" />
            </div>
          </Suspense>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation (Sida 26) ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobilnavigation">
        <div className="mobile-bottom-nav-inner">
          {mobileNavItems.map(item => {
            const isActive = resolveNavGroup(activeTab) === resolveTab(item.id);
            return (
              <button
                key={item.id}
                className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => handleNavTabChange(item.id)}
              >
                <span className="mobile-nav-icon"><item.icon size={23} /></span>
                <span>{item.label}</span>
              </button>
            );
          })}
          {/* "Meny" — öppnar en bottensheet, navigerar inte till en egen sida direkt.
              Bugkritiskt: dess aktiva tillstånd följer samma activeTab/route-state
              som resten av naven (isMobileSheetItemActive), inte en egen parallell
              state — så den lyser grönt även när man kommit till t.ex. Rapporter
              via en länk inifrån en annan sida, inte bara via sheeten själv. */}
          <button
            className={`mobile-nav-btn ${isMobileSheetItemActive ? 'active' : ''}`}
            onClick={() => setMobileMoreOpen(true)}
            aria-haspopup="true"
            aria-expanded={mobileMoreOpen}
          >
            {/* Fortnox-jämförelsen: "Meny" (inte "Mer") med samma
                hamburgerikon som appens övriga menyknappar, istället för
                tre prickar — matchar det fjärde navvalet i referensbilden. */}
            <span className="mobile-nav-icon"><Menu size={23} /></span>
            <span>Meny</span>
          </button>
        </div>
      </nav>

      <div className={`mobile-sheet-overlay ${mobileMoreOpen ? 'open' : ''}`} onClick={() => setMobileMoreOpen(false)} />
      <div className={`mobile-sheet ${mobileMoreOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Fler sidor">
        <div className="mobile-sheet-handle" />
        {mobileSheetItems.map(item => {
          const isActive = resolveNavGroup(activeTab) === resolveTab(item.id);
          return (
            <button
              key={item.id}
              className={`mobile-sheet-item ${isActive ? 'active' : ''}`}
              onClick={() => { handleNavTabChange(item.id); setMobileMoreOpen(false); }}
            >
              <span className="mobile-sheet-item-icon"><item.icon size={18} /></span>
              {item.label}
            </button>
          );
        })}
      </div>

      {/* ── New Company Modal ── */}
      {newCompanyModal && (
        <div className="modal-overlay" onClick={() => setNewCompanyModal(false)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Skapa nytt företag</h2>
              <button className="modal-close" onClick={() => setNewCompanyModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleCreateCompany(); }}>
              <div className="form-group">
                <label className="form-label">Företagsnamn *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="T.ex. Mitt Företag AB"
                  value={newCompanyName}
                  onChange={e => setNewCompanyName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">Organisationsnummer</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="XXXXXX-XXXX"
                  value={newCompanyOrg}
                  onChange={e => setNewCompanyOrg(e.target.value)}
                />
                <span className="form-hint">Kan fyllas i senare under Inställningar</span>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setNewCompanyModal(false)}>
                  Avbryt
                </button>
                <button type="submit" className="btn btn-primary" disabled={!newCompanyName.trim()}>
                  <Plus size={16} /> Skapa företag
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* ── Help Drawer ── */}
      <HelpDrawer
        isOpen={isHelpDrawerOpen}
        onClose={() => setIsHelpDrawerOpen(false)}
        onOpenGuide={() => { setIsHelpDrawerOpen(false); setShowOnboarding(true); }}
      />

      {/* ── Toast — ersätter blockerande alert() för t.ex. "Stripe är nu
          ansluten", se stripe_connect-useEffect ── */}
      <Toast message={toast?.message} variant={toast?.variant} onClose={() => setToast(null)} />

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Logga ut</h2>
              <button className="modal-close" onClick={() => setShowLogoutConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6">Är du säker på att du vill logga ut?</p>
              <div className="flex justify-end gap-3">
                <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>
                  Avbryt
                </button>
                <button className="btn btn-danger" style={{ backgroundColor: '#ef4444', color: 'white' }} onClick={async () => {
                  setShowLogoutConfirm(false);
                  await supabase.auth.signOut();
                  clearLocalData();
                  setIsLoggedIn(false);
                  setShowOnboarding(false);
                }}>
                  Logga ut
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    )}
    </>
    </Suspense>
    </>
  );
}

export default App;
