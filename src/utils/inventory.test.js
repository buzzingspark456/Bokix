import { describe, it, expect } from 'vitest'
import {
  valuateArticle, lowestValue, valuateInventory, ledgerBalanceAt, buildInventoryVerification, deriveInvoiceMovements,
} from './inventory'

const art = { id: 'a1', description: 'Kaffe 500g', unitPrice: 100, purchasePrice: 40 }
const mv = (type, date, qty, unitCost) => ({ id: `${type}${date}${qty}`, articleId: 'a1', type, date, qty, unitCost })

describe('valuateArticle', () => {
  const log = [mv('in', '2026-01-01', 10, 40), mv('in', '2026-02-01', 10, 60)]

  it('weighted average: 20 units at (400+600)/20 = 50', () => {
    const v = valuateArticle(art, log, 'avg')
    expect(v).toMatchObject({ qty: 20, unitCost: 50, costValue: 1000 })
  })

  it('FIFO: an issue consumes the oldest layer first', () => {
    const v = valuateArticle(art, [...log, mv('out', '2026-03-01', 10)], 'fifo')
    // 10 kvar från andra inleveransen à 60
    expect(v).toMatchObject({ qty: 10, costValue: 600, unitCost: 60 })
  })

  it('average: an issue leaves the remaining units at the average cost', () => {
    const v = valuateArticle(art, [...log, mv('out', '2026-03-01', 10)], 'avg')
    expect(v).toMatchObject({ qty: 10, costValue: 500, unitCost: 50 })
  })

  it('FIFO differs from average for the same log — the methods are not interchangeable', () => {
    const l = [...log, mv('out', '2026-03-01', 10)]
    expect(valuateArticle(art, l, 'fifo').costValue).not.toBe(valuateArticle(art, l, 'avg').costValue)
  })

  it('a physical count below book becomes shrinkage (svinn)', () => {
    const v = valuateArticle(art, [...log, mv('count', '2026-12-31', 15)], 'avg')
    expect(v.qty).toBe(15)
    expect(v.costValue).toBe(750)
  })

  it('a physical count above book adds surplus at the last known cost', () => {
    const v = valuateArticle(art, [mv('in', '2026-01-01', 10, 40), mv('count', '2026-12-31', 12)], 'fifo')
    expect(v.qty).toBe(12)
    expect(v.costValue).toBe(480)
  })

  it('never goes negative — reports the shortfall instead', () => {
    const v = valuateArticle(art, [mv('in', '2026-01-01', 5, 40), mv('out', '2026-02-01', 8)], 'avg')
    expect(v.qty).toBe(0)
    expect(v.costValue).toBe(0)
    expect(v.shortfall).toBe(3)
  })

  it('respects the asOf date', () => {
    expect(valuateArticle(art, log, 'avg', '2026-01-15').qty).toBe(10)
  })

  it('ignores other articles', () => {
    const other = { ...mv('in', '2026-01-01', 99, 1), articleId: 'zzz' }
    expect(valuateArticle(art, [other], 'avg').qty).toBe(0)
  })
})

describe('lowestValue', () => {
  it('uses the lower of cost and net sale price', () => {
    expect(lowestValue({ qty: 10, unitCost: 50, netSalePrice: 30 })).toBe(300)
    expect(lowestValue({ qty: 10, unitCost: 50, netSalePrice: 80 })).toBe(500)
  })

  it('falls back to cost when there is no sale price', () => {
    expect(lowestValue({ qty: 10, unitCost: 50, netSalePrice: 0 })).toBe(500)
    expect(lowestValue({ qty: 10, unitCost: 50, netSalePrice: '' })).toBe(500)
  })
})

describe('valuateInventory', () => {
  it('reports cost value, book value and the write-down between them', () => {
    const cheap = { id: 'a2', description: 'Gammal modell', unitPrice: 20, purchasePrice: 50 }
    const r = valuateInventory({
      articles: [art, cheap],
      movements: [mv('in', '2026-01-01', 10, 40), { ...mv('in', '2026-01-01', 10, 50), articleId: 'a2' }],
    })
    expect(r.costValue).toBe(900)
    expect(r.bookValue).toBe(600)
    expect(r.writeDown).toBe(300)
    expect(r.lines).toHaveLength(2)
  })

  it('leaves out articles that have no stock log', () => {
    expect(valuateInventory({ articles: [art], movements: [] }).lines).toHaveLength(0)
  })

  it('can skip lowest-value valuation', () => {
    const cheap = { id: 'a2', description: 'X', unitPrice: 1, purchasePrice: 50 }
    const r = valuateInventory({ articles: [cheap], movements: [{ ...mv('in', '2026-01-01', 2, 50), articleId: 'a2' }], applyLowestValue: false })
    expect(r.bookValue).toBe(100)
  })
})

describe('ledger balance and closing entry', () => {
  const vers = [
    { date: '2026-03-01', rows: [{ account: '1460', debet: 5000, kredit: 0 }] },
    { date: '2026-06-01', rows: [{ account: '1460', debet: 0, kredit: 1000 }] },
    { date: '2027-01-01', rows: [{ account: '1460', debet: 9999, kredit: 0 }] },
    { date: '2026-04-01', status: 'draft', rows: [{ account: '1460', debet: 7777, kredit: 0 }] },
  ]

  it('sums booked rows on the account up to the date only', () => {
    expect(ledgerBalanceAt(vers, '1460', '2026-12-31')).toBe(4000)
  })

  it('books an increase as D lager / K lagerförändring', () => {
    const v = buildInventoryVerification({ date: '2026-12-31', closingValue: 6500, ledgerBalance: 4000, stockAccount: '1460', changeAccount: '4960' })
    expect(v.rows).toEqual([
      { account: '1460', debet: 2500, kredit: 0 },
      { account: '4960', debet: 0, kredit: 2500 },
    ])
  })

  it('books a decrease the other way', () => {
    const v = buildInventoryVerification({ date: '2026-12-31', closingValue: 3000, ledgerBalance: 4000, stockAccount: '1460', changeAccount: '4960' })
    expect(v.rows).toEqual([
      { account: '4960', debet: 1000, kredit: 0 },
      { account: '1460', debet: 0, kredit: 1000 },
    ])
  })

  it('returns null when the ledger already matches', () => {
    expect(buildInventoryVerification({ date: '2026-12-31', closingValue: 4000, ledgerBalance: 4000, stockAccount: '1460', changeAccount: '4960' })).toBeNull()
  })
})

describe('deriveInvoiceMovements', () => {
  const articles = [
    { id: 'a1', type: 'vara', articleNumber: 'K-1', description: 'Kaffe', unitPrice: 100, purchasePrice: 40 },
    { id: 'a2', type: 'vara', articleNumber: 'T-1', description: 'Te', unitPrice: 50, purchasePrice: 20 },
    { id: 'a3', type: 'tjanst', articleNumber: 'S-1', description: 'Konsulttimme', unitPrice: 900 },
  ]
  const movements = [{ id: 'm1', articleId: 'a1', type: 'in', date: '2026-01-01', qty: 10, unitCost: 40 }]
  const inv = (over = {}) => ({ id: 'i1', invoiceNumber: '1001', date: '2026-03-01', status: 'sent', rows: [{ articleNumber: 'K-1', description: 'Kaffe', qty: 3 }], ...over })
  const derive = (invoices, extra = {}) => deriveInvoiceMovements({ invoices, articles, movements, ...extra })

  it('en faktura ger en lagerutgång på rätt vara, antal och datum', () => {
    expect(derive([inv()])).toEqual([{ id: 'invoice:i1:0', articleId: 'a1', type: 'out', date: '2026-03-01', qty: 3, source: 'invoice', sourceId: 'i1', invoiceNumber: '1001' }])
  })

  it('utkast, offerter och fakturor före startdatumet räknas inte', () => {
    expect(derive([inv({ status: 'draft' })])).toEqual([])
    expect(derive([inv({ type: 'quote' })])).toEqual([])
    expect(derive([inv()], { since: '2026-04-01' })).toEqual([])
    expect(derive([inv()], { since: '2026-03-01' }).length).toBe(1)
  })

  it('bara varor som redan har en lagerlogg berörs', () => {
    expect(derive([inv({ rows: [{ articleNumber: 'T-1', qty: 2 }] })])).toEqual([])
    expect(derive([inv({ rows: [{ articleNumber: 'S-1', qty: 1 }] })])).toEqual([])
  })

  it('utan artikelnummer kopplas raden på exakt benämning, oavsett versaler', () => {
    expect(derive([inv({ rows: [{ articleNumber: '', description: ' kaffe ', qty: 1 }] })]).length).toBe(1)
    expect(derive([inv({ rows: [{ description: 'Kaffe extra', qty: 1 }] })])).toEqual([])
  })

  it('ett artikelnummer som pekar på en annan artikel faller inte tillbaka på benämningen', () => {
    expect(derive([inv({ rows: [{ articleNumber: 'S-1', description: 'Kaffe', qty: 1 }] })])).toEqual([])
  })

  it('en tvetydig koppling hoppas över', () => {
    const dup = [...articles, { id: 'a4', type: 'vara', articleNumber: 'K-1', description: 'Kaffe 2' }]
    expect(deriveInvoiceMovements({ invoices: [inv()], articles: dup, movements })).toEqual([])
  })

  it('en kreditfaktura är en retur och ger en inleverans', () => {
    const [m] = derive([inv({ creditFor: '1001', rows: [{ articleNumber: 'K-1', qty: 1, unitPrice: -100 }] })])
    expect(m.type).toBe('in')
    expect(m.qty).toBe(1)
  })

  it('negativt antal på en vanlig faktura är också en retur', () => {
    expect(derive([inv({ rows: [{ articleNumber: 'K-1', qty: -2 }] })])[0]).toMatchObject({ type: 'in', qty: 2 })
  })

  it('rader utan antal eller utan artikel ger inget', () => {
    expect(derive([inv({ rows: [{ articleNumber: 'K-1', qty: 0 }, { description: 'Frakt', qty: 1 }] })])).toEqual([])
    expect(derive(undefined)).toEqual([])
  })

  it('lagervärderingen tar med utgångarna och ändras när fakturan ändras eller tas bort', () => {
    const value = (invoices) => valuateInventory({ articles, movements: [...movements, ...derive(invoices)], method: 'avg', applyLowestValue: false })
    expect(value([]).lines[0].qty).toBe(10)
    expect(value([inv()]).lines[0].qty).toBe(7)
    expect(value([inv({ rows: [{ articleNumber: 'K-1', qty: 5 }] })]).lines[0].costValue).toBe(200)
    expect(value([inv(), inv({ id: 'i2', creditFor: '1001', rows: [{ articleNumber: 'K-1', qty: 3 }] })]).lines[0].qty).toBe(10)
  })

  it('utgångar som redan är härledda räknas inte som en egen lagerlogg', () => {
    const onlyDerived = [{ id: 'invoice:x:0', articleId: 'a2', type: 'out', date: '2026-02-01', qty: 1, source: 'invoice' }]
    expect(deriveInvoiceMovements({ invoices: [inv({ rows: [{ articleNumber: 'T-1', qty: 1 }] })], articles, movements: onlyDerived })).toEqual([])
  })
})
