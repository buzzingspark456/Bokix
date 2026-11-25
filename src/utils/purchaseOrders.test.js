import { describe, it, expect } from 'vitest';
import { nextPoNumber, poTotal, poStatus, onOrderByArticle, receivePo, matchPurchaseOrder, sameSupplier } from './purchaseOrders';

const po = (over = {}) => ({
  id: 'p1', number: 'IO-1001', supplier: 'Östersjökompaniet AB', date: '2026-11-01', expectedDate: '2026-11-10', sentAt: '2026-11-01T10:00:00Z',
  rows: [{ key: 'r1', articleId: 'g1', qty: 35, unitCost: 161, received: 0 }, { key: 'r2', articleId: 'g5', qty: 11, unitCost: 89, received: 0 }],
  ...over,
});
let n = 0; const newId = () => `m${++n}`;

describe('inköpsorder', () => {
  it('nummer, summa och status', () => {
    expect(nextPoNumber([])).toBe('IO-1001');
    expect(nextPoNumber([{ number: 'IO-1004' }, { number: 'IO-1002' }])).toBe('IO-1005');
    expect(poTotal(po())).toBe(35 * 161 + 11 * 89);
    expect(poStatus({ ...po(), sentAt: null })).toBe('draft');
    expect(poStatus(po())).toBe('ordered');
    expect(poStatus({ ...po(), cancelled: true })).toBe('cancelled');
  });

  it('delleverans och resten', () => {
    const first = receivePo(po(), { date: '2026-11-08', amounts: { r1: 20 }, newId });
    expect(first.movements).toEqual([expect.objectContaining({ articleId: 'g1', type: 'in', qty: 20, unitCost: 161, poId: 'p1', date: '2026-11-08' })]);
    expect(poStatus(first.po)).toBe('partial');
    expect(onOrderByArticle([first.po]).get('g1')).toEqual({ qty: 15, expectedDate: '2026-11-10' });
    const rest = receivePo(first.po, { date: '2026-11-12', newId });
    expect(rest.movements.map(m => [m.articleId, m.qty])).toEqual([['g1', 15], ['g5', 11]]);
    expect(poStatus(rest.po)).toBe('received');
    expect(onOrderByArticle([rest.po]).size).toBe(0);
  });

  it('tar aldrig emot mer än beställt', () => {
    const r = receivePo(po(), { date: '2026-11-08', amounts: { r1: 99, r2: 0 }, newId });
    expect(r.movements).toHaveLength(1);
    expect(r.po.rows[0].received).toBe(35);
  });

  it('leverantörsnamn med och utan AB', () => {
    expect(sameSupplier('Östersjökompaniet AB', 'ÖSTERSJÖKOMPANIET')).toBe(true);
    expect(sameSupplier('Heyman & Holmberg Aktiebolag', 'HEYMAN & HOLMBERG AB')).toBe(true);
    expect(sameSupplier('Foga System AB', 'Svenska Dynor AB')).toBe(false);
  });

  it('matchar fakturan mot rätt order', () => {
    const total = poTotal(po());
    const other = po({ id: 'p2', number: 'IO-1002', rows: [{ key: 'x', articleId: 'g1', qty: 1, unitCost: 100, received: 0 }] });
    const m = matchPurchaseOrder([other, po()], { supplier: 'Östersjökompaniet', date: '2026-11-12', netAmount: total + 20 });
    expect(m.po.id).toBe('p1');
    expect(m.diff).toBe(20);
    expect(m.sure).toBe(true);
    expect(matchPurchaseOrder([po({ matchedExpenseId: 'e9' })], { supplier: 'Östersjökompaniet', netAmount: total })).toBe(null);
    expect(matchPurchaseOrder([po()], { supplier: 'Foga System', netAmount: total })).toBe(null);
    expect(matchPurchaseOrder([po()], { supplier: 'Östersjökompaniet', netAmount: total * 1.3 }).sure).toBe(false);
  });
});

describe('poStatus med tomma rader', () => {
  it('en ny order med en tom rad är ett utkast, inte levererad', () => {
    expect(poStatus({ rows: [{ key: 'a', articleId: '', qty: '', unitCost: '' }] })).toBe('draft')
    expect(poStatus({ rows: [] })).toBe('draft')
  })
  it('en tom rad bredvid en levererad räknas inte', () => {
    expect(poStatus({ ordered: true, rows: [{ qty: 2, received: 2 }, { qty: '', received: 0 }] })).toBe('received')
  })
})
