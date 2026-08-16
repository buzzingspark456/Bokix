import React, { useMemo, useState } from 'react';
import { Menu, X, HelpCircle, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { BRAND } from '../utils/brandColors';
import { BokixWordmark } from './marketing/MarketingLayout';
import { createDemoSeed, bookInvoice, bookExpense } from '../utils/landingDemoData';
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

// ── Interaktiv demo — samma RIKTIGA komponenter som inloggade användare ser
// (Dashboard, Invoices, Contacts, Expenses, Projects, ReviewQueue,
// Verifications, Payroll, Taxes, Reports), monterade med ett lokalt
// exempeldataset (src/utils/landingDemoData.js) istället för en passiv
// pointerEvents:none-förhandsvisning. Går att klicka, skapa en faktura,
// betala ett kvitto, bokföra en lönekörning osv. — allt lever bara i
// komponentens eget React-state, ingen Supabase, återställs vid omladdning.
//
// Handlerlogiken nedan är medvetet en nästan ord-för-ord kopia av
// App.jsx:s motsvarande handlers (samma bokföringsformler, samma
// idempotens-spärrar) — App.jsx:s handlers rör ALDRIG Supabase direkt
// (bekräftat: bara setState), så det är säkert att återanvända dem här
// mot lokalt state istället för det riktiga apptillståndet.
//
// Två integrationer kopplas medvetet INTE till skarpa tjänster:
// Stripe-betalningslänkar (skulle kräva ett riktigt anslutet konto) och
// kvitto-/verifikationsbilagors filuppladdning (skulle annars försöka nå
// Supabase Storage från en icke-inloggad besökare) — se
// handleCreatePaymentLink/getPaymentLinkUrl och demoUploadFn nedan.

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

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function DemoWorkspace({ onEnterApp }) {
  const [seed, setSeed] = useState(() => createDemoSeed());
  const [activeDemoTab, setActiveDemoTab] = useState('dashboard');
  const [globalAction, setGlobalAction] = useState(null);
  const [highlightVerificationId, setHighlightVerificationId] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const updateField = (key) => (updaterOrValue) => {
    setSeed(prev => ({
      ...prev,
      [key]: typeof updaterOrValue === 'function' ? updaterOrValue(prev[key]) : updaterOrValue,
    }));
  };
  const setVerifications = updateField('verifications');
  const setInvoices = updateField('invoices');
  const setExpenses = updateField('expenses');
  const setContacts = updateField('contacts');
  const setProjects = updateField('projects');
  const setTimeEntries = updateField('timeEntries');
  const setEmployees = updateField('employees');
  const setPayrollRuns = updateField('payrollRuns');
  const setAccounts = updateField('accounts');
  const setCompanyInfo = updateField('company');
  const setVatPeriods = updateField('vatPeriods');
  const setReviewHistory = updateField('reviewHistory');
  const setVerificationTemplates = updateField('verificationTemplates');

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
  const handleGlobalAction = (action, tab) => {
    setActiveDemoTab(tab);
    setGlobalAction(action);
    setMobileMenuOpen(false);
  };

  const handleAddVerification = (newVer) => {
    setVerifications(prev => {
      if (newVer.id) {
        const idx = prev.findIndex(v => v.id === newVer.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...prev[idx], ...newVer };
          return updated;
        }
      }
      const number = newVer.number || `V${prev.length + 1}`;
      const id = `demo_${Date.now()}_${prev.length}`;
      return [...prev, { ...newVer, id, number }];
    });
  };

  const handleAddInvoice = (invoice) => {
    const invType = invoice.type || 'invoice';
    const inv = { ...invoice, id: `demo_inv_${Date.now()}`, type: invType };
    setInvoices(prev => [...prev, inv]);
    if (invType === 'quote') return;
    handleAddVerification(bookInvoice(inv));
  };

  const invoiceGross = (inv) => inv.rows.reduce((sum, r) => {
    const lineNet = r.qty * r.unitPrice;
    return sum + lineNet + lineNet * (r.vatRate / 100);
  }, 0);

  const handleRegisterInvoicePayment = (invoiceId, amount, date) => {
    const inv = seed.invoices.find(i => i.id === invoiceId);
    if (!inv || !amount || amount <= 0) return;
    const totalGross = invoiceGross(inv);
    const alreadyPaid = inv.paidAmount || 0;
    const remaining = Math.max(0, totalGross - alreadyPaid);
    const paymentAmount = Math.min(amount, remaining);
    if (paymentAmount <= 0) return;
    const newPaid = alreadyPaid + paymentAmount;
    const isFullyPaid = newPaid >= totalGross - 0.5;
    const paidDate = date || todayStr();
    setInvoices(prev => prev.map(i => i.id === invoiceId
      ? { ...i, paidAmount: newPaid, status: isFullyPaid ? 'paid' : i.status, paidDate: isFullyPaid ? paidDate : i.paidDate }
      : i));
    handleAddVerification({
      date: paidDate,
      description: alreadyPaid > 0 || !isFullyPaid ? `Delbetalning faktura ${inv.invoiceNumber}` : `Betalning faktura ${inv.invoiceNumber}`,
      source: 'invoice_payment', sourceId: invoiceId,
      rows: [
        { account: '1930', debet: Math.round(paymentAmount), kredit: 0 },
        { account: '1510', debet: 0, kredit: Math.round(paymentAmount) },
      ],
    });
  };

  const handleMarkInvoicePaid = (invoiceId) => {
    const inv = seed.invoices.find(i => i.id === invoiceId);
    if (!inv) return;
    const remaining = Math.max(0, invoiceGross(inv) - (inv.paidAmount || 0));
    if (remaining <= 0) return;
    handleRegisterInvoicePayment(invoiceId, remaining, todayStr());
  };

  const handleUnmarkInvoicePaid = (invoiceId) => {
    setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'sent', paidDate: undefined, paidAmount: 0 } : i));
    setVerifications(prev => prev.filter(v => !(v.source === 'invoice_payment' && v.sourceId === invoiceId)));
  };

  const handleAddExpense = (expense) => {
    const exp = { ...expense, id: `demo_exp_${Date.now()}` };
    setExpenses(prev => [...prev, exp]);
    if (!exp.costAccount) return;
    handleAddVerification(bookExpense(exp));
  };

  const handleAddSupplierInvoice = (invoice) => {
    const status = invoice.status === 'paid' ? 'paid' : 'unpaid';
    const inv = { ...invoice, id: `demo_exp_${Date.now()}`, type: 'supplier_invoice', status, paidDate: status === 'paid' ? todayStr() : undefined };
    setExpenses(prev => [...prev, inv]);
    if (!inv.rows?.length && !inv.costAccount) return;
    const rows = inv.rows?.length ? inv.rows : [{ account: inv.costAccount, netAmount: inv.netAmount, vatAmount: inv.vatAmount }];
    const verRows = rows.filter(r => r.account && r.netAmount).map(r => ({ account: r.account, debet: Math.round(r.netAmount), kredit: 0, costCenter: inv.costCenter || undefined, projectId: inv.projectId || undefined }));
    const totalVat = inv.reverseCharge ? 0 : rows.reduce((s, r) => s + (r.vatAmount || 0), 0);
    if (totalVat > 0) verRows.push({ account: '2641', debet: Math.round(totalVat), kredit: 0 });
    const payableAccount = inv.paidByOwnerPrivately ? '2018' : '2440';
    const netTotal = rows.reduce((s, r) => s + (r.netAmount || 0), 0);
    const payableAmount = Math.round(netTotal + totalVat);
    verRows.push({ account: payableAccount, debet: 0, kredit: payableAmount });
    if (inv.roundToKrona && Math.round(inv.roundingDiff * 100) !== 0) {
      const diff = Math.round(inv.roundingDiff);
      if (diff !== 0) verRows.push({ account: '3740', debet: diff < 0 ? -diff : 0, kredit: diff > 0 ? diff : 0 });
    }
    handleAddVerification({ date: inv.date, description: inv.description || `Leverantörsfaktura ${inv.invoiceNumber}`, source: 'supplier_invoice', sourceId: inv.id, rows: verRows });
    if (status === 'paid' && !inv.paidByOwnerPrivately) {
      handleAddVerification({ date: inv.paidDate, description: `Betalning leverantörsfaktura ${inv.invoiceNumber}`, source: 'supplier_invoice_payment', sourceId: inv.id, rows: [{ account: '2440', debet: payableAmount, kredit: 0 }, { account: '1930', debet: 0, kredit: payableAmount }] });
    }
  };

  const handleMarkSupplierInvoicePaid = (expenseId, paymentMethod = 'bank') => {
    const inv = seed.expenses.find(e => e.id === expenseId);
    if (!inv) return;
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'paid', paidDate: todayStr(), paymentMethod } : e));
    handleAddVerification({ date: todayStr(), description: `Betalning leverantörsfaktura ${inv.invoiceNumber}`, source: 'supplier_invoice_payment', sourceId: inv.id, rows: [{ account: '2440', debet: Math.round(inv.amount), kredit: 0 }, { account: '1930', debet: 0, kredit: Math.round(inv.amount) }] });
  };

  const handleFixExpenseAccount = (expenseId, accountCode, meta = {}) => {
    const exp = seed.expenses.find(e => e.id === expenseId);
    if (!exp || exp.costAccount) return;
    setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, costAccount: accountCode } : e));
    const verRows = [{ account: accountCode, debet: Math.round(exp.netAmount || exp.amount), kredit: 0 }];
    if (exp.vatAmount > 0) verRows.push({ account: '2641', debet: Math.round(exp.vatAmount), kredit: 0 });
    verRows.push({ account: exp.type === 'supplier_invoice' ? '2440' : '1930', debet: 0, kredit: Math.round(exp.amount) });
    handleAddVerification({ date: todayStr(), description: `Rättad kontering: ${exp.description}`, source: 'expense_fix', sourceId: exp.id, rows: verRows });
    const accountName = seed.accounts.find(a => a.code === accountCode)?.name || accountCode;
    setReviewHistory(prev => [{
      id: `demo_rh_${Date.now()}`, expenseId,
      title: exp.type === 'supplier_invoice' ? `Leverantörsfaktura — ${exp.supplier || exp.description || 'Okänd'}` : `Kvitto — ${exp.supplier || exp.description || 'Okänd'}`,
      amount: exp.amount, account: accountCode, accountName, method: meta.method || 'manual',
      resolvedBy: 'Du (demo)', resolvedAt: new Date().toISOString(),
    }, ...prev]);
  };

  const handleSaveReceiptDetails = (expenseId, formValues) => {
    const exp = seed.expenses.find(e => e.id === expenseId);
    if (!exp) return;
    const alreadyBooked = seed.verifications.some(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);
    const amount = formValues.amount;
    const vatRate = formValues.vatRate;
    const netAmount = vatRate > 0 ? Math.round((amount / (1 + vatRate / 100)) * 100) / 100 : amount;
    const vatAmount = Math.round((amount - netAmount) * 100) / 100;
    const updated = { ...exp, date: formValues.date, supplier: formValues.supplier, description: formValues.supplier, amount, netAmount, vatAmount, vatRate, costAccount: formValues.costAccount, projectId: formValues.projectId || undefined, notes: formValues.notes || undefined };
    setExpenses(prev => prev.map(e => e.id === expenseId ? updated : e));
    if (alreadyBooked) return;
    const verRows = [{ account: updated.costAccount, debet: Math.round(updated.netAmount), kredit: 0, projectId: updated.projectId }];
    if (updated.vatAmount > 0) verRows.push({ account: '2641', debet: Math.round(updated.vatAmount), kredit: 0 });
    verRows.push({ account: '1930', debet: 0, kredit: Math.round(updated.amount) });
    handleAddVerification({ date: updated.date, description: updated.description, source: 'expense', sourceId: updated.id, rows: verRows });
  };

  const handleDeleteExpense = (expenseId) => {
    const alreadyBooked = seed.verifications.some(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);
    if (alreadyBooked) return;
    setExpenses(prev => prev.filter(e => e.id !== expenseId));
  };

  const handleReverseExpense = (expenseId) => {
    const originalVer = seed.verifications.find(v => (v.source === 'expense' || v.source === 'expense_fix') && v.sourceId === expenseId);
    if (!originalVer) return;
    const alreadyReversed = seed.verifications.some(v => v.source === 'expense_reversal' && v.sourceId === expenseId);
    if (alreadyReversed) return;
    const reversedRows = (originalVer.rows || []).map(r => ({ ...r, debet: r.kredit || 0, kredit: r.debet || 0 }));
    handleAddVerification({ date: todayStr(), description: `Rättelse: ${originalVer.description}`, source: 'expense_reversal', sourceId: expenseId, rows: reversedRows });
  };

  const handleSaveEmployee = (employeeId, data) => {
    if (employeeId) setEmployees(prev => prev.map(e => e.id === employeeId ? { ...e, ...data } : e));
    else setEmployees(prev => [...prev, { ...data, id: `demo_emp_${Date.now()}` }]);
  };

  const handleCreateRun = ({ period, payDate, employees: employeesForRun }) => {
    const runId = `demo_run_${Date.now()}`;
    const rows = employeesForRun.map(e => ({
      employeeId: e.id, period, hoursWorked: 0,
      additions: 0, absenceDeduction: 0, grossDeduction: 0, benefits: 0, netDeduction: 0,
      employeeSnapshot: { ...e },
    }));
    setPayrollRuns(prev => [...prev, { id: runId, period, payDate, completedSteps: [], rows, createdAt: new Date().toISOString() }]);
    return runId;
  };

  const handleUpdateRunRow = (runId, employeeId, patch) => {
    setPayrollRuns(prev => prev.map(r => r.id !== runId ? r : { ...r, rows: r.rows.map(row => row.employeeId === employeeId ? { ...row, ...patch } : row) }));
  };

  const handleRefreshRunSnapshots = (runId, currentEmployees) => {
    setPayrollRuns(prev => prev.map(r => {
      if (r.id !== runId || r.completedSteps.includes('calculated')) return r;
      return { ...r, rows: r.rows.map(row => {
        const current = (currentEmployees || seed.employees).find(e => e.id === row.employeeId);
        return current ? { ...row, employeeSnapshot: { ...current } } : row;
      }) };
    }));
  };

  const handleAdvanceRunStep = (runId, stepId) => {
    setPayrollRuns(prev => prev.map(r => (r.id !== runId || r.completedSteps.includes(stepId)) ? r : { ...r, completedSteps: [...r.completedSteps, stepId] }));
  };

  const handleBookRun = (runId, verBlocks) => {
    const run = seed.payrollRuns.find(r => r.id === runId);
    if (!run || run.completedSteps.includes('booked')) return;
    const period = run.period;
    handleAddVerification({ date: run.payDate || todayStr(), description: `Lön ${period}: Lön`, source: 'payroll', sourceId: `${runId}_lon`, rows: verBlocks.block1 });
    handleAddVerification({ date: run.payDate || todayStr(), description: `Lön ${period}: Arbetsgivaravgifter`, source: 'payroll', sourceId: `${runId}_agifter`, rows: verBlocks.block2 });
    handleAddVerification({ date: run.payDate || todayStr(), description: `Lön ${period}: Semesteravsättning`, source: 'payroll', sourceId: `${runId}_semester`, rows: verBlocks.block3 });
    setPayrollRuns(prev => prev.map(r => r.id === runId ? { ...r, completedSteps: [...r.completedSteps, 'booked'] } : r));
  };

  const handleMarkRunPaid = (runId, paymentMethod = 'bank') => {
    setPayrollRuns(prev => prev.map(r => (r.id !== runId || r.completedSteps.includes('paid')) ? r : { ...r, completedSteps: [...r.completedSteps, 'paid'], paymentMethod }));
  };

  const handleBookVatPeriod = ({ periodKey, periodStart, periodEnd, quarter, year, rounded }) => {
    if (seed.vatPeriods[periodKey]) return;
    const verRows = [];
    [25, 12, 6].forEach(rate => {
      const amount = rounded.outputVatByRate[rate];
      if (amount) verRows.push({ account: { 25: '2611', 12: '2612', 6: '2613' }[rate], debet: Math.round(amount), kredit: 0 });
    });
    if (rounded.inputVat) verRows.push({ account: '2641', debet: 0, kredit: Math.round(rounded.inputVat) });
    if (rounded.netToPay > 0) verRows.push({ account: '2650', debet: 0, kredit: Math.round(rounded.netToPay) });
    else if (rounded.netToPay < 0) verRows.push({ account: '2650', debet: Math.round(-rounded.netToPay), kredit: 0 });
    const verId = `demo_ver_vat_${periodKey}_${Date.now()}`;
    handleAddVerification({ date: todayStr(), description: `Momsdeklaration ${periodKey}`, source: 'vat_declaration', sourceId: verId, rows: verRows });
    setVatPeriods(prev => ({ ...prev, [periodKey]: { periodStart, periodEnd, quarter, year, bookedAt: new Date().toISOString(), netToPay: rounded.netToPay } }));
  };

  const handleSaveVerificationTemplate = ({ name, description, projectId, costCenter, rows }) => {
    setVerificationTemplates(prev => [...prev, { id: `demo_tpl_${Date.now()}`, name, description, projectId, costCenter, rows }]);
  };

  const handleNavigateToVerification = (id) => {
    setActiveDemoTab('verifications');
    setHighlightVerificationId(id);
  };

  // Stripe kräver ett riktigt anslutet konto — här visas det ärligt istället
  // för att låtsas fungera eller tyst göra ingenting.
  const handleCreatePaymentLink = async () => {
    window.alert('Kortbetalningar via Stripe kräver ett riktigt, anslutet konto. Skapa ett gratis konto för att testa det här på riktigt.');
  };
  const getPaymentLinkUrl = async () => {
    throw new Error('Kräver ett riktigt anslutet Stripe-konto.');
  };

  // Ersätter den riktiga Supabase Storage-uppladdningen i Expenses.jsx/
  // Verifications.jsx — en lokal object-URL istället, så ett kvitto/bilaga
  // går att dra in och se fungera utan att en icke-inloggad besökare
  // faktiskt skickar en fil till backend.
  const demoUploadFn = (_userId, file) => Promise.resolve(URL.createObjectURL(file));

  const openTab = (id) => { setActiveDemoTab(id); setMobileMenuOpen(false); };

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
        return <Contacts contacts={seed.contacts} setContacts={setContacts} accounts={seed.accounts} globalAction={globalAction} clearGlobalAction={clearGlobalAction} />;
      case 'invoices':
        return (
          <Invoices
            invoices={seed.invoices} contacts={seed.contacts} verifications={seed.verifications} expenses={seed.expenses}
            onAdd={handleAddInvoice} onMarkPaid={handleMarkInvoicePaid} onRegisterPayment={handleRegisterInvoicePayment}
            onUnmarkPaid={handleUnmarkInvoicePaid} onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            handleGlobalAction={handleGlobalAction} onCreatePaymentLink={handleCreatePaymentLink} onGetPaymentLinkUrl={getPaymentLinkUrl}
            stripeAccountId={seed.company.stripeAccountId} setInvoices={setInvoices} company={seed.company}
            globalAction={globalAction} clearGlobalAction={clearGlobalAction} onNavigate={openTab}
          />
        );
      case 'supplier_invoices':
        return (
          <SupplierInvoices
            expenses={seed.expenses} accounts={seed.accounts} contacts={seed.contacts} setContacts={setContacts}
            onAddSupplierInvoice={handleAddSupplierInvoice} onMarkSupplierInvoicePaid={handleMarkSupplierInvoicePaid}
            onFixExpenseAccount={handleFixExpenseAccount} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
            onNavigate={openTab}
          />
        );
      case 'expenses':
        return (
          <Expenses
            expenses={seed.expenses} accounts={seed.accounts} verifications={seed.verifications} projects={seed.projects}
            user={demoUser} onAdd={handleAddExpense} onFixExpenseAccount={handleFixExpenseAccount}
            onSaveReceiptDetails={handleSaveReceiptDetails} onDeleteExpense={handleDeleteExpense} onReverseExpense={handleReverseExpense}
            pageTitle="Utgifter" pageSubtitle="Alla registrerade utgifter" uploadFn={demoUploadFn}
          />
        );
      case 'projects':
        return (
          <Projects
            projects={seed.projects} setProjects={setProjects} contacts={seed.contacts} setContacts={setContacts}
            timeEntries={seed.timeEntries} setTimeEntries={setTimeEntries} globalAction={globalAction} clearGlobalAction={clearGlobalAction}
          />
        );
      case 'review':
        return <ReviewQueue expenses={seed.expenses} accounts={seed.accounts} reviewHistory={seed.reviewHistory} onResolve={handleFixExpenseAccount} />;
      case 'verifications':
        return (
          <Verifications
            user={demoUser} verifications={seed.verifications} accounts={seed.accounts} balances={balances}
            contacts={seed.contacts} projects={seed.projects} templates={seed.verificationTemplates}
            onSaveTemplate={handleSaveVerificationTemplate} onAdd={handleAddVerification}
            setVerifications={setVerifications} setAccounts={setAccounts} vatPeriods={seed.vatPeriods}
            highlightVerificationId={highlightVerificationId} onClearHighlight={() => setHighlightVerificationId(null)}
            uploadFn={demoUploadFn}
          />
        );
      case 'payroll':
        return (
          <Payroll
            company={seed.company} employees={seed.employees} onSaveEmployee={handleSaveEmployee}
            accounts={seed.accounts} projects={seed.projects} payrollRuns={seed.payrollRuns}
            onCreateRun={handleCreateRun} onUpdateRunRow={handleUpdateRunRow} onAdvanceRunStep={handleAdvanceRunStep}
            onBookRun={handleBookRun} onMarkRunPaid={handleMarkRunPaid} onRefreshRunSnapshots={handleRefreshRunSnapshots}
          />
        );
      case 'taxes':
        return (
          <Taxes
            company={seed.company} verifications={seed.verifications} invoices={seed.invoices} expenses={seed.expenses}
            accounts={seed.accounts} payrollRuns={seed.payrollRuns} vatPeriods={seed.vatPeriods}
            onBookVatPeriod={handleBookVatPeriod} onNavigateToVerification={handleNavigateToVerification}
            onAddVerification={handleAddVerification} setCompanyInfo={setCompanyInfo} onNavigateToTab={openTab}
          />
        );
      case 'reports':
        return <Reports accounts={seed.accounts} verifications={seed.verifications} company={seed.company} />;
      case 'settings':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 24px', gap: '14px' }}>
            <div style={{ width: 52, height: 52, borderRadius: '14px', background: BRAND.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <SettingsIcon size={24} color={BRAND.greenDark} />
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: '#111827', margin: 0 }}>Inställningar</h3>
            <p style={{ fontSize: '13.5px', color: '#6b7280', maxWidth: '360px', lineHeight: 1.6, margin: 0 }}>
              Företagsuppgifter, kontoplan, Stripe och e-postavsändare hör till ett riktigt konto — inget att testa på låtsas här.
            </p>
            <button onClick={onEnterApp} className="lp-btn-primary" style={{ marginTop: '6px', padding: '11px 22px', borderRadius: '10px', border: 'none', background: BRAND.green, color: 'white', fontWeight: 700, fontSize: '13.5px', cursor: 'pointer', fontFamily: 'inherit' }}>
              Skapa ett gratis konto
            </button>
          </div>
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
          MarketingLayout.jsx: en fast höjd där blev en liten kikhålsruta på
          en telefon, snarare än det man faktiskt kom hit för att se. */}
      <div className="lp-demo-content">
        {renderContent()}
      </div>
    </div>
  );
}
