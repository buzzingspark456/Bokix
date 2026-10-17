import { describe, it, expect } from 'vitest'
import { generatePayslipPdf, payslipPassword, maskedAccount, yearToDate } from './payslipExport'

const employee = { firstName: 'Anna', lastName: 'Test', ssn: '19900101-1234', salaryForm: 'manadslon', clearingNumber: '8327', accountNumber: '9123456789', taxTable: { tabellnr: 33, kolumn: 1 } }
const computed = {
  baseSalary: 30000, gross: 31500, tax: 7000, net: 24300, employerFee: 9897, vacationProvision: 3780,
  payLines: [
    { kind: 'addition', name: 'Övertid, enkel', quantity: 5, unit: 'timmar', rate: 300, signedAmount: 1500, amount: 1500 },
    { kind: 'benefit', name: 'Friskvård', amount: 500 },
    { kind: 'netDeduction', name: 'Lunch', amount: 200 },
  ],
}

describe('lönebeskedet', () => {
  it('lösenordet är de fyra sista siffrorna i personnumret', () => {
    expect(payslipPassword(employee)).toBe('1234')
    expect(payslipPassword({ ssn: '' })).toBe('')
  })

  it('visar bara de fyra sista siffrorna i kontot', () => {
    expect(maskedAccount(employee)).toBe('8327-******6789')
    expect(maskedAccount({ iban: 'SE4550000000058398257466' })).toBe('IBAN …7466')
  })

  it('ritar en PDF, och krypterar den när ett lösenord ges', () => {
    const args = { employee, computed, period: '2026-10', company: { name: 'Test AB', orgNr: '556000-0000' }, payDate: '2026-10-25',
      vacation: { vacationYear: { label: '2026/2027' }, totalAvailable: 22, saved: 2, earned: 25, taken: 5 },
      ytd: { gross: 300000, tax: 70000, net: 230000, benefits: 5000 }, message: 'Hej' }
    const open = generatePayslipPdf(args).output()
    expect(open).not.toContain('/Encrypt')
    expect(open).toContain('Lönebesked')
    const locked = generatePayslipPdf(args, { password: '1234' }).output()
    expect(locked).toContain('/Encrypt')
  })

  it('summerar netto och förmåner hittills i år', () => {
    const runs = [{ period: '2026-09', completedSteps: ['approved'], rows: [{ employeeId: 'e1' }] }]
    const sum = yearToDate({ employeeId: 'e1', period: '2026-10', runs, current: computed, computeRow: () => computed })
    expect(sum).toEqual({ gross: 63000, tax: 14000, net: 48600, benefits: 1000 })
  })
})
