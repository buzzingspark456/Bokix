import { collectStoragePaths } from '../../src/utils/storageUrls.js';
import { snapshotAllUsers, pruneExpiredArchives } from '../_archive.js';
import { deleteClosedUfAccounts } from '../_ufAccount.js';
import { isFreeEmail } from '../_auth.js';
import { hasResendApiKey, sendWithFallback } from '../_resend.js';
import { buildUfClosingHtml } from '../_emailTemplates.js';
import { readOwnerState, tablesModeIds } from '../_companyStore.js';

// Varningsmejlen till UF-konton som inte valt något (se _ufAccount.js).
// Utan Resend-nyckel skickas inga mejl, och då stängs inget automatiskt.
const UF_MAIL_SUBJECTS = {
  ended: 'Ert UF-konto: gratisperioden är slut',
  month: 'Ert UF-konto stängs om en månad',
  week: 'Ert UF-konto stängs om en vecka',
};
function ufMailer() {
  if (!hasResendApiKey()) return {};
  return {
    sendMail: async ({ to, subject, html }) => (await sendWithFallback({ to: [to], subject, html })).ok,
    buildMail: ({ stage, closeDate }) => ({
      subject: UF_MAIL_SUBJECTS[stage],
      html: buildUfClosingHtml({ stage, closeDate, siteUrl: 'https://www.bokix.se' }),
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Datastädning — kör en gång per dygn från api/cron/data-retention.js (egen
// cron sedan 2026-10-08, med egen tidsgräns; Pro-planen har ingen
// 12-funktionsgräns längre). Texten nedan är från tiden i reminders.js.
//
// Ingen egen endpoint med flit: Vercels Hobby-plan tillåter tolv
// serverfunktioner och vi ligger redan på tolv (se filkommentaren i
// reminders.js). Det här är en modul som cronen anropar, inte en trettonde
// funktion.
//
// Två jobb, båda med samma princip: data vi inte behöver ska inte finnas.
//
//   1. FÖRÄLDRALÖSA FILER. Appens tillstånd ligger som en enda JSON-post per
//      användare, så när något raderas i gränssnittet är det borta ur
//      databasen vid nästa sparning. Uppladdade filer ligger däremot i
//      Storage och överlever tills någon uttryckligen tar bort dem. Klienten
//      städar numera vid de vanliga vägarna (raderat kvitto, utbytt underlag,
//      borttaget företag) — men "best effort" på klienten betyder att en
//      stängd flik eller ett tappat nät lämnar filen kvar. Den här rutinen är
//      skyddsnätet.
//
//   2. ÖVERGIVNA REGISTRERINGAR. Ett konto som skapades, verifierade sin
//      mejladress, kom fram till betalsteget och aldrig betalade blev
//      liggande för alltid — med namn, mejladress och företagsuppgifter.
//      Det är personuppgifter utan ändamål, alltså precis vad GDPR:s
//      lagringsminimering (artikel 5.1 e) säger att man inte ska ha.
//
// VAD SOM ALDRIG RÖRS, och varför:
//   · Konton med en prenumerationsrad (oavsett status, även uppsagd). Har
//     någon varit kund finns räkenskapsinformation, och den ska bevaras i
//     sju år efter utgången av det kalenderår räkenskapsåret avslutades
//     (bokföringslagen 7 kap. 2 §). Städning får aldrig gå före arkivkravet.
//   · Konton som har bokförd data — verifikationer, fakturor eller
//     lönekörningar — även utan prenumerationsrad. Samma skäl: finns det
//     räkenskapsinformation är den arkivpliktig, punkt.
//   · Allt som är nyare än respitperioderna nedan.
// ─────────────────────────────────────────────────────────────────────────

/** Hur länge en fil får ligga oreferererad innan den städas. Behövs för att
 * en uppladdning ALLTID hinner före sparningen av posten som refererar den:
 * utan respit hade en fil som laddades upp i samma stund som cronen kördes
 * kunnat raderas innan användaren hann trycka Spara. */
export const ORPHAN_FILE_GRACE_DAYS = 7;

/** Hur länge en registrering utan betalning får ligga kvar. Användarens beslut
 * 2026-10-24: sju dagar, sedan tas kontot bort om ingen prenumeration har
 * startats. Står i Integritetspolicyn och på betalsidan, ändra alla samtidigt. */
export const ABANDONED_SIGNUP_DAYS = 7;

/** Konton som aldrig ska städas som övergivna, oavsett prenumeration: våra
 * gratiskonton, UF (har ingen prenumeration och ett eget avslut i
 * _ufAccount.js), och konton i ett delat företag (inbjuden medlem eller
 * ägare med medlemmar). Kan kontot inte läsas räknas det som skyddat. */
async function isProtectedAccount(admin, userId, state, cutoff) {
  if (Object.values(state?.companies || {}).some(c => c?.company?.isUf)) return true;
  const { data, error } = await admin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (error || !user) return true;
  if (isFreeEmail(user.email)) return true;
  if (user.app_metadata?.uf || user.user_metadata?.uf) return true;
  if (!user.created_at || new Date(user.created_at) >= cutoff) return true;
  const { data: members, error: memberErr } = await admin
    .from('company_members')
    .select('id')
    .or(`member_user_id.eq.${userId},owner_user_id.eq.${userId}`)
    .eq('status', 'active')
    .limit(1);
  if (memberErr) return true;
  if ((members || []).length > 0) return true;
  // En tidigare inbjuden vars uppladdade kvitton finns i någon ägares
  // bokföring: filerna ligger i den inbjudnas mapp och skulle försvinna med
  // kontot. Kan det inte avgöras räknas kontot som skyddat.
  try {
    return (await pathsUsedByOwners(admin, userId)).size > 0;
  } catch {
    return true;
  }
}

/**
 * Filer i kontots egen mapp som används i ANDRA konton: kvitton och underlag
 * som en inbjuden laddat upp hamnar i den inbjudnas mapp men hör till
 * ägarens bokföring (även efter att inbjudan tagits bort). Ger mängden
 * "bucket/sökväg" (samma form som collectStoragePaths). Kastar om något
 * inte går att läsa, så att anroparen hellre sparar än raderar.
 */
export async function pathsUsedByOwners(admin, userId) {
  const used = new Set();
  const { data: rows, error } = await admin.from('company_members').select('owner_user_id').eq('member_user_id', userId);
  if (error) throw new Error(error.message);
  const prefix = `/${userId}/`;
  for (const owner of new Set((rows || []).map(r => r.owner_user_id))) {
    if (!owner || owner === userId) continue;
    for (const p of collectStoragePaths(await readOwnerState(admin, owner))) {
      if (p.includes(prefix)) used.add(p);
    }
  }
  return used;
}

const DAY_MS = 86400000;

/** Har kontot något som är räkenskapsinformation? I så fall är det
 * arkivpliktigt och ska inte städas, oavsett betalstatus. */
export function hasBookkeepingData(state) {
  const companies = state?.companies || {};
  return Object.values(companies).some(c => (
    (c?.verifications?.length || 0) > 0
    || (c?.invoices?.length || 0) > 0
    || (c?.expenses?.length || 0) > 0
    || (c?.payrollRuns?.length || 0) > 0
    || (c?.bankTransactions?.length || 0) > 0
  ));
}

/** Alla objekt under ett prefix i en bucket, rekursivt. Supabase `list`
 * returnerar mappar som poster utan `id` — de måste följas, inte raderas. */
async function listAllObjects(admin, bucket, prefix, depth = 0) {
  if (depth > 4) return [];   // skydd mot en oväntat djup struktur
  const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const out = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) {
      out.push({ path, createdAt: entry.created_at ? new Date(entry.created_at) : null });
    } else {
      out.push(...await listAllObjects(admin, bucket, path, depth + 1));
    }
  }
  return out;
}

/**
 * Jobb 1: ta bort filer som ingen post längre pekar på.
 *
 * Jämförelsen görs per ANVÄNDARE och bara inom användarens eget prefix —
 * aldrig en global genomgång av bucketen. Det gör att en bugg i en enskild
 * användares data inte kan råka radera någon annans filer.
 */
// Användarna läses 50 i taget (varje rad är ett helt företags bokföring),
// och jobbet stannar vid `deadline`. `startAfter` fortsätter där förra
// natten slutade; resumeFrom i svaret är var nästa körning ska börja (null =
// klar).
const USER_PAGE = 50;

export async function cleanOrphanFiles(admin, { buckets = ['bokix-uploads', 'companylogo'], now = new Date(), dryRun = false, deadline = Infinity, startAfter = null } = {}) {
  const cutoff = new Date(now.getTime() - ORPHAN_FILE_GRACE_DAYS * DAY_MS);
  let scanned = 0;
  let removed = 0;
  let last = startAfter;
  for (;;) {
    let q = admin.from('user_data').select('user_id, state').order('user_id').limit(USER_PAGE);
    if (last) q = q.gt('user_id', last);
    const { data: rows, error } = await q;
    if (error) throw error;
    // Konton i tabelläget (_companyStore.js): en fil räknas som använd om
    // blobben ELLER tabellerna pekar på den. Ett fel i den ena källan får
    // aldrig leda till att ett kvitto raderas.
    const tablesIds = await tablesModeIds(admin, (rows || []).map(r => r.user_id));
  for (const row of rows || []) {
    if (Date.now() > deadline) return { scanned, removed, resumeFrom: last };
    last = row.user_id;
    const referenced = collectStoragePaths(row.state);
    if (tablesIds.has(row.user_id)) {
      for (const p of collectStoragePaths(await readOwnerState(admin, row.user_id))) referenced.add(p);
    }
    // Kvitton kontot laddat upp som inbjuden räknas som använda om ägarens
    // bokföring pekar på dem. Går det inte att se: hoppa över kontot i natt.
    try {
      for (const p of await pathsUsedByOwners(admin, row.user_id)) referenced.add(p);
    } catch {
      continue;
    }
    for (const bucket of buckets) {
      const objects = await listAllObjects(admin, bucket, row.user_id);
      scanned += objects.length;
      const orphans = objects.filter(o => {
        if (referenced.has(`${bucket}/${o.path}`)) return false;
        // Saknad tidsstämpel behandlas som NY (spara hellre en fil för
        // mycket än radera en som kanske används).
        if (!o.createdAt) return false;
        return o.createdAt < cutoff;
      });
      if (orphans.length && !dryRun) {
        await admin.storage.from(bucket).remove(orphans.map(o => o.path));
      }
      removed += orphans.length;
    }
  }
    if (!rows || rows.length < USER_PAGE) break;
  }
  return { scanned, removed, resumeFrom: null };
}

/**
 * Jobb 2: ta bort registreringar som aldrig blev något.
 *
 * Ordningen spelar roll: filerna först, sedan datorposten, sist
 * autentiseringskontot. Kraschar rutinen mitt i är resultatet en tom
 * användare utan data — inte data utan ägare, som ingen kan komma åt eller
 * radera.
 */
export async function cleanAbandonedSignups(admin, { now = new Date(), dryRun = false } = {}) {
  const cutoff = new Date(now.getTime() - ABANDONED_SIGNUP_DAYS * DAY_MS);

  // Sidvis: på sikt är nästan alla konton äldre än gränsen. Bara konton
  // utan bokföring behålls i minnet, inte hela bokföringen för alla.
  const rows = [];
  let scannedRows = 0;
  for (let from = 0; ; from += USER_PAGE) {
    const { data, error } = await admin
      .from('user_data')
      .select('user_id, state, created_at')
      .lt('created_at', cutoff.toISOString())
      .order('user_id')
      .range(from, from + USER_PAGE - 1);
    if (error) throw error;
    scannedRows += data?.length || 0;
    // Ett konto i tabelläget raderas bara om varken blobben eller tabellerna
    // har bokföring (_companyStore.js).
    const tablesIds = await tablesModeIds(admin, (data || []).map(r => r.user_id));
    for (const r of data || []) {
      if (hasBookkeepingData(r.state)) continue;
      if (tablesIds.has(r.user_id) && hasBookkeepingData(await readOwnerState(admin, r.user_id))) continue;
      rows.push({ user_id: r.user_id, state: r.state });
    }
    if (!data || data.length < USER_PAGE) break;
  }
  if (!scannedRows) return { candidates: 0, removed: 0 };

  const userIds = rows.map(r => r.user_id);
  const { data: subs, error: subErr } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('user_id', userIds);
  if (subErr) throw subErr;
  const hasSubscription = new Set((subs || []).map(s => s.user_id));

  const abandoned = [];
  for (const r of rows) {
    if (hasSubscription.has(r.user_id)) continue;
    if (await isProtectedAccount(admin, r.user_id, r.state, cutoff)) continue;
    abandoned.push(r);
  }
  if (dryRun) return { candidates: scannedRows, removed: abandoned.length, dryRun: true, userIds: abandoned.map(r => r.user_id) };

  let removed = 0;
  for (const row of abandoned) {
    try {
      for (const bucket of ['bokix-uploads', 'companylogo']) {
        const objects = await listAllObjects(admin, bucket, row.user_id);
        if (objects.length) await admin.storage.from(bucket).remove(objects.map(o => o.path));
      }
      await admin.from('user_data').delete().eq('user_id', row.user_id);
      await admin.auth.admin.deleteUser(row.user_id);
      removed += 1;
    } catch (err) {
      // En användare som inte gick att städa ska inte stoppa resten —
      // nästa körning försöker igen.
      console.warn('Kunde inte städa övergiven registrering:', row.user_id, err.message);
    }
  }
  return { candidates: scannedRows, removed };
}

/** Hur länge ett meddelande från kontaktformuläret sparas. Står i
 * Integritetspolicyn avsnitt 7, ändra båda samtidigt. */
export const CONTACT_MESSAGE_DAYS = 365;

/**
 * Jobb 3: radera meddelanden från kontaktformuläret (contact_messages) som
 * är äldre än ett år. Ett år räcker för att besvara och följa upp ett
 * ärende; därefter är namn, e-post och meddelande uppgifter utan ändamål.
 * Saknas tabellen (admin-SQL:en inte körd) finns inget att städa.
 */
export async function cleanOldContactMessages(admin, { now = new Date(), dryRun = false } = {}) {
  const cutoff = new Date(now.getTime() - CONTACT_MESSAGE_DAYS * DAY_MS).toISOString();
  if (dryRun) {
    const { count, error } = await admin.from('contact_messages').select('id', { count: 'exact', head: true }).lt('created_at', cutoff);
    if (error) throw error;
    return { removed: count || 0, dryRun: true };
  }
  const { data, error } = await admin.from('contact_messages').delete().lt('created_at', cutoff).select('id');
  if (error) {
    if (/does not exist|schema cache/i.test(error.message)) return { removed: 0, missingTable: true };
    throw error;
  }
  return { removed: data?.length || 0 };
}

/** Alla jobben, som cronen anropar dem. Fel loggas men får aldrig fälla
 * hela cron-körningen: påminnelseutskicken är viktigare än städningen. */
async function readCursor(admin, id) {
  const { data } = await admin.from('cron_progress').select('cursor_value').eq('id', id).maybeSingle();
  return data?.cursor_value || null;
}
async function writeCursor(admin, id, value) {
  await admin.from('cron_progress').upsert({ id, cursor_value: value, updated_at: new Date().toISOString() }, { onConflict: 'id' });
}

export async function runDataRetention(admin, options = {}) {
  const result = { snapshots: null, orphanFiles: null, abandonedSignups: null, errors: [] };
  // Med en tidsgräns (egna cronen, api/cron/data-retention.js) fortsätter
  // nattkopiorna och filstädningen där förra natten slutade.
  const resumable = Number.isFinite(options.deadline);
  // Nattkopiorna först: de ska finnas innan något städas (se _archive.js).
  try {
    const startAfter = resumable ? await readCursor(admin, 'retention_snapshots') : null;
    result.snapshots = await snapshotAllUsers(admin, { ...options, startAfter });
    if (resumable && !options.dryRun) await writeCursor(admin, 'retention_snapshots', result.snapshots.resumeFrom || null);
    if (result.snapshots.errors.length) result.errors.push(...result.snapshots.errors.slice(0, 5).map(e => `snapshot ${e}`));
  } catch (err) {
    result.errors.push(`snapshots: ${err.message}`);
  }
  // Arkiv vars sjuårstid gått ut raderas, så att vi inte betalar för dem.
  try {
    result.expiredArchives = await pruneExpiredArchives(admin, options);
  } catch (err) {
    result.errors.push(`expiredArchives: ${err.message}`);
  }
  try {
    const startAfter = resumable ? await readCursor(admin, 'retention_orphans') : null;
    result.orphanFiles = await cleanOrphanFiles(admin, { ...options, startAfter });
    if (resumable && !options.dryRun) await writeCursor(admin, 'retention_orphans', result.orphanFiles.resumeFrom || null);
  } catch (err) {
    result.errors.push(`orphanFiles: ${err.message}`);
  }
  // UF-konton: avslutade vars tre månader gått ut, och konton som inte valt
  // något (varningsmejl, sedan stängning). Bokföringen arkiveras i sju år först.
  try {
    result.closedUfAccounts = await deleteClosedUfAccounts(admin, { ...options, ...ufMailer() });
    if (result.closedUfAccounts.errors.length) result.errors.push(...result.closedUfAccounts.errors.slice(0, 5).map(e => `ufClose ${e}`));
  } catch (err) {
    result.errors.push(`closedUfAccounts: ${err.message}`);
  }
  try {
    result.abandonedSignups = await cleanAbandonedSignups(admin, options);
  } catch (err) {
    result.errors.push(`abandonedSignups: ${err.message}`);
  }
  try {
    result.contactMessages = await cleanOldContactMessages(admin, options);
  } catch (err) {
    result.errors.push(`contactMessages: ${err.message}`);
  }
  return result;
}
