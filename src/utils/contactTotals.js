// "Senaste faktura" och "Fakturerat i år" i kund- och leverantörslistan.
// Räknas fram ur fakturorna varje gång i stället för att sparas på kontakten:
// de sparade fälten (lastInvoiceDate, totalInvoicedThisYear) sattes till
// null/0 när kontakten skapades och uppdaterades aldrig, så listan visade
// alltid 0 kr.
import { invoiceLineNet } from './invoiceBooking';

/** Fakturans belopp exklusive moms, i kronor. */
export function invoiceNetSek(inv) {
  const rate = Number(inv?.fxRate) > 0 && inv?.currency && inv.currency !== 'SEK' ? Number(inv.fxRate) : 1;
  const net = (inv?.rows || []).reduce((sum, row) => {
    const line = invoiceLineNet(row);
    return sum + (inv.priceInclVat ? line / (1 + (Number(row?.vatRate) || 0) / 100) : line);
  }, 0);
  return Math.round(net * rate * 100) / 100;
}

/**
 * Map kontakt-id → { lastInvoiceDate, totalInvoicedThisYear }.
 * Kunder: skickade/betalda kundfakturor (inte utkast). Leverantörer:
 * leverantörsfakturor och kvitton kopplade med supplierId, exklusive moms.
 */
export function contactTotals({ invoices = [], expenses = [], year = new Date().getFullYear() } = {}) {
  const totals = new Map();
  const add = (id, date, amount) => {
    if (!id || !date) return;
    const entry = totals.get(id) || { lastInvoiceDate: null, totalInvoicedThisYear: 0 };
    if (!entry.lastInvoiceDate || date > entry.lastInvoiceDate) entry.lastInvoiceDate = date;
    if (String(date).startsWith(String(year))) entry.totalInvoicedThisYear += amount;
    totals.set(id, entry);
  };
  for (const inv of invoices) {
    if (inv?.type && inv.type !== 'invoice') continue;
    if (inv?.status === 'draft') continue;
    add(inv?.customerId, inv?.date, invoiceNetSek(inv));
  }
  for (const exp of expenses) {
    add(exp?.supplierId, exp?.date, Number(exp?.netAmount) || 0);
  }
  for (const entry of totals.values()) entry.totalInvoicedThisYear = Math.round(entry.totalInvoicedThisYear);
  return totals;
}
