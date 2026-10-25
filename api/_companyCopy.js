// Nattlig kontroll av skuggkopian i companies/company_records
// (supabase-2026-10-25-foretag-och-poster.sql). Blobben är fortfarande
// sanningen; tabellerna ska vara en exakt kopia av den.
//
// Ordning: jämför. Skiljer något körs companies_resync(), som speglar om de
// företagen, och sedan jämförs igen. Larm (company_mismatch) går ut om något
// fortfarande skiljer, eller om speglingen har misslyckats det senaste
// dygnet (triggern loggar company_sync_failed direkt i system_events, utan
// mejl, så de räknas här). Rättade företag syns i detaljen; en rättning
// betyder att speglingen missade något, och det ska vi få veta.
//
// Är SQL:en inte körd än (funktionerna saknas) görs ingenting.

const DAY = 24 * 60 * 60 * 1000;

function isMissingFunction(error) {
  return error?.code === 'PGRST202' || /companies_mismatch|companies_resync/i.test(error?.message || '');
}

async function mismatches(admin) {
  const { data, error } = await admin.rpc('companies_mismatch');
  if (error) {
    if (isMissingFunction(error)) return null;
    throw new Error(`companies_mismatch: ${error.message}`);
  }
  return Array.isArray(data) ? data : [];
}

export async function checkCompanyCopy(admin, { now = Date.now() } = {}) {
  const first = await mismatches(admin);
  if (first === null) return { skipped: true };

  let resynced = 0;
  let remaining = first;
  if (first.length) {
    const { data, error } = await admin.rpc('companies_resync');
    if (error) throw new Error(`companies_resync: ${error.message}`);
    resynced = Number(data) || 0;
    remaining = (await mismatches(admin)) || [];
  }

  const { count, error: countError } = await admin
    .from('system_events')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'company_sync_failed')
    .gte('created_at', new Date(now - DAY).toISOString());
  if (countError) throw new Error(`system_events: ${countError.message}`);
  const syncFailures = count || 0;

  let detail = null;
  if (remaining.length || syncFailures || resynced) {
    const list = remaining.slice(0, 5).map(m => `${m.owner_user_id}/${m.legacy_key}: ${m.reason}`).join('; ');
    detail = `${remaining.length} företag skiljer sig${list ? ` (${list})` : ''}. `
      + `${resynced} rättade automatiskt i natt. `
      + `${syncFailures} misslyckade speglingar senaste dygnet (se company_sync_failed i Systemstatus).`;
  }
  return {
    skipped: false,
    mismatched: remaining.length,
    resynced,
    syncFailures,
    detail,
    // Larma bara när något faktiskt är fel eller har gått fel.
    alert: remaining.length > 0 || syncFailures > 0 || resynced > 0,
  };
}
