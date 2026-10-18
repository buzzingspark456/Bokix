import { getDebet, getKredit } from './verificationAmounts';
import { round2 } from './fixedAssets';
import { allocateResult, partnerAccounts, validatePartners } from './partners';
import { inPeriod, periodEnd, periodLabel } from './fiscalYear';

/**
 * Bokslutstransaktionen: årets resultat flyttas från resultatkontona (klass
 * 3–8) till eget kapital, så att resultatkontona står på noll när nästa år
 * börjar.
 *
 * Vart resultatet bokas beror på bolagsformen:
 *   - aktiebolag, ekonomisk förening m.fl.: 2099 Årets resultat
 *   - enskild firma: 2019 Årets resultat (firmans egen kontoserie 2010–2019)
 *   - handels-/kommanditbolag: direkt på varje delägares resultatkonto
 *     (2019, 2029, 2039, 2049), fördelat efter andel
 *
 * Klass 8 (finansiella poster och skatt) ingår. Tidigare stängdes bara
 * klass 3–7, vilket lämnade ränta och bolagsskatt kvar på resultatkontona.
 */

const RESULT_CLASSES = ['3', '4', '5', '6', '7', '8'];

export const isTradingPartnershipType = (orgType) => orgType === 'Handelsbolag / Kommanditbolag';

/** Eget kapital-kontot som årets resultat bokas på (för handels- och
 * kommanditbolag används i stället delägarnas konton, se
 * {@link buildYearEndClosing}). */
export function resultAccountFor(orgType) {
  return orgType === 'Enskild firma' ? '2019' : '2099';
}

/** Nettot (debet − kredit) per resultatkonto för ett kalenderår. Utkast och
 * en tidigare bokslutsverifikation räknas inte. */
export function resultAccountNets(verifications, year) {
  const nets = {};
  (verifications || []).forEach(v => {
    if ((v.status || 'booked') === 'draft' || v.source === 'year_end_close') return;
    if (!inPeriod(v.date, year)) return;
    (v.rows || []).forEach(r => {
      const account = String(r.account || '');
      if (!RESULT_CLASSES.includes(account[0])) return;
      nets[account] = round2((nets[account] || 0) + getDebet(r) - getKredit(r));
    });
  });
  return nets;
}

/** Årets resultat: intäkter minus kostnader, klass 3–8. Positivt = vinst. */
export function computeYearResult(verifications, year) {
  const nets = resultAccountNets(verifications, year);
  return round2(-Object.values(nets).reduce((s, n) => s + n, 0));
}

/** Bokslutsverifikationen för ett år, eller `verification: null` om inga
 * resultatkonton har någon aktivitet. Balanserar alltid: raderna på
 * resultatkontona summerar exakt till resultatet, och eget kapital-raderna
 * bokas med samma belopp. `destination` är eget kapital-kontot, eller
 * 'partners' när resultatet fördelats direkt på delägarna. */
export function buildYearEndClosing({ verifications, year, orgType, partners }) {
  const nets = resultAccountNets(verifications, year);
  const rows = [];
  Object.entries(nets).forEach(([account, net]) => {
    if (!net) return;
    if (net > 0) rows.push({ account, debet: 0, kredit: net });
    else rows.push({ account, debet: -net, kredit: 0 });
  });
  const result = round2(-Object.values(nets).reduce((s, n) => s + n, 0));

  const equityRows = [];
  const pushEquity = (account, amount) => {
    if (!amount) return;
    if (amount > 0) equityRows.push({ account, debet: 0, kredit: amount });
    else equityRows.push({ account, debet: -amount, kredit: 0 });
  };
  let destination = resultAccountFor(orgType);
  if (isTradingPartnershipType(orgType) && validatePartners(partners).length === 0) {
    destination = 'partners';
    allocateResult(result, partners).forEach((share, i) => pushEquity(partnerAccounts(i).resultat, share.amount));
  } else {
    pushEquity(destination, result);
  }

  if (rows.length === 0) return { verification: null, result, destination };
  return {
    verification: {
      date: periodEnd(year),
      description: `Bokslutstransaktion ${periodLabel(year)}: Årets resultat`,
      source: 'year_end_close',
      sourceId: `yearclose_${periodLabel(year)}`,
      rows: [...rows, ...equityRows],
    },
    result,
    destination,
  };
}

/** Dagen efter ett datum (ÅÅÅÅ-MM-DD). */
function dayAfter(date) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Vilka eget kapital-konton som förs över till vilket vid årets början.
 * Aktiebolag, föreningar m.fl.: 2099 Årets resultat → 2098 Vinst eller
 * förlust från föregående år. Enskild firma: 2011–2019 (uttag, insättningar,
 * resultat) → 2010 Eget kapital. HB/KB med delägare: samma sak i varje
 * delägares serie, 20N1–20N9 → 20N0. */
function openingTransferPlan(orgType, partners) {
  if (orgType === 'Enskild firma') {
    return { result: ['2019'], moves: Array.from({ length: 9 }, (_, i) => [String(2011 + i), '2010']) };
  }
  if (isTradingPartnershipType(orgType) && validatePartners(partners).length === 0) {
    const moves = [];
    const result = [];
    partners.forEach((_, i) => {
      const a = partnerAccounts(i);
      result.push(a.resultat);
      for (let n = 1; n <= 9; n++) moves.push([String(Number(a.equity) + n), a.equity]);
    });
    return { result, moves };
  }
  return { result: ['2099'], moves: [['2099', '2098']] };
}

/**
 * Omföringen vid nästa års början, efter bokslutet: årets resultat (och för
 * enskild firma och delägare även årets uttag och insättningar) förs till
 * eget kapital-kontot som gäller över åren. Dateras dagen efter årets slut.
 *
 * `closing` är bokslutsverifikationen som just bokas (finns inte i
 * `verifications` än). Returnerar null när inget finns att föra över, eller
 * när resultatkontot redan rörts efter årets slut (omföringen är redan gjord
 * för hand, t.ex. i ett tidigare program).
 */
export function buildOpeningTransfer({ verifications, year, orgType, partners, closing = null }) {
  const end = periodEnd(year);
  const label = periodLabel(year);
  const plan = openingTransferPlan(orgType, partners);
  const all = [...(verifications || []), ...(closing ? [closing] : [])]
    .filter(v => (v.status || 'booked') !== 'draft' && v.date);
  if (all.some(v => v.date > end && v.source !== 'year_end_close' && (v.rows || []).some(r => plan.result.includes(String(r.account))))) return null;
  if (all.some(v => v.sourceId === `yearopen_${label}`)) return null;

  const balance = new Map(); // kreditsida positiv
  all.forEach(v => {
    if (v.date > end) return;
    (v.rows || []).forEach(r => {
      const code = String(r.account || '');
      if (!code.startsWith('20')) return;
      balance.set(code, round2((balance.get(code) || 0) + getKredit(r) - getDebet(r)));
    });
  });

  const rows = [];
  const toTotals = new Map();
  plan.moves.forEach(([from, to]) => {
    const b = balance.get(from) || 0;
    if (!b) return;
    rows.push(b > 0 ? { account: from, debet: b, kredit: 0 } : { account: from, debet: 0, kredit: -b });
    toTotals.set(to, round2((toTotals.get(to) || 0) + b));
  });
  toTotals.forEach((b, to) => {
    if (!b) return;
    rows.push(b > 0 ? { account: to, debet: 0, kredit: b } : { account: to, debet: -b, kredit: 0 });
  });
  if (rows.length === 0) return null;
  return {
    date: dayAfter(end),
    description: orgType === 'Enskild firma' || isTradingPartnershipType(orgType)
      ? `Omföring av eget kapital ${label}`
      : `Omföring av föregående års resultat ${label}`,
    source: 'year_open_transfer',
    sourceId: `yearopen_${label}`,
    rows,
  };
}

/**
 * Rättelse för ett år som låstes innan bokslutet lärde sig bolagsformen: då
 * bokades årets resultat på 2099 även för en enskild firma, där det ska ligga
 * på 2019. Bokslutsverifikationen ändras inte (en bokförd verifikation rättas
 * med en ny, inte genom att skrivas om); i stället flyttas beloppet mellan de
 * två eget kapital-kontona med en ny verifikation. Returnerar null om
 * resultatet är noll.
 */
export function buildResultReclassification({ year, result, date, from = '2099', to = '2019' }) {
  const amount = round2(result);
  if (!amount) return null;
  const abs = Math.abs(amount);
  return {
    date,
    description: `Flytt av årets resultat ${year} från ${from} till ${to}`,
    source: 'equity_reclass',
    sourceId: `equity_reclass_${year}`,
    rows: amount > 0
      ? [{ account: from, debet: abs, kredit: 0 }, { account: to, debet: 0, kredit: abs }]
      : [{ account: to, debet: abs, kredit: 0 }, { account: from, debet: 0, kredit: abs }],
  };
}

/** Lås som gjordes före rättelsen: har inget `resultAccount` sparat. */
export function legacyLockedYears(lockedFiscalYears) {
  return Object.entries(lockedFiscalYears || {})
    .filter(([, v]) => v && !v.resultAccount && Number(v.result))
    .map(([year, v]) => ({ year, result: Number(v.result) }))
    .sort((a, b) => a.year.localeCompare(b.year));
}
