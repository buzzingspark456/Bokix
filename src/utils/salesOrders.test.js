import { describe, it, expect } from 'vitest';
import { nextOrderNumber, orderStatus, orderEditable, orderTotals, reservedByArticle, deliverOrder, invoiceFromOrder, orderFromQuote, applyInvoiceExistence } from './salesOrders';

let n = 0;
const newId = () => `id${++n}`;
const order = (over = {}) => ({
  id: 'o1', number: '1001', customerName: 'Kund AB',
  rows: [
    { key: 'a', articleId: 'art1', description: 'Stol', qty: 10, unitPrice: 100, vatRate: 25, delivered: 0, invoiced: 0 },
    { key: 'b', articleId: '', description: 'Frakt', qty: 1, unitPrice: 200, vatRate: 25, delivered: 0, invoiced: 0 },
  ],
  ...over,
});

describe('kundorder', () => {
  it('numrerar från 1001', () => {
    expect(nextOrderNumber([])).toBe('1001');
    expect(nextOrderNumber([{ number: '1004' }, { number: '1002' }])).toBe('1005');
  });

  it('status följer leverans och fakturering', () => {
    expect(orderStatus(order())).toBe('open');
    expect(orderStatus({ rows: [{ qty: '' }] })).toBe('open');
    expect(orderStatus(order({ cancelled: true }))).toBe('cancelled');
    const part = deliverOrder(order(), { date: '2026-11-24', amounts: { a: 4 }, newId }).order;
    expect(orderStatus(part)).toBe('partial');
    expect(orderEditable(part)).toBe(false);
    const all = deliverOrder(part, { date: '2026-11-25', newId }).order;
    expect(orderStatus(all)).toBe('delivered');
    const inv = invoiceFromOrder(all, 'inv1').order;
    expect(orderStatus(inv)).toBe('invoiced');
  });

  it('summerar netto, moms och rabatt', () => {
    expect(orderTotals(order())).toEqual({ net: 1200, vat: 300, total: 1500 });
    expect(orderTotals({ rows: [{ qty: 2, unitPrice: 100, discount: 10, vatRate: 25 }] })).toEqual({ net: 180, vat: 45, total: 225 });
  });

  it('reserverar det som inte är levererat i öppna order', () => {
    const part = deliverOrder(order(), { date: '2026-11-24', amounts: { a: 4 }, newId }).order;
    expect(reservedByArticle([part]).get('art1')).toBe(6);
    expect(reservedByArticle([part], 'o1').get('art1')).toBeUndefined();
    expect(reservedByArticle([order({ cancelled: true })]).size).toBe(0);
  });

  it('delleverans blir uttag bara för lagervaror och resten ligger kvar', () => {
    const { order: o, movements, delivered } = deliverOrder(order(), { date: '2026-11-24', amounts: { a: 4, b: 1 }, newId, isStocked: (id) => id === 'art1' });
    expect(delivered).toBe(2);
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ articleId: 'art1', type: 'out', qty: 4, orderId: 'o1', date: '2026-11-24' });
    expect(o.rows[0].delivered).toBe(4);
    expect(o.deliveries).toHaveLength(1);
    // Mer än som finns kvar går inte att leverera.
    expect(deliverOrder(o, { date: '2026-11-25', amounts: { a: 99 }, newId }).order.rows[0].delivered).toBe(10);
  });

  it('fakturerar bara det levererade och aldrig två gånger', () => {
    const part = deliverOrder(order(), { date: '2026-11-24', amounts: { a: 4 }, newId }).order;
    const first = invoiceFromOrder(part, 'inv1');
    expect(first.rows).toHaveLength(1);
    expect(first.rows[0]).toMatchObject({ description: 'Stol', qty: 4, unitPrice: 100 });
    expect(first.order.invoiceIds).toEqual(['inv1']);
    expect(invoiceFromOrder(first.order, 'inv2').rows).toHaveLength(0);
  });

  it('gör en order av en offert och hittar artikeln', () => {
    const quote = { id: 'q1', invoiceNumber: '7', customerId: 'c1', customerName: 'Kund AB', rows: [{ description: 'Stol', articleNumber: '100', qty: 3, unitPrice: 99, vatRate: 25 }, { description: '', qty: 0 }] };
    const o = orderFromQuote(quote, { id: 'o9', number: '1001', rowKey: newId, articles: [{ id: 'art1', articleNumber: '100', description: 'Stol', unit: 'st' }] });
    expect(o.quoteId).toBe('q1');
    expect(o.rows).toHaveLength(1);
    expect(o.rows[0]).toMatchObject({ articleId: 'art1', qty: 3, unitPrice: 99, delivered: 0 });
  });

  it('gissar inte artikel när två har samma namn', () => {
    const quote = { id: 'q2', rows: [{ description: 'Stol', qty: 1, unitPrice: 10 }] };
    const o = orderFromQuote(quote, { id: 'o8', number: '1002', rowKey: newId, articles: [{ id: 'x1', description: 'Stol' }, { id: 'x2', description: 'Stol' }] });
    expect(o.rows[0].articleId).toBe('');
  });

  it('fakturerat följer fakturorna som finns: borttaget utkast ger ofakturerat, ångra ger fakturerat igen', () => {
    const delivered = deliverOrder(order(), { date: '2026-11-24', newId }).order;
    const inv = invoiceFromOrder(delivered, 'inv1').order;
    expect(orderStatus(inv)).toBe('invoiced');
    const gone = applyInvoiceExistence(inv, new Set());
    expect(orderStatus(gone)).toBe('delivered');
    expect(gone.invoiceIds).toEqual([]);
    expect(invoiceFromOrder(gone, 'inv2').rows).toHaveLength(2);
    expect(orderStatus(applyInvoiceExistence(inv, new Set(['inv1'])))).toBe('invoiced');
  });

  it('räknar fakturans faktiska antal när utkastet ändrats', () => {
    const delivered = deliverOrder(order(), { date: '2026-11-24', newId }).order;
    const inv = invoiceFromOrder(delivered, 'inv1').order;
    const invoice = { id: 'inv1', rows: [{ id: 'inv1_r0', qty: 6 }] }; // stolen 10 -> 6, frakten borttagen
    const res = applyInvoiceExistence(inv, new Map([['inv1', invoice]]));
    expect(res.rows[0].invoiced).toBe(6);
    expect(res.rows[1].invoiced).toBe(0);
    expect(orderStatus(res)).toBe('delivered');
  });
});

describe('orderTone: radens färg i orderlistan', async () => {
  const { orderTone } = await import('./salesOrders')
  const today = '2026-11-26'
  const row = (qty, delivered = 0, invoiced = 0) => ({ key: 'r' + Math.random(), qty, delivered, invoiced, unitPrice: 100 })
  it('öppen order med leverans framåt är ofärgad', () => {
    expect(orderTone({ deliveryDate: '2026-12-05', rows: [row(2)] }, today)).toBe('open')
  })
  it('passerad leveransdag utan full leverans är försenad', () => {
    expect(orderTone({ deliveryDate: '2026-11-20', rows: [row(2)] }, today)).toBe('late')
    expect(orderTone({ deliveryDate: '2026-11-20', rows: [row(4, 1)] }, today)).toBe('late')
  })
  it('levererad men inte fakturerad ska faktureras, även om leveransdagen passerat', () => {
    expect(orderTone({ deliveryDate: '2026-11-20', rows: [row(2, 2)] }, today)).toBe('toInvoice')
  })
  it('fakturerad och makulerad', () => {
    expect(orderTone({ deliveryDate: '2026-11-01', rows: [row(2, 2, 2)] }, today)).toBe('invoiced')
    expect(orderTone({ deliveryDate: '2026-11-01', cancelled: true, rows: [row(2)] }, today)).toBe('cancelled')
  })
  it('utan leveransdag blir den aldrig försenad', () => {
    expect(orderTone({ deliveryDate: '', rows: [row(2)] }, today)).toBe('open')
  })
})
