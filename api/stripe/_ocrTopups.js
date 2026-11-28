// Extra kvittoavläsningar (2026-11-28): när planens gräns för månaden är nådd
// kan ägaren köpa 100 till för 25 kr. Beloppet läggs som en fakturapost på
// prenumerationens nästa faktura i Stripe (inget nytt kortformulär), och
// avläsningarna går att använda direkt. Köpen räknas från Stripe, så ingen
// egen tabell behövs: varje post har månaden och företaget i metadata.

export const OCR_TOPUP = { reads: 100, ore: 2500 };

export const topupMonth = (now = new Date()) => now.toISOString().slice(0, 7);

const cache = new Map(); // `${customer}|${company}|${month}` -> { at, count }
const CACHE_MS = 60 * 1000;

/** Antal köpta paket den här månaden för företaget hos Stripe-kunden. */
export async function topupsThisMonth(stripe, customerId, companyId, now = new Date()) {
  if (!stripe || !customerId) return 0;
  const month = topupMonth(now);
  const key = `${customerId}|${companyId || ''}|${month}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.count;
  let count = 0;
  let page = await stripe.invoiceItems.list({ customer: customerId, limit: 100 });
  while (true) {
    for (const item of page.data || []) {
      const md = item.metadata || {};
      if (md.bokix_ocr_month === month && (md.bokix_company || '') === (companyId || '')) count += 1;
    }
    if (!page.has_more || !page.data?.length) break;
    page = await stripe.invoiceItems.list({ customer: customerId, limit: 100, starting_after: page.data[page.data.length - 1].id });
  }
  cache.set(key, { at: Date.now(), count });
  return count;
}

/** Glöm cachen efter ett köp, så att avläsningarna går att använda direkt. */
export function forgetTopups(customerId, companyId, now = new Date()) {
  cache.delete(`${customerId}|${companyId || ''}|${topupMonth(now)}`);
}
