import { seriesForSource, getNextNumber as getNextVerificationNumber } from '../utils/verificationNumbering';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import useFitLevel from '../utils/useFitLevel';
import {
  Menu, X, HelpCircle, LogOut, Bell, Sun, Moon, ChevronDown, ChevronRight, FolderTree, FileCheck, Shield, Calculator, AlertTriangle, UsersRound, Receipt, FileText,
  LayoutDashboard, Users, Package, NavHomeIcon, NavQuotesIcon, NavInvoicesIcon, Inbox, NavReceiptsIcon, Briefcase, ClipboardCheck, BookOpen, Landmark, BarChart3,
  Settings as SettingsIcon,
} from './icons';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark, useMarketingTheme } from './marketing/MarketingLayout';
import { createDemoSeed } from '../utils/landingDemoData';
import { getDebet, getKredit } from '../utils/verificationAmounts';
import { grossInvoiceAmount } from '../utils/reportCalculations';

import Dashboard from './Dashboard';
import Contacts from './Contacts';
import Articles from './Articles';
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
// show_dashboard_greeting: false — samma riktiga inställning en användare
// själv kan slå av (Inställningar → Min profil, Dashboard.jsx:s
// showGreeting), inte en egen demo-särlösning. Kundönskemål: hälsningen
// ("God eftermiddag, Exempel 👋" — "Exempel" kommer av att ingen `user`
// någonsin skickades till <Dashboard> här, den föll tillbaka på
// företagsnamnet "Exempel AB") gjorde att demot kändes påtagligt falskt
// jämfört med en riktig inloggning.
const demoUser = { id: 'demo-user', email: 'du@bokix.se', user_metadata: { first_name: 'Du', last_name: '', show_dashboard_greeting: false } };

// Samma grupper, ordning, namn och ikoner som riktiga appens sidomeny (App.jsx):
// Start och Granskning överst, sedan Verksamhet, Ekonomi, Rapporter och
// Administration. Granskning syns bara när något väntar (se visibleGroups nedan).
const SIDEBAR_GROUPS = [
  { items: [
    { id: 'dashboard', label: 'Start', icon: LayoutDashboard },
    { id: 'review', label: 'Granskning', icon: ClipboardCheck },
  ] },
  { title: 'Verksamhet', items: [
    { id: 'contacts', label: 'Kunder', icon: Users },
    { id: 'articles', label: 'Artiklar', icon: Package },
    { id: 'quotes', label: 'Offerter', icon: NavQuotesIcon },
    { id: 'invoices', label: 'Kundfakturor', icon: NavInvoicesIcon },
  ] },
  { title: 'Ekonomi', items: [
    { id: 'expenses', label: 'Kvitton', icon: NavReceiptsIcon },
    { id: 'supplier_invoices', label: 'Leverantörsfakturor', icon: Inbox },
    { id: 'bank', label: 'Bank', icon: Landmark },
    { id: 'verifications', label: 'Bokföring', icon: BookOpen },
  ] },
  { title: 'Rapporter', items: [
    { id: 'reports', label: 'Rapport och analys', icon: BarChart3 },
    { id: 'taxes', label: 'Skatt och bokslut', icon: Shield },
  ] },
  { title: 'Administration', items: [
    { id: 'projects', label: 'Projekt', icon: Briefcase },
    { id: 'payroll', label: 'Anställda och lön', icon: UsersRound },
    { id: 'settings', label: 'Inställningar', icon: SettingsIcon },
  ] },
];

// Mobilens bottennav (samma fyra som App.jsx:s mobileNavItems: Hem med ett hus,
// Bokföring, Kvitton i mitten, Rapport) + "Meny" som öppnar en panel med resten,
// uppdelad i samma grupper som sidomenyn, utan det som redan finns i bottenraden.
const MOBILE_BOTTOM_ITEMS = [
  { id: 'dashboard', label: 'Hem', icon: NavHomeIcon },
  { id: 'verifications', label: 'Bokföring', icon: BookOpen },
  { id: 'expenses', label: 'Kvitton', icon: NavReceiptsIcon },
  { id: 'reports', label: 'Rapport', icon: BarChart3 },
];
const MOBILE_BOTTOM_IDS = MOBILE_BOTTOM_ITEMS.map(i => i.id);
const MOBILE_SHEET_SECTIONS = SIDEBAR_GROUPS
  .filter(g => g.title)
  .map(g => ({ ...g, items: g.items.filter(i => !MOBILE_BOTTOM_IDS.includes(i.id)) }))
  .filter(g => g.items.length > 0);

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
  // Demons sidomeny krymper själv tills alla sidor och Hjälp/Logga ut syns (se useFitLevel.js).
  const demoNavRef = useRef(null);
  const navFit = useFitLevel(demoNavRef, 4);
  const fitStyle = [
    { pad: 7, font: 14, icon: 17, logo: 40, foot: 9 },
    { pad: 4.5, font: 13.5, icon: 16, logo: 32, foot: 7 },
    { pad: 3, font: 13, icon: 15, logo: 26, foot: 5 },
    { pad: 1.5, font: 12.5, icon: 14, logo: 22, foot: 4 },
    { pad: 0.5, font: 12, icon: 13, logo: 16, foot: 2 },
  ][navFit];
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
  // Mobilens "Meny"-bottensheet (Sida 26 i riktiga appen) — ersätter den
  // gamla hamburgermeny-nedfällningen, se motiveringen vid SIDEBAR_GROUPS/
  // MOBILE_BOTTOM_ITEMS ovan.
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
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
  // Bara för Kvitton → OCR-uppladdning (Sida: "Kvitton läser sig själva"-
  // knappen på startsidan öppnar demot direkt här): ett uppladdat kvitto
  // måste faktiskt hamna i listan, annars öppnas aldrig detaljvyn som kör
  // OCR-läsningen (Expenses.jsx:s autoOpenUrl-effekt letar upp kvittot i
  // just den här arrayen via receiptUrl — med `expenses={seed.expenses}`
  // och `onAdd={blocked}` fanns det aldrig något att hitta, så OCR:n
  // syntes aldrig, bara "det här är bara en demo"-varningen). Rent lokalt
  // state precis som settingsCompany ovan — påverkar aldrig seed-datan
  // eller någon backend. Det som fortfarande är blockerat är att faktiskt
  // BOKFÖRA kvittot (onSaveReceiptDetails), inte att ladda upp och se
  // OCR:n läsa det.
  const [demoExpenses, setDemoExpenses] = useState(() => seed.expenses);
  // Kunder, fakturor, offerter, artiklar, projekt, tid, verifikationer och
  // anställda, också rent lokalt: det man lägger upp ska synas i listan
  // (videoguiderna på /guider visar just de flödena). Försvinner när demon
  // stängs. Betalningar, lönekörningar och allt som går mot en bank eller
  // Skatteverket är fortfarande blocked().
  const [demoContacts, setDemoContacts] = useState(() => seed.contacts);
  const [demoInvoices, setDemoInvoices] = useState(() => seed.invoices);
  const [demoQuotes, setDemoQuotes] = useState(() => seed.quotes);
  const [demoArticles, setDemoArticles] = useState(() => seed.articles);
  const [demoProjects, setDemoProjects] = useState(() => seed.projects);
  const [demoTimeEntries, setDemoTimeEntries] = useState(() => seed.timeEntries);
  const [demoVerifications, setDemoVerifications] = useState(() => seed.verifications);
  const [demoEmployees, setDemoEmployees] = useState(() => seed.employees);
  // Momsdeklarationen kan bokföras och markeras som inlämnad i demon (bara
  // perioden noteras, ingen verifikation skapas). Inlämnad-markeringen
  // hamnar i settingsCompany.taxFilings, precis som i appen.
  const [demoVatPeriods, setDemoVatPeriods] = useState(() => seed.vatPeriods);
  const bookDemoVatPeriod = ({ periodKey, periodStart, periodEnd, quarter, year, rounded }) => {
    setDemoVatPeriods(prev => (prev[periodKey] ? prev : {
      ...prev,
      [periodKey]: { periodStart, periodEnd, quarter, year, bookedAt: new Date().toISOString(), netToPay: rounded.netToPay },
    }));
  };
  // Samma numrering som App.jsx:s handleAddVerification, utan dess
  // bokföringssidoeffekter.
  const addDemoVerification = (ver) => {
    // Samma serie och numrering som den riktiga bokföringen (App.jsx).
    const series = ver.series || seriesForSource(ver.source);
    setDemoVerifications(prev => [...prev, { ...ver, series, id: `ver_demo_${Date.now()}_${prev.length}`, number: ver.number || getNextVerificationNumber(prev, series) }]);
  };
  const saveDemoEmployee = (employeeId, data) => {
    setDemoEmployees(prev => employeeId
      ? prev.map(e => e.id === employeeId ? { ...e, ...data } : e)
      : [...prev, { ...data, id: `emp_demo_${Date.now()}` }]);
  };
  // Betalningar på kundfakturor, också lokalt (videoguiden "Registrera
  // betalning"). Samma fält som App.jsx sätter, utan verifikationen.
  const today = () => new Date().toISOString().split('T')[0];
  const markDemoInvoicePaid = (invoiceId) => {
    setDemoInvoices(prev => prev.map(i => i.id === invoiceId
      ? { ...i, status: 'paid', paidDate: today(), paidAmount: grossInvoiceAmount(i) }
      : i));
  };
  const registerDemoInvoicePayment = (invoiceId, amount, date) => {
    setDemoInvoices(prev => prev.map(i => {
      if (i.id !== invoiceId) return i;
      const paidAmount = (i.paidAmount || 0) + Number(amount || 0);
      const full = paidAmount >= grossInvoiceAmount(i) - 0.005;
      return { ...i, paidAmount, status: full ? 'paid' : i.status, paidDate: full ? (date || today()) : i.paidDate };
    }));
  };
  // Demoföretaget visas med Stripe kopplat, så att "Betala nu"-valet syns
  // när man skickar en faktura. Ingen riktig länk skapas (null), och
  // själva utskicket kräver inloggning precis som förut.
  const invoiceCompany = useMemo(() => ({ ...seed.company, stripeAccountId: 'acct_demo' }), [seed.company]);
  const addDemoInvoice = (invoice) => {
    setDemoInvoices(prev => [...prev, {
      ...invoice,
      id: `inv_demo_${Date.now()}`,
      type: invoice.type || 'invoice',
      createdAt: new Date().toISOString(),
    }]);
  };

  const balances = useMemo(() => {
    const b = {};
    seed.accounts.forEach(a => { b[a.code] = 0; });
    demoVerifications.forEach(v => {
      if ((v.status || 'booked') === 'draft') return;
      v.rows.forEach(r => {
        const val = getDebet(r) - getKredit(r);
        b[r.account] = (b[r.account] || 0) + val;
      });
    });
    return b;
  }, [seed.accounts, demoVerifications]);

  const clearGlobalAction = () => setGlobalAction(null);
  // Navigation (och en formulär-prefill via globalAction) är inte
  // "att spara data" — det får fortsätta fungera på riktigt även på de
  // annars låsta flikarna, så "Ny leverantörsfaktura"-knappen i Fakturering
  // t.ex. fortfarande öppnar rätt flik/formulär.
  const handleGlobalAction = (action, tab) => {
    setActiveDemoTab(tab);
    setGlobalAction(action);
    setMobileSheetOpen(false);
  };
  const openTab = (id) => { setActiveDemoTab(id); setMobileSheetOpen(false); };
  // "Meny"-knappen lyser grönt även när man nått en sheet-sida via en länk
  // inifrån en annan flik, inte bara via sheeten själv — samma
  // isMobileSheetItemActive-logik som App.jsx.
  const mobileSheetActive = activeDemoTab === 'review' || MOBILE_SHEET_SECTIONS.some(sec => sec.items.some(item => item.id === activeDemoTab));
  // Som i appen: Granskning syns bara när något väntar (eller när man står på sidan).
  const visibleGroups = SIDEBAR_GROUPS
    .map(g => ({ ...g, items: g.items.filter(i => i.id !== 'review' || reviewCount > 0 || activeDemoTab === 'review') }))
    .filter(g => g.items.length > 0);

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
            verifications={demoVerifications} balances={balances} accounts={seed.accounts}
            invoices={demoInvoices} expenses={seed.expenses} contacts={demoContacts}
            setActiveTab={openTab} company={seed.company} profileIncomplete={false}
            onResumeOnboarding={() => openTab('dashboard')}
            vatPeriods={demoVatPeriods} payrollRuns={seed.payrollRuns}
            user={demoUser}
          />
        );
      case 'contacts':
        return <Contacts contacts={demoContacts} setContacts={setDemoContacts} accounts={seed.accounts} globalAction={globalAction} clearGlobalAction={clearGlobalAction} />;
      case 'articles':
        return <Articles articles={demoArticles} setArticles={setDemoArticles} accounts={seed.accounts} />;
      case 'quotes':
        return (
          <Quotes
            quotes={demoQuotes} setQuotes={setDemoQuotes} onConvert={blocked}
            contacts={demoContacts} projects={demoProjects}
            company={settingsCompany} user={demoUser}
            globalAction={globalAction} clearGlobalAction={clearGlobalAction}
          />
        );
      case 'invoices':
        return (
          <Invoices
            invoices={demoInvoices} contacts={demoContacts} verifications={demoVerifications} expenses={seed.expenses}
            onAdd={addDemoInvoice} onMarkPaid={markDemoInvoicePaid} onRegisterPayment={registerDemoInvoicePayment}
            onUnmarkPaid={blocked} onMarkSupplierInvoicePaid={blocked}
            handleGlobalAction={handleGlobalAction} onGetPaymentLinkUrl={async () => null}
            stripeAccountId={undefined} setInvoices={setDemoInvoices} company={invoiceCompany}
            globalAction={globalAction} clearGlobalAction={clearGlobalAction} onNavigate={openTab}
          />
        );
      case 'supplier_invoices':
        return (
          <SupplierInvoices
            expenses={seed.expenses} accounts={seed.accounts} contacts={demoContacts} setContacts={noop}
            projects={demoProjects} user={demoUser}
            onAddSupplierInvoice={blocked} onMarkSupplierInvoicePaid={blocked} onUnmarkSupplierInvoicePaid={blocked}
            onFixExpenseAccount={blocked} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
            onNavigate={openTab} uploadFn={demoUploadFn}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={demoExpenses} accounts={seed.accounts} verifications={demoVerifications} projects={demoProjects}
            user={demoUser}
            onAdd={(expense) => setDemoExpenses(prev => [...prev, { ...expense, id: `demo_${Date.now()}` }])}
            onFixExpenseAccount={blocked}
            onSaveReceiptDetails={blocked} onDeleteExpense={blocked} onReverseExpense={blocked}
            pageTitle="Kvitton" uploadFn={demoUploadFn}
          />
        );
      case 'projects':
        return (
          <Projects
            projects={demoProjects} setProjects={setDemoProjects} contacts={demoContacts} setContacts={noop}
            timeEntries={demoTimeEntries} setTimeEntries={setDemoTimeEntries} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
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
            invoices={demoInvoices} expenses={seed.expenses} contacts={demoContacts}
            accounts={seed.accounts} verifications={demoVerifications} vatPeriods={demoVatPeriods}
            onSetBankTransactions={noop} onUpdateCompany={noop}
            onRegisterInvoicePayment={blocked} onMarkSupplierInvoicePaid={blocked} onAddVerification={blocked}
          />
        );
      case 'verifications':
        return (
          <Verifications
            user={demoUser} verifications={demoVerifications} accounts={seed.accounts} balances={balances}
            contacts={demoContacts} projects={demoProjects} templates={seed.verificationTemplates}
            onSaveTemplate={blocked} onAdd={addDemoVerification}
            setVerifications={setDemoVerifications} setAccounts={noop} vatPeriods={demoVatPeriods}
            highlightVerificationId={null} onClearHighlight={noop} uploadFn={demoUploadFn}
          />
        );
      case 'payroll':
        return (
          <Payroll
            company={seed.company} employees={demoEmployees} onSaveEmployee={saveDemoEmployee}
            accounts={seed.accounts} projects={demoProjects} payrollRuns={seed.payrollRuns}
            onCreateRun={blocked} onUpdateRunRow={noop} onAdvanceRunStep={blocked}
            onBookRun={blocked} onMarkRunPaid={blocked} onRefreshRunSnapshots={noop}
          />
        );
      case 'taxes':
        return (
          <Taxes
            company={settingsCompany} verifications={demoVerifications} invoices={demoInvoices} expenses={seed.expenses}
            accounts={seed.accounts} payrollRuns={seed.payrollRuns} vatPeriods={demoVatPeriods}
            onBookVatPeriod={bookDemoVatPeriod} onNavigateToVerification={() => openTab('verifications')}
            onAddVerification={blocked} setCompanyInfo={setSettingsCompany} onNavigateToTab={openTab}
          />
        );
      case 'reports':
        return (
          <Reports
            accounts={seed.accounts} verifications={demoVerifications} invoices={demoInvoices}
            payrollRuns={seed.payrollRuns} contacts={demoContacts}
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
          appens .global-top-bar: ingen hamburgermeny, bara loggan och en
          tema-knapp. All navigering sker i bottenfältet nedan (samma
          "Fortnox-jämförelsen" som App.jsx:s egen kommentar vid
          mobileNavItems — två menyer för samma sak, en uppe och en nere,
          förvirrade tidigare). */}
      <div className="lp-demo-mobile-topbar" style={{ alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '0 16px', height: '52px', background: theme === 'dark' ? 'var(--bg-sidebar)' : 'var(--bg-card)', borderBottom: theme === 'dark' ? '1px solid rgba(255,255,255,0.15)' : '1px solid var(--border)', flexShrink: 0 }}>
        <BokixWordmark height={26} />
        <button className="topbar-icon-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'} style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.9)' : 'var(--text-secondary)' }}>
          {theme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}
        </button>
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
      {/* Som appen (index.css, .sidebar): mörkare meny i ljust läge. */}
      <div className="lp-hide-mobile" style={{ width: '212px', flexShrink: 0, maxHeight: 'min(780px, 82vh)', background: 'var(--bg-sidebar)', backgroundImage: theme === 'dark' ? 'none' : 'linear-gradient(rgba(0, 0, 0, 0.22), rgba(0, 0, 0, 0.22))', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
        <div style={{ padding: navFit >= 4 ? '3px 14px 2px' : navFit > 0 ? '6px 14px 4px' : '14px 14px 10px', flexShrink: 0 }}>
          <BokixWordmark height={fitStyle.logo} />
        </div>
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '0 20px 4px', flexShrink: 0 }} />

        {/* Kompaktare än riktiga appens rader så att alla 15 sidor ryms i demokortet;
            listan skrollar (utan synligt fält) om kortet ändå är lågt. */}
        <nav className="lp-demo-nav" ref={demoNavRef} style={{ display: 'flex', flexDirection: 'column', padding: 0, marginBottom: '20px', flex: '0 1 auto', minHeight: 0, overflowY: 'auto' }}>
          {visibleGroups.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && navFit >= 2 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.15)', margin: '2px 20px', flexShrink: 0 }} />}
              {group.title && navFit < 2 && <div className="lp-demo-nav-title">{group.title}</div>}
              {group.items.map(item => {
                const isActive = activeDemoTab === item.id;
                const badge = item.id === 'review' ? reviewCount : 0;
                return (
                  <button key={item.id} onClick={() => openTab(item.id)} style={{
                    padding: `${fitStyle.pad}px 24px`, width: '100%', textAlign: 'left', background: isActive ? 'rgba(255,255,255,0.14)' : 'none',
                    border: 'none', color: isActive ? '#ffffff' : 'rgba(255,255,255,0.88)', fontSize: `${fitStyle.font}px`, fontWeight: isActive ? 700 : 500, lineHeight: 1.25,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0, fontFamily: 'inherit',
                    boxShadow: isActive ? 'inset 3px 0 0 #ffd23f' : 'none',
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                      <item.icon size={fitStyle.icon} strokeWidth={isActive ? 2.25 : 2} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.85, color: isActive ? '#ffd23f' : undefined }} />
                      <span>{item.label}</span>
                    </span>
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
        <div style={{ flex: 1, minHeight: 0 }} />

        <div style={{ flexShrink: 0, borderTop: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.16)' }}>
          <button onClick={blocked} style={{ padding: `${fitStyle.foot}px 24px`, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: `${fitStyle.font}px`, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit' }}>
            <HelpCircle size={17} /> Hjälp och support
          </button>
          <button onClick={blocked} style={{ padding: `${fitStyle.foot}px 24px`, width: '100%', textAlign: 'left', background: 'none', border: 'none', color: '#fca5a5', fontSize: `${fitStyle.font}px`, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontFamily: 'inherit' }}>
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

        {/* ── Mobil bottennav (Sida 26 i riktiga appen) — samma klasser/
            innehåll som App.jsx:s .mobile-bottom-nav, bara `position`
            omdefinierad (sticky i stället för fixed). Riktiga appen fyller
            hela viewporten så fixed pekar rätt av sig självt; demot är ett
            kort MITT PÅ en marknadssida (.lp-demo-content har dessutom
            ingen egen scroll på mobil längre, se kommentaren vid
            @media 640px i MarketingLayout.jsx — hela sidan skrollar i
            stället), så fixed hade fäst naven vid webbläsarens EGEN
            nederkant oavsett var kortet råkar stå på sidan. Sticky håller
            den kvar i sikte medan kortet skrollar förbi, och slutar göra
            det så fort kortet själv skrollat ur bild — exakt vad en
            "förhandsvisning av telefonen" faktiskt ska göra. Bara synlig
            under 640px, av samma skäl som mobiltopbaren (se .lp-hide-mobile
            i MarketingLayout.jsx: den KLASSEN appliceras inte här, den här
            naven har ingen desktop-motsvarighet att gömma bakom — index.css
            döljer .mobile-bottom-nav ovanför 768px på egen hand). */}
        <nav className="mobile-bottom-nav" style={{ position: 'sticky' }} aria-label="Mobilnavigation">
          <div className="mobile-bottom-nav-inner">
            {MOBILE_BOTTOM_ITEMS.map(item => (
              item.id === 'expenses' ? (
                <button
                  key={item.id}
                  className={`mobile-nav-btn mobile-nav-hero ${activeDemoTab === item.id ? 'active' : ''}`}
                  onClick={() => openTab(item.id)}
                  aria-label={item.label}
                >
                  <span className="mobile-nav-hero-circle"><item.icon size={20} strokeWidth={2} /></span>
                  <span>{item.label}</span>
                </button>
              ) : (
              <button
                key={item.id}
                className={`mobile-nav-btn ${activeDemoTab === item.id ? 'active' : ''}`}
                onClick={() => openTab(item.id)}
              >
                <span className="mobile-nav-icon"><item.icon size={22} /></span>
                <span>{item.label}</span>
              </button>
              )
            ))}
            <button
              className={`mobile-nav-btn ${mobileSheetActive ? 'active' : ''}`}
              onClick={() => setMobileSheetOpen(true)}
              aria-haspopup="true"
              aria-expanded={mobileSheetOpen}
            >
              <span className="mobile-nav-icon">
                <Menu size={22} />
                {reviewCount > 0 && <span className="mobile-nav-dot" aria-label={`${reviewCount} väntar på granskning`} />}
              </span>
              <span>Meny</span>
            </button>
          </div>
        </nav>

        <div className={`mobile-sheet-overlay ${mobileSheetOpen ? 'open' : ''}`} onClick={() => setMobileSheetOpen(false)} />
        <div className={`mobile-sheet ${mobileSheetOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="Fler sidor">
          <div className="mobile-sheet-handle" />
          <div className="mobile-sheet-title">
            <span>Meny</span>
            <button type="button" className="mobile-sheet-close" onClick={() => setMobileSheetOpen(false)} aria-label="Stäng menyn"><X size={18} /></button>
          </div>
          <div className="mobile-sheet-body">
            {reviewCount > 0 && (
              <button type="button" className={`mobile-sheet-review${activeDemoTab === 'review' ? ' active' : ''}`} onClick={() => openTab('review')}>
                <span className="mobile-sheet-row-icon"><ClipboardCheck size={20} /></span>
                <span className="mobile-sheet-review-text">
                  <span className="mobile-sheet-review-title">Granskning</span>
                  <span className="mobile-sheet-review-sub">{reviewCount} {reviewCount === 1 ? 'sak väntar' : 'saker väntar'} på dig</span>
                </span>
                <span className="mobile-sheet-review-badge">{reviewCount}</span>
              </button>
            )}
            {MOBILE_SHEET_SECTIONS.map(sec => (
              <div className="mobile-sheet-section" key={sec.title}>
                <div className="mobile-sheet-section-title">{sec.title}</div>
                <div className="mobile-sheet-list">
                  {sec.items.map(item => (
                    <button key={item.id} type="button" className={`mobile-sheet-row${activeDemoTab === item.id ? ' active' : ''}`} onClick={() => openTab(item.id)}>
                      <span className="mobile-sheet-row-icon"><item.icon size={20} /></span>
                      <span className="mobile-sheet-row-label">{item.label}</span>
                      <ChevronRight size={18} className="mobile-sheet-row-chevron" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {/* Hjälp/Logga ut — når man annars via sidomenyns fasta botten
                (bara synlig på skrivbord, se .lp-hide-mobile ovan). Utan de
                här två raderna fanns ingen väg dit alls på mobil. */}
            <div className="mobile-sheet-list">
              <button type="button" className="mobile-sheet-row" onClick={() => { blocked(); setMobileSheetOpen(false); }}>
                <span className="mobile-sheet-row-icon"><HelpCircle size={20} /></span>
                <span className="mobile-sheet-row-label">Hjälp och support</span>
              </button>
              <button type="button" className="mobile-sheet-row" onClick={() => { blocked(); setMobileSheetOpen(false); }}>
                <span className="mobile-sheet-row-icon"><LogOut size={20} /></span>
                <span className="mobile-sheet-row-label">Logga ut</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
