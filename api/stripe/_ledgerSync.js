// Hämtar det anslutna Stripe-kontots saldotransaktioner (betalningar,
// avgifter, återbetalningar, utbetalningar) till public.stripe_ledger_events.
// Delas av den dagliga cronen (api/cron/reminders.js) och "Hämta nu" i
// Granskning (api/stripe/connect.js, action 'sync'), som också körs direkt
// efter att kontot kopplats så att de senaste 90 dagarna kommer in på en gång.
//
// Aldrig auto-bokfört: ReviewQueue.jsx föreslår en kontering som användaren
// godkänner. UNIQUE(stripe_balance_transaction_id) + ignoreDuplicates gör en
// omkörning av samma dagar ofarlig.

// Övre gräns per körning, så ett konto med väldigt många köp inte får cronen
// att slå i Vercels tidsgräns. Resten kommer med nästa körning (fönstret
// överlappar), eller med "Hämta nu".
const MAX_PER_RUN = 2000;
const MATCH_WINDOW_MS = 15 * 60 * 1000;

function chargeInvoiceId(bt) {
  const src = bt.source && typeof bt.source === 'object' ? bt.source : null;
  return src?.metadata?.invoice_id || null;
}

export async function syncStripeLedger({ admin, stripe, userId, companyId, stripeAccountId, sinceSeconds, dryRun = false }) {
  const createdAfter = Math.floor(Date.now() / 1000) - sinceSeconds;
  // expand data.source: kortbetalningen följer med, och sedan 2026-10-17 bär
  // den fakturans id i metadata (create-checkout-session.js:
  // payment_intent_data.metadata), så matchningen blir exakt i stället för
  // en gissning på tidsnärhet.
  const balanceTxns = await stripe.balanceTransactions
    .list({ limit: 100, created: { gte: createdAfter }, expand: ['data.source'] }, { stripeAccount: stripeAccountId })
    .autoPagingToArray({ limit: MAX_PER_RUN });

  if (balanceTxns.length === 0) return { count: 0 };

  // Äldre betalningar (utan metadata på kortbetalningen) matchas som förut
  // mot Bokix egna loggade fakturabetalningar på tidsnärhet (±15 min).
  const { data: paymentEvents } = await admin
    .from('stripe_payment_events')
    .select('invoice_id, amount_total, paid_at')
    .eq('user_id', userId)
    .eq('company_id', companyId)
    .gte('paid_at', new Date((createdAfter - 86400) * 1000).toISOString());
  const unmatchedEvents = [...(paymentEvents || [])];

  const exactIds = new Set(balanceTxns.map(chargeInvoiceId).filter(Boolean));
  for (let i = unmatchedEvents.length - 1; i >= 0; i--) {
    if (exactIds.has(unmatchedEvents[i].invoice_id)) unmatchedEvents.splice(i, 1);
  }

  const rows = balanceTxns.map(bt => {
    let matchedInvoiceId = null;
    let platformFeeAmount = null;
    if (bt.type === 'charge' || bt.type === 'payment') {
      matchedInvoiceId = chargeInvoiceId(bt);
      if (!matchedInvoiceId && bt.currency === 'sek') {
        const btCreatedMs = bt.created * 1000;
        let bestIdx = -1, bestDiff = Infinity;
        unmatchedEvents.forEach((ev, idx) => {
          const diff = Math.abs(new Date(ev.paid_at).getTime() - btCreatedMs);
          if (diff < MATCH_WINDOW_MS && diff < bestDiff) { bestDiff = diff; bestIdx = idx; }
        });
        if (bestIdx !== -1) matchedInvoiceId = unmatchedEvents.splice(bestIdx, 1)[0].invoice_id;
      }
      if (matchedInvoiceId) {
        // Bokix egen andel ur fee_details. bt.fee är hela avgiften (Stripes
        // egen + Bokix), den är det som bokförs.
        const applicationFeeEntry = (bt.fee_details || []).find(fd => fd.type === 'application_fee');
        const feeAmount = applicationFeeEntry ? applicationFeeEntry.amount / 100 : 0;
        if (feeAmount > 0) platformFeeAmount = feeAmount;
      }
    }

    const src = bt.source;
    return {
      user_id: userId,
      company_id: companyId,
      stripe_account_id: stripeAccountId,
      stripe_balance_transaction_id: bt.id,
      type: bt.type,
      amount: bt.amount / 100,
      fee: bt.fee / 100,
      currency: bt.currency,
      description: bt.description || (src && typeof src === 'object' ? src.description || null : null),
      source_id: typeof src === 'string' ? src : (src?.id || null),
      created_at_stripe: new Date(bt.created * 1000).toISOString(),
      matched_invoice_id: matchedInvoiceId,
      platform_fee_amount: platformFeeAmount,
    };
  });

  if (dryRun) return { count: rows.length, dryRun: true };

  // ignoreDuplicates → INSERT ... ON CONFLICT DO NOTHING: en redan loggad
  // (och kanske redan bokförd) rad skrivs aldrig över av en omkörning.
  const { error } = await admin
    .from('stripe_ledger_events')
    .upsert(rows, { onConflict: 'stripe_balance_transaction_id', ignoreDuplicates: true });
  if (error) throw error;
  return { count: rows.length };
}
