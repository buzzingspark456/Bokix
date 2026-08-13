// ─────────────────────────────────────────────────────────────────────────
// Skatteverkets skattetabeller — hämtas och cachas, inte anropas live vid
// varje löneberäkning (skulle vara långsamt och göra en hel lönekörning
// sårbar för ett API-avbrott mitt i processen).
//
// Källa (bekräftad fungerande, testad med riktigt anrop under utveckling):
// https://skatteverket.entryscape.net/rowstore/dataset/
//   88320397-5c32-4c16-ae79-d36d95b17b95/json?år=<year>&tabellnr=<nr>
//
// Verifierade fältnamn i svaret (hämtat live): "tabellnr", "antal dgr",
// "år", "inkomst fr.o.m.", "inkomst t.o.m.", "kolumn 1".."kolumn 7".
// Värdet i respektive "kolumn N" är skatteavdraget i kronor för det
// inkomstintervallet.
//
// Begränsning värd att känna till: v1 slår alltid upp mot periodkoden
// "30B" (månadstabell). Skatteverkets tabellsystem har separata koder för
// vecko-/dagavlönade och för engångsbelopp (t.ex. ojämn timlön) — det är
// inte implementerat här. Timavlönades grundlön räknas ut korrekt
// (timlön × arbetade timmar), men skatteavdraget slås upp mot samma
// månadstabell som månadsavlönade, vilket är en förenkling, inte en exakt
// motsvarighet till Skatteverkets regler för oregelbunden inkomst.
// ─────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://skatteverket.entryscape.net/rowstore/dataset/88320397-5c32-4c16-ae79-d36d95b17b95/json';
const CACHE_PREFIX = 'bokix_skattetabell_';
const DEFAULT_PERIOD_CODE = '30B';

const memoryCache = new Map(); // year:tabellnr -> rows[]

function cacheKey(year, tabellnr) {
  return `${year}:${tabellnr}`;
}

function loadFromLocalStorage(year, tabellnr) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + cacheKey(year, tabellnr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.rows) ? parsed.rows : null;
  } catch {
    return null;
  }
}

function saveToLocalStorage(year, tabellnr, rows) {
  try {
    localStorage.setItem(CACHE_PREFIX + cacheKey(year, tabellnr), JSON.stringify({ rows, fetchedAt: new Date().toISOString() }));
  } catch {
    // localStorage kan vara full eller otillgänglig (privat läge) — cachen
    // blir då bara in-memory för den här sessionen, vilket är okej.
  }
}

/**
 * Hämtar och cachar en hel skattetabell (alla inkomstintervall) för ett
 * givet år + tabellnummer. Paginerar via "next" tills sista sidan.
 * Görs bara en gång per (år, tabellnr) — resultatet återanvänds därefter.
 */
export async function preloadSkattetabell(year, tabellnr) {
  const key = cacheKey(year, tabellnr);
  if (memoryCache.has(key)) return memoryCache.get(key);

  const fromStorage = loadFromLocalStorage(year, tabellnr);
  if (fromStorage) {
    memoryCache.set(key, fromStorage);
    return fromStorage;
  }

  const rows = [];
  let url = `${BASE_URL}?${encodeURIComponent('år')}=${year}&tabellnr=${tabellnr}&_limit=100&_offset=0`;
  let guard = 0;
  while (url && guard < 200) { // guard mot oändlig loop om API:et någonsin skulle bete sig fel
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Kunde inte hämta skattetabell ${tabellnr} för ${year} (HTTP ${res.status}).`);
    const data = await res.json();
    rows.push(...(data.results || []));
    url = data.next || null;
    guard++;
  }

  memoryCache.set(key, rows);
  saveToLocalStorage(year, tabellnr, rows);
  return rows;
}

/**
 * Slår upp skatteavdraget för en given inkomst, tabell och kolumn.
 * Måste anropas EFTER preloadSkattetabell (kastar annars, eftersom det inte
 * ska göras ett nytt nätverksanrop mitt i en synkron beräkning).
 */
export function lookupSkatteavdrag({ year, tabellnr, kolumn, inkomst, periodCode = DEFAULT_PERIOD_CODE }) {
  const rows = memoryCache.get(cacheKey(year, tabellnr));
  if (!rows) {
    throw new Error(`Skattetabell ${tabellnr} för ${year} är inte inläst än — anropa preloadSkattetabell() först.`);
  }
  const periodRows = rows.filter(r => r['antal dgr'] === periodCode);
  const income = Math.round(inkomst || 0);

  const match = periodRows.find(r => income >= Number(r['inkomst fr.o.m.']) && income <= Number(r['inkomst t.o.m.']));
  if (match) {
    const val = match[`kolumn ${kolumn}`];
    return { amount: val === '' || val === undefined ? 0 : Number(val), extrapolated: false };
  }

  // Inkomst över tabellens högsta angivna intervall — använd högsta kända
  // raden som approximation och flagga det tydligt, hellre än att krascha
  // eller tyst returnera fel belopp.
  const highest = [...periodRows].sort((a, b) => Number(b['inkomst t.o.m.']) - Number(a['inkomst t.o.m.']))[0];
  if (highest) {
    const val = highest[`kolumn ${kolumn}`];
    return { amount: val === '' || val === undefined ? 0 : Number(val), extrapolated: true };
  }

  return { amount: 0, extrapolated: true, notFound: true };
}

export function isSkattetabellCached(year, tabellnr) {
  return memoryCache.has(cacheKey(year, tabellnr)) || Boolean(loadFromLocalStorage(year, tabellnr));
}
