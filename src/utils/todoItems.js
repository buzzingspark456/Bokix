// Att göra: listan över det som väntar på användaren. En enda källa för
// Startsidans Att göra (Dashboard.jsx) och notisklockan (App.jsx), så att
// de aldrig säger olika saker.
//
// Varje rad har `target` = { tab, action }: `tab` är sidan, `action` (valfri)
// är App.jsx:s handleGlobalAction-åtgärd som öppnar just den saken (en viss
// faktura, en viss leverantörsfaktura), så att knappen gör saken i stället
// för att bara visa sidan.
//
// Raderna har ingen ikon här (ikonerna är React-komponenter, se
// Dashboard.jsx TODO_ICONS), bara `kind`.
import { nextVatDeadline, nextAgiDeadline, vatContextFor } from './declarationDeadlines';
import { invoiceCustomerRemaining } from './rotRutConfig';
import { activeFiscalYear } from './fiscalYear';
import { numberFormat } from './intlCache';

// Försenat först, sedan det som närmar sig, sist det som är mindre bråttom.
export const SEV_RANK = { danger: 0, warning: 1, success: 2 };

/** Nyckeln i localStorage för de rader användaren dolt, per företag. */
export function todoDismissedKey(companyId) { return `bokix_dashboard_todo_dismissed_${companyId || 'default'}`; }

/** De dolda radernas nycklar för företaget (tom mängd om inget går att läsa). */
export function readDismissedTodoKeys(companyId) {
  try { return new Set(JSON.parse(localStorage.getItem(todoDismissedKey(companyId)) || '[]')); } catch { return new Set(); }
}

/** Hela kalenderdagar sedan förfallodagen (0 om den inte passerat). */
export function calendarDaysOverdue(dueDate, today = new Date()) {
  if (!dueDate) return 0;
  const [y, m, d] = String(dueDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return 0;
  const diff = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(y, m - 1, d);
  return Math.max(0, Math.round(diff / 86400000));
}

/** Dagar kvar till förfallodagen (negativt om den passerat). */
function daysUntil(dueDate, today) {
  if (!dueDate) return null;
  const [y, m, d] = String(dueDate).slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return null;
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86400000);
}

const fmtKr = (val) => {
  const rounded = Math.round(val || 0);
  return numberFormat('sv-SE', { style: 'currency', currency: 'SEK', maximumFractionDigits: 0 }).format(rounded === 0 ? 0 : rounded);
};

/**
 * Alla rader, sorterade (det viktigaste först), utan de användaren dolt.
 * `t` är översättningsfunktionen. Varje rad: { kind, group, sev, tone,
 * title, detail, when, late, action (knapptext), target, daysLeft,
 * primary, dismissKey }.
 */
export function buildTodoItems({
  t, company = {}, invoices = [], expenses = [], contacts = [], verifications = [],
  payrollRuns = [], employees = [], agiReports = [], bankTransactions = [],
  vatPeriods = {}, reviewTotal = 0, hiddenNavIds = [], dismissedKeys = new Set(), today = new Date(),
}) {
  const fmt = fmtKr;
  const shows = (tab) => !hiddenNavIds.includes(tab);
  const daysAgoLabel = (days) => (days <= 1 ? t('dashboard.todo.whenYesterday') : t('dashboard.todo.whenDaysAgo', { days }));
  const whenIn = (days) => (days === 0 ? t('dashboard.todos.whenToday') : days === 1 ? t('dashboard.todos.whenTomorrow') : t('dashboard.todos.whenInDays', { days }));
  const rows = [];

  // Förfallna kundfakturor.
  const overdueInvoices = invoices.filter(i => i.status === 'sent' && calendarDaysOverdue(i.dueDate, today) > 0);
  if (overdueInvoices.length > 0) {
    const one = overdueInvoices.length === 1 ? overdueInvoices[0] : null;
    const customer = one && contacts.find(c => c.id === one.customerId)?.name;
    const amount = overdueInvoices.reduce((sum, i) => sum + invoiceCustomerRemaining(i), 0);
    const mostOverdue = overdueInvoices.reduce((max, i) => Math.max(max, calendarDaysOverdue(i.dueDate, today)), 0);
    rows.push({
      kind: 'overdue_invoices', group: 'invoices', sev: 'danger', daysLeft: -mostOverdue, late: true,
      tone: 'bad', primary: true, action: one ? t('dashboard.todo.actionInvoice') : t('dashboard.todo.actionInvoices'),
      target: one ? { tab: 'invoices', action: { type: 'open_invoice', payload: { id: one.id } } } : { tab: 'invoices' },
      title: one
        ? (customer ? t('dashboard.todo.overdueOneTitle', { number: one.invoiceNumber, customer }) : t('dashboard.todo.overdueOneTitleNoCustomer', { number: one.invoiceNumber }))
        : t('dashboard.todo.overdueManyTitle', { count: overdueInvoices.length }),
      detail: [
        one ? fmt(amount) : t('dashboard.todo.amountTotal', { amount: fmt(amount) }),
        one ? t('dashboard.todo.overdueWhen', { when: daysAgoLabel(mostOverdue) }) : t('dashboard.todo.overdueOldestWhen', { when: daysAgoLabel(mostOverdue) }),
      ].join(' · '),
      when: t('dashboard.todo.chipOverdue'),
    });
  }

  // Leverantörsfakturor att betala: förfallna eller inom tre dagar.
  const supplierDue = shows('supplier_invoices') ? expenses.filter(e => e.type === 'supplier_invoice' && e.status !== 'paid' && e.status !== 'draft'
    && e.dueDate && daysUntil(e.dueDate, today) <= 3) : [];
  if (supplierDue.length > 0) {
    const one = supplierDue.length === 1 ? supplierDue[0] : null;
    const soonest = supplierDue.reduce((min, e) => Math.min(min, daysUntil(e.dueDate, today)), Infinity);
    const late = soonest < 0;
    const amount = supplierDue.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const name = one && (contacts.find(c => c.id === one.supplierId)?.name || one.supplier || one.description);
    rows.push({
      kind: 'supplier_due', group: 'invoices', sev: late ? 'danger' : 'warning', daysLeft: soonest, late,
      tone: late ? 'bad' : 'warn', action: t('dashboard.todo.actionPay'),
      target: one ? { tab: 'supplier_invoices', action: { type: 'view_supplier_invoice', payload: { id: one.id } } } : { tab: 'supplier_invoices' },
      title: one ? t('dashboard.todo.supplierOneTitle', { name: name || '' }) : t('dashboard.todo.supplierManyTitle', { count: supplierDue.length }),
      detail: one ? fmt(amount) : t('dashboard.todo.amountTotal', { amount: fmt(amount) }),
      when: late ? t('dashboard.todo.chipOverdue') : t('dashboard.todo.supplierDue', { when: whenIn(soonest) }),
    });
  }

  // Momsdeklarationen, bara om något är bokfört i kvartalet: ett företag som
  // började i oktober har ingen Q3-moms att deklarera.
  const vatDeadline = nextVatDeadline(company, vatPeriods, vatContextFor(company, verifications));
  const vatQuarterHasActivity = vatDeadline && verifications.some(v => v.date && v.date >= vatDeadline.start && v.date <= vatDeadline.end);
  if (vatDeadline && vatQuarterHasActivity && vatDeadline.daysLeft <= 7) {
    const late = vatDeadline.daysLeft < 0;
    rows.push({
      kind: 'vat_deadline', group: 'tax', sev: late ? 'danger' : 'warning', daysLeft: vatDeadline.daysLeft, late,
      tone: late ? 'bad' : 'warn', action: t('dashboard.todo.actionVat'), target: { tab: 'taxes_vat' },
      title: vatDeadline.quarter ? t('dashboard.todo.vatTitle', { quarter: vatDeadline.quarter }) : t('dashboard.todo.vatTitleLabel', { label: vatDeadline.label }),
      when: late ? t('dashboard.todo.vatLate') : t('dashboard.todo.vatDue', { when: whenIn(vatDeadline.daysLeft) }),
    });
  }

  // Arbetsgivardeklarationen för en månad med bokförd lön, när den snart
  // ska in och inte är inlämnad.
  if (shows('payroll')) {
    const agi = nextAgiDeadline(today);
    const hasBookedPayroll = payrollRuns.some(r => r.period === agi.periodKey && r.completedSteps?.includes('booked'));
    const submitted = agiReports.some(r => r.period === agi.periodKey && r.status === 'submitted');
    if (hasBookedPayroll && !submitted && agi.daysLeft <= 7) {
      rows.push({
        kind: 'agi_deadline', group: 'tax', sev: 'warning', daysLeft: agi.daysLeft,
        tone: 'warn', action: t('dashboard.todo.actionAgi'), target: { tab: 'taxes' },
        title: t('dashboard.todo.agiTitle', { period: agi.periodKey }),
        when: t('dashboard.todo.vatDue', { when: whenIn(agi.daysLeft) }),
      });
    }
  }

  // Lönekörningar som väntar på att godkännas och bokföras.
  const pendingPayrollRuns = payrollRuns.filter(r => r.completedSteps?.includes('calculated') && !r.completedSteps?.includes('booked'));
  if (pendingPayrollRuns.length > 0 && shows('payroll')) {
    rows.push({
      kind: 'payroll_pending', group: 'payroll', sev: 'warning', tone: 'warn',
      action: t('dashboard.todo.actionPayroll'), target: { tab: 'payroll' },
      title: pendingPayrollRuns.length === 1
        ? t('dashboard.todo.payrollOneTitle', { period: pendingPayrollRuns[0].period || '' })
        : t('dashboard.todo.payrollManyTitle', { count: pendingPayrollRuns.length }),
      detail: t('dashboard.todo.payrollDetail'),
    });
  }

  // Anställda utan skattetabell: första lönen skulle dra fel skatt.
  const missingTax = employees.filter(e => e.active !== false && !e.secondaryIncome && !e.taxTable?.tabellnr
    && !(e.endDate && String(e.endDate) < today.toISOString().slice(0, 10)));
  if (missingTax.length > 0 && shows('payroll')) {
    rows.push({
      kind: 'employees_tax', group: 'payroll', sev: 'warning', tone: 'warn',
      action: t('dashboard.todo.actionTaxTables'), target: { tab: 'payroll' },
      title: missingTax.length === 1 ? t('dashboard.todo.taxOneTitle', { name: `${missingTax[0].firstName || ''} ${missingTax[0].lastName || ''}`.trim() }) : t('dashboard.todo.taxManyTitle', { count: missingTax.length }),
      detail: t('dashboard.todo.taxDetail'),
    });
  }

  // Granskning: kvitton utan konto plus betalningar från Stripe och Zettle
  // (reviewTotal är samma siffra som menyns märke).
  const unhandledReceipts = expenses.filter(e => !e.costAccount);
  const reviewCount = Math.max(reviewTotal ?? 0, unhandledReceipts.length);
  if (reviewCount > 0) {
    const receipts = unhandledReceipts.length;
    const payments = reviewCount - receipts;
    rows.push({
      kind: 'review', group: 'bookkeeping', sev: 'success', tone: 'brand', primary: true,
      action: t('dashboard.todo.actionReview'), target: { tab: 'review' },
      title: reviewCount === 1 ? t('dashboard.todo.reviewOneTitle') : t('dashboard.todo.reviewManyTitle', { count: reviewCount }),
      detail: receipts && payments
        ? t('dashboard.todo.reviewDetailBoth', { receipts, payments })
        : receipts
          ? (receipts === 1 ? t('dashboard.todo.reviewDetailReceiptOne') : t('dashboard.todo.reviewDetailReceipts', { count: receipts }))
          : t('dashboard.todo.reviewDetailPayments', { count: payments }),
    });
  }

  // Banktransaktioner som inte är bokförda eller kopplade.
  const unmatchedBank = bankTransactions.filter(b => b.status === 'unmatched');
  if (unmatchedBank.length > 0) {
    rows.push({
      kind: 'bank_unmatched', group: 'bookkeeping', sev: 'success', tone: 'brand',
      action: t('dashboard.todo.actionBank'), target: { tab: 'bank' },
      title: unmatchedBank.length === 1 ? t('dashboard.todo.bankOneTitle') : t('dashboard.todo.bankManyTitle', { count: unmatchedBank.length }),
      detail: t('dashboard.todo.bankDetail'),
    });
  }

  // Fakturautkast som inte skickats.
  const draftInvoices = invoices.filter(i => i.status === 'draft');
  if (draftInvoices.length > 0) {
    const one = draftInvoices.length === 1 ? draftInvoices[0] : null;
    rows.push({
      kind: 'draft_invoices', group: 'invoices', sev: 'success', tone: 'neu',
      action: t('dashboard.todo.actionDraft'),
      target: one ? { tab: 'invoices', action: { type: 'open_invoice', payload: { id: one.id } } } : { tab: 'invoices' },
      title: draftInvoices.length === 1 ? t('dashboard.todo.draftOneTitle') : t('dashboard.todo.draftManyTitle', { count: draftInvoices.length }),
      detail: draftInvoices.length === 1 ? t('dashboard.todo.draftOneDetail') : t('dashboard.todo.draftManyDetail'),
    });
  }

  // Förra räkenskapsåret är slut men inte stängt (bokslut + lås).
  const current = activeFiscalYear(company, today);
  const dayBefore = new Date(`${current.start}T12:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const previous = activeFiscalYear(company, dayBefore);
  const previousHasBookkeeping = previous.start !== current.start
    && verifications.some(v => v.date && v.date >= previous.start && v.date <= previous.end && v.source !== 'year_end_close');
  if (previousHasBookkeeping && !company?.lockedFiscalYears?.[previous.key]) {
    rows.push({
      kind: 'year_end', group: 'tax', sev: 'success', tone: 'neu',
      action: t('dashboard.todo.actionYearEnd'), target: { tab: 'taxes_yearend' },
      title: t('dashboard.todo.yearEndTitle', { year: previous.label }),
      detail: t('dashboard.todo.yearEndDetail'),
    });
  }

  // Första veckan: det som gör kontot klart. Bara för ett nytt konto; ett
  // företag som redan bokför (eller flyttat hit sin historik) får inga
  // "Kom igång"-rader.
  if (verifications.length < 25) {
    const startSteps = [
      { kind: 'start_company', done: Boolean(company?.orgNr && company?.address && (company?.bankgiro || company?.plusgiro || company?.iban)), tab: 'company', title: t('dashboard.start.companyTitle'), detail: t('dashboard.start.companyDetail') },
      { kind: 'start_vat', done: company?.vatRegistered === true || company?.vatRegistered === false, tab: 'settings_system', title: t('dashboard.start.vatTitle'), detail: t('dashboard.start.vatDetail') },
      { kind: 'start_receipt', done: expenses.length > 0, tab: 'expenses', title: t('dashboard.start.receiptTitle'), detail: t('dashboard.start.receiptDetail') },
      { kind: 'start_invoice', done: invoices.length > 0, tab: 'invoices', title: t('dashboard.start.invoiceTitle'), detail: t('dashboard.start.invoiceDetail') },
    ];
    startSteps.filter(s => !s.done).forEach(({ kind, tab, title, detail }) => {
      // Överraden säger vad raden är (Kom igång); rubriken säger vad man gör.
      rows.push({ kind, title, detail, action: t('dashboard.todo.group.start'), group: 'start', sev: 'success', tone: 'brand', target: { tab } });
    });
  }

  rows.forEach(r => { r.text = [r.title, r.detail, r.when].filter(Boolean).join(' · '); });
  // Allvarsgrad först, men därinom det som har minst tid kvar.
  rows.sort((a, b) => {
    const bySeverity = SEV_RANK[a.sev] - SEV_RANK[b.sev];
    if (bySeverity !== 0) return bySeverity;
    return (a.daysLeft ?? Number.POSITIVE_INFINITY) - (b.daysLeft ?? Number.POSITIVE_INFINITY);
  });
  // Nyckeln för att dölja en rad: kind + text, så att en dold rad kommer
  // tillbaka den dag beloppet, antalet eller datumet ändras.
  return rows
    .map(r => ({ ...r, dismissKey: `${r.kind}::${r.text}` }))
    .filter(r => !dismissedKeys.has(r.dismissKey));
}
