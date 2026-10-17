import { getDebet, getKredit } from './verificationAmounts';
import { round2 } from './fixedAssets';
import { t } from '../i18n';

/**
 * Varulager och lagervärdering.
 *
 * Lagret följs som en lagerhändelse-logg (company.stockMovements) per
 * artikel: inleverans (`in`, med inköpspris), uttag/försäljning (`out`) och
 * inventering (`count`, det faktiskt räknade antalet). Värdet räknas fram
 * ur loggen med vald metod:
 *
 *   fifo  äldsta inleveransen förbrukas först ("först in, först ut")
 *   avg   vägt genomsnittligt anskaffningsvärde, omräknat vid varje inleverans
 *
 * Lägsta värdets princip (ÅRL 4 kap. 9 §): varje artikel tas upp till det
 * lägsta av anskaffningsvärdet och nettoförsäljningsvärdet. Artikelns
 * försäljningspris (exkl. moms) används som nettoförsäljningsvärde.
 *
 * Bokslutsverifikationen justerar lagerkontot (t.ex. 1460) till det
 * beräknade värdet och för motposten på lagerförändringskontot (t.ex. 4960).
 */

export const STOCK_METHODS = [
  { id: 'avg', label: t('ui.vagt_genomsnitt') },
  { id: 'fifo', label: t('ui.fifo_forst_in_forst_ut') },
];

export const STOCK_ACCOUNT_KINDS = [
  { id: 'handelsvaror', label: t('ui.handelsvaror'), stockAccount: '1460', changeAccount: '4960' },
  { id: 'ravaror', label: t('ui.ravaror_och_material'), stockAccount: '1410', changeAccount: '4910' },
  { id: 'fardiga', label: t('ui.fardiga_varor'), stockAccount: '1450', changeAccount: '4950' },
];

const num = (v) => Number(v) || 0;

/** Kör lagerloggen för EN artikel och returnerar kvarvarande antal och värde. */
export function valuateArticle(article, movements, method = 'avg', asOf = null) {
  const list = (movements || [])
    .filter(m => m.articleId === article.id && (!asOf || String(m.date) <= asOf))
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));

  let layers = []; // FIFO-lager (partier): [{ qty, cost, date }]
  let qty = 0;
  let avgCost = num(article.purchasePrice);
  let shortfall = 0;
  let lastCost = num(article.purchasePrice);

  const receive = (q, cost, date) => {
    if (q <= 0) return;
    if (method === 'avg') avgCost = qty + q > 0 ? (qty * avgCost + q * cost) / (qty + q) : cost;
    layers.push({ qty: q, cost, date });
    qty += q;
    lastCost = cost;
  };
  const issue = (q) => {
    if (q <= 0) return;
    const taken = Math.min(q, qty);
    shortfall += q - taken;
    qty -= taken;
    let left = taken;
    while (left > 1e-9 && layers.length) {
      const first = layers[0];
      const use = Math.min(first.qty, left);
      first.qty -= use;
      left -= use;
      if (first.qty <= 1e-9) layers.shift();
    }
  };

  list.forEach(m => {
    const q = num(m.qty);
    if (m.type === 'in') receive(q, m.unitCost != null && m.unitCost !== '' ? num(m.unitCost) : lastCost, m.date);
    else if (m.type === 'out') issue(q);
    else if (m.type === 'count') {
      // Inventering: differensen mot bokfört saldo blir svinn (utgående) eller
      // överskott (inleverans till senast kända kostnad).
      const delta = q - qty;
      if (delta < 0) issue(-delta);
      else if (delta > 0) receive(delta, method === 'avg' ? avgCost : lastCost, m.date);
    }
  });

  let value;
  if (method === 'avg') value = qty * avgCost;
  else value = layers.reduce((s, l) => s + l.qty * l.cost, 0);
  value = round2(value);
  return {
    qty: round2(qty),
    costValue: value,
    unitCost: qty > 0 ? round2(value / qty) : (method === 'avg' ? round2(avgCost) : round2(lastCost)),
    shortfall: round2(shortfall),
    // Kvarvarande partier, äldst först (det som säljs först med FIFO).
    layers: layers.filter(l => l.qty > 1e-9).map(l => ({ qty: round2(l.qty), cost: round2(l.cost), date: l.date })),
  };
}

/** Lägsta värdets princip för en artikel. */
export function lowestValue({ qty, unitCost, netSalePrice }) {
  const sale = netSalePrice != null && netSalePrice !== '' ? num(netSalePrice) : null;
  const perUnit = sale != null && sale > 0 ? Math.min(unitCost, sale) : unitCost;
  return round2(qty * perUnit);
}

/**
 * Värderar hela lagret. Bara artiklar av typen 'vara' som har en lagerlogg
 * (eller ett räknat antal) tas med.
 */
export function valuateInventory({ articles, movements, method = 'avg', asOf = null, applyLowestValue = true }) {
  const withStock = new Set((movements || []).map(m => m.articleId));
  const lines = (articles || [])
    .filter(a => a.id && withStock.has(a.id))
    .map(article => {
      const v = valuateArticle(article, movements, method, asOf);
      const bookValue = applyLowestValue
        ? lowestValue({ qty: v.qty, unitCost: v.unitCost, netSalePrice: article.unitPrice })
        : v.costValue;
      return {
        articleId: article.id,
        articleNumber: article.articleNumber || '',
        description: article.description,
        qty: v.qty,
        unitCost: v.unitCost,
        netSalePrice: num(article.unitPrice),
        costValue: v.costValue,
        bookValue,
        writeDown: round2(v.costValue - bookValue),
        shortfall: v.shortfall,
        layers: v.layers,
      };
    })
    .sort((a, b) => a.description.localeCompare(b.description, 'sv'));
  return {
    lines,
    costValue: round2(lines.reduce((s, l) => s + l.costValue, 0)),
    bookValue: round2(lines.reduce((s, l) => s + l.bookValue, 0)),
    writeDown: round2(lines.reduce((s, l) => s + l.writeDown, 0)),
  };
}

/** Saldot på ett lagerkonto i huvudboken till och med ett datum. */
export function ledgerBalanceAt(verifications, account, date) {
  return round2((verifications || []).reduce((sum, v) => {
    if ((v.status || 'booked') === 'draft' || !v.date || v.date > date) return sum;
    return sum + (v.rows || []).reduce((s, r) => (r.account === account ? s + getDebet(r) - getKredit(r) : s), 0);
  }, 0));
}

/** Bokslutsverifikationen: justerar lagerkontot till det värderade beloppet.
 * Returnerar null om inget behöver justeras. */
export function buildInventoryVerification({ date, closingValue, ledgerBalance, stockAccount, changeAccount }) {
  const diff = round2(round2(closingValue) - round2(ledgerBalance));
  if (diff === 0) return null;
  const abs = Math.abs(diff);
  return {
    date,
    description: `Lagerjustering per ${date}`,
    source: 'inventory',
    sourceId: `inventory_${date}`,
    rows: diff > 0
      ? [{ account: stockAccount, debet: abs, kredit: 0 }, { account: changeAccount, debet: 0, kredit: abs }]
      : [{ account: changeAccount, debet: abs, kredit: 0 }, { account: stockAccount, debet: 0, kredit: abs }],
  };
}

const norm = (s) => String(s ?? '').trim().toLowerCase();

/**
 * Lagerutgångar som räknas fram ur fakturor, utan att något sparas eller
 * bokförs. Lagervärderingen tar med dem tillsammans med de manuella
 * lagerhändelserna, så en ändrad, raderad eller krediterad faktura ger rätt
 * lagersaldo direkt och ingen faktura-bokföring behöver röras.
 *
 * Bara varor som redan har en manuell lagerlogg (en inleverans eller
 * inventering) berörs, så artiklar utan lager påverkas aldrig. En fakturarad
 * kopplas till artikeln via artikelnummer, och om raden saknar artikelnummer
 * via exakt samma benämning. Är kopplingen inte entydig hoppas raden över.
 *
 * En vanlig faktura ger en utgång. En kreditfaktura (`creditFor`) är en retur
 * och ger en inleverans till senast kända kostnad. Fakturor före `since`,
 * utkast och offerter räknas inte.
 */
export function deriveInvoiceMovements({ invoices, articles, movements, since = null }) {
  const stocked = new Set((movements || []).filter(m => m.source !== 'invoice').map(m => m.articleId));
  const all = (articles || []).filter(a => a.id);
  const goods = all.filter(a => a.type === 'vara' && stocked.has(a.id));
  const group = (list, key) => list.reduce((map, a) => {
    const k = norm(a[key]);
    if (k) map.set(k, [...(map.get(k) || []), a]);
    return map;
  }, new Map());
  const numberOf = group(all, 'articleNumber');
  const descriptionOf = group(goods, 'description');

  const articleFor = (row) => {
    const number = norm(row.articleNumber);
    const hits = number ? numberOf.get(number) : descriptionOf.get(norm(row.description));
    const article = hits && hits.length === 1 ? hits[0] : null;
    return article && article.type === 'vara' && stocked.has(article.id) ? article : null;
  };

  const out = [];
  (invoices || []).forEach(inv => {
    if ((inv.type || 'invoice') === 'quote' || inv.status === 'draft' || !inv.date) return;
    if (since && String(inv.date) < since) return;
    (inv.rows || []).forEach((row, i) => {
      const qty = num(row.qty);
      const article = qty ? articleFor(row) : null;
      if (!article) return;
      const isReturn = (qty < 0) !== Boolean(inv.creditFor);
      out.push({
        id: `invoice:${inv.id}:${row.id ?? i}`,
        articleId: article.id,
        type: isReturn ? 'in' : 'out',
        date: inv.date,
        qty: Math.abs(qty),
        source: 'invoice',
        sourceId: inv.id,
        invoiceNumber: inv.invoiceNumber || '',
      });
    });
  });
  return out;
}
