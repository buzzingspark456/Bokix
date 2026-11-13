// Kvitton över 4 000 kr (2026-11-13). För momsavdrag räcker ett vanligt
// kassakvitto (förenklad faktura) bara upp till 4 000 kr inklusive moms.
// Över det krävs en fullständig faktura med bland annat köparens namn och
// adress (mervärdesskattelagen). Bokix letar efter företagets namn eller
// organisationsnummer i den avlästa texten och varnar om det saknas.

export const SIMPLIFIED_INVOICE_LIMIT = 4000;

const norm = (s) => String(s || '').toLowerCase()
  .replace(/\b(aktiebolag|ab|hb|kb|handelsbolag|ek\.?\s*för\.?|enskild firma)\b/g, ' ')
  .replace(/[^a-z0-9åäöéü]+/g, ' ').trim();

/**
 * 'ok' när köparen står på kvittot, 'missing' när den inte hittas, null när
 * kontrollen inte behövs (4 000 kr eller mindre, eller ingen moms att dra av).
 */
export function buyerDetailsCheck({ grossAmount, vatAmount, vatRate, readText, company }) {
  const gross = Number(grossAmount) || 0;
  const hasVat = (Number(vatAmount) || 0) > 0 || (Number(vatRate) || 0) > 0;
  if (gross <= SIMPLIFIED_INVOICE_LIMIT || !hasVat) return null;
  const text = String(readText || '');
  const orgDigits = String(company?.orgNr || '').replace(/\D/g, '').slice(-10);
  if (orgDigits.length === 10 && text.replace(/\D/g, '').includes(orgDigits)) return 'ok';
  const name = norm(company?.invoiceDisplayName || company?.name);
  if (name.length >= 3 && ` ${norm(text)} `.includes(` ${name} `)) return 'ok';
  return 'missing';
}
