import { describe, it, expect, vi, beforeEach } from 'vitest'
import { preloadSkattetabell, lookupSkatteavdrag } from './skattetabell'

// Tre rader, en riktig (om an ihoptrimmad) skattetabell. Skatteverkets egna
// tabeller borjar aldrig pa 0 kr (lagsta raden ligger typiskt nagra
// tusenlappar upp), sa 0 kr faller genuint utanfor nedat har, precis som i
// det verkliga kundfallet (en timanstalld utan registrerade timmar denna
// period). Ingen rad tacker heller mycket hogt, med avsikt -- se
// skattetabell.js:s filkommentar for hela buggen det har testar mot.
const FAKE_ROWS = [
  { tabellnr: '32', 'antal dgr': '30B', 'inkomst fr.o.m.': '1000', 'inkomst t.o.m.': '4999', 'kolumn 1': '500' },
  { tabellnr: '32', 'antal dgr': '30B', 'inkomst fr.o.m.': '5000', 'inkomst t.o.m.': '9999', 'kolumn 1': '1500' },
  { tabellnr: '32', 'antal dgr': '30B', 'inkomst fr.o.m.': '10000', 'inkomst t.o.m.': '19999', 'kolumn 1': '4000' },
]

describe('lookupSkatteavdrag - utanfor tabellens intervall', () => {
  beforeEach(async () => {
    // Mockar fetch istallet for att bero pa ett riktigt Skatteverket-anrop
    // -- samma princip som payrollCalculation.test.js redan foljer for att
    // slippa bero pa skiftande tabelldata.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: FAKE_ROWS, next: null }),
    })
    await preloadSkattetabell('2026', '32')
  })

  it('en inkomst INOM tabellen matchar exakt, ingen extrapolering', () => {
    const result = lookupSkatteavdrag({ year: '2026', tabellnr: '32', kolumn: 1, inkomst: 2000 })
    expect(result).toEqual({ amount: 500, extrapolated: false })
  })

  // Bugkritiskt (kundrapport): 0 kr inkomst (t.ex. en timanstalld utan
  // registrerade timmar denna period) gav tidigare skatten for den ALLRA
  // HOGSTA raden (4000 kr har, 25 944 kr i det verkliga kundfallet) istallet
  // for att inse att 0 kr ligger UNDER tabellens lagsta rad och approximera
  // darifran (0 kr har). Se den fulla forklaringen i skattetabell.js.
  it('en inkomst UNDER lagsta raden approximeras fran LAGSTA raden, inte hogsta', () => {
    const result = lookupSkatteavdrag({ year: '2026', tabellnr: '32', kolumn: 1, inkomst: 0 })
    expect(result.amount).toBe(500) // lagsta radens skatt (1000-4999 kr) -- INTE 4000 (hogsta raden)
    expect(result.extrapolated).toBe(true)
    expect(result.extrapolatedFrom).toBe('lowest')
  })

  it('en inkomst OVER hogsta raden approximeras fortfarande fran HOGSTA raden', () => {
    const result = lookupSkatteavdrag({ year: '2026', tabellnr: '32', kolumn: 1, inkomst: 50000 })
    expect(result.amount).toBe(4000)
    expect(result.extrapolated).toBe(true)
    expect(result.extrapolatedFrom).toBe('highest')
  })
})

// Över 80 000 kr i månaden anger Skatteverket skatten i procent ("30%"-rader).
// Förut slutade skatten öka där, eftersom högsta kronraden användes.
const ROWS_WITH_PERCENT = [
  { tabellnr: '33', 'antal dgr': '30B', 'inkomst fr.o.m.': '79801', 'inkomst t.o.m.': '80000', 'kolumn 1': '26595' },
  { tabellnr: '33', 'antal dgr': '30%', 'inkomst fr.o.m.': '80001', 'inkomst t.o.m.': '81000', 'kolumn 1': '33' },
  { tabellnr: '33', 'antal dgr': '30%', 'inkomst fr.o.m.': '81001', 'inkomst t.o.m.': '1269000', 'kolumn 1': '45' },
  { tabellnr: '33', 'antal dgr': '30%', 'inkomst fr.o.m.': '1269001', 'inkomst t.o.m.': '', 'kolumn 1': '52' },
]

describe('lookupSkatteavdrag - procentrader över 80 000 kr', () => {
  beforeEach(async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: ROWS_WITH_PERCENT, next: null }) })
    await preloadSkattetabell('2026', '33')
  })

  it('kronraden gäller upp till 80 000 kr', () => {
    expect(lookupSkatteavdrag({ year: '2026', tabellnr: '33', kolumn: 1, inkomst: 80000 })).toEqual({ amount: 26595, extrapolated: false })
  })

  it('över 80 000 kr är skatten procent av hela inkomsten', () => {
    expect(lookupSkatteavdrag({ year: '2026', tabellnr: '33', kolumn: 1, inkomst: 80500 }).amount).toBe(26565)
    expect(lookupSkatteavdrag({ year: '2026', tabellnr: '33', kolumn: 1, inkomst: 100000 }).amount).toBe(45000)
  })

  it('översta raden saknar övre gräns', () => {
    const r = lookupSkatteavdrag({ year: '2026', tabellnr: '33', kolumn: 1, inkomst: 2000000 })
    expect(r).toMatchObject({ amount: 1040000, extrapolated: false })
  })
})
