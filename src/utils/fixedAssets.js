import { getDebet, getKredit } from './verificationAmounts';
import { lockedPeriodFor } from './fiscalYear';

/**
 * Anläggningsregister och avskrivningar.
 *
 * Bokix hade inget register alls för anläggningstillgångar — en dator eller
 * en bil bokfördes på 12xx-kontot en gång och därefter fick användaren själv
 * räkna ut och bokföra varje avskrivning. Den här modulen är den enda platsen
 * som räknar avskrivningar; UI:t (FixedAssets.jsx) bara renderar resultatet.
 *
 * Metod: linjär avskrivning per hel månad, från anskaffningsmånaden (eller
 * `startDate` om tillgången togs i bruk senare) och `usefulLifeMonths`
 * månader framåt, ner till `residualValue`. Månadsbeloppet är differensen
 * mellan två ackumulerade summor, avrundade till öre — så summan över hela
 * livslängden blir exakt avskrivningsunderlaget, utan avrundningsrest.
 *
 * Avskrivningar bokförs per månad som EN verifikation (source
 * 'depreciation') med en rad-grupp per tillgång. Vilka tillgångar som redan
 * är bokförda för en månad lagras på verifikationen själv
 * (`depreciationAssetIds`), inte i ett separat fält som kan glida isär.
 */

export const ASSET_CATEGORIES = [
  { id: 'dator', label: 'Datorer och IT-utrustning', assetAccount: '1224', accumulatedAccount: '1229', expenseAccount: '7832', lifeMonths: 36 },
  { id: 'inventarier', label: 'Inventarier och verktyg', assetAccount: '1220', accumulatedAccount: '1229', expenseAccount: '7832', lifeMonths: 60 },
  { id: 'bil', label: 'Bilar och transportmedel', assetAccount: '1226', accumulatedAccount: '1229', expenseAccount: '7832', lifeMonths: 60 },
  { id: 'maskin', label: 'Maskiner och tekniska anläggningar', assetAccount: '1210', accumulatedAccount: '1219', expenseAccount: '7831', lifeMonths: 60 },
  { id: 'byggnad', label: 'Byggnader', assetAccount: '1110', accumulatedAccount: '1119', expenseAccount: '7821', lifeMonths: 600 },
  { id: 'immateriell', label: 'Immateriella tillgångar (programvara m.m.)', assetAccount: '1010', accumulatedAccount: '1019', expenseAccount: '7810', lifeMonths: 60 },
];

export function categoryById(id) {
  return ASSET_CATEGORIES.find(c => c.id === id) || ASSET_CATEGORIES[1];
}

/** Vilken kategori ett tillgångskonto (1010–1299) hör till — används för
 * att föreslå kategori när en redan bokförd anskaffning läggs i registret. */
export function categoryForAccount(code) {
  const c = String(code || '');
  if (c === '1224') return 'dator';
  if (c === '1226') return 'bil';
  if (/^12[1][0-9]$/.test(c)) return 'maskin';
  if (/^12[2-9][0-9]$/.test(c)) return 'inventarier';
  if (/^11[0-9][0-9]$/.test(c)) return 'byggnad';
  if (/^10[0-9][0-9]$/.test(c)) return 'immateriell';
  return null;
}

// Prisbasbeloppet (SCB, förordning per år). Inventarier under ett halvt
// prisbasbelopp får kostnadsföras direkt; över det är de en tillgång.
export const PRICE_BASE_AMOUNT = { 2025: 58800, 2026: 59200, 2027: 59600 };
export function halfPriceBase(date) {
  const y = Number(String(date || '').slice(0, 4));
  const years = Object.keys(PRICE_BASE_AMOUNT).map(Number).sort((a, b) => a - b);
  const year = years.includes(y) ? y : (y > years[years.length - 1] ? years[years.length - 1] : years[0]);
  return PRICE_BASE_AMOUNT[year] / 2;
}

export const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const num = (v) => Number(v) || 0;

function monthOf(dateStr) { return String(dateStr || '').slice(0, 7); }
function monthIndex(ym) {
  const [y, m] = String(ym).split('-').map(Number);
  return y * 12 + (m - 1);
}
function indexToMonth(idx) {
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}
export function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 0).getDate();
  return `${ym}-${String(d).padStart(2, '0')}`;
}

/** Avskrivningsunderlag: anskaffningsvärde minus beräknat restvärde. */
export function depreciableBase(asset) {
  return Math.max(0, round2(num(asset.cost) - num(asset.residualValue)));
}

function startIndex(asset) {
  return monthIndex(monthOf(asset.startDate || asset.acquisitionDate));
}

/** Sista månadsindex som får en avskrivning: livslängdens slut, eller
 * månaden FÖRE avyttringsmånaden om tillgången avyttrats dessförinnan. */
function lastIndex(asset) {
  const life = Math.max(1, Math.round(num(asset.usefulLifeMonths)));
  let last = startIndex(asset) + life - 1;
  if (asset.disposedDate) last = Math.min(last, monthIndex(monthOf(asset.disposedDate)) - 1);
  return last;
}

/** Tidigare avskrivningar från ett annat program: belopp och sista månad. */
function opening(asset) {
  const amount = round2(num(asset.openingAccumulated));
  if (!(amount > 0) || !/^\d{4}-\d{2}$/.test(String(asset.openingMonth || ''))) return null;
  return { amount: Math.min(amount, depreciableBase(asset)), idx: monthIndex(asset.openingMonth) };
}

/** Ackumulerad avskrivning till och med en given månad (YYYY-MM). */
export function accumulatedThrough(asset, ym) {
  if (!asset?.acquisitionDate || !num(asset.usefulLifeMonths)) return 0;
  const life = Math.max(1, Math.round(num(asset.usefulLifeMonths)));
  const start = startIndex(asset);
  const idx = Math.min(monthIndex(ym), lastIndex(asset));
  const n = idx - start + 1;
  if (n <= 0) return 0;
  const op = opening(asset);
  if (op) {
    // Fram till och med openingMonth gäller det som redan skrivits av; sedan
    // fördelas resten jämnt över de månader som återstår av livslängden.
    if (idx <= op.idx) return op.amount;
    const remainingMonths = Math.max(1, start + life - 1 - op.idx);
    const done = Math.min(idx - op.idx, remainingMonths);
    return round2(op.amount + (depreciableBase(asset) - op.amount) * done / remainingMonths);
  }
  return round2(depreciableBase(asset) * Math.min(n, life) / life);
}

/** Avskrivningen för en enskild månad. */
export function depreciationForMonth(asset, ym) {
  const idx = monthIndex(ym);
  if (idx < startIndex(asset) || idx > lastIndex(asset)) return 0;
  // Månader som redan skrivits av i det tidigare programmet bokas inte igen.
  const op = opening(asset);
  if (op && idx <= op.idx) return 0;
  return round2(accumulatedThrough(asset, ym) - accumulatedThrough(asset, indexToMonth(idx - 1)));
}

/** Bokfört värde vid slutet av en månad (anskaffningsvärde minus ackumulerat). */
export function bookValueAt(asset, ym) {
  return round2(num(asset.cost) - accumulatedThrough(asset, ym));
}

/** Hela avskrivningsplanen, en rad per månad. */
export function scheduleOf(asset) {
  if (!asset?.acquisitionDate || !num(asset.usefulLifeMonths)) return [];
  const rows = [];
  for (let idx = startIndex(asset); idx <= lastIndex(asset); idx++) {
    const month = indexToMonth(idx);
    rows.push({
      month,
      amount: depreciationForMonth(asset, month),
      accumulated: accumulatedThrough(asset, month),
      bookValue: bookValueAt(asset, month),
    });
  }
  return rows;
}

/** Månadsavskrivningen i ett normalt läge — för visning i formulär. */
export function monthlyAmount(asset) {
  const life = Math.max(1, Math.round(num(asset.usefulLifeMonths)));
  return round2(depreciableBase(asset) / life);
}

/** Vilka månader som redan har bokförda avskrivningar, per tillgång:
 * Map<månad, Set<tillgångs-id>>. Läser verifikationernas egna fält. */
export function bookedDepreciationMap(verifications) {
  const map = new Map();
  (verifications || []).forEach(v => {
    if (v.source !== 'depreciation' || (v.status || 'booked') === 'draft') return;
    const months = Array.isArray(v.depreciationMonths) && v.depreciationMonths.length ? v.depreciationMonths : [monthOf(v.date)];
    months.forEach(month => {
      if (!map.has(month)) map.set(month, new Set());
      (v.depreciationAssetIds || []).forEach(id => map.get(month).add(id));
    });
  });
  return map;
}

/**
 * Avskrivningar som ännu inte bokförts, fram till och med `untilMonth`.
 * Månader i ett låst räkenskapsår (`lockedYears`) tas ALDRIG med — de
 * räknas i stället i `blockedByLock` så UI:t kan förklara varför något
 * saknas. Resultatet är grupperat per månad, äldst först.
 */
export function pendingDepreciation(assets, verifications, untilMonth, lockedYears = []) {
  const booked = bookedDepreciationMap(verifications);
  // Låsen kommer antingen som en lista kalenderår (äldre anrop) eller som
  // company.lockedFiscalYears, där ett brutet år har start och slut.
  const lockedList = new Set((Array.isArray(lockedYears) ? lockedYears : []).map(String));
  const isLocked = Array.isArray(lockedYears)
    ? (month) => lockedList.has(month.slice(0, 4))
    : (month) => Boolean(lockedPeriodFor(lastDayOfMonth(month), lockedYears));
  const byMonth = new Map();
  let blockedByLock = 0;

  (assets || []).forEach(asset => {
    if (!asset?.acquisitionDate || !num(asset.usefulLifeMonths)) return;
    for (let idx = startIndex(asset); idx <= Math.min(lastIndex(asset), monthIndex(untilMonth)); idx++) {
      const month = indexToMonth(idx);
      const amount = depreciationForMonth(asset, month);
      if (amount <= 0) continue;
      if (booked.get(month)?.has(asset.id)) continue;
      if (isLocked(month)) { blockedByLock += 1; continue; }
      if (!byMonth.has(month)) byMonth.set(month, []);
      byMonth.get(month).push({ asset, amount });
    }
  });

  const months = [...byMonth.keys()].sort().map(month => ({
    month,
    items: byMonth.get(month),
    total: round2(byMonth.get(month).reduce((s, i) => s + i.amount, 0)),
  }));
  return { months, blockedByLock, total: round2(months.reduce((s, m) => s + m.total, 0)) };
}

/** En verifikation för en månads avskrivningar (alla tillgångar samlade).
 * Debet-raderna slås ihop per kostnadskonto och kredit-raderna per
 * ackumulerat konto, så verifikationen blir kort även med många tillgångar. */
export function buildDepreciationVerification(month, items) {
  const debet = new Map();
  const kredit = new Map();
  items.forEach(({ asset, amount }) => {
    debet.set(asset.expenseAccount, round2((debet.get(asset.expenseAccount) || 0) + amount));
    kredit.set(asset.accumulatedAccount, round2((kredit.get(asset.accumulatedAccount) || 0) + amount));
  });
  return {
    date: lastDayOfMonth(month),
    description: `Avskrivningar ${month}`,
    source: 'depreciation',
    sourceId: `depreciation_${month}`,
    depreciationAssetIds: items.map(i => i.asset.id),
    rows: [
      ...[...debet].map(([account, amount]) => ({ account, debet: amount, kredit: 0 })),
      ...[...kredit].map(([account, amount]) => ({ account, debet: 0, kredit: amount })),
    ],
  };
}

/**
 * Årsvis avskrivning (som Bokio "Årsvis"): de obokade månaderna samlas per
 * räkenskapsår och bokas som en verifikation på årets sista dag. Bara år som
 * har slutat (slutdatum senast `today`) tas med.
 * `yearOf(month)` ger { key, label, end } för räkenskapsåret månaden ligger i.
 */
export function pendingByYear(pending, yearOf, today) {
  const years = new Map();
  pending.months.forEach(m => {
    const fy = yearOf(m.month);
    if (!fy || fy.end > today) return;
    if (!years.has(fy.key)) years.set(fy.key, { ...fy, months: [], byAsset: new Map() });
    const y = years.get(fy.key);
    y.months.push(m.month);
    m.items.forEach(({ asset, amount }) => {
      const cur = y.byAsset.get(asset.id) || { asset, amount: 0 };
      cur.amount = round2(cur.amount + amount);
      y.byAsset.set(asset.id, cur);
    });
  });
  return [...years.values()].sort((a, b) => a.end.localeCompare(b.end)).map(y => {
    const items = [...y.byAsset.values()];
    return { key: y.key, label: y.label, end: y.end, months: y.months, items, total: round2(items.reduce((s, i) => s + i.amount, 0)) };
  });
}

export function buildYearDepreciationVerification(year) {
  const v = buildDepreciationVerification(year.end.slice(0, 7), year.items);
  return { ...v, date: year.end, description: `Avskrivningar ${year.label}`, sourceId: `depreciation_year_${year.key}`, depreciationMonths: year.months };
}

/**
 * Omföring när ett köp bokförts som kostnad (5410) men är en tillgång:
 * D tillgångskontot, K kostnadskontot.
 */
export function buildReclassVerification(asset, fromAccount, date) {
  const amount = round2(num(asset.cost));
  return {
    date,
    description: `Omföring till tillgång: ${asset.name}`,
    source: 'asset_reclass',
    sourceId: `reclass_${asset.id}`,
    rows: [{ account: asset.assetAccount, debet: amount, kredit: 0 }, { account: fromAccount, debet: 0, kredit: amount }],
  };
}

/**
 * Avyttring eller utrangering. Balanserar per konstruktion: debet =
 * ackumulerade avskrivningar + försäljningspris + ev. förlust, kredit =
 * anskaffningsvärde + ev. vinst. Moms på försäljningen ingår INTE — priset
 * här är exkl. moms, momsen bokförs separat.
 */
export function buildDisposalVerification(asset, { date, proceeds = 0, proceedsAccount = '1930' }) {
  // Samma regel som avskrivningsplanen: avskrivning t.o.m. månaden FÖRE
  // avyttringsmånaden. Utan `disposedDate` här räknades avyttringsmånaden med.
  const accumulated = accumulatedThrough({ ...asset, disposedDate: date }, monthOf(date));
  const cost = round2(num(asset.cost));
  const price = round2(num(proceeds));
  const result = round2(price + accumulated - cost);
  const rows = [];
  if (accumulated > 0) rows.push({ account: asset.accumulatedAccount, debet: accumulated, kredit: 0 });
  if (price > 0) rows.push({ account: proceedsAccount, debet: price, kredit: 0 });
  rows.push({ account: asset.assetAccount, debet: 0, kredit: cost });
  if (result > 0) rows.push({ account: '3973', debet: 0, kredit: result });
  if (result < 0) rows.push({ account: '7970', debet: -result, kredit: 0 });
  return {
    date,
    description: `${price > 0 ? 'Försäljning' : 'Utrangering'} av ${asset.name}`,
    source: 'asset_disposal',
    sourceId: `disposal_${asset.id}`,
    rows,
  };
}

/**
 * Bokförda anskaffningar på tillgångskonton som ännu inte ligger i
 * registret — så användaren inte behöver skriva av beloppet från en
 * verifikation som redan finns. Ackumulerade avskrivningskonton (slutar på
 * 8/9) och pågående nyanläggningar (128x) hoppas över.
 */
export function unregisteredAcquisitions(verifications, assets, { includeExpensed = false } = {}) {
  const linked = new Set((assets || []).map(a => a.sourceVerificationId).filter(Boolean));
  const out = [];
  (verifications || []).forEach(v => {
    if ((v.status || 'booked') === 'draft') return;
    if (['depreciation', 'asset_disposal', 'year_end_close', 'accrual', 'inventory', 'asset_reclass', 'accrual_spread'].includes(v.source)) return;
    if (linked.has(v.id)) return;
    (v.rows || []).forEach(r => {
      const code = String(r.account || '');
      // Förbrukningsinventarier (5410–5419) över ett halvt prisbasbelopp ska vara en
      // tillgång. Förslaget bokför omföringen när det läggs i registret.
      // Bara förbrukningsinventarier (5410–5419); programvara och licenser (5420) är kostnader.
      if (/^541[0-9]$/.test(code)) {
        // Bara där sidan bokför omföringen (nya Tillgångar); annars skulle
        // kostnaden både ligga kvar på 5410 och skrivas av.
        if (!includeExpensed) return;
        const amount = round2(getDebet(r) - getKredit(r));
        if (amount >= halfPriceBase(v.date)) {
          const category = /dator|laptop|macbook|pc\b|server|skärm|iphone|telefon/i.test(v.description || '') ? 'dator' : 'inventarier';
          out.push({ verificationId: v.id, date: v.date, description: v.description || '', account: categoryById(category).assetAccount, amount, category, reclassFrom: code });
        }
        return;
      }
      if (!/^1[01][0-9]{2}$|^12[0-9]{2}$/.test(code)) return;
      if (/[89]$/.test(code) || /^128/.test(code)) return;
      const category = categoryForAccount(code);
      if (!category) return;
      const amount = getDebet(r) - getKredit(r);
      if (amount <= 0) return;
      out.push({
        verificationId: v.id, date: v.date, description: v.description || '', account: code, amount: round2(amount), category,
      });
    });
  });
  return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/** Summering av registret vid slutet av en månad. Avyttrade tillgångar
 * räknas inte som kvarvarande efter avyttringsmånaden. */
export function registerSummary(assets, ym) {
  let cost = 0;
  let accumulated = 0;
  (assets || []).forEach(asset => {
    if (!asset?.acquisitionDate) return;
    if (monthOf(asset.acquisitionDate) > ym) return;
    if (asset.disposedDate && monthOf(asset.disposedDate) <= ym) return;
    cost += num(asset.cost);
    accumulated += accumulatedThrough(asset, ym);
  });
  return { cost: round2(cost), accumulated: round2(accumulated), bookValue: round2(cost - accumulated) };
}
