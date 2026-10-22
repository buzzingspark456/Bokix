import { invoiceLineNet } from './invoiceBooking';
import { STATSLANERANTA } from './ink2s';

/**
 * Återbäring (gottgörelse) i ekonomisk förening: en del av överskottet
 * lämnas tillbaka till medlemmarna efter hur mycket var och en har handlat
 * med föreningen under året.
 *
 * KÄLLOR, kontrollerade 2026-10-22:
 *  - Lag (2018:672) om ekonomiska föreningar 14 kap.: gottgörelse är
 *    efterlikvid, återbäring eller liknande som grundas på verksamhetens
 *    resultat. Föreningsstämman beslutar (eller styrelsen efter bemyndigande
 *    eller enligt stadgarna); styrelsen upprättar ett förslag (14 kap. 3 §).
 *  - BFNAR 2016:10 (K2) 15.13 och 4.14: redovisas när beslutet fattas, som
 *    bokslutsdisposition i posten Lämnad gottgörelse (BAS 8840).
 *  - Inkomstskattelagen 39 kap. 22 §: en kooperativ förening drar av
 *    återbäring i förhållande till köp eller försäljningar. Får medlemmarna
 *    den skattefritt (privatpersoner, 42 kap. 14 §) och är de fler än
 *    enstaka, är avdraget högst 80 % av statslåneräntan i slutet av november
 *    året före det år beskattningsåret slutar, gånger medlemmarnas omsättning
 *    med föreningen (räntan minst 0 %). 39 kap. 24 §: avdraget görs det år
 *    som beslutet avser, även när stämman beslutar året efter.
 */

export const REFUND_COST_ACCOUNT = '8840';
export const REFUND_LIABILITY_ACCOUNT = '2890';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Medlemmarnas omsättning med föreningen under året, ur fakturorna:
 * 'purchases' = medlemmarna köper av föreningen (kundfakturor exkl. moms,
 * krediteringar drar av), 'sales' = medlemmarna säljer till föreningen
 * (leverantörsfakturor exkl. moms). Ett förslag, användaren kan ändra.
 */
export function memberTurnover({ basis = 'purchases', invoices = [], expenses = [], contacts = [], period }) {
  const inYear = (d) => d && d >= period.start && d <= period.end;
  const sums = new Map();
  if (basis === 'sales') {
    for (const e of expenses) {
      if (e.type !== 'supplier_invoice' || !e.supplierId || !inYear(e.date)) continue;
      sums.set(e.supplierId, (sums.get(e.supplierId) || 0) + (Number(e.netAmount) || 0) * (Number(e.fxRate) || 1));
    }
  } else {
    for (const inv of invoices) {
      if (!inv.customerId || inv.status === 'draft' || !inYear(inv.date)) continue;
      const net = (inv.rows || []).reduce((s, r) => s + invoiceLineNet(r), 0) * (Number(inv.fxRate) || 1);
      sums.set(inv.customerId, (sums.get(inv.customerId) || 0) + net);
    }
  }
  return [...sums.entries()]
    .map(([contactId, turnover]) => ({ contactId, name: contacts.find(c => c.id === contactId)?.name || '', turnover: Math.round(turnover) }))
    .filter(m => m.turnover > 0)
    .sort((a, b) => b.turnover - a.turnover);
}

/**
 * Återbäringen per medlem. mode 'percent': procent av omsättningen.
 * mode 'amount': beloppet fördelas efter omsättning i hela kronor, så att
 * summan blir exakt beloppet (största resten får de kronor som blir över).
 */
export function computeRefund(refund) {
  const members = (refund?.members || []).map(m => ({ ...m, turnover: Math.max(0, Number(m.turnover) || 0) }));
  const totalTurnover = members.reduce((s, m) => s + m.turnover, 0);
  let shares;
  if (refund?.mode === 'percent') {
    const pct = Math.max(0, Number(refund.percent) || 0);
    shares = members.map(m => Math.round(m.turnover * pct / 100));
  } else {
    const amount = Math.max(0, Math.round(Number(refund?.amount) || 0));
    if (!totalTurnover) shares = members.map(() => 0);
    else {
      const exact = members.map(m => amount * m.turnover / totalTurnover);
      shares = exact.map(Math.floor);
      let left = amount - shares.reduce((s, x) => s + x, 0);
      const order = exact.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
      for (let k = 0; left > 0 && k < order.length; k++, left--) shares[order[k][1]] += 1;
    }
  }
  const perMember = members.map((m, i) => ({ ...m, refund: shares[i] }));
  const total = perMember.reduce((s, m) => s + m.refund, 0);
  return { perMember, total, totalTurnover };
}

/** Avdragstaket enligt 39 kap. 22 § andra stycket, eller null när inget tak gäller. */
export function refundDeductionCap(refund, totalTurnover) {
  if (!refund?.privateMembers) return { cap: null, rate: null };
  const year = Number(String(refund.fyEnd || '').slice(0, 4));
  const rate = STATSLANERANTA[year];
  if (rate == null) return { cap: null, rate: null, unknownRate: true };
  return { cap: Math.round(0.8 * Math.max(0, rate) / 100 * totalTurnover), rate };
}

/** Bokas beslutet samma räkenskapsår som återbäringen avser? */
export const decidedWithinYear = (refund) => Boolean(refund?.decisionDate && refund.fyEnd && refund.decisionDate <= refund.fyEnd);

export function refundSummary(refund) {
  const c = computeRefund(refund);
  const capInfo = refundDeductionCap(refund, c.totalTurnover);
  const deductible = capInfo.cap == null ? c.total : Math.min(c.total, capInfo.cap);
  return { ...c, ...capInfo, deductible, nonDeductible: c.total - deductible, withinYear: decidedWithinYear(refund) };
}

export function buildRefundDecision(refund, total) {
  const amount = round2(total);
  return {
    date: refund.decisionDate,
    description: `Återbäring till medlemmarna, räkenskapsår ${refund.fyLabel}`,
    source: 'patronage_refund',
    sourceId: `refund_${refund.id}`,
    rows: [
      { account: REFUND_COST_ACCOUNT, debet: amount, kredit: 0 },
      { account: REFUND_LIABILITY_ACCOUNT, debet: 0, kredit: amount },
    ],
  };
}

export function buildRefundPayment(refund, total, { date, bankAccount = '1930' }) {
  const amount = round2(total);
  return {
    date,
    description: `Utbetalning av återbäring, räkenskapsår ${refund.fyLabel}`,
    source: 'patronage_refund',
    sourceId: `refund_${refund.id}_payment`,
    rows: [
      { account: REFUND_LIABILITY_ACCOUNT, debet: amount, kredit: 0 },
      { account: bankAccount, debet: 0, kredit: amount },
    ],
  };
}

export function refundStatus(refund, verifications) {
  const ids = new Set((verifications || [])
    .filter(v => v.source === 'patronage_refund' && (v.status || 'booked') !== 'draft')
    .map(v => v.sourceId));
  return { decided: ids.has(`refund_${refund.id}`), paid: ids.has(`refund_${refund.id}_payment`) };
}

/**
 * Justeringar i INK2S för räkenskapsåret fy:
 *  - Återbäring som avser året men beslutas efter årets slut finns inte i
 *    årets resultat: den avdragsgilla delen dras av i 4.4b.
 *  - Återbäring som bokförts under året men avser ett tidigare år är redan
 *    avdragen (eller inte avdragsgill): hela beloppet läggs tillbaka i 4.3c.
 *  - Återbäring som avser och bokförts under året: delen över taket läggs
 *    tillbaka i 4.3c.
 */
export function refundInk2sAdjustments({ refunds = [], verifications = [], fy }) {
  let deduct = 0;
  let addBack = 0;
  const inFy = (d) => d && d >= fy.start && d <= fy.end;
  for (const r of refunds) {
    const s = refundSummary(r);
    if (!s.total) continue;
    const relatesToFy = inFy(r.fyEnd);
    const booked = refundStatus(r, verifications).decided;
    if (relatesToFy && s.withinYear) {
      if (booked) addBack += s.nonDeductible;
    } else if (relatesToFy) {
      deduct += s.deductible;
    } else if (booked && inFy(r.decisionDate)) {
      addBack += s.total;
    }
  }
  const out = {};
  if (Math.round(deduct) > 0) out['4.4b'] = Math.round(deduct);
  if (Math.round(addBack) > 0) out['4.3c'] = Math.round(addBack);
  return out;
}

/** Föreslagen återbäring som stämman ska besluta om efter årets slut, för årsredovisningen. */
export function proposedRefundFor(refunds = [], fy) {
  const list = refunds.filter(r => r.fyEnd === fy.end && !decidedWithinYear(r));
  const total = list.reduce((s, r) => s + computeRefund(r).total, 0);
  return { total, basis: list[0]?.basis || 'purchases' };
}

/**
 * Avdrag för utdelning på insatser i en kooperativ förening (IL 39 kap. 23
 * och 24 §§), det år beslutet avser. Utdelning på medlemsinsatser som
 * mottagaren inte beskattas för (aktiebolag och andra företag, där andelen
 * är näringsbetingad enligt 24 kap. 35 §) dras inte av, utom när den delen
 * är högst tio procent av utdelningen. Utdelning på förlagsinsatser dras
 * alltid av och räknas därför inte in i `toCompanies`. Medlemsfrämjande
 * föreningar och kooperativa hyresrättsföreningar har särskilda regler och
 * ska svara nej på `cooperative`.
 */
export function coopDividendDeduction({ dividend = 0, cooperative, toCompanies = 0 } = {}) {
  const total = Math.max(0, Math.round(Number(dividend) || 0));
  if (!total || cooperative !== true) return { dividend: total, deductible: 0, nonTaxed: 0, smallShare: false };
  const nonTaxed = Math.min(total, Math.max(0, Math.round(Number(toCompanies) || 0)));
  const smallShare = nonTaxed > 0 && nonTaxed <= total * 0.1;
  return { dividend: total, nonTaxed, smallShare, deductible: smallShare ? total : total - nonTaxed };
}
