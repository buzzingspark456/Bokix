import { getDebet, getKredit } from './verificationAmounts';
import { t, dateLocale } from '../i18n';
import { dateTimeFormat } from './intlCache';

/**
 * Rapport och analys (Sida 14) ska ALDRIG visa påhittad eller hårdkodad
 * exempeldata — varje siffra här härleds från faktiskt bokförda
 * verifikationer. Den här modulen är den enda platsen som räknar ut de
 * siffrorna, så Reports.jsx bara har att rendera resultatet.
 *
 * Utkast (`status === 'draft'`) räknas aldrig med — samma princip som
 * kontosaldona i App.jsx (getAccountBalances) och Dashboard.
 */
export function isBooked(ver) {
  return (ver?.status || 'booked') !== 'draft';
}

/** Bokslutsverifikationen (Skatt och bokslut, "Lås räkenskapsåret") flyttar
 * årets resultat till eget kapital och nollställer alla resultatkonton den
 * 31 december. Den är en riktig verifikation och ska synas i huvudbok och
 * balansräkning, men får aldrig räknas med i resultat-, kostnads- och
 * marginalsummor — då blev ett låst år helt tomt i rapporterna, INK2R och
 * NE-förslaget. */
export function isClosingEntry(ver) {
  return ver?.source === 'year_end_close';
}

/** BAS-kontoplanens klass avgör kontotyp om kontot saknar ett explicit
 * `type`-fält (t.ex. ett konto en användare lagt till manuellt utan att
 * välja typ). Klass 1 = tillgång, 2 = eget kapital/skuld, 3 = intäkt,
 * 4–8 = kostnad. Klass 9 (bokslutskonton) räknas som kostnad/intäkt
 * beroende på tecken och hanteras inte särskilt här. */
export function classifyAccount(account) {
  if (!account) return null;
  if (account.type) return account.type;
  const first = String(account.code || '')[0];
  if (first === '1') return 'tillgang';
  if (first === '2') return 'skuld_kapital';
  if (first === '3') return 'intakt';
  if (['4', '5', '6', '7', '8'].includes(first)) return 'kostnad';
  return null;
}

/** Bank- och kassakonton enligt spec: 1900–1999. */
export function isCashAccount(account) {
  const code = Number(account?.code);
  return Number.isFinite(code) && code >= 1900 && code <= 1999;
}

function toDate(d) {
  if (d instanceof Date) return d;
  return new Date(`${d}T00:00:00`);
}

// Verifikationernas datum i genomgångarna nedan: samma datumsträng tolkas
// en gång. Startsidan går igenom alla verifikationer flera gånger per månad
// i diagrammet, och ett nytt Date för varje rad varje gång var den största
// kostnaden vid start hos ett företag med några tusen verifikationer.
// Datumen här läses bara, de ändras aldrig.
const parsedDates = new Map();
function verDate(s) {
  let d = parsedDates.get(s);
  if (!d) {
    if (parsedDates.size > 20000) parsedDates.clear();
    d = toDate(s);
    parsedDates.set(s, d);
  }
  return d;
}
// Bugkritiskt: INTE d.toISOString().slice(0, 10) — toISOString() konverterar
// till UTC, och alla datum i den här filen är lokal midnatt (t.ex.
// startOfMonth). I en positiv UTC-offset (Sverige, UTC+1/+2) blir det då
// FÖREGÅENDE dag — 1 jan lokal midnatt blir "2025-12-31" i UTC. Verifierat:
// likviditetsgrafens datumetiketter visade fel dag för varje svensk
// användare innan den här fixen. getFullYear/getMonth/getDate läser lokal
// tid, ingen UTC-konvertering inblandad.
function fmtISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function addYears(d, n) {
  const copy = new Date(d);
  copy.setFullYear(copy.getFullYear() + n);
  return copy;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function startOfQuarter(d) { const q = Math.floor(d.getMonth() / 3); return new Date(d.getFullYear(), q * 3, 1); }
function endOfQuarter(d) { const q = Math.floor(d.getMonth() / 3); return new Date(d.getFullYear(), q * 3 + 3, 0); }

/** Företagets räkenskapsårsinställning för fiscalYearBounds och
 * periodfunktionerna nedan, inklusive ett avvikande första år. */
export function companyFiscalYearSetting(company) {
  if (!company) return undefined;
  return company.firstFiscalYear ? { fiscalYear: company.fiscalYear, firstFiscalYear: company.firstFiscalYear } : company.fiscalYear;
}

/** Räkenskapsårets start baseras på företagets faktiska inställning
 * (company.fiscalYear lagrar räkenskapsårets startdatum — bara
 * månad/dag används här för att hitta INNEVARANDE räkenskapsår). */
export function fiscalYearBounds(setting, referenceDate) {
  // `setting` är antingen company.fiscalYear (en datumsträng, som förut) eller
  // companyFiscalYearSetting(company). Med det senare gäller ett förlängt
  // eller förkortat första räkenskapsår (company.firstFiscalYear) för datum
  // inom det; därefter följer åren company.fiscalYear som vanligt.
  let fiscalYearStr = setting;
  if (setting && typeof setting === 'object') {
    const first = setting.firstFiscalYear;
    if (first?.start && first?.end) {
      const fs = toDate(first.start);
      const fe = toDate(first.end);
      if (referenceDate >= fs && referenceDate <= new Date(fe.getFullYear(), fe.getMonth(), fe.getDate(), 23, 59, 59)) {
        return { start: fs, end: fe };
      }
    }
    fiscalYearStr = setting.fiscalYear;
  }
  const configured = fiscalYearStr ? toDate(fiscalYearStr) : new Date(referenceDate.getFullYear(), 0, 1);
  const month = configured.getMonth();
  const day = configured.getDate();
  let start = new Date(referenceDate.getFullYear(), month, day);
  if (start > referenceDate) start = new Date(referenceDate.getFullYear() - 1, month, day);
  const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate());
  end.setDate(end.getDate() - 1);
  return { start, end };
}

/**
 * Räknar ut start/slut för vald period, plus jämförelseperioden
 * (exakt samma datumintervall ett år tidigare — "föregående räkenskapsårs
 * motsvarande period"). `end` kapas alltid vid dagens datum, så en
 * pågående månad/kvartal/år jämförs mot samma antal dagar förra året
 * istället för att jämföra en hel period mot en pågående.
 */
export function getPeriodBounds(periodId, { referenceDate = new Date(), fiscalYearStart, customStart, customEnd } = {}) {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  let start, naturalEnd, label;

  if (periodId === 'month') {
    start = startOfMonth(today); naturalEnd = endOfMonth(today); label = 'Denna månad';
  } else if (periodId === 'quarter') {
    start = startOfQuarter(today); naturalEnd = endOfQuarter(today); label = 'Detta kvartal';
  } else if (periodId === 'last12') {
    start = new Date(today.getFullYear(), today.getMonth() - 11, 1); naturalEnd = today; label = 'Senaste 12 månaderna';
  } else if (periodId === 'custom' && customStart && customEnd) {
    start = toDate(customStart); naturalEnd = toDate(customEnd); label = 'Anpassad period';
  } else {
    const fy = fiscalYearBounds(fiscalYearStart, today);
    start = fy.start; naturalEnd = fy.end; label = 'Detta räkenskapsår';
  }

  const end = naturalEnd < today ? naturalEnd : today;
  const prevStart = addYears(start, -1);
  const prevEnd = addYears(end, -1);

  return { start, end, prevStart, prevEnd, label, isFiscalYear: label === 'Detta räkenskapsår' };
}

/** Tidigaste bokförda datumet över huvud taget — underlag för "Sedan
 * start" (overviewPeriodBounds nedan): det datumet ÄR periodens start, det
 * finns inget fast antal dagar/månader att räkna bakåt från som för de
 * andra flikarna. `null` om företaget inte har någon bokföring alls (ett
 * helt nytt konto) — anroparen faller då tillbaka på dagens datum, vilket
 * ger en tom (men inte trasig) period, samma princip som resten av
 * rapportportalen använder för "inget bokfört ännu". */
function earliestBookedDate(verifications) {
  let min = null;
  for (const ver of (verifications || [])) {
    if (!isBooked(ver) || !ver.date) continue;
    const d = verDate(ver.date);
    if (!min || d < min) min = d;
  }
  return min;
}

/** Datumintervall för Företagsöversiktens period-flikar — kundönskemål:
 * "jag vill kunna kolla hela året, 3 månader, 1 månad, 6 månader, sedan
 * start" på översiktssidan, inte bara ett fast val. Fem flikar, valda för
 * att täcka de faktiskt användbara tidshorisonterna för en bokförings-
 * översikt utan att bli en godtycklig lista:
 *   - 'month'/'q3'/'q6' — rullande "hittills"-fönster (den här månaden,
 *     de tre/sex senaste) för att se en KORT trend i detalj.
 *   - 'year' — räkenskapsåret, appens egen huvudperiod (moms/skatt räknas
 *     mot den, se getPeriodBounds ovan) snarare än ett generiskt
 *     "senaste 12 månaderna" som inte skulle stämma mot bokslutet.
 *   - 'all' — hela historiken, för frågan "hur går det EGENTLIGEN för
 *     bolaget" bortom ett enskilt år.
 * Jämförelseperioden (prevStart/prevEnd) är EXAKT samma datumintervall ett
 * år tidigare för de fyra rullande/räkenskapsårs-flikarna — samma "mot
 * samma period föregående år"-konvention som getPeriodBounds ovan använder
 * för resten av rapportportalen. 'all' har per definition ingen
 * jämförelseperiod (det fanns inget företag "året innan starten") —
 * `hasComparison: false` signalerar det till anroparen (ReportDetail.jsx)
 * så den kan UTELÄMNA en missvisande "0 kr förra året"-jämförelse istället
 * för att visa en teknisk sanning som läses som ett påstående om tillväxt.
 * `granularity` styr om buildResultSeries/buildCashflowSeries ovan ska
 * bucketa per dag eller per kalendermånad — en enda kalendermånad har för
 * få naturliga buckets (bara start+slut) för en läsbar stapel-/linjegraf
 * om den inte delas upp per dag. */
export function overviewPeriodBounds(periodId, { fiscalYearStart, referenceDate = new Date(), verifications } = {}) {
  const now = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  if (periodId === 'month') {
    // Kundgenomgång (två motstridiga önskemål efter varandra, löst genom
    // att fråga): perioden stannar vid IDAG — visar bara dagar som faktiskt
    // hänt (t.ex. "1–5 sep." den 5:e), aldrig tomma framtida dagar. `now`
    // beräknas om VARJE gång den här funktionen anropas (inget cachat/
    // hårdkodat datum) — i morgon, när "idag" blir den 6:e, blir `end`
    // automatiskt den 6:e utan någon egen kod för det; det är bara vad
    // `new Date()` (referenceDate) ger för färskt värde den dagen.
    const start = startOfMonth(now);
    const naturalEnd = endOfMonth(now);
    const end = naturalEnd < now ? naturalEnd : now;
    return {
      start, end,
      prevStart: addYears(start, -1), prevEnd: addYears(end, -1),
      granularity: 'day', label: t('ui.denna_manad'), hasComparison: true,
    };
  }
  if (periodId === 'q3') {
    const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const end = now;
    return {
      start, end,
      prevStart: addYears(start, -1), prevEnd: addYears(end, -1),
      granularity: 'month', label: t('ui.senaste_3_manaderna'), hasComparison: true,
    };
  }
  if (periodId === 'q6') {
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const end = now;
    return {
      start, end,
      prevStart: addYears(start, -1), prevEnd: addYears(end, -1),
      granularity: 'month', label: t('ui.senaste_6_manaderna'), hasComparison: true,
    };
  }
  // Senaste tolv månaderna, innevarande månad inräknad (startsidans "Senaste 12 mån").
  if (periodId === 'last12') {
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const end = now;
    return {
      start, end,
      prevStart: addYears(start, -1), prevEnd: addYears(end, -1),
      granularity: 'month', label: t('ui.senaste_12_manaderna'), hasComparison: true,
    };
  }
  if (periodId === 'all') {
    const start = startOfMonth(earliestBookedDate(verifications) || now);
    return {
      start, end: now,
      // Nollängdsintervall (inte "ett år tidigare") — det finns ingen
      // meningsfull jämförelseperiod före starten, se hasComparison nedan.
      prevStart: start, prevEnd: start,
      granularity: 'month', label: t('ui.sedan_start'), hasComparison: false,
    };
  }
  // 'year' (default) — hela innevarande räkenskapsår, kapat vid dagens datum.
  const { start: fyStart, end: fyNaturalEnd } = fiscalYearBounds(fiscalYearStart, now);
  const end = fyNaturalEnd < now ? fyNaturalEnd : now;
  return {
    start: fyStart, end,
    prevStart: addYears(fyStart, -1), prevEnd: addYears(end, -1),
    granularity: 'month', label: t('ui.rakenskapsaret_period'), hasComparison: true,
  };
}

/** Summerar ett kontoflöde (intäkt eller kostnad) för perioden. Intäkter är
 * kreditnormerade (kredit − debet), kostnader debetnormerade (debet − kredit) —
 * så resultatet blir ett positivt tal för "normal" bokföring i båda fallen. */
export function sumFlowByType(verifications, accounts, type, start, end) {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  let total = 0;
  for (const ver of verifications) {
    if (!isBooked(ver) || isClosingEntry(ver) || !ver.date) continue;
    const d = verDate(ver.date);
    if (d < start || d > end) continue;
    for (const row of ver.rows || []) {
      const acc = byCode.get(row.account);
      if (classifyAccount(acc) !== type) continue;
      total += type === 'intakt' ? getKredit(row) - getDebet(row) : getDebet(row) - getKredit(row);
    }
  }
  return total;
}

/** Kostnadsfördelning per konto för perioden, störst först — svarar på
 * "vart tar mina pengar vägen?". */
export function groupCostsByAccount(verifications, accounts, start, end) {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const sums = new Map();
  for (const ver of verifications) {
    if (!isBooked(ver) || isClosingEntry(ver) || !ver.date) continue;
    const d = verDate(ver.date);
    if (d < start || d > end) continue;
    for (const row of ver.rows || []) {
      const acc = byCode.get(row.account);
      if (classifyAccount(acc) !== 'kostnad') continue;
      const amount = getDebet(row) - getKredit(row);
      sums.set(row.account, (sums.get(row.account) || 0) + amount);
    }
  }
  const rows = [...sums.entries()]
    .map(([code, amount]) => ({ code, name: byCode.get(code)?.name || code, amount }))
    .filter(r => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return { rows, total };
}

// Sida 14c: kostnadsfördelningens ringdiagram grupperar i fyra breda
// hinkar (Personal/Lokal/Marknadsföring/Övrigt) istället för per konto —
// lättare att läsa som ett diagram än 15+ enskilda kontoskivor. Gränserna
// följer BAS 2023:s kontoklassindelning (klass 5 = lokal, 59xx = reklam/PR
// inom klass 5, klass 7 = personal); allt annat i kostnadsklasserna 4–8
// hamnar i "Övrigt" snarare än att gissa en finare indelning utan stöd
// i kontoplanen.
// Buggrapport från riktig data: ett företag vars kostnader till 99,9% låg på
// 6110 Kontorsmaterial fick ringdiagrammet "Övrigt 263 978 kr (100%)" plus en
// osynlig "Personal 295 kr (0%)"-skiva — alltså ett diagram som inte sa
// någonting alls. Orsaken var att reglerna nedan bara kände igen klass 7
// (personal) och två spann i klass 5: HELA klass 4 (varor/material) och HELA
// klass 6 (övriga externa kostnader — där 6110 bor, och där en stor del av ett
// litet bolags kostnader faktiskt ligger) föll rakt igenom till "Övrigt".
// Nu täcks alla kostnadsklasser (4–8) enligt BAS egen indelning.
const COST_CATEGORIES = ['Personal', 'Lokal', 'Marknadsföring', 'Varor och material', 'Övriga externa kostnader', 'Övrigt'];

function categoryForAccount(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return t('ui.ovrigt');
  if (n >= 4000 && n < 5000) return t('ui.varor_och_material');
  if (n >= 5000 && n < 5200) return 'Lokal';
  if (n >= 5900 && n < 6000) return t('ui.marknadsforing');
  if (n >= 5200 && n < 7000) return t('ui.ovriga_externa_kostnader'); // inkl. 6xxx (6110 m.fl.)
  if (n >= 7000 && n < 7700) return 'Personal';
  return t('ui.ovrigt'); // 77xx–79xx av-/nedskrivningar, 8xxx finansiellt, okända koder
}

/** Kostnadsfördelning i fyra kategorier (för ringdiagrammet) istället för
 * per konto — samma underliggande radsummering som groupCostsByAccount,
 * bara buckets:ad annorlunda. */
export function groupCostsByCategory(verifications, accounts, start, end) {
  const { rows } = groupCostsByAccount(verifications, accounts, start, end);
  const sums = new Map();
  for (const r of rows) {
    const cat = categoryForAccount(r.code);
    sums.set(cat, (sums.get(cat) || 0) + r.amount);
  }
  const total = rows.reduce((s, r) => s + r.amount, 0);
  // `colorIndex` = platsen i den FASTA kategorilistan, inte i den filtrerade
  // utdatan. Utan det byter en kategori färg så fort en annan råkar bli tom
  // (bokför man sin första lokalkostnad skulle Personal plötsligt måla om
  // sig) — "färgen följer posten, aldrig dess ordningsnummer", se
  // dataviz-skillens anti-mönster "recolor-on-filter".
  const categories = COST_CATEGORIES
    .map((name, colorIndex) => ({ name, colorIndex, amount: sums.get(name) || 0 }))
    .filter(c => c.amount > 0);
  return { categories, total };
}

/** Faktiskt bank-/kassasaldo vid en given tidpunkt, ackumulerat
 * kronologiskt från samtliga bokförda verifikationer fram till och med
 * det datumet — inte ett separat, potentiellt inaktuellt sparat fält. */
export function computeCashBalanceAt(verifications, accounts, uptoDate) {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  let total = 0;
  for (const ver of verifications) {
    if (!isBooked(ver) || !ver.date) continue;
    if (verDate(ver.date) > uptoDate) continue;
    for (const row of ver.rows || []) {
      const acc = byCode.get(row.account);
      if (!isCashAccount(acc)) continue;
      total += getDebet(row) - getKredit(row);
    }
  }
  return total;
}

/** Serie av {date, balance}-punkter för likviditetsgrafen: en punkt per
 * kalendermånad inom perioden plus periodens slutdatum, var och en det
 * verkliga ackumulerade saldot fram till den punkten.
 *
 * `granularity: 'day'` (Företagsöversiktens månadsvy, se ReportDetail.jsx)
 * ger istället en punkt per KALENDERDAG — en enda kalendermånad har för få
 * naturliga punkter (bara periodens start+slut) för att bli en läsbar graf,
 * till skillnad från kvartals-/årsvyn där en punkt per månad räcker.
 * Standardvärdet 'month' bevarar exakt tidigare beteende/signatur. */
export function buildCashflowSeries(verifications, accounts, start, end, granularity = 'month') {
  const dates = [];
  if (granularity === 'day') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      dates.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  } else {
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      dates.push(cursor < start ? start : cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
    if (dates.length === 0 || fmtISO(dates[dates.length - 1]) !== fmtISO(end)) dates.push(end);
  }
  const balances = cashBalancesAt(verifications, accounts, dates);
  return dates.map((d, i) => ({ date: fmtISO(d), balance: balances[i] }));
}

// Samma som computeCashBalanceAt för flera datum, med en genomgång av
// verifikationerna i stället för en per datum (en per dag i månadsvyn).
function cashBalancesAt(verifications, accounts, dates) {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const deltas = [];
  for (const ver of verifications) {
    if (!isBooked(ver) || !ver.date) continue;
    let sum = 0;
    let any = false;
    for (const row of ver.rows || []) {
      if (!isCashAccount(byCode.get(row.account))) continue;
      sum += getDebet(row) - getKredit(row);
      any = true;
    }
    if (any) deltas.push([verDate(ver.date).getTime(), sum]);
  }
  deltas.sort((a, b) => a[0] - b[0]);
  const order = dates.map((d, i) => [d.getTime(), i]).sort((a, b) => a[0] - b[0]);
  const out = new Array(dates.length);
  let j = 0;
  let total = 0;
  for (const [t, i] of order) {
    while (j < deltas.length && deltas[j][0] <= t) total += deltas[j++][1];
    out[i] = total;
  }
  return out;
}

/** Serie av {label, intakt, kostnad}-punkter, en per kalendermånad inom
 * perioden — flöde per månad, inte ackumulerat.
 *
 * `granularity: 'day'` — se buildCashflowSeries ovan för samma resonemang:
 * Företagsöversiktens månadsvy vill se dag för dag, inte en enda stapel för
 * hela månaden. Standardvärdet 'month' bevarar exakt tidigare beteende. */
export function buildResultSeries(verifications, accounts, start, end, granularity = 'month') {
  if (granularity === 'day') {
    const days = [];
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      days.push({
        label: String(cursor.getDate()),
        title: dateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(cursor),
        range: [cursor, cursor],
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
    return withFlows(days, verifications, accounts);
  }
  const months = [];
  let cursor = startOfMonth(start);
  while (cursor <= end) {
    const monthStart = cursor < start ? start : cursor;
    const monthEnd = endOfMonth(cursor) > end ? end : endOfMonth(cursor);
    months.push({
      label: dateTimeFormat(dateLocale(), { month: 'short' }).format(cursor),
      // Hela namnet med år, för diagrammens tooltip ("juli 2026").
      title: dateTimeFormat(dateLocale(), { month: 'long', year: 'numeric' }).format(cursor),
      range: [monthStart, monthEnd],
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return withFlows(months, verifications, accounts);
}

// Intäkter och kostnader per hink (samma regler som sumFlowByType) med en
// genomgång av verifikationerna, i stället för två per månad eller dag.
// Hinkarna ligger i datumordning och överlappar inte.
function withFlows(buckets, verifications, accounts) {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const sums = buckets.map(() => ({ intakt: 0, kostnad: 0 }));
  const first = buckets[0]?.range[0];
  const last = buckets[buckets.length - 1]?.range[1];
  if (first) {
    for (const ver of verifications) {
      if (!isBooked(ver) || isClosingEntry(ver) || !ver.date) continue;
      const d = verDate(ver.date);
      if (d < first || d > last) continue;
      let lo = 0;
      let hi = buckets.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (buckets[mid].range[1] < d) lo = mid + 1; else hi = mid;
      }
      if (d < buckets[lo].range[0]) continue;
      const s = sums[lo];
      for (const row of ver.rows || []) {
        const type = classifyAccount(byCode.get(row.account));
        if (type === 'intakt') s.intakt += getKredit(row) - getDebet(row);
        else if (type === 'kostnad') s.kostnad += getDebet(row) - getKredit(row);
      }
    }
  }
  return buckets.map(({ range, ...b }, i) => ({ ...b, ...sums[i] }));
}

/** Resultatet ackumulerat genom perioden, mot samma datum ett år tidigare.
 * Rapportsidans huvuddiagram: linjen svarar på "hur går året?" utan att man
 * behöver summera staplar i huvudet. Kortare perioder delas per dag, annars
 * blir ett kvartal bara tre punkter. */
export function buildResultPace(verifications, accounts, { start, end, prevStart, prevEnd }) {
  const granularity = (end - start) / 86400000 <= 92 ? 'day' : 'month';
  const current = buildResultSeries(verifications, accounts, start, end, granularity);
  const previous = buildResultSeries(verifications, accounts, prevStart, prevEnd, granularity);
  const net = (p) => p.intakt - p.kostnad;
  const hasComparison = previous.some(p => p.intakt !== 0 || p.kostnad !== 0);
  const dayLabel = dateTimeFormat(dateLocale(), { day: 'numeric', month: 'short' });
  let sum = 0;
  let prevSum = 0;
  const points = current.map((p, i) => {
    sum += net(p);
    if (previous[i]) prevSum += net(previous[i]);
    return {
      label: granularity === 'day' ? dayLabel.format(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)) : p.label,
      title: p.title,
      resultat: sum,
      ...(hasComparison ? { fjol: previous[i] ? prevSum : null } : {}),
    };
  });
  return {
    points,
    result: sum,
    prevResult: previous.reduce((s, p) => s + net(p), 0),
    hasComparison,
    hasActivity: hasComparison || current.some(p => p.intakt !== 0 || p.kostnad !== 0),
  };
}

/**
 * Marginalanalys per period: brutto-, rörelse- och vinstmarginal.
 *
 * De tre måtten är samma kvot (resultat / omsättning) med olika mycket
 * kostnader avdragna — varje steg lägger till nästa lager, så de bildar en
 * trappa där brutto >= rörelse >= vinst så länge klasserna är positiva:
 *
 *   Bruttomarginal  = (intäkter − varor/material)                 / intäkter
 *   Rörelsemarginal = (intäkter − varor − övriga externa − klass 7) / intäkter
 *   Vinstmarginal   = (intäkter − ALLA kostnader)                  / intäkter
 *
 * Kostnaderna delas på BAS-klass: 4 = varor och material (kostnad sålda
 * varor), 5–6 = övriga externa kostnader, 7 = personal OCH avskrivningar
 * (77xx–78xx ligger i samma klass och är rörelsekostnader båda två), 8 =
 * finansiella poster och skatt.
 *
 * Två medvetna begränsningar, värda att känna till innan siffran citeras:
 *   - Nämnaren är samma `intakt`-klassificering som resten av modulen
 *     använder (hela klass 3), inte strikt nettoomsättning 3000–3799. Det
 *     gör att marginalerna alltid går ihop med Omsättning-nyckeltalet på
 *     samma sida i stället för att avvika med några kronor.
 *   - Ett tjänstebolag utan klass 4-kostnader får bruttomarginal 100 %.
 *     Det är korrekt (det finns inga sålda varor att dra av), inte en bugg.
 *
 * `null` (inte 0) för en period helt utan intäkter — 0/0 är odefinierat,
 * och en nolla här hade ritats som ett verkligt ras ner till nollinjen.
 */
export function buildMarginSeries(verifications, accounts, start, end, granularity = 'month') {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const keyFor = (d) => (granularity === 'day' ? fmtISO(d) : `${d.getFullYear()}-${d.getMonth()}`);

  // Hinkarna byggs först (samma etiketter/ordning som buildResultSeries), så
  // en period utan en enda verifikation ändå får en punkt i serien.
  const buckets = [];
  const indexByKey = new Map();
  const pushBucket = (date, label) => {
    indexByKey.set(keyFor(date), buckets.length);
    buckets.push({ label, intakt: 0, varor: 0, ovrigaExterna: 0, personal: 0, finansiellt: 0 });
  };
  if (granularity === 'day') {
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      pushBucket(cursor, String(cursor.getDate()));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  } else {
    let cursor = startOfMonth(start);
    while (cursor <= end) {
      pushBucket(cursor, dateTimeFormat(dateLocale(), { month: 'short' }).format(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  // EN genomgång av verifikationerna (till skillnad från buildResultSeries,
  // som anropar sumFlowByType per hink) — här behövs fem summor per hink, och
  // fem × antal hinkar separata genomgångar av hela verifikationslistan hade
  // blivit onödigt dyrt på dagsupplösning.
  for (const ver of verifications) {
    if (!isBooked(ver) || isClosingEntry(ver) || !ver.date) continue;
    const d = verDate(ver.date);
    if (d < start || d > end) continue;
    const idx = indexByKey.get(keyFor(d));
    if (idx === undefined) continue;
    const bucket = buckets[idx];
    for (const row of ver.rows || []) {
      const acc = byCode.get(row.account);
      const type = classifyAccount(acc);
      if (type === 'intakt') {
        bucket.intakt += getKredit(row) - getDebet(row);
        continue;
      }
      if (type !== 'kostnad') continue;
      const amount = getDebet(row) - getKredit(row);
      const n = Number(row.account);
      if (n >= 4000 && n < 5000) bucket.varor += amount;
      else if (n >= 5000 && n < 7000) bucket.ovrigaExterna += amount;
      else if (n >= 7000 && n < 8000) bucket.personal += amount;
      // Allt annat (klass 8, plus konton som klassats som kostnad via ett
      // uttryckligt `account.type` men ligger utanför 4000–7999) hamnar i
      // sista lagret — det som bara vinstmarginalen drar av.
      else bucket.finansiellt += amount;
    }
  }

  return buckets.map(b => {
    const share = (kvar) => (b.intakt !== 0 ? (kvar / b.intakt) * 100 : null);
    const rorelsekostnader = b.varor + b.ovrigaExterna + b.personal;
    return {
      label: b.label,
      brutto: share(b.intakt - b.varor),
      rorelse: share(b.intakt - rorelsekostnader),
      vinst: share(b.intakt - rorelsekostnader - b.finansiellt),
    };
  });
}

/** Balansräkning som ögonblicksbild vid periodens slutdatum — ackumulerat
 * saldo för samtliga tillgångs- och skuld/eget kapital-konton fram till
 * och med det datumet. */
export function computeBalanceSheet(verifications, accounts, asOfDate) {
  const balances = new Map();
  for (const ver of verifications) {
    if (!isBooked(ver) || !ver.date) continue;
    if (verDate(ver.date) > asOfDate) continue;
    for (const row of ver.rows || []) {
      balances.set(row.account, (balances.get(row.account) || 0) + getDebet(row) - getKredit(row));
    }
  }
  const rowsFor = (type) => accounts
    .filter(a => classifyAccount(a) === type)
    .map(a => ({ code: a.code, name: a.name, amount: type === 'skuld_kapital' ? -(balances.get(a.code) || 0) : (balances.get(a.code) || 0) }))
    .filter(r => Math.abs(r.amount) > 0.5);
  const assets = rowsFor('tillgang');
  const equityAndLiabilities = rowsFor('skuld_kapital');
  return {
    assets, equityAndLiabilities,
    totalAssets: assets.reduce((s, r) => s + r.amount, 0),
    totalEquityAndLiabilities: equityAndLiabilities.reduce((s, r) => s + r.amount, 0),
  };
}

/**
 * Resultat som ännu inte förts över till eget kapital: nettot på alla
 * resultatkonton (klass 3–8) till och med datumet. Efter ett bokfört
 * bokslut (8999 mot 2099) är det noll. Innan dess saknas just det här
 * beloppet i eget kapital, och balansräkningen går inte ihop — trots att
 * bokföringen är rätt. Positivt = vinst.
 */
export function unclosedResult(verifications, asOfDate) {
  let sum = 0;
  for (const ver of verifications) {
    if (!isBooked(ver) || !ver.date || new Date(`${ver.date}T00:00:00`) > asOfDate) continue;
    for (const row of ver.rows || []) {
      const n = Number(row.account);
      if (n >= 3000 && n <= 8999) sum += getKredit(row) - getDebet(row);
    }
  }
  return Math.round(sum * 100) / 100;
}

/** Balansräkningen som den ska visas för läsaren: årets resultat står som en
 * egen rad i eget kapital även före bokslutet. Blanketterna läser
 * computeBalanceSheet och lägger själva in raden på sitt eget sätt. */
export function computeBalanceReport(verifications, accounts, asOfDate) {
  const balance = computeBalanceSheet(verifications, accounts, asOfDate);
  const result = unclosedResult(verifications, asOfDate);
  if (Math.abs(result) <= 0.5) return balance;
  return {
    ...balance,
    equityAndLiabilities: [...balance.equityAndLiabilities, { code: '2099', name: t('ui.beraknat_resultat'), amount: result, computed: true }],
    totalEquityAndLiabilities: balance.totalEquityAndLiabilities + result,
  };
}

// Saldot (debet minus kredit) per konto under perioden. Bokslutsverifikationen
// räknas inte, samma regel som resten av resultatsiffrorna.
function netByAccount(verifications, start, end) {
  const out = new Map();
  for (const ver of verifications) {
    if (!isBooked(ver) || isClosingEntry(ver) || !ver.date) continue;
    const d = verDate(ver.date);
    if (d < start || d > end) continue;
    for (const row of ver.rows || []) out.set(row.account, (out.get(row.account) || 0) + getDebet(row) - getKredit(row));
  }
  return out;
}

const statementGroup = (key, label, from, to) => ({ type: 'group', key, label, from, to, rows: [], amount: 0, prev: 0 });
const addToGroup = (group, row) => {
  group.amount += row.amount;
  group.prev += row.prev;
  if (Math.abs(row.amount) > 0.5 || Math.abs(row.prev) > 0.5) group.rows.push(row);
};
const statementItems = (groups) => groups.filter(g => g.rows.length > 0);

/** Resultaträkningen uppställd i BAS-kontoplanens grupper, med fjolårets
 * belopp bredvid. Summorna följer sumFlowByType, så uppställningen och
 * rapportens nyckeltal visar alltid samma tal. */
export function computeResultStatement(verifications, accounts, { start, end, prevStart, prevEnd }) {
  const current = netByAccount(verifications, start, end);
  const previous = netByAccount(verifications, prevStart, prevEnd);
  const income = statementGroup('income', t('ui.intakter'));
  const costs = [
    statementGroup('goods', t('ui.rapp_varor_och_material'), 4000, 4999),
    statementGroup('external', t('ui.rapp_ovriga_externa_kostnader'), 5000, 6999),
    statementGroup('staff', t('ui.rapp_personalkostnader'), 7000, 7699),
    statementGroup('depreciation', t('ui.rapp_avskrivningar'), 7700, 7899),
    statementGroup('otherOperating', t('ui.rapp_ovriga_rorelsekostnader'), 7900, 7999),
    statementGroup('financial', t('ui.rapp_finansiella_poster_och_skatt'), 8000, 8999),
  ];
  // Per kontonummer: en kontoplan kan ha samma konto två gånger.
  for (const account of new Map(accounts.map(a => [a.code, a])).values()) {
    const type = classifyAccount(account);
    if (type !== 'intakt' && type !== 'kostnad') continue;
    const sign = type === 'intakt' ? -1 : 1;
    const row = { code: account.code, name: account.name, sign, amount: sign * (current.get(account.code) || 0), prev: sign * (previous.get(account.code) || 0) };
    const code = Number(account.code);
    addToGroup(type === 'intakt' ? income : (costs.find(g => code >= g.from && code <= g.to) || costs[1]), row);
  }
  const omsattning = income.amount;
  const prevOmsattning = income.prev;
  const kostnader = costs.reduce((s, g) => s + g.amount, 0);
  const prevKostnader = costs.reduce((s, g) => s + g.prev, 0);
  return {
    items: [
      ...statementItems([income, ...costs]),
      { type: 'total', key: 'result', label: t('ui.resultat'), amount: omsattning - kostnader, prev: prevOmsattning - prevKostnader },
    ],
    omsattning, kostnader, resultat: omsattning - kostnader,
    prevOmsattning, prevKostnader, prevResultat: prevOmsattning - prevKostnader,
    hasComparison: prevOmsattning !== 0 || prevKostnader !== 0,
  };
}

/**
 * Kassaflödesanalys enligt den indirekta metoden, uppställd som i de svenska
 * programmen: den löpande verksamheten, investeringar och finansiering. Varje
 * balanskonto hör till en av delarna efter BAS-kontoplanen, och resultatet
 * räknas från resultatkontona. Eftersom varje verifikation går jämnt ut blir
 * summan av delarna exakt förändringen på kassa och bank (1900–1999).
 *
 *   Löpande:     resultatet, avskrivningar (ackumulerade avskrivningar, konton
 *                1xx8–1xx9), obeskattade reserver och avsättningar (21–22),
 *                rörelsekapitalet (14–18 och 24–29 utom 2898)
 *   Investering: anläggningstillgångar (10–13) utom avskrivningarna
 *   Finansiering: eget kapital (20), långfristiga skulder (23), utdelning (2898)
 *
 * Bokslutsverifikationen räknas inte (den flyttar bara resultatet till eget
 * kapital). Beloppen är kassapåverkan: en ökad kundfordran är negativ.
 */
const isAccumulatedDepreciation = (code) => code >= 1000 && code < 1400 && /[89]$/.test(String(code));
function cashflowPart(code) {
  if (code >= 1900 && code <= 1999) return null;
  if (code >= 1000 && code < 1400) return isAccumulatedDepreciation(code) ? 'operating' : 'investing';
  if (code >= 1400 && code < 1900) return 'operating';
  if (code >= 2000 && code < 2100) return 'financing';
  if (code >= 2100 && code < 2300) return 'operating';
  if (code >= 2300 && code < 2400) return 'financing';
  if (code === 2898) return 'financing';
  if (code >= 2400 && code < 3000) return 'operating';
  return null;
}

export function computeCashflowStatement(verifications, accounts, { start, end, prevStart, prevEnd }) {
  const current = netByAccount(verifications, start, end);
  const previous = prevStart && prevEnd ? netByAccount(verifications, prevStart, prevEnd) : new Map();
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const resultOf = (net) => {
    let r = 0;
    for (const [code, n] of net) {
      const type = classifyAccount(byCode.get(code) || { code });
      if (type === 'intakt' || type === 'kostnad') r -= n;
    }
    return r;
  };
  const operating = statementGroup('operating', t('ui.kf_lopande_verksamhet'));
  const investing = statementGroup('investing', t('ui.kf_investeringsverksamhet'));
  const financing = statementGroup('financing', t('ui.kf_finansieringsverksamhet'));
  const groups = { operating, investing, financing };
  const result = resultOf(current);
  const prevResult = resultOf(previous);
  // Resultatet är den första raden i den löpande verksamheten, alltid med.
  operating.rows.push({ code: 'resultat', name: t('ui.kf_periodens_resultat'), amount: result, prev: prevResult, computed: true });
  operating.amount += result;
  operating.prev += prevResult;
  const codes = new Set([...current.keys(), ...previous.keys()]);
  for (const code of [...codes].sort()) {
    const part = cashflowPart(Number(code));
    if (!part) continue;
    const account = byCode.get(code);
    addToGroup(groups[part], {
      code, name: account?.name || code, sign: -1,
      amount: -(current.get(code) || 0), prev: -(previous.get(code) || 0),
    });
  }
  const cashAt = (date) => (date ? computeCashBalanceAt(verifications, accounts, new Date(date.getTime() - 1)) : 0);
  const openingCash = cashAt(start);
  const closingCash = computeCashBalanceAt(verifications, accounts, end);
  const prevOpening = prevStart ? cashAt(prevStart) : 0;
  const prevClosing = prevEnd ? computeCashBalanceAt(verifications, accounts, prevEnd) : 0;
  const flow = operating.amount + investing.amount + financing.amount;
  const prevFlow = operating.prev + investing.prev + financing.prev;
  return {
    items: [
      operating,
      ...[investing, financing].filter(g => g.rows.length > 0),
      { type: 'total', key: 'flow', label: t('ui.kf_periodens_kassaflode'), amount: flow, prev: prevFlow },
      { type: 'total', key: 'opening', label: t('ui.kf_likvida_medel_borjan'), amount: openingCash, prev: prevOpening },
      { type: 'total', key: 'closing', label: t('ui.kf_likvida_medel_slut'), amount: closingCash, prev: prevClosing },
    ],
    operating: operating.amount, investing: investing.amount, financing: financing.amount,
    flow, openingCash, closingCash,
    // Kassaflödet ska vara exakt förändringen på kassa och bank.
    balanced: Math.abs(openingCash + flow - closingCash) < 1,
    hasComparison: previous.size > 0,
  };
}

/** Vattenfallet ur resultaträkningens uppställning: intäkterna, varje
 * kostnadsgrupp som ett steg nedåt, och resultatet. `range` är stapelns start
 * och slut. */
export function buildResultWaterfall(items) {
  let running = 0;
  return items.map((item) => {
    if (item.type === 'total') return { key: item.key, label: item.label, amount: item.amount, range: [Math.min(0, item.amount), Math.max(0, item.amount)], kind: 'result' };
    if (item.key === 'income') {
      running = item.amount;
      return { key: item.key, label: item.label, amount: item.amount, range: [Math.min(0, item.amount), Math.max(0, item.amount)], kind: 'income' };
    }
    const before = running;
    running -= item.amount;
    return { key: item.key, label: item.label, amount: -item.amount, range: [Math.min(before, running), Math.max(before, running)], kind: 'cost' };
  });
}

/** Avviker den senaste hela månaden mer än 30 % från snittet av de tolv
 * månaderna före? Innevarande månad räknas inte: den är inte slut och hade
 * larmat varje månadsskifte. Null när inget sticker ut. */
export function computeMonthDeviation(verifications, accounts, referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 13, 1);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 0);
  const months = buildResultSeries(verifications, accounts, start, end).map(m => ({ ...m, resultat: m.intakt - m.kostnad }));
  const latest = months[months.length - 1];
  const prior = months.slice(0, -1);
  const active = prior.filter(m => m.intakt !== 0 || m.kostnad !== 0);
  // Under ett kvartal med bokföring är snittet för tunt för att säga något.
  if (active.length < 3) return null;
  // Bara månader med bokföring: ett nytt företags tomma månader hade dragit
  // ner snittet och larmat varje månad.
  const average = (key) => active.reduce((s, m) => s + m[key], 0) / active.length;
  const off = (key) => {
    const avg = average(key);
    return avg !== 0 && Math.abs((latest[key] - avg) / avg) * 100 >= 30;
  };
  return off('intakt') || off('resultat') ? { label: latest.title } : null;
}

/** Balansräkningen uppställd i grupper per datum, med samma datum ett år
 * tidigare bredvid. Bygger på computeBalanceReport, så årets beräknade
 * resultat ingår i eget kapital. */
export function computeBalanceStatement(verifications, accounts, asOfDate, prevAsOfDate) {
  const current = computeBalanceReport(verifications, accounts, asOfDate);
  const previous = computeBalanceReport(verifications, accounts, prevAsOfDate);
  const fixedAssets = statementGroup('fixed', t('ui.rapp_anlaggningstillgangar'), 1000, 1399);
  const currentAssets = statementGroup('current', t('ui.rapp_omsattningstillgangar'), 1400, 1999);
  const equity = statementGroup('equity', t('ui.eget_kapital'), 2000, 2099);
  const reserves = statementGroup('reserves', t('ui.rapp_reserver_och_avsattningar'), 2100, 2299);
  const debts = statementGroup('debts', t('ui.skulder'), 2300, 2999);

  const merge = (cur, prev) => {
    const rows = new Map();
    const keyOf = (r) => `${r.code}${r.computed ? '-beraknat' : ''}`;
    for (const r of cur) rows.set(keyOf(r), { ...r, prev: 0 });
    for (const r of prev) {
      const row = rows.get(keyOf(r));
      if (row) row.prev = r.amount;
      else rows.set(keyOf(r), { ...r, amount: 0, prev: r.amount });
    }
    return [...rows.values()].sort((a, b) => Number(a.code) - Number(b.code) || Number(Boolean(a.computed)) - Number(Boolean(b.computed)));
  };
  const place = (groups, fallback, rows) => {
    for (const row of rows) {
      const code = Number(row.code);
      addToGroup(groups.find(g => code >= g.from && code <= g.to) || fallback, row);
    }
  };
  place([fixedAssets, currentAssets], currentAssets, merge(current.assets, previous.assets));
  place([equity, reserves, debts], debts, merge(current.equityAndLiabilities, previous.equityAndLiabilities).map(r => ({ ...r, sign: -1 })));

  return {
    items: [
      ...statementItems([fixedAssets, currentAssets]),
      { type: 'total', key: 'assets', label: t('ui.rapp_summa_tillgangar'), amount: current.totalAssets, prev: previous.totalAssets },
      ...statementItems([equity, reserves, debts]),
      { type: 'total', key: 'equityAndLiabilities', label: t('ui.rapp_summa_eget_kapital_och_skulder'), amount: current.totalEquityAndLiabilities, prev: previous.totalEquityAndLiabilities },
    ],
    totalAssets: current.totalAssets,
    prevTotalAssets: previous.totalAssets,
    totalEquityAndLiabilities: current.totalEquityAndLiabilities,
    equity: equity.amount,
    prevEquity: equity.prev,
    debts: current.totalEquityAndLiabilities - equity.amount,
    prevDebts: previous.totalEquityAndLiabilities - equity.prev,
    isEmpty: current.assets.length === 0 && current.equityAndLiabilities.length === 0,
    hasComparison: previous.assets.length > 0 || previous.equityAndLiabilities.length > 0,
  };
}

/** Eget kapital och skulder vid varje månads slut. Staplade blir de lika höga
 * som tillgångarna, så att balansen syns i diagrammet. */
export function computeBalanceTrend(verifications, accounts, start, end) {
  const points = [];
  let cursor = startOfMonth(start);
  while (cursor <= end) {
    const monthEnd = endOfMonth(cursor) > end ? end : endOfMonth(cursor);
    const balance = computeBalanceReport(verifications, accounts, monthEnd);
    const equity = balance.equityAndLiabilities
      .filter(r => Number(r.code) >= 2000 && Number(r.code) < 2100)
      .reduce((s, r) => s + r.amount, 0);
    points.push({
      label: dateTimeFormat(dateLocale(), { month: 'short' }).format(cursor),
      title: dateTimeFormat(dateLocale(), { month: 'long', year: 'numeric' }).format(cursor),
      equity,
      debts: balance.totalEquityAndLiabilities - equity,
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }
  return points;
}

/** Finns det överhuvudtaget bokförd historik i företaget? Styr det
 * övergripande tomt-läget (helt nytt företag) skilt från "inget hände
 * just i den här perioden". */
export function hasAnyBookedData(verifications) {
  return (verifications || []).some(isBooked);
}

// ─────────────────────────────────────────────────────────────────────────
// Rapport och analys — rapportportalen (14 namngivna rapporter). Samma
// princip som ovan: ALDRIG hårdkodad exempeldata, allt räknas fram ur
// faktiskt bokförda verifikationer/fakturor. En rapport utan underlag
// visar en tom-lista (rows.length === 0), aldrig en tyst 0 kr som ser ut
// som en riktig siffra — det avgör anroparen (ReportDetail.jsx) genom att
// kolla `rows.length`, inte genom att gissa.
// ─────────────────────────────────────────────────────────────────────────

/** Huvudbok — saldo och alla bokförda transaktionsrader per konto, med
 * löpande saldo. Ingångsvärde (`openingBalance`) är det ackumulerade
 * saldot fram till (men inte med) periodens start, precis som en riktig
 * huvudbok. Bara konton med aktivitet ELLER ett ingångssaldo skilt från
 * noll tas med — annars skulle en huvudbok med 50+ oanvända BAS-konton
 * drunkna de faktiskt intressanta i tomma rader. */
export function computeLedger(verifications, accounts, start, end) {
  const byCode = new Map(accounts.map(a => [a.code, a]));
  const opening = new Map();
  const entriesByAccount = new Map();

  const sorted = [...verifications]
    .filter(v => isBooked(v) && v.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  for (const ver of sorted) {
    const d = verDate(ver.date);
    for (const row of ver.rows || []) {
      const debet = getDebet(row) || 0;
      const kredit = getKredit(row) || 0;
      if (!debet && !kredit) continue;
      if (d < start) {
        opening.set(row.account, (opening.get(row.account) || 0) + debet - kredit);
        continue;
      }
      if (d > end) continue;
      if (!entriesByAccount.has(row.account)) entriesByAccount.set(row.account, []);
      entriesByAccount.get(row.account).push({
        date: ver.date, description: ver.description || '', debet, kredit,
        verificationId: ver.id, verificationNumber: ver.number,
      });
    }
  }

  const codes = new Set([...opening.keys(), ...entriesByAccount.keys()]);
  const accountsOut = [...codes].map(code => {
    const acc = byCode.get(code);
    let running = opening.get(code) || 0;
    const rows = (entriesByAccount.get(code) || []).map(e => {
      running += e.debet - e.kredit;
      return { ...e, runningBalance: running };
    });
    return {
      code, name: acc?.name || code, openingBalance: opening.get(code) || 0,
      rows, closingBalance: running,
    };
  })
    .filter(a => a.rows.length > 0 || Math.abs(a.openingBalance) > 0.5)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));

  return { accounts: accountsOut };
}

/** Fakturarapporter — fakturerat/betalt/utestående per kund, byggt direkt
 * ur kundfakturor (inte bokföringen) eftersom rapporten specifikt handlar
 * om fakturaflödet/kundreskontran, inte den allmänna huvudboken. Samma
 * bruttoformel (qty × á-pris × (1+moms%)) som Invoices.jsx behöver —
 * DEN filen importerar `grossInvoiceAmount` härifrån (som `grossOf`),
 * inte tvärtom (kodgranskning: fanns tidigare som två oberoende kopior,
 * trots en kommentar här som redan påstod att den var delad). Bara
 * riktiga kundfakturor räknas (type !== 'quote'), utkast exkluderas — en
 * osparad/obekräftad fakturarad är inte "fakturerat" än. */
export function grossInvoiceAmount(inv) {
  // Radrabatten (`discount`, procent) räknas med, som på fakturan kunden ser.
  return (inv.rows || []).reduce((sum, r) => sum + (Number(r.qty) || 0) * (Number(r.unitPrice) || 0) * (1 - (Number(r.discount) || 0) / 100) * (1 + (Number(r.vatRate) || 0) / 100), 0) || inv.amount || 0;
}

export function computeInvoiceReport(invoices, contacts, start, end) {
  const byId = new Map((contacts || []).map(c => [c.id, c]));
  const inRange = (invoices || []).filter(inv => {
    if ((inv.type || 'invoice') === 'quote') return false;
    if (inv.status === 'draft') return false;
    if (!inv.date) return false;
    const d = verDate(inv.date);
    return d >= start && d <= end;
  });

  // En kreditfaktura hör till samma kund som fakturan den krediterar, även
  // när den saknar kund själv (äldre kreditfakturor).
  const originals = new Map((invoices || []).filter(inv => !inv.creditFor && inv.type !== 'quote').map(inv => [String(inv.invoiceNumber), inv]));

  const byCustomer = new Map();
  for (const inv of inRange) {
    const original = inv.creditFor ? originals.get(String(inv.creditFor)) : null;
    const customerId = inv.customerId || original?.customerId;
    const customerName = inv.customerName || original?.customerName;
    const key = customerId || customerName || t('ui.okand');
    const gross = grossInvoiceAmount(inv);
    // Reglerad med en kreditfaktura är inte betald: inga pengar har kommit in.
    // Bara det som faktiskt betalats räknas, annars går summorna inte ihop.
    const fullyPaid = inv.status === 'paid' && inv.paidVia !== 'credit';
    const paid = fullyPaid ? gross : (Number(inv.paidAmount) || 0);
    if (!byCustomer.has(key)) {
      byCustomer.set(key, {
        customerId: customerId || null,
        name: byId.get(customerId)?.name || customerName || 'Okänd kund',
        invoiced: 0, paid: 0, invoiceCount: 0,
      });
    }
    const row = byCustomer.get(key);
    row.invoiced += gross;
    row.paid += paid;
    row.invoiceCount += 1;
  }

  const rows = [...byCustomer.values()]
    .map(r => ({ ...r, outstanding: Math.max(0, r.invoiced - r.paid) }))
    .sort((a, b) => b.invoiced - a.invoiced);
  const totals = rows.reduce((acc, r) => ({
    invoiced: acc.invoiced + r.invoiced, paid: acc.paid + r.paid, outstanding: acc.outstanding + r.outstanding,
  }), { invoiced: 0, paid: 0, outstanding: 0 });

  return { rows, totals, invoiceCount: inRange.length };
}

/** Nyckeltal — vinstmarginal, soliditet och kassalikviditet, räknade från
 * samma balansräkning/resultatdata som redan finns (computeBalanceSheet/
 * sumFlowByType), inte separata statiska tal.
 *
 * Soliditet (eget kapital / totala tillgångar) är en etablerad, entydig
 * formel. Kassalikviditet ((kassa + kundfordringar) / kortfristiga
 * skulder) är HÄR en förenklad approximation baserad på BAS-kontoklasser
 * (2000–2099 = eget kapital, 2400–2999 = kortfristiga skulder, 15xx =
 * kundfordringar, 1900–1999 = kassa/bank) snarare än en fullständig
 * uppdelning i lång-/kortfristigt — flaggas därför explicit som "ungefärlig"
 * i UI:t (ReportDetail.jsx) istället för att presenteras som en exakt siffra.
 */
export function computeKeyFigures(verifications, accounts, start, end) {
  const omsattning = sumFlowByType(verifications, accounts, 'intakt', start, end);
  const kostnader = sumFlowByType(verifications, accounts, 'kostnad', start, end);
  const resultat = omsattning - kostnader;
  const vinstmarginal = omsattning !== 0 ? (resultat / omsattning) * 100 : null;

  // Med årets beräknade resultat: annars står soliditeten på 0 % fram till bokslutet.
  const balance = computeBalanceReport(verifications, accounts, end);
  const egetKapital = balance.equityAndLiabilities
    .filter(r => Number(r.code) >= 2000 && Number(r.code) < 2100)
    .reduce((s, r) => s + r.amount, 0);
  const kortfristigaSkulder = balance.equityAndLiabilities
    .filter(r => Number(r.code) >= 2400)
    .reduce((s, r) => s + Math.abs(r.amount), 0);
  const kundfordringar = balance.assets
    .filter(r => Number(r.code) >= 1500 && Number(r.code) < 1600)
    .reduce((s, r) => s + r.amount, 0);
  const kassaOchBank = balance.assets
    .filter(r => isCashAccount({ code: r.code }))
    .reduce((s, r) => s + r.amount, 0);

  const soliditet = balance.totalAssets !== 0 ? (egetKapital / balance.totalAssets) * 100 : null;
  const kassalikviditet = kortfristigaSkulder !== 0 ? ((kassaOchBank + kundfordringar) / kortfristigaSkulder) * 100 : null;

  const hasData = balance.assets.length > 0 || balance.equityAndLiabilities.length > 0 || omsattning !== 0 || kostnader !== 0;

  return {
    omsattning, kostnader, resultat, vinstmarginal, soliditet, kassalikviditet,
    egetKapital, totalaTillgangar: balance.totalAssets, kortfristigaSkulder, kassaOchBank, kundfordringar,
    hasData,
  };
}
