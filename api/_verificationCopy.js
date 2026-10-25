// Nattlig kontroll av skuggkopian av verifikationerna (steg A i
// supabase-2026-10-25-verifikationer-steg-a.sql). Blobben är fortfarande
// sanningen; tabellen public.verifications ska vara en exakt kopia av den.
// Skiljer de sig, eller har kopieringen misslyckats det senaste dygnet,
// loggas verif_mismatch och ett larmmejl går ut (_systemEvents.js).
//
// Triggern i databasen loggar sina egna fel (verif_sync_failed) direkt i
// system_events, utan mejl. Därför räknas de här, en gång per natt.
//
// Är SQL:en inte körd än (funktionen saknas) görs ingenting.

const DAY = 24 * 60 * 60 * 1000;

function isMissingFunction(error) {
  return error?.code === 'PGRST202' || /verifications_mismatch/i.test(error?.message || '');
}

export async function checkVerificationCopy(admin, { now = Date.now() } = {}) {
  const { data, error } = await admin.rpc('verifications_mismatch');
  if (error) {
    if (isMissingFunction(error)) return { skipped: true };
    throw new Error(`verifications_mismatch: ${error.message}`);
  }
  const mismatched = Array.isArray(data) ? data : [];

  const { count, error: countError } = await admin
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'verif_sync_failed')
    .gte('created_at', new Date(now - DAY).toISOString());
  if (countError) throw new Error(`system_events: ${countError.message}`);
  const syncFailures = count || 0;

  let detail = null;
  if (mismatched.length || syncFailures) {
    const companies = mismatched.slice(0, 5)
      .map(m => `${m.user_id}/${m.company_id}: blobben ${m.blob_count}, tabellen ${m.table_count}`)
      .join('; ');
    detail = `${mismatched.length} företag skiljer sig${companies ? ` (${companies})` : ''}. `
      + `${syncFailures} misslyckade kopieringar senaste dygnet (se verif_sync_failed i Systemstatus).`;
  }
  return { skipped: false, mismatched: mismatched.length, syncFailures, detail };
}
