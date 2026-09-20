import { getDebet, getKredit } from './verificationAmounts';
import { round2 } from './fixedAssets';
import { allocateResult, partnerAccounts, validatePartners } from './partners';

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
    if (!(v.date || '').startsWith(String(year))) return;
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
      date: `${year}-12-31`,
      description: `Bokslutstransaktion ${year}: Årets resultat`,
      source: 'year_end_close',
      sourceId: `yearclose_${year}`,
      rows: [...rows, ...equityRows],
    },
    result,
    destination,
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
