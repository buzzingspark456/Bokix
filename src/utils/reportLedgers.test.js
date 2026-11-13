import { describe, it, expect } from 'vitest'
import { computeJournal, computeReceivables, computePayables, accountBalanceAt } from './reportLedgers'

const accounts = [{ code: '1510', name: 'Kundfordringar' }, { code: '3001', name: 'Försäljning' }, { code: '2611', name: 'Utgående moms' }, { code: '1930', name: 'Företagskonto' }, { code: '2440', name: 'Leverantörsskulder' }, { code: '5010', name: 'Lokalhyra' }]

describe('computeJournal', () => {
  const vers = [
    { id: '1', number: 'A1', date: '2026-01-10', description: 'Faktura 1', rows: [{ account: '1510', debet: 1250 }, { account: '3001', kredit: 1000 }, { account: '2611', kredit: 250 }] },
    { id: '3', number: 'A3', date: '2026-02-01', description: 'Fel', rows: [{ account: '1930', debet: 100 }, { account: '3001', kredit: 90 }] },
    { id: '4', number: 'B1', date: '2026-02-02', description: 'Utkast', status: 'draft', rows: [] },
    { id: '5', number: 'A4', date: '2027-01-05', description: 'Nästa år', rows: [{ account: '1930', debet: 5 }, { account: '3001', kredit: 5 }] },
  ]
  const j = computeJournal(vers, accounts, new Date(2026, 0, 1), new Date(2026, 11, 31))

  it('bokförda verifikationer i perioden i datumordning med kontonamn', () => {
    expect(j.entries.map(e => e.number)).toEqual(['A1', 'A3'])
    expect(j.entries[0].rows[0]).toMatchObject({ account: '1510', name: 'Kundfordringar', debet: 1250, kredit: 0 })
    expect(j.totalDebet).toBe(1350)
    expect(j.totalKredit).toBe(1340)
  })
  it('hittar verifikationer som inte balanserar', () => {
    expect(j.unbalanced).toEqual([{ number: 'A3', date: '2026-02-01', diff: 10 }])
  })
  it('hittar luckor i nummerserien', () => {
    expect(j.gaps).toEqual([{ series: 'A', missing: [2] }])
  })
})

describe('reskontra', () => {
  const contacts = [{ id: 'c1', name: 'Exempelbygg AB' }, { id: 's1', name: 'Hyresvärden AB' }]
  const invoices = [
    { id: 'i1', invoiceNumber: 1001, customerId: 'c1', date: '2026-09-01', dueDate: '2026-09-30', status: 'sent', amount: 10000 },
    { id: 'i2', invoiceNumber: 1002, customerId: 'c1', date: '2026-11-01', dueDate: '2026-12-01', status: 'sent', amount: 5000, paidAmount: 1000 },
    { id: 'i3', invoiceNumber: 1003, customerId: 'c1', date: '2026-10-01', dueDate: '2026-10-31', status: 'paid', paidDate: '2026-11-05', amount: 2000 },
    { id: 'i4', invoiceNumber: 1004, customerId: 'c1', date: '2026-12-01', status: 'sent', amount: 999 },
    { id: 'q1', type: 'quote', date: '2026-10-01', amount: 7000 },
    { id: 'd1', status: 'draft', date: '2026-10-01', amount: 7000 },
  ]
  const vers = [
    { number: 'A1', date: '2026-09-01', rows: [{ account: '1510', debet: 10000 }, { account: '3001', kredit: 10000 }] },
    { number: 'A2', date: '2026-10-01', rows: [{ account: '1510', debet: 2000 }, { account: '3001', kredit: 2000 }] },
  ]

  it('öppna kundfakturor per datum med åldersfördelning', () => {
    const r = computeReceivables(invoices, contacts, '2026-11-01', vers)
    expect(r.count).toBe(3)
    expect(r.totals.total).toBe(16000)
    expect(r.totals.d60).toBe(10000)
    expect(r.totals.notDue).toBe(4000)
    expect(r.totals.d30).toBe(2000)
    expect(r.parties[0].name).toBe('Exempelbygg AB')
  })
  it('betald före dagen räknas inte, och avstämningen mot 1510 visar skillnaden', () => {
    const r = computeReceivables(invoices, contacts, '2026-11-10', vers)
    expect(r.parties[0].items.map(i => i.number)).toEqual(['1001', '1002'])
    expect(r.ledgerBalance).toBe(12000)
    expect(r.difference).toBe(14000 - 12000)
  })
  it('leverantörsreskontra stäms av mot 2440, obokförda och privat betalda hålls isär', () => {
    const expenses = [
      { id: 'e1', type: 'supplier_invoice', supplierId: 's1', invoiceNumber: 'H-1', date: '2026-10-01', dueDate: '2026-10-31', amount: 4000, rows: [{ account: '5010', netAmount: 4000 }] },
      { id: 'e2', type: 'supplier_invoice', supplier: 'Okänd', date: '2026-10-05', amount: 300 },
      { id: 'e3', type: 'supplier_invoice', supplier: 'Privat', date: '2026-10-05', amount: 800, paidByOwnerPrivately: true, rows: [{ account: '5010', netAmount: 800 }] },
      { id: 'e4', type: 'receipt', date: '2026-10-05', amount: 100 },
    ]
    const v2 = [{ number: 'B1', date: '2026-10-01', rows: [{ account: '5010', debet: 4000 }, { account: '2440', kredit: 4000 }] }]
    const p = computePayables(expenses, contacts, '2026-11-15', v2)
    expect(p.count).toBe(2)
    expect(p.totals.total).toBe(4300)
    expect(p.unbooked).toBe(300)
    expect(p.ledgerBalance).toBe(4000)
    expect(p.difference).toBe(0)
    expect(p.totals.d30).toBe(4000)
  })
  it('saldo per datum', () => {
    expect(accountBalanceAt(vers, '1510', '2026-09-30')).toBe(10000)
  })
})
