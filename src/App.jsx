import React, { useState, useEffect, useCallback, useRef, Suspense, lazy, startTransition } from 'react';
import useFitLevel from './utils/useFitLevel';
import { visiblePages, accessForPage, canWriteField } from './utils/pageAccess';
import { STRIPE_BALANCE_ACCOUNT } from './utils/stripeLedger';
import { isUfCompany, ufPageState, ufInvoiceQuota, ufFreePeriod, UF_NAV_IDS, UF_HIDDEN_REPORT_IDS } from './utils/ufMode';
import { t as tr, useTranslation } from './i18n';
import {
  ReceiptText,
  Loader2,
  Users,
  Building2,
  BookOpen,
  Landmark,
  BarChart3,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronRight,
  X,
  Calculator,
  Menu,
  Sun,
  Bell,
  HelpCircle,
  Briefcase,
  NavQuotesIcon, NavReceiptsIcon, NavHomeIcon, NavCustomerInvoicesIcon, NavSupplierInvoicesIcon, NavPayrollIcon,
  LogOut,
  Moon,
  AlertTriangle,
  Lock,
  Package,
  ClipboardCheck,
  Check,
  Banknote, CalendarClock,
} from './components/icons';
import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './components/AccountsData';
import { BAS_VERSION, upgradeAccountsToBas } from './utils/basUpgrade';
import { receiptAttachmentFields, backfillReceiptAttachments } from './utils/receiptAttachment';
import { getNextInvoiceNumber } from './utils/invoiceNumbering';
import { createStripeCheckoutSession, createStripeSubscriptionCheckout, cancelStripeSubscription, syncStripeSubscription } from './stripeApi';
import { createEmailDomain, getEmailDomainStatus, sendInvoiceEmail } from './emailApi';
import { sendableEmail } from './utils/validators';
import { getDebet, getKredit, withRoundingBalance } from './utils/verificationAmounts';
import { describeForeign } from './utils/foreignCurrency';
import { convertToSek } from './utils/currencyConversion';
import { invoiceBookingRows } from './utils/invoiceBooking';
import { grossInvoiceAmount } from './utils/reportCalculations';
import { calcRotRutDeduction, invoiceCustomerDue, invoiceCustomerRemaining } from './utils/rotRutConfig';
import { applyCreditNotes } from './utils/creditNotes';
import { mergeImportedEmployees } from './utils/employeeCsv';
import { planFromId } from './utils/plans';
import { detectOrgType } from './utils/orgType';
import { captureEvent } from './utils/posthog';
import { reconcileSieOpenings, applySieOpeningReconcile } from './utils/sieOpeningReconcile';
import { sieImportTagOf } from './utils/sieImportBatches';
import { OPTIONAL_FEATURES, isFeatureOn, hiddenFeatureNavIds } from './utils/optionalFeatures';
import { buildNotificationFeed, readSeenKeys, writeSeenKeys, isUnread, notificationWhen } from './utils/notificationFeed';
import { nextVatDeadline, nextAgiDeadline, vatContextFor } from './utils/declarationDeadlines';
import { guidesForPage } from './utils/pageGuides';
import { GuideContext } from './components/shared/GuideContext';
import GuideModal from './components/GuideModal';
import { registerUndo, showUndo, restoreAt } from './components/shared/undoToast';
import { resultAccountFor, buildYearEndClosing } from './utils/yearEnd';
import { BRAND } from './utils/brandColors';
import { vatSettlementRows } from './utils/vatCalculation';
import { isReverseChargePurchaseAccount, withReverseChargeRows } from './utils/reverseCharge';
import { COMPANY_WRITABLE_FIELDS } from './utils/companyFields.js';
import { deleteFileFromStorage } from './utils/fileUpload';
import { collectStorageUrls } from './utils/storageUrls';
import { computeEmployeePayroll, summarizePayrollRun, FEE_RULES_VERSION } from './utils/payrollCalculation';
import BokixWordmark, { BokixMark } from './components/shared/BokixWordmark';
import MobileTopTitle from './components/shared/MobileTopTitle';
import { installMobileKeyboard } from './utils/mobileKeyboard';
import PullToRefresh from './components/shared/PullToRefresh';
import { seriesForSource, getNextNumber as getNextVerificationNumber } from './utils/verificationNumbering';

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
      title={tr('ui.till_startsidan')}
      // Kundfeedback ("den ska vara i mitten, inte for mycket at hoger eller
      // vanster"): loggan satt vansterjusterad i sin fullbredds-ruta
      // (flex-column utan alignItems stracker BARNET, men en SVG har egen
      // intrinsic bredd sa den hamnade kvar vid startkanten istallet).
      // alignItems:'center' centrerar den horisontellt i sidomenyns
      // logga-yta.
      // Uppföljning ("amazing i helskärm, för stor/för mycket luft i
      // halvskärm och på mobilen"): storlek/padding flyttade från inline
      // style (fast pixelvärde oavsett fönsterbredd) till CSS-klasser
      // (index.css) — bara CSS kan svara på @media-brytpunkter. Se
      // .bokix-logo-btn--full/--compact + .bokix-wordmark--full/--compact.
      className={compact ? 'bokix-logo-btn bokix-logo-btn--compact' : 'bokix-logo-btn bokix-logo-btn--full'}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.82'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
    >
      {/* Ingen tagline längre — den hör hemma på marknadssidan, inte i det
          dagliga arbetsverktyget. Loggan får nu eget utrymme och är
          märkbart större eftersom den inte längre delar ytan med en rad text.
          Kundfeedback (upprepad): fortfarande för liten både i sidomenyn och
          i mobil-topbaren — ytterligare en storleksökning här, samma
          proportion bevarad på båda varianterna. */}
      <BokixWordmark
        height={compact ? 37 : 62}
        className={compact ? 'bokix-wordmark--compact' : 'bokix-wordmark--full'}
      />
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
      setError(err.message || tr('ui.fel_kod_forsok_igen'));
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
    <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, padding: '24px', fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '22px', padding: '36px 32px', boxShadow: '0 12px 40px -8px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', boxSizing: 'border-box' }}>
        <BokixWordmark height={40} />

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{tr('ui.tvastegsverifiering')}</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{tr('ui.ange_den_6_siffriga_koden_fran_din_autentisering')}</p>
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
              aria-label={tr('ui.siffra_av_6', { v0: i + 1 })}
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
              {tr('ui.verifierar')}
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
          {tr('ui.verifiera')}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
          {tr('ui.avbryt_och_logga_ut')}
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
    if (password.length < 8) { setError(tr('ui.losenordet_maste_vara_minst_8_tecken')); return; }
    if (password !== password2) { setError(tr('ui.losenorden_matchar_inte')); return; }
    setError('');
    setLoading(true);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err.message || tr('ui.kunde_inte_uppdatera_losenordet_forsok_igen'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh / var(--app-zoom, 1))', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BRAND.greenLight, padding: '24px', fontFamily: "'Inter', sans-serif" }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '22px', padding: '36px 32px', boxShadow: '0 12px 40px -8px rgba(15,23,42,0.18)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', boxSizing: 'border-box' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '16px', flexShrink: 0,
          background: `linear-gradient(160deg, ${BRAND.green}, #0e3a2a)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px -6px color-mix(in srgb, var(--accent) 60%, transparent)',
        }}>
          <Lock size={26} color="white" strokeWidth={2.2} />
        </div>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>{tr('ui.skapa_nytt_losenord')}</h2>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{tr('ui.ange_ett_nytt_losenord_for_ditt_konto')}</p>
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            type="password" autoFocus autoComplete="new-password" placeholder={tr('ui.nytt_losenord_minst_8_tecken')}
            value={password} onChange={e => setPassword(e.target.value)} disabled={loading} minLength={8} required
            style={{ width: '100%', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: '10px', fontSize: '14.5px', color: 'var(--text-main)', background: 'var(--bg-muted)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <input
            type="password" autoComplete="new-password" placeholder={tr('ui.upprepa_nytt_losenord')}
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
          {loading ? tr('ui.uppdaterar') : tr('ui.uppdatera_losenord')}
        </button>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', textAlign: 'center', fontFamily: 'inherit' }}>
          {tr('ui.avbryt_och_logga_ut')}
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
const Articles = lazy(() => import('./components/Articles'));
const Expenses = lazy(() => import('./components/Expenses'));
const SupplierInvoices = lazy(() => import('./components/SupplierInvoices'));
const Contacts = lazy(() => import('./components/Contacts'));
const Verifications = lazy(() => import('./components/Verifications'));
const Bank = lazy(() => import('./components/Bank'));
const Reports = lazy(() => import('./components/Reports'));
const Settings = lazy(() => import('./components/Settings'));
const Projects = lazy(() => import('./components/Projects'));
const TimeTracking = lazy(() => import('./components/TimeTracking'));
const Payroll = lazy(() => import('./components/Payroll'));
const Taxes = lazy(() => import('./components/Taxes'));
// Flikarna under Bokföring hämtas i förväg när sidan öppnas (se useEffect
// på activeTab nedan), annars stod Verifikationer kvar en stund efter klicket.
const loadFixedAssets = () => import('./components/FixedAssets');
const loadAccruals = () => import('./components/Accruals');
const FixedAssets = lazy(loadFixedAssets);
const Accruals = lazy(loadAccruals);
// Alla ANDRA marknads-/juridiksidor (FeaturesPage/PricingPage/AboutPage/
// ContactPage/PrivacyPolicy/TermsPolicy/
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
import { registrySyncDue } from './utils/companyRegistry';
import { requestRegistrySync } from './utils/companyLookup';
import VatPeriodPrompt, { needsCompanyFactsAnswer } from './components/VatPeriodPrompt';
import { isVatExempt, stripVatRows } from './utils/vatRegistration';
import { supabase } from './supabaseClient';
import { isStandaloneApp, isPasswordRecovery, clearPasswordRecovery } from './utils/authStorage';
import { translateSupabaseAuthError } from './utils/translateAuthError';
import { isInactiveTooLong, markActive, clearActive, appLockEnabledFor, setAppLock, APP_LOCK_AFTER_MS, passkeysAvailable, rememberPasskeyOnDevice } from './utils/sessionPolicy';
import AppLock from './components/AppLock';
import { detectDevice } from './utils/deviceInfo';
import { useLocation, useNavigate } from 'react-router-dom';
const ReviewQueue = lazy(() => import('./components/ReviewQueue'));
import HelpDrawer from './components/HelpDrawer';
import Toast from './components/shared/Toast';
import { ConfirmDialogHost, confirmDialog } from './components/shared/ConfirmDialog';
import PaymentRequiredGate from './components/PaymentRequiredGate';
// Spärrsidan för funktioner som inte ingår i UF-läget (utils/ufMode.js).
// Statisk import av samma skäl som PaymentRequiredGate ovan: några rader
// markup som hör till renderingen av en helt vanlig flik — en lazy-gräns
// runt den hade bara lagt till en laddningsruta för ingenting.
import UfLockedPage from './components/UfLockedPage';
import { maybeAutoStartTour, startProductTourWhenReady } from './utils/productTour';
import { startInvoiceTourWhenReady } from './utils/invoiceTour';
import { mergeCompanies, mergeCompany, makeRecordPatch, buildStateDelta, sharedFieldsToSave } from './utils/stateMerge';
import { readServerState, rememberServerState, isCacheUsable, noteCachedAt, clearServerState } from './utils/serverStateCache';
import { shadowReadDue, scheduleShadowRead } from './utils/shadowRead';
import { loadFromTables, saveToTables } from './utils/tableStore';
import { reportClientError } from './utils/errorReporting';
import { finishLoginTiming } from './utils/loginTiming';

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh / var(--app-zoom, 1))', background: 'var(--bg-page)' }}>
      <Loader2 size={28} color="var(--text-muted)" style={{ animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

// Sidomenyns grupper/etiketter speglade från den RIKTIGA <nav> längre ner
// (samma grupper, samma ordning) — bara så AppLoadingSkeleton kan visa
// exakt samma radlängder OCH markera rätt rad som aktiv, istället för sex
// gissade streck utan koppling till vilken sida man faktiskt ska in på.
const SKELETON_NAV_GROUPS = [
  ['dashboard', 'review'],
  ['contacts', 'quotes', 'invoices', 'articles', 'projects'],
  ['expenses', 'supplier_invoices', 'payroll'],
  ['bank', 'verifications', 'reports', 'taxes'],
];
// Bredd i % per nav-rad (samma etiketter som riktiga <nav>:en, fast som
// streck) — statiska tal räcker, det är bara en siluett.
const SKELETON_NAV_WIDTHS = { dashboard: 40, review: 56, contacts: 50, articles: 52, quotes: 56, invoices: 68, expenses: 58, supplier_invoices: 84, bank: 40, verifications: 60, projects: 52, payroll: 78, reports: 82, taxes: 70, settings: 64 };

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
// samma form som Settings.jsx faktiska formulär.
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
    <div className="app-container" aria-busy="true" aria-label={tr('ui.laddar_bokix')}>
      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh / var(--app-zoom, 1))' }}>
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
      //
      // Bugkritiskt, hittat 2026-09-22: id:t genererades tidigare ALLTID nytt
      // här, även när anroparen uttryckligen skickade med ett befintligt
      // (companyInfo.id) — handleResetData ("Radera företagets
      // bokföringsdata") gör exakt det, för att företaget ska förbli samma
      // företag, bara tomt. Resultatet var att raden i data.companies
      // stannade kvar under det GAMLA id:t (det är fortfarande
      // objektnyckeln, oförändrad), men det NÄSTLADE company.id-fältet —
      // det som faktiskt skickas som company_id till servern vid varje
      // e-postutskick, betalningslänk m.m. — tyst blev ett helt NYTT,
      // aldrig sparat id. Servern letade sedan efter det nya, påhittade
      // id:t i användarens sparade data, hittade förstås ingenting, och gav
      // "Du har inte längre åtkomst till det här företaget." trots att
      // ägarskapet av det RIKTIGA företaget var helt intakt. Faller nu
      // tillbaka på ett nytt slumpat id bara när inget skickas med, precis
      // som för en genuint ny signup (de anropsställena skickar aldrig
      // med id).
      id: companyInfo.id || `company_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: companyInfo.name || 'Nytt företag',
      orgNr: companyInfo.orgNr || '',
      // ── UF-läget (utils/ufMode.js) ──
      // Sätts vid registreringen (Auth.jsx → user_metadata.uf) och ändras
      // aldrig efteråt: ett UF-företag är en egen sorts företag hela
      // läsåret, inte ett läge man slår av och på. Frånvarande/false på
      // varje annat företag, och hela UF-läget är då ett no-op.
      isUf: Boolean(companyInfo.isUf),
      // Nytt konto: onboardingen (OnboardingFlow.jsx) visas tills den är
      // klar eller överhoppad. Bara kontots första företag får den, så
      // befintliga kunder ser den aldrig.
      ...(companyInfo.needsSetup ? { needsSetup: true } : {}),
      // Skolan UF-företaget hör till. Rent informativt (visas i
      // Inställningar → Företag och på fakturan där ett vanligt företag
      // har sitt organisationsnummer) — ett UF-företag har oftast inget
      // eget organisationsnummer att skriva dit.
      ufSchool: companyInfo.ufSchool || '',
      // När gratisperioden började räknas. Speglad från
      // user_metadata.uf_started_at så appen kan visa "X dagar kvar" utan
      // att läsa auth-metadata i varje komponent.
      ufStartedAt: companyInfo.ufStartedAt || '',
      vatNr: companyInfo.vatNr || '',
      // Momsregistrerat? true/false från frågan när företaget läggs upp
      // (förvalt ur EU:s momsregister, se FiscalYearVatFields.jsx), null
      // när det aldrig besvarats (äldre företag).
      vatRegistered: typeof companyInfo.vatRegistered === 'boolean' ? companyInfo.vatRegistered : null,
      // Gata, postnummer och ort, se utils/companyAddress.js. Förifyllda
      // från företagsregistret när de hittades vid registreringen eller i
      // "Lägg till företag".
      address: companyInfo.address || '',
      postalCode: companyInfo.postalCode || '',
      city: companyInfo.city || '',
      // Kundönskemål: "din e-post ska redan stå där" — förifylld från
      // kontots EGEN e-post vid registreringen (första företaget skapas
      // alltid direkt efter signUp(), se anropsstället nedan) så
      // användaren slipper skriva in samma adress två gånger. Fortfarande
      // fritt redigerbart (t.ex. en egen faktura-e-post istället för
      // kontoinloggningen) — bara förvalet som ändras, inget nytt
      // obligatoriskt fält.
      email: companyInfo.email || '',
      phone: '',
      logoUrl: companyInfo.logoUrl || '',
      // Den rätta lydelsen sedan 2009 (F-skattsedeln finns inte längre).
      // Ett nytt konto väljer själv i onboardingen (OnboardingFlow.jsx).
      fSkatt: 'Godkänd för F-skatt',
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
      resendDomainToken: '', // serverns signatur över id + företag, se _resend.js
      emailDomainStatus: '', // '' | 'pending' | 'verified' | 'failed'
      emailDomainRecords: [],
      // Bank – CSV/Excel-import (Bank.jsx): ihågkommen kolumnmappning per
      // bank, nyckel = fingerprintHeaders(kolumnrubriker) (bankImport.js).
      // Nästlad här (inte ett eget toppnivåfält på företaget) så den slipper
      // en egen post i COMPANY_WRITABLE_FIELDS/set_company_field-vitlistan
      // — 'company' är redan skrivbart.
      bankImportProfiles: {},
      // Flera bankkonton (kundönskemål: "byta bank, namnge kontot, importera
      // dit, se vilket konto som hör till vilken bokföring"). Tomt = det
      // gamla enkontsläget: Bank.jsx syntetiserar då själv ETT konto i
      // minnet (id 'default', kopplat mot 1930) utan att skriva något här,
      // så en användare som aldrig rör funktionen ser ingen skillnad alls.
      // Arrayen blir bara verklig (persisteras) första gången ett andra
      // konto läggs till — se handleSaveBankAccount i Bank.jsx.
      // Varje post: { id, name, ledgerAccount, isDefault? }.
      bankAccounts: [],
      defaultVat: 25,
      fiscalYear: companyInfo.fiscalYear || `${new Date().getFullYear()}-01-01`,
      // Företagets första räkenskapsår om det avviker ({ start, end }),
      // annars null. De vanliga åren följer fiscalYear.
      firstFiscalYear: companyInfo.firstFiscalYear || null,
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
    basVersion: BAS_VERSION,
    verifications: [],
    invoices: [],
    // Egen lista, inte samma array som `invoices` med ett `type`-fält som
    // urskiljare — se normalizeCompanyData nedan för varför. Fortnox/Bokio
    // och alla andra stora håller offerter och fakturor helt åtskilda så
    // att en offert aldrig kan räknas som bokföringsunderlag av misstag.
    quotes: [],
    expenses: [],
    contacts: [],
    // Sparade produkter/tjänster (artikelnr/benämning/pris/momssats) att
    // återanvända i stället för att skriva om samma rad för hand varje gång
    // — egen sida (Articles.jsx), valbara både på fakturor (Invoices.jsx)
    // och offerter (Quotes.jsx).
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
    // Bank – CSV/Excel-import (Bank.jsx). Företag som fanns innan den här
    // funktionen skeppades har inget generellt backfill-steg (finns inte i
    // kodbasen — se normalizeCompanyData nedan, som bara gör en engångs-
    // migrering av offerter/fakturor) — Bank.jsx defaultar därför själv
    // via `bankTransactions = []` i sin prop-destrukturering, samma
    // konvention som `expenses = []` i Invoices.jsx.
    bankTransactions: [],
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

// ──────────────────────────────────────────────
// MIGRERING: kontoplanens `active`/`system`-flaggor efterhandsinsatta
// ──────────────────────────────────────────────
// Bugkritiskt (kundfeedback: "Mina konton visar noll för mig"): `active`
// (Kontoplan-fliken, se Verifications.jsx + AccountsData.js) lades till i
// DEFAULT_ACCOUNTS efter att befintliga företag redan hade sin EGEN,
// sparade kopia av kontolistan (tagen vid företagsskapandet, se
// createEmptyCompanyData ovan — `accounts: [...DEFAULT_ACCOUNTS]` kopierar
// bara VÄRDET vid den tidpunkten, den följer aldrig med senare ändringar i
// själva DEFAULT_ACCOUNTS-filen). Ett företag skapat innan den här
// funktionen fanns har alltså en `accounts`-array helt utan `active`/
// `system`-fält — "Mina konton" (som filtrerar på just de fälten) visade
// därför en tom lista, inte de 53 tänkta kontona.
//
// Backfillar bara fält som FAKTISKT saknas (`active === undefined`) genom
// att slå upp samma kontokod i dagens DEFAULT_ACCOUNTS — rör aldrig ett
// konto som redan har `active` satt (true ELLER false), det är antingen
// redan migrerat eller ett riktigt, medvetet val användaren gjort via
// växeln (handleToggleAccountActive slår alltid om till ett riktigt
// booleskt värde, aldrig tillbaka till undefined). Ett konto som inte
// finns i DEFAULT_ACCOUNTS alls (t.ex. ett eget tillagt) lämnas orört.
//
// Lägger ÄVEN till de `system: true`-konton (appen bokför mot dem själv,
// t.ex. 2621/2631 för 12/6 % utgående moms) som saknas HELT i ett gammalt
// företags egen kontolista — inte bara flaggan på ett konto som redan
// finns. Bugkritiskt eget fynd, samma "kundens egen kontoplansdata avslöjade
// det"-bugg som vatConfig.js: ett företag skapat innan 2621/2631 fanns i
// DEFAULT_ACCOUNTS har fortfarande sitt gamla, felaktiga 2612/2613 i sin
// sparade lista — de tas ALDRIG bort (ingen gissning om att döpa om ett
// konto med egen bokföringshistorik), men utan den här raden hade en
// momsbokning på 12/6 % efter bugfixen bokförts mot rätt kod (2621/2631)
// samtidigt som kontot självt inte fanns i Kontoplanen/Verifikationer för
// just det företaget — rätt siffra, men ett namnlöst konto i vyn.
function migrateAccountActiveFlags(accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) return accounts;
  const defaultsByCode = new Map(DEFAULT_ACCOUNTS.map(a => [a.code, a]));
  // De allra flesta av ~1200 konton får ALDRIG ett `active`-fält (bara den
  // kurerade delmängden i DEFAULT_ACCOUNTS har ett) — en `.every(active
  // !== undefined)`-snabbväg (som en första version av den här funktionen
  // hade) skulle alltså aldrig slå till, och funktionen skulle göra om
  // HELA .map():et på varenda sidladdning för alltid, även efter att
  // migreringen redan kört klart en gång. `changed` nedan är den riktiga
  // frågan: blev NÅGOT konto faktiskt annorlunda? Bara då byggs en ny
  // array — annars kommer exakt samma referens tillbaka, och anroparen
  // (normalizeCompanyData) kan då korrekt känna igen "redan migrerat,
  // inget att skriva".
  let changed = false;
  const next = accounts.map(a => {
    if (a.active !== undefined) return a;
    const def = defaultsByCode.get(a.code);
    if (!def || def.active === undefined) return a;
    changed = true;
    return { ...a, active: def.active, ...(def.system !== undefined ? { system: def.system } : {}) };
  });
  const existingCodes = new Set(next.map(a => a.code));
  const missingSystemAccounts = DEFAULT_ACCOUNTS.filter(d => d.system && !existingCodes.has(d.code));
  if (missingSystemAccounts.length > 0) changed = true;
  return changed ? [...next, ...missingSystemAccounts] : accounts;
}

function normalizeCompanyData(companyData) {
  if (!companyData) return companyData;
  const { invoices, quotes: strayQuotes } = splitInvoicesAndQuotes(companyData.invoices);
  const quotes = Array.isArray(companyData.quotes)
    ? [...companyData.quotes, ...strayQuotes]
    : strayQuotes;
  let accounts = migrateAccountActiveFlags(companyData.accounts);
  // En gång per företag: alla konton i BAS 2026, nya namn, sorterat
  // (utils/basUpgrade.js). Delade företag (__shared) ägs av någon annan och
  // uppgraderas när ägaren loggar in.
  const needsBas = Array.isArray(accounts) && !companyData.__shared && companyData.basVersion !== BAS_VERSION;
  if (needsBas) accounts = upgradeAccountsToBas(accounts, DEFAULT_ACCOUNTS);
  // Bokförda kvitton som saknar underlag i verifikationen får kvittots fil
  // (utils/receiptAttachment.js). Rör bara underlagsfälten.
  const verifications = backfillReceiptAttachments(companyData.verifications, companyData.expenses);
  if (!needsBas && verifications === companyData.verifications && invoices.length === (companyData.invoices || []).length && Array.isArray(companyData.quotes) && accounts === companyData.accounts) {
    return companyData; // redan migrerat, inget att göra
  }
  return { ...companyData, invoices, quotes, accounts, ...(verifications !== companyData.verifications ? { verifications } : {}), ...(needsBas ? { basVersion: BAS_VERSION } : {}) };
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
  // Webbläsarens lokala lagring rymmer bara ca 5 MB. Ett stort företag, eller
  // en konsult med många kunders företag, går över det, och då ska bara
  // den lokala kopian utebli. Sparningen till Supabase måste ändå köras.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }
  if (ownerId) {
    try { localStorage.setItem(STORAGE_OWNER_KEY, ownerId); } catch { /* privat läge etc. */ }
  }
}

// Kopian skrevs förut vid VARJE ändring i appen: hela kontot som text,
// synkront, flera MB i ett stort företag. Nu skrivs den när webbläsaren är
// ledig (högst en gång i taget, den senaste versionen) och direkt när fliken
// göms eller stängs, så att inget går förlorat.
let pendingLocalSave = null;
let localSaveHandle = null;
function cancelLocalSaveTimer() {
  if (!localSaveHandle) return;
  if (localSaveHandle.idle != null && typeof cancelIdleCallback === 'function') cancelIdleCallback(localSaveHandle.idle);
  if (localSaveHandle.timer != null) clearTimeout(localSaveHandle.timer);
  localSaveHandle = null;
}
function flushLocalSave() {
  cancelLocalSaveTimer();
  const pending = pendingLocalSave;
  pendingLocalSave = null;
  if (pending) saveData(pending.data, pending.ownerId);
}
function scheduleLocalSave(data, ownerId) {
  pendingLocalSave = { data, ownerId };
  if (localSaveHandle) return;
  localSaveHandle = typeof requestIdleCallback === 'function'
    ? { idle: requestIdleCallback(flushLocalSave, { timeout: 3000 }) }
    : { timer: setTimeout(flushLocalSave, 1500) };
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushLocalSave);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushLocalSave(); });
}

function clearLocalData() {
  // En väntande skrivning får aldrig lägga tillbaka kopian efter utloggning.
  pendingLocalSave = null;
  cancelLocalSaveTimer();
  clearServerState();
  clearActive();
  setAppLock(null);
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
  // 'bank' hade tidigare en död platshållare här ('bank' → 'dashboard') —
  // Bank.jsx (Bank – CSV/Excel-import) finns nu på riktigt som 'bank', och
  // resolveTab (nedan) faller redan tillbaka på id:t självt när det saknas
  // här, så ingen alias-rad behövs längre.
  taxes_vat:        'taxes',
  taxes_yearend:    'taxes',
  time:             'projects',
  accounts:         'verifications',
  // Periodiseringar och Anläggningstillgångar är flikar på Bokföring-sidan.
  accruals:         'verifications',
  fixed_assets:     'verifications',
  revenue:          'invoices',
  expense_overview: 'expenses',
  receipts:         'expenses',
  settings_system:  'settings',
  supplierInvoices: 'expenses',
  transfers:        'verifications',
  dashboard:        'dashboard',
  contacts:         'contacts',
  invoices:         'invoices',
  // Offerter är en egen sida i sidomenyn, under Verksamhet.
  quotes:           'quotes',
  // Produktregistret (profilmenyns "Artikel") — egen sida,
  // samma company-data-fält (`articles`) som redan användes av det gamla
  // "Artiklar"-textlänken i Invoices.jsx, se Articles.jsx.
  articles:         'articles',
  expenses:         'expenses',
  projects:         'projects',
  review:           'review',
  verifications:    'verifications',
  payroll:          'payroll',
  taxes:            'taxes',
  reports:          'reports',
  // Kundfeedback: det fanns TVÅ 'Företag'-sidor — den här (CompanySettings.jsx,
  // autosparande) och Inställningar → Företag (kräver spara + verifiering).
  // Samma uppgifter, olika beteende, olika lås. Den gamla sidan är borttagen;
  // id:t leder nu till inställningssidan, som öppnas direkt på Företag-fliken.
  company:          'settings',
  settings:         'settings',
};
// En sida får ha en underdel efter ett snedstreck — "settings/data" är
// fortfarande sidan "settings". Utan det skrev Inställningar sitt avsnitt
// som en naken hash (#data), vilket är ett sid-id som inte finns: en
// omladdning slog då till switchens default och kastade tillbaka en till
// Startsidan mitt i det man höll på med. Underdelen ägs av sidan själv,
// routingen här bryr sig bara om delen före snedstrecket.
const resolveTab = (id) => {
  const base = String(id || '').split('/')[0];
  return tabAliases[base] || base;
};
// Leverantörsfakturor ('supplier_invoices') och Artiklar ('articles') är egna
// sidor i sidomenyn. `navAccessId` (nedan) säger att de hör till fakturasidan
// ('invoices') för behörighet och UF-läget: en inbjuden medlem eller ett
// UF-företag som får se fakturor får också se Leverantörsfakturor och Artiklar.
// Offerter är en egen behörighet ('quotes').
const navAccessId = (id) => (id === 'supplier_invoices' || id === 'articles' ? 'invoices' : id);
const resolveNavGroup = (id) => resolveTab(navAccessId(id));

// Stripes egna statusar som räknas som "betalande" — trialing/active/
// past_due (past_due är Stripes egen automatiska betalningsomförsök, inte
// samma sak som uppsagd). Delad av fetchUserData:s inloggnings-gate och
// isActiveCompanyPaid (reaktiv, per aktivt företag) längre ner — måste
// vara EXAKT samma lista på båda ställena.
const ALLOWED_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];

// Kundönskemål: ägarens eget konto ska aldrig blockeras av betalspärren,
// varken kontots ORIGINALspärr (fetchUserData) eller den nya per-företags-
// spärren (isActiveCompanyPaid) — testar/utvecklar appen utan att behöva
// en riktig Stripe-prenumeration löpande. Bara en klientsidan-gate att
// kringgå (subscriptions.status styr ingen server-sidan-behörighet
// någonstans idag — RLS på user_data/subscriptions är ren ägarskaps-
// baserad, inte prenumerations-baserad), så en ren e-post-allowlist här
// räcker, ingen serverändring behövs.
// Kundrapport ("det är payment men gör inte så jag måste betala"): det nya
// dedikerade admin-kontot (api/admin/index.js:s ADMIN_EMAILS) är ett BART
// Supabase-auth-konto utan någon egen bokföring/prenumeration bakom sig —
// första gången det loggar in i den HÄR appen (t.ex. via lösenords-
// återställningslänkens redirect hit) träffade det annars samma betalspärr
// som en helt ny, obetald kund.
//
// Listan innehåller HASHAR (cyrb53) av de två adresserna i ADMIN_EMAILS,
// inte adresserna själva: den här filen hamnar i den publika JS-bunten, och
// klartext-adresserna där talade om för vem som helst med devtools vilka
// konton som är admin (ett färdigt mål för nätfiske och lösenordsgissning).
// Ny adress: node -e "<cyrb53 nedan>; console.log(cyrb53('adress'))".
const FREE_ACCOUNT_EMAIL_HASHES = ['1hingei7r5i', '6smdptanhd'];
const cyrb53 = (str, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};
// Skiftlägesokänslig jämförelse — Supabase normaliserar INTE nödvändigtvis
// e-postens skiftläge till gemener, den sparas som inskriven vid signup.
const isFreeAccountEmail = (email) => {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized) && FREE_ACCOUNT_EMAIL_HASHES.includes(cyrb53(normalized));
};

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
  const { t } = useTranslation();
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
      if (!hash) return;
      setActiveTab(resolveTab(hash));
      const base = hash.split(/[/?]/)[0];
      if (['verifications', 'accounts', 'accruals', 'fixed_assets'].includes(base)) setVerificationsInitialTab(base);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (activeTab === 'verifications') { loadAccruals().catch(() => {}); loadFixedAssets().catch(() => {}); }
  }, [activeTab]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Sidomenyn krymper själv steg för steg (data-fit, index.css) tills hela listan ryms utan
  // skroll, också i ett riktigt lågt fönster (hög skärmskalning eller inzoomad sida).
  const sidebarNavRef = useRef(null);
  const sidebarFit = useFitLevel(sidebarNavRef, 3);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  // Face ID-spärren (utils/sessionPolicy.js, components/AppLock.jsx).
  const [appLocked, setAppLocked] = useState(false);
  // Meny-panelen öppen: sidan bakom står still (html[data-sheet], index.css),
  // så att en svepning i panelen aldrig scrollar sidan under den.
  useEffect(() => {
    const root = document.documentElement;
    if (mobileMoreOpen) root.setAttribute('data-sheet', 'open');
    else root.removeAttribute('data-sheet');
    return () => root.removeAttribute('data-sheet');
  }, [mobileMoreOpen]);
  // Bottenraden göms medan ett textfält har fokus. Annars skjuts den upp
  // ovanför tangentbordet (iOS Safari/Android) och hänger mitt på skärmen.
  useEffect(() => {
    const root = document.documentElement;
    const isField = (el) => !!el && (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' ||
      (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'file', 'range', 'color'].includes(el.type)));
    const onIn = (e) => { if (isField(e.target)) root.setAttribute('data-keyboard', 'open'); };
    const onOut = () => root.removeAttribute('data-keyboard');
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => { document.removeEventListener('focusin', onIn); document.removeEventListener('focusout', onOut); root.removeAttribute('data-keyboard'); };
  }, []);
  // Returtangenten (Nästa/Klar), rätt tangentbord och fältet framskrollat
  // ovanför tangentbordet — se utils/mobileKeyboard.js.
  useEffect(() => installMobileKeyboard(), []);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  // 'signup' | 'login' — vilken Auth-flik som ska visas när showLanding
  // blir false. Sätts av VILKEN knapp som klickades (se enterApp-effekten
  // och LandingPage-anropet nedan), inte alltid samma förval.
  const [authMode, setAuthMode] = useState('login');
  // Vilket abonnemang besökaren klickade på prissidan. Följer med i
  // navigeringens state (AppRouter → hit → Auth) i stället för att
  // registreringen alltid ska anta den dyraste nivån.
  const [selectedPlan, setSelectedPlan] = useState('employer_monthly');
  // Registreringen startar i UF-läge när besökaren kom hit från /uf
  // (AppRouter: location.state.uf). Rör bara <Auth> — själva UF-flaggan på
  // kontot sätts i signUp-metadatan därifrån, se Auth.jsx.
  const [signupAsUf, setSignupAsUf] = useState(false);
  // null = ingen bedömning gjord än / inte blockerad. 'blocked' = inloggad
  // Supabase-användare UTAN giltig public.subscriptions-rad (trialing/
  // active/past_due) — se PaymentRequiredGate.jsx. Satt i fetchUserData,
  // FÖRE isLoggedIn(true), så appen aldrig hinner visas ens ett ögonblick.
  const [subscriptionGate, setSubscriptionGate] = useState(null);
  // Spärrad för att ägaren till företagen man är inbjuden till slutat
  // betala (inte för att man själv saknar prenumeration). Styr texten i
  // PaymentRequiredGate.
  const [sharedOwnerUnpaid, setSharedOwnerUnpaid] = useState(false);
  // Betala-per-företag (kundkrav): ALLA prenumerationsrader för kontot,
  // keyed på company_id ('' = legacy, se supabase-setup.sql:s kommentar
  // vid public.subscriptions) — hämtad EN gång i fetchUserData (direkt
  // RLS-skyddad klientläsning, se den kommentaren för varför INTE en
  // server-rond-trip), konsumerad reaktivt av isActiveCompanyPaid nedan
  // varje gång activeCompanyId ändras (företagsbyte, en nyss klar
  // onboarding). Ingen egen refresh vid byte behövs: en ny betalning
  // innebär alltid en Stripe-redirect och därmed en full sidladdning när
  // man kommer tillbaka, som hämtar en färsk karta av sig själv.
  const [subscriptionsMap, setSubscriptionsMap] = useState({});
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
  // Se produktrundturens useEffect (nära handleLogin) — säkerställer att
  // auto-starten bara försöker en gång per sidladdning.
  const tourAutoStartedRef = useRef(false);
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
  const [passwordRecovery, setPasswordRecovery] = useState(isPasswordRecovery);
  // Fångas EN gång vid första renderingen — innan den andra useEffect-hooken
  // längre ner (?subscription_checkout=success-toasten) hinner städa bort
  // parametern ur URL:en. fetchUserData körs asynkront (efter getSession()-
  // anropet), så om den istället läste window.location.search direkt skulle
  // den nästan alltid komma efter att toast-hooken redan rensat den.
  const [initialSubscriptionCheckoutParam] = useState(
    () => new URLSearchParams(window.location.search).get('subscription_checkout')
  );
  // Betala-per-företag (kundkrav): satt bara på success_url när Stripe-
  // checkouten gällde ETT SPECIFIKT nytillagt företag (se create-
  // subscription-checkout.js) — talar om för fetchUserData:s "vänta in
  // webhooken"-logik VILKEN rad den ska vänta på istället för att (fel)
  // anta kontots legacy-rad, som en sådan checkout aldrig skriver till.
  const [initialSubscriptionCheckoutCompanyId] = useState(
    () => new URLSearchParams(window.location.search).get('company_id')
  );
  // Stripes checkout-session (success_url, se _subscriptionCheckout.js) —
  // låter syncStripeSubscription hämta just den prenumerationen direkt.
  const [initialSubscriptionCheckoutSessionId] = useState(
    () => new URLSearchParams(window.location.search).get('session_id')
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
      // Registrering utan valt abonnemang går via /priser, så besökaren
      // väljer nivå själv i stället för att tyst få 179 kr-nivån.
      if (location.state?.authMode === 'signup' && !location.state?.plan && !location.state?.uf && !location.state?.invite) {
        navigate('/priser', { replace: true });
        return;
      }
      setShowLanding(false);
      setAuthMode(location.state?.authMode === 'signup' ? 'signup' : 'login');
      if (location.state?.plan) setSelectedPlan(location.state.plan);
      if (location.state?.uf) setSignupAsUf(true);
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Öppnad från hemskärmen (manifest.webmanifest start_url /?app=1, eller
  // som fristående app): gå direkt till inloggningen, inte startsidan.
  // Fastställs en gång: i den installerade appen ska inget leda ut till
  // webbplatsen (se Auth:s logga, onBackToLanding nedan).
  const [inInstalledApp] = useState(() => typeof window !== 'undefined'
    && (isStandaloneApp() || /[?&]app=1\b/.test(window.location.search)));
  useEffect(() => {
    if (inInstalledApp) {
      setShowLanding(false);
      setAuthMode('login');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() => localStorage.getItem('bokix_onboarding_completed') === 'true');
  // Bara sättaren används — själva värdet speglas till localStorage men
  // läses aldrig tillbaka från React-state någonstans (showOnboarding
  // styr faktiskt vad som visas), se de många setHasSkippedOnboarding-
  // anropen nedan.
  const [, setHasSkippedOnboarding] = useState(() => localStorage.getItem('bokix_onboarding_skipped') === 'true');
  const [dbSupportsProfileColumns, setDbSupportsProfileColumns] = useState(false);
  const [supabaseEnabled, setSupabaseEnabled] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Företag där "Fråga senare" valts i momsperiodsfrågan (VatPeriodPrompt),
  // bara under det här besöket.
  const [vatPromptLater, setVatPromptLater] = useState([]);
  // "Lägg till företag" (profilmenyn): hela onboardingen i läget addMode, så
  // att ett nytt företag kontrolleras lika noga som kontots första.
  const [addingCompany, setAddingCompany] = useState(false);
  const [addingCompanySubmitting, setAddingCompanySubmitting] = useState(false);

  // ── Tema (ljust/mörkt/system) ── Sparat val vinner; annars mörkt som
  // standard (appen är byggd för och ser bäst ut i mörkt läge) — inte
  // OS-inställningen. `themePreference` är det RÅA valet (kan vara
  // 'system'); `theme` nedan är det FAKTISKT tillämpade värdet ('light'
  // eller 'dark') — all befintlig kod i appen (hundratals `theme ===
  // 'dark'`-jämförelser) fortsätter fungera oförändrat mot `theme`, bara
  // inställningssidans nya 3-vägsväljare (Utseende) behöver bry sig om
  // `themePreference`/`setThemePreference`. Vid 'system' tas `data-theme`
  // helt bort från <html> i effekten nedan i stället för att sättas — då
  // tar index.css egen "@media (prefers-color-scheme: dark)"-regel
  // (":root:not([data-theme='light']):not([data-theme='dark'])") över,
  // som redan fanns där sedan tidigare men aldrig kunde nås eftersom
  // `data-theme` alltid sattes explicit. `systemPrefersDark` håller JS-sidan
  // (den här `theme`-variabeln, ikonen i headern m.m.) i synk LIVE om
  // användaren byter OS-tema medan appen är öppen.
  const [themePreference, setThemePreference] = useState(() => {
    try {
      const stored = localStorage.getItem('bokix_theme_pref') || localStorage.getItem('bokix_theme');
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch { /* privat läge/blockerad storage — kör vidare med standardvalet */ }
    return 'dark';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : false
  ));
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const theme = themePreference === 'system' ? (systemPrefersDark ? 'dark' : 'light') : themePreference;
  useEffect(() => {
    if (themePreference === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', themePreference);
    try { localStorage.setItem('bokix_theme_pref', themePreference); localStorage.removeItem('bokix_theme'); } catch { /* samma reservläge som ovan */ }
  }, [themePreference]);
  // Snabbväxlingen i headern (sol/måne-ikonen): väljer alltid ett EXPLICIT
  // läge utifrån det just nu tillämpade (aldrig 'system') — att klicka en
  // ikon med två lägen är inte platsen att förklara ett tredje.
  // Färgen byts direkt på sidan. Att rita om appen får vänta bakom: på ett stort
  // företag tog det två sekunder, och då kändes knappen trasig.
  const chooseTheme = (preference) => {
    if (preference === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', preference);
    startTransition(() => setThemePreference(preference));
  };
  const toggleTheme = () => chooseTheme(theme === 'dark' ? 'light' : 'dark');

  // Statusfältets färg följer appens eget tema, inte bara telefonens (se
  // theme-color i index.html): den som valt mörkt läge i Bokix på en ljus
  // telefon ska inte få en ljus rand överst.
  useEffect(() => {
    const color = theme === 'dark' ? '#0f1a13' : '#f4f7f5';
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute('content', color);
      m.removeAttribute('media');
    });
  }, [theme]);

  // Färgtemat (blått, lila m.fl.) är borttaget 2026-10-11: appen är alltid
  // Bokix grön. Rensar ett tidigare sparat val.
  useEffect(() => {
    document.documentElement.removeAttribute('data-accent');
    try { localStorage.removeItem('bokix_accent'); } catch { /* privat läge */ }
  }, []);

  // ── Kompakt/normal layout (Inställningar → Utseende) ── Samma mönster.
  const [density, setDensityState] = useState(() => {
    try { return localStorage.getItem('bokix_density') === 'compact' ? 'compact' : 'normal'; }
    catch { return 'normal'; }
  });
  useEffect(() => {
    if (density === 'compact') document.documentElement.setAttribute('data-density', 'compact');
    else document.documentElement.removeAttribute('data-density');
    try { localStorage.setItem('bokix_density', density); } catch { /* samma reservläge som ovan */ }
  }, [density]);
  const setDensity = (v) => setDensityState(v === 'compact' ? 'compact' : 'normal');

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
  // hellre ha en mörk sidomeny UTAN att byta hela appens tema till mörkt.
  // EGEN mörkgrön nyans (--bg-sidebar: #0b3d2a) — inte literal samma hex
  // som mörkt lägets egen sidebar (#0c1f14): kundfeedback, den nyansen
  // kändes fel/urvattnad ihopblandad med resten av en annars ljus app,
  // trots att den ser bra ut FÖR mörkt läge. Ren preferens, ingen effekt i
  // mörkt läge (sidomenyn är redan mörk där) — se index.css:
  // ":root:not([data-theme='dark'])[data-sidebar-style='dark']".
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
  const [companySearch, setCompanySearch] = useState('');
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  // Sedda notiser per företag (utils/notificationFeed.js) och vilka som var
  // nya när klockan öppnades, så att de syns som nya tills den stängs.
  const [seenNotifKeys, setSeenNotifKeys] = useState(() => new Set());
  const [notifOpenedUnread, setNotifOpenedUnread] = useState(() => new Set());
  useEffect(() => { setSeenNotifKeys(readSeenKeys(data.activeCompanyId)); setNotifOpenedUnread(new Set()); }, [data.activeCompanyId]);
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  // { message, variant } | null — se Toast.jsx samt stripe_connect-
  // useEffect nedan, som satte en blockerande alert() innan.
  const [toast, setToast] = useState(null);
  // Ångra-notisen (shared/undoToast.js). pendingUndoRef håller den ångring
  // som visas just nu; stängs notisen utan Ångra körs dess onCommit.
  const pendingUndoRef = useRef(null);
  const commitPendingUndo = () => {
    const pending = pendingUndoRef.current;
    pendingUndoRef.current = null;
    pending?.onCommit?.();
  };
  useEffect(() => registerUndo((opts) => {
    commitPendingUndo();
    pendingUndoRef.current = opts;
    setToast({
      message: opts.message,
      variant: 'success',
      undo: true,
      action: { label: tr('ui.angra'), noArrow: true, onClick: () => { pendingUndoRef.current = null; opts.onUndo?.(); } },
    });
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const closeToast = () => {
    commitPendingUndo();
    setToast(null);
  };
  const [highlightVerificationId, setHighlightVerificationId] = useState(null);

  const handleGlobalAction = (action, tab) => {
    const rTab = resolveTab(tab);
    setActiveTab(rTab);
    if (typeof window !== 'undefined') window.location.hash = rTab;
    setGlobalAction(action);
    setSidebarOpen(false);
  };

  // Close sidebar when tab changes on mobile
  // Bugkritiskt: profilmenyns "Bokslut & årsredovisning"/"Momsredovisning"
  // (App.jsx längre ner) skickar tabId 'taxes_yearend'/'taxes_vat" —
  // resolveTab slår ihop BÅDA till samma sida ('taxes'), vilket är rätt
  // för VILKEN SIDA som ska visas men tappar VILKEN FLIK på den sidan.
  // Taxes.jsx:s egen activeSection-state (se den filens initialSection-
  // prop) behöver den mer specifika informationen separat, eftersom den
  // annars alltid stannar på sitt eget förval ('vat') oavsett vilken av de
  // två knapparna man klickade.
  // 'taxes' (profilmenyns "Viktiga datum", inget mer specifikt val) pekar
  // numera på Taxes.jsx:s egen "Viktiga datum"-flik ('dates') istället för
  // Moms — den fliken existerar nu specifikt för det, se Taxes.jsx.
  const taxesSectionAliases = { taxes: 'dates', taxes_vat: 'vat', taxes_yearend: 'yearend' };
  const [taxesInitialSection, setTaxesInitialSection] = useState('dates');
  // Inställningssidans avsnitt när man kommer via en genväg ('company',
  // 'settings_system'). Nollställs vid all annan navigering, så att menyns
  // Inställningar fortsatt öppnar översikten.
  const [settingsShortcutSection, setSettingsShortcutSection] = useState(null);

  // Samma bugg, samma fix som taxesSectionAliases ovan: profilmenyns
  // "Kontoplaner" gjorde handleNavTabChange('accounts'), men tabAliases
  // (nedan) mappar redan 'accounts' -> 'verifications' (Bokföring-sidan
  // återanvänder samma komponent/flikvy för både Verifikationer och
  // Kontoplan) — så bara VILKEN top-nivå-sida som skulle visas styrdes,
  // aldrig VILKEN flik inuti den. Resultatet: "Kontoplaner" landade alltid
  // på Verifikationer-fliken, aldrig Kontoplan. `case 'accounts':`
  // (renderTabContent, längre ner) var dessutom bokstavligen oåtkomlig
  // kod av samma skäl (resolveTab(activeTab) hinner redan bli
  // 'verifications' innan switchen körs) — borttagen tillsammans med sin
  // lazy-import av <Accounts>, se den filens kommentar om varför filen
  // ändå får ligga kvar orörd.
  const verificationsSectionAliases = { verifications: 'verifications', accounts: 'accounts', accruals: 'accruals', fixed_assets: 'fixed_assets' };
  // Läses också ur adressen, så att en omladdning på #accounts, #accruals
  // eller #fixed_assets landar på rätt flik.
  const [verificationsInitialTab, setVerificationsInitialTab] = useState(() => {
    const base = typeof window !== 'undefined' ? window.location.hash.replace('#', '').split(/[/?]/)[0] : '';
    return ['accounts', 'accruals', 'fixed_assets'].includes(base) ? base : 'verifications';
  });

  // Samma "vilken flik inuti sidan"-mönster som verificationsInitialTab
  // ovan — vilken Granskning-flik (ReviewQueue.jsx) "Visa i Granskning"-
  // genvägen i Toast.jsx ska öppna på, satt av stripe_connect/zettle_connect-
  // useEffects nedan när en anslutning just lyckades.
  const [reviewInitialTab, setReviewInitialTab] = useState('pending');

  // Kundfeedback (två omgångar): "Rapportera fel" öppnade först bara en
  // mailto:-länk — gjorde ingenting alls utan en registrerad mejlklient
  // (vanligast för webbmejl-användare). Kundönskemål efteråt: en riktig,
  // enkel formulär-ruta i appen istället, "som en kontaktlista" — inte ens
  // en mejlapp ska behöva öppnas. Återanvänder /api/contact (samma rutt
  // som den publika marknadssajtens kontaktformulär, ContactPage.jsx —
  // kräver medvetet ingen inloggning där, men fungerar precis lika bra
  // för en redan inloggad avsändare) istället för att bygga en ny rutt —
  // Vercels 12-funktionsgräns är redan på 12/12. Namn/e-post fylls i
  // TYST från den inloggade sessionen (så enkelt som möjligt, bara EN
  // textruta att fylla i) — se handleSubmitErrorReport/modalen nedan.
  const [reportErrorModal, setReportErrorModal] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [reportErrorText, setReportErrorText] = useState('');
  const [reportErrorBusy, setReportErrorBusy] = useState(false);
  // Samma ämnen som kontaktsidan (ContactPage.jsx TOPICS); value måste
  // finnas i ALLOWED_TOPICS i api/contact.js.
  const [reportErrorTopic, setReportErrorTopic] = useState('Felrapport');

  // Supporten ska slippa fråga var man var: sidan och företaget skickas med
  // under meddelandet (och visas i rutan, så att inget skickas i hemlighet).
  // En funktion, inte ett värde: `company` deklareras längre ned i komponenten.
  const getSupportContextLine = () => {
    const id = resolveTab(activeTab);
    const key = id === 'invoices' ? 'nav.customerInvoices' : `nav.${id}`;
    const label = t(key);
    const page = label === key ? id : label;
    const active = data.companies?.[data.activeCompanyId]?.company;
    return tr('ui.support_kontext', { page, company: [active?.name, active?.orgNr].filter(Boolean).join(', ') || '–' });
  };

  const handleSubmitErrorReport = async () => {
    const typed = reportErrorText.trim();
    if (!typed) return;
    const message = `${typed}\n\n${getSupportContextLine()}`;
    setReportErrorBusy(true);
    try {
      const senderName = [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ').trim()
        || company?.name
        || tr('ui.bokix_anvandare');
      // Inloggningen ersätter reCAPTCHA i api/contact.js; utan den svarar
      // rutten "Kunde inte verifiera att du inte är en robot".
      const accessToken = await getAccessToken();
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ name: senderName, email: user?.email || '', topic: reportErrorTopic, message }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || tr('ui.kunde_inte_skicka', { status: res.status }));
      setReportErrorModal(false);
      setReportErrorText('');
      setReportErrorTopic('Felrapport');
      setToast({ message: tr('ui.tack_meddelandet_ar_skickat'), variant: 'success' });
    } catch (err) {
      setToast({ message: err.message || tr('ui.kunde_inte_skicka_felrapporten_forsok_igen_om_en'), variant: 'error' });
    } finally {
      setReportErrorBusy(false);
    }
  };


  const handleNavTabChange = (tabId) => {
    const rTab = resolveTab(tabId);
    if (taxesSectionAliases[tabId]) setTaxesInitialSection(taxesSectionAliases[tabId]);
    if (verificationsSectionAliases[tabId]) setVerificationsInitialTab(verificationsSectionAliases[tabId]);
    setSettingsShortcutSection({ company: 'company', settings_system: 'system' }[tabId] || null);
    setActiveTab(rTab);
    // Bokföring-sidans flikar får sitt eget id i adressen (#accruals), så att
    // en omladdning landar på fliken och inte bara på sidan.
    if (typeof window !== 'undefined') window.location.hash = verificationsSectionAliases[tabId] && tabId !== 'verifications' ? tabId : rTab;
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

  const syncCompanyDataToBackend = useCallback(async (_companyId, _payload) => {
    // Mock removed to avoid 404
    return null;
  }, [])

  const loadCompanyDataFromBackend = useCallback(async (_companyId) => {
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
  // Fler delade företag än så hämtas bara som namn vid inloggningen.
  const SHARED_EAGER_LIMIT = 3;

  // Företagets uppgifter följer Bolagsverket: en kontroll per dygn när
  // företaget öppnas. Går registret inte att nå står allt kvar som det var.
  const registrySyncTried = useRef(new Set());
  const activeRegistryEntry = data?.companies?.[data?.activeCompanyId];
  const registryDue = isLoggedIn && registrySyncDue(activeRegistryEntry);
  useEffect(() => {
    const companyId = data?.activeCompanyId;
    if (!registryDue || registrySyncTried.current.has(companyId)) return;
    registrySyncTried.current.add(companyId);
    (async () => {
      try {
        const result = await requestRegistrySync(companyId, await getAccessToken());
        if (!result?.company) return;
        setData(prev => (prev.companies?.[companyId]
          ? { ...prev, companies: { ...prev.companies, [companyId]: { ...prev.companies[companyId], company: { ...prev.companies[companyId].company, ...result.company } } } }
          : prev));
        if (result.changed?.length) setToast({ message: tr('ui.foretagets_uppgifter_uppdaterades_bv'), variant: 'success' });
      } catch (err) {
        console.warn('Företagsuppgifterna kunde inte uppdateras från Bolagsverket:', err.message);
      }
    })();
  }, [registryDue, data?.activeCompanyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const getAccessToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Hämtar ett delat företag och försöker igen vid tillfälliga fel: 401
  // (utgånget inloggningstoken, förnyas först), 429, 5xx och nätverksfel.
  // Förut gav ett enda misslyckat anrop direkt Kunde inte hämta företaget.
  // Svarar { ok, status, json }. 403 och 404 försöks inte igen.
  const fetchSharedCompanyWithRetry = async (companyId, tokenIn = null) => {
    const waits = [0, 1200, 3500];
    let token = tokenIn;
    let last = { ok: false, status: 0, json: null };
    for (let i = 0; i < waits.length; i++) {
      if (waits[i]) await new Promise(res => setTimeout(res, waits[i]));
      try {
        if (!token || (i > 0 && last.status === 401)) {
          if (last.status === 401) await supabase.auth.refreshSession().catch(() => {});
          token = await getAccessToken();
        }
        const res = await fetch(`/api/company-access?company_id=${encodeURIComponent(companyId)}`, { headers: { Authorization: `Bearer ${token}` } });
        const json = res.ok ? await res.json() : null;
        last = { ok: res.ok && Boolean(json?.company), status: res.status, json };
        if (last.ok || res.status === 403 || res.status === 404) return last;
      } catch (err) {
        last = { ok: false, status: 0, json: null, error: err };
      }
    }
    return last;
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
        // Syns inte raden alls är kontot oftast skapat med en annan adress än
        // inbjudan gick till (RLS visar bara den egna). Säg det, i stället för
        // att personen tyst hamnar på betalsidan.
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setToast({
          message: !invite
            ? tr('ui.kunde_inte_losa_in_inbjudan_kontrollera_att_du_a')
            : tr('ui.inbjudan_redan_anvand'),
          variant: 'error',
        });
        return;
      }
      if (new Date(invite.expires_at) <= new Date()) {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
        setToast({ message: tr('ui.inbjudan_har_gatt_ut_be_den_som_bjod_in_dig_att'), variant: 'error' });
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
        setToast({ message: tr('ui.kunde_inte_losa_in_inbjudan_kontakta_den_som_bjo'), variant: 'error' });
        return;
      }
      if (!redeemedRows || redeemedRows.length === 0) {
        console.error('Inlösen av inbjudan matchade ingen rad (fel inloggad e-post?)');
        setToast({ message: tr('ui.kunde_inte_losa_in_inbjudan_kontrollera_att_du_a'), variant: 'error' });
        return;
      }
      setToast({ message: tr('ui.inbjudan_accepterad_du_har_nu_atkomst_till_foret'), variant: 'success' });
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
    const membersQuery = () => supabase
      .from('company_members')
      .select('company_id, owner_user_id, role')
      .eq('member_user_id', authUserId)
      .eq('status', 'active');
    let { data: memberships, error: membersError } = await membersQuery();
    // Ett tillfälligt fel här fick en inbjuden revisor att se betalspärren
    // (inget eget abonnemang + inga delade företag = obetalt konto). Ett nytt
    // försök innan vi ger upp.
    if (membersError) ({ data: memberships } = await membersQuery());
    if (!memberships || memberships.length === 0) return {};
    // Ett företag som inte gick att hämta just nu (nätverk, serverfel, för
    // stort svar) blir en __stub som hämtas om när det öppnas, i stället för
    // att tyst försvinna. Annars fick en inbjuden utan egen prenumeration
    // betalningsrutan för 179 kr (kundrapport 2026-10-09). Bara 401/403/404
    // betyder att åtkomsten verkligen är borta.
    const stubFor = (m) => ({
      company: { id: m.company_id, name: '' },
      __stub: true,
      __shared: { ownerUserId: m.owner_user_id, role: m.role, pageAccess: null, ownerPaid: true },
    });

    // Många företag (en redovisningskonsult med flera kunder): bara namnen
    // nu, i ett anrop. Ett företag hämtas helt när det öppnas, se
    // loadSharedCompanyStub. Med några få hämtas allt direkt som förut.
    if (memberships.length > SHARED_EAGER_LIMIT) {
      try {
        const res = await fetch('/api/company-access?list=1', { headers: { Authorization: `Bearer ${accessToken}` } });
        if (res.ok) {
          const { companies = [] } = await res.json();
          return Object.fromEntries(companies.map(c => [c.company_id, {
            company: c.company,
            __stub: true,
            __shared: { ownerUserId: c.owner_user_id, role: c.role, pageAccess: c.pageAccess || null, ownerPaid: c.ownerPaid !== false },
          }]));
        }
      } catch (err) {
        console.error('Kunde inte hämta listan över delade företag, hämtar ett i taget:', err);
      }
    }

    // Parallellt, inte sekventiellt — en person som är inbjuden till FLERA
    // olika ägares företag (t.ex. en redovisningskonsult med flera kunder)
    // ska inte behöva vänta ett nätverks-tur-och-retur PER företag i följd
    // vid varje inloggning.
    const results = {};
    await Promise.all(memberships.map(async (m) => {
      try {
        const got = await fetchSharedCompanyWithRetry(m.company_id, accessToken);
        if (!got.ok) {
          // Inbjudan är aktiv (raden ovan), så ett nej här betyder att företaget
          // inte gick att läsa. Då ska den inbjudna få felsidan med Logga ut,
          // aldrig betalsidan. Har åtkomsten återkallats kommer raden inte med.
          results[m.company_id] = stubFor(m);
          return;
        }
        const json = got.json;
        if (json?.company) {
          // __shared markerar företaget som INTE mitt eget — se
          // persist-effekten längre ner, som aldrig får skriva in det här i
          // min egen user_data-rad, bara via set_company_field.
          results[m.company_id] = { ...json.company, __shared: { ownerUserId: m.owner_user_id, role: json.role, pageAccess: json.pageAccess || null, ownerPaid: json.ownerPaid !== false } };
        }
      } catch (err) {
        console.error('Kunde inte hämta delat företag', m.company_id, err);
        results[m.company_id] = stubFor(m);
      }
    }));
    return results;
  };

  // Hämtar hela företaget bakom en __stub (se fetchSharedCompanies) när det
  // öppnas. Referenspunkten för sparningen nollställs, så att det inlästa
  // inte räknas som en ändring att skicka tillbaka.
  const loadingStubRef = useRef(null);
  const loadSharedCompanyStub = async (companyId) => {
    if (loadingStubRef.current === companyId) return;
    loadingStubRef.current = companyId;
    try {
      const got = await fetchSharedCompanyWithRetry(companyId);
      const json = got.json;
      if (!got.ok || !json?.company) throw new Error(`HTTP ${got.status}`);
      delete lastPersistedSharedFieldsRef.current[companyId];
      setData(prev => {
        const stub = prev.companies?.[companyId];
        if (!stub?.__stub) return prev;
        return { ...prev, companies: { ...prev.companies, [companyId]: { ...json.company, __shared: { ...stub.__shared, role: json.role, pageAccess: json.pageAccess || null, ownerPaid: json.ownerPaid !== false } } } };
      });
    } catch (err) {
      console.error('Kunde inte hämta delat företag', companyId, err);
      setToast({ message: tr('ui.kunde_inte_hamta_foretaget'), variant: 'error' });
      // Laddningsskärmen släpper, i stället för att stå kvar för alltid.
      setData(prev => (prev.companies?.[companyId]?.__stub
        ? { ...prev, companies: { ...prev.companies, [companyId]: { ...prev.companies[companyId], __stubError: true } } }
        : prev));
    } finally {
      loadingStubRef.current = null;
    }
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
  // Företag vars sparning pågår. Sparningen körs två sekunder efter varje
  // ändring; tog servern längre tid skickades samma fält igen medan de
  // första anropen fortfarande väntade, och anropen köade på varandra tills
  // databasen gav upp (2026-10-27). Nu väntar en ny körning på den pågående
  // och sparar sedan det senaste läget, en gång.
  const persistingSharedRef = useRef(new Map());
  const sharedSaveToastRef = useRef(0);
  const persistSharedCompanyFields = async (companyId, companyData) => {
    const running = persistingSharedRef.current;
    if (running.has(companyId)) { running.set(companyId, companyData); return; }
    running.set(companyId, null);
    try {
      let next = companyData;
      while (next) {
        await persistSharedCompanyFieldsNow(companyId, next);
        next = running.get(companyId);
        running.set(companyId, null);
      }
    } finally {
      running.delete(companyId);
    }
  };
  const persistSharedCompanyFieldsNow = async (companyId, companyData) => {
    if (companyData.__shared?.role !== 'editor' || companyData.__stub) return;

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
    const { pageAccess, role } = companyData.__shared;
    const { same, changed: changedFields } = sharedFieldsToSave(last, companyData, SHARED_COMPANY_WRITABLE_FIELDS, f => canWriteField(pageAccess, f, role));
    for (const f of same) last[f] = companyData[f];
    if (changedFields.length === 0) return;

    let failed = false;
    for (const field of changedFields) {
      // Listor (verifikationer, kvitton …): bara de poster som ändrats, så att
      // anropet inte växer med hela historiken. Annars hela värdet + base.
      const patch = makeRecordPatch(last[field], companyData[field]);
      const payload = patch && (patch.upsert.length || patch.remove.length)
        ? { company_id: companyId, field, patch }
        : { company_id: companyId, field, value: companyData[field], base: last[field] };
      try {
        const res = await fetch('/api/company-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          console.error(`Kunde inte spara ${field} för delat företag ${companyId}:`, body?.error);
          // Sparas inte in i "last" — försöks igen nästa gång effekten körs,
          // istället för att tyst ge upp på ett fält som faktiskt inte gick
          // igenom (t.ex. rollen nedgraderades till viewer mitt i sessionen).
          failed = true;
          // Inloggningen gäller inte längre: resten av fälten nekas likadant.
          if (res.status === 401) break;
          continue;
        }
        lastPersistedSharedFieldsRef.current[companyId] = { ...lastPersistedSharedFieldsRef.current[companyId], [field]: companyData[field] };
      } catch (err) {
        console.error(`Nätverksfel vid sparning av ${field} för delat företag ${companyId}:`, err);
        failed = true;
      }
    }
    // Ändringen finns bara på skärmen tills den sparats, så det ska synas.
    if (failed && Date.now() - sharedSaveToastRef.current > 60000) {
      sharedSaveToastRef.current = Date.now();
      setToast({ message: tr('ui.kunde_inte_spara_andringarna_forsok_igen_om_en_s'), variant: 'error' });
    }
  };

  // Bugkritiskt (kundrapport: "det står företaget är borttaget men finns
  // fortfarande" — efter Ta bort-knappen i Dina företag). Funktionen
  // signalerade tidigare ALDRIG misslyckande till den som anropade den —
  // varje fel (RLS, nätverk, vad som helst utöver de två specialfallen
  // nedan) fångades här, loggades bara med console.error, och funktionen
  // returnerade/resolvade som vanligt. En anropare som `await
  // saveUserDataToSupabase(...)` hade alltså INGEN möjlighet att veta att
  // skrivningen faktiskt misslyckats — precis det handleDeleteCompany
  // (nedan) behöver kunna skilja på för att inte visa en falsk "borttaget"-
  // bekräftelse när ändringen aldrig nådde databasen (och därför kom
  // tillbaka vid nästa inloggning/synk). Returnerar nu true/false — rent
  // additivt, de ~20 andra anropsställena som redan ignorerar returvärdet
  // fortsätter fungera precis som förut.
  const saveUserDataToSupabase = async (stateData, extras = {}) => {
    if (!user || !supabaseEnabled) return false;
    if (tablesModeRef.current && tablesOnlyRef.current) return saveStateViaTables(stateData, extras);

    const payload = {
      user_id: user.id,
      state: stateData,
    };

    if (dbSupportsProfileColumns) {
      Object.assign(payload, extras);
    }

    const { data: savedRows, error } = await supabase.from('user_data').upsert(payload, { onConflict: 'user_id' }).select('updated_at');
    if (!error && savedRows?.[0]?.updated_at) serverSyncRef.current.updatedAt = savedRows[0].updated_at;
    if (error) {
      if (isSupabaseUnavailableError(error)) {
        setSupabaseEnabled(false);
        return false;
      }

      const missingColumn = String(error.message || '').toLowerCase().includes('column');
      if (missingColumn && !dbSupportsProfileColumns) {
        const fallback = await supabase.from('user_data').upsert({
          user_id: user.id,
          state: stateData,
        }, { onConflict: 'user_id' });
        if (fallback.error) {
          if (isSupabaseUnavailableError(fallback.error)) setSupabaseEnabled(false);
          console.error('Supabase save error (fallback):', fallback.error);
          return false;
        }
        return true;
      }
      // 23514 = CHECK-villkoret user_data_state_size (20 MB, supabase-2026-10-01-skydd.sql).
      if (error.code === '23514') setToast({ message: tr('ui.sparningen_ar_for_stor'), variant: 'error' });
      console.error('Supabase save error:', error);
      return false;
    }
    return true;
  };

  // Vad servern hade vid senaste synken (updated_at + mina egna företag).
  // Sparningen skriver bara om raden är oförändrad sedan dess. Har någon
  // annan skrivit emellan (annan enhet, en inbjuden konsult via
  // set_company_field, påminnelse-cronen) hämtas raden och slås ihop post
  // för post (utils/stateMerge.js) i stället för att skrivas över.
  const serverSyncRef = useRef({ updatedAt: null, baseCompanies: null, baseSnapshot: null });
  const syncInFlightRef = useRef(null);
  // Finns databasfunktionen apply_user_data_delta (supabase-2026-10-17-
  // delta-sparning.sql)? Saknas den sparas hela kontot som förut.
  const deltaSupportedRef = useRef(true);
  // Tabelläget (utils/tableStore.js): satt vid inloggningen om kontot läses
  // ur tabellerna. versionsRef: vilken version appen har sett av varje post
  // och företagsrad, för krockkontrollen i save_company_changes.
  const tablesModeRef = useRef(false);
  const versionsRef = useRef(null);
  // Endast tabeller (steg 4d, 'tables_only'): blobben skrivs inte längre för
  // kontots företag; allt går via save_company_changes.
  const tablesOnlyRef = useRef(false);
  // Hela kontot sparat i läget endast tabeller (nytt eller borttaget företag,
  // onboardingen, appens sista utväg): det som skiljer från senaste synken
  // skickas som ändringar. Vid krock hämtas det färska och det som sparas
  // här läggs ovanpå, eftersom det är en uttrycklig åtgärd.
  const saveStateViaTables = async (stateData, extras = {}) => {
    const ref = serverSyncRef.current;
    const own = Object.fromEntries(Object.entries(stateData?.companies || {}).filter(([, c]) => !c?.__shared));
    const target = { ...stateData, companies: own };
    for (let attempt = 0; attempt < 3; attempt++) {
      let ops;
      try { ops = buildStateDelta(ref.baseSnapshot, ref.baseCompanies, target, own); } catch { ops = null; }
      if (!ops) return false;
      if (ops.length) {
        const saved = await saveToTables(supabase, ops, versionsRef.current || {});
        if (saved.conflicts) {
          let fresh;
          try { fresh = await loadFromTables(supabase); } catch { return false; }
          ref.baseCompanies = fresh.state.companies || {};
          ref.baseSnapshot = fresh.state;
          ref.updatedAt = fresh.updatedAt;
          versionsRef.current = fresh.versions;
          continue;
        }
        if (saved.error) {
          console.warn('Sparning via tabellerna misslyckades:', saved.error.message || saved.error);
          return false;
        }
        versionsRef.current = saved.versions;
        ref.updatedAt = saved.updatedAt;
      }
      ref.baseCompanies = own;
      ref.baseSnapshot = target;
      rememberServerState(user.id, ref.updatedAt, target);
      if (dbSupportsProfileColumns && extras && Object.keys(extras).length) {
        await supabase.from('user_data').update(extras).eq('user_id', user.id);
      }
      return true;
    }
    return false;
  };
  // Skickar bara ändringarna sedan förra synken. true = sparat, null = någon
  // annan har skrivit emellan (slå ihop), false = gick inte (spara allt).
  const saveDelta = async (ref, snapshot, companies) => {
    if (!deltaSupportedRef.current || !ref.updatedAt || !ref.baseCompanies) return false;
    let ops;
    try { ops = buildStateDelta(ref.baseSnapshot, ref.baseCompanies, snapshot, companies); } catch { return false; }
    if (!ops) return false;
    if (ops.length === 0) return true;
    if (tablesModeRef.current && versionsRef.current) {
      const saved = await saveToTables(supabase, ops, versionsRef.current);
      if (saved.conflicts) return null;
      if (saved.error) {
        // Kontot är inte längre i tabelläget (satt tillbaka av servern):
        // resten av sessionen sparas som förut.
        if (/not in tables mode/i.test(saved.error.message || '')) tablesModeRef.current = false;
        else console.warn('Sparning via tabellerna misslyckades, sparar allt:', saved.error.message || saved.error);
        return false;
      }
      versionsRef.current = saved.versions;
      ref.updatedAt = saved.updatedAt;
      return true;
    }
    const { data: newUpdatedAt, error } = await supabase.rpc('apply_user_data_delta', { p_expected_updated_at: ref.updatedAt, p_ops: ops });
    if (error) {
      // PGRST202 = funktionen finns inte (SQL:en är inte körd än).
      if (error.code === 'PGRST202' || /apply_user_data_delta/i.test(error.message || '')) deltaSupportedRef.current = false;
      else console.warn('Sparning av ändringar misslyckades, sparar allt:', error.message || error);
      return false;
    }
    if (newUpdatedAt === null) return null;
    // Bara en tidsstämpel betyder sparat. Allt annat: spara hela kontot.
    if (typeof newUpdatedAt !== 'string') return false;
    ref.updatedAt = newUpdatedAt;
    return true;
  };
  const lastSavedOwnRef = useRef(null);
  const saveOwnCompaniesMerged = async (snapshot, ownCompanies) => {
    // En sparning i taget, annars jämför två samtidiga mot samma bas.
    while (syncInFlightRef.current) await syncInFlightRef.current.catch(() => {});
    // Inget eget har ändrats sedan förra lyckade sparningen (t.ex. bara ett
    // delat företag eller något i ett annat konto): skriv inte hela kontot
    // igen. Appen byter alltid ut det som ändras, så referenser räcker.
    const last = lastSavedOwnRef.current;
    if (last && Object.keys(ownCompanies).length === Object.keys(last.companies).length
      && Object.entries(ownCompanies).every(([id, c]) => last.companies[id] === c)
      && Object.keys(snapshot).every(k => k === 'companies' || snapshot[k] === last.snapshot[k])) {
      return;
    }
    const run = (async () => {
      const ref = serverSyncRef.current;
      let companies = ownCompanies;
      const done = (savedCompanies) => {
        lastSavedOwnRef.current = { companies: ownCompanies, snapshot };
        ref.baseCompanies = savedCompanies;
        ref.baseSnapshot = snapshot;
        // Det som nu ligger i raden, för nästa start (utils/serverStateCache.js).
        rememberServerState(user.id, ref.updatedAt, { ...snapshot, companies: savedCompanies });
        if (savedCompanies === ownCompanies) return;
        // Visa det andra ändrat, utan att tappa det som skrivits här
        // medan sparningen pågick.
        setData(prev => {
          const entries = Object.entries(prev.companies || {});
          const prevOwn = Object.fromEntries(entries.filter(([, c]) => !c.__shared));
          const prevShared = Object.fromEntries(entries.filter(([, c]) => c.__shared));
          return { ...prev, companies: { ...mergeCompanies(ownCompanies, prevOwn, savedCompanies), ...prevShared } };
        });
      };
      if (ref.updatedAt && ref.baseCompanies) {
        for (let attempt = 0; attempt < 3; attempt++) {
          // Först bara ändringarna (några kB i stället för hela kontot).
          const delta = await saveDelta(ref, snapshot, companies);
          if (delta === true) { done(companies); return; }
          if (delta === null && tablesModeRef.current) {
            // Krock i tabelläget: det färska ur tabellerna (med versioner),
            // sedan samma sammanslagning post för post som nedan.
            let fresh;
            try { fresh = await loadFromTables(supabase); } catch { break; }
            const serverCompanies = fresh.state.companies || {};
            companies = mergeCompanies(ref.baseCompanies, companies, serverCompanies);
            ref.baseCompanies = serverCompanies;
            ref.baseSnapshot = fresh.state;
            ref.updatedAt = fresh.updatedAt;
            versionsRef.current = fresh.versions;
            continue;
          }
          if (delta === null) {
            const { data: fresh, error: freshError } = await supabase
              .from('user_data')
              .select('state, updated_at')
              .eq('user_id', user.id)
              .maybeSingle();
            if (freshError || !fresh) break;
            const serverCompanies = fresh.state?.companies || {};
            companies = mergeCompanies(ref.baseCompanies, companies, serverCompanies);
            ref.baseCompanies = serverCompanies;
            ref.baseSnapshot = fresh.state || null;
            ref.updatedAt = fresh.updated_at;
            continue;
          }
          // Endast tabeller: blobbens företag får inte skrivas (databasen
          // nekar det). Sista utvägen nedan sparar via tabellerna.
          if (tablesOnlyRef.current) break;
          const { data: rows, error } = await supabase
            .from('user_data')
            .update({ state: { ...snapshot, companies } })
            .eq('user_id', user.id)
            .eq('updated_at', ref.updatedAt)
            .select('updated_at');
          if (error) break; // felhanteringen nedan (för stor, nätverk osv.)
          if (rows?.length) {
            ref.updatedAt = rows[0].updated_at;
            done(companies);
            return;
          }
          // Någon annan har skrivit sedan förra synken: hämta och slå ihop.
          const { data: fresh, error: freshError } = await supabase
            .from('user_data')
            .select('state, updated_at')
            .eq('user_id', user.id)
            .maybeSingle();
          if (freshError || !fresh) break;
          const serverCompanies = fresh.state?.companies || {};
          companies = mergeCompanies(ref.baseCompanies, companies, serverCompanies);
          ref.baseCompanies = serverCompanies;
          ref.baseSnapshot = fresh.state || null;
          ref.updatedAt = fresh.updated_at;
        }
      }
      // Första sparningen, ett fel, eller tre krockar i rad: spara som förut
      // (med det sammanslagna) hellre än inte alls.
      if (await saveUserDataToSupabase({ ...snapshot, companies })) done(companies);
    })();
    syncInFlightRef.current = run;
    try { await run; } finally { if (syncInFlightRef.current === run) syncInFlightRef.current = null; }
  };

  // Hämtar det någon annan sparat i mina egna företag (en inbjuden konsult,
  // jag själv på en annan enhet) och slår ihop det med det som visas här.
  // Förut skedde det bara om jag själv hade något osparat: utan egna
  // ändringar skickades inget, och den andras kvitton syntes inte förrän
  // sidan laddades om. Samma sammanslagning som vid en krock ovan.
  const pullOwnChanges = async () => {
    while (syncInFlightRef.current) await syncInFlightRef.current.catch(() => {});
    const run = (async () => {
      const ref = serverSyncRef.current;
      if (!ref.baseCompanies) return;
      let fresh;
      if (tablesModeRef.current) {
        const loaded = await loadFromTables(supabase);
        fresh = { state: loaded.state || {}, updatedAt: loaded.updatedAt, versions: loaded.versions };
      } else {
        const { data: row, error } = await supabase.from('user_data').select('state, updated_at').eq('user_id', user.id).maybeSingle();
        if (error || !row) return;
        fresh = { state: row.state || {}, updatedAt: row.updated_at };
      }
      const serverCompanies = fresh.state.companies || {};
      const base = ref.baseCompanies;
      ref.baseCompanies = serverCompanies;
      ref.baseSnapshot = fresh.state;
      ref.updatedAt = fresh.updatedAt;
      if (fresh.versions) versionsRef.current = fresh.versions;
      rememberServerState(user.id, ref.updatedAt, fresh.state);
      setData(prev => {
        const entries = Object.entries(prev.companies || {});
        const prevOwn = Object.fromEntries(entries.filter(([, c]) => !c.__shared));
        const prevShared = Object.fromEntries(entries.filter(([, c]) => c.__shared));
        return { ...prev, companies: { ...mergeCompanies(base, prevOwn, serverCompanies), ...prevShared } };
      });
    })();
    syncInFlightRef.current = run;
    try { await run; } finally { if (syncInFlightRef.current === run) syncInFlightRef.current = null; }
  };

  // Skriver hela user_data-bloben till Supabase OMEDELBART — samma logik
  // som den debouncade "Persist"-useEffecten längre ner (2000 ms), bara
  // utan väntetiden. Bugkritiskt, hittat 2026-09-22: den debouncade
  // sparningen startas om vid VARJE ändring av `data` (den ligger i
  // useEffect-dependencylistan), så skriver eller redigerar man
  // kontinuerligt (t.ex. fyller i en ny offert) och trycker Skicka innan
  // det hunnit bli tyst i två hela sekunder, kan Supabase-raden servern
  // läser fortfarande sakna företaget eller ändringen — ett äkta ägt
  // företag gav då ett falskt "Du har inte längre åtkomst till det här
  // företaget." från send-invoice.js:s loadOwnedOrMemberCompany, trots att
  // ägarskapet var helt korrekt lokalt. Anropas nu (best effort, kastar
  // aldrig) innan varje åtgärd servern verifierar ägarskap för — just nu
  // "Skicka via e-post" (Invoices.jsx/Quotes.jsx, onSyncBeforeServerCall).
  // Sätts när en ändring ska sparas direkt i stället för efter den vanliga väntan.
  const saveSoonRef = useRef(false);
  const syncUserDataNow = async () => {
    if (!user || !isLoggedIn) return;
    try {
      const entries = Object.entries(data.companies || {});
      const sharedEntries = entries.filter(([, c]) => c.__shared);
      const ownEntries = entries.filter(([, c]) => !c.__shared);
      await Promise.all(sharedEntries.map(([id, c]) => persistSharedCompanyFields(id, c)));
      await saveOwnCompaniesMerged(data, Object.fromEntries(ownEntries));
    } catch (err) {
      // Best effort — ett misslyckat flush-försök ska aldrig blockera
      // anroparen (t.ex. e-postutskicket). Den vanliga debouncade
      // sparningen försöker igen som vanligt.
      console.warn('Omedelbar synk till Supabase misslyckades:', err?.message || err);
    }
  };

  // Dra ned för att uppdatera (PullToRefresh, telefon): spara det som väntar
  // och ladda om sidan, så den visar det som finns på servern (t.ex. något
  // som lagts till från datorn). Utan nät laddas inget om: då hade det som
  // inte hunnit sparas kunnat gå förlorat.
  const handlePullRefresh = async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setToast({ message: tr('ui.ingen_anslutning_kunde_inte_uppdatera'), variant: 'info' });
      return;
    }
    await syncUserDataNow();
    window.location.reload();
  };

  // Utan nät: en rad överst som säger det (som i en app), i stället för att
  // sparningen tyst misslyckas. När nätet kommer tillbaka sparas det som
  // väntar direkt, utan att man behöver ändra något mer först.
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false);
  const syncNowRef = useRef(syncUserDataNow);
  syncNowRef.current = syncUserDataNow;
  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => { setIsOffline(false); syncNowRef.current(); };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => { window.removeEventListener('offline', goOffline); window.removeEventListener('online', goOnline); };
  }, []);

  // Inloggningshistorik (Inställningar > Säkerhet > Inloggningshistorik).
  // Skriver EN rad per faktisk SIGNED_IN-händelse (se onAuthStateChange
  // nedan) — men supabase-js's SIGNED_IN kan i vissa fall trigga fler
  // gånger för samma egentliga session (t.ex. en redan inloggad flik som
  // laddas om), så en enkel klient-dedupe (localStorage, 5 minuter) skyddar
  // mot att samma inloggning syns som fem rader i listan. Tyst fel med
  // flit, exakt samma resonemang som logAuditEvent — en misslyckad
  // loggning ska aldrig stoppa inloggningen.
  const logLoginEvent = (authUser) => {
    try {
      const key = `bokix_last_login_logged_${authUser.id}`;
      const last = Number(localStorage.getItem(key) || 0);
      if (Date.now() - last < 5 * 60 * 1000) return;
      localStorage.setItem(key, String(Date.now()));
    } catch { /* privat läge/blockerad storage — logga ändå, bara utan dedupe */ }
    supabase.from('login_events').insert({ user_id: authUser.id, device: detectDevice() }).then(() => {}, () => {});
  };

  // Auth effect
  useEffect(() => {
    // Failsafe: never hang forever on loading screen
    const loadingTimeout = setTimeout(() => {
      setIsLoadingAuth(false);
    }, 5000);

    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        // Återställningslänk (authStorage.js). Utan session gick länken inte
        // att använda, och då ska rutan för nytt lösenord inte visas.
        const recovering = isPasswordRecovery();
        if (recovering && !session?.user) {
          clearPasswordRecovery();
          setPasswordRecovery(false);
        }
        // Oanvänd i mer än INACTIVE_DAYS dagar (sessionPolicy.js): logga ut
        // och visa inloggningen, som om man loggat ut själv. Inte för den som
        // just kommit via en återställningslänk: då tas sessionen bort under
        // rutan och bytet ger "Auth session missing".
        if (session?.user && !recovering && isInactiveTooLong()) {
          await supabase.auth.signOut();
          clearLocalData();
          clearTimeout(loadingTimeout);
          setIsLoadingAuth(false);
          return;
        }
        if (session?.user) markActive();
        // Face ID-spärren på den här enheten: appen öppnas låst.
        if (session?.user && appLockEnabledFor(session.user.id)) setAppLocked(true);
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
        // inget senare någonsin nollställer det. Om länken är en
        // återställningslänk, hoppa över fetchUserData HELT här. Adressen är
        // redan tömd av Supabase, så det avgörs av det authStorage.js minns.
        if (recovering) {
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
        clearPasswordRecovery();
        setPasswordRecovery(false);
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
        // ovan redan skyddas mot. Samma kontroll här.
        if (isPasswordRecovery()) return;
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
        markActive();
        logLoginEvent(session.user);
        fetchUserData(session.user);
      }
    });

    // Appen i förgrunden igen räknas som användning (sessionPolicy.js). Har
    // den legat i bakgrunden längre än APP_LOCK_AFTER_MS spärras den med
    // Face ID igen, om spärren är på för den inloggade på den här enheten.
    let hiddenAt = null;
    const onVisible = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      markActive();
      if (hiddenAt && Date.now() - hiddenAt > APP_LOCK_AFTER_MS) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.user && appLockEnabledFor(session.user.id)) setAppLocked(true);
        });
      }
      hiddenAt = null;
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Sessionen vid uppstart (getSession) och inloggningshändelsen
  // (SIGNED_IN) startar båda en laddning, nästan samtidigt. Ett andra anrop
  // för samma användare medan det första pågår väntar in det i stället för
  // att hämta allt igen (förut gick bl.a. listan över delade företag två gånger).
  // Inloggningens tid (utils/loginTiming.js): klar när appen syns.
  useEffect(() => {
    if (isLoggedIn && user?.id) finishLoginTiming();
  }, [isLoggedIn, user?.id]);

  // Startsidan laddas ner medan inloggningen visas, så att den inte behöver
  // hämtas efter knapptrycket.
  useEffect(() => {
    if (isLoggedIn || isLoadingAuth) return;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500));
    idle(() => { import('./components/Dashboard').catch(() => {}); });
  }, [isLoggedIn, isLoadingAuth]);

  const fetchInFlightRef = useRef(null);
  const fetchUserData = (authUser) => {
    const current = fetchInFlightRef.current;
    if (current && current.userId === authUser.id) return current.promise;
    const promise = fetchUserDataOnce(authUser).finally(() => {
      if (fetchInFlightRef.current?.promise === promise) fetchInFlightRef.current = null;
    });
    fetchInFlightRef.current = { userId: authUser.id, promise };
    return promise;
  };

  const fetchUserDataOnce = async (authUser) => {
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

      // Hastighet: de här fyra frågorna hängde förut på varandra, en
      // tur-och-retur till Supabase i taget. Nu startar de samtidigt och
      // väntas in där de behövs. (Supabase-frågor körs först vid .then.)
      // Först utan själva kontot (state): är raden oförändrad sedan förra
      // gången används kopian i webbläsaren (utils/serverStateCache.js) och
      // bara de små kolumnerna går över nätet. Annars hämtas state efteråt.
      const userDataPromise = supabase
        .from('user_data')
        .select('updated_at,onboarding_completed,onboarding_skipped,company_name,company_orgnr,contact_details,company_settings')
        .eq('user_id', authUser.id)
        .maybeSingle()
        .then(r => r);
      const cachedServerStatePromise = readServerState(authUser.id).catch(() => null);
      // Tabelläget (utils/tableStore.js, steg 4a): bara konton som servern har
      // satt i 'tables'. Saknas tabellen (SQL:en inte körd) eller raden gäller
      // blobben, som förut.
      const storageModePromise = supabase.from('storage_modes').select('mode').eq('user_id', authUser.id).maybeSingle()
        .then(r => (r.error ? null : r.data?.mode || null), () => null);
      // Varje inloggning börjar i blobläget; tabelläget sätts nedan om det gäller.
      tablesModeRef.current = false;
      tablesOnlyRef.current = false;
      versionsRef.current = null;
      const ownedMembershipsPromise = supabase.from('company_members').select('company_id').eq('owner_user_id', authUser.id).eq('status', 'active').then(r => r);
      const firstSubscriptionsPromise = supabase
        .from('subscriptions')
        .select('company_id, status, trial_ends_at, current_period_end, cancel_at_period_end')
        .eq('user_id', authUser.id)
        .then(r => r);

      // ── Delade företag (company_members) — hämtas FÖRE betalspärren, för
      // att en inbjuden användare utan egen prenumeration aldrig ska
      // blockeras: de rider på ÄGARENS aktiva prenumeration, se
      // hasSharedAccess-villkoret nedan. ──
      const sessionForAccessToken = supabaseEnabled ? (await supabase.auth.getSession()).data.session : null;
      const sharedCompanies = supabaseEnabled
        ? await fetchSharedCompanies(authUser.id, sessionForAccessToken?.access_token)
        : {};
      // Bara företag vars ägare betalar ger åtkomst. Ett företag vars ägare
      // slutat betala finns kvar i listan men är låst (isActiveCompanyPaid).
      const hasSharedAccess = Object.values(sharedCompanies).some(c => c.__shared?.ownerPaid !== false);

      // ── Betalspärr: en inloggad Supabase-användare får bara in i appen med
      // en giltig prenumeration på kontots LEGACY-rad (trialing/active/
      // past_due) ELLER minst ett aktivt delat företag (se ovan — de betalar
      // aldrig separat, de rider på ägarens prenumeration). Kollas FÖRE all
      // annan datainhämtning nedan, så ett blockerat konto aldrig hinner se
      // sina egna företagsdata ens kort — EXAKT samma ordning/logik som
      // innan denna ändring, rör bara kontots ORIGINALprenumeration.
      //
      // Betala-per-företag (kundkrav): hämtar numera ALLA rader (inte bara
      // legacy) i EN fråga, fortfarande en RAK RLS-skyddad klientläsning
      // (subscriptions.select policy: auth.uid() = user_id) — inget
      // company_id-filter behövs för att slippa .maybeSingle()-kraschen,
      // .select() utan den returnerar bara en array. MEDVETET inte en
      // server-rond-trip (t.ex. action:'list' via create-subscription-
      // checkout.js): den HÄR koden gatear ALLA inloggningar, appens mest
      // kritiska väg — ju färre beroenden (en till Vercel-function, en
      // service-role-nyckel, requireAuthedUser) mellan "har man en giltig
      // prenumeration" och "kommer man in", desto mindre yta för ett nytt,
      // helt orelaterat fel att av misstag låsa ute en betalande kund.
      // Kartan (keyed på company_id, '' = legacy) används sen igen längre
      // ner (setSubscriptionsMap) för isActiveCompanyPaid — det AKTIVA
      // företagets egen, reaktiva betalspärr.
      let subscriptionsPromise = firstSubscriptionsPromise;
      const fetchSubscriptionsMap = async () => {
        const pending = subscriptionsPromise;
        subscriptionsPromise = null;
        const { data, error } = pending ? await pending : await supabase
          .from('subscriptions')
          .select('company_id, status, trial_ends_at, current_period_end, cancel_at_period_end')
          .eq('user_id', authUser.id);
        if (error) return {};
        const map = {};
        (data || []).forEach(row => { map[row.company_id || ''] = row; });
        return map;
      };

      let subsMap = await fetchSubscriptionsMap();
      let subRow = subsMap[''] || null;

      // Precis kommen tillbaka från en lyckad Stripe Checkout
      // (?subscription_checkout=success, se Auth.jsx/create-subscription-
      // checkout.js) — webhooken (customer.subscription.created) kan hinna
      // efter med några sekunder. Väntar in den istället för att blockera
      // någon som precis betalade, max ~9 sekunder innan vi ger upp. En
      // inbjuden användare med hasSharedAccess väntar aldrig in det här —
      // de har redan sin väg in. company_id på URL:en (se
      // initialSubscriptionCheckoutCompanyId ovan) betyder att det gällde
      // ett SPECIFIKT nytt företag, inte legacy-raden — väntar då in DEN
      // raden istället (behövs inte för inloggningsgaten nedan, bara så
      // subscriptionsMap är färsk direkt när isActiveCompanyPaid kollar den
      // strax efter — annars hade en nyss betald andra-företag-redirect
      // fortfarande visat betalspärren i upp till ~9 sekunder).
      const justSubscribed = initialSubscriptionCheckoutParam === 'success';
      const waitingForCompanyId = justSubscribed ? initialSubscriptionCheckoutCompanyId : null;
      const stillWaiting = () => waitingForCompanyId
        ? !ALLOWED_SUBSCRIPTION_STATUSES.includes(subsMap[waitingForCompanyId]?.status)
        : (!subRow || !ALLOWED_SUBSCRIPTION_STATUSES.includes(subRow.status));
      if (!hasSharedAccess && justSubscribed && stillWaiting()) {
        for (let attempt = 0; attempt < 6 && stillWaiting(); attempt++) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          subsMap = await fetchSubscriptionsMap();
          subRow = subsMap[''] || null;
        }
      }
      // Fortfarande ingen giltig rad: fråga Stripe direkt innan spärren
      // visas. Utan det här fick en kund vars betalning gått igenom i
      // Stripe "du har inte betalat" när webhooken uteblev, och betalade
      // igen (kundrapport 2026-10-02). Gäller varje inloggning som annars
      // hade blockerats, inte bara direkt efter Checkout.
      if (!hasSharedAccess && !isFreeAccountEmail(authUser.email) && stillWaiting()) {
        try {
          const synced = await syncStripeSubscription({
            sessionId: justSubscribed ? initialSubscriptionCheckoutSessionId : null,
            companyId: waitingForCompanyId,
          });
          if (ALLOWED_SUBSCRIPTION_STATUSES.includes(synced)) {
            subsMap = await fetchSubscriptionsMap();
            subRow = subsMap[''] || null;
          }
        } catch (syncErr) {
          console.warn('Kunde inte hämta prenumerationen från Stripe:', syncErr);
        }
      }
      setSubscriptionsMap(subsMap);
      // Tillbaka från Stripe Checkout med en giltig prenumeration: provperioden har börjat.
      if (justSubscribed && !hasSharedAccess && !stillWaiting()) captureEvent('provperiod_startad');

      // UF-konton (utils/ufMode.js) har ingen Stripe-prenumeration alls —
      // registreringen hoppar över betalsteget helt (Auth.jsx). De släpps
      // in på sin gratisperiod i stället, räknad från uf_started_at i
      // auth-metadatan. Metadatan är det ENDA som går att läsa så här
      // tidigt: gaten körs före all företagsdata hämtas, och det är hela
      // poängen med den (ett blockerat konto ska aldrig hinna se sina
      // siffror). När perioden löpt ut faller kontot tillbaka på den
      // vanliga spärren nedan och får betalskärmen som alla andra.
      //
      // Perioden räknas från kontots registrering (authUser.created_at),
      // inte från user_metadata.uf_started_at: metadatan kan användaren
      // skriva om själv. Samma regel som servern (api/_auth.js) och
      // databasen (public.has_paid_access i supabase-setup.sql), som är den
      // riktiga spärren — det här är bara så appen och databasen är överens.
      // UF-flaggan i app_metadata (bara servern skriver), inte user_metadata.
      const ufFree = authUser.app_metadata?.uf ? ufFreePeriod(authUser.created_at) : null;
      // Ett avslutat UF-år (app_metadata, se utils/ufClose.js) räknas som slut.
      const withinUfFreePeriod = Boolean(ufFree && !ufFree.expired) && !authUser.app_metadata?.uf_closed_at;

      if (!hasSharedAccess && !withinUfFreePeriod && !isFreeAccountEmail(authUser.email) && (!subRow || !ALLOWED_SUBSCRIPTION_STATUSES.includes(subRow.status))) {
        setSharedOwnerUnpaid(Object.keys(sharedCompanies).length > 0);
        setSubscriptionGate('blocked');
        setIsLoadingAuth(false);
        return;
      }
      setSharedOwnerUnpaid(false);
      setSubscriptionGate(null);

      // Kommer ihåg om kontot har Face ID, så inloggningen bara visar
      // "Logga in med Face ID" när det faktiskt är påslaget (se
      // passkeyLoginOffered). I bakgrunden, väntar inte in svaret.
      if (passkeysAvailable() && typeof supabase.auth.passkey?.list === 'function') {
        supabase.auth.passkey.list()
          .then(({ data, error: pkError }) => { if (!pkError) rememberPasskeyOnDevice(Array.isArray(data) && data.length > 0); })
          .catch(() => {});
      }

      // Mina EGNA företag som JAG delar med andra (company_members,
      // owner_user_id = jag, status='active') — taggas __hasActiveMembers.
      // Att en inbjuden konsults ändringar inte skrivs över sköts av
      // sammanslagningen i saveOwnCompaniesMerged.
      const { data: ownedMemberships } = await ownedMembershipsPromise;
      const ownedSharedCompanyIds = new Set((ownedMemberships || []).map(m => m.company_id));

      const { data: dbData, error } = await userDataPromise;

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
          .select('state,updated_at')
          .eq('user_id', authUser.id)
          .maybeSingle();

        // Ett riktigt fel (nät, tidsgräns) får aldrig tolkas som "ingen rad":
        // då skapades ett tomt företag och sparades över det riktiga kontot.
        if (fallback.error && fallback.error.code !== 'PGRST116' && !isSupabaseUnavailableError(fallback.error)) {
          throw fallback.error;
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
        if (resultData?.state && resultData.updated_at) rememberServerState(authUser.id, resultData.updated_at, resultData.state, { fullFetch: true });
      } else {
        setDbSupportsProfileColumns(true);
        // Tabelläget: företagen ur tabellerna (ett anrop, med en version per
        // post för krockkontrollen). Går det inte läses blobben som förut.
        const storageMode = resultData ? await storageModePromise : null;
        if (storageMode === 'tables' || storageMode === 'tables_only') {
          let loaded = null;
          let lastError = null;
          // Endast tabeller: blobben är gammal, så ingen reserv. Ett nytt
          // försök, sedan fel hellre än gammal bokföring.
          for (let attempt = 0; attempt < (storageMode === 'tables_only' ? 2 : 1) && !loaded; attempt++) {
            if (attempt) await new Promise(resolve => setTimeout(resolve, 1500));
            try { loaded = await loadFromTables(supabase); } catch (err) { lastError = err; }
          }
          if (loaded) {
            resultData = { ...resultData, state: loaded.state, updated_at: loaded.updatedAt || resultData.updated_at };
            versionsRef.current = loaded.versions;
            tablesModeRef.current = true;
            tablesOnlyRef.current = storageMode === 'tables_only';
          } else if (storageMode === 'tables_only') {
            reportClientError(new Error(`Endast tabeller: kunde inte läsa (${lastError?.message || lastError})`), 'tables');
            throw lastError || new Error('Kunde inte läsa bokföringen.');
          } else {
            reportClientError(new Error(`Tabelläget: kunde inte läsa, använder blobben (${lastError?.message || lastError})`), 'tables');
          }
        }
        if (resultData && !tablesModeRef.current) {
          const cached = await cachedServerStatePromise;
          if (isCacheUsable(cached, authUser.id, resultData.updated_at)) {
            resultData = { ...resultData, state: cached.state };
            noteCachedAt(authUser.id, cached.cachedAt);
          } else {
            const { data: full, error: fullError } = await supabase
              .from('user_data')
              .select('state,updated_at')
              .eq('user_id', authUser.id)
              .maybeSingle();
            if (fullError) throw fullError;
            resultData = { ...resultData, state: full?.state ?? null, updated_at: full?.updated_at ?? resultData.updated_at };
            if (full?.state && full.updated_at) rememberServerState(authUser.id, full.updated_at, full.state, { fullFetch: true });
          }
        }
      }

      if (resultData && resultData.state) {
        const backendState = await loadCompanyDataFromBackend(resultData.state.activeCompanyId);
        // Utgångsläget för sammanslagningen vid sparning (saveOwnCompaniesMerged).
        serverSyncRef.current = {
          updatedAt: resultData.updated_at || null,
          baseCompanies: resultData.updated_at ? structuredClone(resultData.state.companies || {}) : null,
          baseSnapshot: resultData.updated_at ? resultData.state : null,
        };
        // Skuggläsningen (utils/shadowRead.js) jämför blobben precis som den
        // laddades, så den kopieras innan normalizeStore och taggningen nedan.
        // I tabelläget är det redan tabellerna som laddats; inget att jämföra.
        if (!tablesModeRef.current && shadowReadDue(authUser.id)) {
          // Via JSON, inte structuredClone: kopian kan komma från webbläsarens
          // cache (serverStateCache) med fält som är undefined, vilka jsonb i
          // databasen aldrig har. Det gav falskt larm om en ändrad faktura
          // 2026-10-28 fast tabellerna och blobben var lika.
          scheduleShadowRead(supabase, { userId: authUser.id, state: JSON.parse(JSON.stringify(resultData.state)), updatedAt: resultData.updated_at || null });
        }
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
          // Inbjudan kan bära företagets eget company.id i stället för
          // nyckeln (äldre konton, se findCompanyEntry i api/_auth.js).
          if (ownedSharedCompanyIds.has(id) || ownedSharedCompanyIds.has(resolvedState.companies[id]?.company?.id)) {
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
        const firstSharedId = Object.keys(sharedCompanies).find(id => sharedCompanies[id].__shared?.ownerPaid !== false) || Object.keys(sharedCompanies)[0];
        setData({ activeCompanyId: firstSharedId, companies: sharedCompanies });
        setHasCompletedOnboarding(true);
        setHasSkippedOnboarding(true);
        setIsLoggedIn(true);
      } else {
        // First login, create blank company data based on metadata
        const metadata = authUser.user_metadata || {};
        // Registreringen (Auth.jsx) ställer sedan 2026-10-24 alla företagsfrågor
        // före betalningen: org.nr, räkenskapsår, moms, momsperiod och F-skatt
        // ligger då i metadata och företaget är klart direkt. Bara konton utan
        // de svaren (UF, äldre registreringar) får onboardingen i appen.
        const setupDone = metadata.setup_done === true && Boolean(metadata.org_nr);
        const newData = createEmptyCompanyData({
          // UF-registreringen (Auth.jsx) skickar inget org.nummer och ett
          // eget förvalt namn — ett UF-företag som inte hunnit döpa sig
          // ska inte heta "Mitt Företag AB".
          name: metadata.company_name || (metadata.uf ? 'Mitt UF-företag' : 'Mitt Företag AB'),
          orgNr: metadata.org_nr || '',
          fiscalYear: metadata.fiscal_year || '',
          firstFiscalYear: metadata.first_fiscal_year_start && metadata.first_fiscal_year_end
            ? { start: metadata.first_fiscal_year_start, end: metadata.first_fiscal_year_end }
            : null,
          vatRegistered: typeof metadata.vat_registered === 'boolean' ? metadata.vat_registered : null,
          vatNr: metadata.vat_nr || '',
          // Adressen ur företagsregistret, om uppslaget lyckades vid
          // registreringen (Auth.jsx), så den står i Företagsuppgifter direkt.
          address: metadata.company_address || '',
          postalCode: metadata.company_postal_code || '',
          city: metadata.company_city || '',
          isUf: Boolean(metadata.uf),
          needsSetup: !setupDone,
          ufSchool: metadata.uf_school || '',
          ufStartedAt: metadata.uf_started_at || '',
          // Kundönskemål: e-posten som redan finns (kontots inloggnings-
          // adress) ska stå förifylld på företaget direkt, inte krävas
          // inskriven en gång till i Inställningar.
          email: authUser.email || '',
        });
        if (setupDone) {
          Object.assign(newData.company, {
            ...(metadata.vat_period ? { vatPeriod: metadata.vat_period, vatPeriodConfirmedAt: metadata.setup_done_at || new Date().toISOString() } : {}),
            // '' betyder ingen F-skattetext på fakturan.
            fSkatt: typeof metadata.f_skatt === 'string' ? metadata.f_skatt : newData.company.fSkatt,
            setupConfirmedAt: metadata.setup_done_at || new Date().toISOString(),
          });
        }
        const initialStore = {
          activeCompanyId: newData.company.id,
          companies: { [newData.company.id]: newData },
        };
        setData(initialStore);

        await syncCompanyDataToBackend(initialStore.activeCompanyId, initialStore);

        await saveUserDataToSupabase(initialStore, {
          onboarding_completed: setupDone,
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
            vatPeriod: newData.company.vatPeriod,
            chartPlan: 'bas2025',
          },
        });

        localStorage.setItem('bokix_onboarding_completed', setupDone ? 'true' : 'false');
        localStorage.setItem('bokix_onboarding_skipped', 'false');
        setIsLoggedIn(true);
        captureEvent('konto_skapat', { bolagsform: metadata.uf ? 'UF-företag' : (detectOrgType(newData.company.orgNr) || 'okänd') });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: tr('ui.kunde_inte_hamta_kontot'), variant: 'error' });
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
      throw new Error(tr('ui.fel_kod_forsok_igen'));
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
    if (error) throw new Error(translateSupabaseAuthError(error.message));
    clearPasswordRecovery();
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
    clearPasswordRecovery();
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
      connected: 'Stripe är nu anslutet. Kunder kan betala fakturor med kort, och de senaste 90 dagarnas betalningar, avgifter och utbetalningar finns i Granskning. Nya hämtas varje morgon.',
      cancelled: 'Anslutningen avbröts, du kan försöka igen när du vill.',
      error: tr('ui.nagot_gick_fel_vid_stripe_anslutningen_forsok_ig'),
      not_configured: 'Stripe-anslutning är inte konfigurerad ännu. Kontakta support.',
    };
    const variants = { connected: 'success', cancelled: 'info', error: 'error', not_configured: 'info' };
    const debugDetail = params.get('debug'); // temporärt diagnos-fält, se api/stripe/callback.js
    // Kundönskemål: en lyckad anslutning ska visa VÄGEN till transaktionerna
    // direkt, inte bara att den lyckades — Granskning (ReviewQueue.jsx) är
    // där Stripe-raderna faktiskt dyker upp och bokförs.
    if (status === 'connected') setReviewInitialTab('stripe');
    setToast({
      message: (messages[status] || messages.error) + (debugDetail ? ` (${debugDetail})` : ''),
      variant: variants[status] || 'error',
      action: status === 'connected' ? { label: tr('ui.visa_i_granskning'), onClick: () => handleNavTabChange('review') } : undefined,
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
      connected: 'Zettle är nu anslutet till Bokix. Kortförsäljningen hämtas hit en gång om dagen.',
      cancelled: 'Anslutningen avbröts, du kan försöka igen när du vill.',
      error: tr('ui.nagot_gick_fel_vid_zettle_anslutningen_forsok_ig'),
    };
    const variants = { connected: 'success', cancelled: 'info', error: 'error' };
    const debugDetail = params.get('debug'); // temporärt diagnos-fält, se api/zettle/callback.js
    // Se samma resonemang vid stripe_connect-useEffect ovan.
    if (status === 'connected') setReviewInitialTab('zettle');
    setToast({
      message: (messages[status] || messages.error) + (debugDetail ? ` (${debugDetail})` : ''),
      variant: variants[status] || 'error',
      action: status === 'connected' ? { label: tr('ui.visa_i_granskning'), onClick: () => handleNavTabChange('review') } : undefined,
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
    // company_id (betala-per-företag) — bara satt när checkouten gällde ett
    // SPECIFIKT nytillagt företag, inte kontots originalflöde (Auth.jsx).
    // Anroparen är redan inloggad då (till skillnad från originalflödet,
    // där man kommer hit direkt efter en signUp() utan session), så
    // "Logga in för att komma igång" hade varit förvirrande/fel där.
    const forCompany = Boolean(params.get('company_id'));
    // Beloppet kommer från planen checkouten faktiskt skapades för (den
    // skickas tillbaka på success_url, se create-subscription-checkout.js).
    // Stod tidigare hårdkodat som 179 kr, vilket blev fel för alla utom
    // "Med personal, månadsvis"; 179 kvarstår som fallback för länkar utan
    // parametern, samma nivå som servern själv faller tillbaka på.
    const checkoutPlan = planFromId(params.get('plan'));
    const priceLabel = tr('ui.kr_man', { v0: checkoutPlan ? checkoutPlan.price : 179 });

    const messages = forCompany
      ? {
          success: `Klart! 30 dagar gratis, sedan ${priceLabel} för det här företaget.`,
          cancelled: 'Betalningen avbröts — företaget är skapat, men blockerat tills betalningsuppgifter läggs till. Öppna Inställningar → Prenumeration för att försöka igen.',
        }
      : {
          success: `Klart! 30 dagar gratis, sedan ${priceLabel}. Logga in för att komma igång.`,
          cancelled: 'Betalningen avbröts — kontot är skapat, men provperioden startar först när betalningsuppgifter är tillagda. Logga in och försök igen.',
        };
    setToast({
      message: messages[status] || messages.cancelled,
      variant: status === 'success' ? 'success' : 'info',
    });

    params.delete('subscription_checkout');
    params.delete('company_id');
    params.delete('session_id');
    const newSearch = params.toString();
    window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash);
  }, []);

  // Persist
  useEffect(() => {
    // Taggar cachen med den inloggade användaren (se loadDataForUser/
    // STORAGE_OWNER_KEY-kommentaren ovan) — utan user (mock-/demo-läge)
    // sparas den precis som förut, otaggad. Skrivs när webbläsaren är ledig.
    scheduleLocalSave(data, user?.id);

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
    //   2) Mina EGNA företag sparas som en helblob, men bara om raden är
    //      oförändrad sedan förra synken, annars slås den ihop post för
    //      post (saveOwnCompaniesMerged) istället för att lita på min ev.
    //      förlegade lokala kopia — annars skulle min egen periodiska
    //      sparning kunna tysta skriva över en samtidig editors ändring som
    //      gick via spår (1) ovan sekunder tidigare. Se kommentaren vid
    //      set_company_field i supabase-setup.sql för samma resonemang från
    //      andra hållet.
    if (user && isLoggedIn) {
      // Samma synk som syncUserDataNow (definierad ovan, vid
      // saveUserDataToSupabase) — bara med den vanliga 2-sekundersväntan.
      const delay = saveSoonRef.current ? 0 : 2000;
      saveSoonRef.current = false;
      timeoutIds.push(setTimeout(() => { syncUserDataNow(); }, delay));
    }

    return () => timeoutIds.forEach(clearTimeout);
  }, [data, user, isLoggedIn, syncCompanyDataToBackend]);

  // Ett delat företag som bara är hämtat som namn (__stub) hämtas helt när
  // det öppnas. Måste stå INNAN `if (isLoadingAuth) return ...`.
  const activeStub = data.companies?.[data.activeCompanyId];
  const activeIsStub = Boolean(activeStub?.__stub && !activeStub.__stubError);
  useEffect(() => {
    if (activeIsStub && user) loadSharedCompanyStub(data.activeCompanyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIsStub, data.activeCompanyId, user]);

  // Tillbaka till fliken: hämta det någon annan ändrat (ägaren eller en
  // inbjuden konsult, eller jag själv på en annan enhet) och slå ihop med
  // det som visas här, utan att ladda om sidan.
  const refreshFromServerRef = useRef(null);
  refreshFromServerRef.current = async () => {
    if (!user || !isLoggedIn || !supabaseEnabled) return;
    const active = data.companies?.[data.activeCompanyId];
    if (active?.__shared) {
      if (active.__stub) return;
      const accessToken = await getAccessToken();
      if (!accessToken) return;
      const companyId = data.activeCompanyId;
      const res = await fetch(`/api/company-access?company_id=${encodeURIComponent(companyId)}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const json = await res.json();
      const last = lastPersistedSharedFieldsRef.current[companyId];
      if (!json?.company || !last) return;
      setData(prev => {
        const local = prev.companies?.[companyId];
        if (!local?.__shared) return prev;
        const merged = mergeCompany(last, local, { ...json.company, __shared: local.__shared });
        // Det som kom från servern räknas som sparat, så det inte skickas tillbaka.
        for (const f of SHARED_COMPANY_WRITABLE_FIELDS) if (local[f] === last[f]) last[f] = merged[f];
        return { ...prev, companies: { ...prev.companies, [companyId]: merged } };
      });
      return;
    }
    const { data: meta } = await supabase.from('user_data').select('updated_at').eq('user_id', user.id).maybeSingle();
    if (meta?.updated_at && serverSyncRef.current.updatedAt && meta.updated_at !== serverSyncRef.current.updatedAt) {
      await pullOwnChanges();
    }
  };
  useEffect(() => {
    if (!isLoggedIn) return undefined;
    let lastRun = 0;
    const onFocus = () => {
      if (document.visibilityState === 'hidden' || Date.now() - lastRun < 15000) return;
      lastRun = Date.now();
      refreshFromServerRef.current?.().catch(err => console.warn('Kunde inte hämta ändringar:', err?.message || err));
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [isLoggedIn]);

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
          // Pengarna landar på Stripe-saldot (1686), inte på banken. Stripes
          // avgift och utbetalningen till 1930 bokförs från Granskning
          // (utils/stripeLedger.js).
          handleRegisterInvoicePayment(event.invoice_id, event.amount_total, event.paid_at?.split('T')[0], STRIPE_BALANCE_ACCOUNT);
          // Notisklockan visar bara betalningar via Betala nu (utils/notificationFeed.js).
          setInvoices(prev => prev.map(i => (i.id === event.invoice_id ? { ...i, paidVia: 'stripe' } : i)));
        }
        await supabase.from('stripe_payment_events').update({ applied_at: new Date().toISOString() }).eq('id', event.id);
      }
    })();

    return () => { cancelled = true; };
  }, [user, supabaseEnabled, data.activeCompanyId]);

  // Granskning i sidomenyn visas bara när något väntar. Kvitton utan konto räknas
  // ur company-datat (reviewCount); Stripe- och Zettle-raderna ligger i egna
  // tabeller som bara Granskning-sidan läste, så de räknas här (billig count-fråga,
  // inga rader hämtas). Körs om när man kommer till eller lämnar sidan, så att
  // menyn följer med när man godkänt det sista. Måste stå INNAN
  // `if (isLoadingAuth) return ...` (hooks-ordningen).
  const [integrationReviewCount, setIntegrationReviewCount] = useState(0);
  // De senaste ogranskade raderna, till notisklockan.
  const [integrationEvents, setIntegrationEvents] = useState([]);
  const onReviewTab = resolveTab(activeTab) === 'review';
  useEffect(() => {
    if (!user?.id || !supabaseEnabled || !data.activeCompanyId) { setIntegrationReviewCount(0); setIntegrationEvents([]); return undefined; }
    let cancelled = false;
    const countPending = async (table) => {
      try {
        const { data: rows, count, error } = await supabase
          .from(table)
          .select('id, created_at', { count: 'exact' })
          .eq('user_id', user.id)
          .eq('company_id', data.activeCompanyId)
          .is('reviewed_at', null)
          .order('created_at', { ascending: false })
          .limit(20);
        return error ? { count: 0, rows: [] } : { count: count || 0, rows: rows || [] };
      } catch {
        return { count: 0, rows: [] };
      }
    };
    (async () => {
      const [stripe, zettle] = await Promise.all([countPending('stripe_ledger_events'), countPending('zettle_ledger_events')]);
      if (cancelled) return;
      setIntegrationReviewCount(stripe.count + zettle.count);
      setIntegrationEvents([
        ...stripe.rows.map(r => ({ id: r.id, source: 'stripe', at: r.created_at })),
        ...zettle.rows.map(r => ({ id: r.id, source: 'zettle', at: r.created_at })),
      ]);
    })();
    return () => { cancelled = true; };
  }, [user?.id, supabaseEnabled, data.activeCompanyId, onReviewTab]);

  // Sidomenyns grupper kan fällas ihop genom att klicka på rubriken. Valet sparas
  // i webbläsaren. Alla grupper är uppfällda som standard, och gruppen som
  // innehåller sidan man står på är alltid uppfälld (se nav-blocket längre ner).
  const [supplierPageTab, setSupplierPageTab] = useState('invoices');
  const [collapsedNav, setCollapsedNav] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem('bokix_nav_collapsed') || '[]');
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  });
  useEffect(() => {
    try { localStorage.setItem('bokix_nav_collapsed', JSON.stringify(collapsedNav)); } catch { /* privat läge: valet gäller bara den här sessionen */ }
  }, [collapsedNav]);
  const toggleNavGroup = (key) => setCollapsedNav(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => {
      setIsProfileMenuOpen(false);
      setIsNotifMenuOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // Produktrundturen (driver.js, se utils/productTour.js) — auto-startar
  // EN gång per konto (localStorage-flagga i den filen), men bara när den
  // riktiga app-vyn (sidomeny + topbar, se app-container-grenen längst ner
  // i return-satsen) faktiskt är den som kommer renderas den här
  // omgången — annars pekar stegen på element som inte finns i DOM:et.
  // Kan INTE läsa `isActiveCompanyPaid`/`company` (de beräknas längre ner,
  // EFTER `if (isLoadingAuth) return`) utan att bryta hooks-ordningen om
  // den här effekten låg där — samma villkor räknas därför om här, från
  // samma state (data/subscriptionsMap/user), se App.jsx:s egen
  // isActiveCompanyPaid-kommentar för originalet. `tourAutoStartedRef`
  // säkerställer att den bara triggas EN gång per sidladdning, inte varje
  // gång något av beroendena råkar ändras (t.ex. att öppna/stänga
  // profilmenyn räknas inte, men skulle annars trigga om igen).
  // Onboardingen för ett nytt konto (OnboardingFlow.jsx): visas när det egna
  // aktiva företaget har `needsSetup` och är betalt. Rundturen nedan väntar
  // tills den är klar.
  const activeNeedsSetup = Boolean(data.companies?.[data.activeCompanyId]?.company?.needsSetup) && !data.companies?.[data.activeCompanyId]?.__shared;
  useEffect(() => {
    if (!isLoggedIn || showOnboarding || !activeNeedsSetup || subscriptionGate === 'blocked' || !user?.id) return;
    const activeCompany = data.companies?.[data.activeCompanyId]?.company;
    const paid = isFreeAccountEmail(user?.email)
      || !activeCompany?.requiresOwnPayment
      || ALLOWED_SUBSCRIPTION_STATUSES.includes(subscriptionsMap[activeCompany?.id]?.status);
    if (paid) setShowOnboarding(true);
  }, [isLoggedIn, showOnboarding, activeNeedsSetup, subscriptionGate, user, data.activeCompanyId, data.companies, subscriptionsMap]);

  useEffect(() => {
    if (tourAutoStartedRef.current) return;
    if (!isLoggedIn || showOnboarding || activeNeedsSetup || subscriptionGate === 'blocked' || !user?.id) return;
    const activeCompany = data.companies?.[data.activeCompanyId]?.company;
    const paid = isFreeAccountEmail(user?.email)
      || !activeCompany?.requiresOwnPayment
      || ALLOWED_SUBSCRIPTION_STATUSES.includes(subscriptionsMap[activeCompany?.id]?.status);
    if (!paid) return;
    tourAutoStartedRef.current = true;
    // maybeAutoStartTour väntar själv in Dashboard-fliken (lat-laddad, se
    // utils/productTour.js:s waitForElement) — sidomenyn/topbaren finns
    // redan här (samma render som satte isLoggedIn/showOnboarding).
    // handleNavTabChange skickas med så rundturen kan navigera in på
    // varje sektion på riktigt (se productTour.js:s withNavigation).
    // Gömda funktioner (utils/optionalFeatures.js) hoppas över i rundturen.
    maybeAutoStartTour(user.id, handleNavTabChange, hiddenFeatureNavIds(data.companies?.[data.activeCompanyId]), user);
  }, [isLoggedIn, showOnboarding, activeNeedsSetup, subscriptionGate, user, data.activeCompanyId, data.companies, subscriptionsMap]);

  const handleLogin = () => {
    // Auth component now handles Supabase calls. We just rely on onAuthStateChange.
  };

  const handleSwitchCompany = (companyId) => {
    if (!data.companies[companyId] || companyId === data.activeCompanyId) return;
    setData(prev => ({ ...prev, activeCompanyId: companyId }));
    setActiveTab('dashboard');
    if (typeof window !== 'undefined') window.location.hash = 'dashboard';
  };

  // "Ta bort företag" (Settings.jsx, kundönskemål: en snabb städknapp —
  // testkonton kan annars hopa sig, samma fri-tillgång-konto som
  // FREE_ACCOUNT_EMAILS gäller för gör det extra lätt att skapa många på
  // en gång utan att märka det). Tar bort företaget HELT (inte bara dess
  // bokföringsdata, jämför "Radera företagets bokföringsdata" ovan i
  // Settings.jsx — den behåller företaget, den här tar bort det). Avslutar
  // först en ev. egen Stripe-prenumeration för just det företaget
  // (requiresOwnPayment, se handleCreateNewCompany) så en borttagen
  // testfirma inte fortsätter dras månadsvis i tysthet — best effort,
  // blockerar inte själva borttagningen om avslutet skulle misslyckas
  // (företaget ska gå att bli av med även om Stripe strular just då).
  // Sjuårslöftet: innan ett eget företag töms eller tas bort sparas en
  // arkivkopia på servern (api/archive.js, _archive.js), med bokföringen och
  // alla uppladdade filer. Den senaste lokala ändringen synkas först, så att
  // kopian är komplett. Går arkiveringen inte stoppas raderingen: hellre en
  // radering som får göras om än bokföring som försvinner.
  const archiveBeforeRemoval = async (companyId, reason) => {
    if (data.companies?.[companyId]?.__shared) return true;
    await syncUserDataNow();
    try {
      const token = await getAccessToken();
      const res = await fetch('/api/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ company_id: companyId, reason }),
      });
      if (res.ok) return true;
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.error || `HTTP ${res.status}`);
    } catch (err) {
      console.error('Arkivering före radering misslyckades:', err);
      setToast({ message: tr('ui.kunde_inte_spara_en_arkivkopia_av_bokforingen_sa'), variant: 'error' });
      return false;
    }
  };

  const handleDeleteCompany = async (companyId) => {
    // Bugkritiskt (kundrapport: "jag kan inte ta bort NÅGOT företag" —
    // trots 2+ företag på kontot, inte bara det redan kända fallet med ett
    // enda kvarvarande). Hela funktionens kropp saknade tidigare ett eget
    // try/catch: om NÅGOT steg kastade ett oväntat fel (t.ex. ett
    // Supabase-/nätverksfel som inte redan fångas av de inre try/catch-
    // blocken) sågs det aldrig av användaren — bara ett tyst "Uncaught (in
    // promise)" i webbläsarkonsolen, medan Settings.jsx:s egen "tar bort…"-
    // snurra på knappen (se companyList-radens onClick) bara tystnade och
    // gick tillbaka till en vanlig papperskorg, utan förklaring. Ett riktigt
    // felmeddelande nu i stället för tystnad — oavsett VAD som faktiskt gick
    // fel, syns det nu, i stället för att bara "inte funka" utan spår.
    try {
    const remainingIds = Object.keys(data.companies).filter(id => id !== companyId);
    if (remainingIds.length === 0) {
      setToast({ message: tr('ui.du_maste_ha_minst_ett_foretag_kvar_pa_kontot'), variant: 'error' });
      return;
    }
    const target = data.companies[companyId]?.company;
    if (!(await archiveBeforeRemoval(companyId, 'delete'))) return;
    // Bugfix (kundrapport: "ta bort företag funkar inte" — knappen kändes
    // dödgrävd/långsam): requiresOwnPayment är sant redan när ett tillagt
    // företag SKAPAS (handleCreateNewCompany), inte först när Stripe-
    // redirecten faktiskt slutförts — ett företag man aldrig hann betala
    // för (t.ex. avbröt/stängde Checkout-fliken, precis det här
    // teströjnings-flödet är till för) har alltså INGEN rad i subscriptions
    // att avsluta. cancelStripeSubscription anropade ändå alltid Stripe,
    // fick tillbaka ett 404 ("Ingen prenumeration hittades") — och 404
    // står i requestStripeApi:s RETRYABLE_STATUSES (tänkt för momentana
    // infrastrukturglapp, inte "finns inte"), så anropet försökte om SIG
    // TRE gånger med upp till ~2,4 sekunders fördröjning innan det gav upp
    // och föll tyst till catch-grenen. Raden såg då ut att hänga sig i
    // flera sekunder innan den äntligen försvann — kändes trasig även fast
    // borttagningen till slut gick igenom. subscriptionsMap (redan hämtad,
    // samma källa som isActiveCompanyPaid använder) vet REDAN om det finns
    // en riktig prenumeration — inget att fråga Stripe om i onödan när det
    // inte gör det.
    if (target?.requiresOwnPayment && subscriptionsMap[companyId]?.status) {
      try {
        await cancelStripeSubscription(companyId);
      } catch (err) {
        console.warn('Kunde inte avsluta Stripe-prenumerationen för borttaget företag:', err.message);
      }
    }

    // Dataminimering: företagets uppladdade filer (kvitton, underlag,
    // logotyp) ligger i Storage, inte i JSON-posten — de försvinner alltså
    // INTE av att företaget tas bort ur `data`. Utan det här steget blev
    // varenda kvittobild kvar i bucketen för alltid, osynlig för
    // användaren och betald av oss.
    //
    // Filerna samlas via mönstret (collectStorageUrls), inte via en lista
    // med kända fältnamn — ett nytt filfält någon lägger till i framtiden
    // städas då automatiskt i stället för att tyst missas.
    //
    // Körs FÖRE state-uppdateringen medan datan fortfarande finns kvar att
    // läsa, men väntas inte in (deleteFileFromStorage är best effort, se
    // fileUpload.js) — en misslyckad städning får aldrig hindra att
    // företaget faktiskt tas bort.
    collectStorageUrls(data.companies[companyId]).forEach(url => deleteFileFromStorage(url));

    const nextCompanies = { ...data.companies };
    delete nextCompanies[companyId];
    const nextActiveId = companyId === data.activeCompanyId ? remainingIds[0] : data.activeCompanyId;
    const nextState = { ...data, activeCompanyId: nextActiveId, companies: nextCompanies };

    // Bugkritiskt (kundrapport: "det står företaget är bort men finns
    // fortfarande"): ordningen var tidigare optimistisk UTAN återställning
    // — setData(nextState) + en "borttaget"-bekräftelse gick ut direkt,
    // INNAN (och oavsett om) saveUserDataToSupabase faktiskt lyckades. Den
    // funktionen svalde tidigare varje databasfel tyst (se dess egen
    // kommentar, nu åtgärdad att returnera true/false) — så appen påstod
    // sig ha tagit bort företaget även när skrivningen aldrig nådde
    // databasen, och nästa inloggning/synk hämtade tillbaka det oförändrat.
    // Sparningen avvaktas nu FÖRST: lyckas den inte, rullas det lokala
    // tillståndet tillbaka och ett äkta felmeddelande visas i stället för
    // en falsk bekräftelse.
    setData(nextState);
    const saved = await saveUserDataToSupabase(nextState);
    if (!saved) {
      setData(data);
      setToast({ message: tr('ui.kunde_inte_ta_bort_andringen_sparades_inte_forso', { v0: target?.name || 'företaget' }), variant: 'error' });
      return;
    }
    if (nextActiveId !== data.activeCompanyId) {
      setActiveTab('dashboard');
      if (typeof window !== 'undefined') window.location.hash = 'dashboard';
    }
    // Kundrapport ("jag kan inte ta bort något företag"): raden försvann
    // tidigare tyst ur listan utan något som helst kvitto på att det
    // faktiskt gick igenom — särskilt otydligt när man tar bort ett
    // företag man INTE just då står på (ingen sidnavigering markerar då
    // att något hände alls). En riktig bekräftelse nu, samma Toast som
    // resten av appen redan använder för lyckade åtgärder — och den visas
    // nu bara EFTER att sparningen ovan faktiskt bekräftats.
    setToast({ message: `${target?.name || 'Företaget'} borttaget.`, variant: 'success' });
    } catch (err) {
      console.error('Kunde inte ta bort företaget:', err);
      setToast({ message: tr('ui.kunde_inte_ta_bort_foretaget_forsok_igen_om_en_s', { v0: err?.message || 'okänt fel' }), variant: 'error' });
    }
  };

  // "Lägg till företag" (profilmenyn): öppnar onboardingen men skapar INGET
  // förrän sista steget är klart (handleCreateNewCompany nedan), så "Avbryt"
  // lämnar inget tomt företag efter sig.
  const handleStartNewCompany = () => {
    // Bara inbjuden (inget eget företag): ingen väg till en egen betalning.
    if (!Object.values(data.companies || {}).some(c => !c?.__shared)) return;
    setAddingCompany(true);
  };

  // Skickar det nya företaget vidare till Stripe för dess EGNA betalning —
  // samma redirect-mönster/felmeddelande som Auth.jsx regStep 3 (kontots
  // ORIGINALflöde) redan använder. Delad av handleCreateNewCompany nedan.
  const redirectNewCompanyToPayment = async (companyId) => {
    try {
      const { session } = await createStripeSubscriptionCheckout({
        user_id: user.id,
        customer_email: user.email,
        company_id: companyId,
      });
      if (!session?.url) throw new Error(tr('ui.ingen_betalningslank_mottogs_fran_stripe'));
      window.location.href = session.url;
    } catch (err) {
      const stripeIssue = /^Stripe API error \(\d+\)$/.test(err.message)
        ? tr('ui.kunde_inte_na_betalningstjansten_just_nu')
        : err.message;
      setToast({
        message: tr('ui.foretaget_skapades_men_vi_kunde_inte_skicka_dig', { stripeIssue }),
        variant: 'error',
      });
      setActiveTab('dashboard');
    }
  };

  const handleOnboardingComplete = async (profile) => {
    const name = profile.companyName?.trim() || company.name || tr('ui.mitt_foretag_ab');
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
            postalCode: profile.postalCode || data.companies[data.activeCompanyId].company.postalCode || '',
            city: profile.city || data.companies[data.activeCompanyId].company.city || '',
            email: profile.email || data.companies[data.activeCompanyId].company.email,
            phone: profile.phone || data.companies[data.activeCompanyId].company.phone,
            logoUrl: profile.logoUrl || data.companies[data.activeCompanyId].company.logoUrl,
            fiscalYear: profile.fiscalYear || data.companies[data.activeCompanyId].company.fiscalYear,
            ...(profile.setup ? {
              firstFiscalYear: profile.setup.firstFiscalYear,
              vatRegistered: profile.setup.vatRegistered,
              vatNr: profile.setup.vatNr || data.companies[data.activeCompanyId].company.vatNr || '',
            } : {}),
            vatPeriod: profile.vatPeriod || data.companies[data.activeCompanyId].company.vatPeriod,
            chartPlan: profile.chartPlan || data.companies[data.activeCompanyId].company.chartPlan || 'bas2025',
            // F-skatten väljs i onboardingen: '' betyder ingen text på fakturan.
            ...(typeof profile.fSkatt === 'string' ? { fSkatt: profile.fSkatt } : {}),
            needsSetup: false,
            setupConfirmedAt: new Date().toISOString(),
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
    captureEvent('onboarding_klar', { bolagsform: detectOrgType(nextState.companies[data.activeCompanyId].company.orgNr) || 'okänd' });

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
    // "Gör det senare": onboardingen visas inte igen av sig själv. Allt den
    // frågar efter finns under Inställningar.
    const active = data.companies[data.activeCompanyId];
    const nextState = active?.company?.needsSetup
      ? { ...data, companies: { ...data.companies, [data.activeCompanyId]: { ...active, company: { ...active.company, needsSetup: false } } } }
      : data;
    setData(nextState);
    setShowOnboarding(false);
    setHasSkippedOnboarding(true);
    localStorage.setItem('bokix_onboarding_skipped', 'true');

    await saveUserDataToSupabase(nextState, {
      onboarding_skipped: true,
      onboarding_completed: false,
    });
  };

  // Onboardingens sista steg i addMode: skapar företaget HÄR och avslutar med
  // Stripe-redirect i stället för dashboarden. MEDVETET utan
  // saveUserDataToSupabase:s `extras`-argument (jämför handleOnboardingComplete
  // ovan): onboarding_completed/company_name/company_orgnr m.fl. är
  // kontots EGNA kolumner (beskriver bara det allra första företaget) och
  // ska aldrig skrivas över av ett SENARE tillagt företags uppgifter.
  const handleCreateNewCompany = async ({ companyName, orgNr, address, postalCode, city, email, setup, vatPeriod, fSkatt, registryVerified }) => {
    setAddingCompanySubmitting(true);
    try {
      const newCompanyData = createEmptyCompanyData({ name: companyName, orgNr, address, postalCode, city, email: email || user?.email || '', ...(setup || {}) });
      Object.assign(newCompanyData.company, {
        requiresOwnPayment: true,
        ...(vatPeriod ? { vatPeriod } : {}),
        ...(typeof fSkatt === 'string' ? { fSkatt } : {}),
        setupConfirmedAt: new Date().toISOString(),
        // Vem som intygade uppgifterna, och om företaget hittades i registret.
        attestedAt: new Date().toISOString(),
        attestedBy: user?.email || '',
        registryVerified: Boolean(registryVerified),
      });
      const companyId = newCompanyData.company.id;
      const nextState = {
        ...data,
        activeCompanyId: companyId,
        companies: {
          ...data.companies,
          [companyId]: newCompanyData,
        },
      };

      setData(nextState);
      setAddingCompany(false);
      await saveUserDataToSupabase(nextState);
      await redirectNewCompanyToPayment(companyId);
    } finally {
      setAddingCompanySubmitting(false);
    }
  };

  if (isLoadingAuth || activeIsStub) {
    // Tidigare stod en felsökningstext ("Kontrollera att Supabase-nycklar
    // är inlagda") här permanent, synlig för alla vid varje sidladdning —
    // en intern debug-notering som aldrig skulle vara användarvänd.
    // Visade tidigare bara en ensam snurrande cirkel mitt på en tom sida —
    // ersatt med en skelettsiluett av sidan man är på väg in i (sidomeny +
    // topbar + Startsidans kort/graf/lista), se AppLoadingSkeleton ovan.
    return <AppLoadingSkeleton tab={activeTab} />;
  }
  // Ett delat företag som inte gick att hämta: ett tydligt fel med nytt
  // försök, aldrig appen med halva datan och aldrig en betalningsruta.
  if (activeStub?.__stubError) {
    const retry = () => setData(prev => ({ ...prev, companies: { ...prev.companies, [prev.activeCompanyId]: { ...prev.companies[prev.activeCompanyId], __stubError: false } } }));
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-main)' }}>
        <div style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '28px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
          <p style={{ fontSize: '14.5px', color: 'var(--text-main)', margin: '0 0 18px', lineHeight: 1.6 }}>{tr('ui.kunde_inte_hamta_foretaget')}</p>
          <button type="button" onClick={retry} style={{ padding: '10px 20px', background: BRAND.green, color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>{tr('ui.forsok_igen')}</button>
          {/* Kommer man inte vidare: byt till ett annat företag eller logga ut,
              i stället för att sitta fast på felet. */}
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '14px' }}>
            {Object.keys(data.companies || {}).some(id => id !== data.activeCompanyId && !data.companies[id]?.__stub) && (
              <button type="button" onClick={() => { const other = Object.keys(data.companies).find(id => id !== data.activeCompanyId && !data.companies[id]?.__stub); if (other) setData(prev => ({ ...prev, activeCompanyId: other })); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>{tr('stubError.otherCompany')}</button>
            )}
            <button type="button" onClick={async () => { await supabase.auth.signOut(); clearLocalData(); setIsLoggedIn(false); }} style={{ background: 'none', border: 'none', padding: 0, fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>{tr('stubError.logout')}</button>
          </div>
        </div>
      </div>
    );
  }

  // Current company data
  const currentCompany = data.companies[data.activeCompanyId];
  const company = currentCompany.company;
  // Betala-per-företag (kundkrav): reaktiv (omräknad varje render, inte en
  // useEffect/useState) — legacy-företag (!requiresOwnPayment, dvs. allt
  // som fanns innan den här ändringen samt kontots första företag) är
  // redan täckta av inloggningens egen betalspärr ovan (subscriptionGate,
  // kontots legacy-rad) och behöver ingen egen koll här. Ett
  // requiresOwnPayment-företag kollas mot SIN EGNA rad i subscriptionsMap
  // (satt i fetchUserData, se den kommentaren) — omräknas automatiskt vid
  // varje företagsbyte eftersom `company` då ändras.
  // Delat företag vars ägare slutat betala: låst för medlemmen, med en
  // egen förklaring i betalspärren (det är ägaren som ska betala).
  const activeSharedLocked = data.companies?.[data.activeCompanyId]?.__shared?.ownerPaid === false;
  const unlockedCompanyId = activeSharedLocked
    ? Object.keys(data.companies || {}).find(id => id !== data.activeCompanyId && data.companies[id]?.__shared?.ownerPaid !== false)
    : null;
  // Ett delat företag betalas av ägaren (ownerPaid ovan, kollat på servern).
  // Den inbjudnas egen subscriptionsMap har aldrig ägarens rader, så
  // requiresOwnPayment får inte kräva betalning av en inbjuden revisor.
  const isActiveCompanyPaid = !activeSharedLocked && (isFreeAccountEmail(user?.email)
    || Boolean(currentCompany?.__shared)
    || !company?.requiresOwnPayment
    || ALLOWED_SUBSCRIPTION_STATUSES.includes(subscriptionsMap[company.id]?.status));
  const accounts = currentCompany.accounts;
  const verifications = currentCompany.verifications;
  // Kreditfakturor reglerar sitt original (utils/creditNotes.js).
  const invoices = applyCreditNotes(currentCompany.invoices);
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
  const agiReports = currentCompany.agiReports || [];
  // Bank – CSV/Excel-import (Bank.jsx). `|| []`: samma skyddsnät som
  // quotes/articles ovan — konton inloggade sedan innan den här funktionen
  // fanns saknar fältet i sparad data tills de sparar något själva.
  const bankTransactions = currentCompany.bankTransactions || [];
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
  const setAgiReports = (fn) => updateCompanyField('agiReports', (prev) => (typeof fn === 'function' ? fn(prev || []) : fn));
  const setTimeEntries = (fn) => updateCompanyField('timeEntries', fn);
  const setTimeReportStatuses = (fn) => updateCompanyField('timeReportStatuses', fn);
  const setBillableTimeEntries = (fn) => updateCompanyField('billableTimeEntries', fn);
  const setBankTransactions = (fn) => updateCompanyField('bankTransactions', (prev) => (typeof fn === 'function' ? fn(prev || []) : fn));

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
    // Samma rader som Steg 3 visar (vatSettlementRows): varje momskonto,
    // även omvänd skattskyldighet och import, nollställs mot 2650.
    const verRows = vatSettlementRows(rounded);

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
      setToast({ message: tr('ui.logga_in_for_att_ansluta_stripe'), variant: 'error' });
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
      if (!response.ok || !payload?.url) throw new Error(payload?.error || tr('ui.kunde_inte_starta_stripe_anslutningen', { status: response.status }));
      window.location.href = payload.url;
    } catch (error) {
      console.error(error);
      setToast({ message: tr('ui.kunde_inte_ansluta_stripe', { v0: error.message || error }), variant: 'error' });
    }
  };

  // reauthToken — se kommentaren vid handleOpenStripeOnboarding ovan, samma
  // resonemang gäller frånkoppling.
  const handleDisconnectStripe = async (reauthToken) => {
    if (!company.stripeAccountId) return;
    if (!(await confirmDialog(tr('ui.koppla_fran_stripe_bokix_kan_da_inte_langre_ta_e')))) return;

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
      if (!response.ok) throw new Error(payload?.error || tr('ui.frankoppling_misslyckades', { status: response.status }));
      setCompanyInfo({ ...company, stripeAccountId: '' });
    } catch (error) {
      console.error(error);
      setToast({ message: tr('ui.kunde_inte_koppla_fran_stripe', { v0: error.message || error }), variant: 'error' });
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
      setToast({ message: tr('ui.logga_in_for_att_ansluta_zettle'), variant: 'error' });
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
      if (!response.ok || !payload?.url) throw new Error(payload?.error || tr('ui.kunde_inte_starta_zettle_anslutningen', { status: response.status }));
      window.location.href = payload.url;
    } catch (error) {
      console.error(error);
      setToast({ message: tr('ui.kunde_inte_ansluta_zettle', { v0: error.message || error }), variant: 'error' });
    }
  };

  // ── E-postavsändare (Sida 33, Steg 2) ──────────────────────────────────
  // Kastar vidare vid fel istället för att larma här — Settings.jsx äger
  // sin egen busy/fel-state runt dessa anrop så den kan visa felet inline
  // bredvid domänfältet, inte som en global alert().
  const handleConnectEmailDomain = async (domain) => {
    const result = await createEmailDomain(domain, company.id);
    setCompanyInfo({
      ...company,
      emailDomain: domain,
      resendDomainId: result.id,
      resendDomainToken: result.token,
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

  const handleDisconnectEmailDomain = async () => {
    if (!(await confirmDialog(tr('ui.koppla_fran_den_har_avsandardomanen_fakturor_ski')))) return;
    setCompanyInfo({ ...company, emailDomain: '', resendDomainId: '', resendDomainToken: '', emailDomainStatus: '', emailDomainRecords: [] });
  };

  // Bygger Checkout-radrar och skapar en Stripe-betalningssession, returnerar
  // bara URL:en — kastar (istället för att larma med alert) så anroparen
  // själv avgör hur ett fel ska visas. Delad av två flöden i Invoices.jsx:
  // dels PaymentLinkModal ("Skapa betalningslänk" i radmenyn — visar länken
  // för kopiering/e-postutskick istället för att navigera bort ifrån appen),
  // dels handleSendEmail (lägger samma länk direkt i fakturamejlet).
  const getInvoicePaymentLinkUrl = async (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error(tr('ui.fakturan_kunde_inte_hittas'));
    if (!company.stripeAccountId) throw new Error(tr('ui.stripe_ar_inte_anslutet'));

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

    if (!session?.url) throw new Error(tr('ui.betalningslank_skapad_men_ingen_lank_mottogs'));
    return session.url;
  };

  // Add (or continue-update) a verification.
  const handleAddVerification = (incomingVer) => {
    // Företag utan momsregistrering: automatiska bokningar (kvitton,
    // fakturor, leverantörsfakturor, bank) får ingen moms. Ingående moms blir
    // en del av kostnaden och utgående moms en del av intäkten, se
    // utils/vatRegistration.js. Manuella verifikationer (ingen source) och
    // importerad historik lämnas som de är.
    const stripVat = isVatExempt(company) && incomingVer?.source
      && !String(incomingVer.source).startsWith('sie_import')
      && !['year_end_close', 'year_open_transfer', 'skattekonto_import', 'equity_reclass'].includes(incomingVer.source);
    const newVer = stripVat ? { ...incomingVer, rows: stripVatRows(incomingVer.rows) } : incomingVer;
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
      // Serie och nummer (utils/verificationNumbering.js): en given serie
      // (Ny verifikation, Bank) eller den serie bokningens källa hör till
      // (fakturor B, inbetalningar C, leverantörsfakturor D ...). Numret räknas
      // här, mot listan som den ser ut just nu, så flera bokningar i samma
      // batch (t.ex. lönekörningen) får varsitt nummer i obruten följd.
      const series = newVer.series || seriesForSource(newVer.source);
      const number = newVer.number || getNextVerificationNumber(prev, series, company?.verificationSeriesFloor?.[series]);
      // `Date.now()` ensam krockar när flera verifikationer skapas synkront
      // efter varandra (t.ex. lönekörningens tre block) — de hamnar lätt
      // inom samma millisekund. `prev.length` som suffix räcker för att
      // hålla id:t unikt inom samma synkrona batch.
      const id = `${Date.now()}_${prev.length}`;
      // Automatiska bokningar (de som har en `source`: fakturor, kvitton,
      // leverantörsfakturor m.fl.) får en avrundningsdifferens på upp till
      // 1,50 kr bokad på 3740 i stället för att sparas obalanserade, se
      // withRoundingBalance. Manuella verifikationer valideras i formuläret.
      const rows = newVer.source && (newVer.status || 'booked') !== 'draft' ? withRoundingBalance(newVer.rows) : newVer.rows;
      return [...prev, { ...newVer, rows, id, number, series }];
    });

    // Ett konto som faktiskt precis bokfördes mot — via OCR-förslaget eller
    // ett manuellt val, spelar ingen roll vilket — är starkare bevis än
    // någon förvald "vanliga konton"-lista någonsin kan vara. Utan den här
    // raden kunde OCR:n läsa av och bokföra rätt konto perfekt, men kontot
    // stod ändå kvar som AV i Kontoplanen (Verifications.jsx) tills någon
    // gick dit och slog på det för hand — och syntes inte som förval nästa
    // gång i kontofältet (shared/SearchInputs.jsx: AccountSearch filtrerar
    // sin tomma/obeskrivna vy till just de aktiva kontona). Kundönskemål,
    // ordagrant i sak: "när de har OCR, så vet den automatiskt".
    // Beräknat UTANFÖR setAccounts-uppdateraren (och därför en tanke
    // stale mot precis samtidiga skrivningar) av samma skäl som
    // updateCompanyField-kommentaren ovan varnar för — men eftersom det
    // här bara SLÅR PÅ en flagga (aldrig av, aldrig skriver över ett
    // annat fälts värde) kan två sådana skrivningar i rad aldrig radera
    // varandras resultat, bara i värsta fall behöva en omrendering till
    // innan båda konton syns som aktiva.
    const usedCodes = new Set((newVer.rows || []).map(r => r.account).filter(Boolean));
    if (usedCodes.size > 0) {
      setAccounts(prev => {
        let changed = false;
        const next = prev.map(a => {
          if (usedCodes.has(a.code) && !a.active) { changed = true; return { ...a, active: true }; }
          return a;
        });
        return changed ? next : prev;
      });
    }
  };

  // Kundönskemål (SIE4-import, Sida 51): en enda batch-skrivning istället
  // för att loopa handleAddVerification per rad — det skalar inte till
  // potentiellt tusentals importerade verifikationer (varje loop-varv
  // vore sin egen fullständiga funktionella uppdatering av HELA
  // companies-trädet). Räknar upp varje seriens löpnummer EN gång från
  // den befintliga bokföringen (samma padStart(3,'0')-konvention som
  // getNextNumber i Verifications.jsx), sedan sekventiellt inom batchen —
  // annars hade flera importerade verifikationer i samma serie fått
  // samma nummer. Det URSPRUNGLIGA SIE-datumet bevaras ALLTID oförändrat;
  // filens egna serie+nummer sparas bara i sourceId för spårbarhet, inte
  // som det faktiska numret (kollisioner mot redan befintlig bokföring är
  // annars troliga — en ny SIE4-import som också råkar börja på A001 får
  // inte tyst skriva över en riktig, redan bokförd A001).
  // OBS: medvetet en vanlig funktion, INTE useCallback — den här koden
  // körs efter `if (isLoadingAuth) return ...` ovan (samma anledning som
  // handleAddVerification ovan är en vanlig funktion), och ett hook-anrop
  // där hade villkorligt hoppats över beroende på isLoadingAuth, vilket
  // React upptäcker och kraschar på ("Rendered more hooks than during
  // the previous render").
  const handleBulkImportVerifications = (newVerifications, newAccounts, sourceTag = 'sie_import') => {
    if (newAccounts?.length) {
      updateCompanyField('accounts', prev => {
        const existingCodes = new Set(prev.map(a => a.code));
        const toAdd = newAccounts.filter(a => !existingCodes.has(a.code));
        return toAdd.length ? [...prev, ...toAdd] : prev;
      });
    }

    updateCompanyField('verifications', prev => {
      const seriesMax = {};
      const nextNumberFor = (seriesLetter) => {
        if (seriesMax[seriesLetter] === undefined) {
          seriesMax[seriesLetter] = prev.reduce((m, v) => {
            if (!(v.number || '').startsWith(seriesLetter)) return m;
            const n = parseInt((v.number || '').replace(/\D/g, ''), 10);
            return !isNaN(n) && n > m ? n : m;
          }, 0);
        }
        seriesMax[seriesLetter] += 1;
        return seriesMax[seriesLetter];
      };
      const withNumbers = newVerifications.map((v, i) => {
        const seriesLetter = v.series || 'A';
        const n = nextNumberFor(seriesLetter);
        return {
          ...v,
          id: `${Date.now()}_${i}_${seriesLetter}`,
          number: `${seriesLetter}${String(n).padStart(3, '0')}`,
          status: 'booked',
          source: v.source || sourceTag,
          sourceId: v.sourceId || `${sourceTag}_${seriesLetter}_${v.sieNumber ?? i}`,
          ...(String(sourceTag).startsWith('sie_import_') ? { sieImportTag: sourceTag } : {}),
        };
      });
      // Importerade ingående balanser bokar bara det föregående års
      // verifikationer inte redan ger, så att två importerade år inte
      // dubblar saldona (se utils/sieOpeningReconcile.js).
      const merged = [...prev, ...withNumbers];
      return applySieOpeningReconcile(merged, reconcileSieOpenings(merged, { equityAccount: resultAccountFor(detectOrgType(company?.orgNr)) }));
    });
  };

  // Tar bort allt en SIE-fil förde in (Inställningar → Importera) och räknar
  // om övriga importers ingående balanser. Kontona som importen lade till
  // ligger kvar. Settings stoppar redan borttagning i ett låst år.
  const handleDeleteSieImport = (tag) => {
    updateCompanyField('verifications', prev => {
      const kept = prev.filter(v => sieImportTagOf(v) !== tag);
      return applySieOpeningReconcile(kept, reconcileSieOpenings(kept, { equityAccount: resultAccountFor(detectOrgType(company?.orgNr)) }));
    });
    setToast({ message: tr('ui.sie_import_borttagen'), variant: 'success' });
  };

  // Flytt i ett steg (SieImportModal.jsx): avslutade år som just importerats
  // stängs på samma sätt som "Lås räkenskapsåret" under Skatt och bokslut —
  // en bokslutsverifikation per år och ett lås. Bokslutet gjordes redan i
  // det gamla programmet, så stegen före låsningen (moms, lön …) gäller inte
  // här. Därefter räknas ingående balanser om, eftersom årets resultat nu
  // ligger på eget kapital i stället för på resultatkontona.
  const handleCloseImportedYears = (years) => {
    const orgType = detectOrgType(company?.orgNr);
    const locks = {};
    for (const fy of years) {
      const period = /^\d{4}$/.test(fy.label) ? fy.label : { start: fy.start, end: fy.end };
      const { verification, result, destination } = buildYearEndClosing({ verifications, year: period, orgType, partners: company?.partners });
      if (verification) handleAddVerification(verification);
      locks[fy.label] = { lockedAt: new Date().toISOString(), result, resultAccount: destination, start: fy.start, end: fy.end };
    }
    setCompanyInfo(prev => ({ ...prev, lockedFiscalYears: { ...(prev?.lockedFiscalYears || {}), ...locks } }));
    handleRepairSieOpenings();
    setToast({ message: tr('ui.sie_ar_stangda', { years: years.map(y => y.label).join(', ') }), variant: 'success' });
  };

  // Samma rättelse för data som importerades före den, från Inställningar.
  const handleRepairSieOpenings = () => {
    updateCompanyField('verifications', prev => applySieOpeningReconcile(prev, reconcileSieOpenings(prev, { equityAccount: resultAccountFor(detectOrgType(company?.orgNr)) })));
  };

  // Underlag som kopplats i efterhand (SIE-importens underlag). Rör bara
  // underlagsfälten, aldrig konteringen, så det är tillåtet även i ett låst år.
  const handleAttachVerificationFiles = (updates) => {
    const byId = new Map(updates.map(u => [u.id, u]));
    updateCompanyField('verifications', prev => prev.map(v => {
      const u = byId.get(v.id);
      if (!u) return v;
      return { ...v, attachmentUrl: u.attachmentUrl, attachmentName: u.attachmentName, attachmentType: u.attachmentType, extraAttachments: u.extraAttachments };
    }));
  };

  // Auto-book invoice creation
  const handleAddInvoice = (invoice) => {
    const invType = invoice.type || 'invoice';

    // UF-kontots dygnstak. Returnerar tidigt UTAN att spara — anropsstället
    // (Invoices.jsx) döljer och låser redan knappen när taket är nått, så
    // hit kommer man i praktiken bara via en väg som missat kollen.
    const quota = ufInvoiceQuota(company, invoices);
    if (quota.reached) {
      setToast({
        message: tr('ui.ni_har_skapat_fakturor_idag_fler_gar_att_skapa_i', { limit: quota.limit }),
        variant: 'error',
      });
      return;
    }

    // Slumpsuffix (se motsvarande kommentar vid company_id ovan) — invoice_id
    // skickas precis som company_id oautentiserat till create-checkout-
    // session.js via fakturans betalningslänk.
    const inv = {
      ...invoice,
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: invType,
      // NÄR fakturan skapades, till skillnad från `date` (fakturadatumet,
      // som användaren själv sätter). Läses av ufInvoiceQuota; harmlöst
      // för alla andra företag, men gör dygnstaket omöjligt att nolla
      // genom att backdatera fakturan.
      createdAt: new Date().toISOString(),
    };
    // ROT/RUT: avdraget är en fordran på Skatteverket och bokas på 1513.
    // Kontot sparas på fakturan så att utbetalningen senare krediterar rätt
    // konto (äldre fakturor bokade hela fordran på 1510).
    const rotRutDeduction = invType !== 'quote' && inv.rotRutType && !inv.rotRutStatus && (inv.currency || 'SEK') === 'SEK'
      ? calcRotRutDeduction(inv.rotRutType, inv.rows).deduction : 0;
    if (rotRutDeduction !== 0) { inv.rotRutReceivable = '1513'; inv.rotRutBookedDeduction = rotRutDeduction; }
    setInvoices(prev => [...prev, inv]);

    if (invType === 'quote') return;

    // Med ören och med radrabatten, se utils/invoiceBooking.js. En avrundnings-
    // differens på ören bokas av withRoundingBalance i handleAddVerification.
    // En faktura i annan valuta bokförs i kronor med fakturans kurs (fxRate).
    const verRows = invoiceBookingRows(inv.rows, { revenueAccounts: REVENUE_ACCOUNTS, vatAccounts: VAT_ACCOUNTS, rate: invoiceFxRate(inv), rotRutDeduction });

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

    // Med ören och med radrabatten, se utils/invoiceBooking.js. En avrundnings-
    // differens på ören bokas av withRoundingBalance i handleAddVerification.
    const book = (rate) => handleAddVerification({
      date: updatedInvoice.date,
      description: `Faktura ${updatedInvoice.invoiceNumber}`,
      source: 'invoice',
      sourceId: updatedInvoice.id,
      rows: invoiceBookingRows(updatedInvoice.rows, { revenueAccounts: REVENUE_ACCOUNTS, vatAccounts: VAT_ACCOUNTS, rate }),
    });
    // En offert i annan valuta får dagens kurs när den blir faktura.
    if (updatedInvoice.currency && updatedInvoice.currency !== 'SEK' && !(Number(updatedInvoice.fxRate) > 0)) {
      convertToSek(1, updatedInvoice.currency, updatedInvoice.date).then(res => {
        if (!res?.rate) {
          setToast({ message: tr('ui.fakturan_ar_skapad_men_inte_bokford_vaxelkursen', { currency: updatedInvoice.currency }), variant: 'error' });
          return;
        }
        setInvoices(prev => prev.map(i => (i.id === updatedInvoice.id ? { ...i, fxRate: res.rate } : i)));
        book(res.rate);
      });
    } else {
      book(invoiceFxRate(updatedInvoice));
    }

    return updatedInvoice;
  };

  // Bugfix (kundrapport: "går inte att markera Obetald/Ej bokförd som
  // betald"): den här var en EGEN, oskyddad kopia av samma formel som
  // Invoices.jsx redan importerar via grossOf (utils/reportCalculations.js:
  // grossInvoiceAmount) — `inv.rows.reduce(...)` utan `|| []`/`|| inv.amount`-
  // fallbacken. Vilken faktura som helst utan ifyllda rader (t.ex. en som
  // bara har ett platt `amount`-fält, samma legitima fall grossOf redan
  // räknar med på visningssidan) fick den här att kasta ett fel inne i
  // klickhanteraren — status bytte då aldrig till "Betald", helt utan
  // felmeddelande för användaren. Samma delade, redan defensiva funktion nu
  // i stället för en andra, glömd kopia som kunde glida isär.
  const invoiceGross = grossInvoiceAmount;
  // Kursen en faktura bokfördes med. Äldre fakturor i annan valuta saknar
  // kurs och bokfördes med beloppet rakt av, så de räknas med 1 även här.
  const invoiceFxRate = (inv) => (inv?.currency && inv.currency !== 'SEK' && Number(inv.fxRate) > 0 ? Number(inv.fxRate) : 1);

  // Registrera betalning — stödjer delbetalning. Beloppet som faktiskt
  // betalas denna gång bokförs för sig (1930/1510), och fakturan markeras
  // som fullt betald först när det ackumulerade betalda beloppet når hela
  // fakturabeloppet. Kan aldrig ta emot mer än vad som återstår.
  // `bankLedgerAccount` (valfri, default 1930): vilket bankkonto pengarna
  // faktiskt landade på. Bara Bank.jsx:s matchning mot en importerad
  // transaktion känner till det (se handleConfirmInvoiceMatch där) — alla
  // andra anropsställen (snabbknappen i fakturalistan, Stripe-webhooken)
  // fortsätter oförändrat mot 1930 genom att helt enkelt inte skicka in
  // parametern, så det här är en additiv ändring, ingen omskrivning.
  // `amount` är i fakturans valuta. För en faktura i annan valuta kan
  // `sekReceived` ange vad som kom in på kontot i kronor (bankmatchningen
  // skickar `amountIsSek` i stället, då är beloppet kronorna och betalningen
  // antas reglera det som är kvar). Skillnaden mot fordran i kronor bokförs
  // som valutakursvinst (3960) eller -förlust (7960).
  const handleRegisterInvoicePayment = (invoiceId, amount, date, bankLedgerAccount = '1930', { sekReceived, amountIsSek = false } = {}) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv || !amount || amount <= 0) return;
    const fx = invoiceFxRate(inv);
    const foreign = fx !== 1;

    // Kundens del: vid ROT/RUT betalar Skatteverket avdraget, inte kunden.
    // En skickad kreditfaktura har redan dragit av sin del (utils/creditNotes.js).
    const totalGross = invoiceCustomerDue(inv) - (Number(inv.creditedAmount) || 0);
    const alreadyPaid = inv.paidAmount || 0;
    const remaining = Math.max(0, totalGross - alreadyPaid);
    const paymentAmount = foreign && amountIsSek ? remaining : Math.min(amount, remaining);
    if (paymentAmount <= 0) return;
    const round2 = (v) => Math.round(v * 100) / 100;
    const receivableSek = round2(paymentAmount * fx);
    const bankSek = foreign ? round2(amountIsSek ? amount : (Number(sekReceived) > 0 ? Number(sekReceived) : receivableSek)) : receivableSek;
    const fxDiff = round2(bankSek - receivableSek);

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
        { account: bankLedgerAccount, debet: bankSek, kredit: 0 },
        { account: '1510', debet: 0, kredit: receivableSek },
        ...(fxDiff > 0 ? [{ account: '3960', debet: 0, kredit: fxDiff }] : []),
        ...(fxDiff < 0 ? [{ account: '7960', debet: -fxDiff, kredit: 0 }] : []),
      ],
    });

    // Inställningar → Notiser: två separata mejl när en faktura blir HELT
    // betald (inte vid varje delbetalning — annars blir en avbetalnings-
    // plan en notis i taget), var och en med sin egen kategori-växel:
    //   "Betalningar"  → till FÖRETAGET självt ("ni har fått betalt")
    //   "Fakturor"     → ett betalningskvitto till KUNDEN
    // Plus en gemensam "E-postnotiser"-huvudströmbrytare (emailNotifications
    // Enabled) ovanför båda — av den stänger alla automatiska notismejl
    // oavsett kategorivalen, precis som den för Förfallna fakturor/Moms &
    // deklaration i api/cron/reminders.js.
    // Träffar både den manuella "Markera som betald"-knappen och Stripe-
    // betallänkens automatiska väg ovan (samma funktion, ett enda ställe).
    // Fire-and-forget (samma "best effort"-mönster som betalningslänken i
    // Invoices.jsx): ett misslyckat notismejl ska aldrig få den redan
    // registrerade betalningen och bokföringen ovan att se ut som att de
    // också misslyckades.
    const emailNotificationsOn = company?.notifications?.emailNotificationsEnabled ?? true;
    if (isFullyPaid && emailNotificationsOn) {
      const amountLabel = `${Math.round(newPaid).toLocaleString('sv-SE')} ${foreign ? inv.currency : 'kr'}`;
      const dateLabel = new Date(paidDate).toLocaleDateString('sv-SE');

      if ((company?.notifications?.paymentRemindersEnabled ?? true) && sendableEmail(company?.email)) {
        sendInvoiceEmail({
          to: company.email,
          subject: `Betalning mottagen – faktura ${inv.invoiceNumber}`,
          html: `
            <p style="margin:0 0 14px;">Faktura <strong>${inv.invoiceNumber}</strong> är markerad som betald.</p>
            <p style="margin:0 0 14px;">Belopp: <strong>${amountLabel}</strong> · Betaldatum: ${dateLabel}</p>
            <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">
              Automatisk notis från Bokix. Stäng av under Inställningar → Notiser.
            </p>
          `,
          company_id: data.activeCompanyId,
        }).catch(err => console.error('Betalningsnotis (mejl) misslyckades:', err));
      }

      if (company?.notifications?.invoiceReceiptsEnabled ?? true) {
        const customer = contacts.find(c => c.id === inv.customerId);
        if (sendableEmail(customer?.email)) {
          sendInvoiceEmail({
            to: customer.email,
            subject: `Kvitto – faktura ${inv.invoiceNumber} betald`,
            html: `
              <p style="margin:0 0 14px;">Tack! Vi har registrerat din betalning av faktura <strong>${inv.invoiceNumber}</strong>.</p>
              <p style="margin:0 0 14px;">Belopp: <strong>${amountLabel}</strong> · Betaldatum: ${dateLabel}</p>
              <p style="margin:22px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:13px;color:#6b7280;">
                Det här kvittot skickas automatiskt av ${(company?.invoiceDisplayName || company?.name) || 'avsändaren'} via Bokix.
              </p>
            `,
            replyTo: company?.email || undefined,
            company_id: data.activeCompanyId,
          }).catch(err => console.error('Betalningskvitto (mejl) misslyckades:', err));
        }
      }
    }
  };

  // Bekvämlighetsgenväg som betalar hela kvarvarande beloppet idag — det
  // snabbknappen i listan och bulk-"Markera som betalda" använder.
  const handleMarkInvoicePaid = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const remaining = invoiceCustomerRemaining(inv);
    if (remaining <= 0) return;
    handleRegisterInvoicePayment(invoiceId, remaining, new Date().toISOString().split('T')[0]);
  };

  // ── ROT/RUT-avdrag hos Skatteverket ──
  // Begärd: filen är skapad och (förhoppningsvis) uppladdad. Ingen bokföring.
  const handleRotRutRequested = (invoiceIds, date) => {
    const ids = new Set(invoiceIds);
    setInvoices(prev => prev.map(i => (ids.has(i.id) ? { ...i, rotRutStatus: 'requested', rotRutRequestedAt: date } : i)));
  };

  // Utbetalt: Skatteverket sätter in avdraget på skattekontot (1630), och
  // fordran på 1513 (eller 1510 för äldre fakturor) är reglerad.
  const handleRotRutPayout = (invoiceIds, date) => {
    invoiceIds.forEach(id => {
      const inv = invoices.find(i => i.id === id);
      if (!inv?.rotRutType) return;
      const amount = inv.rotRutBookedDeduction ?? calcRotRutDeduction(inv.rotRutType, inv.rows).deduction;
      if (amount <= 0) return;
      handleAddVerification({
        date,
        description: `${inv.rotRutType.toUpperCase()}-avdrag från Skatteverket, faktura ${inv.invoiceNumber}`,
        source: 'rotrut_payout',
        sourceId: id,
        rows: [
          { account: '1630', debet: amount, kredit: 0 },
          { account: inv.rotRutReceivable || '1510', debet: 0, kredit: amount },
        ],
      });
    });
    const ids = new Set(invoiceIds);
    setInvoices(prev => prev.map(i => (ids.has(i.id) ? { ...i, rotRutStatus: 'paid', rotRutPaidDate: date } : i)));
  };

  // ── ROT/RUT-försäljning från en annan app (utils/bookingImport.js) ──
  // En verifikation per betaldag i stället för en faktura per uppdrag, så att
  // företagets data inte växer med varje städning. Bara en sammanfattning per
  // import sparas, nästlad under 'company' (samma skäl som bankImportProfiles:
  // fältet är redan skrivbart för inbjudna, ingen SQL-ändring behövs).
  const setRotRutBatches = (fn) => updateCompanyField('company', prev => ({ ...prev, rotRutBatches: fn(prev?.rotRutBatches || []) }));

  const handleImportRotRutBookings = ({ batch, days, payAccount, attachment }) => {
    days.forEach(day => {
      handleAddVerification({
        date: day.date,
        description: `${batch.type.toUpperCase()}-försäljning ${day.date}, ${day.count} uppdrag (${batch.fileName})`,
        source: 'rotrut_import',
        sourceId: batch.id,
        ...(attachment ? { attachmentUrl: attachment.url, attachmentName: attachment.name, attachmentType: 'text/csv' } : {}),
        rows: [
          ...invoiceBookingRows(day.invoiceRows, { revenueAccounts: REVENUE_ACCOUNTS, vatAccounts: VAT_ACCOUNTS, receivableAccount: payAccount, rotRutDeduction: day.deduction }),
          // Betaltjänstens avgift (kolumnen Avgift) dras från pengarna innan
          // de når banken: bankkostnad, ingen moms (finansiell tjänst).
          ...(day.fee > 0 ? [{ account: '6570', debet: day.fee, kredit: 0 }, { account: payAccount, debet: 0, kredit: day.fee }] : []),
        ],
      });
    });
    setRotRutBatches(prev => [...prev, batch]);
  };

  const handleRotRutBatchRequested = (batchId, date) => {
    setRotRutBatches(prev => prev.map(b => (b.id === batchId ? { ...b, status: 'requested', requestedAt: date } : b)));
  };

  // Utbetalning för en hel import. Betalar Skatteverket mindre än begärt har
  // de avslagit en del, och den delen ska kunderna betala: den flyttas från
  // 1513 till kundfordringar (1510).
  const handleRotRutBatchPayout = (batchId, date, amount) => {
    const b = (company?.rotRutBatches || []).find(x => x.id === batchId);
    if (!b) return;
    const paid = Math.max(0, Math.min(Number(amount) || 0, b.deduction));
    const rejected = Math.round((b.deduction - paid) * 100) / 100;
    handleAddVerification({
      date,
      description: `${b.type.toUpperCase()}-avdrag från Skatteverket, ${b.fileName}`,
      source: 'rotrut_payout',
      sourceId: batchId,
      rows: [
        ...(paid > 0 ? [{ account: '1630', debet: paid, kredit: 0 }] : []),
        ...(rejected > 0 ? [{ account: '1510', debet: rejected, kredit: 0 }] : []),
        { account: '1513', debet: 0, kredit: b.deduction },
      ],
    });
    setRotRutBatches(prev => prev.map(x => (x.id === batchId ? { ...x, status: 'paid', paidDate: date, paidAmount: paid } : x)));
  };

  // Avslaget: kunden ska betala avdraget själv. Fordran flyttas från 1513
  // till kunden (1510) och fakturan blir obetald igen för den delen.
  const handleRotRutRejected = (invoiceId, date) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv?.rotRutType) return;
    const amount = inv.rotRutBookedDeduction ?? calcRotRutDeduction(inv.rotRutType, inv.rows).deduction;
    if (amount > 0 && inv.rotRutReceivable === '1513') {
      handleAddVerification({
        date,
        description: `${inv.rotRutType.toUpperCase()}-avdrag avslaget, faktura ${inv.invoiceNumber}`,
        source: 'rotrut_rejected',
        sourceId: invoiceId,
        rows: [
          { account: '1510', debet: amount, kredit: 0 },
          { account: '1513', debet: 0, kredit: amount },
        ],
      });
    }
    setInvoices(prev => prev.map(i => (i.id === invoiceId
      ? { ...i, rotRutStatus: 'rejected', status: i.status === 'paid' ? 'sent' : i.status, paidDate: i.status === 'paid' ? undefined : i.paidDate }
      : i)));
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

    // Med ören (se handleSaveReceiptDetails): avrundning till hela kronor per
    // rad kunde ge en verifikation där debet och kredit skilde en krona.
    const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;
    // Tjänst från utlandet (omvänd skattskyldighet): leverantören tar ingen
    // svensk moms, hela beloppet är kostnaden, och momsen bokförs av oss (2645/
    // 2614) via withReverseChargeRows.
    const reverse = isReverseChargePurchaseAccount(exp.costAccount);
    const verRows = [
      { account: exp.costAccount, debet: cents(reverse ? exp.amount : exp.netAmount), kredit: 0 },
    ];
    if (!reverse && exp.vatAmount > 0) {
      verRows.push({ account: '2641', debet: cents(exp.vatAmount), kredit: 0 });
    }
    verRows.push({ account: '1930', debet: 0, kredit: cents(exp.amount) });

    handleAddVerification({
      date: exp.date,
      description: exp.description,
      source: 'expense',
      sourceId: exp.id,
      rows: withReverseChargeRows(verRows),
      ...receiptAttachmentFields(exp),
    });
  };

  // Registrera en leverantörsfaktura. Stödjer flera konteringsrader (inte
  // bara ett konto), betalning från egen ficka (bokförs mot 2018 istället
  // för 2440 — en skuld till ägaren, inte till leverantören) och avrundning
  // till hel krona (mellanskillnaden bokförs mot 3740, aldrig bara avrundas
  // bort tyst).
  //
  // Omvänd skattskyldighet: fakturan bokförs utan moms (precis som
  // leverantörens egen faktura saknar moms i det läget). Bokförs den på ett
  // inköpskonto för tjänster från utlandet (4535/4531 m.fl.) läggs momsraderna
  // (2645 i debet, 2614 i kredit) till automatiskt, se utils/reverseCharge.js.
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
      rows: withReverseChargeRows(verRows),
      ...receiptAttachmentFields(inv),
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
  //
  // `date` (Bank – CSV/Excel-import, Bank.jsx): tredje, valfritt argument
  // — defaultar till idag precis som förut, så de två befintliga
  // anropsställena (SupplierInvoices.jsx, Invoices.jsx→SupplierInvoices-
  // Panel, båda `(id, paymentMethod)`) är opåverkade. Bank.jsx skickar
  // istället bankradens EGNA datum (dagen pengarna faktiskt lämnade
  // kontot) — annars skulle en bankmatchning bokföra betalningen på fel
  // dag bara för att man råkar importera/bekräfta matchningen senare.
  // `bankLedgerAccount`: samma resonemang som handleRegisterInvoicePayment
  // ovan — valfri, default 1930, bara Bank.jsx:s matchning skickar in ett
  // annat konto.
  const handleMarkSupplierInvoicePaid = (expenseId, paymentMethod = 'bank', date = new Date().toISOString().split('T')[0], bankLedgerAccount = '1930') => {
    const inv = expenses.find(e => e.id === expenseId);
    if (!inv) return;
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'paid', paidDate: date, paymentMethod } : e));

    handleAddVerification({
      date,
      description: `Betalning leverantörsfaktura ${inv.invoiceNumber}`,
      source: 'supplier_invoice_payment',
      sourceId: inv.id,
      rows: [
        { account: '2440', debet: Math.round(inv.amount), kredit: 0 },
        { account: bankLedgerAccount, debet: 0, kredit: Math.round(inv.amount) },
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

    const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;
    const reverse = isReverseChargePurchaseAccount(accountCode);
    const verRows = [{ account: accountCode, debet: cents(reverse ? exp.amount : (exp.netAmount || exp.amount)), kredit: 0 }];
    if (!reverse && exp.vatAmount > 0) verRows.push({ account: '2641', debet: cents(exp.vatAmount), kredit: 0 });
    verRows.push({ account: exp.type === 'supplier_invoice' ? '2440' : '1930', debet: 0, kredit: cents(exp.amount) });

    handleAddVerification({
      date: new Date().toISOString().split('T')[0],
      description: `Rättad kontering: ${exp.description}`,
      source: 'expense_fix',
      sourceId: exp.id,
      rows: withReverseChargeRows(verRows),
      ...receiptAttachmentFields(exp),
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
  // Avläsningen av ett kvitto sparas på kvittot som ett utkast (ocrDraft) så
  // att det visas direkt nästa gång kvittot öppnas, utan ny avläsning. Det är
  // inte ifyllda fält: kvittot förblir "ej hanterat" tills man själv sparar.
  const handleSaveOcrDraft = (expenseId, draft) => {
    setExpenses(prev => prev.map(e => (e.id === expenseId ? { ...e, ocrDraft: draft } : e)));
  };

  const handleSaveReceiptDetails = (expenseId, formValues) => {
    const exp = expenses.find(e => e.id === expenseId);
    if (!exp) return;
    const alreadyBooked = verifications.some(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);

    const amount = formValues.amount;
    // Ett inköp av tjänster från utlandet har ingen svensk moms på kvittot: hela
    // beloppet är kostnaden, oavsett vilken momssats som stod i formuläret.
    const vatRate = isReverseChargePurchaseAccount(formValues.costAccount) ? 0 : formValues.vatRate;
    // Flera momssatser på samma kvitto ('mixed'): momsen i kronor kommer från
    // kvittot. All ingående moms bokförs på 2641, så beloppet räcker.
    const mixedVat = vatRate === 'mixed' ? Math.round((Number(formValues.vatAmount) || 0) * 100) / 100 : null;
    const netAmount = mixedVat !== null
      ? Math.round((amount - mixedVat) * 100) / 100
      : vatRate > 0 ? Math.round((amount / (1 + vatRate / 100)) * 100) / 100 : amount;
    const vatAmount = Math.round((amount - netAmount) * 100) / 100;

    const updated = {
      ...exp,
      date: formValues.date,
      supplier: formValues.supplier,
      description: formValues.supplier,
      amount, netAmount, vatAmount, vatRate,
      costAccount: formValues.costAccount,
      projectId: formValues.projectId || undefined,
      folderId: formValues.folderId || undefined,
      receiptNumber: formValues.receiptNumber || undefined,
      receiptNumberLabel: formValues.receiptNumberLabel || undefined,
      // Kvitto i utländsk valuta: beloppet i valutan, kursen och var den kom
      // ifrån sparas så att omräkningen till kronor går att följa. Bokföringen
      // sker i kronor (amount).
      foreignCurrency: formValues.foreignCurrency || undefined,
      notes: formValues.notes || undefined,
      // Utkastet från avläsningen behövs inte längre när kvittot är sparat.
      ocrDraft: undefined,
    };
    setExpenses(prev => prev.map(e => e.id === expenseId ? updated : e));

    if (alreadyBooked) return;

    // Med ören, inte avrundat till hela kronor: nettot, momsen och totalen
    // avrundades tidigare var för sig och kunde då skilja en krona åt
    // (100,50 kr ger 80 + 20 mot 101), vilket gav en verifikation där
    // debet och kredit inte gick ihop. Momsen är totalen minus nettot, så
    // raderna summerar alltid exakt till beloppet.
    const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;
    // Utländsk valuta står på kostnadsraden ("25,00 USD × kurs 10,4123"), så
    // att verifikationen visar vad kronbeloppet räknats från.
    const fxNote = describeForeign(updated.foreignCurrency);
    const verRows = [{ account: updated.costAccount, debet: cents(updated.netAmount), kredit: 0, projectId: updated.projectId, ...(fxNote ? { desc: fxNote } : {}) }];
    if (updated.vatAmount !== 0) verRows.push({ account: '2641', debet: cents(updated.vatAmount), kredit: 0 });
    verRows.push({ account: '1930', debet: 0, kredit: cents(updated.amount) });
    // En retur har negativt belopp: varje rad byter sida, så att pengarna
    // kommer in på 1930 och kostnaden och momsen minskar.
    const sided = (r) => (r.debet < 0 || r.kredit < 0 ? { ...r, debet: Math.max(0, -r.kredit), kredit: Math.max(0, -r.debet) } : r);

    handleAddVerification({
      date: updated.date,
      description: updated.description,
      source: 'expense',
      sourceId: updated.id,
      rows: withReverseChargeRows(verRows).map(sided),
      ...receiptAttachmentFields(updated),
    });
  };

  // Tar bort en kvittomapp (kundönskemål: "de ska kunna namnge vad varje
  // mapp där kvitton lagras heter", se Expenses.jsx) — mapparna själva
  // ligger nästlade under 'company' precis som bankImportProfiles
  // (companyFields.js), så det här är den enda platsen som behöver skriva
  // till dem OCH städa upp kvitton som pekade på den borttagna mappen.
  // Kvittona tas aldrig bort, bara mappkopplingen — de hamnar tillbaka
  // som "osorterade" i mapplistan.
  const handleDeleteReceiptFolder = (folderId) => {
    updateCompanyField('company', prev => ({ ...prev, receiptFolders: (prev?.receiptFolders || []).filter(f => f.id !== folderId) }));
    setExpenses(prev => prev.map(e => e.folderId === folderId ? { ...e, folderId: undefined } : e));
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
    //
    // Tas bort direkt med Ångra i notisen (shared/undoToast.js); bildfilen
    // raderas först när ångra-tiden gått ut, annars gick den inte att få
    // tillbaka.
    const index = expenses.findIndex(e => e.id === expenseId);
    const expense = expenses[index];
    if (!expense) return;
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
    showUndo({
      message: tr('ui.undo_kvitto_borttaget'),
      onUndo: () => setExpenses(prev => restoreAt(prev, expense, index)),
      // En bankrad som var kopplad till kvittot blir ohanterad igen, annars
      // kom köpet aldrig med i bokföringen.
      onCommit: () => {
        if (expense.receiptUrl) deleteFileFromStorage(expense.receiptUrl);
        setBankTransactions(prev => prev.map(t => (t.matchedType === 'receipt' && t.matchedId === expenseId ? { ...t, status: 'unmatched', matchedType: undefined, matchedId: undefined } : t)));
      },
    });
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

  // CSV-import av anställda (EmployeeImportModal). Uppdaterar på personnummer.
  const handleImportEmployees = (rows) => {
    const { added, updated } = mergeImportedEmployees(employees, rows);
    setEmployees(prev => mergeImportedEmployees(prev, rows).list);
    setToast({ message: tr('employeeImport.done', { added, updated }), variant: 'success' });
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
      // Åldersanpassad arbetsgivaravgift (payrollConfig.employerFeeFor).
      feeRules: FEE_RULES_VERSION,
    }));
    setPayrollRuns(prev => [...prev, { id: runId, period, payDate, completedSteps: [], rows, createdAt: new Date().toISOString() }]);
    return runId;
  };

  // AGI-översikten (Skatt och bokslut → Arbetsgivardeklaration): en AGI-
  // rapport per period, fristående från lönekörningen den (om någon)
  // härstammar från — precis som en lönekörning fryser en ögonblicksbild
  // av varje anställd, fryser den här ett ögonblicksbild av TOTALERNA, så
  // en redan skapad/inlämnad AGI-rapport aldrig ändras bakvägen om
  // lönekörningen den byggde på redigeras i efterhand. Perioder utan
  // lönekörning ("nolldeklaration", kundönskemål — Skatteverket kräver en
  // sådan även för månader utan löneutbetalning) får bara nollor.
  const handleCreateAgiReport = (period) => {
    const run = payrollRuns.find(r => r.period === period);
    const totals = run
      ? summarizePayrollRun(run.rows.map(row => computeEmployeePayroll(row.employeeSnapshot, row)))
      : { gross: 0, tax: 0, employerFee: 0 };
    const report = {
      id: `agi_${period}_${Date.now()}`,
      period,
      payrollRunId: run?.id || null,
      isZero: !run,
      totals: { gross: totals.gross, tax: totals.tax, employerFee: totals.employerFee },
      status: 'draft',
      createdAt: new Date().toISOString(),
      submittedAt: null,
    };
    setAgiReports(prev => [...prev, report]);
    return report.id;
  };

  const handleMarkAgiSubmitted = (reportId) => {
    setAgiReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'submitted', submittedAt: new Date().toISOString() } : r));
    // Samma sak i lönekörningen, så AGI-steget där också är klart.
    const report = agiReports.find(r => r.id === reportId);
    if (report) {
      setPayrollRuns(prev => prev.map(r => (r.period === report.period && r.completedSteps.includes('booked') && !r.completedSteps.includes('agi'))
        ? { ...r, completedSteps: [...r.completedSteps, 'agi'] } : r));
    }
  };

  const handleDeleteAgiReport = (reportId) => {
    setAgiReports(prev => prev.filter(r => r.id !== reportId));
  };

  // Fält på själva körningen, t.ex. meddelandet på lönebeskeden.
  const handleUpdateRun = (runId, patch) => {
    setPayrollRuns(prev => prev.map(r => (r.id === runId ? { ...r, ...patch } : r)));
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
  // Skattetabell/jämkning från Skatteverkets svarsfil (FosModal). Lönekörningar
  // som inte räknats än får de nya uppgifterna direkt, samma regel som
  // handleRefreshRunSnapshots nedan: en räknad körning ändras aldrig i efterhand.
  const handleApplyFos = (updates) => {
    const byId = new Map(updates.map(u => [u.id, u.patch]));
    const updated = employees.map(e => (byId.has(e.id) ? { ...e, ...byId.get(e.id) } : e));
    setEmployees(prev => prev.map(e => (byId.has(e.id) ? { ...e, ...byId.get(e.id) } : e)));
    setPayrollRuns(prev => prev.map(r => (r.completedSteps.includes('calculated') ? r : {
      ...r,
      rows: r.rows.map(row => {
        const current = updated.find(e => e.id === row.employeeId);
        return current && byId.has(current.id) ? { ...row, employeeSnapshot: { ...row.employeeSnapshot, ...byId.get(current.id) } } : row;
      }),
    })));
  };

  const handleRefreshRunSnapshots = (runId, currentEmployees) => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes('calculated')) return r;
      return {
        ...r,
        rows: r.rows.map(row => {
          const current = (currentEmployees || employees).find(e => e.id === row.employeeId);
          // En körning som inte räknats än får också de nya avgiftsreglerna.
          return current ? { ...row, employeeSnapshot: { ...current }, feeRules: FEE_RULES_VERSION } : row;
        }),
      };
    }));
  };

  const handleAdvanceRunStep = (runId, stepId) => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes(stepId)) return r; // idempotent
      return { ...r, completedSteps: [...r.completedSteps, stepId] };
    }));
    // "Jag har lämnat in AGI" i lönekörningen markerar också månadens
    // AGI-rapport som inlämnad (och skapar den om den saknas), så
    // Skatt och bokslut visar samma sak.
    if (stepId === 'agi') {
      const run = payrollRuns.find(r => r.id === runId);
      if (!run) return;
      const existing = agiReports.find(r => r.period === run.period);
      if (existing) {
        if (existing.status !== 'submitted') handleMarkAgiSubmitted(existing.id);
      } else {
        const totals = summarizePayrollRun(run.rows.map(row => computeEmployeePayroll(row.employeeSnapshot, row)));
        const now = new Date().toISOString();
        setAgiReports(prev => [...prev, {
          id: `agi_${run.period}_${Date.now()}`, period: run.period, payrollRunId: run.id, isZero: false,
          totals: { gross: totals.gross, tax: totals.tax, employerFee: totals.employerFee },
          status: 'submitted', createdAt: now, submittedAt: now,
        }]);
      }
    }
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

  // Ta bort en lönekörning (kundönskemål: felskapade körningar gick inte att
  // bli av med). Obokförd: tas bort direkt med Ångra. Bokförd: frågar först
  // och rättar lönens verifikationer med motverifikationer, samma princip
  // som handleReverseExpense — bokförda verifikationer raderas aldrig.
  // Ett AGI-utkast byggt på körningen följer med; en inlämnad AGI står kvar.
  const handleDeleteRun = async (runId) => {
    const index = payrollRuns.findIndex(r => r.id === runId);
    const run = payrollRuns[index];
    if (!run) return false;
    const booked = run.completedSteps.includes('booked');
    const agiSubmitted = run.completedSteps.includes('agi');
    if (booked) {
      const message = tr('payrollDelete.confirmBooked', { period: run.period }) + (agiSubmitted ? ` ${tr('payrollDelete.agiNote')}` : '');
      if (!(await confirmDialog(message, { danger: true }))) return false;
      const today = new Date().toISOString().split('T')[0];
      verifications
        .filter(v => v.source === 'payroll' && String(v.sourceId || '').startsWith(`${runId}_`))
        .filter(v => !verifications.some(x => x.source === 'payroll_reversal' && x.sourceId === v.sourceId))
        .forEach(v => handleAddVerification({
          date: today,
          description: `Rättelse: ${v.description}`,
          source: 'payroll_reversal',
          sourceId: v.sourceId,
          rows: (v.rows || []).map(r => ({ ...r, debet: r.kredit || 0, kredit: r.debet || 0 })),
        }));
    }
    const draftAgi = agiReports.filter(r => r.payrollRunId === runId && r.status !== 'submitted');
    setPayrollRuns(prev => prev.filter(r => r.id !== runId));
    if (draftAgi.length) setAgiReports(prev => prev.filter(r => !draftAgi.some(d => d.id === r.id)));
    if (booked) {
      setToast({ message: tr('payrollDelete.doneBooked'), variant: 'success' });
    } else {
      showUndo({
        message: tr('payrollDelete.done'),
        onUndo: () => {
          setPayrollRuns(prev => restoreAt(prev, run, index));
          if (draftAgi.length) setAgiReports(prev => [...prev, ...draftAgi]);
        },
      });
    }
    return true;
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

  const handleResetData = async () => {
    if (await confirmDialog(tr('ui.ar_du_saker_pa_att_du_vill_aterstalla_all_data_d'), { danger: true })) {
      if (!(await archiveBeforeRemoval(data.activeCompanyId, 'reset'))) return false;
      const defaultData = createEmptyCompanyData({ id: data.activeCompanyId });
      setData(prev => ({
        ...prev,
        companies: {
          ...prev.companies,
          [prev.activeCompanyId]: defaultData,
        },
      }));
      return true;
    }
    return false;
  };

  // Count for review badge (must be before navSections)
  // Granskningskön (Sida "Granskning") = kvitton/leverantörsfakturor utan
  // kontering — samma underlag som ReviewQueue.jsx faktiskt visar.
  const reviewCount = expenses.filter(e => !e.costAccount).length;
  // Granskning-sidan har också flikarna Stripe och Zettle. Deras rader räknas
  // i integrationReviewCount (hämtas högre upp) och ingår i det som menyn visar.
  const reviewTotal = reviewCount + integrationReviewCount;

  // Notisklockan: det som hänt (utils/notificationFeed.js). Att göra finns
  // på Startsidan och nås längst ner i listan. Siffran är antalet nya och
  // nollas när klockan öppnas; det som var nytt markeras tills den stängs.
  const vatSoon = (() => {
    const d = nextVatDeadline(company, vatPeriods, vatContextFor(company, verifications));
    const active = d && verifications.some(v => v.date && v.date >= d.start && v.date <= d.end);
    return active && d.daysLeft <= 7 ? d : null;
  })();
  const agiSoon = (() => {
    if (hiddenFeatureNavIds(currentCompany).includes('payroll')) return null;
    const d = nextAgiDeadline(new Date());
    const booked = payrollRuns.some(r => r.period === d.periodKey && r.completedSteps?.includes('booked'));
    const submitted = agiReports.some(r => r.period === d.periodKey && r.status === 'submitted');
    return booked && !submitted && d.daysLeft <= 7 ? d : null;
  })();
  const notifications = buildNotificationFeed({ t, invoices, integrationEvents, vat: vatSoon, agi: agiSoon });
  const notificationCount = notifications.filter(n => isUnread(n, seenNotifKeys)).length;
  const toggleNotifMenu = () => {
    setIsProfileMenuOpen(false);
    if (isNotifMenuOpen) { setIsNotifMenuOpen(false); return; }
    setNotifOpenedUnread(new Set(notifications.filter(n => isUnread(n, seenNotifKeys)).map(n => n.keys.join('|'))));
    setSeenNotifKeys(seen => writeSeenKeys(data.activeCompanyId, seen, notifications.flatMap(n => n.keys)));
    setIsNotifMenuOpen(true);
  };
  const openNotification = (n) => {
    if (n.target?.action) handleGlobalAction(n.target.action, n.target.tab);
    else handleNavTabChange(n.target?.tab || 'dashboard');
    setIsNotifMenuOpen(false);
  };
  const NOTIF_ICON = { paid: Banknote, integration: Banknote, deadline: CalendarClock };
  const renderNotifPanel = () => (
    <div className="profile-dropdown notif-dropdown">
      <div className="profile-header" style={{ paddingBottom: 4 }}>
        <div className="profile-name">{tr('ui.notiser')}</div>
      </div>
      <div className="dropdown-divider"></div>
      {notifications.length === 0 ? (
        <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>{t('notifFeed.empty')}</div>
      ) : notifications.map((n) => {
        const Icon = NOTIF_ICON[n.kind] || Bell;
        const fresh = notifOpenedUnread.has(n.keys.join('|'));
        return (
          <button key={n.keys.join('|')} onClick={() => openNotification(n)} style={{ alignItems: 'flex-start' }}>
            <span style={{ width: 26, height: 26, borderRadius: '7px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `var(--status-${n.tone}-bg)`, color: `var(--status-${n.tone}-text)`, opacity: fresh ? 1 : 0.6 }}>
              <Icon size={13} />
            </span>
            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <span style={{ display: 'block', overflowWrap: 'break-word', fontWeight: fresh ? 600 : 400, color: fresh ? 'var(--text-main)' : 'var(--text-secondary)' }}>{n.text}</span>
              <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: 2 }}>{notificationWhen(t, n.at)}</span>
            </span>
            {fresh && <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 6 }} />}
          </button>
        );
      })}
      <div className="dropdown-divider"></div>
      <button onClick={() => { handleNavTabChange('dashboard'); setIsNotifMenuOpen(false); }} style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
        {t('notifFeed.todo')}
      </button>
    </div>
  );

  // ── Render content ──
  // Vilka sidor som får synas i menyn. null = alla (mitt eget företag, eller
  // en inbjudan gjord innan sidbehörigheterna fanns). Behörigheten som
  // FAKTISKT skyddar data ligger server-side i api/company-access.js — den
  // här raden är bara menyn.
  const sharedNavIds = currentCompany?.__shared
    ? visiblePages(currentCompany.__shared.pageAccess, currentCompany.__shared.role)
    : null;
  // Anställda och lön syns alltid för en inbjuden, även utan behörighet:
  // sidan förklarar då att ägaren måste ge åtkomst. Utan den letade en
  // inbjuden revisor efter löneimporten och hamnade i Lägg till företag och
  // Stripe-betalningen (kundrapport 2026-10-09).
  const payrollLockedForMember = Boolean(currentCompany?.__shared)
    && accessForPage(currentCompany.__shared.pageAccess, 'payroll', currentCompany.__shared.role) === 'none';
  if (payrollLockedForMember && sharedNavIds && !sharedNavIds.includes('payroll')) sharedNavIds.push('payroll');
  // Bara inbjuden (inget eget företag): Lägg till företag leder till en egen
  // prenumeration, så den visas inte. Inbjudningar till fler företag fungerar ändå.
  const ownsAnyCompany = Object.values(data.companies || {}).some(c => !c?.__shared);
  // UF-läget (utils/ufMode.js) skär bort de sidor ett UF-företag aldrig
  // ska använda — offerter, projekt och lön. Det är en EGEN begränsning
  // vid sidan av sidbehörigheterna ovan, inte samma sak: behörigheterna
  // säger vad en inbjuden person får se av NÅGON ANNANS företag, UF-läget
  // vad företaget självt har för funktioner. Snittet av båda gäller när
  // de råkar mötas (en inbjuden medlem i ett UF-företag).
  const allowedNavIds = isUfCompany(company)
    ? UF_NAV_IDS.filter(id => sharedNavIds === null || id === 'settings' || sharedNavIds.includes(id))
    : sharedNavIds;

  // Mobile bottom nav (4 vanligaste + "Mer") — Sida 26. "Mer" öppnar en
  // bottensheet med resten av huvudpunkterna istället för att själv peka på
  // en specifik sida, så dess ikon nedan hanteras separat (se mobileSheetSections).
  // Bottenmenyn har det man tittar i. Att SKAPA faktura, kontakt och kvitto
  // sköts redan av snabbåtgärderna på Hem, så de fick inte en egen plats här
  // (kundfeedback); fakturor och kunder ligger ett tryck bort under Meny.
  // Som i en riktig app står huvudsysslan i mitten som en upphöjd rund knapp:
  // Kvitton, eftersom att fota ett kvitto är det man oftast gör på telefonen.
  // Bokföring och Rapport ligger på var sin sida om den, Hem först och Meny sist.
  const mobileNavItems = [
    { id: 'dashboard',     label: t('navShort.dashboard'), icon: NavHomeIcon },
    { id: 'verifications', label: tr('ui.bokforing'), icon: BookOpen },
    { id: 'expenses',      label: tr('ui.kvitton'),   icon: NavReceiptsIcon },
    { id: 'reports',       label: t('navShort.reports'), icon: BarChart3 },
  ];
  // Telefonens Meny har samma grupper som sidomenyn på datorn, utan det som redan
  // finns i bottenraden (se visibleMobileSheetSections).
  const mobileSheetSections = [
    { key: 'business', title: t('nav.groupBusiness'), items: [
      { id: 'contacts', label: t('nav.contacts'), icon: Users },
      { id: 'quotes', label: t('nav.quotes'), icon: NavQuotesIcon, exact: true },
      { id: 'invoices', label: t('nav.customerInvoices'), icon: NavCustomerInvoicesIcon, exact: true },
      { id: 'articles', label: t('nav.articles'), icon: Package, exact: true },
      { id: 'projects', label: t('nav.projects'), icon: Briefcase },
    ] },
    { key: 'finance', title: t('nav.groupFinance'), items: [
      { id: 'expenses', label: t('nav.expenses'), icon: NavReceiptsIcon },
      { id: 'supplier_invoices', label: t('nav.supplierInvoices'), icon: NavSupplierInvoicesIcon, exact: true },
      { id: 'payroll', label: t('nav.payroll'), icon: NavPayrollIcon },
    ] },
    { key: 'reports', title: t('nav.groupReports'), items: [
      { id: 'bank', label: t('nav.bank'), icon: Landmark },
      { id: 'verifications', label: t('nav.verifications'), icon: BookOpen },
      { id: 'reports', label: t('nav.reports'), icon: BarChart3 },
      { id: 'taxes', label: t('nav.taxes'), icon: Calculator },
    ] },
    { key: 'settings', title: null, items: [
      { id: 'settings', label: t('nav.settings'), icon: SettingsIcon },
    ] },
  ];
  // Mobilmenyn måste filtreras på samma sätt som sidomenyn — annars är
  // UF-lägets avstängda sidor (Offerter/Projekt/Lön) borta på desktop men
  // kvar i mobilens Meny, vilket är sämre än att inte ha filtrerat
  // alls: samma app säger två olika saker beroende på skärmbredd.
  // allowedNavIds är null för ett vanligt eget företag, så det här är ett
  // no-op där. 'settings' undantas precis som i sidomenyn.
  const isNavIdAllowed = (id) => allowedNavIds === null || id === 'settings' || allowedNavIds.includes(id);
  // Gömda funktioner (utils/optionalFeatures.js) syns inte i menyn, men
  // sidan finns kvar. Kollas på menyvalets eget id, eftersom Artiklar
  // delar behörighet med Kundfakturor (navAccessId).
  const featureHiddenNavIds = hiddenFeatureNavIds(currentCompany);
  const isNavItemShown = (item) => !featureHiddenNavIds.includes(item.id) && isNavIdAllowed(navAccessId(item.id));
  // Offerter, Kundfakturor, Artiklar och Leverantörsfakturor markeras bara på sin egen sida.
  const isNavItemActive = (item) => (item.exact
    ? resolveTab(activeTab) === item.id
    : resolveNavGroup(activeTab) === resolveTab(item.id));
  const visibleMobileNavItems = mobileNavItems.filter(item => isNavIdAllowed(item.id));
  // Det som redan finns i bottenraden (Kvitton, Bokföring, Rapport) tas inte med i Meny.
  const barIds = visibleMobileNavItems.map(item => item.id);
  const visibleMobileSheetSections = mobileSheetSections
    .map(sec => ({ ...sec, items: sec.items.filter(item => isNavItemShown(item) && !barIds.includes(item.id)) }))
    .filter(sec => sec.items.length > 0);
  // Som på datorn: Att granska står alltid på samma plats, bara siffran kommer och går.
  const reviewSheetVisible = isNavIdAllowed('review');
  // "Meny" lyser när sidan man står på finns i panelen.
  const isMobileSheetItemActive = (reviewSheetVisible && resolveNavGroup(activeTab) === 'review')
    || visibleMobileSheetSections.some(sec => sec.items.some(isNavItemActive));

  const companyList = Object.values(data.companies).map(c => c.company);

  // Byt företag i profilmenyn (dator och telefon): en ägare med flera
  // företag, eller en redovisningskonsult inbjuden av flera kunder. Med
  // många företag finns en sökruta. Lägg till företag står direkt under
  // listan, så allt om företag ligger samlat.
  const companyEntries = Object.entries(data.companies || {});
  const renderCompanySwitcher = () => {
    if (companyEntries.length < 2) return null;
    const q = companySearch.trim().toLowerCase();
    const shown = companyEntries.filter(([, c]) => !q || `${c.company?.name || ''} ${c.company?.orgNr || ''}`.toLowerCase().includes(q));
    return (
      <>
        <div style={{ padding: '6px 14px 4px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{tr('companySwitcher.title')}</div>
        {companyEntries.length > 6 && (
          <div style={{ padding: '2px 10px 6px' }}>
            <input
              value={companySearch}
              onChange={e => setCompanySearch(e.target.value)}
              placeholder={tr('companySwitcher.search')}
              aria-label={tr('companySwitcher.search')}
              style={{ width: '100%', padding: '7px 10px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-main)', fontSize: '13px', fontFamily: 'inherit' }}
            />
          </div>
        )}
        <div className="company-switch-list" style={{ maxHeight: '260px', overflowY: 'auto' }}>
          {shown.map(([id, c]) => (
            <button
              key={id}
              onClick={() => { handleSwitchCompany(id); setIsProfileMenuOpen(false); setCompanySearch(''); }}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', fontWeight: id === data.activeCompanyId ? 700 : undefined }}
            >
              <span style={{ width: 14, display: 'inline-flex', flexShrink: 0 }}>{id === data.activeCompanyId ? <Check size={14} /> : null}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>{c.company?.name || tr('ui.mitt_foretag')}</span>
              {c.__shared && <span style={{ fontSize: '11px', color: 'var(--text-muted)', flexShrink: 0, fontWeight: 400 }}>{tr('companySwitcher.invited')}</span>}
            </button>
          ))}
          {shown.length === 0 && <div style={{ padding: '6px 14px', fontSize: '13px', color: 'var(--text-muted)' }}>{tr('companySwitcher.none')}</div>}
        </div>
      </>
    );
  };

  // "Se hur" i sidhuvudet: filmerna för sidan man står på (utils/pageGuides.js).
  // Gömda funktioner (Artiklar, Projekt) visar ingen film.
  const pageGuideTab = resolveTab(activeTab);
  const pageGuides = featureHiddenNavIds.includes(pageGuideTab) ? [] : guidesForPage(pageGuideTab);
  const pageGuideContext = pageGuides.length > 0 ? { guides: pageGuides, open: () => setGuideModalOpen(true) } : null;

  const renderContent = () => {
    const commonProps = {
      accounts, balances, verifications,
      globalAction, clearGlobalAction: () => setGlobalAction(null)
    };

    // 'company' (sidomenyn/profilmenyn) och 'settings' landar båda på
    // inställningssidan — den förra direkt på Företag-fliken.
    // 'settings_system' (Att göra: "Välj om företaget har moms") landar på Allmänt.
    const settingsInitialSection = settingsShortcutSection || (activeTab === 'company' ? 'company' : undefined);

    // Kom man ändå hit — bokmärkt URL-hash, en genväg från en annan sida,
    // produktrundturen — visas förklaringen i stället för sidan. Ligger
    // FÖRE switchen, inte som en gren i den: annars måste varje ny sida
    // komma ihåg att lägga till kollen, och den som glömmer släpper in
    // funktionen tyst.
    // resolveNavGroup, INTE resolveTab: frågan är vilken MENYPUNKT sidan
    // hör till, och det är exakt vad resolveNavGroup svarar på.
    // Leverantörsfakturor ('supplier_invoices') är den som gör skillnaden —
    // den har ingen egen menypunkt utan hör till Fakturering, och med
    // resolveTab (som lämnar id:t orört) hade den räknats som en okänd
    // sida och spärrats för UF, mitt i ett flöde som annars fungerar.
    const ufTab = resolveNavGroup(activeTab);
    if (ufPageState(company, ufTab) === 'blocked') {
      return <UfLockedPage tabId={ufTab} onNavigate={handleNavTabChange} />;
    }

    switch (resolveTab(activeTab)) {
      case 'dashboard':
        return (
          <Dashboard
            {...commonProps}
            invoices={invoices}
            expenses={expenses}
            contacts={contacts}
            setActiveTab={handleNavTabChange}
            company={company}
            user={user}
            profileIncomplete={!hasCompletedOnboarding}
            onResumeOnboarding={() => setShowOnboarding(true)}
            vatPeriods={vatPeriods}
            payrollRuns={payrollRuns}
            employees={employees}
            reviewTotal={reviewTotal}
            agiReports={agiReports}
            bankTransactions={bankTransactions}
            hiddenNavIds={featureHiddenNavIds}
            onOpenItem={handleGlobalAction}
            onBulkImportSie={handleBulkImportVerifications} onCloseImportedYears={handleCloseImportedYears}
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
        if (payrollLockedForMember) {
          return (
            <div style={{ maxWidth: '560px', margin: '48px auto', padding: '24px 26px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 8px' }}>{tr('ui.lon_ingen_atkomst_titel')}</h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{tr('ui.lon_ingen_atkomst_text', { company: company?.name || '' })}</p>
            </div>
          );
        }
        return (
          <Payroll
            key={company?.id || data.activeCompanyId}
            employees={employees}
            onSaveEmployee={handleSaveEmployee}
            onImportEmployees={handleImportEmployees}
            onApplyFos={handleApplyFos}
            onSyncBeforeServerCall={syncUserDataNow}
            accounts={accounts}
            projects={projects}
            payrollRuns={payrollRuns}
            onCreateRun={handleCreateRun}
            onUpdateRunRow={handleUpdateRunRow}
            onUpdateRun={handleUpdateRun}
            onAdvanceRunStep={handleAdvanceRunStep}
            onBookRun={handleBookRun}
            onMarkRunPaid={handleMarkRunPaid}
            onDeleteRun={handleDeleteRun}
            onRefreshRunSnapshots={handleRefreshRunSnapshots}
            agiReports={agiReports}
          />
        );
      case 'taxes':
        return (
          <Taxes
            key={company?.id || data.activeCompanyId}
            showInventoryStep={isFeatureOn(currentCompany, 'articles')}
            company={company}
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            accounts={accounts}
            balances={balances}
            employees={employees}
            payrollRuns={payrollRuns}
            agiReports={agiReports}
            onCreateAgiReport={handleCreateAgiReport}
            onMarkAgiSubmitted={handleMarkAgiSubmitted}
            onDeleteAgiReport={handleDeleteAgiReport}
            vatPeriods={vatPeriods}
            onBookVatPeriod={handleBookVatPeriod}
            onNavigateToVerification={handleNavigateToVerification}
            onAddVerification={handleAddVerification}
            setCompanyInfo={setCompanyInfo}
            setAccounts={setAccounts}
            onNavigateToTab={handleNavTabChange}
            initialSection={taxesInitialSection}
            contacts={contacts}
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
            ufQuota={ufInvoiceQuota(company, invoices)}
            invoices={invoices}
            contacts={contacts}
            accounts={accounts}
            articles={articles}
            setArticles={setArticles}
            verifications={verifications}
            onAdd={handleAddInvoice}
            onMarkPaid={handleMarkInvoicePaid}
            onRegisterPayment={handleRegisterInvoicePayment}
            onRotRutRequested={handleRotRutRequested}
            onRotRutPayout={handleRotRutPayout}
            onRotRutRejected={handleRotRutRejected}
            onImportRotRutBookings={handleImportRotRutBookings}
            onRotRutBatchRequested={handleRotRutBatchRequested}
            onRotRutBatchPayout={handleRotRutBatchPayout}
            onUnmarkPaid={handleUnmarkInvoicePaid}
            onGetPaymentLinkUrl={getInvoicePaymentLinkUrl}
            activeCompanyId={data.activeCompanyId}
            stripeAccountId={company.stripeAccountId}
            setInvoices={setInvoices}
            company={company}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            uid={user?.id}
            projects={projects}
            onSyncBeforeServerCall={syncUserDataNow}
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
            company={company}
            onUpdateCompany={setCompanyInfo}
            onDeleteReceiptFolder={handleDeleteReceiptFolder}
            onAdd={handleAddExpense}
            onAddSupplierInvoice={handleAddSupplierInvoice}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onFixExpenseAccount={handleFixExpenseAccount}
            onSaveReceiptDetails={handleSaveReceiptDetails}
            onSaveOcrDraft={handleSaveOcrDraft}
            onDeleteExpense={handleDeleteExpense}
            onReverseExpense={handleReverseExpense}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            pageTitle={tr('ui.kostnader')}
            pageSubtitle={tr('ui.registrera_och_folj_foretagets_kostnader')}
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
            company={company}
            onUpdateCompany={setCompanyInfo}
            onDeleteReceiptFolder={handleDeleteReceiptFolder}
            onAdd={handleAddExpense}
            onFixExpenseAccount={handleFixExpenseAccount}
            onSaveReceiptDetails={handleSaveReceiptDetails}
            onSaveOcrDraft={handleSaveOcrDraft}
            onDeleteExpense={handleDeleteExpense}
            onReverseExpense={handleReverseExpense}
            pageTitle={tr('ui.kvitton')}
          />
        );
      case 'supplier_invoices': {
        // Leverantörerna finns också här, där man letar när man har en faktura
        // i handen. Samma register som fliken på Kunder, bara en dörr till.
        const supplierTabs = {
          items: [{ id: 'invoices', label: tr('ui.fakturor') }, { id: 'suppliers', label: t('contacts.list.suppliers') }],
          activeId: supplierPageTab,
          onChange: setSupplierPageTab,
        };
        if (supplierPageTab === 'suppliers') {
          return (
            <Contacts
              fixedType="supplier"
              headerTitle={tr('ui.leverantorsfakturor')}
              headerTabs={supplierTabs}
              contacts={contacts}
              setContacts={setContacts}
              accounts={accounts}
              invoices={invoices}
              quotes={quotes}
              expenses={expenses}
              globalAction={globalAction}
              clearGlobalAction={() => setGlobalAction(null)}
            />
          );
        }
        return (
          <SupplierInvoices
            key={company?.id || data.activeCompanyId}
            company={company}
            headerTabs={supplierTabs}
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
      }
      case 'quotes':
        return <Quotes key={company?.id || data.activeCompanyId} quotes={quotes} setQuotes={setQuotes} onConvert={handleConvertQuoteToInvoice} contacts={contacts} projects={projects} company={company} activeCompanyId={data.activeCompanyId} user={user} globalAction={globalAction} clearGlobalAction={() => setGlobalAction(null)} handleGlobalAction={handleGlobalAction} articles={articles} setArticles={setArticles} onSyncBeforeServerCall={syncUserDataNow} />;
      case 'articles':
        return <Articles key={company?.id || data.activeCompanyId} articles={articles} setArticles={setArticles} accounts={accounts} company={company} verifications={verifications} invoices={invoices} expenses={expenses} onAddVerification={handleAddVerification} setCompanyInfo={setCompanyInfo} />;
      case 'projects':
        return (
          <Projects
            key={company?.id || data.activeCompanyId}
            projects={projects}
            invoices={invoices}
            expenses={expenses}
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
            onAction={handleGlobalAction}
          />
        );
      case 'contacts':
        return (
          <Contacts
            contacts={contacts}
            setContacts={setContacts}
            accounts={accounts}
            invoices={invoices}
            quotes={quotes}
            expenses={expenses}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
          />
        );
      case 'transfers':
        return (
          <Verifications
            user={user}
            seriesNames={company?.verificationSeriesNames}
            verifications={verifications}
            accounts={accounts}
            balances={balances}
            contacts={contacts}
            projects={projects}
            templates={verificationTemplates}
            orgType={detectOrgType(company?.orgNr)}
            partners={company?.partners}
            vatExempt={isVatExempt(company)}
            onSaveTemplate={handleSaveVerificationTemplate}
            onAdd={handleAddVerification}
            setVerifications={setVerifications}
            pageTitle={tr('ui.overforingar')}
            pageSubtitle={tr('ui.hantera_kontooverforingar_och_transaktioner')}
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
            initialTab={reviewInitialTab}
            handleGlobalAction={handleGlobalAction}
          />
        );

      case 'verifications':
        return (
          <Verifications
            user={user}
            seriesNames={company?.verificationSeriesNames}
            verifications={verifications}
            accounts={accounts}
            balances={balances}
            contacts={contacts}
            projects={projects}
            templates={verificationTemplates}
            orgType={detectOrgType(company?.orgNr)}
            partners={company?.partners}
            vatExempt={isVatExempt(company)}
            onSaveTemplate={handleSaveVerificationTemplate}
            onAdd={handleAddVerification}
            setVerifications={setVerifications}
            setAccounts={setAccounts}
            vatPeriods={vatPeriods}
            highlightVerificationId={highlightVerificationId}
            onClearHighlight={() => setHighlightVerificationId(null)}
            initialTab={verificationsInitialTab}
            // Fliken i adressen (#accruals, #fixed_assets, #accounts). Utan den
            // landade en omladdning på Verifikationer, t.ex. när appen laddar om
            // sig själv för att en ny version publicerats (utils/staleBuild.js).
            // replaceState: ingen ny historikpost och ingen hashchange.
            onTabChange={(id) => {
              setVerificationsInitialTab(id);
              try { window.history.replaceState(window.history.state, '', `#${id}`); } catch { /* adressen är bara en bekvämlighet */ }
            }}
            extraTabs={isUfCompany(company) ? [] : [
              { id: 'accruals', label: tr('ui.periodiseringar'), content: <Accruals company={company} accounts={accounts} verifications={verifications} employees={employees} payrollRuns={payrollRuns} onAddVerification={handleAddVerification} setCompanyInfo={setCompanyInfo} /> },
              { id: 'fixed_assets', label: tr('ui.tillgangar'), content: <FixedAssets company={company} accounts={accounts} verifications={verifications} onAddVerification={handleAddVerification} setCompanyInfo={setCompanyInfo} /> },
            // Gömda funktioner (utils/optionalFeatures.js) visas inte, utom när
            // man kommer dit via en länk (t.ex. bokslutets checklista).
            ].filter(tab => isFeatureOn(currentCompany, tab.id) || verificationsInitialTab === tab.id)}
          />
        );
      case 'bank':
        return (
          <Bank
            bankTransactions={bankTransactions}
            bankImportProfiles={company?.bankImportProfiles || {}}
            bankAccounts={company?.bankAccounts || []}
            reconciliations={company?.reconciliations || []}
            invoices={invoices}
            expenses={expenses}
            contacts={contacts}
            accounts={accounts}
            setAccounts={setAccounts}
            verifications={verifications}
            vatPeriods={vatPeriods}
            onSetBankTransactions={setBankTransactions}
            onUpdateCompany={setCompanyInfo}
            onRegisterInvoicePayment={handleRegisterInvoicePayment}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onAddVerification={handleAddVerification}
          />
        );
      case 'reports':
        return (
          <Reports
            hiddenReportIds={isUfCompany(company) ? UF_HIDDEN_REPORT_IDS : undefined}
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
      case 'settings':
        return (
          <Settings
            onOpenHelp={() => setIsHelpDrawerOpen(true)}
            onLogout={() => setShowLogoutConfirm(true)}
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
            onAddCompany={handleStartNewCompany}
            onDeleteCompany={handleDeleteCompany}
            hideScrollbar={hideScrollbar}
            onToggleHideScrollbar={toggleHideScrollbar}
            sidebarStyle={sidebarStyle}
            onToggleSidebarStyle={toggleSidebarStyle}
            sharedAccess={currentCompany.__shared || null}
            onBulkImportSie={handleBulkImportVerifications} onCloseImportedYears={handleCloseImportedYears}
            onRepairSieOpenings={handleRepairSieOpenings}
            onDeleteSieImport={handleDeleteSieImport}
            enabledFeatures={Object.fromEntries(OPTIONAL_FEATURES.map(f => [f.id, isFeatureOn(currentCompany, f.id)]))}
            onOpenRotRutImport={() => handleGlobalAction({ type: 'rotrut_import' }, 'invoices')}
            onAttachVerificationFiles={handleAttachVerificationFiles}
            themePreference={themePreference}
            onSetThemePreference={chooseTheme}
            density={density}
            onSetDensity={setDensity}
            initialSection={settingsInitialSection}
          />
        );
      default:
        return <Dashboard {...commonProps} invoices={invoices} expenses={expenses} contacts={contacts} setActiveTab={handleNavTabChange} company={company} vatPeriods={vatPeriods} payrollRuns={payrollRuns} employees={employees} reviewTotal={reviewTotal} agiReports={agiReports} bankTransactions={bankTransactions} hiddenNavIds={featureHiddenNavIds} onOpenItem={handleGlobalAction} onBulkImportSie={handleBulkImportVerifications} onCloseImportedYears={handleCloseImportedYears} />;
    }
  };

  return (
    <>
    {appLocked && isLoggedIn && (
      <AppLock
        firstName={user?.user_metadata?.first_name}
        onUnlock={() => setAppLocked(false)}
        onUsePassword={async () => {
          await supabase.auth.signOut();
          clearLocalData();
          setAppLocked(false);
          setIsLoggedIn(false);
        }}
      />
    )}
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
              <PaymentRequiredGate user={user} ownerUnpaid={sharedOwnerUnpaid} />
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
                ? <LandingPage onEnterApp={(mode, plan) => { if (mode === 'signup' && !plan) { navigate('/priser'); return; } setShowLanding(false); setAuthMode(mode === 'signup' ? 'signup' : 'login'); if (plan) setSelectedPlan(plan); }} />
                : <Auth onLogin={handleLogin} onBackToLanding={inInstalledApp ? () => {} : () => setShowLanding(true)} initialMode={authMode} plan={selectedPlan} initialUf={signupAsUf} />
            ) : showOnboarding ? (
              // Bugkritiskt: `showOnboarding`/handleOnboardingComplete/
              // handleSkipOnboarding fanns redan helt färdigkopplade (även
              // "Fortsätt registreringen"-banderollen i Dashboard.jsx satte
              // showOnboarding=true) — men <OnboardingFlow> renderades
              // aldrig någonstans, så klicket gjorde bokstavligen ingenting.
              <OnboardingFlow
                onComplete={handleOnboardingComplete}
                initialCompanyData={data.companies[data.activeCompanyId]}
                firstName={user?.user_metadata?.first_name}
              />
            ) : addingCompany ? (
              <OnboardingFlow
                onComplete={handleCreateNewCompany}
                firstName={user?.user_metadata?.first_name}
                addMode={{
                  existingOrgNrs: Object.values(data.companies || {}).map(c => c?.company?.orgNr).filter(Boolean),
                  defaultEmail: user?.email || '',
                  submitting: addingCompanySubmitting,
                  onCancel: () => setAddingCompany(false),
                }}
              />
            ) : !isActiveCompanyPaid ? (
              // Betala-per-företag (kundkrav): det AKTIVA företaget kräver
              // sin egen betalning (requiresOwnPayment) och har ingen giltig
              // rad i subscriptionsMap än — vanligast om Stripe-redirecten i
              // redirectNewCompanyToPayment (App.jsx) misslyckades/avbröts,
              // eller om man byter till ett tidigare skapat men aldrig
              // slutbetalt företag (handleSwitchCompany). Skiljer sig från
              // subscriptionGate==='blocked' ovan (kontots ORIGINALspärr,
              // kollad före all datainhämtning) — den här kan bara avgöras
              // EFTER att data.activeCompanyId/company är kända.
              <PaymentRequiredGate
                user={user}
                company={company}
                ownerUnpaid={activeSharedLocked}
                onSwitchCompany={unlockedCompanyId ? () => handleSwitchCompany(unlockedCompanyId) : undefined}
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
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`} data-fit={sidebarFit} style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh / var(--app-zoom, 1))' }}>
        {/* Logo — klickbar till startsidan, med en tunn linje under (samma
            låg-kontrast-ton som skiljer nav-grupperna åt nedanför) så den
            känns avskild från "Startsida" istället för att glida ihop. */}
        <div className="logo-container">
          <BokixLogo onClick={() => handleNavTabChange('dashboard')} />
          {/* Halv skärm: sidomenyn blir ett smalt ikonfält, och då ersätter
              monogrammet den breda loggan. Dolt på alla andra bredder. */}
          <button type="button" className="sidebar-monogram" onClick={() => handleNavTabChange('dashboard')} aria-label={tr('ui.startsida')} title={tr('ui.till_startsidan')}><BokixMark height={40} /></button>
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 20px var(--sb-gap, 8px)', flexShrink: 0 }}></div>

        {/* Företagsväxlaren flyttad till Inställningar → Företag (Sida 38) —
            fanns tidigare här som en dropdown i sidomenyn. Byt-företag/
            lägg-till-företag är kvar (handleSwitchCompany, setAddingCompany),
            bara UI:t flyttat, se <Settings companyList/activeCompanyId/
            onSwitchCompany/onAddCompany> ovan. */}

        {/* Huvudnavigering efter hur en företagare tänker: överst Start och Att
            granska, sedan Pengar in, Pengar ut och Koll på ekonomin. Inställningar
            ligger fast i botten-sektionen. Grupprubrikerna visas när fönstret är
            högt nog (index.css); annars, och i halvskärmens ikonfält, skiljs
            grupperna åt av en tunn linje. Att granska står alltid på samma plats så
            att raderna inte flyttar sig, bara siffran kommer och går. */}
        <nav className="nav-links" ref={sidebarNavRef} style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, flexShrink: 1, minHeight: 0, overflowY: 'auto' }}>
          {[
            {
              items: [
                { id: 'dashboard', label: t('nav.dashboard'), short: t('navShort.dashboard'), icon: NavHomeIcon },
                { id: 'review', label: t('nav.review'), short: t('navShort.review'), badge: reviewTotal, icon: ClipboardCheck },
              ],
            },
            {
              key: 'business',
              title: t('nav.groupBusiness'),
              items: [
                { id: 'contacts', label: t('nav.contacts'), short: t('navShort.contacts'), icon: Users },
                { id: 'quotes', label: t('nav.quotes'), short: t('navShort.quotes'), icon: NavQuotesIcon, exact: true },
                { id: 'invoices', label: t('nav.customerInvoices'), short: t('navShort.invoices'), icon: NavCustomerInvoicesIcon, exact: true },
                { id: 'articles', label: t('nav.articles'), short: t('navShort.articles'), icon: Package, exact: true },
                { id: 'projects', label: t('nav.projects'), short: t('navShort.projects'), icon: Briefcase },
              ],
            },
            {
              key: 'finance',
              title: t('nav.groupFinance'),
              items: [
                { id: 'expenses', label: t('nav.expenses'), short: t('navShort.expenses'), icon: NavReceiptsIcon },
                { id: 'supplier_invoices', label: t('nav.supplierInvoices'), short: t('navShort.supplierInvoices'), icon: NavSupplierInvoicesIcon, exact: true },
                { id: 'payroll', label: t('nav.payroll'), short: t('navShort.payroll'), icon: NavPayrollIcon },
              ],
            },
            {
              key: 'reports',
              title: t('nav.groupReports'),
              items: [
                { id: 'bank', label: t('nav.bank'), short: t('navShort.bank'), icon: Landmark },
                { id: 'verifications', label: t('nav.verifications'), short: t('navShort.verifications'), icon: BookOpen },
                { id: 'reports', label: t('nav.reports'), short: t('navShort.reports'), icon: BarChart3 },
                { id: 'taxes', label: t('nav.taxes'), short: t('navShort.taxes'), icon: Calculator },
              ],
            },
          ].map(group => ({ ...group, items: group.items.filter(item => !item.hidden && isNavItemShown(item)) }))
           .filter(group => group.items.length > 0)
           .map((group, gi) => {
            const isItemActive = (item) => (item.exact
              ? resolveTab(activeTab) === item.id
              : resolveNavGroup(activeTab) === resolveTab(item.id));
            // Gruppen med sidan man står på fälls aldrig ihop, så man ser var man är.
            const collapsed = Boolean(group.key) && collapsedNav.includes(group.key) && !group.items.some(isItemActive);
            return (
            <React.Fragment key={gi}>
              {gi > 0 && <div className="nav-group-divider" style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: 'var(--sb-gap, 8px) 20px', flexShrink: 0 }}></div>}
              {group.title && (
                <button type="button" className="nav-group-title" aria-expanded={!collapsed} onClick={() => toggleNavGroup(group.key)}>
                  <span>{group.title}</span>
                  <ChevronDown className="nav-group-chevron" size={12} style={{ transform: collapsed ? 'rotate(-90deg)' : 'none' }} />
                </button>
              )}
              <div className={`nav-group-items${collapsed ? ' is-collapsed' : ''}`}>
              {group.items.map((item) => {
                // Offerter, Kundfakturor, Artiklar och Leverantörsfakturor är egna
                // sidor: markeras bara på sin egen sida, inte på alla som delar
                // fakturasidans åtkomst (resolveNavGroup).
                const isActive = isItemActive(item);
                return (
                  <button
                    key={item.id}
                    data-tour={`nav-${item.id}`}
                    title={item.label}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => handleNavTabChange(item.id)}
                    style={{
                      padding: 'var(--sb-pad, 13px) 24px',
                      width: '100%',
                      textAlign: 'left',
                      background: isActive ? 'rgba(255,255,255,0.14)' : 'none',
                      border: 'none',
                      color: isActive ? '#ffffff' : 'rgba(255,255,255,0.88)',
                      fontSize: 'var(--sb-font, 15px)',
                      fontWeight: isActive ? 700 : 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <item.icon size={18} strokeWidth={isActive ? 2.25 : 2} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.85 }} />
                      <span className="nav-label">{item.label}</span>
                      <span className="nav-short">{item.short}</span>
                    </span>
                    {item.badge > 0 && (
                      <span className="nav-badge" style={{
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
              </div>
            </React.Fragment>
            );
          })}
        </nav>

        {/* Flexibelt tomt utrymme — trycker botten-sektionen längst ner oavsett skärmhöjd */}
        <div style={{ flex: 1 }}></div>

        {/* Fastsatt botten-sektion: Inställningar och Hjälp och support. Logga ut
            ligger i profilmenyn och längst ned i Inställningars meny. */}
        <div className="sidebar-footer-actions" style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button
            type="button"
            data-tour="nav-settings"
            title={t('nav.settings')}
            className={`nav-item ${resolveNavGroup(activeTab) === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavTabChange('settings')}
            style={{
              padding: 'var(--sb-pad, 13px) 24px', width: '100%', textAlign: 'left',
              background: resolveNavGroup(activeTab) === 'settings' ? 'rgba(255,255,255,0.14)' : 'none',
              border: 'none', color: resolveNavGroup(activeTab) === 'settings' ? '#ffffff' : 'rgba(255,255,255,0.88)',
              fontSize: 'var(--sb-font, 15px)', fontWeight: resolveNavGroup(activeTab) === 'settings' ? 700 : 500, cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <SettingsIcon size={18} style={{ flexShrink: 0, opacity: 0.85 }} />
              <span className="nav-label">{t('nav.settings')}</span>
              <span className="nav-short">{t('navShort.settings')}</span>
            </span>
          </button>
          <button
            className="nav-item"
            title={t('nav.help')}
            onClick={() => setIsHelpDrawerOpen(true)}
            style={{
              padding: 'var(--sb-pad, 13px) 24px', width: '100%', textAlign: 'left', background: 'none',
              border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 'var(--sb-font, 15px)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px'
            }}
          >
            <HelpCircle size={17} /> <span className="nav-label">{t('nav.help')}</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-wrapper" key={activeTab}>

        {/* Desktop Top Bar — kundönskemål: ska bara synas på Startsidan, inte
            på alla andra sidor. Hjälp/Logga ut finns ändå kvar överallt via
            sidomenyns fasta botten-sektion (samma aside, ovanför); resten av
            klustret (tema/notiser/övriga profilmeny-punkter) blir alltså
            Startsida-bara. */}
        {activeTab === 'dashboard' && (
        <div className="desktop-top-bar">
          <div className="desktop-topbar-left" style={{ flex: 1, marginRight: '32px' }}>
            {/* Företagsnamnet i topbaren togs bort på uttrycklig kundönskan
                (upplevdes som onödig text i huvudet på varje sida). Vilket
                företag man jobbar i syns fortfarande via profilmenyns
                "{company?.name}"-rad och vid företagsbyte (companyList/
                onSwitchCompany) — bara den passiva textetiketten här är
                borta. */}
          </div>

          <div className="desktop-topbar-right">
            <button data-tour="topbar-help" className="topbar-icon-btn" title={tr('ui.hjalp_support')} onClick={() => { setIsNotifMenuOpen(false); setIsProfileMenuOpen(false); setIsHelpDrawerOpen(true); }}>
              <HelpCircle size={23} />
            </button>
            <button className="topbar-icon-btn" title={theme === 'dark' ? tr('ui.ljust_lage') : tr('ui.morkt_lage')} onClick={toggleTheme}>
              {theme === 'dark' ? <Sun size={23} /> : <Moon size={23} />}
            </button>
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button className="topbar-icon-btn" title={tr('ui.notiser')} onClick={toggleNotifMenu}>
                <Bell size={23} />
              </button>
              {notificationCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 0, minWidth: 16, height: 16, padding: '0 4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '9.5px', fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  {notificationCount}
                </span>
              )}
              {isNotifMenuOpen && renderNotifPanel()}
            </div>

            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div
                data-tour="topbar-profile"
                className="topbar-profile-trigger"
                onClick={() => { setIsNotifMenuOpen(false); setIsProfileMenuOpen(v => !v); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}
              >
                <div className="topbar-avatar" title={user?.email || tr('ui.profil')}>
                  {(company?.name || user?.email || 'A').charAt(0).toUpperCase()}
                </div>
                <ChevronDown size={18} style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)' }} />
              </div>

              {isProfileMenuOpen && (
                <div data-tour="topbar-profile-dropdown" className="profile-dropdown">
                  <div className="profile-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.green, color: 'white', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {(company?.name || user?.email || 'A').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="profile-name">{company?.name || tr('ui.mitt_foretag')}</div>
                        <div className="profile-role">{user?.email || tr('ui.anvandare_bokix_se')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  {renderCompanySwitcher()}
                  {/* Kundfeedback: "Profil" och "Inställningar" var redundanta
                      här — Inställningar finns redan som en egen punkt i
                      huvudsidomenyn (navGroups/navItems ovan) och "Profil" är
                      bara en flik INUTI just den sidan (Settings.jsx: "Min
                      profil"), inte en egen destination. Borttagna, inte bara
                      dolda — samma två rader fanns dubblerat i mobilkopian av
                      den här menyn, borttagna där också. */}
                  {/* Temavalet låg här också. Borttaget på kundens begäran —
                      det finns kvar på två ställen: sol/måne-ikonen i
                      topbaren (båda layouterna) och Inställningar →
                      Utseende. Lägg inte tillbaka det här utan att fråga. */}
                  {ownsAnyCompany && (
                    <>
                      <button onClick={() => { handleStartNewCompany(); setIsProfileMenuOpen(false); }}><Building2 size={14} /> {tr('ui.lagg_till_foretag')}</button>
                      <div className="dropdown-divider"></div>
                    </>
                  )}
                  {!ownsAnyCompany && companyEntries.length > 1 && <div className="dropdown-divider"></div>}
                  {/* Samma mejladress/ämnesrad som felrapport-länken i
                      HelpDrawer.jsx — en riktig kanal istället för att bara
                      stänga menyn utan att göra något. */}
                  <button onClick={() => { setReportErrorModal(true); setIsProfileMenuOpen(false); }}><AlertTriangle size={14} /> {tr('ui.rapportera_fel')}</button>
                  <button className="profile-item-desktop-only" onClick={() => { setIsHelpDrawerOpen(true); setIsProfileMenuOpen(false); }}><HelpCircle size={14} /> {tr('ui.hjalp_support')}</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setIsProfileMenuOpen(false); setShowLogoutConfirm(true); }} className="text-danger profile-item-desktop-only"><LogOut size={14} /> {tr('ui.logga_ut')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {/* Mobile Top Bar */}
        <div className="global-top-bar" data-menu-open={isProfileMenuOpen || isNotifMenuOpen ? 'true' : undefined}>
          <div className="topbar-left">
            {/* Telefonens toppfält har ingen hamburgermeny: all navigering
                sker i bottenfältet, där "Meny" öppnar resten av sidorna. Två
                menyer för samma sak (hamburger uppe, Meny nere) förvirrade,
                och bottenfältet är det som Fortnox, Bokio och andra
                bokföringsappar har och som användarna känner igen. Loggan
                går till startsidan. */}
            {/* Loggan bara på Hem, som i en app. På övriga sidor står sidans
                namn i fältet, men först när sidans egen stora rubrik skrollats
                ur bild (MobileTopTitle), så namnet aldrig syns två gånger. */}
            {activeTab === 'dashboard' && <BokixLogo compact onClick={() => handleNavTabChange('dashboard')} />}
          </div>
          {activeTab !== 'dashboard' && <MobileTopTitle />}
          <div className="global-actions">
            {/* Kundönskemål: hjälp/tema/notiser/profilmenyn fanns bara i
                .desktop-top-bar — på mobil fanns ingen väg dit alls förutom
                Hjälp & support som redan låg i sidomenyns fot. Tema och
                notiser är för vardagliga för att gömmas bakom hamburgaren,
                så de får egna ikoner här också; resten av profilmenyns
                punkter (Profil/Inställningar/Kontoplaner m.fl.) nås via
                samma avatar-knapp och .profile-dropdown som på desktop —
                se den mobilanpassade positioneringen i index.css. */}
            {/* Tema-knappen (måne/sol) ligger i profilmenyn på telefon: i en
                app står bara det man använder hela tiden i toppfältet. */}
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button className="topbar-icon-btn" title={tr('ui.notiser')} onClick={toggleNotifMenu}>
                <Bell size={23} />
              </button>
              {notificationCount > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 0, minWidth: 16, height: 16, padding: '0 4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '9.5px', fontWeight: 700, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  {notificationCount}
                </span>
              )}
              {isNotifMenuOpen && renderNotifPanel()}
            </div>
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div
                className="topbar-profile-trigger"
                onClick={() => { setIsNotifMenuOpen(false); setIsProfileMenuOpen(v => !v); }}
                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}
              >
                <div className="topbar-avatar" title={user?.email || tr('ui.profil')}>
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
                        <div className="profile-name">{company?.name || tr('ui.mitt_foretag')}</div>
                        <div className="profile-role">{user?.email || tr('ui.anvandare_bokix_se')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { toggleTheme(); setIsProfileMenuOpen(false); }}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />} {theme === 'dark' ? tr('ui.ljust_lage') : tr('ui.morkt_lage')}
                  </button>
                  <div className="dropdown-divider"></div>
                  {renderCompanySwitcher()}
                  {/* Kundfeedback: "Profil" och "Inställningar" var redundanta
                      här — Inställningar finns redan som en egen punkt i
                      huvudsidomenyn (navGroups/navItems ovan) och "Profil" är
                      bara en flik INUTI just den sidan (Settings.jsx: "Min
                      profil"), inte en egen destination. Borttagna, inte bara
                      dolda — samma två rader fanns dubblerat i mobilkopian av
                      den här menyn, borttagna där också. */}
                  {ownsAnyCompany && (
                    <>
                      <button onClick={() => { handleStartNewCompany(); setIsProfileMenuOpen(false); }}><Building2 size={14} /> {tr('ui.lagg_till_foretag')}</button>
                      <div className="dropdown-divider"></div>
                    </>
                  )}
                  {!ownsAnyCompany && companyEntries.length > 1 && <div className="dropdown-divider"></div>}
                  <button onClick={() => { setReportErrorModal(true); setIsProfileMenuOpen(false); }}><AlertTriangle size={14} /> {tr('ui.rapportera_fel')}</button>
                  <button onClick={() => { setIsHelpDrawerOpen(true); setIsProfileMenuOpen(false); }}><HelpCircle size={14} /> {tr('ui.hjalp_support')}</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setIsProfileMenuOpen(false); setShowLogoutConfirm(true); }} className="text-danger"><LogOut size={14} /> {tr('ui.logga_ut')}</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {isOffline && (
          <div className="offline-banner" role="status">{tr('ui.offline_banner')}</div>
        )}
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
              <GuideContext.Provider value={pageGuideContext}>
                {renderContent()}
              </GuideContext.Provider>
              <div className="mobile-nav-spacer" aria-hidden="true" />
            </div>
          </Suspense>
        </div>
      </main>

      {/* ── Mobile Bottom Navigation (Sida 26) ── */}
      {/* Dra ned för att uppdatera (bara telefon). Sparar först det som
          väntar på att skickas (sparningen går annars efter 2 s, se Persist
          nedan), så ingen ändring försvinner när sidan laddas om. */}
      <PullToRefresh onRefresh={handlePullRefresh} />

      <nav className="mobile-bottom-nav app-bottom-nav" aria-label={tr('ui.mobilnavigation')}>
        <div className="mobile-bottom-nav-inner">
          {visibleMobileNavItems.map(item => {
            const isActive = resolveNavGroup(activeTab) === resolveTab(item.id);
            return (
              <button
                key={item.id}
                className={`mobile-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  // Ingen vibration här: iOS egen flikrad vibrerar inte, och Apple
                  // avråder från haptik på vanliga tryck (playing-haptics › Best practices).
                  // Som i appar: tryck på fliken man redan står på = tillbaka till toppen.
                  if (isActive && activeTab === resolveTab(item.id)) {
                    document.querySelector('.main-wrapper')?.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                  }
                  handleNavTabChange(item.id);
                }}
              >
                <span className="mobile-nav-icon"><item.icon size={22} /></span>
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
            onClick={() => { setIsNotifMenuOpen(false); setIsProfileMenuOpen(false); setMobileMoreOpen(true); }}
            aria-haspopup="true"
            aria-expanded={mobileMoreOpen}
          >
            {/* Fortnox-jämförelsen: "Meny" (inte "Mer") med samma
                hamburgerikon som appens övriga menyknappar, istället för
                tre prickar — matchar det fjärde navvalet i referensbilden. */}
            <span className="mobile-nav-icon">
              <Menu size={22} />
              {reviewTotal > 0 && <span className="mobile-nav-dot" aria-label={tr('ui.vantar_pa_granskning', { reviewTotal })} />}
            </span>
            <span>{tr('ui.meny')}</span>
          </button>
        </div>
      </nav>

      <div className={`mobile-sheet-overlay ${mobileMoreOpen ? 'open' : ''}`} onClick={() => setMobileMoreOpen(false)} />
      <div className={`mobile-sheet ${mobileMoreOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label={tr('ui.fler_sidor')}>
        <div className="mobile-sheet-handle" />
        <div className="mobile-sheet-title">
          <span>{tr('ui.meny')}</span>
          <button type="button" className="mobile-sheet-close" onClick={() => setMobileMoreOpen(false)} aria-label={tr('ui.stang_menyn')}><X size={18} /></button>
        </div>
        <div className="mobile-sheet-body">
          {reviewSheetVisible && (
            <button
              type="button"
              className={`mobile-sheet-review${resolveNavGroup(activeTab) === 'review' ? ' active' : ''}`}
              onClick={() => { handleNavTabChange('review'); setMobileMoreOpen(false); }}
            >
              <span className="mobile-sheet-row-icon"><ClipboardCheck size={20} /></span>
              <span className="mobile-sheet-review-text">
                <span className="mobile-sheet-review-title">{t('nav.review')}</span>
                <span className="mobile-sheet-review-sub">{reviewTotal > 0 ? tr('ui.pa_dig', { reviewTotal, v1: reviewTotal === 1 ? 'sak väntar' : 'saker väntar' }) : tr('ui.inget_vantar_just_nu')}</span>
              </span>
              {reviewTotal > 0 && <span className="mobile-sheet-review-badge">{reviewTotal}</span>}
            </button>
          )}
          {visibleMobileSheetSections.map(sec => (
            <div className="mobile-sheet-section" key={sec.key}>
              {sec.title && <div className="mobile-sheet-section-title">{sec.title}</div>}
              <div className="mobile-sheet-list">
                {sec.items.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={`mobile-sheet-row${isNavItemActive(item) ? ' active' : ''}`}
                    onClick={() => { handleNavTabChange(item.id); setMobileMoreOpen(false); }}
                  >
                    <span className="mobile-sheet-row-icon"><item.icon size={20} /></span>
                    <span className="mobile-sheet-row-label">{item.label}</span>
                    <ChevronRight size={18} className="mobile-sheet-row-chevron" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bakgrund bakom profil- och notismenyn på telefon: de ligger som en
          bottenpanel, och ett tryck utanför stänger dem. Syns inte på dator. */}
      {(isProfileMenuOpen || isNotifMenuOpen) && (
        <div className="mobile-dropdown-backdrop" onClick={() => { setIsProfileMenuOpen(false); setIsNotifMenuOpen(false); }} />
      )}

      {/* ── Help Drawer ── */}
      <HelpDrawer
        isOpen={isHelpDrawerOpen}
        onClose={() => setIsHelpDrawerOpen(false)}
        onStartTour={() => { setIsHelpDrawerOpen(false); handleNavTabChange('dashboard'); startProductTourWhenReady({ uid: user?.id, navigate: handleNavTabChange, hiddenTabs: hiddenFeatureNavIds(currentCompany) }); }}
        onStartInvoiceTour={() => { setIsHelpDrawerOpen(false); handleNavTabChange('invoices'); startInvoiceTourWhenReady({ uid: user?.id }); }}
        onContactSupport={(topic) => { setIsHelpDrawerOpen(false); setReportErrorTopic(topic); setReportErrorModal(true); }}
      />

      {/* ── Toast — ersätter blockerande alert() för t.ex. "Stripe är nu
          ansluten", se stripe_connect-useEffect ── */}
      <Toast message={toast?.message} variant={toast?.variant} action={toast?.action} duration={toast?.undo ? 8000 : 6000} onClose={closeToast} />

      {/* ── Confirm/prompt-dialog — ersätter native window.confirm()/
          window.prompt() överallt i appen (Quotes/Invoices/Expenses/
          SupplierInvoices/Verifications/Taxes/Settings/App.jsx), se
          ConfirmDialog.jsx för resonemanget. En enda host här, anropad
          imperativt (confirmDialog/promptDialog) från vilken fil som
          helst — samma "en instans, anropad utifrån"-mönster som Toast. ── */}
      <ConfirmDialogHost />

      {/* Momsperiod och F-skatt för företag som aldrig svarat (VatPeriodPrompt.jsx). */}
      {isLoggedIn && !showOnboarding && !activeNeedsSetup && isActiveCompanyPaid && subscriptionGate !== 'blocked'
        && !vatPromptLater.includes(data.activeCompanyId) && needsCompanyFactsAnswer(data.companies?.[data.activeCompanyId]) && (
        <VatPeriodPrompt
          companyData={data.companies[data.activeCompanyId]}
          onSave={(answers) => {
            const now = new Date().toISOString();
            setCompanyInfo(prev => ({
              ...prev,
              ...('vatPeriod' in answers ? { vatPeriod: answers.vatPeriod, vatPeriodConfirmedAt: now } : {}),
              ...('fSkatt' in answers ? { fSkatt: answers.fSkatt, fSkattConfirmedAt: now } : {}),
            }));
            // Ett svar är ett svar: frågan kommer inte tillbaka under besöket, även
            // om en sparning eller hämtning på ett stort konto hinner emellan.
            setVatPromptLater(ids => [...ids, data.activeCompanyId]);
            // Svaret sparas direkt, inte efter den vanliga väntan: laddar man om
            // sidan inom två sekunder ska frågan inte komma tillbaka.
            saveSoonRef.current = true;
          }}
          onLater={() => setVatPromptLater(ids => [...ids, data.activeCompanyId])}
        />
      )}

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{tr('ui.logga_ut')}</h2>
              <button className="modal-close" onClick={() => setShowLogoutConfirm(false)}>
                <X size={18} />
              </button>
            </div>
            {/* Bugkritiskt (kundrapporterad): den här dialogen byggdes med
                Tailwind-klasser (text-slate-600, p-6, flex justify-end
                gap-3) som varken är garanterat laddade på den här sidan
                (Tailwind v4:s Vite-plugin genererar bara utilities för
                klasser den ser i filer som faktiskt importerar Tailwinds
                CSS-ingång — här bara ReportUI/tremor-graferna) eller
                tema-medvetna (text-slate-600 är en fast grå ton, ingen
                mörkt-läge-variant) — mörk text på mörk bakgrund i mörkt
                läge. Samma .modal-content/.modal-footer + CSS-variabler
                som ConfirmDialogHost (shared/ConfirmDialog.jsx) redan
                använder korrekt, i stället. */}
            <p style={{ margin: '0 0 4px', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5 }}>{tr('ui.ar_du_saker_pa_att_du_vill_logga_ut')}</p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowLogoutConfirm(false)}>
                {tr('ui.avbryt')}
              </button>
              <button className="btn btn-danger" style={{ backgroundColor: '#ef4444', color: 'white' }} onClick={async () => {
                setShowLogoutConfirm(false);
                await supabase.auth.signOut();
                clearLocalData();
                setIsLoggedIn(false);
                setShowOnboarding(false);
              }}>
                {tr('ui.logga_ut')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Rapportera fel — samma modal-mönster som ovan. Kundönskemål:
          "som en kontaktlista", en enda ruta att fylla i, så enkelt som
          möjligt — namn/e-post skickas tyst med från den inloggade
          sessionen, se handleSubmitErrorReport. ── */}
      {guideModalOpen && pageGuides.length > 0 && (
        <GuideModal guides={pageGuides} onClose={() => setGuideModalOpen(false)} />
      )}

      {reportErrorModal && (
        <div className="modal-overlay" onClick={() => { if (!reportErrorBusy) setReportErrorModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{tr('ui.kontakta_support')}</h2>
              <button className="modal-close" onClick={() => setReportErrorModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmitErrorReport(); }}>
              <div className="form-group">
                <label className="form-label">{tr('ui.vad_galler_det')}</label>
                <div className="filter-pills contact-topics" role="radiogroup">
                  {[
                    ['Support', 'ui.amne_hjalp_med_bokix'],
                    ['Felrapport', 'ui.amne_nagot_fungerar_inte'],
                    ['Fakturering & pris', 'ui.amne_prenumeration_och_betalning'],
                    ['Säkerhet & integritet', 'ui.amne_personuppgifter_och_sakerhet'],
                    ['Övrigt', 'ui.amne_nagot_annat'],
                  ].map(([value, key]) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={reportErrorTopic === value}
                      className={`filter-pill${reportErrorTopic === value ? ' active' : ''}`}
                      onClick={() => setReportErrorTopic(value)}
                    >
                      {tr(key)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{reportErrorTopic === 'Felrapport' ? tr('ui.vad_gick_fel') : tr('ui.meddelande')}</label>
                <textarea
                  className="form-control"
                  rows={5}
                  placeholder={reportErrorTopic === 'Felrapport' ? tr('ui.beskriv_vad_som_hande_garna_vilken_sida_du_var_p') : tr('ui.skriv_ditt_meddelande')}
                  value={reportErrorText}
                  onChange={e => setReportErrorText(e.target.value)}
                  autoFocus
                  required
                />
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '6px 0 0' }}>{tr('ui.support_kontext_info', { line: getSupportContextLine() })}</p>
              </div>
              {/* Svaret går till kontots e-post (reply_to i api/contact.js,
                  adressen tas från inloggningen, inte från klienten). */}
              <div className="contact-sender">
                <span className="contact-sender-label">{tr('ui.skickas_fran_din_e_post')}</span>
                <span className="contact-sender-email">{user?.email}</span>
                <span className="form-hint">{tr('ui.vi_svarar_till_den_har_adressen')}</span>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReportErrorModal(false)} disabled={reportErrorBusy}>
                  {tr('ui.avbryt')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={reportErrorBusy || !reportErrorText.trim()}>
                  {reportErrorBusy ? tr('ui.skickar') : tr('ui.skicka')}
                </button>
              </div>
            </form>
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
