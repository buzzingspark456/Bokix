// Var servern läser ett kontos företag (steg 4b/4d av blobbens flytt, se
// supabase-2026-10-25-steg-4b.sql och steg-4d.sql).
//
// Läget (public.storage_modes.mode):
//   - 'tables': ur tabellerna (server_read_company / server_read_companies).
//     Blobben skrivs fortfarande vid varje sparning, så går tabellerna inte
//     att läsa används blobben.
//   - 'tables_only': ur tabellerna, och bara där. Blobbens företag är frysta
//     (gamla), så går tabellerna inte att läsa blir det ett fel i stället för
//     gammal bokföring.
//   - 'blob' (alla andra): ur blobben, som förut. Deras tabeller är en
//     skuggkopia som i värsta fall ligger en natt efter.
//
// Svaren har samma form som blobben, så anroparna behöver inte veta varifrån
// det kom. kinds begränsar vilka listor som hämtas ur tabellerna (null =
// alla); ur blobben kommer alltid allt.
import { assembleCompany } from '../src/utils/tableStore.js';

const isMissingFunction = (error) => error?.code === 'PGRST202' || /server_read_compan/i.test(error?.message || '');
const TABLE_MODES = ['tables', 'tables_only'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tabellen storage_modes finns inte (databasen före steg 4): alla är blob.
const isMissingTable = (error) => error?.code === 'PGRST205' || error?.code === '42P01' || /storage_modes.*does not exist|does not exist.*storage_modes/i.test(error?.message || '');

/**
 * 'blob', 'tables' eller 'tables_only'. Saknas tabellen eller raden: 'blob'.
 * Kastar om läget inte går att läsa. Förut gissades 'blob', och då fick ett
 * konto i 'tables_only' den frysta (gamla) blobben, och raderingen kunde
 * missa kvitton som bara tabellerna pekar på.
 */
export async function storageModeOf(admin, ownerUserId) {
  const { data, error } = await admin.from('storage_modes').select('mode').eq('user_id', ownerUserId).maybeSingle();
  if (error) {
    if (isMissingTable(error)) return 'blob';
    throw new Error(`Kunde inte läsa lagringsläget för ${ownerUserId}: ${error.message}`);
  }
  return TABLE_MODES.includes(data?.mode) ? data.mode : 'blob';
}

async function readBlobState(admin, ownerUserId) {
  const { data, error } = await admin.from('user_data').select('state').eq('user_id', ownerUserId).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.state || null;
}

/** Samma uppslag som findCompanyEntry i api/_auth.js: nyckeln, sedan company.id. */
function findInCompanies(companies, companyId) {
  if (!companies || !companyId) return null;
  if (companies[companyId]) return { key: companyId, data: companies[companyId] };
  const match = Object.entries(companies).find(([, c]) => c?.company?.id === companyId);
  return match ? { key: match[0], data: match[1] } : null;
}

const tablesOnlyError = (ownerUserId, error) => new Error(`Kontot ${ownerUserId} läses bara ur tabellerna, och de gick inte att läsa: ${error?.message || error}`);

/**
 * Ett företag hos en ägare. Ger { key, data, source } eller null om det
 * inte finns. Kastar när källan inte går att läsa.
 */
export async function readOwnerCompany(admin, ownerUserId, companyId, { kinds = null, onTableError } = {}) {
  if (!ownerUserId || !companyId) return null;
  const mode = await storageModeOf(admin, ownerUserId);
  if (TABLE_MODES.includes(mode)) {
    const { data, error } = await admin.rpc('server_read_company', { p_owner: ownerUserId, p_company: String(companyId), p_kinds: kinds });
    if (!error && data) return { key: data.key, data: assembleCompany(data.payload), source: 'tables' };
    if (mode === 'tables_only') {
      if (error) { onTableError?.(error); throw tablesOnlyError(ownerUserId, error); }
      return null; // finns inte
    }
    if (error && !isMissingFunction(error)) onTableError?.(error);
    // Inte i tabellerna: blobben avgör. Finns det där är något fel i
    // speglingen, och det ska vi få veta, men kunden ska inte drabbas.
    const state = await readBlobState(admin, ownerUserId);
    const entry = findInCompanies(state?.companies, companyId);
    if (entry && !error) onTableError?.(new Error(`företaget ${companyId} finns i blobben men inte i tabellerna`));
    return entry ? { ...entry, source: 'blob' } : null;
  }
  const state = await readBlobState(admin, ownerUserId);
  const entry = findInCompanies(state?.companies, companyId);
  return entry ? { ...entry, source: 'blob' } : null;
}

/**
 * Alla företag hos en ägare: { companies: { <nyckel>: företag }, source }.
 * Delade företag (__shared) finns aldrig i ägarens egen rad.
 */
export async function readOwnerCompanies(admin, ownerUserId, { kinds = null, onTableError } = {}) {
  const mode = await storageModeOf(admin, ownerUserId);
  if (TABLE_MODES.includes(mode)) {
    const { data, error } = await admin.rpc('server_read_companies', { p_owner: ownerUserId, p_kinds: kinds });
    if (!error) {
      const companies = {};
      for (const [key, payload] of Object.entries(data || {})) companies[key] = assembleCompany(payload);
      return { companies, source: 'tables' };
    }
    if (mode === 'tables_only') { onTableError?.(error); throw tablesOnlyError(ownerUserId, error); }
    if (!isMissingFunction(error)) onTableError?.(error);
  }
  const state = await readBlobState(admin, ownerUserId);
  return { companies: state?.companies || {}, source: 'blob' };
}

/**
 * Hela kontot (som user_data.state): { activeCompanyId, companies }. För
 * konton i tabelläget ur tabellerna (aktivt företag ligger kvar i blobben),
 * annars blobben. null om kontot inte har någon rad.
 */
export async function readOwnerState(admin, ownerUserId, { onTableError } = {}) {
  const mode = await storageModeOf(admin, ownerUserId);
  if (TABLE_MODES.includes(mode)) {
    const [{ data, error }, top] = await Promise.all([
      admin.rpc('server_read_companies', { p_owner: ownerUserId, p_kinds: null }),
      admin.from('user_data').select('active:state->activeCompanyId').eq('user_id', ownerUserId).maybeSingle(),
    ]);
    if (!error && !top.error) {
      if (!top.data) return null;
      const companies = {};
      for (const [key, payload] of Object.entries(data || {})) companies[key] = assembleCompany(payload);
      return { ...(top.data.active != null ? { activeCompanyId: top.data.active } : {}), companies };
    }
    const err = error || top.error;
    if (mode === 'tables_only') { onTableError?.(err); throw tablesOnlyError(ownerUserId, err); }
    if (!isMissingFunction(err)) onTableError?.(err);
  }
  return readBlobState(admin, ownerUserId);
}

/**
 * Rader som redan lästs ur user_data med state (nattjobben läser sida för
 * sida): för de konton som är i tabelläget byts state mot det i tabellerna.
 * Övriga rader lämnas orörda. En fråga för att se vilka konton det gäller.
 */
export async function withTablesState(admin, rows, { onTableError } = {}) {
  const tablesIds = await tablesModeIds(admin, (rows || []).map(r => r.user_id));
  if (!tablesIds.size) return rows;
  const out = [];
  for (const row of rows) {
    if (!tablesIds.has(row.user_id)) { out.push(row); continue; }
    const state = await readOwnerState(admin, row.user_id, { onTableError });
    out.push(state ? { ...row, state } : row);
  }
  return out;
}

/** Vilka av kontona är i tabelläget (båda formerna)? Kastar om det inte går att se (som storageModeOf). */
export async function tablesModeIds(admin, ids) {
  // Bara riktiga konto-id: ett felaktigt id får databasen att neka hela frågan.
  const list = (ids || []).filter(id => UUID.test(String(id || '')));
  if (!list.length) return new Set();
  const { data, error } = await admin.from('storage_modes').select('user_id').in('mode', TABLE_MODES).in('user_id', list);
  if (error) {
    if (isMissingTable(error)) return new Set();
    throw new Error(`Kunde inte läsa lagringslägena: ${error.message}`);
  }
  return new Set((data || []).map(r => r.user_id));
}

/**
 * När kontona senast ändrades i tabellerna: Map(konto → senaste
 * companies.updated_at, även borttagna företag). I 'tables_only' ändras
 * user_data.updated_at inte när bokföringen ändras, så det som letar efter
 * ändrade konton (nattkopian) måste titta här också. Tom karta om det inte
 * går att läsa: anroparen får då behandla kontot som ändrat.
 */
export async function companiesUpdatedAt(admin, ids) {
  const list = (ids || []).filter(id => UUID.test(String(id || '')));
  const out = new Map();
  if (!list.length) return out;
  const { data, error } = await admin.from('companies').select('owner_user_id, updated_at').in('owner_user_id', list);
  if (error) throw new Error(error.message);
  for (const r of data || []) {
    const prev = out.get(r.owner_user_id);
    if (!prev || Date.parse(r.updated_at) > Date.parse(prev)) out.set(r.owner_user_id, r.updated_at);
  }
  return out;
}

/**
 * Både blobben och, för konton i tabelläget, tabellerna: { blob, tables }
 * (tables null för övriga). För det som raderar eller stänger: något får
 * bara försvinna om ingen av källorna har det. Kastar om blobben inte går
 * att läsa, eller (endast tabeller) om tabellerna inte går att läsa.
 */
export async function readBothStates(admin, ownerUserId, { onTableError } = {}) {
  const blob = await readBlobState(admin, ownerUserId);
  if (!TABLE_MODES.includes(await storageModeOf(admin, ownerUserId))) return { blob, tables: null };
  const tables = await readOwnerState(admin, ownerUserId, { onTableError });
  return { blob, tables };
}
