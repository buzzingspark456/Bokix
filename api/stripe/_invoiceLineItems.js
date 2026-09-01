import { createClient } from '@supabase/supabase-js';

// Säkerhetsfix (se säkerhetsgranskningen): `create-checkout-session.js`
// tog tidigare emot `line_items`/`application_fee_amount` RAKT från
// klienten och skickade dem vidare till Stripe utan omräkning — vem som
// helst kunde posta ett eget (t.ex. nästan noll) belopp direkt mot
// endpointen och ändå få den riktiga fakturan markerad som betald via
// webhooken (som bara litar på `invoice_id` i metadata, inte beloppet).
//
// Den här funktionen slår istället upp fakturan server-side (via
// service-role-nyckeln, eftersom endpointen inte har en inloggad
// användarsession att RLS:a mot) och bygger line_items från DEN lagrade
// datan — klienten kan inte längre påverka vad som faktiskt debiteras.
// Används av api/stripe/create-checkout-session.js (server.js:s lokala
// dev-route importerar numera den filens handler direkt istället för att
// hålla en egen kopia, se server.js:s kommentar där).
export async function resolveInvoiceLineItems({ userId, companyId, invoiceId }) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return { error: 'SUPABASE_SERVICE_ROLE_KEY saknas — kan inte slå upp fakturan server-side.', status: 503 };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: row, error: fetchError } = await supabaseAdmin
    .from('user_data')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) {
    return { error: fetchError.message, status: 500 };
  }
  const companyData = row?.state?.companies?.[companyId];
  const invoice = companyData?.invoices?.find(i => i.id === invoiceId);
  if (!companyData || !invoice) {
    return { error: 'Fakturan kunde inte hittas.', status: 404 };
  }

  // Betalningen får bara gå till DET Stripe-konto som faktiskt är kopplat
  // till fakturans företag — annars kunde ett manipulerat stripe_account_id
  // i requesten styra om pengarna till ett helt annat konto.
  const stripeAccountId = companyData.company?.stripeAccountId;
  if (!stripeAccountId) {
    return { error: 'Stripe är inte anslutet för det här företaget.', status: 400 };
  }

  // Samma beräkning som App.jsx:s getInvoicePaymentLinkUrl gjorde
  // client-side tidigare — flyttad hit, inte ändrad.
  const currency = (invoice.currency || 'SEK').toLowerCase();
  const lineItems = (invoice.rows || [])
    .filter(r => r.description && r.unitPrice > 0)
    .map(r => ({
      price_data: {
        currency,
        product_data: { name: r.description },
        unit_amount: Math.round((r.unitPrice || 0) * 100),
      },
      quantity: Math.max(1, Math.round(r.qty || 1)),
    }));
  if (lineItems.length === 0) {
    return { error: 'Fakturan saknar giltiga rader.', status: 400 };
  }

  // Inget applicationFeeAmount att räkna ut här längre — Bokix avgift
  // sätts numera av Stripes egen Platform Pricing Tool (Dashboard-
  // konfiguration, dynamisk "Stripes verkliga avgift + 1%"), inte ett
  // fast, i förväg uträknat belopp. Se create-checkout-session.js:s
  // kommentar vid session-anropet för hela resonemanget.
  return { lineItems, currency, stripeAccountId };
}
