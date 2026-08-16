import React, { useMemo, useState } from 'react';
import { Menu, X, HelpCircle, LogOut } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createDemoSeed } from '../utils/landingDemoData';
import { getDebet, getKredit } from '../utils/verificationAmounts';

import Dashboard from './Dashboard';
import Contacts from './Contacts';
import Invoices from './Invoices';
import SupplierInvoices from './SupplierInvoices';
import Expenses from './Expenses';
import Projects from './Projects';
import ReviewQueue from './ReviewQueue';
import Verifications from './Verifications';
import Payroll from './Payroll';
import Taxes from './Taxes';
import Reports from './Reports';
import Settings from './Settings';

// ── Interaktiv demo — samma RIKTIGA komponenter som inloggade användare ser.
//
// Alla flikar (Startsida, Kunder, Fakturering, Utgifter, Projekt, Granskning,
// Bokföring, Anställda och lön, Skatt och bokslut, Rapport och analys) visar
// samma konsekventa exempeldataset (src/utils/landingDemoData.js) — en
// besökare ska kunna se hur riktig, ifylld bokföring ser ut på varje sida,
// inte bara Startsidan. Skrivåtgärder (spara/lägg till/betala/bokför osv)
// går till en delad `blocked()`-funktion som visar en kort förklaring
// istället för att krascha (saknad handler) eller tyst låtsas lyckas —
// ingenting som skrivs i demon ska av misstag kunna tolkas som sparat.
// Inställningar går att klicka runt i på samma sätt (readOnly-prop stänger
// dessutom av dess enda mount-tids Supabase-anrop, se Settings.jsx).
const demoUser = { id: 'demo-user', email: 'du@bokix.se', user_metadata: { first_name: 'Du', last_name: '' } };

const SIDEBAR_GROUPS = [
  [
    { id: 'dashboard', label: 'Startsida' },
    { id: 'contacts', label: 'Kunder' },
    { id: 'invoices', label: 'Fakturering' },
    { id: 'expenses', label: 'Utgifter' },
    { id: 'projects', label: 'Projekt' },
  ],
  [
    { id: 'review', label: 'Granskning' },
    { id: 'verifications', label: 'Bokföring' },
    { id: 'payroll', label: 'Anställda och lön' },
    { id: 'taxes', label: 'Skatt och bokslut' },
    { id: 'reports', label: 'Rapport och analys' },
  ],
  [
    { id: 'settings', label: 'Inställningar' },
  ],
];

export default function DemoWorkspace() {
  const seed = useMemo(() => createDemoSeed(), []);
  const [activeDemoTab, setActiveDemoTab] = useState('dashboard');
  const [globalAction, setGlobalAction] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Bara för Inställningar → Fakturamall: val av mall/accentfärg/fottext
  // ska faktiskt gå att klicka igenom och se förhandsvisningen uppdateras
  // live, till skillnad från alla andra skrivåtgärder i demon. Rent lokalt
  // state, rör aldrig Startsidans exempeldata eller någon backend.
  const [settingsCompany, setSettingsCompany] = useState(seed.company);

  const balances = useMemo(() => {
    const b = {};
    seed.accounts.forEach(a => { b[a.code] = 0; });
    seed.verifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      v.rows.forEach(r => {
        const val = getDebet(r) - getKredit(r);
        b[r.account] = (b[r.account] || 0) + val;
      });
    });
    return b;
  }, [seed.accounts, seed.verifications]);

  const clearGlobalAction = () => setGlobalAction(null);
  // Navigation (och en formulär-prefill via globalAction) är inte
  // "att spara data" — det får fortsätta fungera på riktigt även på de
  // annars låsta flikarna, så "Ny leverantörsfaktura"-knappen i Fakturering
  // t.ex. fortfarande öppnar rätt flik/formulär.
  const handleGlobalAction = (action, tab) => {
    setActiveDemoTab(tab);
    setGlobalAction(action);
    setMobileMenuOpen(false);
  };
  const openTab = (id) => { setActiveDemoTab(id); setMobileMenuOpen(false); };

  // Enda platsen en skrivåtgärd (spara/lägg till/betala/bokför …) landar på
  // för alla flikar utom Startsida — gör ingenting utom att förklara varför,
  // istället för att antingen krascha (saknad handler) eller tyst låtsas
  // lyckas.
  const blocked = () => {
    window.alert('Det här är bara en demo — inget sparas. Skapa ett gratis konto för att göra det här på riktigt.');
    return null;
  };
  const noop = () => {};

  // Bugkritiskt: Expenses.jsx/Verifications.jsx laddar upp en fil TILL
  // uploadFn INNAN de anropar sin onAdd/onSaveTemplate-handler — även om
  // den senare är `blocked`, skulle uploadFn annars falla tillbaka på den
  // RIKTIGA Supabase Storage-uppladdningen (default-värdet i respektive
  // komponent) och göra ett skarpt anrop från en icke-inloggad besökare.
  // Måste alltid skickas in explicit här, oavsett att inget sparas sen.
  const demoUploadFn = (_userId, file) => Promise.resolve(URL.createObjectURL(file));

  const renderContent = () => {
    switch (activeDemoTab) {
      case 'dashboard':
        return (
          <Dashboard
            verifications={seed.verifications} balances={balances} accounts={seed.accounts}
            invoices={seed.invoices} expenses={seed.expenses} contacts={seed.contacts}
            setActiveTab={openTab} company={seed.company} profileIncomplete={false}
            onResumeOnboarding={() => openTab('dashboard')}
            vatPeriods={seed.vatPeriods} payrollRuns={seed.payrollRuns}
          />
        );
      case 'contacts':
        return <Contacts contacts={seed.contacts} setContacts={noop} accounts={seed.accounts} globalAction={globalAction} clearGlobalAction={clearGlobalAction} />;
      case 'invoices':
        return (
          <Invoices
            invoices={seed.invoices} contacts={seed.contacts} verifications={seed.verifications} expenses={seed.expenses}
            onAdd={blocked} onMarkPaid={blocked} onRegisterPayment={blocked}
            onUnmarkPaid={blocked} onMarkSupplierInvoicePaid={blocked}
            handleGlobalAction={handleGlobalAction} onCreatePaymentLink={blocked} onGetPaymentLinkUrl={blocked}
            stripeAccountId={undefined} setInvoices={noop} company={seed.company}
            globalAction={globalAction} clearGlobalAction={clearGlobalAction} onNavigate={openTab}
          />
        );
      case 'supplier_invoices':
        return (
          <SupplierInvoices
            expenses={seed.expenses} accounts={seed.accounts} contacts={seed.contacts} setContacts={noop}
            onAddSupplierInvoice={blocked} onMarkSupplierInvoicePaid={blocked}
            onFixExpenseAccount={blocked} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
            onNavigate={openTab}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={seed.expenses} accounts={seed.accounts} verifications={seed.verifications} projects={seed.projects}
            user={demoUser} onAdd={blocked} onFixExpenseAccount={blocked}
            onSaveReceiptDetails={blocked} onDeleteExpense={blocked} onReverseExpense={blocked}
            pageTitle="Utgifter" pageSubtitle="Alla registrerade utgifter" uploadFn={demoUploadFn}
          />
        );
      case 'projects':
        return (
          <Projects
            projects={seed.projects} setProjects={noop} contacts={seed.contacts} setContacts={noop}
            timeEntries={seed.timeEntries} setTimeEntries={noop} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
          />
        );
      case 'review':
        return <ReviewQueue expenses={seed.expenses} accounts={seed.accounts} reviewHistory={seed.reviewHistory} onResolve={blocked} />;
      case 'verifications':
        return (
          <Verifications
            user={demoUser} verifications={seed.verifications} accounts={seed.accounts} balances={balances}
            contacts={seed.contacts} projects={seed.projects} templates={seed.verificationTemplates}
            onSaveTemplate={blocked} onAdd={blocked}
            setVerifications={noop} setAccounts={noop} vatPeriods={seed.vatPeriods}
            highlightVerificationId={null} onClearHighlight={noop} uploadFn={demoUploadFn}
          />
        );
      case 'payroll':
        return (
          <Payroll
            company={seed.company} employees={seed.employees} onSaveEmployee={blocked}
            accounts={seed.accounts} projects={seed.projects} payrollRuns={seed.payrollRuns}
            onCreateRun={blocked} onUpdateRunRow={noop} onAdvanceRunStep={blocked}
            onBookRun={blocked} onMarkRunPaid={blocked} onRefreshRunSnapshots={noop}
          />
        );
      case 'taxes':
        return (
          <Taxes
            company={seed.company} verifications={seed.verifications} invoices={seed.invoices} expenses={seed.expenses}
            accounts={seed.accounts} payrollRuns={seed.payrollRuns} vatPeriods={seed.vatPeriods}
            onBookVatPeriod={blocked} onNavigateToVerification={() => openTab('verifications')}
            onAddVerification={blocked} setCompanyInfo={noop} onNavigateToTab={openTab}
          />
        );
      case 'reports':
        return <Reports accounts={seed.accounts} verifications={seed.verifications} company={seed.company} />;
      case 'settings':
        // Går att klicka runt i på riktigt — bläddra mellan Företag/
        // Betalning/Fakturamall/Användare och åtkomst/Prenumeration/Data,
        // och faktiskt byta fakturamall/accentfärg/logotyp och se
        // förhandsvisningen uppdateras (setCompanyInfo är lokalt state,
        // se settingsCompany ovan). Allt som skulle spara på riktigt eller
        // ladda upp/logga in mot Supabase (lösenord, 2FA, aktiva sessioner,
        // Stripe, e-postdomän, profilbild) är blockerat — `readOnly` stänger
        // av de ställena i Settings.jsx som annars gör ett riktigt anrop.
        return (
          <Settings
            readOnly company={settingsCompany} setCompanyInfo={setSettingsCompany} accounts={seed.accounts}
            verifications={[]} invoices={[]} expenses={[]} contacts={[]} projects={[]}
            onImport={blocked} onReset={blocked} stripeAccountId={undefined}
            onConnectStripe={blocked} onDisconnectStripe={blocked}
            onConnectEmailDomain={blocked} onCheckEmailDomainStatus={blocked} onDisconnectEmailDomain={blocked}
            user={demoUser} companyList={[]} activeCompanyId={undefined} onSwitchCompany={blocked} onAddCompany={blocked}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="lp-demo-card" style={{ background: 'white', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <span style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 2, fontSize: '10.5px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'white', padding: '4px 10px', borderRadius: '999px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>Exempeldata</span>

      {/* Mobil topbar — bara synlig under 640px, samma mönster som riktiga
          appens .global-top-bar. Hamburgaren öppnar en nedfälld meny med
          samma sektioner som skrivbordssidomenyn, så alla funktioner går
          att nå på mobil också, inte bara Startsida. */}
      <div className="lp-demo-mobile-topbar" style={{ alignItems: 'center', gap: '12px', padding: '0 16px', height: '52px', background: 'white', borderBottom: '1px solid #e5e7eb', flexShrink: 0, position: 'relative' }}>
        <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer' }} aria-label="Meny">
          {mobileMenuOpen ? <X size={19} color="#64748b" /> : <Menu size={19} color="#64748b" />}
        </button>
        <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>
          {[...SIDEBAR_GROUPS[0], ...SIDEBAR_GROUPS[1], ...SIDEBAR_GROUPS[2]].find(i => i.id === activeDemoTab)?.label || 'Dashboard'}
        </span>

        {mobileMenuOpen && (
          <div style={{ position: 'absolute', top: '52px', left: 0, right: 0, background: BRAND.green, padding: '10px 12px', zIndex: 10, maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 12px 24px rgba(0,0,0,0.18)' }}>
            {SIDEBAR_GROUPS.map((group, gi) => (
              <div key={gi} style={{ marginBottom: gi < 2 ? '8px' : 0, paddingBottom: gi < 2 ? '8px' : 0, borderBottom: gi < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
                {group.map(item => (
                  <button key={item.id} onClick={() => openTab(item.id)} style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: '8px', border: 'none',
                    fontSize: '13px', fontWeight: activeDemoTab === item.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                    color: activeDemoTab === item.id ? BRAND.greenDark : 'rgba(255,255,255,0.9)',
                    background: activeDemoTab === item.id ? BRAND.greenLight : 'transparent', marginBottom: '2px',
                  }}>
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skrivbordssidomeny — samma innehåll/ordning som riktiga appens
          sidomeny (App.jsx navSections), nu med riktiga klick istället för
          statisk text. */}
      <div className="lp-hide-mobile" style={{ width: '190px', flexShrink: 0, background: BRAND.green, padding: '20px 12px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: '22px', padding: '0 4px' }}>
          <BokixWordmark height={20} />
        </div>

        {SIDEBAR_GROUPS.map((group, gi) => (
          <div key={gi} style={{ marginBottom: gi < 2 ? '10px' : 0, paddingBottom: gi < 2 ? '10px' : 0, borderBottom: gi < 2 ? '1px solid rgba(255,255,255,0.15)' : 'none' }}>
            {group.map(item => (
              <button key={item.id} onClick={() => openTab(item.id)} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '8px', border: 'none',
                fontSize: '12px', fontWeight: activeDemoTab === item.id ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                color: activeDemoTab === item.id ? BRAND.greenDark : 'rgba(255,255,255,0.85)',
                background: activeDemoTab === item.id ? BRAND.greenLight : 'transparent', marginBottom: '2px',
              }}>
                {item.label}
              </button>
            ))}
          </div>
        ))}

        {/* Flexibelt tomt utrymme, precis som riktiga sidomenyn (App.jsx) —
            trycker Hjälp/Logga ut längst ner oavsett hur hög panelen är. */}
        <div style={{ flex: 1 }} />

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '10px', marginTop: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', fontSize: '12px', fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
            <HelpCircle size={14} /> Hjälp och support
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', fontSize: '12px', fontWeight: 500, color: '#fca5a5' }}>
            <LogOut size={14} /> Logga ut
          </div>
        </div>
      </div>

      {/* Innehåll — samma riktiga komponent som fliken visar i appen. Kapad
          höjd + egen scroll på skrivbordet (så kortet håller en stadig
          storlek mellan flikar) — men INTE på mobil, se .lp-demo-content i
          MarketingLayout.jsx. */}
      <div className="lp-demo-content">
        {renderContent()}
      </div>
    </div>
  );
}
