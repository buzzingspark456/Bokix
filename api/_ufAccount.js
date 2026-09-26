import { ARCHIVE_BUCKET, listAllObjects } from './_archive.js';

// ─────────────────────────────────────────────────────────────────────────
// UF-konton: avsluta UF-året, och radera kontot tre månader efteråt.
//
// Ett UF-företag är ingen juridisk person och omfattas inte av
// bokföringslagen, så sjuårsarkivet (_archive.js) gäller inte för det. När
// gruppen är klar med sitt UF-år kan de antingen betala och fortsätta, eller
// avsluta. Avslutar de ligger allt kvar i tre månader (så att de hinner
// ladda ner SIE4 och underlag till årsredovisningen hos Ung Företagsamhet),
// sedan raderas kontot helt: data, filer, arkivkopior och inloggningen.
//
// Avslutet sparas i app_metadata (uf_closed_at, uf_delete_after), inte i
// user_metadata: app_metadata kan bara servern skriva, så ingen kan skjuta
// upp sin radering eller låtsas vara avslutad åt någon annan.
//
// Ett konto som ÄVEN har ett vanligt företag med bokföring kan inte avslutas
// här: det företaget omfattas av bokföringslagen och ska sparas i sju år.
// Kontrollen görs både när man avslutar och igen precis innan radering.
// ─────────────────────────────────────────────────────────────────────────

export const UF_KEEP_AFTER_CLOSE_MONTHS = 3;
const ALLOWED_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];
const USER_BUCKETS = ['bokix-uploads', 'companylogo', 'profile', ARCHIVE_BUCKET];
// Tabeller med kontots rader. email_senders raderas av sig själv när
// inloggningen tas bort (ON DELETE CASCADE mot auth.users).
const USER_TABLES = [
  ['subscriptions', 'user_id'],
  ['stripe_payment_events', 'user_id'],
  ['stripe_ledger_events', 'user_id'],
  ['zettle_ledger_events', 'user_id'],
  ['audit_log', 'owner_user_id'],
  ['login_events', 'user_id'],
];

function hasBooks(c) {
  return (
    (c?.verifications?.length || 0) + (c?.invoices?.length || 0) + (c?.expenses?.length || 0)
    + (c?.payrollRuns?.length || 0) + (c?.bankTransactions?.length || 0)
  ) > 0;
}

/** Finns ett företag som INTE är UF och har bokföring? Då gäller lagen. */
export function hasNonUfBookkeeping(state) {
  return Object.values(state?.companies || {}).some(c => !c?.company?.isUf && hasBooks(c));
}

/** Datumet (ÅÅÅÅ-MM-DD) då ett konto som avslutas `now` får raderas. */
export function ufDeleteAfter(now = new Date()) {
  const d = new Date(now.getTime());
  d.setMonth(d.getMonth() + UF_KEEP_AFTER_CLOSE_MONTHS);
  return d.toISOString().slice(0, 10);
}

/**
 * Avslutar UF-året för `user` (verifierad användare). Returnerar
 * { status, body } för endpointen att skicka.
 */
export async function closeUfAccount(admin, user, { now = new Date() } = {}) {
  if (!user?.user_metadata?.uf) {
    return { status: 400, body: { error: 'Bara UF-konton kan avsluta UF-året.' } };
  }
  const existing = user.app_metadata || {};
  if (existing.uf_closed_at && existing.uf_delete_after) {
    return { status: 200, body: { ok: true, closedAt: existing.uf_closed_at, deleteAfter: existing.uf_delete_after } };
  }

  const { data: row, error } = await admin.from('user_data').select('state').eq('user_id', user.id).maybeSingle();
  if (error) return { status: 500, body: { error: 'Kunde inte läsa kontot. Försök igen.' } };
  if (hasNonUfBookkeeping(row?.state)) {
    return {
      status: 409,
      body: { error: 'Kontot har också ett vanligt företag med bokföring. Den måste sparas i sju år enligt bokföringslagen, så kontot kan inte avslutas härifrån. Hör av er till support@bokix.se.' },
    };
  }

  const closedAt = now.toISOString();
  const deleteAfter = ufDeleteAfter(now);
  const { error: updError } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: { ...existing, uf_closed_at: closedAt, uf_delete_after: deleteAfter },
  });
  if (updError) return { status: 500, body: { error: 'Kunde inte avsluta just nu. Försök igen om en stund.' } };
  return { status: 200, body: { ok: true, closedAt, deleteAfter } };
}

async function removeAll(admin, bucket, prefix) {
  const paths = await listAllObjects(admin, bucket, prefix);
  for (let i = 0; i < paths.length; i += 900) {
    const { error } = await admin.storage.from(bucket).remove(paths.slice(i, i + 900));
    if (error) throw new Error(`${bucket}: ${error.message}`);
  }
  return paths.length;
}

/**
 * Cronjobbet: raderar avslutade UF-konton vars tre månader gått ut.
 * Ordningen är filer först, sedan databasen, sist inloggningen, så att en
 * avbruten körning lämnar ett tomt konto kvar och inte data utan ägare.
 */
export async function deleteClosedUfAccounts(admin, { now = new Date(), dryRun = false } = {}) {
  const today = now.toISOString().slice(0, 10);
  const summary = { due: 0, deleted: 0, reopened: 0, kept: 0, files: 0, errors: [] };

  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users || [];

    for (const u of users) {
      const until = u.app_metadata?.uf_delete_after;
      if (!u.user_metadata?.uf || !u.app_metadata?.uf_closed_at || !until || until >= today) continue;
      summary.due += 1;
      try {
        // Började de betala efter avslutet fortsätter kontot som vanligt.
        const { data: subs, error: subError } = await admin.from('subscriptions').select('status').eq('user_id', u.id);
        if (subError) throw subError;
        if ((subs || []).some(s => ALLOWED_SUBSCRIPTION_STATUSES.includes(s.status))) {
          summary.reopened += 1;
          if (!dryRun) {
            const { uf_closed_at: _c, uf_delete_after: _d, ...rest } = u.app_metadata || {};
            await admin.auth.admin.updateUserById(u.id, { app_metadata: rest });
          }
          continue;
        }
        const { data: row, error: rowError } = await admin.from('user_data').select('state').eq('user_id', u.id).maybeSingle();
        if (rowError) throw rowError;
        if (hasNonUfBookkeeping(row?.state)) { summary.kept += 1; continue; }
        if (dryRun) continue;

        for (const bucket of USER_BUCKETS) summary.files += await removeAll(admin, bucket, u.id);
        await admin.from('company_members').delete().or(`owner_user_id.eq.${u.id},member_user_id.eq.${u.id}`);
        for (const [table, column] of USER_TABLES) {
          const { error: delError } = await admin.from(table).delete().eq(column, u.id);
          if (delError) throw new Error(`${table}: ${delError.message}`);
        }
        const { error: delRowError } = await admin.from('user_data').delete().eq('user_id', u.id);
        if (delRowError) throw delRowError;
        const { error: delUserError } = await admin.auth.admin.deleteUser(u.id);
        if (delUserError) throw delUserError;
        summary.deleted += 1;
      } catch (err) {
        summary.errors.push(`${u.id}: ${err.message}`);
      }
    }
    if (users.length < 1000) break;
  }
  return summary;
}
