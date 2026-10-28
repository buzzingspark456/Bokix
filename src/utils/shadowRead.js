// Skuggläsning (steg 3 av blobbens flytt, se supabase-2026-10-25-foretag-och-
// poster.sql): några sekunder efter inloggningen läser appen de egna
// företagen ur companies/company_records, bygger ihop dem och jämför med
// blobben som just laddades. Resultatet används inte till något i appen.
// Det som rapporteras är bara tider, antal och vilka listor som skiljer sig,
// aldrig innehåll; en skillnad ger ett larm (/api/client-error, shadow).
//
// Databasen jämför redan innehållet varje natt (companies_mismatch). Det
// här visar resten: att läsvägen fungerar för riktiga konton i riktiga
// webbläsare (behörigheter, tvåfaktor, sidor om 1 000 poster, mobilnät) och
// hur lång tid den tar. Det behövs innan appen byter till tabellerna.
//
// En gång per dygn och konto, bara i produktion, och den får aldrig störa:
// allt sker i bakgrunden och varje fel sväljs.
import { loadCompanyFromTables, compareCompany, listOrder, RECORD_KINDS } from './companyTables.js';
import { postClientReport } from './errorReporting.js';

const ONCE_PER_MS = 24 * 60 * 60 * 1000;
// Avstod läsningen (kontot sparades under tiden, vanligt strax efter
// inloggningen) görs ett nytt försök tidigast så här mycket senare.
const RETRY_MS = 60 * 60 * 1000;
const DELAY_MS = 8000;
const MAX_COMPANIES = 5;
// Mer än så hämtas inte i bakgrunden (ett stort företag är flera MB).
const MAX_RECORDS = 30000;

const storageKey = (userId) => `bokix_shadow_read_${userId}`;

/** Är det dags för en skuggläsning? Så att anroparen bara kopierar blobben då. */
export function shadowReadDue(userId) {
  return Boolean(import.meta.env.PROD && userId) && dueFor(userId, Date.now());
}

function dueFor(userId, now) {
  try {
    const last = Number(localStorage.getItem(storageKey(userId)) || 0);
    return !last || now - last > ONCE_PER_MS;
  } catch {
    return false; // ingen lagring (privat läge): hellre ingen läsning än en per sidladdning
  }
}

function markDone(userId, now) {
  try { localStorage.setItem(storageKey(userId), String(now)); } catch { /* se dueFor */ }
}

/**
 * När nästa läsning tidigast får ske, räknat som "senast klar"-tidpunkten
 * dueFor jämför med: en rapport (lika, skillnad eller fel) ger ett dygn, en
 * läsning som avstod en timme.
 */
export function nextMark(summary, now) {
  return summary?.skipped ? now - ONCE_PER_MS + RETRY_MS : now;
}

// En läsning åt gången per sida.
let running = false;

/**
 * Själva läsningen och jämförelsen, utan tidsstyrning (testbar).
 * state: blobben precis som den laddades. updatedAt: user_data.updated_at då.
 * Ger en sammanfattning, eller { skipped } om blobben hann ändras.
 */
export async function runShadowRead(supabase, { userId, state, updatedAt, maxRecords = MAX_RECORDS }) {
  const companies = Object.entries(state?.companies || {})
    .filter(([, c]) => c && typeof c === 'object' && !c.__shared)
    .slice(0, MAX_COMPANIES);
  const result = { companies: [], ms: 0, records: 0, mismatched: 0 };
  const started = Date.now();
  for (const [key, blobCompany] of companies) {
    const read = await loadCompanyFromTables(supabase, { ownerUserId: userId, key, maxRecords });
    if (!read) {
      result.companies.push({ diffs: [{ field: '*', issue: 'saknas_i_tabellerna' }] });
      result.mismatched++;
      continue;
    }
    const diffs = compareCompany(blobCompany, read.company);
    const order = {};
    for (const kind of RECORD_KINDS) {
      if (Array.isArray(blobCompany[kind]) && blobCompany[kind].length > 1) order[kind] = listOrder(blobCompany[kind]);
    }
    result.companies.push({ records: read.records, pages: read.pages, ms: read.ms, diffs, order });
    result.records += read.records;
    if (diffs.length) result.mismatched++;
  }
  result.ms = Date.now() - started;

  // Sparades något under tiden jämfördes en gammal blob mot nya tabeller.
  if (updatedAt) {
    const { data, error } = await supabase.from('user_data').select('updated_at').eq('user_id', userId).maybeSingle();
    if (error || !data || data.updated_at !== updatedAt) return { skipped: 'ändrad_under_läsningen' };
  }
  return result;
}

// Kontot tar servern ur inloggningen (postClientReport), inte ur rapporten.
function report(summary) {
  postClientReport({ source: 'shadow', message: summary.mismatched ? 'skillnad' : 'ok', summary }).catch(() => {});
}

/** Anropas när inloggningen laddat klart. Gör inget om det inte är dags. */
export function scheduleShadowRead(supabase, { userId, state, updatedAt }) {
  try {
    if (!import.meta.env.PROD || !supabase || !userId || !state || running) return;
    // Inga egna företag (bara inbjuden): inget att jämföra, och en tom
    // rapport var bara brus i Systemstatus.
    if (!Object.values(state.companies || {}).some(c => c && typeof c === 'object' && !c.__shared)) return;
    if (!dueFor(userId, Date.now())) return;
    running = true;
    // Dagen räknas som klar först när en rapport har gått iväg (nextMark), så
    // att en läsning som avstod eller en flik som stängdes försöker igen.
    setTimeout(() => {
      const run = () => runShadowRead(supabase, { userId, state, updatedAt })
        .then(summary => {
          markDone(userId, nextMark(summary, Date.now()));
          if (!summary.skipped) report(summary);
        })
        .catch(error => {
          markDone(userId, Date.now());
          report({ error: String(error?.message || error).slice(0, 200), mismatched: 0 });
        })
        .finally(() => { running = false; });
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 10000 });
      else run();
    }, DELAY_MS);
  } catch {
    // Skuggläsningen får aldrig störa appen.
  }
}
