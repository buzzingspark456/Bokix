import { fallbackSenderAddress, sendViaResend } from '../_resend.js';

const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;
const SENDING_LEASE_MS = 30 * 60 * 1000;

export async function processDueTrustpilotInvites(admin, {
  bccAddress = process.env.TRUSTPILOT_INVITE_BCC,
  dryRun = false,
  now = new Date(),
  send = sendViaResend,
} = {}) {
  const summary = { sent: 0, wouldSend: 0, failed: 0, errors: [] };
  if (!bccAddress) {
    summary.skipped = 'TRUSTPILOT_INVITE_BCC saknas';
    return summary;
  }

  const timestamp = now.toISOString();
  const staleBefore = new Date(now.getTime() - SENDING_LEASE_MS).toISOString();
  if (!dryRun) {
    const { error: releaseError } = await admin
      .from('trustpilot_invites')
      .update({ status: 'pending', updated_at: timestamp })
      .eq('status', 'sending')
      .lt('updated_at', staleBefore);
    if (releaseError) throw new Error(`Trustpilot: kunde inte frigöra gamla utskick: ${releaseError.message}`);
  }

  const { data: rows, error: selectError } = await admin
    .from('trustpilot_invites')
    .select('id, customer_email, attempts')
    .eq('status', 'pending')
    .lte('scheduled_at', timestamp)
    .order('scheduled_at', { ascending: true })
    .limit(BATCH_SIZE);
  if (selectError) throw new Error(`Trustpilot: kunde inte läsa utskickskön: ${selectError.message}`);

  if (dryRun) {
    summary.wouldSend = rows?.length || 0;
    return summary;
  }

  for (const row of rows || []) {
    const attempts = Number(row.attempts || 0) + 1;
    const { data: claimedRows, error: claimError } = await admin
      .from('trustpilot_invites')
      .update({ status: 'sending', attempts, updated_at: timestamp })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id');
    if (claimError) {
      summary.errors.push(`Trustpilot ${row.id}: kunde inte reservera utskicket: ${claimError.message}`);
      continue;
    }
    if (!claimedRows?.length) continue;

    try {
      const result = await send({
        from: fallbackSenderAddress(),
        to: [row.customer_email],
        bcc: [bccAddress],
        reply_to: process.env.CONTACT_INBOX || 'support@bokix.se',
        subject: 'Hur har du upplevt Bokix?',
        html: '<p>Hej!</p><p>Nu har du använt Bokix i ungefär en månad. Tack för det!</p><p>Om en liten stund får du ett mejl från Trustpilot med en länk där du kan lämna ett omdöme om Bokix. Det tar en minut, och vi vill gärna höra hur det faktiskt har gått, både det som fungerar och det som kan bli bättre.</p><p>Vill du hellre säga något direkt till oss räcker det att svara på det här mejlet.</p><p>Vänliga hälsningar,<br>Bokix</p>',
      }, { idempotencyKey: `trustpilot-invite-${row.id}` });
      if (!result.ok) throw new Error(result.data?.message || `Resend svarade ${result.status}`);

      const { error: markError } = await admin
        .from('trustpilot_invites')
        .update({ status: 'sent', sent_at: timestamp, last_error: null, updated_at: timestamp })
        .eq('id', row.id)
        .eq('status', 'sending');
      if (markError) throw new Error(`mejlet skickades men kunde inte markeras skickat: ${markError.message}`);
      summary.sent += 1;
    } catch (error) {
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      const message = String(error?.message || error).slice(0, 1000);
      const { error: updateError } = await admin
        .from('trustpilot_invites')
        .update({ status, attempts, last_error: message, updated_at: timestamp })
        .eq('id', row.id)
        .eq('status', 'sending');
      if (updateError) {
        summary.errors.push(`Trustpilot ${row.id}: ${message}; kunde inte spara felet: ${updateError.message}`);
      } else {
        summary.errors.push(`Trustpilot ${row.id}: ${message}`);
      }
      if (status === 'failed') summary.failed += 1;
    }
  }
  return summary;
}
