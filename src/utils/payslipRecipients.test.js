import { describe, it, expect } from 'vitest'
import { hasPayslip } from './payslipExport'
import { computeEmployeePayroll } from './payrollCalculation'

// Kundrapport: nio anställda i körningen, sex fick lön, alla nio fick
// lönebesked. Bara den som har något belopp den här månaden ska få ett.
const base = { employmentType: 'anstalld', employmentRate: 100, secondaryIncome: true }
const monthly = { ...base, salaryForm: 'manadslon', monthlySalary: 30000 }
const hourly = { ...base, salaryForm: 'timlon', hourlyRate: 200 }
const line = (payTypeId, rate) => ({ id: `l_${payTypeId}`, payTypeId, quantity: 1, rate })

describe('vem får lönebesked', () => {
  it('månadsanställd med lön får lönebesked', () => {
    expect(hasPayslip(computeEmployeePayroll(monthly, {}))).toBe(true)
  })
  it('timanställd med timmar får lönebesked', () => {
    expect(hasPayslip(computeEmployeePayroll(hourly, { hoursWorked: 10 }))).toBe(true)
  })
  it('timanställd utan timmar får inget lönebesked', () => {
    expect(hasPayslip(computeEmployeePayroll(hourly, {}))).toBe(false)
    expect(hasPayslip(computeEmployeePayroll(hourly, { hoursWorked: '' }))).toBe(false)
    expect(hasPayslip(computeEmployeePayroll(hourly, { hoursWorked: 0 }))).toBe(false)
  })
  it('månadsanställd på 0 kr får inget lönebesked', () => {
    expect(hasPayslip(computeEmployeePayroll({ ...monthly, monthlySalary: 0 }, {}))).toBe(false)
  })
  it('bara ett utlägg utan lön ger ändå lönebesked (pengar betalas ut)', () => {
    expect(hasPayslip(computeEmployeePayroll(hourly, { lines: [line('expense_refund', 450)] }))).toBe(true)
  })
  it('bara en förmån utan lön ger ändå lönebesked (skatt och avgift)', () => {
    expect(hasPayslip(computeEmployeePayroll(hourly, { lines: [line('other_benefit', 1000)] }))).toBe(true)
  })
  it('nio i körningen, sex med lön: sex lönebesked', () => {
    const rows = [
      ...Array.from({ length: 4 }, () => computeEmployeePayroll(monthly, {})),
      ...Array.from({ length: 2 }, () => computeEmployeePayroll(hourly, { hoursWorked: 20 })),
      ...Array.from({ length: 3 }, () => computeEmployeePayroll(hourly, {})),
    ]
    expect(rows.filter(hasPayslip)).toHaveLength(6)
  })
  it('tål saknad beräkning och avrundningsrester', () => {
    expect(hasPayslip(null)).toBe(false)
    expect(hasPayslip({ gross: 0.001, net: 0, tax: 0, employerFee: 0 })).toBe(false)
  })
})

describe('personnummer på lönebeskedet', async () => {
  const { formatSsn } = await import('./payslipExport')
  it('skrivs med bindestreck oavsett inmatning', () => {
    expect(formatSsn('199003011234')).toBe('19900301-1234')
    expect(formatSsn('19900301-1234')).toBe('19900301-1234')
    expect(formatSsn('900301-1234')).toBe('900301-1234')
    expect(formatSsn('9003011234')).toBe('900301-1234')
    expect(formatSsn('')).toBe('')
  })
})
