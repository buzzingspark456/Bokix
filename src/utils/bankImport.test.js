import { describe, it, expect } from 'vitest'
import {
  parseDelimited, parseAmount, parseFlexibleDate, guessColumnMapping,
  fingerprintHeaders, normalizeRows, dedupeAgainstExisting,
  suggestInvoiceMatch, suggestSupplierInvoiceMatch, invoiceRemaining,
} from './bankImport'

describe('parseDelimited', () => {
  it('auto-detects a semicolon-delimited export (Swedbank/SEB-style)', () => {
    const csv = 'Bokföringsdag;Text;Belopp\n2026-06-01;ICA Supermarket;-245,50\n2026-06-02;Faktura 1001;5000,00'
    const { headers, rows } = parseDelimited(csv)
    expect(headers).toEqual(['Bokföringsdag', 'Text', 'Belopp'])
    expect(rows).toHaveLength(2)
    expect(rows[0]['Text']).toBe('ICA Supermarket')
  })

  it('auto-detects a comma-delimited export (Nordea-style)', () => {
    const csv = 'Datum,Beskrivning,Belopp\n2026-06-01,Kortköp,-100.00'
    const { headers, rows } = parseDelimited(csv)
    expect(headers).toEqual(['Datum', 'Beskrivning', 'Belopp'])
    expect(rows[0]['Belopp']).toBe('-100.00')
  })
})

describe('parseAmount', () => {
  it('parses Swedish decimal-comma amounts', () => {
    expect(parseAmount('-245,50')).toBeCloseTo(-245.5)
    expect(parseAmount('1 234,56')).toBeCloseTo(1234.56) // mellanslag som tusentalsavgränsare
  })

  it('parses English decimal-point amounts', () => {
    expect(parseAmount('-100.00')).toBeCloseTo(-100)
    expect(parseAmount('1,234.56')).toBeCloseTo(1234.56)
  })

  it('returns 0 for empty/unparseable input', () => {
    expect(parseAmount('')).toBe(0)
    expect(parseAmount(undefined)).toBe(0)
    expect(parseAmount('inte ett belopp')).toBe(0)
  })
})

describe('parseFlexibleDate', () => {
  it('keeps an already-ISO date', () => {
    expect(parseFlexibleDate('2026-06-01')).toBe('2026-06-01')
    expect(parseFlexibleDate('2026-06-01T00:00:00')).toBe('2026-06-01')
  })

  it('falls back to European DD/MM/YYYY', () => {
    expect(parseFlexibleDate('15/06/2026')).toBe('2026-06-15')
  })

  it('returns empty string for unparseable input', () => {
    expect(parseFlexibleDate('')).toBe('')
    expect(parseFlexibleDate('inte ett datum')).toBe('')
  })
})

describe('guessColumnMapping', () => {
  it('guesses a Swedbank/SEB-style single-amount-column header set', () => {
    const headers = ['Radnummer', 'Bokföringsdag', 'Transaktionsdag', 'Valutadag', 'Referens', 'Text', 'Belopp', 'Bokfört saldo']
    const mapping = guessColumnMapping(headers)
    expect(mapping.date).toBe('Bokföringsdag')
    expect(mapping.description).toBe('Text')
    expect(mapping.amountMode).toBe('single')
    expect(mapping.amountColumn).toBe('Belopp')
    expect(mapping.balanceColumn).toBe('Bokfört saldo')
    expect(mapping.referenceColumn).toBe('Referens')
  })

  it('guesses a split debit/credit header set (Uttag/Insättning)', () => {
    const headers = ['Datum', 'Specifikation', 'Uttag', 'Insättning', 'Saldo']
    const mapping = guessColumnMapping(headers)
    expect(mapping.date).toBe('Datum')
    expect(mapping.description).toBe('Specifikation')
    expect(mapping.amountMode).toBe('split')
    expect(mapping.debitColumn).toBe('Uttag')
    expect(mapping.creditColumn).toBe('Insättning')
  })

  it('leaves a field blank when nothing in the dictionary matches, rather than guessing wrong', () => {
    const headers = ['Kolumn1', 'Kolumn2']
    const mapping = guessColumnMapping(headers)
    expect(mapping.date).toBe('')
    expect(mapping.description).toBe('')
  })
})

describe('fingerprintHeaders', () => {
  it('is stable regardless of case/whitespace', () => {
    expect(fingerprintHeaders(['Datum', 'Text', 'Belopp'])).toBe(fingerprintHeaders([' datum ', 'TEXT', 'belopp']))
  })

  it('differs for a different header set', () => {
    expect(fingerprintHeaders(['Datum', 'Text', 'Belopp'])).not.toBe(fingerprintHeaders(['Datum', 'Text', 'Uttag', 'Insättning']))
  })
})

describe('normalizeRows', () => {
  it('normalizes single-column signed amounts', () => {
    const mapping = { date: 'Datum', description: 'Text', amountMode: 'single', amountColumn: 'Belopp', invertSign: false }
    const { rows, errors } = normalizeRows([
      { Datum: '2026-06-01', Text: 'ICA', Belopp: '-245,50' },
      { Datum: '2026-06-02', Text: 'Faktura 1001', Belopp: '5000,00' },
    ], mapping)
    expect(errors).toHaveLength(0)
    expect(rows[0]).toMatchObject({ date: '2026-06-01', description: 'ICA', amount: -245.5 })
    expect(rows[1]).toMatchObject({ date: '2026-06-02', description: 'Faktura 1001', amount: 5000 })
  })

  it('normalizes split debit/credit columns into a single signed amount', () => {
    const mapping = { date: 'Datum', description: 'Text', amountMode: 'split', debitColumn: 'Uttag', creditColumn: 'Insättning', invertSign: false }
    const { rows } = normalizeRows([
      { Datum: '2026-06-01', Text: 'Kortköp', Uttag: '150,00', Insättning: '' },
      { Datum: '2026-06-02', Text: 'Lön', Uttag: '', Insättning: '25000,00' },
    ], mapping)
    expect(rows[0].amount).toBe(-150)
    expect(rows[1].amount).toBe(25000)
  })

  it('honors the manual invert-sign toggle', () => {
    const mapping = { date: 'Datum', description: 'Text', amountMode: 'single', amountColumn: 'Belopp', invertSign: true }
    const { rows } = normalizeRows([{ Datum: '2026-06-01', Text: 'ICA', Belopp: '-245,50' }], mapping)
    expect(rows[0].amount).toBe(245.5)
  })

  it('flags a row with an unparseable date as an error, not a silent zero-date row', () => {
    const mapping = { date: 'Datum', description: 'Text', amountMode: 'single', amountColumn: 'Belopp', invertSign: false }
    const { rows, errors } = normalizeRows([{ Datum: 'trasigt', Text: 'X', Belopp: '10,00' }], mapping)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })

  it('flags a row as an error in split mode too when neither debit nor credit column is mapped (regression)', () => {
    // Bugg: villkoret kollade tidigare bara 'single'-läge, så en rad utan
    // mappad uttag/insättning-kolumn fick amount=0 och importerades TYST
    // som en riktig 0-kr-transaktion istället för att flaggas.
    const mapping = { date: 'Datum', description: 'Text', amountMode: 'split', debitColumn: '', creditColumn: '', invertSign: false }
    const { rows, errors } = normalizeRows([{ Datum: '2026-06-01', Text: 'X' }], mapping)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
  })

  it('still imports a genuinely zero-amount row when the source cell is actually "0,00", not just empty', () => {
    const mapping = { date: 'Datum', description: 'Text', amountMode: 'single', amountColumn: 'Belopp', invertSign: false }
    const { rows, errors } = normalizeRows([{ Datum: '2026-06-01', Text: 'Nollrad', Belopp: '0,00' }], mapping)
    expect(errors).toHaveLength(0)
    expect(rows[0].amount).toBe(0)
  })
})

describe('dedupeAgainstExisting', () => {
  const existing = [{ date: '2026-06-01', amount: -245.5, description: 'ICA' }]

  it('skips a row already present (idempotent re-import of an overlapping statement)', () => {
    const newRows = [{ date: '2026-06-01', amount: -245.5, description: 'ICA' }, { date: '2026-06-02', amount: 100, description: 'Ny' }]
    const { toImport, alreadyImported } = dedupeAgainstExisting(newRows, existing)
    expect(toImport).toHaveLength(1)
    expect(toImport[0].description).toBe('Ny')
    expect(alreadyImported).toHaveLength(1)
  })

  it('also dedupes duplicate rows within the same file', () => {
    const newRows = [{ date: '2026-06-05', amount: 10, description: 'X' }, { date: '2026-06-05', amount: 10, description: 'X' }]
    const { toImport, alreadyImported } = dedupeAgainstExisting(newRows, [])
    expect(toImport).toHaveLength(1)
    expect(alreadyImported).toHaveLength(1)
  })
})

describe('suggestInvoiceMatch', () => {
  const contacts = [{ id: 'c1', name: 'Anna Andersson' }]
  const invoices = [{
    id: 'inv1', status: 'sent', customerId: 'c1', invoiceNumber: '1001', dueDate: '2026-06-05',
    rows: [{ qty: 1, unitPrice: 1000, vatRate: 25 }],
  }]

  it('matches an incoming payment to the invoice with the same remaining amount', () => {
    const bankRow = { date: '2026-06-05', amount: 1250, description: 'Betalning från Anna Andersson' }
    expect(suggestInvoiceMatch(bankRow, invoices, contacts)?.id).toBe('inv1')
  })

  it('never suggests a match for an outgoing transaction', () => {
    const bankRow = { date: '2026-06-05', amount: -1250, description: 'Betalning från Anna Andersson' }
    expect(suggestInvoiceMatch(bankRow, invoices, contacts)).toBeNull()
  })

  it('does not match when the amount is off by more than the rounding tolerance', () => {
    const bankRow = { date: '2026-06-05', amount: 999, description: 'Anna Andersson' }
    expect(suggestInvoiceMatch(bankRow, invoices, contacts)).toBeNull()
  })
})

describe('suggestSupplierInvoiceMatch', () => {
  const expenses = [
    { id: 'e1', type: 'supplier_invoice', status: 'unpaid', amount: 5000, ocrNumber: '12345678', dueDate: '2026-06-10' },
    { id: 'e2', type: 'supplier_invoice', status: 'unpaid', amount: 5000, paidByOwnerPrivately: true, dueDate: '2026-06-10' },
  ]

  it('matches an outgoing payment by amount', () => {
    const bankRow = { date: '2026-06-10', amount: -5000, description: 'Leverantörsbetalning', reference: '' }
    expect(suggestSupplierInvoiceMatch(bankRow, expenses)?.id).toBe('e1')
  })

  it('excludes invoices already paid privately by the owner (no real outgoing transaction to match)', () => {
    const bankRow = { date: '2026-06-10', amount: -5000, description: '', reference: '12345678' }
    // Bara e1 saknar paidByOwnerPrivately, så matchen ska alltid landa där även om båda har samma belopp.
    expect(suggestSupplierInvoiceMatch(bankRow, expenses)?.id).toBe('e1')
  })
})

describe('invoiceRemaining', () => {
  it('accounts for a partial payment already registered', () => {
    const inv = { paidAmount: 300, rows: [{ qty: 1, unitPrice: 1000, vatRate: 25 }] }
    expect(invoiceRemaining(inv)).toBeCloseTo(950)
  })
})
