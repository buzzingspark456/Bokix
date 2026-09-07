import { describe, it, expect } from 'vitest'
import {
  PAY_TYPES, PAY_TYPE_GROUPS, PAY_LINE_KINDS,
  derivedHourlyRate, defaultRateFor, computePayLine, summarizePayLines, getPayType,
} from './payTypes'
import { computeEmployeePayroll } from './payrollCalculation'

const monthly = {
  employmentType: 'anstalld', salaryForm: 'manadslon', monthlySalary: 34666.67,
  employmentRate: 100, hoursPerWeek: 40, secondaryIncome: true, // fast 30 % skatt, tabelloberoende
}
const hourly = {
  employmentType: 'anstalld', salaryForm: 'timlon', hourlyRate: 200,
  employmentRate: 100, hoursPerWeek: 40, secondaryIncome: true,
}

describe('katalogen', () => {
  it('varje löneart har en giltig sort och ett konto', () => {
    for (const t of PAY_TYPES) {
      expect(PAY_LINE_KINDS[t.kind], `${t.id} har okänd kind`).toBeDefined()
      expect(t.account, `${t.id} saknar konto`).toMatch(/^\d{4}$/)
      expect(t.name.length).toBeGreaterThan(2)
    }
  })

  // Grupperna är det som visas i väljaren — en löneart som inte ligger i
  // någon grupp går inte att välja, och en grupp som pekar på ett id som
  // inte finns ger en tom rad.
  it('grupperna täcker exakt katalogen', () => {
    const grouped = PAY_TYPE_GROUPS.flatMap(g => g.ids).sort()
    expect(grouped).toEqual(PAY_TYPES.map(t => t.id).sort())
    for (const id of grouped) expect(getPayType(id)).not.toBeNull()
  })
})

describe('derivedHourlyRate', () => {
  it('timavlönad använder sin egen timlön rakt av', () => {
    expect(derivedHourlyRate(hourly)).toBe(200)
  })

  it('månadsavlönad räknas om via veckoarbetstiden', () => {
    // 34 666,67 × 12 / (52 × 40) = 200 kr/tim
    expect(Math.round(derivedHourlyRate(monthly))).toBe(200)
  })

  it('deltid ger högre timlön för samma månadslön', () => {
    const halftime = { ...monthly, hoursPerWeek: 20 }
    expect(Math.round(derivedHourlyRate(halftime))).toBe(400)
  })

  it('saknad lön ger 0 i stället för NaN', () => {
    expect(derivedHourlyRate({ salaryForm: 'manadslon' })).toBe(0)
    expect(derivedHourlyRate(null)).toBe(0)
  })
})

describe('defaultRateFor', () => {
  it('övertid enkel är 1,5 gånger timlönen', () => {
    expect(defaultRateFor(getPayType('overtime_simple'), hourly)).toBe(300)
  })

  it('kvalificerad övertid är dubbla', () => {
    expect(defaultRateFor(getPayType('overtime_qualified'), hourly)).toBe(400)
  })

  // Allt som är avtalat eller beslutat utanför systemet ska sakna förval —
  // ett påhittat OB-tillägg vore ett tyst felaktigt löneutbetalning.
  it('avtalade och beslutade belopp har inget förval', () => {
    expect(defaultRateFor(getPayType('ob_addition'), hourly)).toBeNull()
    expect(defaultRateFor(getPayType('garnishment'), hourly)).toBeNull()
    expect(defaultRateFor(getPayType('mileage'), hourly)).toBeNull()
  })
})

describe('computePayLine', () => {
  it('räknar antal × à-pris och behåller formeln', () => {
    const l = computePayLine({ payTypeId: 'overtime_simple', quantity: 4, rate: 300 }, hourly)
    expect(l.amount).toBe(1200)
    expect(l.signedAmount).toBe(1200)
    expect(l.formula).toBe('4 timmar × 300 kr')
  })

  it('avdrag får negativt tecken', () => {
    const l = computePayLine({ payTypeId: 'absence_unpaid', quantity: 8, rate: 200 }, hourly)
    expect(l.amount).toBe(1600)
    expect(l.signedAmount).toBe(-1600)
  })

  it('tomt à-pris faller tillbaka på förvalet', () => {
    const l = computePayLine({ payTypeId: 'overtime_simple', quantity: 2, rate: '' }, hourly)
    expect(l.rate).toBe(300)
    expect(l.amount).toBe(600)
  })

  // 0 kr är ett giltigt à-pris (registrerad frånvarotimme utan avdrag) och
  // får inte tyst ersättas av förvalet.
  it('à-pris 0 respekteras', () => {
    const l = computePayLine({ payTypeId: 'overtime_simple', quantity: 5, rate: 0 }, hourly)
    expect(l.amount).toBe(0)
  })

  it('en anteckning hamnar i radens namn', () => {
    const l = computePayLine({ payTypeId: 'bonus', quantity: 1, rate: 5000, note: 'Q3' }, hourly)
    expect(l.name).toBe('Bonus eller provision (Q3)')
  })

  it('okänd löneart ger null i stället för en trasig rad', () => {
    expect(computePayLine({ payTypeId: 'finns-inte', quantity: 1, rate: 1 }, hourly)).toBeNull()
  })
})

describe('summarizePayLines', () => {
  const lines = [
    { payTypeId: 'overtime_simple', quantity: 4, rate: 300 },   // +1200 brutto
    { payTypeId: 'absence_unpaid', quantity: 8, rate: 200 },    // −1600 brutto
    { payTypeId: 'car_benefit', quantity: 1, rate: 3000 },      // förmån
    { payTypeId: 'mileage', quantity: 10, rate: 25 },           // skattefritt
    { payTypeId: 'garnishment', quantity: 1, rate: 2000 },      // nettoavdrag
  ]

  it('lägger varje rad i rätt hink', () => {
    const s = summarizePayLines(lines, hourly)
    expect(s.additions).toBe(1200)
    expect(s.absence).toBe(1600)
    expect(s.benefits).toBe(3000)
    expect(s.taxFree).toBe(250)
    expect(s.netDeductions).toBe(2000)
    expect(s.lines).toHaveLength(5)
  })

  it('tom lista ger nollor', () => {
    expect(summarizePayLines([], hourly)).toMatchObject({ additions: 0, absence: 0, benefits: 0, taxFree: 0, netDeductions: 0 })
  })
})

// ── Genom hela lönekörningen ───────────────────────────────────────────
// Det är här reglerna faktiskt bevisas: att en förmån beskattas men inte
// betalas ut, att skattefritt betalas ut men inte beskattas, och att ett
// nettoavdrag varken rör skatten eller avgifterna.
describe('lönearter i en hel lönekörning', () => {
  const base = computeEmployeePayroll(monthly, {})

  it('ett tillägg höjer brutto, skatt, avgifter och semesterunderlag', () => {
    const r = computeEmployeePayroll(monthly, { lines: [{ payTypeId: 'overtime_simple', quantity: 4, rate: 300 }] })
    expect(r.gross).toBe(base.gross + 1200)
    expect(r.tax).toBe(Math.round((base.gross + 1200) * 0.3))
    expect(r.employerFee).toBeGreaterThan(base.employerFee)
    expect(r.vacationProvision).toBeGreaterThan(base.vacationProvision)
  })

  it('en förmån beskattas och ger avgifter men höjer INTE nettolönen', () => {
    const r = computeEmployeePayroll(monthly, { lines: [{ payTypeId: 'car_benefit', quantity: 1, rate: 3000 }] })
    expect(r.gross).toBe(base.gross)
    expect(r.taxableIncome).toBe(base.taxableIncome + 3000)
    expect(r.tax).toBeGreaterThan(base.tax)
    expect(r.net).toBeLessThan(base.net)          // skatten drogs, pengarna kom aldrig
    expect(r.employerFee).toBeGreaterThan(base.employerFee)
  })

  it('skattefri milersättning betalas ut utan skatt eller avgifter', () => {
    const r = computeEmployeePayroll(monthly, { lines: [{ payTypeId: 'mileage', quantity: 10, rate: 25 }] })
    expect(r.taxableIncome).toBe(base.taxableIncome)
    expect(r.tax).toBe(base.tax)
    expect(r.employerFee).toBe(base.employerFee)
    expect(r.net).toBe(base.net + 250)
    expect(r.taxFree).toBe(250)
    expect(r.totalCost).toBe(base.totalCost + 250)
  })

  it('löneutmätning dras efter skatt och rör varken skatt eller avgifter', () => {
    const r = computeEmployeePayroll(monthly, { lines: [{ payTypeId: 'garnishment', quantity: 1, rate: 2000 }] })
    expect(r.tax).toBe(base.tax)
    expect(r.employerFee).toBe(base.employerFee)
    expect(r.net).toBe(base.net - 2000)
  })

  it('varje löneart blir ett eget steg på lönebeskedet', () => {
    const r = computeEmployeePayroll(monthly, {
      lines: [
        { payTypeId: 'overtime_simple', quantity: 4, rate: 300 },
        { payTypeId: 'mileage', quantity: 10, rate: 25 },
      ],
    })
    const labels = r.steps.map(s => s.label)
    expect(labels).toContain('Övertid, enkel')
    expect(labels).toContain('Milersättning')
    expect(r.payLines).toHaveLength(2)
  })

  // Lönekörningar som sparades innan lönearterna fanns bär råa siffror i
  // row.additions m.fl. De måste räknas likadant som förut.
  it('gamla rader med råa belopp räknas oförändrat', () => {
    const r = computeEmployeePayroll(monthly, { additions: 1000, benefits: 500, netDeduction: 200 })
    expect(r.gross).toBe(base.gross + 1000)
    expect(r.taxableIncome).toBe(base.taxableIncome + 1500)
    expect(r.net).toBe(r.gross - r.tax - 200)
  })
})
