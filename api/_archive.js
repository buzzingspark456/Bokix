import { createHash } from 'node:crypto';
import { collectStorageUrls, parseStorageUrl } from '../src/utils/storageUrls.js';

// ─────────────────────────────────────────────────────────────────────────
// Arkivet: det som gör sjuårslöftet verkligt.
//
// Bokföringslagen 7 kap. 2 § kräver att räkenskapsinformation sparas till
// och med det sjunde året efter utgången av det kalenderår då räkenskapsåret
// avslutades. Appens data ligger som EN JSON-post per användare som skrivs
// över vid varje sparning, så det som raderas i appen (Radera data, Radera
// företag) var tidigare borta för alltid, och en bugg som sparade ett
// trasigt tillstånd hade inget att gå tillbaka till.
//
// Arkivet ligger i en egen PRIVAT bucket i Supabase Storage (Frankfurt,
// samma projekt som resten). Den har inga RLS-regler för användare, så bara
// servern (service role) kan läsa eller skriva den. En användare kan alltså
// inte radera sitt eget arkiv, varken av misstag eller med flit.
//
//   <userId>/<companyId>/<tidpunkt>-<skäl>/bokforing.json   företaget som det
//   <userId>/<companyId>/<tidpunkt>-<skäl>/filer/...         såg ut + kvitton
//       Skrivs INNAN Radera data eller Radera företag får gå igenom
//       (api/archive.js). Går arkiveringen inte, stoppas raderingen.
//
//   <userId>/_kopior/dag-<ÅÅÅÅ-MM-DD>.json    hela kontot, varje natt det
//                                              ändrats; sparas i 35 dagar
//   <userId>/_kopior/man-<ÅÅÅÅ-MM>.json       första kopian varje månad;
//                                              sparas tills arkivtiden gått ut
//   <userId>/_kopior/index.json               vad som finns och när det får
//                                              gallras
//
// Filerna (kvittobilder, underlag) kopieras bara vid radering. Nattkopiorna
// är bara JSON: ett bokfört kvitto går inte att radera i appen
// (handleDeleteExpense), så dess fil finns kvar i den vanliga bucketen.
// ─────────────────────────────────────────────────────────────────────────

export const ARCHIVE_BUCKET = 'bokix-arkiv';
export const DAILY_KEEP_DAYS = 35;
const DAY_MS = 86400000;

/** Skapar arkivbucketen första gången. Privat, aldrig publik. */
export async function ensureArchiveBucket(admin) {
  const { data } = await admin.storage.getBucket(ARCHIVE_BUCKET);
  if (data) return;
  const { error } = await admin.storage.createBucket(ARCHIVE_BUCKET, { public: false });
  if (error && !/already exists/i.test(error.message || '')) throw error;
}

function yearOf(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(value);
  return m ? Number(m[1]) : null;
}

/**
 * Hur länge ett arkiv måste sparas. Lagen räknar från utgången av det
 * kalenderår då RÄKENSKAPSÅRET avslutades. Ett brutet räkenskapsår som
 * pågår när arkivet skapas avslutas senast året efter, så det senaste
 * datumet i bokföringen (eller i dag) plus ett år, plus sju hela år.
 * Det kan ge upp till ett år för mycket, aldrig för lite.
 */
export function archiveKeepUntil(companyOrState, now = new Date()) {
  let latest = now.getUTCFullYear();
  const companies = companyOrState?.companies ? Object.values(companyOrState.companies) : [companyOrState];
  for (const c of companies) {
    if (!c) continue;
    for (const list of [c.verifications, c.invoices, c.expenses, c.supplierInvoices, c.payrollRuns]) {
      for (const item of list || []) {
        const y = yearOf(item?.date) || yearOf(item?.invoiceDate) || yearOf(item?.paymentDate);
        if (y && y > latest && y < latest + 5) latest = y;
      }
    }
  }
  return `${latest + 1 + 7}-12-31`;
}

function stamp(now) {
  return now.toISOString().replace(/[:.]/g, '-');
}

async function uploadJson(admin, path, value) {
  const body = Buffer.from(JSON.stringify(value));
  const { error } = await admin.storage.from(ARCHIVE_BUCKET).upload(path, body, { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`Arkivet: kunde inte skriva ${path}: ${error.message}`);
}

async function readJson(admin, path) {
  const { data, error } = await admin.storage.from(ARCHIVE_BUCKET).download(path);
  if (error || !data) return null;
  try { return JSON.parse(Buffer.from(await data.arrayBuffer()).toString('utf8')); } catch { return null; }
}

/**
 * Arkiverar ett företag innan det töms eller tas bort: bokföringen som
 * JSON och en kopia av varje uppladdad fil det pekar på. Kastar vid fel,
 * så att anroparen kan stoppa raderingen.
 */
export async function archiveCompany(admin, { userId, companyId, companyData, reason, now = new Date() }) {
  await ensureArchiveBucket(admin);
  const base = `${userId}/${companyId}/${stamp(now)}-${reason}`;
  const files = [];
  for (const url of collectStorageUrls(companyData)) {
    const parsed = parseStorageUrl(url);
    // Bara användarens egna filer. En sökväg utanför det egna prefixet
    // (felaktig data) ska aldrig kunna användas för att läsa någon annans.
    if (!parsed || !parsed.path.startsWith(`${userId}/`)) continue;
    const target = `${base}/filer/${parsed.bucket}/${parsed.path}`;
    const { data: blob, error: dlError } = await admin.storage.from(parsed.bucket).download(parsed.path);
    if (dlError || !blob) {
      // Filen är redan borta (t.ex. städad tidigare). Noteras i arkivet i
      // stället för att stoppa hela arkiveringen.
      files.push({ url, missing: true });
      continue;
    }
    const { error: upError } = await admin.storage.from(ARCHIVE_BUCKET).upload(target, Buffer.from(await blob.arrayBuffer()), { contentType: blob.type || 'application/octet-stream', upsert: true });
    if (upError) throw new Error(`Arkivet: kunde inte kopiera ${parsed.path}: ${upError.message}`);
    files.push({ url, archivedAs: target });
  }
  const keepUntil = archiveKeepUntil(companyData, now);
  await uploadJson(admin, `${base}/bokforing.json`, {
    archivedAt: now.toISOString(),
    reason,
    keepUntil,
    userId,
    companyId,
    companyName: companyData?.company?.name || null,
    orgNr: companyData?.company?.orgNr || null,
    files,
    data: companyData,
  });
  return { path: base, keepUntil, files: files.length };
}

function hasBookkeeping(state) {
  return Object.values(state?.companies || {}).some(c => (
    (c?.verifications?.length || 0) + (c?.invoices?.length || 0) + (c?.expenses?.length || 0)
    + (c?.payrollRuns?.length || 0) + (c?.bankTransactions?.length || 0)
  ) > 0);
}

/**
 * Nattkopior av varje konto med bokföring. Skriver bara när innehållet
 * ändrats sedan förra kopian, gallrar dagskopior äldre än DAILY_KEEP_DAYS
 * och månadskopior vars arkivtid gått ut.
 */
export async function snapshotAllUsers(admin, { now = new Date(), dryRun = false } = {}) {
  if (!dryRun) await ensureArchiveBucket(admin);
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const summary = { users: 0, written: 0, pruned: 0, errors: [] };

  const PAGE = 200;
  for (let from = 0; ; from += PAGE) {
    const { data: rows, error } = await admin.from('user_data').select('user_id, state').order('user_id').range(from, from + PAGE - 1);
    if (error) throw error;
    for (const row of rows || []) {
      if (!hasBookkeeping(row.state)) continue;
      summary.users += 1;
      try {
        const dir = `${row.user_id}/_kopior`;
        const index = (await readJson(admin, `${dir}/index.json`)) || { hash: null, daily: [], monthly: [] };
        const json = JSON.stringify(row.state);
        const hash = createHash('sha256').update(json).digest('hex');
        const keepUntil = archiveKeepUntil(row.state, now);
        const toRemove = [];

        if (hash !== index.hash) {
          const payload = { snapshotAt: now.toISOString(), keepUntil, userId: row.user_id, state: row.state };
          if (!dryRun) await uploadJson(admin, `${dir}/dag-${today}.json`, payload);
          index.daily = [...(index.daily || []).filter(d => d !== today), today];
          if (!(index.monthly || []).some(m => m.month === month)) {
            if (!dryRun) await uploadJson(admin, `${dir}/man-${month}.json`, payload);
            index.monthly = [...(index.monthly || []), { month, keepUntil }];
          }
          index.hash = hash;
          summary.written += 1;
        }
        // Månadskopians arkivtid följer bokföringen: har kontot fått nyare
        // poster sedan dess gäller det längre datumet.
        index.monthly = (index.monthly || []).map(m => (m.month === month && keepUntil > m.keepUntil ? { ...m, keepUntil } : m));

        const cutoff = new Date(now.getTime() - DAILY_KEEP_DAYS * DAY_MS).toISOString().slice(0, 10);
        const keepDaily = [];
        for (const d of index.daily || []) (d < cutoff ? toRemove.push(`${dir}/dag-${d}.json`) : keepDaily.push(d));
        index.daily = keepDaily;
        const keepMonthly = [];
        for (const m of index.monthly || []) (m.keepUntil < today ? toRemove.push(`${dir}/man-${m.month}.json`) : keepMonthly.push(m));
        index.monthly = keepMonthly;

        if (!dryRun) {
          if (toRemove.length) await admin.storage.from(ARCHIVE_BUCKET).remove(toRemove);
          await uploadJson(admin, `${dir}/index.json`, index);
        }
        summary.pruned += toRemove.length;
      } catch (err) {
        summary.errors.push(`${row.user_id}: ${err.message}`);
      }
    }
    if (!rows || rows.length < PAGE) break;
  }
  return summary;
}
