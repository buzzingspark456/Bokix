// Delad Zettle API-klient — används av cronen (api/cron/reminders.js) för
// att hämta kundens kortförsäljning som bokföringsunderlag (samma idé som
// Stripes balanceTransactions.list i samma fil, se supabase-setup.sql:s
// zettle_ledger_events-kommentar för hela resonemanget).
//
// Alla URL:er/fält nedan är verifierade mot Zettles egen dokumentation
// (developer.zettle.com/docs/api/purchase, github.com/iZettle/
// api-documentation) i september 2026 — INTE testat mot ett riktigt
// Zettle-konto än. Om Zettle skulle svara med ett annat fältnamn/format
// vid det första riktiga testet, titta först här.

const ZETTLE_TOKEN_URL = 'https://oauth.zettle.com/token';
const ZETTLE_PURCHASES_URL = 'https://purchase.izettle.com/purchases/v2';

/**
 * Bytar en refresh-token mot en ny access-token. Zettles access-tokens
 * lever bara 7200 sekunder (2 timmar) — cronen körs en gång om dagen, så
 * en sparad access-token är ALLTID för gammal när den behövs och måste
 * förnyas varje gång, till skillnad från Stripe (vars SDK sköter det här
 * internt med en API-nyckel som aldrig går ut).
 *
 * VIKTIGT (från Zettles egen dokumentation): en ny refresh-token kan följa
 * med svaret, och då ogiltigförklaras den gamla direkt — den NYA måste
 * alltid sparas och användas nästa gång, annars slutar kopplingen fungera
 * efter första förnyelsen. Anroparen ansvarar för att spara `refreshToken`
 * från returvärdet (via set_company_zettle_tokens), inte bara `accessToken`.
 *
 * @returns {Promise<{ accessToken: string, refreshToken: string, expiresAt: string }>}
 */
export async function refreshZettleToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch(ZETTLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Zettle token-förnyelse svarade ${res.status} utan access_token.`);
  }
  return {
    accessToken: data.access_token,
    // Rullande refresh-token (se kommentaren ovan) — faller tillbaka till
    // den gamla ENDAST om Zettle undantagsvis inte skickar en ny, så vi
    // aldrig sparar `undefined` över en fungerande token.
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
      : null,
  };
}

/**
 * Hämtar köp (kortförsäljning) för det anslutna Zettle-kontot inom ett
 * datumintervall. `startDate`/`endDate` är 'YYYY-MM-DD' (UTC, endDate
 * exklusivt — Zettles egen dokumentation).
 *
 * @returns {Promise<Array>} Rå purchase-objekt, se purchase.adoc för fält.
 */
export async function fetchZettlePurchases({ accessToken, startDate, endDate, limit = 200 }) {
  const url = new URL(ZETTLE_PURCHASES_URL);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('descending', 'true');

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Zettle Purchase API svarade ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.purchases) ? data.purchases : [];
}

const ZETTLE_FINANCE_URL = 'https://finance.izettle.com/v2/accounts/LIQUID/transactions';

/**
 * Transaktioner på Zettle-kontots likvida saldo (Finance API v2,
 * github.com/iZettle/api-documentation: finance-api/api-reference-v2.yaml):
 * avgifter (PAYMENT_FEE) och utbetalningar till banken (PAYOUT). `start`
 * inklusive, `end` exklusive, båda UTC 'YYYY-MM-DDThh:mm:ss'. Belopp i ören,
 * negativa när pengar lämnar saldot. Kräver behörigheten READ:FINANCE, som
 * kopplingen redan ber om (callback.js).
 */
export async function fetchZettleFinanceTransactions({ accessToken, start, end, types = ['PAYMENT_FEE', 'PAYOUT'], pageSize = 1000 }) {
  const all = [];
  for (let offset = 0; offset < 20000; offset += pageSize) {
    const url = new URL(ZETTLE_FINANCE_URL);
    url.searchParams.set('start', start);
    url.searchParams.set('end', end);
    for (const t of types) url.searchParams.append('includeTransactionType', t);
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(offset));
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Zettle Finance API svarade ${res.status}${body ? `: ${body.slice(0, 200)}` : ''}`);
    }
    const page = await res.json().catch(() => []);
    const rows = Array.isArray(page) ? page : (Array.isArray(page?.data) ? page.data : []);
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}

/**
 * Gör om Finance-transaktionerna till rader i zettle_ledger_events:
 *  - en rad per UTC-dag med dagens avgifter (summa, återbetalda avgifter
 *    dras av), kind 'fee', nyckel 'fee-<datum>'. Dagar utan avgift hoppas över.
 *  - en rad per utbetalning till banken, kind 'payout', nyckel 'payout-<uuid>'.
 * Beloppen blir positiva kronor (bokföringen vet riktningen av kind).
 */
export function zettleFinanceRows(transactions, { userId, companyId, currency = 'SEK' }) {
  const feesByDay = new Map();
  const payouts = [];
  for (const t of transactions || []) {
    const ore = Number(t?.amount) || 0;
    const ts = String(t?.timestamp || '');
    if (!ts) continue;
    if (t.originatorTransactionType === 'PAYMENT_FEE') {
      const day = ts.slice(0, 10);
      feesByDay.set(day, (feesByDay.get(day) || 0) - ore);
    } else if (t.originatorTransactionType === 'PAYOUT' && ore < 0 && t.originatorTransactionUuid) {
      payouts.push({
        user_id: userId, company_id: companyId, kind: 'payout',
        zettle_purchase_uuid: `payout-${t.originatorTransactionUuid}`,
        amount: -ore / 100, vat_amount: 0, currency, is_refund: false, payment_type: null,
        created_at_zettle: ts.endsWith('Z') ? ts : `${ts}Z`,
      });
    }
  }
  const fees = [...feesByDay.entries()]
    .filter(([, ore]) => ore > 0)
    .map(([day, ore]) => ({
      user_id: userId, company_id: companyId, kind: 'fee',
      zettle_purchase_uuid: `fee-${day}`,
      amount: Math.round(ore) / 100, vat_amount: 0, currency, is_refund: false, payment_type: null,
      created_at_zettle: `${day}T12:00:00Z`,
    }));
  return [...fees, ...payouts];
}
