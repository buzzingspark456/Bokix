import { createClient } from '@supabase/supabase-js';
import { sendViaResend, hasResendApiKey } from '../_resend.js';
import { ADMIN_EMAILS } from '../_systemEvents.js';
import { planFromId } from '../../src/utils/plans.js';

// Mejl till grundarna när någon startar en provperiod eller betalar
// (önskemål 2026-10-13: "jag får ingen notis om det"). Gäller BARA Bokix
// egna prenumerationer: Connect-endpointen skickar också invoice.paid och
// customer.subscription.* från kundernas anslutna konton, och de händelserna
// har event.account satt. Testläge hoppas också över.

// Stripe skickar om en händelse om webhooken svarar fel eller inte hinner
// svara. En nyckel per händelse i rate limit-tabellen gör att samma händelse
// bara ger ett mejl. Stripe försöker i upp till tre dagar, fönstret är sju.
async function firstTime(eventId) {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return true;
    const { data, error } = await createClient(url, key)
      .rpc('hit_rate_limit', { p_key: `notify:${eventId}`, p_max: 1, p_window_seconds: 7 * 86400 });
    if (error || typeof data !== 'boolean') return true;
    return data;
  } catch {
    return true;
  }
}

const planName = (id) => {
  const plan = planFromId(id);
  if (!plan) return null;
  return `${plan.name}, ${plan.price} kr/mån${plan.intervalId === 'yearly' ? ' (årsplan)' : ''}`;
};
const kr = (ore, currency) => `${(ore / 100).toLocaleString('sv-SE', { maximumFractionDigits: 2 })} ${currency === 'sek' || !currency ? 'kr' : currency.toUpperCase()}`;
const day = (unix) => new Date(unix * 1000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' });
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function customerEmail(stripe, customer) {
  if (customer && typeof customer === 'object') return customer.email || null;
  if (!customer) return null;
  try {
    const c = await stripe.customers.retrieve(customer);
    return c?.deleted ? null : c?.email || null;
  } catch {
    return null;
  }
}

// Bygger { subject, lines } för händelser som är värda ett mejl, annars null.
export async function buildAdminNotice(stripe, event) {
  if (event.account || !event.livemode) return null;
  const obj = event.data?.object || {};

  if (event.type === 'customer.subscription.created') {
    const email = await customerEmail(stripe, obj.customer);
    const plan = planName(obj.metadata?.plan);
    if (obj.status === 'trialing') {
      return {
        subject: `Ny provperiod: ${email || 'okänd e-post'}`,
        lines: [
          `${email || 'Någon'} har skapat ett konto och startat en provperiod.`,
          plan && `Abonnemang: ${plan}`,
          obj.trial_end && `Provperioden slutar ${day(obj.trial_end)}, sedan dras första betalningen.`,
        ],
      };
    }
    if (obj.status === 'active') {
      return {
        subject: `Ny prenumeration: ${email || 'okänd e-post'}`,
        lines: [`${email || 'Någon'} har startat en prenumeration utan provperiod.`, plan && `Abonnemang: ${plan}`],
      };
    }
    return null;
  }

  if (event.type === 'invoice.paid') {
    if (!obj.amount_paid) return null;
    const email = obj.customer_email || (await customerEmail(stripe, obj.customer));
    const amount = kr(obj.amount_paid, obj.currency);
    const first = obj.billing_reason === 'subscription_create' || obj.billing_reason === 'subscription_update';
    const plan = planName(obj.subscription_details?.metadata?.plan || obj.parent?.subscription_details?.metadata?.plan);
    return {
      subject: `Betalning ${amount}: ${email || 'okänd e-post'}`,
      lines: [
        `${email || 'En kund'} har betalat ${amount}${first ? ' (första betalningen)' : ''}.`,
        plan && `Abonnemang: ${plan}`,
        obj.number && `Kvitto: ${obj.number}`,
      ],
    };
  }

  return null;
}

// Bäst-försök: ett fel här får aldrig ändra webhookens svar till Stripe.
export async function notifyAdminsAboutEvent(stripe, event) {
  try {
    if (!hasResendApiKey()) return;
    const notice = await buildAdminNotice(stripe, event);
    if (!notice || !(await firstTime(event.id))) return;
    const body = notice.lines.filter(Boolean).map(l => `<p>${esc(l)}</p>`).join('');
    await sendViaResend({
      from: process.env.EMAIL_FROM || 'Bokix <onboarding@resend.dev>',
      to: ADMIN_EMAILS,
      subject: `Bokix: ${notice.subject}`,
      html: `${body}<p style="color:#666;font-size:13px">Alla prenumerationer syns i /internal och i Stripe.</p>`,
    });
  } catch (error) {
    console.error('Admin-notis misslyckades:', error);
  }
}
