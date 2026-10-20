import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { collectStorageUrls, parseStorageUrl } from '../src/utils/storageUrls.js';

// ─────────────────────────────────────────────────────────────────────────
// Arkivet: sjuårslöftet, till nästan ingen kostnad.
//
// Bokföringslagen 7 kap. 2 § kräver att RÄKENSKAPSINFORMATION sparas till och
// med det sjunde året efter utgången av det kalenderår då räkenskapsåret
// avslutades. Allt annat (utkast, offerter, en bankimport man ångrat,
// kontakter som aldrig fakturerats) ska INTE sparas: det är
// personuppgifter utan ändamål (GDPR art. 5.1 e) och kostar lagring.
//
// Därför sparar arkivet bara det lagen kräver (legalSubset nedan), gzippat.
// En typisk företagsarkivering blir några kB. Filerna (kvittobilder,
// underlag) kopieras bara om de hör till något bokfört, och den levande
// kopian tas bort när företaget raderas, så de betalas bara en gång.
//
// Allt ligger i en PRIVAT bucket i Supabase Storage (Stockholm, samma
// projekt). Den har inga RLS-regler för användare: bara servern når den.
//
//   <userId>/<companyId>/<tid>-<skäl>-t<ÅÅÅÅ-MM-DD>/bokforing.json.gz
//   <userId>/<companyId>/<tid>-<skäl>-t<ÅÅÅÅ-MM-DD>/filer/...
//       Skrivs innan Radera data eller Radera företag går
//       igenom. Datumet i mappnamnet är när arkivet får raderas; cronen
//       gallrar det sedan utan att behöva öppna filen.
//
//   <userId>/_kopior/dag-<ÅÅÅÅ-MM-DD>.json.gz   hela kontot, en säkerhets-
//       kopia mot buggar, bara de nätter något ändrats; sparas 14 dagar
//   <userId>/_kopior/man-<ÅÅÅÅ-MM>.json.gz      bara det bokförda, bara när
//       det bokförda ändrats sedan förra månadskopian; sparas till
//       arkivtidens slut
//   <userId>/_kopior/index.json                 vad som finns och när det
//       får gallras
// ─────────────────────────────────────────────────────────────────────────

export const ARCHIVE_BUCKET = 'bokix-arkiv';
export const DAILY_KEEP_DAYS = 14;
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

/** Alla enkla värden (strängar och tal) någonstans i ett värde, som text.
 * Används för att se vilka konton, kunder och kvitton något bokfört
 * pekar på, utan att behöva känna till varje fältnamn. */
function referencedValues(value, out = new Set()) {
  if (value == null) return out;
  if (typeof value === 'string' || typeof value === 'number') { out.add(String(value)); return out; }
  if (typeof value !== 'object') return out;
  for (const v of Array.isArray(value) ? value : Object.values(value)) referencedValues(v, out);
  return out;
}

const SECRET_KEY = /token|secret|password|passwd|smtp|oauth|apikey|api_key|credential/i;
function withoutSecrets(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !SECRET_KEY.test(k)));
}

/**
 * Det av ett företag som är räkenskapsinformation och alltså måste sparas:
 * verifikationer, fakturor som lämnat utkastläget, kvitton och
 * leverantörsfakturor som bokförts, bokförda lönekörningar, matchade eller
 * bokförda banktransaktioner, moms- och arbetsgivardeklarationer. Plus det
 * som behövs för att kunna läsa dem: företagsuppgifterna, de konton och
 * kontakter som faktiskt används.
 *
 * Utelämnas: utkast, offerter, artiklar, projekt, tidrapporter, mallar,
 * anställdas profiler (lönekörningen har en egen ögonblicksbild), omatchade
 * eller ignorerade banktransaktioner, kontakter som ingen bokförd post
 * pekar på och resten av kontoplanen.
 */
export function legalSubset(c) {
  if (!c) return null;
  const verifications = c.verifications || [];
  const verRefs = referencedValues(verifications);
  const invoices = (c.invoices || []).filter(i => i && i.status !== 'draft');
  const expenses = (c.expenses || []).filter(e => e && (
    verRefs.has(String(e.id)) || e.verificationId || ['booked', 'paid'].includes(e.status)
  ));
  const payrollRuns = (c.payrollRuns || []).filter(r => (r?.completedSteps || []).includes('booked'));
  const bankTransactions = (c.bankTransactions || []).filter(t => ['matched', 'booked'].includes(t?.status));
  const kept = { verifications, invoices, expenses, payrollRuns, bankTransactions };
  const refs = referencedValues(kept);
  return {
    company: withoutSecrets(c.company),
    accounts: (c.accounts || []).filter(a => refs.has(String(a?.code))),
    contacts: (c.contacts || []).filter(ct => ct?.id != null && refs.has(String(ct.id))),
    ...kept,
    vatPeriods: c.vatPeriods || [],
    agiReports: c.agiReports || [],
  };
}

function stamp(now) {
  return now.toISOString().replace(/[:.]/g, '-');
}

async function uploadGz(admin, path, value) {
  const body = gzipSync(Buffer.from(JSON.stringify(value)), { level: 9 });
  const { error } = await admin.storage.from(ARCHIVE_BUCKET).upload(path, body, { contentType: 'application/gzip', upsert: true });
  if (error) throw new Error(`Arkivet: kunde inte skriva ${path}: ${error.message}`);
  return body.length;
}

async function uploadIndex(admin, path, value) {
  const { error } = await admin.storage.from(ARCHIVE_BUCKET).upload(path, Buffer.from(JSON.stringify(value)), { contentType: 'application/json', upsert: true });
  if (error) throw new Error(`Arkivet: kunde inte skriva ${path}: ${error.message}`);
}

async function readJson(admin, path) {
  const { data, error } = await admin.storage.from(ARCHIVE_BUCKET).download(path);
  if (error || !data) return null;
  try {
    let buf = Buffer.from(await data.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    return JSON.parse(buf.toString('utf8'));
  } catch { return null; }
}

/** Alla objekt under ett prefix, rekursivt (mappar följs, inte raderas). */
export async function listAllObjects(admin, bucket, prefix, depth = 0) {
  if (depth > 8) return [];
  const out = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error || !data) break;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) out.push(path);
      else out.push(...await listAllObjects(admin, bucket, path, depth + 1));
    }
    if (data.length < 1000) break;
  }
  return out;
}

/**
 * Arkiverar ett företag innan det töms eller tas bort:
 * bara räkenskapsinformationen (legalSubset), gzippad, och kopior av de
 * filer den pekar på. Kastar vid fel, så att anroparen kan stoppa
 * raderingen. Finns ingenting bokfört skrivs inget arkiv alls.
 */
export async function archiveCompany(admin, { userId, companyId, companyData, reason, now = new Date() }) {
  const subset = legalSubset(companyData);
  const hasBooks = ['verifications', 'invoices', 'expenses', 'payrollRuns', 'bankTransactions', 'vatPeriods', 'agiReports']
    .some(k => (subset?.[k]?.length || 0) > 0);
  if (!hasBooks) return { path: null, keepUntil: null, files: 0, bytes: 0, skipped: true };

  await ensureArchiveBucket(admin);
  // Gäller även UF-företag: Skatteverket kräver att verifikationerna sparas
  // i sju år (se _ufAccount.js).
  const keepUntil = archiveKeepUntil(companyData, now);
  const base = `${userId}/${companyId}/${stamp(now)}-${reason}-t${keepUntil}`;
  const files = [];
  let bytes = 0;
  for (const url of collectStorageUrls(subset)) {
    const parsed = parseStorageUrl(url);
    // Bara användarens egna filer. En sökväg utanför det egna prefixet
    // (felaktig data) ska aldrig kunna användas för att läsa någon annans.
    if (!parsed || !parsed.path.startsWith(`${userId}/`)) continue;
    const target = `${base}/filer/${parsed.bucket}/${parsed.path}`;
    const { data: blob, error: dlError } = await admin.storage.from(parsed.bucket).download(parsed.path);
    if (dlError || !blob) { files.push({ url, missing: true }); continue; }
    const buf = Buffer.from(await blob.arrayBuffer());
    const { error: upError } = await admin.storage.from(ARCHIVE_BUCKET).upload(target, buf, { contentType: blob.type || 'application/octet-stream', upsert: true });
    if (upError) throw new Error(`Arkivet: kunde inte kopiera ${parsed.path}: ${upError.message}`);
    bytes += buf.length;
    files.push({ url, archivedAs: target });
  }
  bytes += await uploadGz(admin, `${base}/bokforing.json.gz`, {
    archivedAt: now.toISOString(),
    reason,
    keepUntil,
    userId,
    companyId,
    companyName: companyData?.company?.name || null,
    orgNr: companyData?.company?.orgNr || null,
    files,
    data: subset,
  });
  return { path: base, keepUntil, files: files.length, bytes };
}

function hasBookkeeping(state) {
  return Object.values(state?.companies || {}).some(c => (
    (c?.verifications?.length || 0) + (c?.invoices?.length || 0) + (c?.expenses?.length || 0)
    + (c?.payrollRuns?.length || 0) + (c?.bankTransactions?.length || 0)
  ) > 0);
}

const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
// Äldre indexposter (före komprimeringen) saknar filnamn.
const dailyFile = (d) => (typeof d === 'string' ? `dag-${d}.json` : d.file);
const dailyDate = (d) => (typeof d === 'string' ? d : d.date);
const monthlyFile = (m) => m.file || `man-${m.month}.json`;

/**
 * Nattkopior av varje konto med bokföring. Dagskopian skrivs bara när
 * kontot ändrats, månadskopian bara när det BOKFÖRDA ändrats sedan förra
 * månadskopian. Gallrar dagskopior äldre än DAILY_KEEP_DAYS och
 * månadskopior vars arkivtid gått ut.
 */
export async function snapshotAllUsers(admin, { now = new Date(), dryRun = false, deadline = Infinity, startAfter = null } = {}) {
  if (!dryRun) await ensureArchiveBucket(admin);
  const today = now.toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const summary = { users: 0, written: 0, monthly: 0, pruned: 0, bytes: 0, errors: [] };

  // Listan läses utan själva bokföringen (bara user_id och updated_at).
  // Hela kontot hämtas bara för konton som ändrats sedan förra kopian, och
  // en gång per år (arkivtiden räknas från innevarande år). Övriga nätter
  // gallras bara gamla dagskopior. Vid tidsgränsen returneras resumeFrom.
  const PAGE = 200;
  const year = now.getUTCFullYear();
  let last = startAfter;
  for (let from = 0; ; from += PAGE) {
    let q = admin.from('user_data').select('user_id, updated_at').order('user_id');
    if (startAfter) q = q.gt('user_id', startAfter);
    const { data: rows, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    for (const listed of rows || []) {
      if (Date.now() > deadline) return { ...summary, resumeFrom: last };
      last = listed.user_id;
      const dir = `${listed.user_id}/_kopior`;
      try {
        const index = (await readJson(admin, `${dir}/index.json`)) || { hash: null, daily: [], monthly: [] };
        if (listed.updated_at && index.updatedAt === listed.updated_at && index.keepYear === year) {
          // Oförändrat sedan förra kopian: bara gallring.
          const toRemove = [];
          const cutoff = new Date(now.getTime() - DAILY_KEEP_DAYS * DAY_MS).toISOString().slice(0, 10);
          const today0 = now.toISOString().slice(0, 10);
          index.daily = (index.daily || []).filter(d => (dailyDate(d) < cutoff ? (toRemove.push(`${dir}/${dailyFile(d)}`), false) : true));
          index.monthly = (index.monthly || []).filter(m => (m.keepUntil < today0 ? (toRemove.push(`${dir}/${monthlyFile(m)}`), false) : true));
          if (toRemove.length && !dryRun) {
            await admin.storage.from(ARCHIVE_BUCKET).remove(toRemove);
            await uploadIndex(admin, `${dir}/index.json`, index);
          }
          summary.pruned += toRemove.length;
          summary.unchanged = (summary.unchanged || 0) + 1;
          continue;
        }
        const { data: full, error: fullError } = await admin.from('user_data').select('state').eq('user_id', listed.user_id).maybeSingle();
        if (fullError) throw fullError;
        const row = { user_id: listed.user_id, state: full?.state };
        if (!hasBookkeeping(row.state)) continue;
        summary.users += 1;
        index.updatedAt = listed.updated_at || null;
        index.keepYear = year;
        const hash = sha(row.state);
        const keepUntil = archiveKeepUntil(row.state, now);
        const toRemove = [];

        if (hash !== index.hash) {
          const file = `dag-${today}.json.gz`;
          if (!dryRun) summary.bytes += await uploadGz(admin, `${dir}/${file}`, { snapshotAt: now.toISOString(), userId: row.user_id, state: row.state });
          // En äldre kopia från samma dag (t.ex. okomprimerad) ersätts och tas bort.
          (index.daily || []).filter(d => dailyDate(d) === today && dailyFile(d) !== file).forEach(d => toRemove.push(`${dir}/${dailyFile(d)}`));
          index.daily = [...(index.daily || []).filter(d => dailyDate(d) !== today), { date: today, file }];
          index.hash = hash;
          summary.written += 1;
        }

        const legal = Object.fromEntries(Object.entries(row.state?.companies || {}).map(([id, c]) => [id, legalSubset(c)]));
        const legalHash = sha(legal);
        const monthly = index.monthly || [];
        const last = monthly[monthly.length - 1];
        if (!last || last.hash !== legalHash) {
          const file = `man-${month}.json.gz`;
          if (!dryRun) summary.bytes += await uploadGz(admin, `${dir}/${file}`, { snapshotAt: now.toISOString(), keepUntil, userId: row.user_id, companies: legal });
          monthly.filter(m => m.month === month && monthlyFile(m) !== file).forEach(m => toRemove.push(`${dir}/${monthlyFile(m)}`));
          index.monthly = [...monthly.filter(m => m.month !== month), { month, file, keepUntil, hash: legalHash }];
          summary.monthly += 1;
        } else if (keepUntil > last.keepUntil) {
          // Oförändrad bokföring: den senaste kopian täcker fortfarande, men
          // arkivtiden följer det senaste året kontot använts.
          last.keepUntil = keepUntil;
        }

        const cutoff = new Date(now.getTime() - DAILY_KEEP_DAYS * DAY_MS).toISOString().slice(0, 10);
        index.daily = (index.daily || []).filter(d => (dailyDate(d) < cutoff ? (toRemove.push(`${dir}/${dailyFile(d)}`), false) : true));
        index.monthly = (index.monthly || []).filter(m => (m.keepUntil < today ? (toRemove.push(`${dir}/${monthlyFile(m)}`), false) : true));

        if (!dryRun) {
          if (toRemove.length) await admin.storage.from(ARCHIVE_BUCKET).remove(toRemove);
          await uploadIndex(admin, `${dir}/index.json`, index);
        }
        summary.pruned += toRemove.length;
      } catch (err) {
        summary.errors.push(`${listed.user_id}: ${err.message}`);
      }
    }
    if (!rows || rows.length < PAGE) break;
  }
  return { ...summary, resumeFrom: null };
}

/**
 * Raderar arkiv från Radera data och Radera företag vars arkivtid gått ut. Datumet står i
 * mappnamnet (-tÅÅÅÅ-MM-DD), så inget behöver laddas ner för att avgöra det.
 */
export async function pruneExpiredArchives(admin, { now = new Date(), dryRun = false } = {}) {
  const today = now.toISOString().slice(0, 10);
  const summary = { expired: 0, removed: 0 };
  const { data: users } = await admin.storage.from(ARCHIVE_BUCKET).list('', { limit: 1000 });
  for (const u of users || []) {
    if (u.id) continue;
    const { data: companies } = await admin.storage.from(ARCHIVE_BUCKET).list(u.name, { limit: 1000 });
    for (const c of companies || []) {
      if (c.id || c.name === '_kopior') continue;
      const { data: archives } = await admin.storage.from(ARCHIVE_BUCKET).list(`${u.name}/${c.name}`, { limit: 1000 });
      for (const a of archives || []) {
        const m = /-t(\d{4}-\d{2}-\d{2})$/.exec(a.name);
        if (a.id || !m || m[1] >= today) continue;
        summary.expired += 1;
        const paths = await listAllObjects(admin, ARCHIVE_BUCKET, `${u.name}/${c.name}/${a.name}`);
        if (!dryRun && paths.length) await admin.storage.from(ARCHIVE_BUCKET).remove(paths);
        summary.removed += paths.length;
      }
    }
  }
  return summary;
}
