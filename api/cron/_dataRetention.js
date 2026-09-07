import { collectStoragePaths } from '../../src/utils/storageUrls.js';

// ─────────────────────────────────────────────────────────────────────────
// Datastädning — kör en gång per dygn från api/cron/reminders.js.
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

/** Hur länge en registrering utan betalning får ligga kvar. Tilltaget så att
 * någon som avbröt vid betalsteget hinner komma tillbaka och slutföra utan
 * att behöva registrera sig igen. */
export const ABANDONED_SIGNUP_DAYS = 30;

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
export async function cleanOrphanFiles(admin, { buckets = ['bokix-uploads', 'companylogo'], now = new Date(), dryRun = false } = {}) {
  const cutoff = new Date(now.getTime() - ORPHAN_FILE_GRACE_DAYS * DAY_MS);
  const { data: rows, error } = await admin.from('user_data').select('user_id, state');
  if (error) throw error;

  let scanned = 0;
  let removed = 0;
  for (const row of rows || []) {
    const referenced = collectStoragePaths(row.state);
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
  return { scanned, removed };
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

  const { data: rows, error } = await admin
    .from('user_data')
    .select('user_id, state, created_at')
    .lt('created_at', cutoff.toISOString());
  if (error) throw error;
  if (!rows?.length) return { candidates: 0, removed: 0 };

  const userIds = rows.map(r => r.user_id);
  const { data: subs, error: subErr } = await admin
    .from('subscriptions')
    .select('user_id')
    .in('user_id', userIds);
  if (subErr) throw subErr;
  const hasSubscription = new Set((subs || []).map(s => s.user_id));

  const abandoned = rows.filter(r => !hasSubscription.has(r.user_id) && !hasBookkeepingData(r.state));
  if (dryRun) return { candidates: rows.length, removed: abandoned.length, dryRun: true };

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
  return { candidates: rows.length, removed };
}

/** Båda jobben, som cronen anropar dem. Fel loggas men får aldrig fälla
 * hela cron-körningen: påminnelseutskicken är viktigare än städningen. */
export async function runDataRetention(admin, options = {}) {
  const result = { orphanFiles: null, abandonedSignups: null, errors: [] };
  try {
    result.orphanFiles = await cleanOrphanFiles(admin, options);
  } catch (err) {
    result.errors.push(`orphanFiles: ${err.message}`);
  }
  try {
    result.abandonedSignups = await cleanAbandonedSignups(admin, options);
  } catch (err) {
    result.errors.push(`abandonedSignups: ${err.message}`);
  }
  return result;
}
