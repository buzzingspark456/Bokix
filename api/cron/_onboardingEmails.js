// Kom igång-mejlen: några få tips de första två veckorna, styrda av vad
// kontot faktiskt har gjort. Körs av api/cron/reminders.js en gång per dygn.
//
// Vem får dem (användarens beslut 2026-11-11: aldrig befintliga konton):
// - ONBOARDING_EMAILS_START måste vara satt i Vercel (ett datum, t.ex.
//   2026-11-12). Utan den skickas ingenting.
// - Kontot ska vara skapat samma dag eller senare, OCH ha svarat på steget
//   Start i registreringen (user_metadata.start_path). Äldre konton har
//   varken det ena eller det andra.
// - Inte den som avregistrerat sig (user_metadata.onboarding_emails_off,
//   sätts av api/email/unsubscribe.js).
//
// Vad som skickas (högst ett mejl per konto och körning):
//   welcome  dag 0–2    alltid
//   receipt  dag 3–6    "från noll" och inget kvitto inlagt
//   sie      dag 3–6    "flyttar in" och inga verifikationer
//   invoice  dag 7–13   ingen kundfaktura
// Provperiodens slut (3 dagar före) och Trustpilot (en månad efter första
// betalningen) finns redan i reminders.js och ligger kvar där.
import { fallbackSenderAddress, sendViaResend } from '../_resend.js';
import { createSignedToken } from '../_signedToken.js';
import { buildOnboardingEmail } from '../_emailTemplates.js';

const DAY_MS = 86400000;
const BATCH_SIZE = 200;
// Sista steget skickas senast dag 13; konton äldre än så behöver inte läsas.
const LOOKBACK_DAYS = 15;
export const UNSUBSCRIBE_PURPOSE = 'onboarding-unsub';

const STEPS = [
  { id: 'welcome', from: 0, to: 2 },
  { id: 'receipt', from: 3, to: 6, path: 'new', needsNone: 'expenses' },
  { id: 'sie', from: 3, to: 6, path: 'move', needsNone: 'verifications' },
  { id: 'invoice', from: 7, to: 13, needsNone: 'invoices' },
];

/** Stegen som KAN bli aktuella i dag för kontot, i ordning. Ren funktion. */
export function candidateSteps({ days, path, sent = [] }) {
  return STEPS.filter(s => days >= s.from && days <= s.to && (!s.path || s.path === path) && !sent.includes(s.id));
}

/** Ska kontot över huvud taget få Kom igång-mejl? Ren funktion. */
export function isEligible(user, startDate) {
  if (!user?.email || !startDate) return false;
  const created = new Date(user.created_at).getTime();
  if (!Number.isFinite(created) || created < startDate.getTime()) return false;
  const meta = user.user_metadata || {};
  if (meta.start_path !== 'new' && meta.start_path !== 'move') return false;
  if (meta.onboarding_emails_off === true) return false;
  return true;
}

async function countRecords(admin, companyIds, kind) {
  if (!companyIds.length) return 0;
  const { count, error } = await admin
    .from('company_records')
    .select('id', { count: 'exact', head: true })
    .in('company_id', companyIds)
    .eq('kind', kind)
    .is('deleted_at', null);
  if (error) throw new Error(`kunde inte räkna ${kind}: ${error.message}`);
  return count || 0;
}

export async function processOnboardingEmails(admin, {
  dryRun = false,
  now = new Date(),
  send = sendViaResend,
  startDateEnv = process.env.ONBOARDING_EMAILS_START,
  siteUrl = 'https://www.bokix.se',
} = {}) {
  const summary = { sent: 0, wouldSend: [], skipped: 0, errors: [] };
  const startDate = startDateEnv ? new Date(startDateEnv) : null;
  if (!startDate || Number.isNaN(startDate.getTime())) {
    summary.disabled = 'ONBOARDING_EMAILS_START saknas';
    return summary;
  }

  // Nya konton med prenumerationsrad (provperiod eller betalande).
  const since = new Date(Math.max(startDate.getTime(), now.getTime() - LOOKBACK_DAYS * DAY_MS)).toISOString();
  const { data: subs, error: subsError } = await admin
    .from('subscriptions')
    .select('user_id, status, created_at')
    .gte('created_at', since)
    .in('status', ['trialing', 'active'])
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (subsError) throw new Error(`Kom igång-mejl: kunde inte läsa prenumerationer: ${subsError.message}`);
  const userIds = [...new Set((subs || []).map(r => r.user_id).filter(Boolean))];
  if (!userIds.length) return summary;

  const { data: sentRows, error: sentError } = await admin
    .from('onboarding_emails')
    .select('user_id, step')
    .in('user_id', userIds);
  if (sentError) throw new Error(`Kom igång-mejl: kunde inte läsa utskicksloggen: ${sentError.message}`);
  const sentByUser = new Map();
  for (const row of sentRows || []) {
    if (!sentByUser.has(row.user_id)) sentByUser.set(row.user_id, []);
    sentByUser.get(row.user_id).push(row.step);
  }

  for (const userId of userIds) {
    try {
      const { data: authData, error: authError } = await admin.auth.admin.getUserById(userId);
      const user = authData?.user;
      if (authError || !user) { summary.errors.push(`Kom igång ${userId}: kunde inte läsa kontot`); continue; }
      if (!isEligible(user, startDate)) { summary.skipped += 1; continue; }

      const days = Math.floor((now.getTime() - new Date(user.created_at).getTime()) / DAY_MS);
      const path = user.user_metadata.start_path;
      const candidates = candidateSteps({ days, path, sent: sentByUser.get(userId) || [] });
      if (!candidates.length) continue;

      // Det första steget i ordning vars villkor fortfarande gäller.
      let step = null;
      let companyIds = null;
      for (const candidate of candidates) {
        if (!candidate.needsNone) { step = candidate; break; }
        if (!companyIds) {
          const { data: companies, error: companiesError } = await admin.from('companies').select('id').eq('owner_user_id', userId);
          if (companiesError) throw new Error(`kunde inte läsa företag: ${companiesError.message}`);
          companyIds = (companies || []).map(c => c.id);
        }
        if (await countRecords(admin, companyIds, candidate.needsNone) === 0) { step = candidate; break; }
      }
      if (!step) continue;

      if (dryRun) {
        summary.wouldSend.push({ userId, step: step.id, days });
        continue;
      }

      // Reservera steget först: krockar raden har en annan körning redan tagit det.
      const { error: claimError } = await admin.from('onboarding_emails').insert({ user_id: userId, step: step.id });
      if (claimError) {
        if (claimError.code !== '23505') summary.errors.push(`Kom igång ${userId}: kunde inte reservera ${step.id}: ${claimError.message}`);
        continue;
      }

      try {
        const unsubscribeUrl = `${siteUrl}/api/email/unsubscribe?t=${encodeURIComponent(createSignedToken({ purpose: UNSUBSCRIBE_PURPOSE, uid: userId }))}`;
        const { subject, html } = buildOnboardingEmail({
          step: step.id, path, firstName: user.user_metadata.first_name || '', siteUrl, unsubscribeUrl,
        });
        const result = await send({
          from: fallbackSenderAddress(),
          to: [user.email],
          reply_to: process.env.CONTACT_INBOX || 'support@bokix.se',
          subject,
          html,
          headers: { 'List-Unsubscribe': `<${unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
        }, { idempotencyKey: `onboarding-${userId}-${step.id}` });
        if (!result.ok) throw new Error(result.data?.message || `Resend svarade ${result.status}`);

        const { error: markError } = await admin
          .from('onboarding_emails')
          .update({ sent_at: now.toISOString() })
          .eq('user_id', userId)
          .eq('step', step.id);
        if (markError) summary.errors.push(`Kom igång ${userId}: ${step.id} skickades men kunde inte markeras: ${markError.message}`);
        summary.sent += 1;
      } catch (sendError) {
        // Släpp reservationen så att nästa körning försöker igen (inom fönstret).
        await admin.from('onboarding_emails').delete().eq('user_id', userId).eq('step', step.id).is('sent_at', null);
        summary.errors.push(`Kom igång ${userId}: ${step.id}: ${String(sendError?.message || sendError).slice(0, 300)}`);
      }
    } catch (err) {
      summary.errors.push(`Kom igång ${userId}: ${String(err?.message || err).slice(0, 300)}`);
    }
  }
  return summary;
}
