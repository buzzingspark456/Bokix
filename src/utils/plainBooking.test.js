import { describe, it, expect } from 'vitest'
import {
  splitVat, buildSimpleBooking, describeRow, describeVerification, paymentAccounts, transferAccounts, simpleKindsFor, accountKindOf,
} from './plainBooking'

const accounts = [
  { code: '1630', name: 'Skattekonto', type: 'tillgang' },
  { code: '1910', name: 'Kassa', type: 'tillgang', active: true },
  { code: '1930', name: 'Företagskonto', type: 'tillgang', active: true },
  { code: '1941', name: 'Bankkonto 2', type: 'tillgang' },
  { code: '2611', name: 'Utgående moms, 25%', type: 'skuld_kapital' },
  { code: '2641', name: 'Ingående moms', type: 'skuld_kapital' },
  { code: '2013', name: 'Övriga egna uttag', type: 'skuld_kapital' },
  { code: '3001', name: 'Försäljning inom Sverige, 25% moms', type: 'intakt' },
  { code: '5460', name: 'Förbrukningsmaterial', type: 'kostnad' },
]
const sum = (rows, key) => Math.round(rows.reduce((s, r) => s + r[key], 0) * 100) / 100

describe('splitVat', () => {
  it('delar 1000 kr inklusive 25 % moms i 800 + 200', () => {
    expect(splitVat(1000, 25)).toEqual({ net: 800, vat: 200 })
  })
  it('12 % och 6 %', () => {
    expect(splitVat(112, 12)).toEqual({ net: 100, vat: 12 })
    expect(splitVat(106, 6)).toEqual({ net: 100, vat: 6 })
  })
  it('ingen moms ger hela beloppet som netto', () => {
    expect(splitVat(500, 0)).toEqual({ net: 500, vat: 0 })
  })
  it('netto + moms är alltid exakt brutto, även med ören', () => {
    for (const gross of [99.99, 123.45, 1, 0.07, 4999.95]) {
      const { net, vat } = splitVat(gross, 25)
      expect(Math.round((net + vat) * 100) / 100).toBe(gross)
    }
  })
})

describe('buildSimpleBooking: köp', () => {
  const base = { kind: 'expense', amount: 1000, vatRate: 25, account: '5460', payAccount: '1930' }
  it('kostnad + ingående moms mot bank, balanserad', () => {
    const { rows, errors } = buildSimpleBooking(base)
    expect(errors).toEqual([])
    expect(rows).toEqual([
      { account: '5460', debet: 800, kredit: 0 },
      { account: '2641', debet: 200, kredit: 0 },
      { account: '1930', debet: 0, kredit: 1000 },
    ])
    expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'))
  })
  it('utan moms blir det två rader', () => {
    const { rows } = buildSimpleBooking({ ...base, vatRate: 0 })
    expect(rows).toEqual([{ account: '5460', debet: 1000, kredit: 0 }, { account: '1930', debet: 0, kredit: 1000 }])
  })
  it('betalat privat bokas som egen insättning för enskild firma', () => {
    const { rows } = buildSimpleBooking({ ...base, payPrivate: true }, { orgType: 'Enskild firma' })
    expect(rows[rows.length - 1]).toEqual({ account: '2018', debet: 0, kredit: 1000 })
  })
  it('"betalat privat" ignoreras för andra bolagsformer', () => {
    const { rows } = buildSimpleBooking({ ...base, payPrivate: true }, { orgType: 'Aktiebolag (AB)' })
    expect(rows[rows.length - 1].account).toBe('1930')
  })
  it('kräver belopp och konto', () => {
    expect(buildSimpleBooking({ ...base, amount: '' }).rows).toEqual([])
    expect(buildSimpleBooking({ ...base, amount: 0 }).errors.length).toBe(1)
    expect(buildSimpleBooking({ ...base, account: '' }).errors[0]).toMatch(/Välj vad/)
  })
  it('vägrar bank- eller skuldkonto som kostnad', () => {
    expect(buildSimpleBooking({ ...base, account: '1930' }).rows).toEqual([])
    expect(buildSimpleBooking({ ...base, account: '2641' }).rows).toEqual([])
  })
  it('tillåter inköp av tillgång, till exempel inventarier', () => {
    expect(buildSimpleBooking({ ...base, account: '1220' }).errors).toEqual([])
  })
  it('förstår komma som decimaltecken', () => {
    const { rows } = buildSimpleBooking({ ...base, amount: '1250,50', vatRate: 0 })
    expect(rows[0].debet).toBe(1250.5)
  })
})

describe('buildSimpleBooking: försäljning', () => {
  it('bank mot intäkt och utgående moms, standardkonto efter momssats', () => {
    const { rows } = buildSimpleBooking({ kind: 'income', amount: 1250, vatRate: 25, payAccount: '1930' })
    expect(rows).toEqual([
      { account: '1930', debet: 1250, kredit: 0 },
      { account: '3001', debet: 0, kredit: 1000 },
      { account: '2611', debet: 0, kredit: 250 },
    ])
    expect(sum(rows, 'debet')).toBe(sum(rows, 'kredit'))
  })
  it('12 %, 6 % och momsfritt får rätt konton', () => {
    expect(buildSimpleBooking({ kind: 'income', amount: 112, vatRate: 12 }).rows.map(r => r.account)).toEqual(['1930', '3002', '2621'])
    expect(buildSimpleBooking({ kind: 'income', amount: 106, vatRate: 6 }).rows.map(r => r.account)).toEqual(['1930', '3003', '2631'])
    expect(buildSimpleBooking({ kind: 'income', amount: 500, vatRate: 0 }).rows.map(r => r.account)).toEqual(['1930', '3004'])
  })
  it('eget intäktskonto vinner över standardkontot', () => {
    expect(buildSimpleBooking({ kind: 'income', amount: 100, vatRate: 0, account: '3040' }).rows[1].account).toBe('3040')
  })
  it('vägrar ett kostnadskonto som intäkt', () => {
    expect(buildSimpleBooking({ kind: 'income', amount: 100, vatRate: 0, account: '5460' }).rows).toEqual([])
  })
})

describe('buildSimpleBooking: flytta pengar och ägare', () => {
  it('pengar in på till-kontot, ut från från-kontot', () => {
    const { rows } = buildSimpleBooking({ kind: 'transfer', amount: 5000, fromAccount: '1930', toAccount: '1630' })
    expect(rows).toEqual([{ account: '1630', debet: 5000, kredit: 0 }, { account: '1930', debet: 0, kredit: 5000 }])
  })
  it('samma konto och konton utanför klass 1 nekas', () => {
    expect(buildSimpleBooking({ kind: 'transfer', amount: 1, fromAccount: '1930', toAccount: '1930' }).rows).toEqual([])
    expect(buildSimpleBooking({ kind: 'transfer', amount: 1, fromAccount: '1930', toAccount: '5460' }).rows).toEqual([])
    expect(buildSimpleBooking({ kind: 'transfer', amount: 1, fromAccount: '1930' }).rows).toEqual([])
  })
  it('egen insättning och uttag för enskild firma', () => {
    const o = { orgType: 'Enskild firma' }
    expect(buildSimpleBooking({ kind: 'owner_in', amount: 2000, payAccount: '1930' }, o).rows)
      .toEqual([{ account: '1930', debet: 2000, kredit: 0 }, { account: '2018', debet: 0, kredit: 2000 }])
    expect(buildSimpleBooking({ kind: 'owner_out', amount: 2000, payAccount: '1930' }, o).rows)
      .toEqual([{ account: '2013', debet: 2000, kredit: 0 }, { account: '1930', debet: 0, kredit: 2000 }])
  })
  it('ägarhändelser nekas för aktiebolag', () => {
    expect(buildSimpleBooking({ kind: 'owner_out', amount: 2000 }, { orgType: 'Aktiebolag (AB)' }).rows).toEqual([])
  })
  it('okänd händelse ger inga rader', () => {
    expect(buildSimpleBooking({ kind: 'nagot', amount: 10 }).rows).toEqual([])
    expect(buildSimpleBooking(null).rows).toEqual([])
  })
})

describe('kontolistor och val', () => {
  it('betalkonton: bara aktiva 19xx, annars 1930', () => {
    expect(paymentAccounts(accounts).map(a => a.code)).toEqual(['1910', '1930'])
    expect(paymentAccounts([]).map(a => a.code)).toEqual(['1930'])
  })
  it('flytta pengar-listan får skattekontot med', () => {
    expect(transferAccounts(accounts).map(a => a.code)).toEqual(['1910', '1930', '1630'])
  })
  it('ägarhändelser visas bara för enskild firma', () => {
    expect(simpleKindsFor('Enskild firma').map(k => k.id)).toContain('owner_in')
    expect(simpleKindsFor('Aktiebolag (AB)').map(k => k.id)).toEqual(['expense', 'income', 'transfer'])
  })
  it('kontotyper efter BAS-nummer', () => {
    expect(['1930', '2013', '2611', '3001', '5460', '8310', '8410'].map(accountKindOf))
      .toEqual(['tillgang', 'eget_kapital', 'skuld', 'intakt', 'kostnad', 'intakt', 'kostnad'])
    expect(accountKindOf('abc')).toBeNull()
  })
})

describe('describeRow', () => {
  it('pengar in och ut på bankkonto', () => {
    expect(describeRow({ account: '1930', debet: 1000, kredit: 0 }, accounts)).toEqual({ text: 'Pengar in på Företagskonto', amount: 1000, increases: true })
    expect(describeRow({ account: '1930', debet: 0, kredit: 1000 }, accounts)).toEqual({ text: 'Pengar ut från Företagskonto', amount: 1000, increases: false })
  })
  it('kostnad och intäkt', () => {
    expect(describeRow({ account: '5460', debet: 800, kredit: 0 }, accounts).text).toBe('Kostnad: Förbrukningsmaterial')
    expect(describeRow({ account: '3001', debet: 0, kredit: 800 }, accounts).text).toBe('Intäkt: Försäljning inom Sverige, 25% moms')
    expect(describeRow({ account: '5460', debet: 0, kredit: 800 }, accounts).text).toBe('Kostnad minskar: Förbrukningsmaterial')
  })
  it('moms in båda riktningarna', () => {
    expect(describeRow({ account: '2641', debet: 200, kredit: 0 }, accounts).text).toBe('Moms du får dra av (Ingående moms)')
    expect(describeRow({ account: '2611', debet: 0, kredit: 250 }, accounts).text).toBe('Moms du ska betala in (Utgående moms, 25%)')
  })
  it('egna uttag minskar eget kapital', () => {
    const r = describeRow({ account: '2013', debet: 2000, kredit: 0 }, accounts)
    expect(r.text).toBe('Eget kapital minskar: Övriga egna uttag')
    expect(r.increases).toBe(false)
  })
  it('okänt konto: använder radens namn eller kontonumret', () => {
    expect(describeRow({ account: '5999', accountName: 'Eget', debet: 5, kredit: 0 }, accounts).text).toBe('Kostnad: Eget')
    expect(describeRow({ account: '5999', debet: 5, kredit: 0 }, []).text).toBe('Kostnad: 5999')
  })
  it('förstår gamla debit/credit-fält inte, men tomma rader ger 0', () => {
    expect(describeRow({ account: '1930' }, accounts).amount).toBe(0)
  })
})

describe('describeVerification', () => {
  it('hoppar över tomma rader och behåller ordningen', () => {
    const rows = [
      { account: '5460', debet: 800, kredit: 0 },
      { account: '', debet: 0, kredit: 0 },
      { account: '1930', debet: 0, kredit: 800 },
    ]
    expect(describeVerification(rows, accounts).map(r => r.text)).toEqual(['Kostnad: Förbrukningsmaterial', 'Pengar ut från Företagskonto'])
  })
})
