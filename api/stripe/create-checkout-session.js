import { applySecurityHeaders } from '../_security.js';
import Stripe from 'stripe';
import { parseJsonBody } from './_parseBody.js';
import { normalizeAbsoluteUrl } from './_urls.js';
import { resolveInvoiceLineItems } from './_invoiceLineItems.js';
import { checkRateLimit } from '../_rateLimit.js';
import { isRequestFromBot } from '../_botid.js';

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
  if (!checkRateLimit(req, res, { key: 'create-checkout-session', max: 20 })) return;

  // Vercel BotID — routen finns i initBotId()-listan i main.jsx, annars
  // misslyckas den här kollen alltid (se filkommentaren där).
  const isBot = await isRequestFromBot();
  if (isBot) {
    res.status(403).json({ error: 'Åtkomst nekad.' });
    return;
  }

  try {
    const body = await parseJsonBody(req);
    const { user_id: userId, company_id: companyId, invoice_id: invoiceId, customer_email: customerEmail, customer_type: customerType } = body || {};
    if (!userId || !companyId || !invoiceId) {
      res.status(400).json({ error: 'user_id, company_id och invoice_id krävs.' });
      return;
    }

    // Säkerhetsfix: line_items/application_fee_amount/stripe_account_id
    // byggs INTE längre från requesten (body.line_items m.fl.) — de togs
    // tidigare emot rakt från klienten och skickades vidare oförändrade,
    // vilket lät vem som helst posta ett eget (manipulerat) belopp direkt
    // mot den här endpointen. Slås nu upp och räknas om från den lagrade
    // fakturan, se _invoiceLineItems.js.
    const resolved = await resolveInvoiceLineItems({ userId, companyId, invoiceId });
    if (resolved.error) {
      res.status(resolved.status || 400).json({ error: resolved.error });
      return;
    }
    const { lineItems, currency, stripeAccountId } = resolved;

    // Bank transfer (docs.stripe.com/payments/bank-transfers#checkout) kräver
    // en riktig Stripe-kund på sessionen, inte bara customer_email — annars
    // erbjuds den aldrig av Dynamic Payment Methods oavsett vad som är
    // påslaget i Dashboard. Bank transfer stödjer bara EUR/GBP/JPY/MXN/USD —
    // aldrig SEK eller NOK (som Bokix också erbjuder som fakturavaluta) — så
    // en Stripe-kund skapas bara när det faktiskt kan spela roll. En bredare
    // "allt utom SEK"-kontroll skulle skapa en poänglös kundpost i Stripe för
    // varje NOK-faktura, för en betalmetod som ändå aldrig kan visas där.
    const BANK_TRANSFER_CURRENCIES = new Set(['eur', 'gbp', 'usd']);
    let stripeCustomerId;
    if (BANK_TRANSFER_CURRENCIES.has(currency) && customerEmail) {
      // Måste skapas i det ANSLUTNA kontots eget kund-namnrymd (samma
      // { stripeAccount } request-option som sessionen nedan) — en kund
      // skapad på Bokix eget plattformskonto går inte att referera från en
      // session skapad direkt på ett annat (anslutet) konto, se
      // direct-charge-kommentaren vid session-anropet.
      const stripeCustomer = await stripe.customers.create({ email: customerEmail }, { stripeAccount: stripeAccountId });
      stripeCustomerId = stripeCustomer.id;
    }

    // Kundfeedback (två omgångar): (1) betalningslänken visade Bokix eget
    // namn/logga i Checkout-headern istället för kundens, och (2) Bokix
    // egen avgift ska inte vara en fast, orelaterad procentsats (var 5%) —
    // den ska följa Stripes EGEN avgift (som beror på vilket kort som
    // faktiskt används, känd först EFTER betalningen) plus en liten,
    // egen marginal ovanpå. Båda löses av samma ändring: en "direct
    // charge" istället för den gamla "destination charge"
    // (transfer_data.destination) — sessionen skapas nu DIREKT på det
    // anslutna kontot ({ stripeAccount: stripeAccountId } nedan, motsvarar
    // Stripes Stripe-Account-header), så Checkout visar KUNDENS egen
    // branding (verifierat mot docs.stripe.com/connect/direct-charges).
    //
    // INGEN application_fee_amount sätts längre här (jämför tidigare
    // version) — det är MEDVETET, inte en kvarglömd rad. Stripe kan inte
    // känna till sin egen avgift förrän kortet faktiskt dragits (den
    // varierar per korttyp/land), så ett i förväg uträknat fast belopp
    // hade aldrig kunnat vara "Stripes avgift + 1%" på riktigt, bara en
    // gissning. Den riktiga lösningen är Stripes egen "Platform Pricing
    // Tool" (ställs in i Stripe Dashboard under Connect-inställningarna,
    // inte i kod) — den räknar automatiskt ut en dynamisk avgift PER
    // betalning utifrån Stripes faktiska, redan kända avgift för just den
    // transaktionen. Om ett application_fee_amount hade satts här hade det
    // enligt Stripes egen dokumentation ("Fees set with this method
    // override the pricing logic specified in the Platform Pricing Tool")
    // tyst KÖRT ÖVER Dashboard-inställningen — så koden måste avstå helt
    // för att Dashboard-regeln ska få gälla.
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(stripeCustomerId ? { customer: stripeCustomerId } : (customerEmail ? { customer_email: customerEmail } : {})),
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
      ...(customerType === 'se_individual' ? {} : { excluded_payment_method_types: ['klarna'] }),
      line_items: lineItems,
      // Så webhooken (checkout.session.completed, se webhook.js) vet VILKEN
      // faktura som ska markeras betald — utan det här finns ingen koppling
      // alls mellan en Stripe-betalning och en Bokix-faktura.
      metadata: {
        user_id: userId,
        company_id: companyId,
        invoice_id: invoiceId,
      },
      success_url: normalizeAbsoluteUrl(process.env.STRIPE_SUCCESS_URL, 'http://localhost:5173'),
      cancel_url: normalizeAbsoluteUrl(process.env.STRIPE_CANCEL_URL, 'http://localhost:5173'),
    }, { stripeAccount: stripeAccountId });
    res.status(200).json({ session });
  } catch (error) {
    console.error('Stripe create-checkout-session error:', error);
    res.status(500).json({ error: error.message || 'Checkout session creation failed' });
  }
}
