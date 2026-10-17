// Kontering av Stripe-saldotransaktioner (public.stripe_ledger_events) i
// Granskning. Pengarna ligger på Stripe-saldot tills Stripe betalar ut dem,
// så saldot bokförs på ett eget konto, 1686 Fordringar för kontokort och
// kuponger (BAS 2026), och utbetalningen flyttar det till 1930:
//
//   kortbetalning av faktura  1686 D / 1510 K  (App.jsx, när webhooken kommer)
//   Stripes avgift            6570 D / 1686 K  (säker, beloppet kommer från Stripe)
//   annan försäljning         1686 D / 30xx K + moms K  (momssats väljs av användaren)
//   återbetalning             30xx D + moms D / 1686 K  (momssats väljs av användaren)
//   utbetalning till banken   1930 D / 1686 K  (säker)
//
// Stripes kortavgifter är momsfria finansiella tjänster, ingen omvänd moms.

export const STRIPE_BALANCE_ACCOUNT = '1686';
export const STRIPE_FEE_ACCOUNT = '6570';
export const BANK_ACCOUNT = '1930';

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * Vilket kortläge en rad visas som. 'safe' betyder att allt i konteringen
 * kommer direkt från Stripe och kan bokföras utan att användaren väljer något.
 */
export function categorizeStripeItem(item) {
  if (!item || item.currency !== 'sek') return 'manual';
  const amount = Number(item.amount) || 0;
  const fee = Number(item.fee) || 0;
  // Äldre rader från tiden med destination charges (före direct charges).
  if (item.type === 'transfer' && item.matched_invoice_id && Number(item.platform_fee_amount) > 0) return 'platform_fee';
  if (item.type === 'charge' || item.type === 'payment') {
    if (item.matched_invoice_id) return fee > 0 ? 'invoice_fee' : 'invoice_paid';
    return amount > 0 ? 'sale' : 'manual';
  }
  if (item.type === 'refund' || item.type === 'payment_refund') return amount < 0 ? 'refund' : 'manual';
  if (item.type === 'payout') return amount < 0 ? 'payout' : 'manual';
  if (item.type === 'stripe_fee' || item.type === 'tax_fee') return amount < 0 ? 'fee' : 'manual';
  return 'manual';
}

// 'fee' (fristående avgifter för t.ex. Billing eller Radar) är inte säker:
// de kan ha moms med omvänd skattskyldighet, så användaren kontrollerar mot
// Stripes faktura. Själva kortavgiften (invoice_fee, och avgiften på en
// försäljning) är momsfri.
export const SAFE_STRIPE_CATEGORIES = new Set(['platform_fee', 'invoice_fee', 'invoice_paid', 'payout']);

export function isSafeStripeItem(item) {
  return SAFE_STRIPE_CATEGORIES.has(categorizeStripeItem(item));
}

function splitVat(gross, vatRate) {
  const net = vatRate > 0 ? round2(gross / (1 + vatRate / 100)) : gross;
  return { net, vat: round2(gross - net) };
}

/**
 * Verifikationen för en rad, eller null om det inte finns något att bokföra
 * (t.ex. en fakturabetalning utan avgift, som redan bokförts via fakturan).
 * `choice` = { account, vatRate, vatAccount } för försäljning/återbetalning.
 */
export function buildStripeVerification(item, choice = {}) {
  const category = categorizeStripeItem(item);
  const date = String(item.created_at_stripe || '').split('T')[0];
  const base = { date, source: 'stripe_ledger', sourceId: item.id };
  const fee = round2(item.fee);
  const amount = round2(item.amount);
  const feeRows = fee > 0
    ? [{ account: STRIPE_FEE_ACCOUNT, debet: fee, kredit: 0 }, { account: STRIPE_BALANCE_ACCOUNT, debet: 0, kredit: fee }]
    : [];

  switch (category) {
    case 'platform_fee': {
      const platformFee = round2(item.platform_fee_amount);
      return {
        ...base,
        description: `Stripe plattformsavgift${item.matched_invoice_id ? ` faktura ${item.matched_invoice_id}` : ''}`,
        rows: [{ account: STRIPE_FEE_ACCOUNT, debet: platformFee, kredit: 0 }, { account: BANK_ACCOUNT, debet: 0, kredit: platformFee }],
      };
    }
    case 'invoice_fee':
      return { ...base, description: `Stripe-avgift kortbetalning${item.matched_invoice_id ? ` faktura ${item.matched_invoice_id}` : ''}`, rows: feeRows };
    case 'payout': {
      const out = Math.abs(amount);
      return {
        ...base,
        description: 'Stripe-utbetalning till bankkontot',
        rows: [{ account: BANK_ACCOUNT, debet: out, kredit: 0 }, { account: STRIPE_BALANCE_ACCOUNT, debet: 0, kredit: out }],
      };
    }
    case 'fee': {
      const out = Math.abs(amount);
      return {
        ...base,
        description: `Stripe-avgift${item.description ? ` ${item.description}` : ''}`,
        rows: [{ account: STRIPE_FEE_ACCOUNT, debet: out, kredit: 0 }, { account: STRIPE_BALANCE_ACCOUNT, debet: 0, kredit: out }],
      };
    }
    case 'sale':
    case 'refund': {
      if (!choice.account) return null;
      const gross = Math.abs(amount);
      const vatRate = Number(choice.vatRate) || 0;
      const { net, vat } = splitVat(gross, vatRate);
      const isSale = category === 'sale';
      const rows = isSale
        ? [{ account: STRIPE_BALANCE_ACCOUNT, debet: gross, kredit: 0 }, { account: choice.account, debet: 0, kredit: net }]
        : [{ account: choice.account, debet: net, kredit: 0 }, { account: STRIPE_BALANCE_ACCOUNT, debet: 0, kredit: gross }];
      if (vat > 0 && choice.vatAccount) rows.push(isSale ? { account: choice.vatAccount, debet: 0, kredit: vat } : { account: choice.vatAccount, debet: vat, kredit: 0 });
      return {
        ...base,
        description: `${isSale ? 'Stripe-försäljning' : 'Stripe-återbetalning'}${item.description ? ` ${item.description}` : ''}`,
        rows: [...rows, ...feeRows],
      };
    }
    default:
      return null;
  }
}
