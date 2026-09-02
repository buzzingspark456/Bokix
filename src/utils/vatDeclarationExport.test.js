import { describe, it, expect } from 'vitest'
import { generateVatDeclarationXml } from './vatDeclarationExport'

const rounded = (overrides = {}) => ({
  underlagByRate: { 25: 100000, 12: 0, 6: 0 },
  outputVatByRate: { 25: 25000, 12: 0, 6: 0 },
  inputVat: 1000,
  netToPay: 24000,
  ...overrides,
})

describe('generateVatDeclarationXml', () => {
  it('throws when the company has no valid orgNr — filen kan inte skickas till Skatteverket utan det', () => {
    expect(() => generateVatDeclarationXml({ company: {}, year: 2026, quarter: 3, rounded: rounded() }))
      .toThrow(/organisationsnummer/)
    expect(() => generateVatDeclarationXml({ company: { orgNr: '12345' }, year: 2026, quarter: 3, rounded: rounded() }))
      .toThrow(/organisationsnummer/)
  })

  it('formats OrgNr with a dash regardless of how it is stored, and Period as year + last month of the quarter', () => {
    const xml = generateVatDeclarationXml({ company: { orgNr: '5560000175' }, year: 2026, quarter: 3, rounded: rounded() })
    expect(xml).toContain('<OrgNr>556000-0175</OrgNr>')
    expect(xml).toContain('<Period>202609</Period>') // kvartal 3 → sista månaden är september
  })

  it('reports ALL sales, regardless of VAT rate, in ruta 05 (ForsMomsEjAnnan) — inte utspritt på flera rutor', () => {
    // Regressionstest: SALES_RUTA_BY_RATE/VAT_RUTOR spred tidigare 12%- och
    // 6%-försäljning på ruta 06/07 (uttag/vinstmarginalbeskattning) istället
    // för att summera allt i ruta 05, se vatConfig.js.
    const xml = generateVatDeclarationXml({
      company: { orgNr: '556000-0175' }, year: 2026, quarter: 3,
      rounded: rounded({ underlagByRate: { 25: 100000, 12: 20000, 6: 5000 } }),
    })
    expect(xml).toContain('<ForsMomsEjAnnan>125000</ForsMomsEjAnnan>')
  })

  it('writes output VAT per rate and omits zero-valued rate tags', () => {
    const xml = generateVatDeclarationXml({
      company: { orgNr: '556000-0175' }, year: 2026, quarter: 3,
      rounded: rounded({ outputVatByRate: { 25: 25000, 12: 2400, 6: 300 } }),
    })
    expect(xml).toContain('<MomsUtgHog>25000</MomsUtgHog>')
    expect(xml).toContain('<MomsUtgMedel>2400</MomsUtgMedel>')
    expect(xml).toContain('<MomsUtgLag>300</MomsUtgLag>')
  })

  it('does NOT include the MomsInkopUtgHog/Medel/Lag (ruta 30-32, omvänd skattskyldighet) tags — utanför Bokix scope idag', () => {
    const xml = generateVatDeclarationXml({ company: { orgNr: '556000-0175' }, year: 2026, quarter: 3, rounded: rounded() })
    expect(xml).not.toMatch(/MomsInkopUtg/)
  })

  it('writes a negative MomsBetala with no space for a refund (moms att återfå)', () => {
    const xml = generateVatDeclarationXml({
      company: { orgNr: '556000-0175' }, year: 2026, quarter: 3,
      rounded: rounded({ netToPay: -500 }),
    })
    expect(xml).toContain('<MomsBetala>-500</MomsBetala>')
  })

  it('declares ISO-8859-1 and the eSKDUpload 6.0 root element', () => {
    const xml = generateVatDeclarationXml({ company: { orgNr: '556000-0175' }, year: 2026, quarter: 3, rounded: rounded() })
    expect(xml).toContain('encoding="ISO-8859-1"')
    expect(xml).toContain('<eSKDUpload Version="6.0">')
  })
})
