import { round2 } from './fixedAssets';

/**
 * Prissättning av varor och tjänster.
 *
 * Skillnaden mellan påslag och marginal är den vanligaste förväxlingen i
 * småföretags prissättning — 50 % påslag är 33 % marginal, inte 50 %:
 *
 *   påslag   = (pris − kostnad) / kostnad
 *   marginal = (pris − kostnad) / pris          (bruttomarginal)
 *
 * Alla priser här är exkl. moms om inget annat anges.
 */

const num = (v) => Number(v) || 0;

export function markupPct(price, cost) {
  const c = num(cost);
  return c > 0 ? round2((num(price) - c) / c * 100) : null;
}

export function marginPct(price, cost) {
  const p = num(price);
  return p > 0 ? round2((p - num(cost)) / p * 100) : null;
}

/** Pris som ger en viss marginal. Marginal ≥ 100 % går inte att nå. */
export function priceFromMargin(cost, targetMarginPct) {
  const m = num(targetMarginPct) / 100;
  if (m >= 1 || m < 0) return null;
  return round2(num(cost) / (1 - m));
}

export function priceFromMarkup(cost, markup) {
  const k = num(markup) / 100;
  return k < 0 ? null : round2(num(cost) * (1 + k));
}

export function withVat(price, vatRate) { return round2(num(price) * (1 + num(vatRate) / 100)); }
export function withoutVat(gross, vatRate) { return round2(num(gross) / (1 + num(vatRate) / 100)); }

/** Avrundar ett pris till ett "snyggt" pris. */
export function roundPrice(price, mode = 'none') {
  const p = num(price);
  if (mode === 'krona') return Math.round(p);
  if (mode === 'nine') return Math.max(0, Math.ceil(p / 10) * 10 - 1);
  return round2(p);
}

/** Vad blir marginalen efter en rabatt? Rabatten sänker priset men inte
 * kostnaden, så marginalen faller snabbare än rabatten. */
export function marginAfterDiscount(price, cost, discountPct) {
  return marginPct(num(price) * (1 - num(discountPct) / 100), cost);
}

/** Högsta rabatt som ännu ger minst `minMarginPct` marginal. */
export function maxDiscountForMargin(price, cost, minMarginPct) {
  const p = num(price);
  if (p <= 0) return null;
  const floor = priceFromMargin(cost, minMarginPct);
  if (floor == null || floor > p) return 0;
  return round2((1 - floor / p) * 100);
}

/** Antal enheter som krävs för att täcka de fasta kostnaderna. */
export function breakEvenUnits(fixedCosts, price, variableCostPerUnit) {
  const contribution = num(price) - num(variableCostPerUnit);
  if (contribution <= 0) return null;
  return Math.ceil(num(fixedCosts) / contribution);
}

/** Timpris för en tjänst: (månadens kostnader + önskat uttag) fördelat på
 * debiterbara timmar, plus en buffert. */
export function hourlyRate({ monthlyCosts, desiredMonthlyPay, billableHoursPerMonth, bufferPct = 0 }) {
  const hours = num(billableHoursPerMonth);
  if (hours <= 0) return null;
  const base = (num(monthlyCosts) + num(desiredMonthlyPay)) / hours;
  return round2(base * (1 + num(bufferPct) / 100));
}

/** Prisstatus för en artikel mot en målmarginal — styr listan på
 * Prissättning-fliken. */
export function pricingStatus(article, targetMarginPct) {
  const cost = num(article.purchasePrice);
  if (!cost) return { status: 'no_cost' };
  const margin = marginPct(article.unitPrice, cost);
  const suggested = priceFromMargin(cost, targetMarginPct);
  if (margin == null) return { status: 'no_price', suggested };
  if (margin < 0) return { status: 'loss', margin, markup: markupPct(article.unitPrice, cost), suggested };
  return {
    status: margin + 1e-9 >= num(targetMarginPct) ? 'ok' : 'below',
    margin, markup: markupPct(article.unitPrice, cost), suggested,
  };
}
