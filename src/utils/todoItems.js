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
import { nextVatDeadline, nextAgiDeadline, vatContextFor, incomeDeclarationDueDate } from './declarationDeadlines';
import { annualReportDeadline } from './annualReport';
import { detectOrgType } from './orgType';
import { invoiceCustomerRemainingSek } from './rotRutConfig';
import { orderStatus, rowLeftToInvoice, rowLeftToDeliver, applyInvoiceExistence, num as orderNum } from './salesOrders';
import { activeFiscalYear } from './fiscalYear';
import { numberFormat } from './intlCache';
import { staleDocuments } from './looseDocuments';
import { computeVatPeriod } from './vatCalculation';
import { computeEmployeePayroll, summarizePayrollRun } from './payrollCalculation';

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
  payrollRuns = [], employees = [], agiReports = [], bankTransactions = [], documents = [],
  vatPeriods = {}, reviewTotal = 0, hiddenNavIds = [], dismissedKeys = new Set(), today = new Date(),
}) {
  const fmt = fmtKr;
  const shows = (tab) => !hiddenNavIds.includes(tab);
  const daysAgoLabel = (days) => (days <= 1 ? t('dashboard.todo.whenYesterday') : t('dashboard.todo.whenDaysAgo', { days }));
  const whenIn = (days) => (days === 0 ? t('dashboard.todos.whenToday') : days === 1 ? t('dashboard.todos.whenTomorrow') : t('dashboard.todos.whenInDays', { days }));
  const rows = [];

  // Förfallna kundfakturor.
  // Fakturor med 0 kr kvar (tomma, eller redan betalda/krediterade) räknas inte.
  const overdueInvoices = invoices.filter(i => i.status === 'sent' && invoiceCustomerRemainingSek(i) > 0 && calendarDaysOverdue(i.dueDate, today) > 0);
  if (overdueInvoices.length > 0) {
    const one = overdueInvoices.length === 1 ? overdueInvoices[0] : null;
    const customer = one && contacts.find(c => c.id === one.customerId)?.name;
    const amount = overdueInvoices.reduce((sum, i) => sum + invoiceCustomerRemainingSek(i), 0);
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
    // Beloppet att betala (eller få tillbaka) står med, så man ser vad det
    // gäller utan att öppna momsen (2026-11-07). Som deklarationen: hela kronor.
    let vatAmount = null;
    let vatCalc = null;
    try { vatCalc = computeVatPeriod({ verifications, periodStart: vatDeadline.start, periodEnd: vatDeadline.end }); vatAmount = Math.round(vatCalc.netToPay); } catch { vatAmount = null; }
    // Markerad som inlämnad i uppgiftspanelen eller i Skatt och bokslut
    // (company.taxFilings): kvar tills momsen är bokförd, men lugnare.
    const filed = Boolean(company?.taxFilings?.[`vat:${vatDeadline.key}`]);
    const amountText = vatAmount ? (vatAmount > 0 ? t('dashboard.todo.vatToPay', { amount: fmt(vatAmount) }) : t('dashboard.todo.vatRefund', { amount: fmt(-vatAmount) })) : null;
    const dueText = late ? t('dashboard.todo.vatLate') : t('dashboard.todo.vatDue', { when: whenIn(vatDeadline.daysLeft) });
    rows.push({
      kind: 'vat_deadline', group: 'tax', sev: filed ? 'success' : late ? 'danger' : 'warning', daysLeft: vatDeadline.daysLeft, late: late && !filed,
      tone: filed ? 'brand' : late ? 'bad' : 'warn', action: t('dashboard.todo.actionVat'), target: { tab: 'taxes_vat' },
      title: vatDeadline.quarter ? t('dashboard.todo.vatTitle', { quarter: vatDeadline.quarter }) : t('dashboard.todo.vatTitleLabel', { label: vatDeadline.label }),
      when: filed ? t('dashboard.todo.vatFiledBook') : amountText ? `${amountText} · ${dueText}` : dueText,
      // Uppgiftspanelen (dashboard/VatTaskPanel.jsx) öppnas med det här.
      task: {
        type: 'vat', key: vatDeadline.key, start: vatDeadline.start, end: vatDeadline.end, dueDate: vatDeadline.dueDate,
        daysLeft: vatDeadline.daysLeft, amount: vatAmount || 0, booked: Boolean(vatPeriods?.[vatDeadline.key]),
        output: vatCalc ? Math.round(vatCalc.outputVatTotal || 0) : 0, input: vatCalc ? Math.round(vatCalc.inputVat || 0) : 0,
        title: vatDeadline.quarter ? t('task.vat_titel_kvartal', { quarter: vatDeadline.quarter }) : t('task.vat_titel', { label: vatDeadline.label }),
      },
    });
  }

  // Arbetsgivardeklarationen för en månad med bokförd lön, när den snart
  // ska in och inte är inlämnad.
  if (shows('payroll')) {
    const agi = nextAgiDeadline(today);
    const hasBookedPayroll = payrollRuns.some(r => r.period === agi.periodKey && r.completedSteps?.includes('booked'));
    const submitted = agiReports.some(r => r.period === agi.periodKey && r.status === 'submitted');
    if (hasBookedPayroll && !submitted && agi.daysLeft <= 7) {
      // Skatt och arbetsgivaravgifter för månadens bokförda körningar, för
      // uppgiftspanelen (dashboard/VatTaskPanel.jsx, 2026-11-15).
      let totals = null;
      try {
        totals = payrollRuns
          .filter(r => r.period === agi.periodKey && r.completedSteps?.includes('booked') && Array.isArray(r.rows))
          .map(r => summarizePayrollRun(r.rows.map(row => computeEmployeePayroll(row.employeeSnapshot, row))))
          .reduce((a, b) => ({ gross: a.gross + b.gross, tax: a.tax + b.tax, employerFee: a.employerFee + b.employerFee }), { gross: 0, tax: 0, employerFee: 0 });
      } catch { totals = null; }
      // Skatten och avgifterna som faktiskt bokades (2710, 273x) går före
      // omräkningen, som kräver inläst skattetabell.
      const runIds = payrollRuns.filter(r => r.period === agi.periodKey && r.completedSteps?.includes('booked')).map(r => r.id);
      const payrollVers = verifications.filter(v => v.source === 'payroll' && runIds.some(id => String(v.sourceId || '').startsWith(`${id}_`)));
      if (payrollVers.length) {
        const credit = (test) => payrollVers.reduce((sum, v) => sum + (v.rows || []).filter(r => test(String(r.account))).reduce((a, r) => a + (Number(r.kredit) || 0) - (Number(r.debet) || 0), 0), 0);
        totals = { gross: totals?.gross || 0, tax: credit(acc => acc === '2710'), employerFee: credit(acc => acc.startsWith('273')) };
      }
      const agiAmount = totals ? Math.round(totals.tax) + Math.round(totals.employerFee) : 0;
      const dueText = t('dashboard.todo.vatDue', { when: whenIn(agi.daysLeft) });
      const [py, pm] = agi.periodKey.split('-').map(Number);
      const monthLabel = new Date(py, pm - 1, 1).toLocaleDateString('sv-SE', { month: 'long', year: 'numeric' });
      rows.push({
        kind: 'agi_deadline', group: 'tax', sev: 'warning', daysLeft: agi.daysLeft,
        tone: 'warn', action: t('dashboard.todo.actionAgi'), target: { tab: 'taxes_agi' },
        title: t('dashboard.todo.agiTitle', { period: agi.periodKey }),
        when: agiAmount > 0 ? `${t('dashboard.todo.vatToPay', { amount: fmt(agiAmount) })} · ${dueText}` : dueText,
        task: {
          type: 'agi', key: agi.periodKey, dueDate: agi.dueDate, daysLeft: agi.daysLeft, booked: true,
          amount: agiAmount, tax: totals ? Math.round(totals.tax) : 0, employerFee: totals ? Math.round(totals.employerFee) : 0,
          gross: totals ? Math.round(totals.gross) : 0, month: monthLabel,
          title: t('task.agi_titel', { month: monthLabel }),
        },
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
  const unhandledReceipts = expenses.filter(e => !e.costAccount && !e.filedAs);
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

  // Underlag sparade utan avläsning som legat över 30 dagar okopplade
  // (utils/looseDocuments.js). Lagen kräver att verifikationen visar var
  // underlaget finns, så de ska kopplas.
  const staleDocs = staleDocuments(documents, today);
  if (staleDocs.length > 0 && shows('expenses')) {
    rows.push({
      kind: 'documents_unlinked', group: 'bookkeeping', sev: 'success', tone: 'brand',
      action: t('dashboard.todo.actionDocuments'), target: { tab: 'expenses' },
      title: staleDocs.length === 1 ? t('dashboard.todo.documentsOneTitle') : t('dashboard.todo.documentsManyTitle', { count: staleDocs.length }),
      detail: t('dashboard.todo.documentsDetail'),
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

  // Kundorder (2026-11-24): att leverera (försenade först) och att fakturera.
  // Bara när Order syns i menyn (admin med artiklar, senare Handel-planen).
  if (shows('orders')) {
    const invoiceIds = new Map(invoices.map(i => [i.id, i]));
    const orders = (company?.salesOrders || []).map(o => applyInvoiceExistence(o, invoiceIds));
    const orderLabel = (o) => (o.customerName ? t('dashboard.todo.orderOne', { number: o.number, customer: o.customerName }) : t('dashboard.todo.orderOneNoCustomer', { number: o.number }));
    const toDeliver = orders.filter(o => ['open', 'partial'].includes(orderStatus(o)) && (o.rows || []).some(rw => rowLeftToDeliver(rw) > 0));
    if (toDeliver.length > 0) {
      const one = toDeliver.length === 1 ? toDeliver[0] : null;
      const dated = toDeliver.filter(o => o.deliveryDate);
      const soonest = dated.length ? dated.reduce((min, o) => Math.min(min, daysUntil(o.deliveryDate, today)), Infinity) : null;
      const lateCount = dated.filter(o => daysUntil(o.deliveryDate, today) < 0).length;
      const late = lateCount > 0;
      rows.push({
        kind: 'orders_deliver', group: 'orders', sev: late ? 'danger' : soonest != null && soonest <= 2 ? 'warning' : 'success',
        daysLeft: soonest ?? undefined, late, tone: late ? 'bad' : 'warn', primary: late,
        action: one ? t('dashboard.todo.actionOrder') : t('dashboard.todo.actionOrders'),
        target: one ? { tab: 'orders', action: { type: 'open_order', payload: { id: one.id } } } : { tab: 'orders' },
        title: one ? t('dashboard.todo.deliverOneTitle', { order: orderLabel(one) }) : t('dashboard.todo.deliverManyTitle', { count: toDeliver.length }),
        detail: [
          late ? (lateCount === 1 ? t('dashboard.todo.ordersLateOne') : t('dashboard.todo.ordersLateMany', { count: lateCount })) : null,
          !late && soonest != null ? t('dashboard.todo.deliveryWhen', { when: whenIn(Math.max(0, soonest)) }) : null,
          toDeliver.some(o => orderStatus(o) === 'partial') ? t('dashboard.todo.ordersBackorder') : null,
        ].filter(Boolean).join(' · ') || undefined,
        when: late ? t('dashboard.todo.chipOverdue') : undefined,
      });
    }
    const toInvoice = orders.filter(o => (o.rows || []).some(rw => rowLeftToInvoice(rw) > 0));
    if (toInvoice.length > 0) {
      const one = toInvoice.length === 1 ? toInvoice[0] : null;
      const amount = toInvoice.reduce((sum, o) => sum + (o.rows || []).reduce((ss, rw) => ss + rowLeftToInvoice(rw) * orderNum(rw.unitPrice) * (1 - orderNum(rw.discount) / 100) * (1 + orderNum(rw.vatRate) / 100), 0), 0);
      rows.push({
        kind: 'orders_invoice', group: 'orders', sev: 'warning', tone: 'brand', primary: true,
        action: one ? t('dashboard.todo.actionInvoiceOrder') : t('dashboard.todo.actionOrders'),
        target: one ? { tab: 'orders', action: { type: 'open_order', payload: { id: one.id } } } : { tab: 'orders' },
        title: one ? t('dashboard.todo.invoiceOrderOneTitle', { order: orderLabel(one) }) : t('dashboard.todo.invoiceOrderManyTitle', { count: toInvoice.length }),
        detail: t('dashboard.todo.invoiceOrderDetail', { amount: fmt(amount) }),
      });
    }
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

  // Inkomstdeklarationen och årsredovisningen för förra räkenskapsåret, de
  // sista 30 dagarna före fristen och tills de markerats inlämnade under
  // Skatt och bokslut (samma nycklar som översikten där, Taxes.jsx).
  // Kundönskemål 2026-10-24: förut syntes bara momsen här.
  const dayStart = new Date(today);
  dayStart.setHours(0, 0, 0, 0);
  const daysToDue = (d) => Math.round((new Date(d) - dayStart) / 86400000);
  const filed = (key) => Boolean(company?.taxFilings?.[key]?.at);
  const orgType = detectOrgType(company?.orgNr);
  if (previousHasBookkeeping) {
    const declarationDue = incomeDeclarationDueDate({ orgType, fyEnd: previous.end });
    const declarationKey = orgType === 'Ideell förening / stiftelse' ? `ink3:${previous.key}` : `ink:${previous.key}`;
    if (declarationDue && !filed(declarationKey)) {
      const daysLeft = daysToDue(declarationDue);
      if (daysLeft <= 30) {
        const late = daysLeft < 0;
        rows.push({
          kind: 'income_declaration', group: 'tax', sev: late ? 'danger' : 'warning', daysLeft, late,
          tone: late ? 'bad' : 'warn', action: t('dashboard.todo.actionTaxes'), target: { tab: 'taxes' },
          title: t('dashboard.todo.incomeDeclarationTitle', { year: previous.label }),
          when: late ? t('dashboard.todo.vatLate') : t('dashboard.todo.vatDue', { when: whenIn(daysLeft) }),
        });
      }
    }
    if (orgType === 'Aktiebolag (AB)' && !filed(`ar:${previous.key}`)) {
      const daysLeft = daysToDue(`${annualReportDeadline(previous.end)}T00:00:00`);
      if (daysLeft <= 30 && daysLeft >= -90) {
        const late = daysLeft < 0;
        rows.push({
          kind: 'annual_report', group: 'tax', sev: late ? 'danger' : 'warning', daysLeft, late,
          tone: late ? 'bad' : 'warn', action: t('dashboard.todo.actionTaxes'), target: { tab: 'taxes' },
          title: t('dashboard.todo.annualReportTitle', { year: previous.label }),
          when: late ? t('dashboard.todo.vatLate') : t('dashboard.todo.annualReportDue', { when: whenIn(daysLeft) }),
        });
      }
    }
  }

  // Första veckan: det som gör kontot klart. Bara för ett nytt konto; ett
  // företag som redan bokför (eller flyttat hit sin historik) får inga
  // "Kom igång"-rader.
  if (verifications.length < 25) {
    const startSteps = [
      { kind: 'start_company', done: Boolean(company?.orgNr && company?.address && (company?.bankgiro || company?.plusgiro || company?.iban)), tab: 'company', title: t('dashboard.start.companyTitle'), detail: t('dashboard.start.companyDetail') },
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
