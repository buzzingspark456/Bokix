import { describe, it, expect } from 'vitest'
import { buildAgiXml, employerIdentity } from './agiXml'

const company = { name: 'Testbolaget AB', orgNr: '556016-0680', email: 'info@testbolaget.se', phone: '08-123 456 78' }
const now = new Date('2026-09-05T10:11:12')
const emp = (ssn, first, gross, tax, extra = {}) => ({
  row: { employeeSnapshot: { ssn, firstName: first, lastName: 'Svensson' } },
  computed: {
    gross, tax, taxableIncome: gross + (extra.benefits || 0),
    employerFee: Math.round((gross + (extra.benefits || 0)) * 0.3142), payLines: extra.payLines || [],
  },
})
const build = (over = {}) => buildAgiXml({
  company, period: '2026-08', now,
  computedRows: [emp('198202252386', 'Anna', 28500, 9300), emp('19830130-2397', 'Bo', 25350, 7590)],
  ...over,
})
const count = (xml, re) => (xml.match(re) || []).length

describe('employerIdentity', () => {
  it('aktiebolag får 16 före organisationsnumret', () => {
    expect(employerIdentity('556016-0680')).toBe('165560160680')
    expect(employerIdentity('5560160680')).toBe('165560160680')
  })
  it('enskild firma får sekelsiffror utifrån att personen är minst 15 år', () => {
    expect(employerIdentity('820225-2386', new Date('2026-09-05'))).toBe('198202252386')
    expect(employerIdentity('050101-1234', new Date('2026-09-05'))).toBe('200501011234')
    expect(employerIdentity('120101-1234', new Date('2026-09-05'))).toBe('191201011234')
  })
  it('tolv siffror används som de är, annat ger null', () => {
    expect(employerIdentity('198202252386')).toBe('198202252386')
    expect(employerIdentity('123')).toBeNull()
    expect(employerIdentity('')).toBeNull()
  })
})

describe('buildAgiXml: en giltig fil', () => {
  const { xml, errors, warnings, summary } = build()

  it('har inga fel och inga varningar', () => {
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
    expect(xml).toBeTruthy()
  })

  it('följer Skatteverkets struktur: rotelement, namnrymder, avsändare, gemensamt, blanketter', () => {
    expect(xml).toContain('<Skatteverket omrade="Arbetsgivardeklaration" xmlns="http://xmls.skatteverket.se/se/skatteverket/da/instans/schema/1.1"')
    expect(xml).toContain('xmlns:agd="http://xmls.skatteverket.se/se/skatteverket/da/komponent/schema/1.1"')
    expect(xml).toContain('<agd:Programnamn>Bokix</agd:Programnamn>')
    expect(xml).toContain('<agd:Skapad>2026-09-05T10:11:12</agd:Skapad>')
    expect(xml).toContain('<agd:Telefon>08-12345678</agd:Telefon>')
    expect(count(xml, /<agd:Blankett>/g)).toBe(3)
    expect(count(xml, /<agd:HU>/g)).toBe(1)
    expect(count(xml, /<agd:IU>/g)).toBe(2)
  })

  it('arbetsgivarens id och perioden är samma överallt', () => {
    expect(count(xml, /165560160680/g)).toBe(8)
    expect(count(xml, /<agd:Period>202608<\/agd:Period>/g)).toBe(3)
    expect(count(xml, /faltkod="006">202608</g)).toBe(3)
  })

  it('individuppgiften har personnummer med sekelsiffror, kontant ersättning och skatt', () => {
    expect(xml).toContain('<agd:BetalningsmottagarId faltkod="215">198202252386</agd:BetalningsmottagarId>')
    expect(xml).toContain('<agd:BetalningsmottagarId faltkod="215">198301302397</agd:BetalningsmottagarId>')
    expect(xml).toContain('<agd:KontantErsattningUlagAG faltkod="011">28500</agd:KontantErsattningUlagAG>')
    expect(xml).toContain('<agd:AvdrPrelSkatt faltkod="001">9300</agd:AvdrPrelSkatt>')
    expect(count(xml, /faltkod="570">001</g)).toBe(2)
  })

  it('huvuduppgiftens summor är exakt summan av individuppgifterna', () => {
    expect(summary).toEqual({ employees: 2, gross: 53850, tax: 16890, employerFee: 8955 + 7965 })
    expect(xml).toContain('<agd:SummaSkatteavdr faltkod="497">16890</agd:SummaSkatteavdr>')
    expect(xml).toContain('<agd:SummaArbAvgSlf faltkod="487">16920</agd:SummaArbAvgSlf>')
  })

  it('elementen i individuppgiften kommer i samma ordning som i Skatteverkets exempelfil', () => {
    const iu = xml.slice(xml.indexOf('<agd:IU>'), xml.indexOf('</agd:IU>'))
    const order = ['ArbetsgivareIUGROUP', 'BetalningsmottagareIUGROUP', 'RedovisningsPeriod', 'Specifikationsnummer', 'KontantErsattningUlagAG', 'AvdrPrelSkatt']
    const at = order.map(n => iu.indexOf(`<agd:${n}`))
    expect(at.every(i => i >= 0)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
  })
})

describe('buildAgiXml: förmåner och skattefria ersättningar', () => {
  it('bilförmån går till 013, övriga förmåner till 012, båda ingår i avgiftsunderlaget', () => {
    const { xml, errors } = build({
      computedRows: [emp('198409102392', 'Cecilia', 30000, 8000, {
        benefits: 3000,
        payLines: [{ payTypeId: 'car_benefit', kind: 'benefit', amount: 2500 }, { payTypeId: 'meal_benefit', kind: 'benefit', amount: 500 }],
      })],
    })
    expect(errors).toEqual([])
    expect(xml).toContain('<agd:SkatteplBilformanUlagAG faltkod="013">2500</agd:SkatteplBilformanUlagAG>')
    expect(xml).toContain('<agd:SkatteplOvrigaFormanerUlagAG faltkod="012">500</agd:SkatteplOvrigaFormanerUlagAG>')
    expect(xml).toContain('<agd:KontantErsattningUlagAG faltkod="011">30000</agd:KontantErsattningUlagAG>')
  })

  it('milersättning och traktamente ger kryss, inte belopp', () => {
    const { xml } = build({
      computedRows: [emp('198409102392', 'Cecilia', 30000, 8000, {
        payLines: [{ payTypeId: 'mileage', kind: 'taxFree', amount: 400 }, { payTypeId: 'per_diem', kind: 'taxFree', amount: 260 }],
      })],
    })
    expect(xml).toContain('<agd:Bilersattning faltkod="050">1</agd:Bilersattning>')
    expect(xml).toContain('<agd:Traktamente faltkod="051">1</agd:Traktamente>')
    expect(xml).not.toContain('>400<')
  })
})

describe('buildAgiXml: fel som stoppar filen', () => {
  it('saknat eller ogiltigt personnummer på en anställd', () => {
    const r = build({ computedRows: [emp('', 'Anna', 28500, 9300), emp('198202252387', 'Bo', 25350, 7590)] })
    expect(r.xml).toBeNull()
    expect(r.errors.length).toBe(2)
    expect(r.errors[0]).toContain('Anna')
    expect(r.errors[1]).toContain('Bo')
  })

  it('saknad kontaktinformation i företagets inställningar', () => {
    const r = build({ company: { name: 'X AB', orgNr: '556016-0680' } })
    expect(r.xml).toBeNull()
    expect(r.errors.some(e => e.includes('Telefonnummer'))).toBe(true)
    expect(r.errors.some(e => e.includes('E-postadress'))).toBe(true)
  })

  it('ogiltigt organisationsnummer', () => {
    expect(build({ company: { ...company, orgNr: '12345' } }).errors.some(e => e.includes('Organisationsnumret'))).toBe(true)
  })

  it('ogiltig period, och period före juli 2018', () => {
    expect(build({ period: '2026-13' }).xml).toBeNull()
    expect(build({ period: '2018-06' }).xml).toBeNull()
    expect(build({ period: '2018-07' }).errors).toEqual([])
  })

  it('samma personnummer på två rader', () => {
    const r = build({ computedRows: [emp('198202252386', 'Anna', 1000, 100), emp('198202252386', 'Anna 2', 1000, 100)] })
    expect(r.errors.some(e => e.includes('flera rader'))).toBe(true)
  })

  it('inga anställda med lön ger ett tydligt fel', () => {
    const r = build({ computedRows: [] })
    expect(r.xml).toBeNull()
    expect(r.errors[0]).toContain('Ingen anställd')
  })
})

describe('buildAgiXml: kantfall', () => {
  it('en anställd utan något att rapportera tas bort med en varning', () => {
    const r = build({ computedRows: [emp('198202252386', 'Anna', 28500, 9300), emp('198301302397', 'Bo', 0, 0)] })
    expect(r.errors).toEqual([])
    expect(r.warnings[0]).toContain('Bo')
    expect(count(r.xml, /<agd:IU>/g)).toBe(1)
  })

  it('en anställd utan skatt får ändå AvdrPrelSkatt med 0', () => {
    const { xml } = build({ computedRows: [emp('198202252386', 'Anna', 5000, 0)] })
    expect(xml).toContain('<agd:AvdrPrelSkatt faltkod="001">0</agd:AvdrPrelSkatt>')
  })

  it('specialtecken i namn och e-post blir giltig XML', () => {
    const { xml } = build({ company: { ...company, name: 'Bo & Söner <AB>' } })
    expect(xml).toContain('<agd:Namn>Bo &amp; Söner &lt;AB&gt;</agd:Namn>')
    expect(xml).not.toContain('Söner <AB>')
  })

  it('negativa belopp blir 0 och beloppen är heltal', () => {
    const { xml } = build({ computedRows: [emp('198202252386', 'Anna', 1000.6, 100.4)] })
    expect(xml).toContain('faltkod="011">1001<')
    expect(xml).toContain('faltkod="001">100<')
  })

  it('enskild firma anges med ägarens personnummer som arbetsgivar-id', () => {
    const { xml, errors } = build({ company: { ...company, orgNr: '820225-2386' } })
    expect(errors).toEqual([])
    expect(xml).toContain('<agd:Arendeagare>198202252386</agd:Arendeagare>')
  })
})

describe('buildAgiXml med riktig lönekörningsdata', () => {
  it('räknar fram lön, förmån, skatt och kryss ur computeEmployeePayroll', async () => {
    const { computeEmployeePayroll } = await import('./payrollCalculation')
    const employee = { ssn: '198202252386', firstName: 'Anna', lastName: 'Svensson', monthlySalary: 30000, secondaryIncome: true }
    const row = { employeeSnapshot: employee, lines: [
      { payTypeId: 'car_benefit', quantity: 1, rate: 2500 },
      { payTypeId: 'mileage', quantity: 10, rate: 25 },
      { payTypeId: 'bonus', quantity: 1, rate: 5000 },
    ] }
    const computed = computeEmployeePayroll(employee, row)
    const { xml, errors, summary } = buildAgiXml({ company, period: '2026-08', now, computedRows: [{ row, computed }] })
    expect(errors).toEqual([])
    expect(xml).toContain('<agd:KontantErsattningUlagAG faltkod="011">35000</agd:KontantErsattningUlagAG>')
    expect(xml).toContain('<agd:SkatteplBilformanUlagAG faltkod="013">2500</agd:SkatteplBilformanUlagAG>')
    expect(xml).not.toContain('SkatteplOvrigaFormaner')
    expect(xml).toContain('<agd:Bilersattning faltkod="050">1</agd:Bilersattning>')
    expect(xml).toContain(`<agd:AvdrPrelSkatt faltkod="001">${computed.tax}</agd:AvdrPrelSkatt>`)
    expect(summary.tax).toBe(computed.tax)
    expect(summary.employerFee).toBe(computed.employerFee)
    expect(computed.tax).toBeGreaterThan(0)
  })
})
