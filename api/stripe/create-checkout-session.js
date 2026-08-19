import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { normalizeAbsoluteUrl } from './_urls.js';

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
const stripe = stripeSecretKey && !stripeSecretKey.startsWith('pk_')
  ? new Stripe(stripeSecretKey, {
      // apiVersion removed to use Stripe account default
    })
  : null;

export default async function handler(req, res) {
  applySecurityHeaders(res);
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!stripe) {
    res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY before trying again.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // payment_method_types utelämnas HELT, alltid — det låter Checkout
      // dynamiskt visa alla metoder som är påslagna i Stripe Dashboard och
      // faktiskt relevanta för valuta/kundland/belopp (kort, Pay by Bank,
      // Klarna, Swish, m.fl. — se "Dynamic Payment Methods" i Stripes
      // dokumentation), istället för en hårdkodad lista som blir inaktuell
      // varje gång ett nytt konto slår på en ny metod i sin Dashboard.
      //
      // Enda undantaget: Klarna stödjer inte B2B (Stripes/Klarnas egna
      // regler, docs.stripe.com/payments/klarna#connect) — så för allt utom
      // privatpersoner (customerType 'se_individual', Contacts.jsx; alla
      // andra typer är företag) exkluderas just Klarna explicit. Övriga
      // metoder (Pay by Bank, SEPA, m.fl.) har ingen sådan B2B-spärr och ska
      // alltså fortfarande kunna visas för företagskunder när de är
      // relevanta — därför en exkluderingslista här, inte en tillåtelselista
      // begränsad till bara kort.
      ...(body.customer_type === 'se_individual' ? {} : { excluded_payment_method_types: ['klarna'] }),
      line_items: body.line_items,
      payment_intent_data: {
        application_fee_amount: body.application_fee_amount || 0,
        transfer_data: {
          destination: body.stripe_account_id,
        },
      },
      customer_email: body.customer_email,
      // Så webhooken (checkout.session.completed, se webhook.js) vet VILKEN
      // faktura som ska markeras betald — utan det här finns ingen koppling
      // alls mellan en Stripe-betalning och en Bokix-faktura.
      metadata: {
        user_id: body.user_id || '',
        company_id: body.company_id || '',
        invoice_id: body.invoice_id || '',
      },
      success_url: normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173'),
      cancel_url: normalizeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, 'http://localhost:5173'),
    });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: error.message || 'Checkout session creation failed' });
  }
}
