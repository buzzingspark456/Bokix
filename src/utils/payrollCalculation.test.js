import { describe, it, expect } from 'vitest'
import { computeEmployeePayroll, summarizePayrollRun } from './payrollCalculation'

// secondaryIncome: true tar en fristående, tabelloberoende beräkningsväg
// (fast 30 % skatteavdrag, se SECONDARY_INCOME_TAX_RATE i payrollConfig.js)
// — används genomgående här så testerna inte beror på skattetabell.js
// specifika tabelldata, som ändras år för år.
const baseEmployee = {
  employmentType: 'anstalld',     // 31,42 % arbetsgivaravgift (EMPLOYER_FEE_CATEGORIES)
  salaryForm: 'manadslon',
  monthlySalary: 30000,
  employmentRate: 100,
  secondaryIncome: true,
}

describe('computeEmployeePayroll — grundflöde (månadslön, sidoinkomst)', () => {
  const result = computeEmployeePayroll(baseEmployee, {})

  it('räknar grundlön rakt av vid heltid', () => {
    expect(result.baseSalary).toBe(30000)
  })
  it('bruttolön utan tillägg/avdrag är samma som grundlönen', () => {
    expect(result.gross).toBe(30000)
  })
  it('skatteavdrag är 30 % fast sats för sidoinkomst', () => {
    expect(result.tax).toBe(9000)
  })
  it('nettolön är brutto minus skatt', () => {
    expect(result.net).toBe(21000)
  })
  it('arbetsgivaravgift är 31,42 % av det skattegrundande underlaget', () => {
    expect(result.employerFee).toBe(Math.round(30000 * 0.3142))
  })
  // Ingen regel vald och fast månadslön: sammalöneregeln, som i semesterlagen 16 a §.
  // 25/12 intjänade dagar × (30 000 / 21 + 0,43 % av 30 000) = 3 245 kr.
  it('semesteravsättning enligt sammalöneregeln vid månadslön utan vald regel', () => {
    expect(result.vacationProvision).toBe(Math.round((25 / 12) * (30000 / 21 + 30000 * 0.0043)))
  })
  it('semesteravsättning är 12 % av bruttolönen med procentregeln', () => {
    expect(computeEmployeePayroll({ ...baseEmployee, vacationRule: 'procentregeln' }, {}).vacationProvision).toBe(Math.round(30000 * 0.12))
  })
  it('total arbetsgivarkostnad summerar brutto + avgifter + semester + semesteravgift', () => {
    expect(result.totalCost).toBe(result.gross + result.employerFee + result.vacationProvision + result.vacationFee)
  })
})

describe('computeEmployeePayroll — deltid', () => {
  it('skalar grundlönen med employmentRate', () => {
    const result = computeEmployeePayroll({ ...baseEmployee, employmentRate: 50 }, {})
    expect(result.baseSalary).toBe(15000)
  })
})

describe('computeEmployeePayroll — timlön', () => {
  it('räknar grundlön som timlön × arbetade timmar, oberoende av monthlySalary', () => {
    const employee = { ...baseEmployee, salaryForm: 'timlon', hourlyRate: 200, monthlySalary: 99999 }
    const result = computeEmployeePayroll(employee, { hoursWorked: 40 })
    expect(result.baseSalary).toBe(8000)
    expect(result.hoursWorked).toBe(40)
  })
})

describe('computeEmployeePayroll — tillägg och avdrag', () => {
  it('tillägg och frånvaro/bruttoavdrag påverkar bruttolönen', () => {
    const result = computeEmployeePayroll(baseEmployee, { additions: 1000, absenceDeduction: 500, grossDeduction: 200 })
    expect(result.gross).toBe(30000 + 1000 - 500 - 200)
  })

  it('förmåner höjer det skattegrundande underlaget men inte bruttolönen', () => {
    const result = computeEmployeePayroll(baseEmployee, { benefits: 2000 })
    expect(result.gross).toBe(30000)
    expect(result.taxableIncome).toBe(32000)
  })

  it('nettoavdrag påverkar bara nettolönen, inte skatteunderlaget', () => {
    const withDeduction = computeEmployeePayroll(baseEmployee, { netDeduction: 1000 })
    const without = computeEmployeePayroll(baseEmployee, {})
    expect(withDeduction.tax).toBe(without.tax)
    expect(withDeduction.net).toBe(without.net - 1000)
  })
})

describe('computeEmployeePayroll — skatteavdrag utan tabell', () => {
  it('sätter skatt till 0 med en förklarande not om ingen tabell och ingen sidoinkomst är angiven', () => {
    const result = computeEmployeePayroll({ ...baseEmployee, secondaryIncome: false }, {})
    expect(result.tax).toBe(0)
    expect(result.steps.find(s => s.label === 'Skatteavdrag').formula).toMatch(/kunde inte beräknas/)
  })
})

describe('computeEmployeePayroll — semesterregler', () => {
  // Förut gav sammalöneregeln 0 kr i avsättning (ingen skuld bokades på 2920).
  it('sammalöneregeln räknar avsättningen på intjänade dagar, dagslön och tillägg', () => {
    const result = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'sammaloneregeln' }, {})
    expect(result.vacationProvision).toBe(3245)
  })
  it('timlön utan vald regel får procentregeln', () => {
    const result = computeEmployeePayroll({ ...baseEmployee, salaryForm: 'timlon', hourlyRate: 200 }, { hoursWorked: 100 })
    expect(result.vacationProvision).toBe(Math.round(20000 * 0.12))
  })
  it('ingen avsättning för regeln Ingen semesteravsättning', () => {
    expect(computeEmployeePayroll({ ...baseEmployee, vacationRule: 'ingen' }, {}).vacationProvision).toBe(0)
  })
})

describe('computeEmployeePayroll — bankuppgifter', () => {
  it('hasBankInfo/hasIbanInfo är sanna bara när båda respektive fält finns', () => {
    const complete = computeEmployeePayroll({ ...baseEmployee, clearingNumber: '1234', accountNumber: '567890', iban: 'SE1234', bic: 'ABC' }, {})
    expect(complete.hasBankInfo).toBe(true)
    expect(complete.hasIbanInfo).toBe(true)

    const partial = computeEmployeePayroll({ ...baseEmployee, clearingNumber: '1234' }, {})
    expect(partial.hasBankInfo).toBe(false)
    expect(partial.hasIbanInfo).toBe(false)
  })
})

describe('summarizePayrollRun', () => {
  it('summerar samtliga anställdas beräknade rader fält för fält', () => {
    const rows = [
      computeEmployeePayroll(baseEmployee, {}),
      computeEmployeePayroll({ ...baseEmployee, monthlySalary: 40000 }, {}),
    ]
    const summary = summarizePayrollRun(rows)
    expect(summary.gross).toBe(rows[0].gross + rows[1].gross)
    expect(summary.net).toBe(rows[0].net + rows[1].net)
    expect(summary.totalCost).toBe(rows[0].totalCost + rows[1].totalCost)
  })

  it('returnerar nollor för en tom lönekörning', () => {
    const summary = summarizePayrollRun([])
    expect(summary).toEqual({ gross: 0, tax: 0, net: 0, employerFee: 0, vacationProvision: 0, vacationFee: 0, vacationUsed: 0, vacationUsedFee: 0, taxFree: 0, totalCost: 0 })
  })
})

describe('åldersanpassad arbetsgivaravgift (körningar med feeRules 2)', () => {
  const emp = (ssn, extra = {}) => ({ ...baseEmployee, ssn, ...extra })
  const row = (period) => ({ period, feeRules: 2 })

  it('standard 31,42 % för någon född 1990', () => {
    expect(computeEmployeePayroll(emp('19900101-1234'), row('2026-05')).employerFee).toBe(Math.round(30000 * 0.3142))
  })
  it('bara ålderspensionsavgift 10,21 % för någon född 1955', () => {
    const r = computeEmployeePayroll(emp('19550101-1234'), row('2026-05'))
    expect(r.employerFee).toBe(Math.round(30000 * 0.1021))
    expect(r.feeCategory.key).toBe('pension_only')
  })
  it('ingen avgift för någon född 1937', () => {
    expect(computeEmployeePayroll(emp('19370101-1234'), row('2026-05')).employerFee).toBe(0)
  })
  it('unga: 20,81 % upp till 25 000 kr och 31,42 % på resten, från april 2026', () => {
    const r = computeEmployeePayroll(emp('20050101-1234'), row('2026-05'))
    expect(r.employerFee).toBe(Math.round(25000 * 0.2081 + 5000 * 0.3142))
  })
  it('unga före april 2026 betalar full avgift', () => {
    expect(computeEmployeePayroll(emp('20050101-1234'), row('2026-03')).employerFee).toBe(Math.round(30000 * 0.3142))
  })
  it('äldre körningar utan feeRules räknas som förut', () => {
    expect(computeEmployeePayroll(emp('19550101-1234'), { period: '2026-05' }).employerFee).toBe(Math.round(30000 * 0.3142))
  })
  it('F-skatt: ingen skatt och ingen avgift', () => {
    const r = computeEmployeePayroll(emp('19900101-1234', { taxForm: 'f_skatt' }), row('2026-05'))
    expect(r.tax).toBe(0)
    expect(r.employerFee).toBe(0)
    expect(r.fTax).toBe(true)
  })
})

describe('computeEmployeePayroll — sammalöneregeln och semesteruttag', () => {
  it('semestertillägget räknas inte som rörlig lön i avsättningen', () => {
    const withVacation = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'sammaloneregeln' }, { lines: [{ id: 'v', payTypeId: 'vacation_taken', quantity: 1, rate: 129 }] })
    expect(withVacation.vacationProvision).toBe(3245)
  })
})

describe('computeEmployeePayroll — uttagen semester minskar skulden', () => {
  it('sammalöneregeln: uttagna dagar × (dagslön + tillägg)', () => {
    const r = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'sammaloneregeln' }, { lines: [{ id: 'v', payTypeId: 'vacation_taken', quantity: 2, rate: 129 }] })
    expect(r.vacationUsed).toBe(Math.round(2 * (30000 / 21 + 30000 * 0.0043)))
    expect(r.vacationUsedFee).toBe(Math.round(r.vacationUsed * 0.3142))
  })
  it('procentregeln: utbetald semesterlön', () => {
    const r = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'procentregeln' }, { lines: [{ id: 'v', payTypeId: 'vacation_taken', quantity: 3, rate: 1500 }] })
    expect(r.vacationUsed).toBe(4500)
  })
  it('semesterersättning vid slutlön förbrukar skulden', () => {
    const r = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'sammaloneregeln' }, { lines: [{ id: 'p', payTypeId: 'holiday_pay_out', quantity: 1, rate: 8000 }] })
    expect(r.vacationUsed).toBe(8000)
  })
  it('ingen semester, inget uttag', () => {
    expect(computeEmployeePayroll(baseEmployee, {}).vacationUsed).toBe(0)
  })
  it('totalkostnaden räknar inte uttagen semester två gånger', () => {
    const r = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'procentregeln' }, { lines: [{ id: 'v', payTypeId: 'vacation_taken', quantity: 3, rate: 1500 }] })
    expect(r.totalCost).toBeCloseTo(r.gross + r.employerFee + r.vacationProvision + r.vacationFee - r.vacationUsed - r.vacationUsedFee, -1)
  })
})
