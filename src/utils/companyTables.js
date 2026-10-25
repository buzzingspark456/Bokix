// Företagen i egna tabeller (supabase-2026-10-25-foretag-och-poster.sql):
// public.companies har en rad per företag, public.company_records en rad per
// post i företagets listor. Blobben (user_data.state) är fortfarande
// sanningen; tabellerna är en skuggkopia som triggern håller i takt.
//
// Den här filen läser ett företag ur tabellerna och bygger ihop det i samma
// form som i blobben, och jämför de två på samma sätt som databasens
// companies_mismatch(). I dag används den bara för skuggläsningen
// (utils/shadowRead.js); när appen byter till tabellerna är det härifrån den
// läser.
//
// Ren logik utan webbläsar- eller Node-beroenden, så den fungerar i appen,
// på servern och i testerna.

// Samma lista som private.record_kinds() i SQL-filen. Ny lista i appen =
// lägg till på båda ställena (och i COMPANY_WRITABLE_FIELDS).
export const RECORD_KINDS = [
  'verifications', 'invoices', 'quotes', 'expenses', 'supplierInvoices', 'contacts',
  'articles', 'projects', 'timeEntries', 'timeReportStatuses', 'billableTimeEntries',
  'recurringTemplates', 'verificationTemplates', 'reviewHistory',
  'employees', 'payrollRuns', 'agiReports',
  'bankTransactions', 'stripeLedgerEvents', 'zettleLedgerEvents',
];
const KIND_SET = new Set(RECORD_KINDS);

// Supabase lämnar högst 1 000 rader per fråga.
export const PAGE_SIZE = 1000;

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const hasId = (e) => isPlainObject(e) && e.id != null && String(e.id) !== '';

// Likhet som i jsonb: objektens nyckelordning spelar ingen roll, listornas gör.
export function sameJson(a, b) {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && sameJson(a[k], b[k]));
}

// En lista i jämförbar form: posterna under sina id (sista gäller), plus antal
// poster som inte kan speglas. Samma regler som private.canonical_company.
function canonicalList(list) {
  const byId = new Map();
  let invalid = 0;
  let valid = 0;
  for (const e of list) {
    if (!hasId(e)) { invalid++; continue; }
    valid++;
    byId.set(String(e.id), e);
  }
  return { byId, invalid, dupes: valid - byId.size };
}

// Ett företag ur tabellerna i blobbens form. Listornas ordning finns inte i
// tabellerna; här sorteras de på id, så att resultatet alltid blir detsamma.
export function buildCompany(row, records) {
  const company = { ...(isPlainObject(row?.extra) ? row.extra : {}) };
  if (row?.settings !== null && row?.settings !== undefined) company.company = row.settings;
  if (row?.accounts !== null && row?.accounts !== undefined) company.accounts = row.accounts;
  const lists = new Map((row?.list_fields || []).map(k => [k, []]));
  for (const r of records) {
    const list = lists.get(r.kind);
    if (list) list.push(r);
  }
  for (const [kind, list] of lists) {
    company[kind] = list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map(r => r.data);
  }
  return company;
}

// Vad som skiljer ett företag i blobben från samma företag ur tabellerna.
// Bara fältnamn och antal, aldrig innehåll, så att resultatet kan skickas
// till servern. Tom lista = lika.
export function compareCompany(blobCompany, tableCompany) {
  const diffs = [];
  const keys = new Set([...Object.keys(blobCompany || {}), ...Object.keys(tableCompany || {})]);
  for (const key of keys) {
    const inBlob = Object.prototype.hasOwnProperty.call(blobCompany || {}, key);
    const inTable = Object.prototype.hasOwnProperty.call(tableCompany || {}, key);
    if (!inBlob || !inTable) {
      diffs.push({ field: key, issue: inBlob ? 'saknas_i_tabellerna' : 'saknas_i_blobben' });
      continue;
    }
    const a = blobCompany[key];
    const b = tableCompany[key];
    if (KIND_SET.has(key) && Array.isArray(a) && Array.isArray(b)) {
      const ca = canonicalList(a);
      const cb = canonicalList(b);
      let missing = 0;
      let changed = 0;
      for (const [id, e] of ca.byId) {
        const t = cb.byId.get(id);
        if (!t) missing++;
        else if (!sameJson(e, t)) changed++;
      }
      let extra = 0;
      for (const id of cb.byId.keys()) if (!ca.byId.has(id)) extra++;
      if (missing || changed || extra || ca.invalid || ca.dupes) {
        diffs.push({ field: key, missing, changed, extra, invalid: ca.invalid, dupes: ca.dupes });
      }
    } else if (!sameJson(a, b)) {
      diffs.push({ field: key, issue: 'olika' });
    }
  }
  return diffs;
}

// Hur blobbens lista är ordnad, för att veta vad appen förväntar sig när
// tabellerna blir sanningen (de sparar ingen ordning). 'date_asc'/'date_desc'
// om listan följer datumfältet, annars 'annan'.
export function listOrder(list) {
  if (!Array.isArray(list) || list.length < 2) return 'kort';
  const dates = list.map(e => (isPlainObject(e) && typeof e.date === 'string' ? e.date : null));
  if (dates.some(d => d === null)) return 'utan_datum';
  let asc = true;
  let desc = true;
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) asc = false;
    if (dates[i] > dates[i - 1]) desc = false;
  }
  return asc ? 'date_asc' : desc ? 'date_desc' : 'annan';
}

// Läser ett företag ur tabellerna med en Supabase-klient (appens, inloggad
// som ägaren; behörigheten sköts av RLS). Ger null om företaget inte finns.
// Posterna hämtas sida för sida i nyckelordning.
export async function loadCompanyFromTables(supabase, { ownerUserId, key, maxRecords = Infinity }) {
  const started = Date.now();
  const { data: row, error } = await supabase
    .from('companies')
    .select('id, settings, accounts, extra, list_fields')
    .eq('owner_user_id', ownerUserId)
    .eq('legacy_key', key)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(`companies: ${error.message}`);
  if (!row) return null;

  const records = [];
  let pages = 0;
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error: pageError } = await supabase
      .from('company_records')
      .select('kind, id, data')
      .eq('company_id', row.id)
      .is('deleted_at', null)
      .order('kind', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (pageError) throw new Error(`company_records: ${pageError.message}`);
    pages++;
    records.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
    if (records.length >= maxRecords) throw new Error(`fler än ${maxRecords} poster`);
  }
  return { company: buildCompany(row, records), records: records.length, pages, ms: Date.now() - started };
}
