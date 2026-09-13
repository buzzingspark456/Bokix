import React, { useEffect, useMemo, useState } from 'react';
import { Menu, X, HelpCircle, LogOut, Bell, Sun, Moon, ChevronDown, FolderTree, FileCheck, Shield, Calculator, AlertTriangle, UsersRound, Receipt, FileText } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark, useMarketingTheme } from './marketing/MarketingLayout';
import { createDemoSeed } from '../utils/landingDemoData';
import { getDebet, getKredit } from '../utils/verificationAmounts';

import Dashboard from './Dashboard';
import Contacts from './Contacts';
import Quotes from './Quotes';
import Invoices from './Invoices';
import SupplierInvoices from './SupplierInvoices';
import Expenses from './Expenses';
import Projects from './Projects';
import ReviewQueue from './ReviewQueue';
import Bank from './Bank';
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
    { id: 'quotes', label: 'Offerter' },
    { id: 'invoices', label: 'Fakturering' },
    { id: 'expenses', label: 'Kvitton' },
    { id: 'projects', label: 'Projekt' },
  ],
  [
    { id: 'review', label: 'Granskning' },
    { id: 'verifications', label: 'Bokföring' },
    { id: 'bank', label: 'Bank' },
    { id: 'payroll', label: 'Anställda och lön' },
    { id: 'reports', label: 'Rapport och analys' },
    { id: 'taxes', label: 'Skatt och bokslut' },
  ],
  [
    { id: 'settings', label: 'Inställningar' },
  ],
];

// `initialTab`: vilken flik demot öppnas på (Sida: "Kvitton läser sig
// själva"-sektionen på startsidan ska länka till en RIKTIG OCR-demo, inte
// bara en artikel). Standard 'dashboard' — oförändrat beteende för Hero-
// knappen "Se demo", som aldrig skickar med något värde.
export default function DemoWorkspace({ initialTab = 'dashboard' } = {}) {
  // Kundönskemål: headern ska vara sidomeny-färgad bara i mörkt läge, vit
  // i ljust läge — samma villkor som riktiga appens .desktop-top-bar
  // (index.css :root[data-theme="dark"]), men den regeln kan inte träffa
  // HÄR eftersom headerraderna nedan är inline-stylade, inte CSS-klasser.
  const [theme, toggleTheme] = useMarketingTheme();
  const seed = useMemo(() => createDemoSeed(), []);
  // Appen stänger sina topbar-menyer på klick utanför (document-lyssnare
  // i App.jsx). Samma sak här, annars blir en öppnad meny hängande kvar.
  useEffect(() => {
    const close = () => { setNotifOpen(false); setProfileOpen(false); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);
  // Samma underlag/beräkning som riktiga appens `reviewCount` (App.jsx) —
  // kvitton/leverantörsfakturor utan kontering. Kundfeedback: demot ska se
  // ut och kännas exakt som riktiga dashboardet, inklusive den gröna
  // Granskning-badgen i sidomenyn, inte en förenklad variant utan den.
  const reviewCount = seed.expenses.filter(e => !e.costAccount).length;
  // Samma uträkning som riktiga appens notificationCount (App.jsx):
  // granskningskön plus utgifter som ligger kvar i utkast/pending.
  const notificationCount = reviewCount + seed.expenses.filter(e => ['draft', 'pending'].includes(e.status)).length;
  // Samma tre notissorter som appen bygger (App.jsx: notifications) —
  // förfallna fakturor, kvitton i granskningskön, utgifter som ligger kvar
  // i utkast. Klick navigerar till samma flik som i appen.
  const demoNotifications = (() => {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = seed.invoices.filter(i => i.status === 'sent' && i.dueDate && i.dueDate < today);
    const drafts = seed.expenses.filter(e => ['draft', 'pending'].includes(e.status));
    return [
      ...(overdue.length > 0 ? [{ icon: AlertTriangle, tone: 'red', tab: 'invoices', text: overdue.length === 1 ? '1 faktura har förfallit' : `${overdue.length} fakturor har förfallit` }] : []),
      ...(reviewCount > 0 ? [{ icon: Receipt, tone: 'green', tab: 'review', text: `${reviewCount} kvitto${reviewCount > 1 ? 'n' : ''} väntar på granskning` }] : []),
      ...(drafts.length > 0 ? [{ icon: FileText, tone: 'amber', tab: 'expenses', text: `${drafts.length} utgift${drafts.length > 1 ? 'er' : ''} väntar på hantering` }] : []),
    ];
  })();
  const [activeDemoTab, setActiveDemoTab] = useState(initialTab);
  const [globalAction, setGlobalAction] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Notis- och profilmenyn öppnas på riktigt i demon (kundönskemål: man
  // ska kunna titta på dem). Ingen av raderna rör data — de navigerar,
  // byter tema, eller landar i blocked().
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
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
      case 'quotes':
        return (
          <Quotes
            quotes={seed.quotes} setQuotes={noop} onConvert={blocked}
            contacts={seed.contacts} projects={seed.projects}
            company={settingsCompany} user={demoUser}
            globalAction={globalAction} clearGlobalAction={clearGlobalAction}
          />
        );
      case 'invoices':
        return (
          <Invoices
            invoices={seed.invoices} contacts={seed.contacts} verifications={seed.verifications} expenses={seed.expenses}
            onAdd={blocked} onMarkPaid={blocked} onRegisterPayment={blocked}
            onUnmarkPaid={blocked} onMarkSupplierInvoicePaid={blocked}
            handleGlobalAction={handleGlobalAction} onGetPaymentLinkUrl={blocked}
            stripeAccountId={undefined} setInvoices={noop} company={seed.company}
            globalAction={globalAction} clearGlobalAction={clearGlobalAction} onNavigate={openTab}
          />
        );
      case 'supplier_invoices':
        return (
          <SupplierInvoices
            expenses={seed.expenses} accounts={seed.accounts} contacts={seed.contacts} setContacts={noop}
            projects={seed.projects} user={demoUser}
            onAddSupplierInvoice={blocked} onMarkSupplierInvoicePaid={blocked} onUnmarkSupplierInvoicePaid={blocked}
            onFixExpenseAccount={blocked} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
            onNavigate={openTab} uploadFn={demoUploadFn}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={seed.expenses} accounts={seed.accounts} verifications={seed.verifications} projects={seed.projects}
            user={demoUser} onAdd={blocked} onFixExpenseAccount={blocked}
            onSaveReceiptDetails={blocked} onDeleteExpense={blocked} onReverseExpense={blocked}
            pageTitle="Kvitton" pageSubtitle="Alla uppladdade kvitton" uploadFn={demoUploadFn}
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
        return (
          <ReviewQueue
            expenses={seed.expenses} accounts={seed.accounts} reviewHistory={seed.reviewHistory}
            onResolve={blocked} onAddVerification={blocked}
            user={demoUser} company={seed.company}
            // Stripe/Zettle-flikarna hämtar annars ur Supabase — här skickas
            // samma rader in direkt i stället (se demoStripeItems/
            // demoZettleItems i ReviewQueue).
            demoStripeItems={seed.stripeLedgerEvents}
            demoZettleItems={seed.zettleLedgerEvents}
          />
        );
      case 'bank':
        return (
          <Bank
            bankTransactions={seed.bankTransactions} bankImportProfiles={{}}
            invoices={seed.invoices} expenses={seed.expenses} contacts={seed.contacts}
            accounts={seed.accounts} verifications={seed.verifications} vatPeriods={seed.vatPeriods}
            onSetBankTransactions={noop} onUpdateCompany={noop}
            onRegisterInvoicePayment={blocked} onMarkSupplierInvoicePaid={blocked} onAddVerification={blocked}
          />
        );
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
        return (
          <Reports
            accounts={seed.accounts} verifications={seed.verifications} invoices={seed.invoices}
            payrollRuns={seed.payrollRuns} contacts={seed.contacts}
            company={settingsCompany} setCompanyInfo={setSettingsCompany}
            onNavigate={openTab}
          />
        );
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
      {/* borderRight: kundfeedback ("Visuell gräns meny/innehåll") — samma
          fix som riktiga appens .sidebar (index.css) fick, upprepad här
          eftersom demot är en egen handbyggd klon som inte delar den
          klassen. */}
      <div className="lp-hide-mobile" style={{ width: '212px', flexShrink: 0, background: 'var(--bg-sidebar)', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
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

        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: '18px', paddingTop: '6px' }}>
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
        <div className="lp-demo-content">
          {/* Skrivbords-header — appens EGNA klasser (.desktop-top-bar,
              .desktop-topbar-right, .topbar-icon-btn, .topbar-avatar,
              .topbar-profile-trigger i index.css), inte en handstylad kopia.
              En kopia i inline-style kan aldrig bli identisk: den missar
              allt som ligger i CSS:en (40px runda ikonknappar, 23px ikoner,
              hover-ytan, avatarens mått, och att baren krymper till sitt
              innehåll uppe till höger utan egen bakgrund). Klasserna träffar
              hit eftersom marknadssidans tema-hook sätter data-theme på
              <html> (MarketingLayout.jsx) — samma attribut index.css:s
              mörka läge lyssnar på.
              Visas BARA på Startsidan, precis som i appen (App.jsx:
              `{activeTab === 'dashboard' && …}`, ett uttryckligt önskemål
              där). Hjälp och Logga ut finns ändå överallt via sidomenyns
              fasta botten.
              Notis- och profilmenyn öppnas på riktigt och innehåller samma
              rader som appens — kundönskemål: man ska kunna titta på dem.
              Tema och navigering fungerar; allt som skulle RÖRA data
              (rapportera fel, lägg till företag, logga ut) går till samma
              delade `blocked()`-förklaring som resten av demot. */}
          {activeDemoTab === 'dashboard' && (
          <div className="desktop-top-bar lp-hide-mobile" style={{ marginBottom: '4px' }}>
            <div className="desktop-topbar-right">
              <button className="topbar-icon-btn" onClick={blocked} title="Hjälp & support">
                <HelpCircle size={23} />
              </button>
              <button className="topbar-icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}>
                {theme === 'dark' ? <Sun size={23} /> : <Moon size={23} />}
              </button>
              <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                <button className="topbar-icon-btn" onClick={() => { setNotifOpen(o => !o); setProfileOpen(false); }} title="Notiser">
                  <Bell size={23} />
                </button>
                {notificationCount > 0 && (
                  <span style={{ position: 'absolute', top: 3, right: 3, minWidth: 18, height: 18, padding: '0 4px', backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {notificationCount}
                  </span>
                )}
                {notifOpen && (
                  <div className="profile-dropdown notif-dropdown">
                    <div className="profile-header" style={{ paddingBottom: 4 }}>
                      <div className="profile-name">Notiser</div>
                    </div>
                    <div className="dropdown-divider"></div>
                    {demoNotifications.length === 0 ? (
                      <div style={{ padding: '18px 12px', textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>Inget nytt just nu</div>
                    ) : demoNotifications.map((n, i) => (
                      <button key={i} onClick={() => { openTab(n.tab); setNotifOpen(false); }}>
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
                <div className="topbar-profile-trigger" onClick={() => { setProfileOpen(o => !o); setNotifOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '4px', borderRadius: '8px' }}>
                  <div className="topbar-avatar" title={demoUser.email}>
                    {(seed.company?.name || demoUser.email || 'A').charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown size={18} style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.75)' : 'var(--text-secondary)' }} />
                </div>
                {profileOpen && (
                  <div className="profile-dropdown">
                    <div className="profile-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: BRAND.green, color: 'white', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {(seed.company?.name || 'A').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="profile-name">{seed.company?.name}</div>
                          <div className="profile-role">{demoUser.email}</div>
                        </div>
                      </div>
                    </div>
                    <div className="dropdown-divider"></div>
                    {/* Temaväljaren är borttagen här, precis som i appens
                        egen profilmeny (App.jsx) — den bor i topbaren. */}
                    {/* Kontoplanen ligger som en flik inuti Bokföring i demon,
                        precis som appens 'accounts' är en vy inom samma sida. */}
                    <button onClick={() => { openTab('verifications'); setProfileOpen(false); }}><FolderTree size={14} /> Kontoplaner</button>
                    <button onClick={() => { openTab('taxes'); setProfileOpen(false); }}><FileCheck size={14} /> Viktiga datum</button>
                    <button onClick={() => { openTab('taxes'); setProfileOpen(false); }}><Shield size={14} /> Bokslut &amp; årsredovisning</button>
                    <button onClick={() => { openTab('taxes'); setProfileOpen(false); }}><Calculator size={14} /> Momsredovisning</button>
                    <div className="dropdown-divider"></div>
                    <button onClick={() => { blocked(); setProfileOpen(false); }}><AlertTriangle size={14} /> Rapportera fel</button>
                    <button onClick={() => { blocked(); setProfileOpen(false); }}><HelpCircle size={14} /> Hjälp &amp; support</button>
                    <div className="dropdown-divider"></div>
                    <button onClick={() => { blocked(); setProfileOpen(false); }}><UsersRound size={14} /> Lägg till företag</button>
                    <div className="dropdown-divider"></div>
                    <button onClick={() => { blocked(); setProfileOpen(false); }} className="text-danger"><LogOut size={14} /> Logga ut</button>
                  </div>
                )}
              </div>
            </div>
          </div>
          )}

          {/* Innehåll — samma riktiga komponent som fliken visar i appen. */}
          {renderContent()}
        </div>
      </div>
      </div>
    </div>
  );
}
