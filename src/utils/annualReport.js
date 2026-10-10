/**
 * Årsredovisning för ett mindre aktiebolag enligt K2 (BFNAR 2016:10).
 *
 * Siffrorna kommer ur samma beräkningar som INK2R (ink2r.js och
 * ink2rResultat.js), eftersom INK2R:s rader följer årsredovisningens
 * uppställning. Resultaträkningen är kostnadsslagsindelad och
 * balansräkningen följer ÅRL:s uppställning för mindre företag. Här räknas
 * bara siffrorna fram; PDF:en byggs i annualReportPdf.js och formuläret
 * finns i AnnualReport.jsx.
 */
import { computeInk2r, unclosedResult } from './ink2r';
import { computeInk2rResultat } from './ink2rResultat';
import { isBooked } from './reportCalculations';
import { getDebet, getKredit } from './verificationAmounts';
import { periodLabel } from './fiscalYear';
import { t } from '../i18n';

// Bolagsskatten, för justerat eget kapital i soliditeten (obeskattade
// reserver räknas in med avdrag för uppskjuten skatt).
export const CORPORATE_TAX_RATE = 0.206;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const endOfDay = (isoDate) => new Date(`${isoDate}T23:59:59`);

/** Räkenskapsåret före `fy` ({ start, end }). Ett avvikande första år
 * (company.firstFiscalYear) används om det slutar dagen före. */
export function previousFiscalYear(fy, company) {
  const dayBefore = new Date(`${fy.start}T12:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const end = iso(dayBefore);
  const first = company?.firstFiscalYear;
  if (first?.start && first?.end === end) return withLabel({ start: first.start, end: first.end });
  const start = new Date(`${fy.start}T12:00:00`);
  start.setFullYear(start.getFullYear() - 1);
  return withLabel({ start: iso(start), end });
}

function withLabel({ start, end }) {
  const label = periodLabel({ start, end });
  return { start, end, label, key: label, isCalendar: /^\d{4}$/.test(label) };
}

/** Sista dag att lämna in till Bolagsverket: sju månader efter räkenskapsårets slut. */
export function annualReportDeadline(fyEnd) {
  return monthsAfterYearEnd(fyEnd, 7);
}

/** Sista dag för årsstämman: sex månader efter räkenskapsårets slut (ABL 7 kap. 10 §). */
export function agmDeadline(fyEnd) {
  return monthsAfterYearEnd(fyEnd, 6);
}

function monthsAfterYearEnd(fyEnd, months) {
  const d = new Date(`${fyEnd}T12:00:00`);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  // Slutar året på en månads sista dag är fristen också en sista dag.
  const lastOfFyMonth = new Date(`${fyEnd}T12:00:00`);
  const fyMonthLast = new Date(lastOfFyMonth.getFullYear(), lastOfFyMonth.getMonth() + 1, 0).getDate();
  d.setDate(day === fyMonthLast ? last : Math.min(day, last));
  return iso(d);
}

const hasBookings = (verifications, period) => verifications.some(v => isBooked(v) && v.date >= period.start && v.date <= period.end);

// ── Resultaträkning ──────────────────────────────────────────────────────
// Rubrikerna i K2:s kostnadsslagsindelade uppställning, med INK2R-raderna
// som bygger upp dem. `sign` är 1 för intäkter och -1 för kostnader, så att
// kostnader visas med minustecken som i en årsredovisning.
const RR_SECTIONS = [
  { title: 'Rörelseintäkter, lagerförändringar m.m.', rows: [
    ['3.1', 'Nettoomsättning', 1], ['3.2', 'Förändring av lager av produkter i arbete, färdiga varor och pågående arbete för annans räkning', 1],
    ['3.3', 'Aktiverat arbete för egen räkning', 1], ['3.4', 'Övriga rörelseintäkter', 1],
  ], sum: 'Summa rörelseintäkter, lagerförändringar m.m.' },
  { title: 'Rörelsekostnader', rows: [
    ['3.5', 'Råvaror och förnödenheter', -1], ['3.6', 'Handelsvaror', -1], ['3.7', 'Övriga externa kostnader', -1],
    ['3.8', 'Personalkostnader', -1], ['3.9', 'Av- och nedskrivningar av materiella och immateriella anläggningstillgångar', -1],
    ['3.10', 'Nedskrivningar av omsättningstillgångar utöver normala nedskrivningar', -1], ['3.11', 'Övriga rörelsekostnader', -1],
  ], sum: 'Summa rörelsekostnader' },
  { result: 'Rörelseresultat' },
  { title: 'Finansiella poster', rows: [
    ['3.12', 'Resultat från andelar i koncernföretag', 1], ['3.13', 'Resultat från andelar i intresseföretag och gemensamt styrda företag', 1],
    ['3.14', 'Resultat från övriga företag som det finns ett ägarintresse i', 1], ['3.15', 'Resultat från övriga finansiella anläggningstillgångar', 1],
    ['3.16', 'Övriga ränteintäkter och liknande resultatposter', 1], ['3.17', 'Nedskrivningar av finansiella anläggningstillgångar och kortfristiga placeringar', -1],
    ['3.18', 'Räntekostnader och liknande resultatposter', -1],
  ], sum: 'Summa finansiella poster' },
  { result: 'Resultat efter finansiella poster' },
  { title: 'Bokslutsdispositioner', rows: [
    ['3.19', 'Lämnade koncernbidrag', -1], ['3.20', 'Mottagna koncernbidrag', 1], ['3.21', 'Återföring av periodiseringsfond', 1],
    ['3.22', 'Avsättning till periodiseringsfond', -1], ['3.23', 'Förändring av överavskrivningar', 1], ['3.24', 'Övriga bokslutsdispositioner', 1],
  ], sum: 'Summa bokslutsdispositioner' },
  { result: 'Resultat före skatt' },
  { title: 'Skatter', rows: [['3.25', 'Skatt på årets resultat', -1]] },
  { result: 'Årets resultat' },
];

// ink2rResultat ger intäktsrader positiva och kostnadsrader som positiva
// kostnader; här blir allt ett resultatbidrag med tecken.
function resultContributions(verifications, period) {
  const { rows } = computeInk2rResultat(verifications, period);
  const byRow = new Map();
  for (const r of rows) {
    if (r.row === '3.26' || r.row === '3.27') continue;
    byRow.set(r.row, r.polarity === 'revenue' ? r.amount : -r.amount);
  }
  return byRow;
}

function buildIncomeStatement(current, previous) {
  const lines = [];
  let runCur = 0;
  let runPrev = 0;
  const keyFigures = {};
  for (const sec of RR_SECTIONS) {
    if (sec.result) {
      lines.push({ kind: 'result', label: sec.result, current: runCur, previous: runPrev });
      keyFigures[sec.result] = { current: runCur, previous: runPrev };
      continue;
    }
    const rows = sec.rows
      .map(([row, label]) => ({ kind: 'row', row, label, current: current.get(row) || 0, previous: previous.get(row) || 0 }))
      .filter(r => Math.abs(r.current) >= 0.5 || Math.abs(r.previous) >= 0.5);
    if (rows.length === 0) continue;
    lines.push({ kind: 'heading', label: sec.title });
    lines.push(...rows);
    const sumCur = rows.reduce((s, r) => s + r.current, 0);
    const sumPrev = rows.reduce((s, r) => s + r.previous, 0);
    if (sec.sum && rows.length > 1) lines.push({ kind: 'sum', label: sec.sum, current: sumCur, previous: sumPrev });
    runCur += sumCur;
    runPrev += sumPrev;
  }
  return { lines, keyFigures, netSales: { current: current.get('3.1') || 0, previous: previous.get('3.1') || 0 } };
}

// ── Balansräkning ────────────────────────────────────────────────────────
const BR_ASSETS = [
  { title: t('ui.anlaggningstillgangar'), groups: [
    ['Immateriella anläggningstillgångar', [['2.1', 'Koncessioner, patent, licenser, varumärken samt liknande rättigheter'], ['2.2', 'Förskott avseende immateriella anläggningstillgångar']]],
    ['Materiella anläggningstillgångar', [['2.3', 'Byggnader och mark'], ['2.4', 'Maskiner och inventarier'], ['2.5', 'Förbättringsutgifter på annans fastighet'], ['2.6', 'Pågående nyanläggningar och förskott avseende materiella anläggningstillgångar']]],
    ['Finansiella anläggningstillgångar', [['2.7', 'Andelar i koncernföretag'], ['2.8', 'Andelar i intresseföretag och gemensamt styrda företag'], ['2.9', 'Ägarintressen i övriga företag och andra långfristiga värdepappersinnehav'], ['2.10', 'Fordringar hos koncern-, intresse- och gemensamt styrda företag'], ['2.11', 'Lån till delägare eller närstående'], ['2.12', 'Andra långfristiga fordringar']]],
  ] },
  { title: 'Omsättningstillgångar', groups: [
    ['Varulager m.m.', [['2.13', 'Råvaror och förnödenheter'], ['2.14', 'Varor under tillverkning'], ['2.15', 'Färdiga varor och handelsvaror'], ['2.16', 'Övriga lagertillgångar'], ['2.17', 'Pågående arbete för annans räkning'], ['2.18', 'Förskott till leverantörer']]],
    ['Kortfristiga fordringar', [['2.19', 'Kundfordringar'], ['2.20', 'Fordringar hos koncern-, intresse- och gemensamt styrda företag'], ['2.21', 'Övriga fordringar'], ['2.22', 'Upparbetad men ej fakturerad intäkt'], ['2.23', 'Förutbetalda kostnader och upplupna intäkter']]],
    ['Kortfristiga placeringar', [['2.24', 'Andelar i koncernföretag'], ['2.25', 'Övriga kortfristiga placeringar']]],
    ['Kassa och bank', [['2.26', 'Kassa och bank']]],
  ] },
];
const BR_LIABILITIES = [
  { title: 'Obeskattade reserver', groups: [[null, [['2.29', 'Periodiseringsfonder'], ['2.30', 'Ackumulerade överavskrivningar'], ['2.31', 'Övriga obeskattade reserver']]]] },
  { title: 'Avsättningar', groups: [[null, [['2.32', 'Avsättningar för pensioner och liknande förpliktelser enligt lagen (1967:531) om tryggande av pensionsutfästelse m.m.'], ['2.33', 'Övriga avsättningar för pensioner och liknande förpliktelser'], ['2.34', 'Övriga avsättningar']]]] },
  { title: 'Långfristiga skulder', groups: [[null, [['2.35', 'Obligationslån'], ['2.36', 'Checkräkningskredit'], ['2.37', 'Övriga skulder till kreditinstitut'], ['2.38', 'Skulder till koncern-, intresse- och gemensamt styrda företag'], ['2.39', 'Övriga skulder']]]] },
  { title: 'Kortfristiga skulder', groups: [[null, [['2.40', 'Checkräkningskredit'], ['2.41', 'Övriga skulder till kreditinstitut'], ['2.42', 'Förskott från kunder'], ['2.43', 'Pågående arbete för annans räkning'], ['2.44', 'Fakturerad men ej upparbetad intäkt'], ['2.45', 'Leverantörsskulder'], ['2.46', 'Växelskulder'], ['2.47', 'Skulder till koncern-, intresse- och gemensamt styrda företag'], ['2.48', 'Övriga skulder'], ['2.49', 'Skatteskulder'], ['2.50', 'Upplupna kostnader och förutbetalda intäkter']]]] },
];

const rowAmounts = (ink2r) => new Map(ink2r.rows.map(r => [r.row, r.amount]));

function buildSections(spec, cur, prev) {
  const out = [];
  for (const sec of spec) {
    const groups = [];
    for (const [title, rows] of sec.groups) {
      const lines = rows
        .map(([row, label]) => ({ row, label, current: cur.get(row) || 0, previous: prev.get(row) || 0 }))
        .filter(r => Math.abs(r.current) >= 0.5 || Math.abs(r.previous) >= 0.5);
      if (lines.length === 0) continue;
      groups.push({ title, lines, current: lines.reduce((s, r) => s + r.current, 0), previous: lines.reduce((s, r) => s + r.previous, 0) });
    }
    if (groups.length === 0) continue;
    out.push({ title: sec.title, groups, current: groups.reduce((s, g) => s + g.current, 0), previous: groups.reduce((s, g) => s + g.previous, 0) });
  }
  return out;
}

// ── Eget kapital ─────────────────────────────────────────────────────────
// Aktiebolagets eget kapital per konto: 2081 aktiekapital, 2082 ej
// registrerat aktiekapital, 2085 uppskrivningsfond, 2086 reservfond, 2087
// bunden överkursfond (bundet); 2091-2098 balanserat resultat och 2097
// överkursfond (fritt); 2099 årets resultat.
function equityAt(verifications, asOf) {
  const bal = new Map();
  for (const v of verifications) {
    if (!isBooked(v) || !v.date || v.date > asOf) continue;
    for (const r of v.rows || []) {
      const code = String(r.account || '');
      if (!code.startsWith('20')) continue;
      bal.set(code, (bal.get(code) || 0) + getKredit(r) - getDebet(r));
    }
  }
  const sum = (pred) => [...bal.entries()].filter(([c]) => pred(Number(c))).reduce((s, [, v]) => s + v, 0);
  return {
    shareCapital: sum(c => c >= 2081 && c <= 2084),
    restricted: sum(c => c >= 2085 && c <= 2089),
    retained: sum(c => c >= 2090 && c <= 2098),
    resultAccount: sum(c => c === 2099),
  };
}

function buildEquity(verifications, fy, yearResult) {
  const dayBefore = new Date(`${fy.start}T12:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const open = equityAt(verifications, iso(dayBefore));
  const close = equityAt(verifications, fy.end);
  // Fritt eget kapital = balanserat resultat (2090-2098) + 2099 + resultat
  // som ännu inte förts över i ett bokslut. Årets resultat är alltid
  // resultaträkningens belopp; resten räknas som balanserat. Då blir det
  // rätt både före och efter att bokslutet bokförts, och även om ett
  // tidigare års resultat aldrig flyttats från 2099.
  const freeAt = (eq, date) => eq.retained + eq.resultAccount + unclosedResult(verifications, endOfDay(date));
  const closeResult = yearResult;
  const closeRetained = freeAt(close, fy.end) - yearResult;
  // Vid årets ingång står förra årets resultat (2099 och det som inte
  // bokförts i bokslut) under Årets resultat; dispositionsraden flyttar det
  // till balanserat resultat, med eventuell utdelning.
  const openRetained = open.retained;
  const openResult = freeAt(open, iso(dayBefore)) - open.retained;
  const columns = [
    { key: 'shareCapital', label: 'Aktiekapital', open: open.shareCapital, close: close.shareCapital },
    ...(Math.abs(open.restricted) >= 0.5 || Math.abs(close.restricted) >= 0.5
      ? [{ key: 'restricted', label: 'Övrigt bundet kapital', open: open.restricted, close: close.restricted }] : []),
    { key: 'retained', label: 'Balanserat resultat', open: openRetained, close: closeRetained },
    { key: 'result', label: t('ui.arets_resultat'), open: openResult, close: closeResult },
  ];
  for (const c of columns) {
    c.yearResult = c.key === 'result' ? closeResult : 0;
    c.other = c.close - c.open - c.yearResult;
  }
  return {
    columns,
    restrictedTotal: close.shareCapital + close.restricted,
    freeTotal: closeRetained + closeResult,
    retained: closeRetained,
    yearResult: closeResult,
    total: close.shareCapital + close.restricted + closeRetained + closeResult,
  };
}

// ── Noter ────────────────────────────────────────────────────────────────
// Materiella anläggningstillgångar per BAS-grupp: anskaffningsvärden på
// kontona som inte slutar på 8 eller 9, ackumulerade avskrivningar på de
// som slutar på 9 (t.ex. 1229) och nedskrivningar på 8.
const ASSET_NOTE_GROUPS = [
  { title: 'Byggnader och mark', from: 1100, to: 1199 },
  { title: 'Maskiner och inventarier', from: 1200, to: 1299 },
];

function assetNote(verifications, fy, group) {
  const dayBefore = new Date(`${fy.start}T12:00:00`);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const openDate = iso(dayBefore);
  const acc = { costOpen: 0, costIn: 0, costOut: 0, depOpen: 0, depYear: 0, depOut: 0 };
  for (const v of verifications) {
    if (!isBooked(v) || !v.date || v.date > fy.end) continue;
    const inYear = v.date >= fy.start;
    for (const r of v.rows || []) {
      const n = Number(r.account);
      if (!(n >= group.from && n <= group.to)) continue;
      const net = getDebet(r) - getKredit(r);
      const isDep = String(r.account).endsWith('9') || String(r.account).endsWith('8');
      if (isDep) {
        if (!inYear) acc.depOpen += net;
        else if (net < 0) acc.depYear += net;
        else acc.depOut += net;
      } else if (!inYear) acc.costOpen += net;
      else if (net > 0) acc.costIn += net;
      else acc.costOut += net;
    }
  }
  if (openDate < fy.start && [acc.costOpen, acc.costIn, acc.costOut, acc.depOpen, acc.depYear].every(x => Math.abs(x) < 0.5)) return null;
  const costClose = acc.costOpen + acc.costIn + acc.costOut;
  const depClose = acc.depOpen + acc.depYear + acc.depOut;
  return { title: group.title, ...acc, costClose, depClose, bookValue: costClose + depClose };
}

/**
 * Hela årsredovisningens innehåll för räkenskapsåret `fy` ({ start, end, label }).
 * `details` är det användaren fyller i (verksamhet, styrelse, utdelning m.m.).
 */
export function computeAnnualReport({ verifications = [], accounts = [], company, fy, details = {}, employeesAverage }) {
  const prevFy = previousFiscalYear(fy, company);
  const hasPrevious = hasBookings(verifications, prevFy);

  const income = buildIncomeStatement(
    resultContributions(verifications, { start: fy.start, end: fy.end }),
    hasPrevious ? resultContributions(verifications, { start: prevFy.start, end: prevFy.end }) : new Map(),
  );
  const yearResult = income.keyFigures['Årets resultat'].current;

  const curBr = computeInk2r(verifications, accounts, endOfDay(fy.end));
  const prevBr = hasPrevious ? computeInk2r(verifications, accounts, endOfDay(prevFy.end)) : { rows: [], totalAssets: 0 };
  const cur = rowAmounts(curBr);
  const prev = rowAmounts(prevBr);
  const assets = buildSections(BR_ASSETS, cur, prev);
  const equity = buildEquity(verifications, fy, yearResult);
  const prevEquity = hasPrevious ? buildEquity(verifications, prevFy, income.keyFigures['Årets resultat'].previous) : null;
  const liabilities = buildSections(BR_LIABILITIES, cur, prev);
  const totalAssets = assets.reduce((s, x) => s + x.current, 0);
  const totalAssetsPrev = assets.reduce((s, x) => s + x.previous, 0);
  const totalEqLiab = equity.total + liabilities.reduce((s, x) => s + x.current, 0);
  const totalEqLiabPrev = (prevEquity?.total || 0) + liabilities.reduce((s, x) => s + x.previous, 0);

  // Flerårsöversikt: räkenskapsåret och upp till tre föregående år med bokföring.
  const years = [fy];
  let p = fy;
  for (let i = 0; i < 3; i++) {
    p = previousFiscalYear(p, company);
    if (!hasBookings(verifications, p)) break;
    years.push(p);
  }
  const overview = years.map(y => {
    const contrib = resultContributions(verifications, { start: y.start, end: y.end });
    const inc = buildIncomeStatement(contrib, new Map());
    const br = computeInk2r(verifications, accounts, endOfDay(y.end));
    const rows = rowAmounts(br);
    const eqY = buildEquity(verifications, y, inc.keyFigures['Årets resultat'].current);
    const untaxed = (rows.get('2.29') || 0) + (rows.get('2.30') || 0) + (rows.get('2.31') || 0);
    const total = br.totalAssets;
    const solidity = total > 0 ? (eqY.total + untaxed * (1 - CORPORATE_TAX_RATE)) / total * 100 : null;
    return { label: y.label, netSales: inc.netSales.current, resultAfterFinancial: inc.keyFigures['Resultat efter finansiella poster']?.current || 0, solidity };
  });

  const dividend = Math.max(0, Number(details.dividend) || 0);
  const available = equity.freeTotal;
  const notes = ASSET_NOTE_GROUPS.map(g => assetNote(verifications, fy, g)).filter(Boolean);

  const warnings = [];
  if (Math.abs(totalAssets - totalEqLiab) >= 1) warnings.push(t('ui.balansrakningen_gar_inte_ihop_tillgangarna_ar_kr', { v0: Math.round(totalAssets), v1: Math.round(totalEqLiab) }));
  if (curBr.unmatched?.length) warnings.push(t('ui.konto_i_balansrakningen_har_ingen_plats_i_uppsta', { length: curBr.unmatched.length, v1: curBr.unmatched.length === 1 ? '' : 'n', v2: curBr.unmatched.map(a => a.code).join(', ') }));
  if (dividend > available + 0.5) warnings.push(t('ui.foreslagen_utdelning_kr_ar_storre_an_det_fria_eg', { v0: Math.round(dividend), v1: Math.round(available) }));
  if (!details.boardMembers || !String(details.boardMembers).trim()) warnings.push(t('ui.fyll_i_styrelsens_ledamoter_de_skriver_under_ars'));

  return {
    fy, prevFy, hasPrevious,
    income,
    yearResult,
    balance: {
      assets, liabilities, equity, prevEquity,
      totalAssets, totalAssetsPrev, totalEqLiab, totalEqLiabPrev,
    },
    overview,
    disposition: {
      retained: equity.retained,
      yearResult: equity.yearResult,
      available,
      dividend,
      carriedForward: available - dividend,
    },
    employeesAverage: Number.isFinite(Number(details.employeesAverage)) && details.employeesAverage !== '' && details.employeesAverage != null
      ? Number(details.employeesAverage) : (employeesAverage ?? 0),
    notes,
    warnings,
  };
}

/**
 * Medelantalet anställda under räkenskapsåret, ur bokförda lönekörningar:
 * antal anställda med lön varje månad, summerat och delat med årets antal
 * månader, avrundat till hela personer. Förslag som användaren kan ändra.
 */
export function averageEmployees(payrollRuns, fy) {
  const byMonth = new Map();
  for (const run of payrollRuns || []) {
    const month = String(run.period || '').slice(0, 7);
    if (!month || `${month}-01` < fy.start.slice(0, 7) + '-01' || `${month}-01` > fy.end) continue;
    if (run.completedSteps && !run.completedSteps.includes('booked')) continue;
    const set = byMonth.get(month) || new Set();
    for (const row of run.rows || []) set.add(row.employeeId || row.employeeSnapshot?.id || row.name);
    byMonth.set(month, set);
  }
  const start = new Date(`${fy.start}T12:00:00`);
  const end = new Date(`${fy.end}T12:00:00`);
  const months = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
  const total = [...byMonth.values()].reduce((s, set) => s + set.size, 0);
  return months > 0 ? Math.round(total / months) : 0;
}
