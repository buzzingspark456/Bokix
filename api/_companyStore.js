// Var servern läser ett kontos företag (steg 4b av blobbens flytt, se
// supabase-2026-10-25-steg-4b.sql).
//
// Konto i tabelläget (public.storage_modes.mode = 'tables'): ur tabellerna,
// med server_read_company / server_read_companies. Där är tabellerna alltid
// rätt, eftersom sparningen rullas tillbaka om speglingen misslyckas.
// Alla andra konton: ur blobben (user_data.state), som förut. Deras tabeller
// är en skuggkopia som i värsta fall ligger en natt efter.
//
// Går tabelläsningen inte (fel, funktionen saknas) läses blobben, som i
// steg 4b fortfarande uppdateras vid varje sparning.
//
// Svaren har samma form som blobben, så anroparna behöver inte veta varifrån
// det kom. kinds begränsar vilka listor som hämtas ur tabellerna (null =
// alla); ur blobben kommer alltid allt.
import { assembleCompany } from '../src/utils/tableStore.js';

const isMissingFunction = (error) => error?.code === 'PGRST202' || /server_read_compan/i.test(error?.message || '');

/** 'tables' eller 'blob' för ett konto. Saknas tabellen eller raden: 'blob'. */
export async function storageModeOf(admin, ownerUserId) {
  try {
    const { data, error } = await admin.from('storage_modes').select('mode').eq('user_id', ownerUserId).maybeSingle();
    if (error) return 'blob';
    return data?.mode === 'tables' ? 'tables' : 'blob';
  } catch {
    return 'blob';
  }
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

/**
 * Ett företag hos en ägare. Ger { key, data, source } eller null om det
 * inte finns. Kastar bara när varken tabellerna eller blobben gick att läsa.
 */
export async function readOwnerCompany(admin, ownerUserId, companyId, { kinds = null, onTableError } = {}) {
  if (!ownerUserId || !companyId) return null;
  if (await storageModeOf(admin, ownerUserId) === 'tables') {
    const { data, error } = await admin.rpc('server_read_company', { p_owner: ownerUserId, p_company: String(companyId), p_kinds: kinds });
    if (!error && data) return { key: data.key, data: assembleCompany(data.payload), source: 'tables' };
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
  if (await storageModeOf(admin, ownerUserId) === 'tables') {
    const { data, error } = await admin.rpc('server_read_companies', { p_owner: ownerUserId, p_kinds: kinds });
    if (!error) {
      const companies = {};
      for (const [key, payload] of Object.entries(data || {})) companies[key] = assembleCompany(payload);
      return { companies, source: 'tables' };
    }
    if (!isMissingFunction(error)) onTableError?.(error);
  }
  const state = await readBlobState(admin, ownerUserId);
  return { companies: state?.companies || {}, source: 'blob' };
}
