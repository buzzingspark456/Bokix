import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { buildVerificationSheet, buildAccountSummarySheet, exportFileName, buildWorkbook } from './excelExport'

const accounts = [{ code: '1930', name: 'Företagskonto' }, { code: '3001', name: 'Försäljning 25 %' }, { code: '2611', name: 'Utgående moms 25 %' }]
const contacts = [{ id: 'c1', name: 'Exempelbygg AB' }]
const projects = [{ id: 'p1', name: 'Kök Storgatan' }]
const vers = [
  { id: 'v2', number: 'A2', date: '2026-03-20', description: 'Faktura 1002', counterpartyId: 'c1', projectId: 'p1',
    rows: [{ account: '1930', debet: '1250.00', kredit: '' }, { account: '3001', debet: 0, kredit: 1000 }, { account: '2611', debet: 0, kredit: 250 }] },
  { id: 'v1', number: 'A1', date: '2026-01-05', description: 'Kontantförsäljning',
    rows: [{ account: '1930', debit: 500 }, { account: '3001', credit: 400, desc: 'Varor', costCenter: 'Butik' }, { account: '2611', kredit: 100 }] },
  { id: 'v3', number: 'A3', date: '2026-04-01', description: 'Utkast', status: 'draft', rows: [{ account: '1930', debet: 99 }] },
]

describe('buildVerificationSheet', () => {
  const sheet = buildVerificationSheet(vers, { accounts, contacts, projects })

  it('en rad per kontorad, utkast utelämnade, sorterat på datum', () => {
    expect(sheet.rows).toHaveLength(6)
    expect(sheet.rows.map(r => r.number)).toEqual(['A1', 'A1', 'A1', 'A2', 'A2', 'A2'])
  })

  it('riktiga tal och datum, gamla fältnamn och strängar läses rätt', () => {
    const first = sheet.rows[0]
    expect(first.date).toBeInstanceOf(Date)
    expect(first.date.toISOString().slice(0, 10)).toBe('2026-01-05')
    expect(first.account).toBe(1930)
    expect(first.debet).toBe(500)
    expect(sheet.rows[3].debet).toBe(1250)
    expect(sheet.rows[1]).toMatchObject({ kredit: 400, amount: -400, rowText: 'Varor', costCenter: 'Butik', series: 'A' })
  })

  it('namn på konto, kund och projekt fylls i', () => {
    expect(sheet.rows[3]).toMatchObject({ accountName: 'Företagskonto', counterparty: 'Exempelbygg AB', project: 'Kök Storgatan' })
  })

  it('kund och leverantör hämtas från fakturan eller kvittot', () => {
    const s = buildVerificationSheet([
      { number: 'A9', date: '2026-05-01', source: 'invoice', sourceId: 'i1', rows: [{ account: '1510', debet: 100 }] },
      { number: 'A10', date: '2026-05-02', source: 'invoice_payment', sourceId: 'i2', rows: [{ account: '1930', debet: 50 }] },
      { number: 'B1', date: '2026-05-03', source: 'supplier_invoice', sourceId: 'e1', rows: [{ account: '2440', kredit: 80 }] },
    ], { contacts, invoices: [{ id: 'i1', customerId: 'c1' }, { id: 'i2', customerName: 'Ny Kund AB' }], expenses: [{ id: 'e1', supplier: 'Dustin' }] })
    expect(s.rows.map(r => r.counterparty)).toEqual(['Exempelbygg AB', 'Ny Kund AB', 'Dustin'])
  })

  it('summa per konto balanserar', () => {
    const sum = buildAccountSummarySheet(sheet)
    expect(sum.rows.map(r => r.account)).toEqual([1930, 2611, 3001])
    expect(sum.rows[0]).toMatchObject({ debet: 1750, kredit: 0, amount: 1750, count: 2 })
    expect(sum.rows.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(0)
  })

  it('filnamnet anger perioden', () => {
    expect(exportFileName(sheet)).toBe('bokforing_2026-01-05_2026-03-20.xlsx')
    expect(exportFileName({ rows: [] })).toBe('bokforing.xlsx')
  })
})

describe('buildWorkbook', () => {
  it('ger celler med tal, datum och talformat som går att läsa tillbaka', () => {
    const sheet = buildVerificationSheet(vers, { accounts, contacts, projects })
    const wb = buildWorkbook(XLSX, [sheet, buildAccountSummarySheet(sheet)])
    expect(wb.SheetNames).toEqual(['Verifikationsrader', 'Summa per konto'])
    const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
    const back = XLSX.read(buf, { cellDates: true, cellNF: true })
    const ws = back.Sheets.Verifikationsrader
    expect(ws.A1.v).toBe('Datum')
    expect(ws.A2.t).toBe('d')
    expect(ws.H2.t).toBe('n')
    expect(ws.H2.v).toBe(500)
    expect(ws.H2.z).toBe('#,##0.00')
    expect(ws['!autofilter']).toBeTruthy()
  })
})

describe('fiscalYearChoices', () => {
  it('ett val per räkenskapsår med bokföring, även brutet år', async () => {
    const { fiscalYearChoices, verificationsInRange } = await import('./excelExport')
    const { fiscalYearBounds } = await import('./reportCalculations')
    const v = [{ date: '2026-03-01', rows: [] }, { date: '2025-12-01', rows: [] }, { date: '2025-04-01', rows: [] }, { date: '2024-01-01', status: 'draft', rows: [] }]
    expect(fiscalYearChoices(v, '2026-01-01', fiscalYearBounds)).toEqual([
      { from: '2026-01-01', to: '2026-12-31', label: '2026' },
      { from: '2025-01-01', to: '2025-12-31', label: '2025' },
    ])
    expect(fiscalYearChoices(v, '2025-07-01', fiscalYearBounds).map(c => c.label)).toEqual(['2025/26', '2024/25'])
    expect(verificationsInRange(v, { from: '2025-01-01', to: '2025-12-31' })).toHaveLength(2)
  })
})
