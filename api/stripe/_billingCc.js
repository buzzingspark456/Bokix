// Kopia av Bokix-kvittot till fakturamejladressen (2026-11-16). Ägaren
// anger adressen i Inställningar → Prenumeration (action 'billing-cc' i
// _subscriptionCheckout.js), och den sparas som metadata.billing_cc på
// företagets Stripe-kund. Anropas från webhooken vid invoice.paid för
// Bokix egna prenumerationer. Bästa försök: fel loggas, kastas inte.
import { sendViaResend, hasResendApiKey } from '../_resend.js';
import { brandedEmail, emailButton } from '../../src/utils/brandedEmail.js';
import { sendableEmail } from '../../src/utils/validators.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Mejlet som skickas, separat för att kunna testas. */
export function buildBillingCcEmail(invoice) {
  const amount = (invoice.amount_paid || 0) / 100;
  const currency = (invoice.currency || 'sek').toUpperCase();
  const date = new Date((invoice.status_transitions?.paid_at || invoice.created) * 1000).toISOString().slice(0, 10);
  const link = invoice.invoice_pdf || invoice.hosted_invoice_url;
  const subject = `Kvitto från Bokix${invoice.number ? ` ${invoice.number}` : ''}`;
  const html = brandedEmail({
    title: 'Kvitto från Bokix',
    body: `<p>Här är en kopia av kvittot för prenumerationen på Bokix${invoice.customer_name ? ` för ${esc(invoice.customer_name)}` : ''}.</p>`
      + `<p>Betalt ${esc(date)}: ${esc(amount.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))} ${esc(currency)}${invoice.number ? `, kvitto ${esc(invoice.number)}` : ''}.</p>`
      + (link ? emailButton(link, 'Ladda ner kvittot') : ''),
    footnote: 'Du får det här mejlet för att din adress är angiven som fakturamejl i Bokix. Kontots ägare kan ändra det under Inställningar → Prenumeration.',
  });
  return { subject, html };
}

export async function sendBillingCc(stripe, invoice) {
  if (!invoice || !(invoice.amount_paid > 0) || !hasResendApiKey()) return false;
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return false;
  const customer = await stripe.customers.retrieve(customerId);
  const to = sendableEmail(customer?.metadata?.billing_cc || '');
  if (!to) return false;
  const { subject, html } = buildBillingCcEmail(invoice);
  const result = await sendViaResend({
    from: process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>',
    to: [to],
    subject,
    html,
  }, { idempotencyKey: `billing-cc-${invoice.id}` });
  return Boolean(result?.ok);
}
