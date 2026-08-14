/**
 * Nästa fakturanummer i serien. `company.nextInvoiceNumber` (satt under
 * Inställningar → Betalning) fungerar bara som ett GOLV — det kan höja
 * startnumret (t.ex. vid byte från ett annat system), men aldrig sänka det
 * under vad som redan är använt. Det gör inställningen kollisionssäker på
 * datanivå, inte bara via ett fält som validerar i UI:t och sedan kan
 * kringgås.
 *
 * Delad mellan Invoices.jsx (nya fakturor) och Quotes.jsx (offert →
 * faktura-konvertering) — båda måste räkna mot SAMMA serie, annars kan en
 * konverterad offert få samma nummer som en redan skapad faktura.
 */
export function getNextInvoiceNumber(invoiceList, company) {
  const nums = invoiceList.map(i => Number(i.invoiceNumber)).filter(n => !isNaN(n));
  const auto = nums.length > 0 ? Math.max(...nums) + 1 : 1001;
  const floor = Number(company?.nextInvoiceNumber) || 0;
  return String(Math.max(auto, floor));
}
