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

  // Bokix egen avgift — kundbeslut: ska följa Stripes EGEN avgift (inte
  // vara en fast, orelaterad procentsats) plus 1% marginal. Stripes riktiga
  // Sverige-prislista (stripe.com/en-se/pricing, kollad i den här
  // sessionen) är 1,5% + 1,80 kr för europeiska kort, upp till 3,15% +
  // 1,80 kr för utländska. En SANN dynamisk "Stripes verkliga avgift"
  // känns bara efter att kortet dragits (Platform Pricing Tool, som skulle
  // räknat ut den automatiskt, funkar tyvärr INTE för direct charges på
  // Standard-konton — Stripes egen begränsning, se docs.stripe.com/
  // connect/platform-pricing-tools#requirements) — så det här är en
  // UPPSKATTNING satt när betalningslänken skapas, inte en exakt
  // efterhandsberäkning: antar den vanligaste bankomatt-europeiska
  // kortavgiften (1,5%) + 1% marginal, avrundat till 2,5%. Blir något för
  // lågt för utländska kort (som egentligen kostar 3,15%), men det är den
  // bästa avvägningen mellan "korrekt branding + pengarna direkt till
  // kunden" (direct charge, kräver ett belopp i förväg) och en exakt
  // efterhandsberäknad avgift (som skulle krävt att INTE ta ut något via
  // Stripe alls, bara logga och fakturera kunden separat i efterhand).
  const PLATFORM_FEE_PERCENT = Number.parseFloat(process.env.STRIPE_PLATFORM_FEE_PERCENT || '2.5');
  const PLATFORM_FEE_FIXED_ORE = Number.parseInt(process.env.STRIPE_PLATFORM_FEE_FIXED_ORE || '180', 10);
  const totalGross = lineItems.reduce((sum, item) => sum + item.price_data.unit_amount * item.quantity, 0);
  // Den fasta delen (1,80 kr) är en svensk kronbelopp — adderas bara för
  // SEK-fakturor, annars hade "180" tolkats som 180 av VALUTANS egen
  // minsta enhet (t.ex. 1,80 USD, ett helt annat belopp) för de fåtal
  // andra valutor Bokix stödjer (se BANK_TRANSFER_CURRENCIES i create-
  // checkout-session.js).
  const applicationFeeAmount = Math.round(totalGross * (PLATFORM_FEE_PERCENT / 100)) + (currency === 'sek' ? PLATFORM_FEE_FIXED_ORE : 0);

  return { lineItems, currency, applicationFeeAmount, stripeAccountId };
}
