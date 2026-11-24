// Kundorder (2026-11-24, admin, senare bara Handel-planen): en beställning från
// en kund mellan offert och faktura. Varorna reserveras när ordern läggs,
// dras från lagret när de levereras (helt eller delvis, resten ligger kvar
// som restorder på samma order) och faktureras när de är levererade.
//
// Form: { id, number, customerId, customerName, customerEmail, customerAddress,
//   customerOrgNr, date, deliveryDate, ourRef, theirRef, note, quoteId, quoteNumber,
//   rows: [{ key, articleId, articleNumber, description, qty, unit, unitPrice,
//            vatRate, discount, account, delivered, invoiced }],
//   deliveries: [{ id, date, lines: [{ key, qty }] }], invoiceIds: [], cancelled }
//
// Lagret: leveransen blir uttag (type 'out', reason 'sale', orderId) i
// stockMovements. Fakturan som skapas från ordern har orderId och drar därför
// inte lagret en gång till (se deriveInvoiceMovements i inventory.js).

const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
export const num = (v) => Number(String(v ?? '').replace(/\s/g, '').replace(',', '.')) || 0;

export function nextOrderNumber(list = []) {
  const max = list.reduce((m, o) => {
    const n = Number(String(o.number || '').replace(/^\D+/, ''));
    return Number.isFinite(n) && n > m ? n : m;
  }, 1000);
  return String(max + 1);
}

export const rowLeftToDeliver = (r) => Math.max(0, round2(num(r.qty) - num(r.delivered)));
export const rowLeftToInvoice = (r) => Math.max(0, round2(num(r.delivered) - num(r.invoiced)));
const realRows = (o) => (o?.rows || []).filter(r => num(r.qty) > 0);

/** 'open' | 'partial' | 'delivered' | 'invoiced' | 'cancelled' */
export function orderStatus(o) {
  if (!o) return 'open';
  if (o.cancelled) return 'cancelled';
  const rows = realRows(o);
  if (rows.length === 0) return 'open';
  if (rows.every(r => num(r.invoiced) >= num(r.qty))) return 'invoiced';
  if (rows.every(r => rowLeftToDeliver(r) === 0)) return 'delivered';
  if (rows.some(r => num(r.delivered) > 0)) return 'partial';
  return 'open';
}

/** Ordern kan ändras fritt tills något levererats eller fakturerats. */
export const orderEditable = (o) => !o?.cancelled && realRows(o).every(r => num(r.delivered) === 0 && num(r.invoiced) === 0);

export const rowNet = (r) => round2(num(r.qty) * num(r.unitPrice) * (1 - num(r.discount) / 100));
export function orderTotals(o) {
  const rows = realRows(o);
  const net = round2(rows.reduce((s, r) => s + rowNet(r), 0));
  const vat = round2(rows.reduce((s, r) => s + rowNet(r) * (num(r.vatRate) / 100), 0));
  return { net, vat, total: round2(net + vat) };
}

/** Reserverat per vara i öppna order: Map(articleId → antal). `exceptId` räknas inte. */
export function reservedByArticle(orders = [], exceptId = null) {
  const out = new Map();
  for (const o of orders) {
    if (o.id === exceptId) continue;
    const st = orderStatus(o);
    if (st !== 'open' && st !== 'partial') continue;
    for (const r of o.rows || []) {
      const left = rowLeftToDeliver(r);
      if (!r.articleId || left <= 0) continue;
      out.set(r.articleId, round2((out.get(r.articleId) || 0) + left));
    }
  }
  return out;
}

/**
 * Levererar på en order. `amounts` = { rowKey: antal } (saknas en rad
 * levereras resten). `isStocked(articleId)` säger vilka rader som är
 * lagervaror och ska bli uttag. Returnerar { order, movements, delivered }.
 */
export function deliverOrder(order, { date, amounts = null, newId, isStocked = () => true }) {
  const movements = [];
  const lines = [];
  const rows = (order.rows || []).map(r => {
    const left = rowLeftToDeliver(r);
    const take = amounts ? Math.min(left, Math.max(0, num(amounts[r.key]))) : left;
    if (!(take > 0)) return r;
    lines.push({ key: r.key, qty: take });
    if (r.articleId && isStocked(r.articleId)) {
      movements.push({ id: newId(), articleId: r.articleId, type: 'out', reason: 'sale', date, qty: take, orderId: order.id, note: `Order ${order.number}${order.customerName ? ` ${order.customerName}` : ''}` });
    }
    return { ...r, delivered: round2(num(r.delivered) + take) };
  });
  const deliveries = lines.length ? [...(order.deliveries || []), { id: newId(), date, lines }] : (order.deliveries || []);
  return { order: { ...order, rows, deliveries }, movements, delivered: lines.length };
}

/**
 * Det som är levererat men inte fakturerat, som fakturarader, och ordern
 * med raderna märkta som fakturerade. Returnerar { rows, order } (rows tom
 * om inget finns att fakturera).
 */
export function invoiceFromOrder(order, invoiceId) {
  const rows = [];
  const next = (order.rows || []).map(r => {
    const left = rowLeftToInvoice(r);
    if (!(left > 0)) return r;
    rows.push({
      description: r.description || '', qty: left, unit: r.unit || 'st', unitPrice: num(r.unitPrice),
      vatRate: num(r.vatRate), discount: num(r.discount), account: r.account || '3001', articleNumber: r.articleNumber || '',
    });
    return { ...r, invoiced: round2(num(r.invoiced) + left) };
  });
  if (rows.length === 0) return { rows, order };
  return { rows, order: { ...order, rows: next, invoiceIds: [...(order.invoiceIds || []), invoiceId] } };
}

/** En ny order från en offert. */
export function orderFromQuote(quote, { id, number, rowKey, articles = [] }) {
  const byNumber = new Map(articles.filter(a => a.articleNumber).map(a => [String(a.articleNumber).trim().toLowerCase(), a]));
  // På namn bara när namnet är unikt; två artiklar med samma namn gissas inte.
  const nameCount = articles.reduce((m, a) => { const k = String(a.description || '').trim().toLowerCase(); m.set(k, (m.get(k) || 0) + 1); return m; }, new Map());
  const byName = new Map(articles.filter(a => nameCount.get(String(a.description || '').trim().toLowerCase()) === 1).map(a => [String(a.description || '').trim().toLowerCase(), a]));
  const today = new Date().toISOString().slice(0, 10);
  return {
    id, number, date: today, deliveryDate: '',
    customerId: quote.customerId || '', customerName: quote.customerName || '', customerEmail: quote.customerEmail || '',
    customerAddress: quote.customerAddress || '', customerOrgNr: quote.customerOrgNr || '',
    ourRef: quote.ourRef || '', theirRef: quote.customerContactPerson || '', note: '',
    quoteId: quote.id, quoteNumber: quote.invoiceNumber || '',
    rows: (quote.rows || []).filter(r => r.description || num(r.qty)).map(r => {
      const a = (r.articleNumber && byNumber.get(String(r.articleNumber).trim().toLowerCase())) || byName.get(String(r.description || '').trim().toLowerCase());
      return {
        key: rowKey(), articleId: a?.id || '', articleNumber: r.articleNumber || a?.articleNumber || '', description: r.description || '',
        qty: num(r.qty), unit: r.unit || a?.unit || 'st', unitPrice: num(r.unitPrice), vatRate: num(r.vatRate ?? 25),
        discount: num(r.discount), account: r.account || a?.account || '3001', delivered: 0, invoiced: 0,
      };
    }),
  };
}
