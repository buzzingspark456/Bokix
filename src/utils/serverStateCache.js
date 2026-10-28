// En kopia i webbläsaren (IndexedDB) av exakt det som ligger i kontots rad i
// databasen, märkt med radens updated_at. Vid start frågar appen först bara
// efter updated_at; är den samma som kopians används kopian och hela kontot
// (flera MB för ett företag med några år) behöver inte hämtas igen.
//
// Skillnad mot localStorage-kopian i App.jsx: den är appens nuvarande läge,
// med ändringar som kanske inte hunnit sparas och med delade företag. Den här
// är bara serverns version, så den kan användas som utgångsläge för
// sammanslagningen utan att något osparat blir räknat som sparat.
//
// Allt är "bästa försök": går IndexedDB inte att använda (privat läge,
// blockerat) hämtas kontot som förut.

const DB_NAME = 'bokix';
const STORE = 'server-state';
// Hämta ändå hela kontot minst en gång i veckan.
export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(db => new Promise((resolve) => {
    if (!db) { resolve(null); return; }
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result ?? null);
      tx.onerror = () => resolve(null);
      tx.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  }));
}

/** Kopian är användbar bara om den hör till samma konto, har samma
 * updated_at som raden nu och inte är för gammal. */
export function isCacheUsable(entry, userId, updatedAt, now = Date.now()) {
  return Boolean(
    entry && userId && updatedAt
    && entry.userId === userId
    && entry.updatedAt === updatedAt
    && entry.state && typeof entry.state === 'object'
    && typeof entry.cachedAt === 'number' && now - entry.cachedAt < MAX_AGE_MS
  );
}

/** Kopian för kontot, eller null. */
export async function readServerState(userId) {
  if (!userId) return null;
  const entry = await run('readonly', store => store.get(userId));
  return entry && entry.userId === userId ? entry : null;
}

// När kontot senast hämtades helt, per användare.
const lastCachedAt = new Map();
// Skrivs när webbläsaren är ledig, bara den senaste versionen.
let pending = null;
let handle = null;
function flush() {
  handle = null;
  const entry = pending;
  pending = null;
  if (!entry) return;
  // Efter en egen sparning är state appens objekt, som kan ha fält som är
  // undefined eller NaN. I raden finns de inte (jsonb), så kopian sparas i
  // samma form som raden; annars är den inte "exakt det som ligger i raden".
  let state;
  try { state = JSON.parse(JSON.stringify(entry.state)); } catch { return; }
  run('readwrite', store => store.put({ ...entry, state }, entry.userId));
}

/** Kom ihåg serverns version. `cachedAt` behålls från förra kopian när
 * det bara är egna sparningar, så veckogränsen räknas från senaste hela
 * hämtningen. */
export function rememberServerState(userId, updatedAt, state, { fullFetch = false } = {}) {
  if (!userId || !updatedAt || !state) return;
  const cachedAt = fullFetch ? Date.now() : (lastCachedAt.get(userId) ?? Date.now());
  lastCachedAt.set(userId, cachedAt);
  pending = { userId, updatedAt, state, cachedAt };
  if (handle) return;
  handle = typeof requestIdleCallback === 'function'
    ? requestIdleCallback(flush, { timeout: 5000 })
    : setTimeout(flush, 2000);
}

/** Kopian vid start: sätter veckogränsen för egna sparningar. */
export function noteCachedAt(userId, cachedAt) {
  if (userId && typeof cachedAt === 'number') lastCachedAt.set(userId, cachedAt);
}

/** Vid utloggning. */
export function clearServerState() {
  pending = null;
  lastCachedAt.clear();
  run('readwrite', store => store.clear());
}
