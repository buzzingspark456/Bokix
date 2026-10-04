// Kontrollen av en SIE4-fil innan import (SieImportModal.jsx): vad som är fel,
// varför, vad man gör åt det, och de rättelser Bokix kan göra själv. Förut
// stoppades importen bara med "N verifikationer balanserar inte"; nu får man
// veta orsaken och ett val, som i Fortnox och Igdrasil.
//
// Tre sorters problem:
//  - Ingående balans går inte ihop. Nästan alltid för att föregående år inte
//    är avslutat i det gamla programmet: årets resultat har inte förts till
//    eget kapital, så den sidan saknas i filen. Skillnaden är då förra årets
//    resultat. Rättelse: boka skillnaden på 2098 Vinst eller förlust från
//    föregående år (aktiebolag) eller 2010 Eget kapital (övriga).
//  - En verifikation går inte ihop på några ören (avrundning i det gamla
//    programmet). Rättelse: en rad på 3740 Öres- och kronutjämning.
//  - En verifikation går inte ihop med mer än en krona. Den rättas inte
//    automatiskt; den kan hoppas över, eller rättas i det gamla programmet.

const EPS = 0.005;
const ROUNDING_LIMIT = 1; // kr
const cents = (v) => Math.round((Number(v) || 0) * 100) / 100;

function totals(rows) {
  const debet = cents(rows.reduce((s, r) => s + (Number(r.debet) || 0), 0));
  const kredit = cents(rows.reduce((s, r) => s + (Number(r.kredit) || 0), 0));
  return { debet, kredit, diff: cents(debet - kredit) };
}

const isEquity = (code) => /^20\d\d$/.test(String(code));
const isResultAccount = (code) => Number(code) >= 3000 && Number(code) <= 8999;

/** Kontot en skillnad i ingående balans bokas på, efter företagsformen. */
export function equityAccountFor(companyType, accountsByCode) {
  // #FTYP i filen avgör. Saknas den: ett aktiekapitalkonto (2081) betyder aktiebolag.
  const ab = companyType ? /^(AB|BAB)$/i.test(companyType) : Boolean(accountsByCode?.has?.('2081'));
  return ab
    ? { code: '2098', name: 'Vinst eller förlust från föregående år' }
    : { code: '2010', name: 'Eget kapital' };
}

/**
 * Problemen i en importförhandsgranskning.
 * `opening`: ingående balans-verifikationen (eller null).
 * `verifications`: övriga verifikationer (med series, sieNumber, date, description, rows).
 * Returnerar { opening, rounding, unbalanced } där varje del är null om allt
 * stämmer.
 */
export function checkSieImport({ opening, verifications = [], companyType = null, accountsByCode = null }) {
  let openingProblem = null;
  if (opening && opening.rows?.length) {
    const t = totals(opening.rows);
    if (Math.abs(t.diff) > EPS) {
      const hasEquity = opening.rows.some(r => isEquity(r.account));
      const resultRows = opening.rows.filter(r => isResultAccount(r.account));
      const equity = equityAccountFor(companyType, accountsByCode);
      openingProblem = {
        ...t,
        // Resultatkonton hör inte hemma i en ingående balans: då är filen
        // exporterad från fel ställe, och skillnaden ska inte bokas bort.
        cause: resultRows.length > 0 ? 'result_accounts' : (!hasEquity ? 'equity_missing' : 'not_closed'),
        resultAccounts: resultRows.map(r => r.account),
        equity,
      };
    }
  }

  const rounding = [];
  const unbalanced = [];
  verifications.forEach((v, index) => {
    const t = totals(v.rows || []);
    if (Math.abs(t.diff) <= EPS) return;
    const item = { index, label: `${v.series || ''}${v.sieNumber || ''}`.trim() || `#${index + 1}`, date: v.date, description: v.description || '', ...t };
    if (Math.abs(t.diff) <= ROUNDING_LIMIT) rounding.push(item);
    else unbalanced.push(item);
  });

  return {
    opening: openingProblem,
    rounding: rounding.length ? rounding : null,
    unbalanced: unbalanced.length ? unbalanced : null,
  };
}

/** Raden som får en verifikation att gå ihop: kredit om debet är större, annars debet. */
function balancingRow(diff, account, accountName) {
  return diff > 0
    ? { account, accountName, debet: 0, kredit: cents(diff) }
    : { account, accountName, debet: cents(-diff), kredit: 0 };
}

/**
 * Verifikationerna med de rättelser användaren valt:
 * { bookOpeningDifference, roundOff, skipUnbalanced }.
 * Rättade verifikationer märks (`sieFix`) så att det syns i verifikationen
 * varifrån raden kom.
 */
export function applySieFixes({ opening, verifications = [] }, check, choices = {}) {
  let fixedOpening = opening;
  if (opening && check.opening && choices.bookOpeningDifference && check.opening.cause !== 'result_accounts') {
    const { code, name } = check.opening.equity;
    fixedOpening = {
      ...opening,
      rows: [...opening.rows, balancingRow(check.opening.diff, code, name)],
      balanced: true,
      sieFix: 'opening_difference',
    };
  }

  const roundIdx = new Set((check.rounding || []).map(r => r.index));
  const skipIdx = new Set(choices.skipUnbalanced ? (check.unbalanced || []).map(r => r.index) : []);
  const fixedVerifications = [];
  verifications.forEach((v, i) => {
    if (skipIdx.has(i)) return;
    if (roundIdx.has(i) && choices.roundOff) {
      const diff = totals(v.rows).diff;
      fixedVerifications.push({ ...v, rows: [...v.rows, balancingRow(diff, '3740', 'Öres- och kronutjämning')], balanced: true, sieFix: 'rounding' });
      return;
    }
    fixedVerifications.push(v);
  });
  return { opening: fixedOpening, verifications: fixedVerifications };
}
