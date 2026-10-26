import { createClient } from '@supabase/supabase-js';

export function addOneCalendarMonth(value) {
  const date = new Date(value);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date;
}

export function firstPaidInvoice(invoices) {
  return invoices
    .filter(invoice => invoice && invoice.status === 'paid' && Number(invoice.amount_paid) > 0 && Number.isFinite(invoice.created))
    .sort((a, b) => a.created - b.created)[0] || null;
}

export function shouldScheduleTrustpilotInvite(event, bccAddress = process.env.TRUSTPILOT_INVITE_BCC) {
  return Boolean(
    bccAddress
    && event?.livemode
    && !event.account
    && event.type === 'invoice.paid'
    && event.data?.object?.status === 'paid'
    && Number(event.data.object.amount_paid) > 0,
  );
}

function subscriptionIdFromInvoice(invoice) {
  const subscription = invoice.subscription || invoice.parent?.subscription_details?.subscription;
  return typeof subscription === 'string' ? subscription : subscription?.id || null;
}

async function getFirstPaidInvoice(stripe, subscriptionId, currentInvoice) {
  const invoices = [currentInvoice];
  let startingAfter;
  while (true) {
    const page = await stripe.invoices.list({
      subscription: subscriptionId,
      status: 'paid',
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    invoices.push(...(page.data || []));
    if (!page.has_more || !page.data?.length) break;
    startingAfter = page.data[page.data.length - 1].id;
  }
  return firstPaidInvoice(invoices);
}

export async function getFirstPaidInvoiceForCustomer(
  stripe,
  customerId,
  userId,
  currentSubscriptionId,
  currentInvoice,
  knownSubscriptionIds = [],
) {
  const subscriptionIds = new Set([currentSubscriptionId, ...knownSubscriptionIds.filter(Boolean)]);
  if (customerId) {
    let startingAfter;
    while (true) {
      const page = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      for (const subscription of page.data || []) {
        if (subscription.metadata?.user_id === userId) subscriptionIds.add(subscription.id);
      }
      if (!page.has_more || !page.data?.length) break;
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  const firstInvoices = await Promise.all(
    [...subscriptionIds].map(id => getFirstPaidInvoice(stripe, id, id === currentSubscriptionId ? currentInvoice : null)),
  );
  return firstPaidInvoice(firstInvoices.filter(Boolean));
}

export async function scheduleTrustpilotInvite(stripe, event) {
  if (!shouldScheduleTrustpilotInvite(event)) return false;
  const invoice = event.data?.object;
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return false;

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.warn('Trustpilot-inbjudan hoppas över: prenumerationen saknar user_id.', subscriptionId);
    return false;
  }

  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  let recipient = invoice.customer_email || null;
  if (!recipient && customerId) {
    const customer = await stripe.customers.retrieve(customerId);
    recipient = customer?.deleted ? null : customer?.email || null;
  }
  if (!recipient) {
    console.warn('Trustpilot-inbjudan hoppas över: betalningen saknar kundens e-postadress.', invoice.id);
    return false;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase saknas: kan inte schemalägga Trustpilot-inbjudan.');
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: subscriptionRows, error: subscriptionError } = await admin
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('user_id', userId)
    .not('stripe_subscription_id', 'is', null);
  if (subscriptionError) throw new Error(`Kunde inte hämta kundens prenumerationer: ${subscriptionError.message}`);

  const firstInvoice = await getFirstPaidInvoiceForCustomer(
    stripe,
    customerId,
    userId,
    subscriptionId,
    invoice,
    (subscriptionRows || []).map(row => row.stripe_subscription_id),
  );
  if (!firstInvoice) return false;
  const paidAt = new Date(firstInvoice.created * 1000);
  const scheduledAt = addOneCalendarMonth(paidAt);
  const { error } = await admin.from('trustpilot_invites').upsert({
    user_id: userId,
    stripe_subscription_id: subscriptionIdFromInvoice(firstInvoice) || subscriptionId,
    stripe_invoice_id: firstInvoice.id,
    customer_email: recipient,
    paid_at: paidAt.toISOString(),
    scheduled_at: scheduledAt.toISOString(),
    status: 'pending',
  }, { onConflict: 'user_id', ignoreDuplicates: true });
  if (error) throw new Error(`Kunde inte schemalägga Trustpilot-inbjudan: ${error.message}`);
  return true;
}
