import { describe, it, expect } from 'vitest'
import {
  vacationYearFor, earningYearFor, employedDaysInPeriod, earnedPaidDays,
  vacationPayPerDay, takenDaysInPeriod, summarizeVacation, summarizeVacationLiability,
  VACATION_PAY_PER_DAY_RATE, VACATION_SUPPLEMENT_RATE,
} from './vacation'

const monthlyEmployee = {
  id: 'e1', firstName: 'Anna', lastName: 'Nilsson', active: true,
  employmentType: 'anstalld', salaryForm: 'manadslon', monthlySalary: 30000,
  employmentRate: 100, hoursPerWeek: 40, secondaryIncome: true,
  startDate: '2020-01-01', vacationRule: 'sammaloneregeln', vacationDays: 25,
}
const hourlyEmployee = {
  ...monthlyEmployee, id: 'e2', salaryForm: 'timlon', hourlyRate: 200,
  monthlySalary: '', vacationRule: 'procentregeln',
}

/** En beräknad lönekörning för en månad, med valfria lönearter. */
const run = (period, employee, lines = []) => ({
  id: `run-${period}`, period, completedSteps: ['calculated'],
  rows: [{ employeeId: employee.id, employeeSnapshot: employee, period, hoursWorked: 160, lines }],
})

describe('semesteråret', () => {
  // Förskjutningen 1 april är den vanligaste orsaken till att ett saldo
  // räknas fel för hand: januari hör till året som började i april FÖRRA året.
  it('januari hör till semesteråret som började i april året innan', () => {
    expect(vacationYearFor('2026-01-15').label).toBe('2025/2026')
  })

  it('april startar ett nytt semesterår', () => {
    expect(vacationYearFor('2026-04-01').label).toBe('2026/2027')
    expect(vacationYearFor('2026-03-31').label).toBe('2025/2026')
  })

  it('intjänandeåret är de tolv månaderna före semesteråret', () => {
    const vy = vacationYearFor('2026-09-01')     // 2026/2027
    const ey = earningYearFor(vy)
    expect(ey.startIso).toBe('2025-04-01')
    expect(ey.endIso).toBe('2026-03-31')
  })
})

describe('intjänade dagar', () => {
  const vy = vacationYearFor('2026-09-01')

  it('hel anställning under hela intjänandeåret ger full rätt', () => {
    expect(earnedPaidDays(monthlyEmployee, vy)).toBe(25)
  })

  // Semesterlagen § 7: anställningstid / 365 × semesterdagar, avrundat UPPÅT.
  it('halvt intjänandeår ger ungefär halva antalet dagar, avrundat uppåt', () => {
    const half = { ...monthlyEmployee, startDate: '2025-10-01' }   // 182 dagar
    expect(earnedPaidDays(half, vy)).toBe(Math.ceil((182 / 365) * 25))
  })

  it('anställd efter intjänandeårets slut har inte tjänat in något', () => {
    const brandNew = { ...monthlyEmployee, startDate: '2026-06-01' }
    expect(earnedPaidDays(brandNew, vy)).toBe(0)
  })

  it('avslutad anställning tjänar bara in till slutdatumet', () => {
    const left = { ...monthlyEmployee, endDate: '2025-09-30' }     // 183 dagar
    expect(earnedPaidDays(left, vy)).toBe(Math.ceil((183 / 365) * 25))
  })

  it('aldrig fler dagar än rätten, även vid avrundning uppåt', () => {
    expect(earnedPaidDays({ ...monthlyEmployee, vacationDays: 30 }, vy)).toBe(30)
  })

  it('anställning som inte överlappar perioden ger 0, inte negativt', () => {
    expect(employedDaysInPeriod({ startDate: '2030-01-01' }, earningYearFor(vy))).toBe(0)
  })
})

describe('vad en semesterdag är värd', () => {
  it('sammalöneregeln ger semestertillägget, inte hela dagslönen', () => {
    const p = vacationPayPerDay(monthlyEmployee)
    expect(p.perDay).toBe(Math.round(30000 * VACATION_SUPPLEMENT_RATE * 100) / 100)
    expect(p.rule).toBe('sammaloneregeln')
  })

  it('procentregeln räknar på intjänandeårets lön', () => {
    const p = vacationPayPerDay(hourlyEmployee, 400000)
    expect(p.perDay).toBe(Math.round(400000 * VACATION_PAY_PER_DAY_RATE * 100) / 100)
  })

  it('utan underlag blir procentregelns dagvärde 0, inte NaN', () => {
    expect(vacationPayPerDay(hourlyEmployee).perDay).toBe(0)
  })

  it('regeln "ingen semesteravsättning" ger 0 utan att gissa', () => {
    expect(vacationPayPerDay({ ...monthlyEmployee, vacationRule: 'ingen' }).perDay).toBe(0)
  })
})

describe('uttagna dagar', () => {
  const vy = vacationYearFor('2026-09-01')
  const runs = [
    run('2026-07', monthlyEmployee, [{ payTypeId: 'vacation_taken', quantity: 15, rate: 129 }]),
    run('2026-08', monthlyEmployee, [{ payTypeId: 'vacation_taken', quantity: 3, rate: 129 }]),
    run('2026-08', monthlyEmployee, [{ payTypeId: 'overtime_simple', quantity: 4, rate: 260 }]),
  ]

  it('summerar semesteruttag ur lönekörningarnas lönearter', () => {
    expect(takenDaysInPeriod(monthlyEmployee, runs, vy)).toBe(18)
  })

  // Ett utkast är inte utbetald semester — dagarna ska inte räknas av förrän
  // körningen faktiskt beräknats.
  it('utkast räknas inte', () => {
    const draft = [{ ...run('2026-07', monthlyEmployee, [{ payTypeId: 'vacation_taken', quantity: 10 }]), completedSteps: [] }]
    expect(takenDaysInPeriod(monthlyEmployee, draft, vy)).toBe(0)
  })

  it('körningar utanför semesteråret räknas inte', () => {
    const old = [run('2026-02', monthlyEmployee, [{ payTypeId: 'vacation_taken', quantity: 5 }])]
    expect(takenDaysInPeriod(monthlyEmployee, old, vy)).toBe(0)
  })
})

describe('summeringen per anställd', () => {
  const asOf = new Date('2026-09-06')
  const runs = [run('2026-07', monthlyEmployee, [{ payTypeId: 'vacation_taken', quantity: 15, rate: 129 }])]

  it('räknar intjänat, uttaget och kvar', () => {
    const s = summarizeVacation({ employee: monthlyEmployee, payrollRuns: runs, asOf })
    expect(s.earned).toBe(25)
    expect(s.taken).toBe(15)
    expect(s.remaining).toBe(10)
  })

  it('sparade dagar läggs till det som är tillgängligt', () => {
    const s = summarizeVacation({ employee: { ...monthlyEmployee, savedVacationDays: 4 }, payrollRuns: runs, asOf })
    expect(s.totalAvailable).toBe(14)
  })

  it('skulden är dagar × dagvärde plus arbetsgivaravgifter', () => {
    const s = summarizeVacation({ employee: monthlyEmployee, payrollRuns: runs, asOf })
    expect(s.liability).toBe(Math.round(10 * s.payPerDay))
    expect(s.liabilityFee).toBe(Math.round(s.liability * 0.3142))
    expect(s.liabilityTotal).toBe(s.liability + s.liabilityFee)
  })

  // Fler uttagna än intjänade dagar är inte omöjligt (förskottssemester,
  // felregistrering) — saldot ska klampas till noll men flaggan sättas, inte
  // tvärtom.
  it('övertag flaggas men ger aldrig negativa dagar', () => {
    const many = [run('2026-07', monthlyEmployee, [{ payTypeId: 'vacation_taken', quantity: 30 }])]
    const s = summarizeVacation({ employee: monthlyEmployee, payrollRuns: many, asOf })
    expect(s.remaining).toBe(0)
    expect(s.overEntitlement).toBe(true)
  })

  it('dagar över 20 pekas ut som sparbara vid årsskiftet', () => {
    const s = summarizeVacation({ employee: monthlyEmployee, payrollRuns: [], asOf })
    expect(s.earned).toBe(25)
    expect(s.savableAtYearEnd).toBe(5)
  })
})

describe('semesterskulden för hela företaget', () => {
  const asOf = new Date('2026-09-06')

  it('summerar dagar och kronor över alla aktiva anställda', () => {
    const employees = [monthlyEmployee, { ...monthlyEmployee, id: 'e3', savedVacationDays: 2 }]
    const total = summarizeVacationLiability({ employees, payrollRuns: [], asOf })
    expect(total.rows).toHaveLength(2)
    expect(total.totalDays).toBe(25 + 27)
    expect(total.totalLiability).toBe(total.rows.reduce((s, r) => s + r.liability, 0))
  })

  it('avslutade anställda räknas inte med', () => {
    const employees = [monthlyEmployee, { ...monthlyEmployee, id: 'e4', active: false }]
    expect(summarizeVacationLiability({ employees, payrollRuns: [], asOf }).rows).toHaveLength(1)
  })
})
