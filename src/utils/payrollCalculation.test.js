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
  it('semesteravsättning är 12 % av bruttolönen (procentregeln)', () => {
    expect(result.vacationProvision).toBe(Math.round(30000 * 0.12))
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
  it('sammalöneregeln (och övriga icke-procentregeln) beräknar inte semesteravsättning automatiskt', () => {
    const result = computeEmployeePayroll({ ...baseEmployee, vacationRule: 'sammaloneregeln' }, {})
    expect(result.vacationProvision).toBe(0)
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
    expect(summary).toEqual({ gross: 0, tax: 0, net: 0, employerFee: 0, vacationProvision: 0, vacationFee: 0, totalCost: 0 })
  })
})
