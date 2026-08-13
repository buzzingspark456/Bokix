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
  Check,
  X,
  Calculator,
  Clock,
  DollarSign,
  FileCheck,
  Search,
  Menu,
  MoreHorizontal,
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
  Landmark,
  LogOut,
  Moon,
  AlertTriangle,
  Inbox,
} from 'lucide-react';
import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './components/AccountsData';
import { createConnectedStripeAccount, createStripeAccountLink, createStripeCheckoutSession } from './stripeApi';
import { getDebet, getKredit } from './utils/verificationAmounts';

// ── Bokix Logo Component (light sidebar) ──
function BokixLogo() {
  return (
    <div style={{ padding: '18px 14px 12px', display: 'flex', flexDirection: 'column' }}>
      <svg viewBox="0 0 140 48" width="110" height="38" xmlns="http://www.w3.org/2000/svg">
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
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '-4px', paddingLeft: '4px', letterSpacing: '0.01em' }}>Bokföring, enkelt. Du växer.</span>
    </div>
  );
}
import Dashboard from './components/Dashboard';
import Invoices from './components/Invoices';
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
import Auth from './components/Auth';
import OnboardingFlow from './components/OnboardingFlow';
import { supabase } from './supabaseClient';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsPolicy from './components/TermsPolicy';
import GDPRPolicy from './components/GDPRPolicy';
import CookiesPolicy from './components/CookiesPolicy';
import ReviewQueue from './components/ReviewQueue';
import CompanySettings from './components/CompanySettings';
import HelpDrawer from './components/HelpDrawer';
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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
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
  const [isCompanySwitcherOpen, setIsCompanySwitcherOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({ sales: true, purchases: true, accounting: true, reports: true });
  const [isHelpDrawerOpen, setIsHelpDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setIsLoggedIn(false);
        setShowOnboarding(false);
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

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => {
      setIsGlobalPlusOpen(false);
      setIsProfileMenuOpen(false);
      setIsCompanySwitcherOpen(false);
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
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: '#64748b', fontSize: '18px', fontFamily: 'sans-serif' }}>Laddar... (Kontrollera att Supabase-nycklar är inlagda)</div>;
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

  const handleCreateStripeAccount = async () => {
    if (!user) {
      alert('Logga in för att ansluta Stripe.');
      return;
    }

    try {
      const { account } = await createConnectedStripeAccount({
        company_id: data.activeCompanyId,
        user_id: user.id,
        business_name: company.name,
      });

      setCompanyInfo({ ...company, stripeAccountId: account.id });
      alert('Stripe-konto skapat. Nu öppnas Stripe-onboarding.');

      const { accountLink } = await createStripeAccountLink({ account_id: account.id });
      if (accountLink?.url) {
        window.location.href = accountLink.url;
      } else {
        alert('Stripe-onboardinglänk kunde inte skapas.');
      }
    } catch (error) {
      console.error(error);
      alert(`Stripekonto kunde inte skapas: ${error.message || error}`);
    }
  };

  const handleOpenStripeOnboarding = async () => {
    if (!company.stripeAccountId) {
      return handleCreateStripeAccount();
    }

    try {
      const { accountLink } = await createStripeAccountLink({ account_id: company.stripeAccountId });
      if (accountLink?.url) {
        window.location.href = accountLink.url;
      } else {
        alert('Stripe-onboardinglänk kunde inte skapas.');
      }
    } catch (error) {
      console.error(error);
      alert(`Kunde inte öppna Stripe-onboarding: ${error.message || error}`);
    }
  };

  const handleCreateInvoicePaymentLink = async (invoiceId) => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) {
      alert('Fakturan kunde inte hittas.');
      return;
    }
    if (!company.stripeAccountId) {
      alert('Anslut Stripe för att kunna skapa betalningslänkar.');
      return;
    }

    const customer = contacts.find(c => c.id === invoice.customerId);
    const customerEmail = customer?.email || company.email;
    if (!customerEmail) {
      alert('Kundens e-postadress saknas. Lägg till e-post i kundkortet.');
      return;
    }

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

    if (line_items.length === 0) {
      alert('Fakturan saknar giltiga rader.');
      return;
    }

    const totalGross = line_items.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
    const applicationFeeAmount = Math.round(totalGross * (platformFeePercent / 100));

    try {
      const { session } = await createStripeCheckoutSession({
        stripe_account_id: company.stripeAccountId,
        customer_email: customerEmail,
        application_fee_amount: applicationFeeAmount,
        line_items,
      });

      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'sent' } : i));

      if (session?.url) {
        window.location.href = session.url;
      } else {
        alert('Betalningslänk skapad, men ingen länk mottogs.');
      }
    } catch (error) {
      console.error(error);
      alert(`Kunde inte skapa betalningslänk: ${error.message || error}`);
    }
  };

  // Add verification
  const handleAddVerification = (newVer) => {
    setVerifications(prev => {
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
  const handleAddExpense = (expense) => {
    const exp = { ...expense, id: `exp_${Date.now()}` };
    setExpenses(prev => [...prev, exp]);

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
  const handleMarkSupplierInvoicePaid = (expenseId) => {
    const inv = expenses.find(e => e.id === expenseId);
    if (!inv) return;
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'paid', paidDate: new Date().toISOString().split('T')[0] } : e));

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
        { id: 'dashboard', label: 'Startsida',           icon: LayoutDashboard },
        { id: 'invoices',  label: 'Fakturering',         icon: FileText },
        { id: 'contacts',  label: 'Kunder',              icon: Users },
        { id: 'expenses',  label: 'Kvitto och utgifter', icon: Receipt },
        { id: 'supplier_invoices', label: 'Leverantörsfakturor', icon: Inbox },
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

  // Mobile bottom nav (5 viktigaste)
  const mobileNavItems = [
    { id: 'dashboard', label: 'Hem',      icon: LayoutDashboard },
    { id: 'invoices',  label: 'Fakturor', icon: FileText },
    { id: 'expenses',  label: 'Utgifter', icon: Receipt },
    { id: 'contacts',  label: 'Kunder',   icon: Users },
    { id: 'settings',  label: 'Mer',      icon: MoreHorizontal },
  ];

  const companyList = Object.values(data.companies).map(c => c.company);

  // Active tab label for topbar
  const activeNavLabel = navItems.find(n => resolveTab(n.id) === resolveTab(activeTab))?.label || 'Hem';


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
            stripeAccountId={company.stripeAccountId}
            onConnectStripe={handleOpenStripeOnboarding}
          />
        );
      case 'time':
        return <TimeTracking key={company?.id || data.activeCompanyId} />;
      case 'payroll':
        return (
          <Payroll
            key={company?.id || data.activeCompanyId}
            employees={employees}
            onSaveEmployee={handleSaveEmployee}
            accounts={accounts}
            projects={projects}
            payrollRuns={payrollRuns}
            onCreateRun={handleCreateRun}
            onUpdateRunRow={handleUpdateRunRow}
            onAdvanceRunStep={handleAdvanceRunStep}
            onBookRun={handleBookRun}
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
      case 'revenue':
        return (
          <Invoices
            key={company?.id || data.activeCompanyId}
            invoices={invoices.filter(i => i.type !== 'quote')}
            contacts={contacts}
            onAdd={handleAddInvoice}
            onMarkPaid={handleMarkInvoicePaid}
            onCreatePaymentLink={handleCreateInvoicePaymentLink}
            stripeAccountId={company.stripeAccountId}
            setInvoices={setInvoices}
            onConvertQuote={handleConvertQuoteToInvoice}
            company={company}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            onNavigate={handleNavTabChange}
            pageTitle="Intäkter"
            pageSubtitle="Hantera intäkter, fakturor och betalningar"
          />
        );
      case 'invoices':
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
            contacts={contacts}
            setContacts={setContacts}
            onAdd={handleAddExpense}
            onAddSupplierInvoice={handleAddSupplierInvoice}
            onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onFixExpenseAccount={handleFixExpenseAccount}
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
            user={user}
            onAdd={handleAddExpense}
            onFixExpenseAccount={handleFixExpenseAccount}
            pageTitle="Kvitto och utgifter"
            pageSubtitle="Alla registrerade kvitton"
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
            onFixExpenseAccount={handleFixExpenseAccount}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
            onNavigate={handleNavTabChange}
          />
        );
      case 'quotes':
        return <Quotes key={company?.id || data.activeCompanyId} invoices={invoices} setInvoices={setInvoices} contacts={contacts} globalAction={globalAction} clearGlobalAction={() => setGlobalAction(null)} handleGlobalAction={handleGlobalAction} />;
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
            user={user}
          />
        );
      default:
        return <Dashboard {...commonProps} invoices={invoices} expenses={expenses} contacts={contacts} setActiveTab={setActiveTab} company={company} />;
    }
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            {!isLoggedIn ? (
              showLanding 
                ? <LandingPage onEnterApp={() => setShowLanding(false)} />
                : <Auth onLogin={handleLogin} />
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

        {/* Företagsväxlare */}
        <div style={{ padding: '0 12px 12px', position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            className="company-selector"
            onClick={() => setIsCompanySwitcherOpen(o => !o)}
            aria-expanded={isCompanySwitcherOpen}
          >
            <span className="company-avatar">{(company?.name || 'F').charAt(0).toUpperCase()}</span>
            <span className="company-info">
              <span className="company-name">{company?.name || 'Mitt Företag'}</span>
              <span className="company-org">{company?.orgNr || 'Inget org.nr'}</span>
            </span>
            <ChevronDown size={14} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0, transform: isCompanySwitcherOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>

          {isCompanySwitcherOpen && (
            <div className="company-dropdown">
              {companyList.map(c => (
                <button
                  key={c.id}
                  className={`company-dropdown-item ${c.id === data.activeCompanyId ? 'active' : ''}`}
                  onClick={() => { handleSwitchCompany(c.id); setIsCompanySwitcherOpen(false); }}
                >
                  {c.id === data.activeCompanyId ? <Check size={13} /> : <span style={{ width: 13 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                </button>
              ))}
              <div className="company-dropdown-divider"></div>
              <button className="company-dropdown-item" onClick={() => { setNewCompanyModal(true); setIsCompanySwitcherOpen(false); }}>
                <Plus size={13} /> Lägg till företag
              </button>
            </div>
          )}
        </div>

        {/* Huvudnavigering — tre grupper, ingen linje mellan rader inom en grupp,
            bara en tunn låg-kontrast linje mellan grupperna. */}
        <nav className="nav-links" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, flexShrink: 0 }}>
          {[
            {
              // Grupp 1 — det dagliga arbetet
              items: [
                { id: 'dashboard', label: 'Startsida' },
                { id: 'invoices', label: 'Fakturering' },
                { id: 'contacts', label: 'Kunder' },
                { id: 'expenses', label: 'Kvitto och utgifter' },
                { id: 'projects', label: 'Projekt' },
              ],
            },
            {
              // Grupp 2 — bokföring och administration
              items: [
                { id: 'review', label: 'Granskning', badge: reviewCount },
                { id: 'verifications', label: 'Bokföring' },
                { id: 'payroll', label: 'Anställda och lön' },
                { id: 'taxes', label: 'Skatt och bokslut' },
                { id: 'reports', label: 'Rapport och analys' },
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
                const isActive = resolveTab(activeTab) === resolveTab(item.id);
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
              <input type="text" placeholder="Sök verifikation, faktura, konto eller kund..." className="topbar-search-input" />
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
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg, #5ba85a, #3a8fc1)', color: 'white', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="mobile-bottom-nav" aria-label="Mobilnavigation">
        <div className="mobile-bottom-nav-inner">
          {mobileNavItems.map(item => (
            <button
              key={item.id}
              className={`mobile-nav-btn ${resolveTab(activeTab) === resolveTab(item.id) ? 'active' : ''}`}
              onClick={() => handleNavTabChange(item.id)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

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
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsPolicy />} />
        <Route path="/gdpr" element={<GDPRPolicy />} />
        <Route path="/cookies" element={<CookiesPolicy />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
  );
}

export default App;
