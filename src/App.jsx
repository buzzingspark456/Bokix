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
  Plus,
  Check,
  X,
  Calculator,
  Clock,
  DollarSign,
  FileCheck,
  Menu,
  MoreHorizontal,
} from 'lucide-react';
import { DEFAULT_ACCOUNTS, VAT_ACCOUNTS, REVENUE_ACCOUNTS } from './components/AccountsData';
import {
  DEMO_COMPANY,
  INITIAL_CONTACTS,
  INITIAL_INVOICES,
  INITIAL_EXPENSES,
  generateVerificationsFromData,
} from './components/InitialData';
import Dashboard from './components/Dashboard';
import Invoices from './components/Invoices';
import Expenses from './components/Expenses';
import Contacts from './components/Contacts';
import Verifications from './components/Verifications';
import Accounts from './components/Accounts';
import Reports from './components/Reports';
import Settings from './components/Settings';
import TimeTracking from './components/TimeTracking';
import Payroll from './components/Payroll';
import Taxes from './components/Taxes';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';

// ──────────────────────────────────────────────
// Default company data factory
// ──────────────────────────────────────────────
function createDefaultCompanyData(companyInfo) {
  const invoices = INITIAL_INVOICES;
  const expenses = INITIAL_EXPENSES;
  const verifications = generateVerificationsFromData(invoices, expenses);
  return {
    company: { ...DEMO_COMPANY, ...companyInfo },
    accounts: [...DEFAULT_ACCOUNTS],
    verifications,
    invoices,
    expenses,
    contacts: [...INITIAL_CONTACTS],
  };
}

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
      fSkatt: 'Innehar F-skattsedel',
      bankgiro: '',
      plusgiro: '',
      iban: '',
      bic: '',
      defaultVat: 25,
      fiscalYear: `${new Date().getFullYear()}-01-01`,
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

  // Migrate from old format or initialize
  const defaultData = createDefaultCompanyData({});
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

  // Global intent state
  const [globalAction, setGlobalAction] = useState(null);
  const [isGlobalPlusOpen, setIsGlobalPlusOpen] = useState(false);

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

  // Persist
  useEffect(() => {
    saveData(data);
  }, [data]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = () => {
      setIsGlobalPlusOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const handleLogin = (companyInfo, isNew) => {
    if (isNew) {
      const newData = createDefaultCompanyData(companyInfo);
      setData({
        activeCompanyId: newData.company.id,
        companies: { [newData.company.id]: newData },
      });
    }
    setIsLoggedIn(true);
  };

  // Current company data
  const currentCompany = data.companies[data.activeCompanyId];
  const company = currentCompany.company;
  const accounts = currentCompany.accounts;
  const verifications = currentCompany.verifications;
  const invoices = currentCompany.invoices;
  const expenses = currentCompany.expenses;
  const contacts = currentCompany.contacts;

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
    if (window.confirm('Är du säker på att du vill återställa all data till demonstrationsläget?')) {
      const defaultData = createDefaultCompanyData({ id: data.activeCompanyId });
      setData(prev => ({
        ...prev,
        companies: {
          ...prev.companies,
          [prev.activeCompanyId]: defaultData,
        },
      }));
    }
  };

  // ── Navigation config ──
  const navItems = [
    { id: 'dashboard', label: 'Översikt', icon: LayoutDashboard },
    { id: 'invoices', label: 'Fakturor & Offerter', icon: FileText },
    { id: 'contacts', label: 'Kunder', icon: Users },
    { id: 'expenses', label: 'Utgifter', icon: Receipt },
    { id: 'time', label: 'Tidrapportering', icon: Clock },
    { id: 'payroll', label: 'Löner', icon: DollarSign },
    { id: 'verifications', label: 'Verifikationer', icon: BookOpen },
    { id: 'accounts', label: 'Kontoplan', icon: FolderTree },
    { id: 'taxes', label: 'Skatt & Bokslut', icon: FileCheck },
    { id: 'reports', label: 'Rapporter', icon: BarChart3 },
    { id: 'settings', label: 'Inställningar', icon: SettingsIcon },
  ];

  // Mobile bottom nav (5 viktigaste)
  const mobileNavItems = [
    { id: 'dashboard', label: 'Översikt', icon: LayoutDashboard },
    { id: 'invoices', label: 'Fakturor', icon: FileText },
    { id: 'expenses', label: 'Utgifter', icon: Receipt },
    { id: 'contacts', label: 'Kunder', icon: Users },
    { id: 'settings', label: 'Mer', icon: MoreHorizontal },
  ];

  const companyList = Object.values(data.companies).map(c => c.company);

  // Active tab label for topbar
  const activeNavLabel = navItems.find(n => n.id === activeTab)?.label || 'Översikt';

  // ── Render content ──
  const renderContent = () => {
    const commonProps = {
      accounts, balances, verifications,
      globalAction, clearGlobalAction: () => setGlobalAction(null)
    };

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            {...commonProps}
            invoices={invoices}
            expenses={expenses}
            contacts={contacts}
            setActiveTab={setActiveTab}
            company={company}
          />
        );
      case 'time':
        return <TimeTracking />;
      case 'payroll':
        return <Payroll />;
      case 'taxes':
        return <Taxes verifications={verifications} balances={balances} />;
      case 'invoices':
        return (
          <Invoices
            invoices={invoices}
            contacts={contacts}
            onAdd={handleAddInvoice}
            onMarkPaid={handleMarkInvoicePaid}
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
            company={company}
            setCompanyInfo={setCompanyInfo}
            accounts={accounts}
            verifications={verifications}
            invoices={invoices}
            expenses={expenses}
            contacts={contacts}
            onImport={handleImportData}
            onReset={handleResetData}
          />
        );
      default:
        return <Dashboard {...commonProps} invoices={invoices} expenses={expenses} contacts={contacts} setActiveTab={setActiveTab} company={company} />;
    }
  };

  return (
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
        <div className="logo-container">
          <div className="logo-icon">B</div>
          <span className="logo-text">Bokföring.io</span>
        </div>

        {/* Company Selector */}
        <div style={{ position: 'relative', padding: '16px' }} onClick={e => e.stopPropagation()}>
          <div className="company-selector" style={{ cursor: 'default' }}>
            <div className="company-icon">
              {company.name ? company.name.charAt(0) : 'F'}
            </div>
            <div className="company-info">
              <span className="company-name">{company.name}</span>
              <span className="company-org">{company.orgNr || 'Org.nr saknas'}</span>
            </div>
          </div>
        </div>

        <nav className="nav-links">
          <div style={{ marginTop: '8px' }}>
            {navItems.map(item => (
              <button
                key={item.id}
                className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => handleNavTabChange(item.id)}
              >
                <item.icon size={18} style={{ opacity: activeTab === item.id ? 1 : 0.7 }} />
                <span style={{ fontSize: '13.5px', letterSpacing: '-0.01em' }}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

      </aside>

      {/* ── Main Content ── */}
      <main className="main-wrapper" key={activeTab}>

        {/* Global Top Bar */}
        <div className="global-top-bar">
          <div className="topbar-left">
            {/* Hamburger (mobil) */}
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
              {isGlobalPlusOpen && (
                <div className="global-plus-dropdown">
                  <button onClick={() => handleGlobalAction('new_invoice', 'invoices')}>📄 Ny faktura</button>
                  <button onClick={() => handleGlobalAction('new_quote', 'invoices')}>📋 Ny offert</button>
                  <button onClick={() => handleGlobalAction('new_expense', 'expenses')}>🧾 Ny utgift</button>
                  <button onClick={() => handleGlobalAction('new_contact', 'contacts')}>👤 Ny kund/lev</button>
                </div>
              )}
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
              className={`mobile-nav-btn ${activeTab === item.id ? 'active' : ''}`}
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
  );
}

export default App;
