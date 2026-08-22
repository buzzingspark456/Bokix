import React, { useMemo, useState } from 'react';
import { Menu, X, HelpCircle, LogOut, Bell } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark, useMarketingTheme } from './marketing/MarketingLayout';
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
  // Kundönskemål: headern ska vara sidomeny-färgad bara i mörkt läge, vit
  // i ljust läge — samma villkor som riktiga appens .desktop-top-bar
  // (index.css :root[data-theme="dark"]), men den regeln kan inte träffa
  // HÄR eftersom headerraderna nedan är inline-stylade, inte CSS-klasser.
  const [theme] = useMarketingTheme();
  const seed = useMemo(() => createDemoSeed(), []);
  // Samma underlag/beräkning som riktiga appens `reviewCount` (App.jsx) —
  // kvitton/leverantörsfakturor utan kontering. Kundfeedback: demot ska se
  // ut och kännas exakt som riktiga dashboardet, inklusive den gröna
  // Granskning-badgen i sidomenyn, inte en förenklad variant utan den.
  const reviewCount = seed.expenses.filter(e => !e.costAccount).length;
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
    <div className="lp-demo-card" style={{ background: 'var(--bg-card)', borderRadius: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      <div className="lp-demo-body">
      {/* Mobil topbar — bara synlig under 640px, samma mönster som riktiga
          appens .global-top-bar. Hamburgaren öppnar en nedfälld meny med
          samma sektioner som skrivbordssidomenyn, så alla funktioner går
          att nå på mobil också, inte bara Startsida. */}
      <div className="lp-demo-mobile-topbar" style={{ alignItems: 'center', gap: '12px', padding: '0 16px', height: '52px', background: theme === 'dark' ? 'var(--bg-sidebar)' : 'var(--bg-card)', borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border)', flexShrink: 0, position: 'relative' }}>
        <button onClick={() => setMobileMenuOpen(o => !o)} style={{ background: 'none', border: 'none', padding: 0, display: 'flex', cursor: 'pointer' }} aria-label="Meny">
          {mobileMenuOpen
            ? <X size={19} color={theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)'} />
            : <Menu size={19} color={theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)'} />}
        </button>
        <span style={{ fontSize: '14px', fontWeight: 600, color: theme === 'dark' ? '#ffffff' : 'var(--text-main)' }}>
          {[...SIDEBAR_GROUPS[0], ...SIDEBAR_GROUPS[1], ...SIDEBAR_GROUPS[2]].find(i => i.id === activeDemoTab)?.label || 'Dashboard'}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '9.5px', fontWeight: 700, color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Exempeldata</span>

        {mobileMenuOpen && (
          <div style={{ position: 'absolute', top: '52px', left: 0, right: 0, background: 'var(--bg-sidebar)', padding: '8px 0', zIndex: 10, maxHeight: '60vh', overflowY: 'auto', boxShadow: '0 12px 24px rgba(0,0,0,0.18)' }}>
            {SIDEBAR_GROUPS.map((group, gi) => (
              <React.Fragment key={gi}>
                {gi > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 20px' }} />}
                {group.map(item => {
                  const isActive = activeDemoTab === item.id;
                  const badge = item.id === 'review' ? reviewCount : 0;
                  return (
                    <button key={item.id} onClick={() => openTab(item.id)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                      width: '100%', textAlign: 'left', padding: '13px 24px', border: 'none',
                      fontSize: '15px', fontWeight: isActive ? 700 : 500, cursor: 'pointer', fontFamily: 'inherit',
                      color: isActive ? '#ffffff' : 'rgba(255,255,255,0.88)',
                      background: isActive ? 'rgba(255,255,255,0.14)' : 'none',
                    }}>
                      <span>{item.label}</span>
                      {badge > 0 && (
                        <span style={{ minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px', background: '#22c55e', color: 'white', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Skrivbordssidomeny — samma innehåll/ordning som riktiga appens
          sidomeny (App.jsx navSections), nu med riktiga klick istället för
          statisk text. */}
      {/* Samma proportioner/mått som riktiga appens <aside className="sidebar">
          (App.jsx): logo-block med padding '22px 14px 18px', tunn
          gruppavdelare, navrader padding '13px 24px' i fullbredd (inte en
          rundad pill i en paddad kolumn) med samma vita-genomskinliga
          aktiv-bakgrund och samma Granskning-badge — kundfeedback: demot ska
          se ut och kännas som riktiga dashboardet, inte en förenklad
          miniatyr av det. */}
      <div className="lp-hide-mobile" style={{ width: '212px', flexShrink: 0, background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 14px 18px' }}>
          <BokixWordmark height={62} />
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 20px 8px', flexShrink: 0 }} />

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0, flexShrink: 0 }}>
          {SIDEBAR_GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '8px 20px', flexShrink: 0 }} />}
              {group.map(item => {
                const isActive = activeDemoTab === item.id;
                const badge = item.id === 'review' ? reviewCount : 0;
                return (
                  <button key={item.id} onClick={() => openTab(item.id)} style={{
                    padding: '13px 24px', width: '100%', textAlign: 'left', background: isActive ? 'rgba(255,255,255,0.14)' : 'none',
                    border: 'none', color: isActive ? '#ffffff' : 'rgba(255,255,255,0.88)', fontSize: '15px', fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0, fontFamily: 'inherit',
                  }}>
                    <span>{item.label}</span>
                    {badge > 0 && (
                      <span style={{ minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '999px', background: '#22c55e', color: 'white', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </React.Fragment>
          ))}
        </nav>

        {/* Flexibelt tomt utrymme, precis som riktiga sidomenyn (App.jsx) —
            trycker Hjälp/Logga ut längst ner oavsett hur hög panelen är. */}
        <div style={{ flex: 1 }} />

        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
          <button onClick={blocked} style={{ padding: '13px 24px', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '15px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit' }}>
            <HelpCircle size={17} /> Hjälp och support
          </button>
          <button onClick={blocked} style={{ padding: '13px 24px', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#fca5a5', fontSize: '15px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit' }}>
            <LogOut size={17} /> Logga ut
          </button>
        </div>
      </div>

      {/* Höger kolumn — topbar + innehåll, samma uppdelning som riktiga
          appens <main className="main-wrapper"> (App.jsx): sidomenyn upptar
          HELA kortets höjd (inklusive raden där topbaren ligger, precis som
          i appen), och bara den här kolumnen har sin egen "desktop-top-bar"
          ovanför innehållet. Wrappern själv har INTE `lp-hide-mobile` — bara
          desktop-topbaren i den har det — annars skulle .lp-demo-content
          (som ska synas på mobil också, se mobiltopbaren ovan) försvinna
          med den på mobil. */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Skrivbords-header — samma ikonrad som riktiga appens .desktop-top-bar
            (Hjälp/Notiser/Avatar), tidigare helt saknad här så demot gick rakt
            från kortets kant in i sidomenyn. Ikonerna går till samma delade
            `blocked()`-förklaring som resten av demots skrivåtgärder — ingen
            låtsas-panel som ser klickbar ut men inte är det. Göms på mobil
            (`lp-hide-mobile`) där .lp-demo-mobile-topbar redan täcker samma
            roll. "Exempeldata"-märket sitter kvar HÄR (och i mobil-topbaren
            ovan) som ett vanligt flex-barn.
            Kundfeedback: bakgrunden matchar sidomenyn (bg-sidebar) bara i
            mörkt läge, precis som riktiga appens .desktop-top-bar/
            .global-top-bar (index.css :root[data-theme="dark"]) — i ljust
            läge är sidomenyn den mättade gröna märkesfärgen, en helgrön
            header hade varit för mycket. Kan inte uttryckas i CSS här
            (inline-stylat, ingen klass) — därför `theme`-villkoret istället,
            se useMarketingTheme-importen.
            Kundfeedback: headern ska INTE ligga fast (som en sticky rad)
            när man skrollar — samma som riktiga appens .desktop-top-bar
            (index.css). Flyttad HÄR IN i .lp-demo-content (den skrollande
            ytan) som dess första barn, istället för att stå som en egen
            fast rad ovanför den — nu skrollar den bort med resten av
            innehållet precis som i appen. */}
        <div className="lp-demo-content">
          <div className="lp-hide-mobile" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '0 20px', height: '52px', margin: '-20px -20px 20px', background: theme === 'dark' ? 'var(--bg-sidebar)' : 'var(--bg-card)', borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border)', flexShrink: 0 }}>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: theme === 'dark' ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Exempeldata</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={blocked} title="Hjälp & support" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)' }}>
                <HelpCircle size={18} />
              </button>
              <div style={{ position: 'relative' }}>
                <button onClick={blocked} title="Notiser" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '8px', background: 'none', border: 'none', cursor: 'pointer', color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)' }}>
                  <Bell size={18} />
                </button>
                <span style={{ position: 'absolute', top: 3, right: 3, width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={blocked} title="Profil">
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: BRAND.green, color: 'white', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, letterSpacing: '-0.02em' }}>
                  {(seed.company?.name || 'E').charAt(0).toUpperCase()}
                </div>
              </div>
            </div>
          </div>

          {/* Innehåll — samma riktiga komponent som fliken visar i appen. */}
          {renderContent()}
        </div>
      </div>
      </div>
    </div>
  );
}
