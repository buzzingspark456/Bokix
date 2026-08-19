// ── TILLFÄLLIG diagnostikendpoint — felsöker varför webhooken inte verkar
// skriva prenumerationsstatus. Skyddad av ADMIN_SETUP_SECRET. Tas bort igen
// direkt efter felsökningen. ──
import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_') ? new Stripe(stripeSecretKey, {}) : null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  const providedSecret = req.headers['x-admin-secret'];
  if (!process.env.ADMIN_SETUP_SECRET || providedSecret !== process.env.ADMIN_SETUP_SECRET) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (!stripe) {
    res.status(503).json({ error: 'Stripe not configured' });
    return;
  }

  const email = req.query?.email || (req.url.includes('email=') ? new URL(req.url, 'http://x').searchParams.get('email') : null);

  try {
    const out = {};

    // 1) Vilka händelser lyssnar Stripes webhook-endpoint(er) faktiskt på?
    const endpoints = await stripe.webhookEndpoints.list({ limit: 10 });

    if (req.query?.fix_webhook === '1' || req.url.includes('fix_webhook=1')) {
      for (const e of endpoints.data) {
        const needed = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted', 'checkout.session.completed'];
        const missing = needed.filter(ev => !e.enabled_events.includes(ev));
        if (missing.length > 0) {
          const updated = await stripe.webhookEndpoints.update(e.id, {
            enabled_events: [...e.enabled_events, ...missing],
          });
          out.webhook_fix = { id: e.id, added: missing, now: updated.enabled_events };
        } else {
          out.webhook_fix = { id: e.id, added: [], note: 'already had all needed events' };
        }
      }
    }

    out.webhook_endpoints = endpoints.data.map(e => ({
      id: e.id, url: e.url, status: e.status, enabled_events: e.enabled_events,
    }));

    // 2) Stripe-kunder/prenumerationer för den här e-posten
    if (email) {
      const customers = await stripe.customers.list({ email, limit: 5 });
      out.stripe_customers = customers.data.map(c => ({ id: c.id, email: c.email, created: c.created }));

      out.stripe_subscriptions = [];
      for (const c of customers.data) {
        const subs = await stripe.subscriptions.list({ customer: c.id, limit: 5 });
        out.stripe_subscriptions.push(...subs.data.map(s => ({
          id: s.id, status: s.status, customer: s.customer, metadata: s.metadata,
          trial_end: s.trial_end, current_period_end: s.current_period_end,
        })));
      }
    }

    // 3) Supabase: användaren + ev. subscriptions-rad
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey && email) {
      const admin = createClient(supabaseUrl, serviceRoleKey);
      const { data: userList, error: userErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (userErr) out.supabase_user_error = userErr.message;
      const match = userList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      out.supabase_user = match ? { id: match.id, email: match.email, created_at: match.created_at, email_confirmed_at: match.email_confirmed_at } : null;

      if (match) {
        const { data: subRow, error: subErr } = await admin.from('subscriptions').select('*').eq('user_id', match.id).maybeSingle();
        out.subscriptions_row = subRow || null;
        if (subErr) out.subscriptions_row_error = subErr.message;

        const doBackfill = req.query?.backfill === '1' || req.url.includes('backfill=1');
        if (doBackfill && out.stripe_subscriptions?.length > 0) {
          // Flera testregistreringar kan ha skapat flera trialing-
          // prenumerationer på samma konto (samma user_id i metadata) — bara
          // EN ska vara aktiv, annars riskerar kontot dubbel debitering när
          // provperioden går ut. Behåller den senast skapade, avbryter resten.
          const sorted = [...out.stripe_subscriptions].sort((a, b) => (b.trial_end || 0) - (a.trial_end || 0));
          const primary = sorted[0];
          const duplicates = sorted.slice(1).filter(s => s.status === 'trialing' || s.status === 'active');

          out.backfill = { primary: primary.id, canceled_duplicates: [] };
          for (const dup of duplicates) {
            await stripe.subscriptions.cancel(dup.id);
            out.backfill.canceled_duplicates.push(dup.id);
          }

          const { error: upsertErr } = await admin.from('subscriptions').upsert({
            user_id: match.id,
            stripe_customer_id: primary.customer,
            stripe_subscription_id: primary.id,
            status: primary.status,
            trial_ends_at: primary.trial_end ? new Date(primary.trial_end * 1000).toISOString() : null,
            current_period_end: primary.current_period_end ? new Date(primary.current_period_end * 1000).toISOString() : null,
            cancel_at_period_end: false,
          }, { onConflict: 'user_id' });
          if (upsertErr) out.backfill.error = upsertErr.message;
          else out.backfill.status = 'ok';
        }
      }
    }

    res.status(200).json(out);
  } catch (error) {
    console.error('diag error:', error);
    res.status(500).json({ error: error.message, raw: error.raw?.message });
  }
}
