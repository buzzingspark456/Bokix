// Kreditfakturor som reglerar sitt original. En skickad kreditfaktura
// (`creditFor` = originalets fakturanummer) drar av sitt belopp från det som
// är kvar att betala på originalet (`creditedAmount`). Är originalet helt
// krediterat räknas både det och kreditfakturan som reglerade: status 'paid'
// med `paidVia: 'credit'`, så att de inte står kvar som obetalda på Hem, i
// Att göra, i fakturalistan eller i bankmatchningen.
//
// Räknas fram ur fakturalistan varje gång (App.jsx läser fakturorna genom
// applyCreditNotes), aldrig bara sparat: tas kreditfakturan bort eller ändras
// beloppet följer originalet med, och gamla krediteringar rättas utan någon
// datamigrering. Riktiga betalningar ligger kvar i `paidAmount`.
import { invoiceCustomerDue } from './rotRutConfig';

const cache = new WeakMap();
const isCreditNote = (i) => Boolean(i?.creditFor) && i.type !== 'quote';
const settledByCredit = (i) => i.status === 'paid' && i.paidVia === 'credit';

function settle(inv, settled, date) {
  if (settled && (inv.status === 'sent' || inv.status === 'unpaid')) {
    return { ...inv, status: 'paid', paidVia: 'credit', paidDate: date || inv.paidDate };
  }
  if (!settled && settledByCredit(inv)) {
    return { ...inv, status: 'sent', paidVia: undefined, paidDate: undefined };
  }
  return inv;
}

export function applyCreditNotes(invoices) {
  if (!Array.isArray(invoices)) return invoices;
  if (cache.has(invoices)) return cache.get(invoices);

  const notesByNumber = new Map();
  for (const inv of invoices) {
    if (!isCreditNote(inv) || inv.status === 'draft') continue;
    const key = String(inv.creditFor);
    if (!notesByNumber.has(key)) notesByNumber.set(key, []);
    notesByNumber.get(key).push(inv);
  }

  const replaced = new Map();
  for (const orig of invoices) {
    if (isCreditNote(orig) || orig.type === 'quote' || orig.status === 'draft') continue;
    const notes = notesByNumber.get(String(orig.invoiceNumber)) || [];
    const open = Math.max(0, invoiceCustomerDue(orig) - (Number(orig.paidAmount) || 0));
    const credit = notes.reduce((sum, n) => sum + Math.max(0, -invoiceCustomerDue(n)), 0);
    const applied = Math.round(Math.min(credit, open) * 100) / 100;
    const lastDate = notes.reduce((max, n) => (n.date && n.date > max ? n.date : max), '');

    let next = (orig.creditedAmount || 0) === applied ? orig : { ...orig, creditedAmount: applied || undefined };
    next = settle(next, applied > 0 && open - applied <= 0.5, lastDate);
    if (next !== orig) replaced.set(orig.id, next);

    // Kreditfakturorna är reglerade när originalet rymmer hela krediten. Var
    // originalet redan betalt är krediten en skuld till kunden och står kvar.
    const notesSettled = credit > 0 && credit <= open + 0.5;
    for (const n of notes) {
      const nn = settle(n, notesSettled, n.date);
      if (nn !== n) replaced.set(n.id, nn);
    }
  }
  // Kreditfakturor vars original inte längre finns eller inte rymmer dem
  // ska inte stå kvar som reglerade.
  for (const inv of invoices) {
    if (isCreditNote(inv) && settledByCredit(inv) && !replaced.has(inv.id)) {
      const orig = invoices.find(o => !isCreditNote(o) && String(o.invoiceNumber) === String(inv.creditFor));
      if (!orig || inv.status === 'draft') replaced.set(inv.id, settle(inv, false));
    }
  }

  const result = replaced.size ? invoices.map(i => replaced.get(i.id) || i) : invoices;
  cache.set(invoices, result);
  return result;
}
