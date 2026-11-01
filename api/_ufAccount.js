import { ARCHIVE_BUCKET, listAllObjects, archiveCompany } from './_archive.js';
import { readBothStates } from './_companyStore.js';

// ─────────────────────────────────────────────────────────────────────────
// UF-konton: avsluta UF-året, och stäng kontot tre månader efteråt.
//
// Skatteverket kräver att ett UF-företag sparar sin bokföring och alla
// verifikationer (kvitton, fakturor) i sju år, precis som andra. Därför
// gäller sjuårsarkivet (_archive.js) även här. Det som INTE behöver sparas
// är kontot i sig: inloggningen, utkast, kontakter som aldrig använts och
// annat som inte är räkenskapsinformation (GDPR art. 5.1 e).
//
// När gruppen är klar kan de betala och fortsätta, eller avsluta. Avslutar
// de blir kontot skrivskyddat och ligger kvar i tre månader så att de hinner
// ladda ner allt. Sedan flyttar nattjobbet bokföringen och underlagen till
// arkivet (sju år) och tar bort kontot och allt annat.
//
// Avslutet sparas i app_metadata (uf_closed_at, uf_delete_after), inte i
// user_metadata: app_metadata kan bara servern skriva, så ingen kan skjuta
// upp sin stängning eller låtsas vara avslutad åt någon annan.
//
// Väljer gruppen inget alls (varken betalar eller avslutar) stängs kontot
// sex månader efter att gratisperioden tog slut, efter tre varningsmejl:
// när perioden tar slut, en månad före och en vecka före. Inget konto
// stängs automatiskt utan att veckovarningen gått fram minst sju dagar
// innan, så konton vars period gick ut innan regeln fanns får samma varsel.
//
// Ett konto som ÄVEN har ett vanligt företag med bokföring kan inte avslutas
// eller stängas här: det företaget drivs vidare och ska inte stängas med UF-året.
// ─────────────────────────────────────────────────────────────────────────

export const UF_KEEP_AFTER_CLOSE_MONTHS = 3;
export const UF_FREE_MONTHS = 3;
// Väljer gruppen varken att betala eller avsluta stängs kontot så här
// länge efter att gratisperioden tog slut (efter tre varningsmejl).
export const UF_AUTO_CLOSE_AFTER_MONTHS = 6;
const ALLOWED_SUBSCRIPTION_STATUSES = ['trialing', 'active', 'past_due'];
// Levande filer. Arkivbucketen rörs inte, utom kontots nattkopior (se nedan).
const USER_BUCKETS = ['bokix-uploads', 'companylogo', 'profile'];
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
  if (!user?.app_metadata?.uf) {
    return { status: 400, body: { error: 'Bara UF-konton kan avsluta UF-året.' } };
  }
  const existing = user.app_metadata || {};
  if (existing.uf_closed_at && existing.uf_delete_after) {
    return { status: 200, body: { ok: true, closedAt: existing.uf_closed_at, deleteAfter: existing.uf_delete_after } };
  }

  let states;
  try {
    states = await readBothStates(admin, user.id);
  } catch {
    return { status: 500, body: { error: 'Kunde inte läsa kontot. Försök igen.' } };
  }
  if (hasNonUfBookkeeping(states.blob) || hasNonUfBookkeeping(states.tables)) {
    return {
      status: 409,
      body: { error: 'Kontot har också ett vanligt företag med bokföring, så det kan inte stängas med UF-året. Hör av er till bokixab@gmail.com.' },
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

// ── Automatisk stängning (gruppen valde varken att betala eller avsluta) ──

const DAY_MS = 86400000;
// Minst så här många dagar mellan första varningen och stängningen, så att
// även ett gammalt konto hinner få alla tre mejlen (slut, månad, vecka).
const FIRST_MAIL_LEAD_DAYS = 37;
const addMonths = (date, n) => { const d = new Date(date.getTime()); d.setMonth(d.getMonth() + n); return d; };
const isoDay = (date) => date.toISOString().slice(0, 10);

/** När UF-kontots gratisperiod tog slut (registreringen + tre månader). */
export function ufPeriodEnd(user) {
  const created = new Date(user?.created_at);
  return Number.isNaN(created.getTime()) ? null : addMonths(created, UF_FREE_MONTHS);
}

/**
 * Dagen då kontot stängs om gruppen inte väljer något: sex månader efter
 * att gratisperioden tog slut, men aldrig tidigare än en vecka efter det
 * sista varningsmejlet (app_metadata.uf_close_not_before). Det skyddar
 * konton vars period gick ut långt innan den här regeln fanns.
 */
export function ufAutoCloseDate(user) {
  const end = ufPeriodEnd(user);
  if (!end) return null;
  const planned = isoDay(addMonths(end, UF_AUTO_CLOSE_AFTER_MONTHS));
  const notBefore = user?.app_metadata?.uf_close_not_before;
  return notBefore && notBefore > planned ? notBefore : planned;
}

/** Vilket varningsmejl som är på tur i dag, eller null. Ett per natt. */
export function ufMailDue(user, now = new Date()) {
  const closeDate = ufAutoCloseDate(user);
  if (!closeDate) return null;
  const sent = user?.app_metadata?.uf_mail || {};
  const daysLeft = Math.ceil((new Date(`${closeDate}T00:00:00Z`).getTime() - now.getTime()) / DAY_MS);
  // Första mejlet är alltid "gratisperioden är slut", även för ett konto
  // vars period gick ut långt innan regeln fanns (se FIRST_MAIL_LEAD_DAYS).
  if (!sent.ended && !sent.month && !sent.week) return 'ended';
  if (daysLeft <= 7 && !sent.week) return 'week';
  if (daysLeft <= 31 && !sent.month && !sent.week) return 'month';
  return null;
}

async function patchAppMetadata(admin, user, patch) {
  const next = { ...(user.app_metadata || {}), ...patch };
  const { error } = await admin.auth.admin.updateUserById(user.id, { app_metadata: next });
  if (error) throw new Error(`app_metadata: ${error.message}`);
  user.app_metadata = next;
}

/**
 * Stänger kontot: bokföringen till sjuårsarkivet först (kastar vid fel, då
 * rörs inget), sedan filer, databasrader och sist inloggningen, så att en
 * avbruten körning lämnar ett tomt konto kvar och inte data utan ägare.
 */
async function closeAccountNow(admin, u, state, reason, now, summary) {
  for (const [companyId, companyData] of Object.entries(state?.companies || {})) {
    const result = await archiveCompany(admin, { userId: u.id, companyId, companyData, reason, now });
    if (result.path) summary.archived += 1;
  }
  // Nattkopiorna av hela kontot (med utkast och kontaktuppgifter) behövs
  // inte längre: arkivet ovan har det lagen kräver.
  summary.files += await removeAll(admin, ARCHIVE_BUCKET, `${u.id}/_kopior`);
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
}

/**
 * Cronjobbet, en gång per natt. Två sorters UF-konton:
 *  1. Avslutade (uf_closed_at) vars tre månader gått ut: stängs.
 *  2. Gratisperioden slut, varken betalt eller avslutat: tre varningsmejl
 *     (när perioden tar slut, en månad och en vecka före), sedan stängs
 *     kontot sex månader efter periodens slut.
 * Betalar kontot rörs det inte. Har kontot ett vanligt företag med
 * bokföring rörs det inte heller.
 *
 * `sendMail({ to, subject, html })` skickar ett mejl och returnerar true/
 * false. Saknas den skickas inga mejl, och då stängs heller inget konto
 * automatiskt (inget stängs utan att varningen gått fram).
 */
export async function deleteClosedUfAccounts(admin, { now = new Date(), dryRun = false, sendMail = null, buildMail = null } = {}) {
  const today = isoDay(now);
  const summary = { due: 0, deleted: 0, archived: 0, reopened: 0, kept: 0, files: 0, mails: 0, autoClosed: 0, errors: [] };

  for (let page = 1; page < 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users || [];

    for (const u of users) {
      if (!u.app_metadata?.uf) continue;
      const meta = u.app_metadata || {};
      const closedDue = meta.uf_closed_at && meta.uf_delete_after && meta.uf_delete_after < today;
      const periodEnd = ufPeriodEnd(u);
      const unchosen = !meta.uf_closed_at && periodEnd && periodEnd <= now;
      if (!closedDue && !unchosen) continue;

      try {
        // Betalar kontot fortsätter det som vanligt (ett gammalt avslut tas bort).
        const { data: subs, error: subError } = await admin.from('subscriptions').select('status').eq('user_id', u.id);
        if (subError) throw subError;
        if ((subs || []).some(s => ALLOWED_SUBSCRIPTION_STATUSES.includes(s.status))) {
          if (closedDue) {
            summary.reopened += 1;
            if (!dryRun) {
              const { uf_closed_at: _c, uf_delete_after: _d, ...rest } = meta;
              await admin.auth.admin.updateUserById(u.id, { app_metadata: rest });
            }
          }
          continue;
        }
        const states = await readBothStates(admin, u.id);
        if (hasNonUfBookkeeping(states.blob) || hasNonUfBookkeeping(states.tables)) { summary.kept += 1; continue; }
        // Arkivet före stängningen får den mest aktuella versionen.
        const row = { state: states.tables ?? states.blob };

        if (closedDue) {
          summary.due += 1;
          if (!dryRun) await closeAccountNow(admin, u, row?.state, 'uf-avslut', now, summary);
          continue;
        }

        // Gruppen har inte valt. Först varningarna, sedan stängningen.
        const stage = ufMailDue(u, now);
        if (stage) {
          if (!sendMail || !buildMail || !u.email) continue;
          if (stage === 'ended') {
            const earliest = isoDay(new Date(now.getTime() + FIRST_MAIL_LEAD_DAYS * DAY_MS));
            if (!dryRun && ufAutoCloseDate(u) < earliest) await patchAppMetadata(admin, u, { uf_close_not_before: earliest });
          }
          if (stage === 'week') {
            // Minst en vecka mellan sista varningen och stängningen.
            const weekFromNow = isoDay(new Date(now.getTime() + 7 * DAY_MS));
            if (!dryRun && ufAutoCloseDate(u) < weekFromNow) await patchAppMetadata(admin, u, { uf_close_not_before: weekFromNow });
          }
          const closeDate = ufAutoCloseDate(u);
          if (dryRun) { summary.mails += 1; continue; }
          const ok = await sendMail({ to: u.email, ...buildMail({ stage, closeDate }) });
          if (!ok) throw new Error(`mejl ${stage} gick inte fram`);
          await patchAppMetadata(admin, u, { uf_mail: { ...(u.app_metadata?.uf_mail || {}), [stage]: today } });
          summary.mails += 1;
          continue;
        }

        const closeDate = ufAutoCloseDate(u);
        const weekSent = u.app_metadata?.uf_mail?.week;
        if (!weekSent || !closeDate || closeDate >= today) continue;
        const daysSinceWarning = (new Date(`${today}T00:00:00Z`) - new Date(`${weekSent}T00:00:00Z`)) / DAY_MS;
        if (daysSinceWarning < 7) continue;
        summary.due += 1;
        if (!dryRun) {
          await closeAccountNow(admin, u, row?.state, 'uf-stangt', now, summary);
          summary.autoClosed += 1;
        }
      } catch (err) {
        summary.errors.push(`${u.id}: ${err.message}`);
      }
    }
    if (users.length < 1000) break;
  }
  return summary;
}
