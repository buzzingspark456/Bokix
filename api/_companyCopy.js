// Nattlig kontroll av skuggkopian i companies/company_records
// (supabase-2026-10-25-foretag-och-poster.sql). Körs av
// api/cron/company-copy.js.
//
// Ett konto i taget (supabase-2026-10-25-jamforelse-per-konto.sql), så att
// kontrollen håller även med tusentals kunder: först jämförs kontot; skiljer
// något körs companies_resync_for(), sedan jämförs igen. Bara konton som
// ändrats sedan förra genomgången kontrolleras, och alla en gång i veckan
// (söndag). Hinner den inte klart fortsätter nästa natt där den slutade
// (cron_progress 'company_copy').
//
// Larm (company_mismatch) går ut om något fortfarande skiljer, om något
// behövde rättas (då missade speglingen något), eller om speglingen har
// misslyckats det senaste dygnet (triggern loggar company_sync_failed
// direkt i system_events, utan mejl).
//
// Är SQL:en inte körd än (funktionerna saknas) görs ingenting.

const DAY = 24 * 60 * 60 * 1000;
const PAGE = 200;
const PROGRESS_ID = 'company_copy';

function isMissingFunction(error) {
  return error?.code === 'PGRST202' || /companies_(mismatch_for|resync_for|owners_to_check)/i.test(error?.message || '');
}

async function readProgress(admin) {
  const { data } = await admin.from('cron_progress').select('cursor_value').eq('id', PROGRESS_ID).maybeSingle();
  try { return data?.cursor_value ? JSON.parse(data.cursor_value) : null; } catch { return null; }
}

async function writeProgress(admin, value) {
  await admin.from('cron_progress').upsert({ id: PROGRESS_ID, cursor_value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'id' });
}

/**
 * Företag utan id, och aktiva inbjudningar som pekar på ett företag som inte
 * finns. Båda betyder att en inbjuden inte kommer in, så det ska larma innan
 * en kund märker det. Ger { missingIds, brokenInvites, detail }; detail är
 * null när allt stämmer.
 */
export async function checkCompanyLinks(admin) {
  const { data: withoutId, error: idError } = await admin
    .from('companies').select('owner_user_id, legacy_key')
    .is('deleted_at', null).is('legacy_company_id', null).limit(50);
  if (idError) throw new Error(`companies: ${idError.message}`);

  const { data: invites, error: inviteError } = await admin
    .from('company_members').select('owner_user_id, company_id').eq('status', 'active').limit(5000);
  if (inviteError) throw new Error(`company_members: ${inviteError.message}`);

  const owners = [...new Set((invites || []).map(i => i.owner_user_id))];
  const known = new Set();
  for (let i = 0; i < owners.length; i += PAGE) {
    const { data, error } = await admin
      .from('companies').select('owner_user_id, legacy_key, legacy_company_id')
      .is('deleted_at', null).in('owner_user_id', owners.slice(i, i + PAGE));
    if (error) throw new Error(`companies: ${error.message}`);
    for (const c of data || []) {
      known.add(`${c.owner_user_id}/${c.legacy_key}`);
      if (c.legacy_company_id) known.add(`${c.owner_user_id}/${c.legacy_company_id}`);
    }
  }
  const brokenInvites = (invites || []).filter(i => !known.has(`${i.owner_user_id}/${i.company_id}`));
  const missingIds = withoutId || [];
  if (!missingIds.length && !brokenInvites.length) return { missingIds, brokenInvites, detail: null };

  const line = (list, key) => list.slice(0, 5).map(r => `${r.owner_user_id}/${r[key]}`).join('; ');
  return {
    missingIds,
    brokenInvites,
    detail: `${missingIds.length} företag saknar id${missingIds.length ? ` (${line(missingIds, 'legacy_key')})` : ''}. `
      + `${brokenInvites.length} aktiva inbjudningar pekar på ett företag som inte hittas${brokenInvites.length ? ` (${line(brokenInvites, 'company_id')})` : ''}. `
      + 'De inbjudna kommer inte in förrän det är rättat.',
  };
}

/**
 * Går igenom kontona till deadline. Ger en sammanfattning med detail och
 * alert (se ovan), eller { skipped: true } om SQL:en saknas.
 */
export async function checkCompanyCopy(admin, { now = Date.now(), deadline = Infinity } = {}) {
  const saved = await readProgress(admin);
  // Pågående genomgång fortsätter; annars en ny: alla på söndagar, annars
  // de som ändrats sedan förra genomgången började.
  const fullWeekly = new Date(now).getUTCDay() === 0;
  const pass = saved?.after
    ? saved
    : { since: fullWeekly ? null : (saved?.lastPassStart || null), after: null, passStart: new Date(now).toISOString(), lastPassStart: saved?.lastPassStart || null };

  let checked = 0;
  let resynced = 0;
  const remaining = [];
  let done = false;
  for (;;) {
    if (Date.now() > deadline) break;
    const { data: owners, error } = await admin.rpc('companies_owners_to_check', { p_since: pass.since, p_after: pass.after, p_limit: PAGE });
    if (error) {
      if (isMissingFunction(error)) return { skipped: true };
      throw new Error(`companies_owners_to_check: ${error.message}`);
    }
    for (const { owner_user_id: owner } of owners || []) {
      if (Date.now() > deadline) break;
      const first = await admin.rpc('companies_mismatch_for', { p_owner: owner });
      if (first.error) throw new Error(`companies_mismatch_for: ${first.error.message}`);
      if ((first.data || []).length) {
        const fix = await admin.rpc('companies_resync_for', { p_owner: owner });
        if (fix.error) throw new Error(`companies_resync_for: ${fix.error.message}`);
        resynced += Number(fix.data) || 0;
        const again = await admin.rpc('companies_mismatch_for', { p_owner: owner });
        if (again.error) throw new Error(`companies_mismatch_for: ${again.error.message}`);
        remaining.push(...(again.data || []));
      }
      checked++;
      pass.after = owner;
    }
    if (!owners || owners.length < PAGE) { done = Date.now() <= deadline || !owners?.length; break; }
  }
  await writeProgress(admin, done
    ? { after: null, lastPassStart: pass.passStart }
    : pass);

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
    checked,
    complete: done,
    full: pass.since === null,
    mismatched: remaining.length,
    resynced,
    syncFailures,
    detail,
    alert: remaining.length > 0 || syncFailures > 0 || resynced > 0,
  };
}
