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
} from 'lucide-react';
import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './components/AccountsData';
import { createConnectedStripeAccount, createStripeAccountLink, createStripeCheckoutSession } from './stripeApi';

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
      <span style={{ fontSize: '11px', color: '#94a3b8', marginTop: '-4px', paddingLeft: '4px', letterSpacing: '0.01em' }}>Bokföring, enkelt. Du växer.</span>
    </div>
  );
}
import Dashboard from './components/Dashboard';
import Invoices from './components/Invoices';
import Expenses from './components/Expenses';
import Contacts from './components/Contacts';
import Bokforing from './components/Bokforing';
import Reports from './components/Reports';
import Settings from './components/Settings';
import Payroll from './components/Payroll';
import Taxes from './components/Taxes';
import Projects from './components/Projects';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import OnboardingFlow from './components/OnboardingFlow';
import { supabase } from './supabaseClient';
import { Routes, Route, Navigate } from 'react-router-dom';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsPolicy from './components/TermsPolicy';
import GDPRPolicy from './components/GDPRPolicy';
import CookiesPolicy from './components/CookiesPolicy';

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

// ──────────────────────────────────────────────
// APP COMPONENT
// ──────────────────────────────────────────────
function App() {
  const [data, setData] = useState(loadData);
  const [activeTab, setActiveTab] = useState('dashboard');
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
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Global intent state
  const [globalAction, setGlobalAction] = useState(null);
  const [isGlobalPlusOpen, setIsGlobalPlusOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [openMenus, setOpenMenus] = useState({ sales: true, purchases: true, accounting: true, reports: true });

  const toggleMenu = (menuId) => {
    setOpenMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const handleGlobalAction = (action, tab) => {
    setActiveTab(tab);
    setGlobalAction(action);
    setIsGlobalPlusOpen(false);
    setSidebarOpen(false);
  };

  // Close sidebar when tab changes on mobile
  const handleNavTabChange = (tabId) => {
    setActiveTab(tabId);
    setSidebarOpen(false);
  };

  // ── Helpers ──
  const updateCompanyField = useCallback((field, value) => {
    setData(prev => ({
      ...prev,
      companies: {
        ...prev.companies,
        [prev.activeCompanyId]: {
          ...prev.companies[prev.activeCompanyId],
          [field]: value,
        },
      },
    }));
  }, []);

  const saveUserDataToSupabase = async (stateData, extras = {}) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      state: stateData,
    };

    if (dbSupportsProfileColumns) {
      Object.assign(payload, extras);
    }

    const { error } = await supabase.from('user_data').upsert(payload);
    if (error) {
      const missingColumn = String(error.message || '').toLowerCase().includes('column');
      if (missingColumn && !dbSupportsProfileColumns) {
        await supabase.from('user_data').upsert({
          user_id: user.id,
          state: stateData,
        });
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
      const { data: dbData, error } = await supabase
        .from('user_data')
        .select('state,onboarding_completed,onboarding_skipped,company_name,company_orgnr,contact_details,company_settings')
        .eq('user_id', authUser.id)
        .single();

      let resultData = dbData;
      if (error) {
        const fallback = await supabase
          .from('user_data')
          .select('state')
          .eq('user_id', authUser.id)
          .single();

        if (fallback.error && fallback.error.code !== 'PGRST116') {
          console.error('Error fetching data:', fallback.error);
        }

        resultData = fallback.data;
      } else {
        setDbSupportsProfileColumns(true);
      }

      if (resultData && resultData.state) {
        setData(resultData.state);
        const completed = Boolean(resultData.onboarding_completed);
        const skipped = Boolean(resultData.onboarding_skipped);
        setHasCompletedOnboarding(completed);
        setHasSkippedOnboarding(skipped);
        localStorage.setItem('bokix_onboarding_completed', String(completed));
        localStorage.setItem('bokix_onboarding_skipped', String(skipped));
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
    
    // Sync to Supabase debounced
    if (user && isLoggedIn) {
      const timeoutId = setTimeout(() => {
        saveUserDataToSupabase(data);
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [data, user, isLoggedIn]);

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

  // ── Helpers ──
  const setAccounts = (fn) => {
    const newVal = typeof fn === 'function' ? fn(accounts) : fn;
    updateCompanyField('accounts', newVal);
  };

  const setVerifications = (fn) => {
    const newVal = typeof fn === 'function' ? fn(verifications) : fn;
    updateCompanyField('verifications', newVal);
  };

  const setInvoices = (fn) => {
    const newVal = typeof fn === 'function' ? fn(invoices) : fn;
    updateCompanyField('invoices', newVal);
  };

  const setExpenses = (fn) => {
    const newVal = typeof fn === 'function' ? fn(expenses) : fn;
    updateCompanyField('expenses', newVal);
  };

  const setContacts = (fn) => {
    const newVal = typeof fn === 'function' ? fn(contacts) : fn;
    updateCompanyField('contacts', newVal);
  };

  const setCompanyInfo = (fn) => {
    const newVal = typeof fn === 'function' ? fn(company) : fn;
    updateCompanyField('company', newVal);
  };

  // Calculate account balances
  const getAccountBalances = () => {
    const balances = {};
    accounts.forEach(acc => { balances[acc.code] = 0; });
    verifications.forEach(ver => {
      ver.rows.forEach(row => {
        const val = (row.debet || 0) - (row.kredit || 0);
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
      const nextNum = `V${prev.length + 1}`;
      return [...prev, { ...newVer, id: Date.now(), number: nextNum }];
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

  // Mark invoice paid
  const handleMarkInvoicePaid = (invoiceId) => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return;

    let totalGross = 0;
    inv.rows.forEach(r => {
      const lineNet = r.qty * r.unitPrice;
      totalGross += lineNet + lineNet * (r.vatRate / 100);
    });

    setInvoices(prev => prev.map(i =>
      i.id === invoiceId
        ? { ...i, status: 'paid', paidDate: new Date().toISOString().split('T')[0] }
        : i
    ));

    handleAddVerification({
      date: new Date().toISOString().split('T')[0],
      description: `Betalning faktura ${inv.invoiceNumber}`,
      source: 'invoice_payment',
      sourceId: invoiceId,
      rows: [
        { account: '1930', debet: Math.round(totalGross), kredit: 0 },
        { account: '1510', debet: 0, kredit: Math.round(totalGross) },
      ],
    });
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

  // End of logic

  // Import/export (for settings)
  const handleImportData = (importedData) => {
    if (importedData.accounts) updateCompanyField('accounts', importedData.accounts);
    if (importedData.verifications) updateCompanyField('verifications', importedData.verifications);
    if (importedData.invoices) updateCompanyField('invoices', importedData.invoices);
    if (importedData.expenses) updateCompanyField('expenses', importedData.expenses);
    if (importedData.contacts) updateCompanyField('contacts', importedData.contacts);
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
  const reviewCount = invoices.filter(i => i.status === 'draft').length;

  // ── Navigation config: 9 flat items, no group headers ──
  const navItems = [
    { id: 'dashboard',   label: 'Startsida',        icon: LayoutDashboard },
    { id: 'invoices',    label: 'Fakturering',       icon: FileText,   hint: 'inkl. offerter' },
    { id: 'contacts',    label: 'Kunder',            icon: Users },
    { id: 'expenses',    label: 'Kvitto & utgifter', icon: Receipt,    hint: 'inkl. leverantörsfakturor' },
    { id: 'accounting',  label: 'Bokföring',         icon: BookOpen,   hint: 'inkl. verifikationer, kontoplan', badge: reviewCount },
    { id: 'payroll',     label: 'Anställda och lön', icon: UsersRound },
    { id: 'projects',    label: 'Projekt',           icon: Briefcase,  hint: 'inkl. tidrapportering' },
    { id: 'taxes',       label: 'Skatt & bokslut',   icon: Shield },
    { id: 'reports',     label: 'Rapport & analys',  icon: BarChart3 },
    // separator before settings
    { id: 'settings',   label: 'Inställningar',     icon: SettingsIcon, hint: 'inkl. företag', separator: true },
  ];

  // No aliases needed — all IDs map directly to renderContent cases
  const resolveTab = (id) => id;

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
  const activeNavLabel = navItems.find(n => n.id === activeTab)?.label || 'Hem';


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
        return <Payroll key={company?.id || data.activeCompanyId} />;
      case 'taxes':
        return <Taxes key={company?.id || data.activeCompanyId} company={company} verifications={verifications} balances={balances} />;
      case 'invoices':
        return (
          <Invoices
            key={company?.id || data.activeCompanyId}
            invoices={invoices}
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
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={expenses}
            accounts={accounts}
            contacts={contacts}
            onAdd={handleAddExpense}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
          />
        );
      case 'contacts':
        return (
          <Contacts
            contacts={contacts}
            setContacts={setContacts}
            globalAction={globalAction}
            clearGlobalAction={() => setGlobalAction(null)}
          />
        );
      case 'verifications':
        return (
          <Verifications
            verifications={verifications}
            accounts={accounts}
            onAdd={handleAddVerification}
            setVerifications={setVerifications}
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
            balances={balances}
            accounts={accounts}
            verifications={verifications}
          />
        );
      case 'settings':
        return (
          <Settings
            activeTab={activeTab}
            company={company}
            setCompanyInfo={setCompanyInfo}
            accounts={accounts}
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            contacts={contacts}
            onImport={handleImportData}
            onReset={handleResetData}
            stripeAccountId={company.stripeAccountId}
            onConnectStripe={handleOpenStripeOnboarding}
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
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="logo-container">
          <BokixLogo />
        </div>

        {/* Company Selector */}
        <div style={{ position: 'relative', padding: '0 12px 12px' }} onClick={e => e.stopPropagation()}>
          <div className="company-selector">
            <div className="company-avatar">
              {company.name ? company.name.charAt(0).toUpperCase() : 'F'}
            </div>
            <div className="company-info">
              <span className="company-name">{company.name || 'Mitt Företag'}</span>
              <span className="company-org">{company.orgNr || 'Org.nr saknas'}</span>
            </div>
            <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          </div>
        </div>

        <nav className="nav-links" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
          {navItems.map((item) => {
            if (item.separator) {
              return (
                <React.Fragment key={item.id}>
                  <div style={{ height: '1px', background: '#e2e8f0', margin: '6px 12px' }} />
                  <button
                    className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                    onClick={() => handleNavTabChange(item.id)}
                    style={{ width: '100%' }}
                  >
                    <item.icon size={16} style={{ opacity: activeTab === item.id ? 1 : 0.6, flexShrink: 0 }} />
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: '13px' }}>{item.label}</div>
                      {item.hint && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{item.hint}</div>}
                    </div>
                    {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                  </button>
                </React.Fragment>
              );
            }
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => handleNavTabChange(item.id)}
                style={{ width: '100%' }}
              >
                <item.icon size={16} style={{ opacity: isActive ? 1 : 0.6, flexShrink: 0 }} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontSize: '13px' }}>{item.label}</div>
                  {item.hint && <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{item.hint}</div>}
                </div>
                {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer" style={{ borderTop: '1px solid #e2e8f0', padding: '6px 0' }}>
          <button
            className="nav-item bottom-btn logout-btn"
            onClick={async () => {
              await supabase.auth.signOut();
              setIsLoggedIn(false);
              setShowOnboarding(false);
            }}
            style={{ width: '100%', color: '#ef4444' }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13px' }}>Logga ut</span>
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
              <span style={{ position: 'absolute', top: 4, right: 4, width: 14, height: 14, backgroundColor: '#ef4444', color: 'white', borderRadius: '50%', fontSize: '9px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>1</span>
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
                  <button onClick={() => { setActiveTab('profile'); setIsProfileMenuOpen(false); }}><User size={14} /> Profil</button>
                  <button onClick={() => { setActiveTab('settings'); setIsProfileMenuOpen(false); }}><SettingsIcon size={14} /> Inställningar</button>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><Moon size={14} /> Byt tema</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setActiveTab('accounts'); setIsProfileMenuOpen(false); }}><FolderTree size={14} /> Kontoplaner</button>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><FileCheck size={14} /> Viktiga datum</button>
                  <button onClick={() => { setActiveTab('taxes_yearend'); setIsProfileMenuOpen(false); }}><Shield size={14} /> Bokslut & årsredovisning</button>
                  <button onClick={() => { setActiveTab('taxes_vat'); setIsProfileMenuOpen(false); }}><Calculator size={14} /> Momsredovisning</button>
                  <div className="dropdown-divider"></div>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><AlertTriangle size={14} /> Rapportera fel</button>
                  <button onClick={() => { setIsProfileMenuOpen(false); }}><HelpCircle size={14} /> Hjälp & support</button>
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
              onClick={() => setActiveTab(item.id)}
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



