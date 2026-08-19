import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutDashboard,
  FileText,
  Receipt,
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
  Search,
  Menu,
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
} from 'lucide-react';
import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './components/AccountsData';
import { createStripeCheckoutSession } from './stripeApi';
import { createEmailDomain, getEmailDomainStatus } from './emailApi';
import { getDebet, getKredit } from './utils/verificationAmounts';
import { BRAND } from './utils/brandColors';
import { createDemoSeed } from './utils/landingDemoData'; // TEMP: mobile audit bypass, see useEffect below — removed before this change ships

// ── Bokix Logo Component (light sidebar) ──
function BokixLogo() {
  return (
    <div style={{ padding: '22px 14px 18px', display: 'flex', flexDirection: 'column' }}>
      {/* Ingen tagline längre — den hör hemma på marknadssidan, inte i det
          dagliga arbetsverktyget. Loggan får nu eget utrymme och är
          märkbart större eftersom den inte längre delar ytan med en rad text. */}
      <svg viewBox="0 0 140 48" width="152" height="52" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bokixGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="50%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
        </defs>
        <text
          x="4"
          y="38"
          fontFamily="Georgia, 'Times New Roman', serif"
          fontSize="46"
          fontWeight="600"
          fill="url(#bokixGrad)"
          letterSpacing="-1.5"
        >Bokix</text>
      </svg>
    </div>
  );
}
import Dashboard from './components/Dashboard';
import Invoices from './components/Invoices';
import Quotes from './components/Quotes';
import Expenses from './components/Expenses';
import SupplierInvoices from './components/SupplierInvoices';
import Contacts from './components/Contacts';
import Verifications from './components/Verifications';
import Accounts from './components/Accounts';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Projects from './components/Projects';
import TimeTracking from './components/TimeTracking';
import Payroll from './components/Payroll';
import Taxes from './components/Taxes';
import LandingPage from './components/LandingPage';
import FeaturesPage from './components/marketing/FeaturesPage';
import PricingPage from './components/marketing/PricingPage';
import AboutPage from './components/marketing/AboutPage';
import ContactPage from './components/marketing/ContactPage';
import Auth from './components/Auth';
import OnboardingFlow from './components/OnboardingFlow';
import CookieBanner from './components/CookieBanner';
import { supabase } from './supabaseClient';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsPolicy from './components/TermsPolicy';
import CookiesPolicy from './components/CookiesPolicy';
import ReviewQueue from './components/ReviewQueue';
import CompanySettings from './components/CompanySettings';
import HelpDrawer from './components/HelpDrawer';
import Toast from './components/shared/Toast';
// ──────────────────────────────────────────────
// Default company data factory
// ──────────────────────────────────────────────
function createEmptyCompanyData(companyInfo) {
  return {
    company: {
      id: `company_${Date.now()}`,
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
    },
    accounts: [...DEFAULT_ACCOUNTS],
    verifications: [],
    invoices: [],
    expenses: [],
    contacts: [],
    projects: [],
    timeEntries: [],
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
// STORAGE
// ──────────────────────────────────────────────
const STORAGE_KEY = 'bokforing_data';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.companies && parsed.activeCompanyId) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }

  // Initialize blank company data for new users
  const defaultData = createEmptyCompanyData({});
  return {
    activeCompanyId: defaultData.company.id,
    companies: {
      [defaultData.company.id]: defaultData,
    },
  };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
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
  quotes:           'invoices',
  transfers:        'verifications',
  dashboard:        'dashboard',
  contacts:         'contacts',
  invoices:         'invoices',
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
// "Leverantörsfakturor" är sen flikmärgningen (se Expenses.jsx) inte längre
// en egen sidopunkt — men Faktureringens genväg navigerar ändå dit med det
// gamla id:t så att rätt underflik öppnas (se initialTab i App.jsx:s render-
// switch). Här, för meny-highlight/rubrik, ska den räknas som "expenses".
const resolveNavGroup = (id) => resolveTab(id === 'supplier_invoices' ? 'expenses' : id);

// ──────────────────────────────────────────────
// APP COMPONENT
// ──────────────────────────────────────────────
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

  // Global intent state
  const [globalAction, setGlobalAction] = useState(null);
  const [isGlobalPlusOpen, setIsGlobalPlusOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
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
    setIsGlobalPlusOpen(false);
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
    // ── TEMPORARY — mobile responsiveness audit bypass ──────────────────
    // NOT a feature. Lets me (Claude) view the real authenticated app
    // chrome with demo data during local dev without real Supabase
    // credentials, via ?__mobileaudit=1. import.meta.env.DEV-gated so it
    // can never run in a production build. Removed entirely, along with
    // the createDemoSeed import above, before this audit is done.
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('__mobileaudit')) {
      const seed = createDemoSeed();
      setData({ activeCompanyId: seed.company.id, companies: { [seed.company.id]: seed } });
      setUser({ id: '00000000-0000-0000-0000-000000000000', email: 'audit@local.dev', user_metadata: { first_name: 'Audit' } });
      setIsLoggedIn(true);
      setIsLoadingAuth(false);
      setShowLanding(false);
      return;
    }

    // Failsafe: never hang forever on loading screen
    const loadingTimeout = setTimeout(() => {
      setIsLoadingAuth(false);
    }, 5000);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) {
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
        setIsLoggedIn(false);
        setShowOnboarding(false);
      } else if (event === 'SIGNED_IN') {
        fetchUserData(session.user);
      }
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserData = async (authUser) => {
    try {
      if (!supabaseEnabled) {
        const cached = loadData();
        setData(cached);
        setHasCompletedOnboarding(localStorage.getItem('bokix_onboarding_completed') === 'true');
        setHasSkippedOnboarding(localStorage.getItem('bokix_onboarding_skipped') === 'true');
        setIsLoggedIn(true);
        setIsLoadingAuth(false);
        return;
      }

      const { data: dbData, error } = await supabase
        .from('user_data')
        .select('state,onboarding_completed,onboarding_skipped,company_name,company_orgnr,contact_details,company_settings')
        .eq('user_id', authUser.id)
        .maybeSingle();

      let resultData = dbData;
      if (error) {
        if (isSupabaseUnavailableError(error)) {
          setSupabaseEnabled(false);
          const cached = loadData();
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
          const cached = loadData();
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
        const resolvedState = backendState || resultData.state;
        setData(resolvedState);
        const completed = Boolean(resultData.onboarding_completed);
        const skipped = Boolean(resultData.onboarding_skipped);
        setHasCompletedOnboarding(completed);
        setHasSkippedOnboarding(skipped);
        localStorage.setItem('bokix_onboarding_completed', String(completed));
        localStorage.setItem('bokix_onboarding_skipped', String(skipped));
        await syncCompanyDataToBackend(resolvedState.activeCompanyId, resolvedState);
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
    saveData(data);

    const timeoutIds = [];

    if (data?.activeCompanyId) {
      timeoutIds.push(setTimeout(() => {
        syncCompanyDataToBackend(data.activeCompanyId, data);
      }, 600));
    }

    // Sync to Supabase debounced — this is the actual persistence path;
    // it must always run for a logged-in user, independent of the
    // (currently no-op) per-company sync above.
    if (user && isLoggedIn) {
      timeoutIds.push(setTimeout(() => {
        saveUserDataToSupabase(data);
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
      setIsGlobalPlusOpen(false);
      setIsProfileMenuOpen(false);
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
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', background: '#f8fafc', fontFamily: 'sans-serif' }}>
        <div style={{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTopColor: '#3d7a2e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <div style={{ color: '#64748b', fontSize: '15px' }}>Laddar Bokix…</div>
      </div>
    );
  }

  // Current company data
  const currentCompany = data.companies[data.activeCompanyId];
  const company = currentCompany.company;
  const accounts = currentCompany.accounts;
  const verifications = currentCompany.verifications;
  const invoices = currentCompany.invoices;
  const expenses = currentCompany.expenses;
  const contacts = currentCompany.contacts;
  const projects = currentCompany.projects || [];
  const verificationTemplates = currentCompany.verificationTemplates || [];
  const vatPeriods = currentCompany.vatPeriods || {};
  const reviewHistory = currentCompany.reviewHistory || [];
  const employees = currentCompany.employees || [];
  const payrollRuns = currentCompany.payrollRuns || [];
  const timeEntries = currentCompany.timeEntries || [];
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
  const setExpenses = (fn) => updateCompanyField('expenses', fn);
  const setContacts = (fn) => updateCompanyField('contacts', fn);
  const setProjects = (fn) => updateCompanyField('projects', fn);
  const setEmployees = (fn) => updateCompanyField('employees', fn);
  const setPayrollRuns = (fn) => updateCompanyField('payrollRuns', fn);
  const setTimeEntries = (fn) => updateCompanyField('timeEntries', fn);
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
  const platformFeePercent = Number.parseFloat(import.meta.env.VITE_STRIPE_PLATFORM_FEE_PERCENT || '5');

  // Klassiskt Stripe Connect OAuth ("Standard"-konton) — knappen navigerar
  // rakt till backend-endpointen istället för att göra ett fetch-anrop,
  // eftersom hela poängen är att lämna Bokix och landa på Stripes egen
  // hostade sida. Backend sköter state-generering, cookie och själva
  // redirecten (se api/stripe/oauth-start.js). Om kontot redan är
  // anslutet gör vi ingenting här — Dashboard-kortet visar då "Koppla
  // från" istället för den här knappen, se handleDisconnectStripe.
  const handleOpenStripeOnboarding = () => {
    if (!user) {
      alert('Logga in för att ansluta Stripe.');
      return;
    }
    if (company.stripeAccountId) return; // redan anslutet — inget att göra
    const params = new URLSearchParams({ user_id: user.id, company_id: data.activeCompanyId });
    window.location.href = `/api/stripe/oauth-start?${params.toString()}`;
  };

  const handleDisconnectStripe = async () => {
    if (!company.stripeAccountId) return;
    if (!window.confirm('Koppla från Stripe? Bokix kan då inte längre ta emot kortbetalningar till det här kontot.')) return;

    try {
      const response = await fetch('/api/stripe/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, company_id: data.activeCompanyId, stripe_account_id: company.stripeAccountId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || `Frånkoppling misslyckades (${response.status})`);
      setCompanyInfo({ ...company, stripeAccountId: '' });
    } catch (error) {
      console.error(error);
      alert(`Kunde inte koppla från Stripe: ${error.message || error}`);
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
    const result = await getEmailDomainStatus(company.resendDomainId);
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
  // själv avgör hur ett fel ska visas. Delad av två helt olika flöden:
  // dels "skapa betalningslänk"-ikonen i fakturalistan (som sedan navigerar
  // dit, se handleCreateInvoicePaymentLink), dels e-postutskicket
  // (Invoices.jsx handleSendEmail), som lägger länken i mejlet till kunden
  // istället för att lämna appen — att navigera avsändarens egen webbläsare
  // till Stripes kassasida vore fel där, det är ju inte avsändaren som ska
  // betala.
  const getInvoicePaymentLinkUrl = async (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Fakturan kunde inte hittas.');
    if (!company.stripeAccountId) throw new Error('Stripe är inte anslutet.');

    const customer = contacts.find(c => c.id === invoice.customerId);
    const customerEmail = customer?.email || company.email;
    if (!customerEmail) throw new Error('Kundens e-postadress saknas.');

    const line_items = invoice.rows
      .filter(r => r.description && r.unitPrice > 0)
      .map(r => ({
        price_data: {
          currency: 'sek',
          product_data: { name: r.description },
          unit_amount: Math.round((r.unitPrice || 0) * 100),
        },
        quantity: Math.max(1, Math.round(r.qty || 1)),
      }));

    if (line_items.length === 0) throw new Error('Fakturan saknar giltiga rader.');

    const totalGross = line_items.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
    const applicationFeeAmount = Math.round(totalGross * (platformFeePercent / 100));

    const { session } = await createStripeCheckoutSession({
      stripe_account_id: company.stripeAccountId,
      customer_email: customerEmail,
      application_fee_amount: applicationFeeAmount,
      line_items,
      // Klarna (och andra köp-nu-betala-senare-metoder) stödjer inte B2B enligt
      // Stripes/Klarnas egna regler — skickar med kundtypen så backend kan
      // avgöra om Klarna m.fl. får erbjudas, eller om det måste vara kort
      // (se create-checkout-session.js). "se_individual" är den enda
      // privatperson-varianten i customerType, se Contacts.jsx.
      customer_type: customer?.customerType,
      // Sätts som Stripe-sessionens metadata (create-checkout-session.js) —
      // enda kopplingen webhooken (webhook.js/server.js) har mellan en
      // bekräftad Stripe-betalning och VILKEN Bokix-faktura den gäller.
      user_id: user?.id,
      company_id: data.activeCompanyId,
      invoice_id: invoiceId,
    });

    if (!session?.url) throw new Error('Betalningslänk skapad, men ingen länk mottogs.');
    return session.url;
  };

  const handleCreateInvoicePaymentLink = async (invoiceId) => {
    try {
      const url = await getInvoicePaymentLinkUrl(invoiceId);
      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'sent' } : i));
      window.location.href = url;
    } catch (error) {
      console.error(error);
      alert(`Kunde inte skapa betalningslänk: ${error.message || error}`);
    }
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
    const inv = { ...invoice, id: `inv_${Date.now()}`, type: invType };
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

  const handleConvertQuoteToInvoice = (quoteId) => {
    const quote = invoices.find(i => i.id === quoteId);
    if (!quote) return;

    const invoiceNumbers = invoices
      .filter(i => i.type !== 'quote')
      .map(i => Number.parseInt(i.invoiceNumber, 10))
      .filter(Number.isFinite);
    const nextNum = invoiceNumbers.length > 0
      ? String(Math.max(...invoiceNumbers) + 1)
      : '1001';

    const updatedInvoice = {
      ...quote,
      type: 'invoice',
      status: 'draft',
      date: new Date().toISOString().split('T')[0],
      invoiceNumber: nextNum,
    };

    setInvoices(prev => prev.map(i => i.id === quoteId ? updatedInvoice : i));

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
  const handleMarkRunPaid = (runId, paymentMethod = 'bank') => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes('paid')) return r;
      return { ...r, completedSteps: [...r.completedSteps, 'paid'], paymentMethod };
    }));
  };

  // End of logic

  // Import/export (for settings)
  const handleImportData = (importedData) => {
    if (importedData.accounts) updateCompanyField('accounts', importedData.accounts);
    if (importedData.verifications) updateCompanyField('verifications', importedData.verifications);
    if (importedData.invoices) updateCompanyField('invoices', importedData.invoices);
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

  // ── Navigation config (flat) ──
  const navSections = [
    {
      label: 'Arbetsyta',
      items: [
        { id: 'dashboard', label: 'Dashboard',           icon: LayoutDashboard },
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
            verifications={verifications}
            expenses={expenses}
            onAdd={handleAddInvoice}
            onMarkPaid={handleMarkInvoicePaid}
            onRegisterPayment={handleRegisterInvoicePayment}
            onUnmarkPaid={handleUnmarkInvoicePaid}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            handleGlobalAction={handleGlobalAction}
            onCreatePaymentLink={handleCreateInvoicePaymentLink}
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
            onAddSupplierInvoice={handleAddSupplierInvoice}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onFixExpenseAccount={handleFixExpenseAccount}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            onNavigate={handleNavTabChange}
          />
        );
      case 'quotes':
        return <Quotes key={company?.id || data.activeCompanyId} invoices={invoices} setInvoices={setInvoices} contacts={contacts} company={company} globalAction={globalAction} clearGlobalAction={() => setGlobalAction(null)} handleGlobalAction={handleGlobalAction} />;
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
            company={company}
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
            expenses={expenses}
            contacts={contacts}
            projects={projects}
            onImport={handleImportData}
            onReset={handleResetData}
            stripeAccountId={company.stripeAccountId}
            onConnectStripe={handleOpenStripeOnboarding}
            onDisconnectStripe={handleDisconnectStripe}
            onConnectEmailDomain={handleConnectEmailDomain}
            onCheckEmailDomainStatus={handleCheckEmailDomainStatus}
            onDisconnectEmailDomain={handleDisconnectEmailDomain}
            user={user}
            companyList={companyList}
            activeCompanyId={data.activeCompanyId}
            onSwitchCompany={handleSwitchCompany}
            onAddCompany={() => setNewCompanyModal(true)}
          />
        );
      default:
        return <Dashboard {...commonProps} invoices={invoices} expenses={expenses} contacts={contacts} setActiveTab={setActiveTab} company={company} />;
    }
  };

  return (
    <>
    <Routes>
      <Route
        path="/"
        element={
          <>
            {!isLoggedIn ? (
              showLanding 
                ? <LandingPage onEnterApp={() => setShowLanding(false)} />
                : <Auth onLogin={handleLogin} onBackToLanding={() => setShowLanding(true)} />
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
        {/* Logo */}
        <div className="logo-container">
          <BokixLogo />
        </div>

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
            <div className="topbar-search">
              <Search size={16} className="topbar-search-icon" />
              <input type="text" id="global-search" name="global-search" placeholder="Sök verifikation, faktura, konto eller kund..." aria-label="Sök verifikation, faktura, konto eller kund" className="topbar-search-input" />
            </div>
          </div>

          <div className="desktop-topbar-right">
            <button
              className="btn btn-outline"
              style={{ fontSize: '13px', padding: '6px 14px', borderRadius: '8px', marginRight: '8px' }}
              onClick={() => handleGlobalAction('new_verification', 'verifications')}
            >
              <Plus size={14} /> Ny verifikation
            </button>
            
            <button className="topbar-icon-btn" title="Hjälp & support">
              <HelpCircle size={18} />
            </button>
            <button className="topbar-icon-btn" title="Mörkt läge">
              <Moon size={18} />
            </button>
            <div style={{ position: 'relative' }}>
              <button className="topbar-icon-btn" title="Notiser">
                <Bell size={18} />
              </button>
              {notificationCount > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {notificationCount}
                </span>
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
                <ChevronDown size={14} style={{ color: '#64748b' }} />
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
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><Moon size={14} /> Byt tema</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { handleNavTabChange('accounts'); setIsProfileMenuOpen(false); }}><FolderTree size={14} /> Kontoplaner</button>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><FileCheck size={14} /> Viktiga datum</button>
                  <button onClick={() => { handleNavTabChange('taxes_yearend'); setIsProfileMenuOpen(false); }}><Shield size={14} /> Bokslut & årsredovisning</button>
                  <button onClick={() => { handleNavTabChange('taxes_vat'); setIsProfileMenuOpen(false); }}><Calculator size={14} /> Momsredovisning</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><AlertTriangle size={14} /> Rapportera fel</button>
                  <button onClick={() => { setIsHelpDrawerOpen(true); setIsProfileMenuOpen(false); }}><HelpCircle size={14} /> Hjälp & support</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><UsersRound size={14} /> Lägg till företag</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={async () => {
                    await supabase.auth.signOut();
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
            <span className="topbar-page-title">{activeNavLabel}</span>
          </div>
          <div className="global-actions">
            <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button
                className="btn btn-primary global-plus-btn"
                onClick={() => setIsGlobalPlusOpen(!isGlobalPlusOpen)}
                aria-label="Skapa nytt"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="main-content-inner">
          {renderContent()}
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
      <HelpDrawer isOpen={isHelpDrawerOpen} onClose={() => setIsHelpDrawerOpen(false)} />

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
          }
        />
        {/* Sitemap (Sida 29) — varje marknadssida en egen riktig route/URL,
            inte ett skroll-ankare på startsidan. Loggan i MarketingLayout
            går alltid till "/" oavsett vilken av dessa man står på. */}
        <Route path="/funktioner" element={<FeaturesPage />} />
        <Route path="/priser" element={<PricingPage />} />
        <Route path="/om-oss" element={<AboutPage />} />
        <Route path="/kontakt" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsPolicy />} />
        {/* GDPR-innehållet är nu fullt inbakat i den utökade Integritetspolicyn
            (avsnitt 6, "Dina rättigheter") — en egen tunnare GDPR-sida skulle
            bara bli en sämre, lätt-att-glömma-uppdatera dubblett. */}
        <Route path="/gdpr" element={<Navigate to="/privacy" replace />} />
        <Route path="/cookies" element={<CookiesPolicy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    {/* Monterad utanför <Routes> så den syns på alla sidor (marknadsföring
        OCH inloggad app), Sida 37. */}
    <CookieBanner />
    </>
  );
}

export default App;
