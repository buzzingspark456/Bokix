import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextVatDeadline, nextAgiDeadline } from './declarationDeadlines'

describe('nextVatDeadline', () => {
  it('returns null for non-quarterly reporting', () => {
    expect(nextVatDeadline({ vatPeriod: 'monthly' }, {})).toBeNull()
    expect(nextVatDeadline({ vatPeriod: 'yearly' }, {})).toBeNull()
  })

  it('defaults to quarterly when vatPeriod is unset', () => {
    expect(nextVatDeadline({}, {})).not.toBeNull()
  })

  it('skips already-booked quarters', () => {
    const today = new Date()
    const y = today.getFullYear()
    const q = Math.floor(today.getMonth() / 3) + 1
    const withCurrentBooked = nextVatDeadline({ vatPeriod: 'quarterly' }, { [`${y}-Q${q}`]: {} })
    const withNoneBooked = nextVatDeadline({ vatPeriod: 'quarterly' }, {})
    // Det bokade kvartalet ska aldrig vara det som returneras.
    expect(`${withCurrentBooked.year}-Q${withCurrentBooked.quarter}`).not.toBe(`${y}-Q${q}`)
    expect(`${withNoneBooked.year}-Q${withNoneBooked.quarter}`).toBe(`${y}-Q${q}`)
  })

  it('rolls the 12th forward off a weekend', () => {
    // Q1 2026 slutar 2026-03-31, deadline "12:e i andra månaden efter" =
    // 2026-05-12 — en tisdag, ingen framflyttning ska ske. Kollar bara att
    // resultatet aldrig landar på en lördag/söndag, oavsett vilket kvartal
    // som faktiskt räknas fram (beror på dagens datum).
    const result = nextVatDeadline({ vatPeriod: 'quarterly' }, {})
    const dow = result.dueDate.getDay()
    expect(dow).not.toBe(0)
    expect(dow).not.toBe(6)
  })

  // Regressionstest (verifierat direkt mot skatteverket.se 2026-09-01, se
  // filkommentaren i declarationDeadlines.js) för två separata buggar som
  // hittades vid en noggrannhetsgranskning: (1) kvartal 4:s förfallodag
  // landade i MARS istället för februari (Date.setMonth-överspill när
  // dagen fortfarande stod på 31 från periodens sista dag), (2) augusti
  // saknade Skatteverkets 17:e-undantag (alla månader använde blint 12:e).
  describe('exakta förfallodagar per kvartal (mot skatteverket.se)', () => {
    afterEach(() => { vi.useRealTimers() })

    const cases = [
      ['kvartal 1 (jan–mar) → 12 maj', '2026-01-15', 2026, 4, 12],
      ['kvartal 2 (apr–jun) → 17 augusti (undantaget)', '2026-04-15', 2026, 7, 17],
      ['kvartal 3 (jul–sep) → 12 november', '2026-07-15', 2026, 10, 12],
      // Detta är fallet som tidigare landade i mars (bug), inte februari.
      ['kvartal 4 (okt–dec) → 12 februari ÅRET EFTER, inte mars', '2026-10-15', 2027, 1, 12],
    ]

    for (const [label, todayIso, expectedYear, expectedMonth, expectedDay] of cases) {
      it(label, () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(`${todayIso}T00:00:00`))
        const result = nextVatDeadline({ vatPeriod: 'quarterly' }, {})
        expect(result.dueDate.getFullYear()).toBe(expectedYear)
        expect(result.dueDate.getMonth()).toBe(expectedMonth)
        expect(result.dueDate.getDate()).toBe(expectedDay)
      })
    }
  })
})

describe('nextAgiDeadline', () => {
  it('returns this month\'s 12th when still ahead', () => {
    const ref = new Date(2026, 2, 5) // 5 mars 2026, före den 12:e
    const result = nextAgiDeadline(ref)
    expect(result.dueDate.getMonth()).toBe(2) // mars
    expect(result.dueDate.getDate()).toBe(12)
    expect(result.periodKey).toBe('2026-02') // lönerna avser februari
  })

  it('rolls to next month once the 12th has passed', () => {
    const ref = new Date(2026, 2, 15) // 15 mars 2026, efter den 12:e
    const result = nextAgiDeadline(ref)
    expect(result.dueDate.getMonth()).toBe(3) // april
    expect(result.periodKey).toBe('2026-03') // lönerna avser mars
  })

  it('never lands on a weekend', () => {
    for (let m = 0; m < 12; m++) {
      const result = nextAgiDeadline(new Date(2026, m, 1))
      const dow = result.dueDate.getDay()
      expect(dow).not.toBe(0)
      expect(dow).not.toBe(6)
    }
  })

  // Regressionstest (verifierat direkt mot skatteverket.se 2026-09-01) —
  // juli-lönen (deklareras i augusti) hade tidigare fel förfallodag: 12
  // augusti istället för det dokumenterade undantaget, 17 augusti.
  it('uses the 17th (not the 12th) for July payroll, due in August', () => {
    const ref = new Date(2026, 6, 5) // 5 juli 2026, före den 12:e
    const result = nextAgiDeadline(ref)
    expect(result.periodKey).toBe('2026-06') // väntar — lönerna avser JUNI här (12:e juli inte passerad än)
    expect(result.dueDate.getMonth()).toBe(6) // juli
    expect(result.dueDate.getDate()).toBe(13) // 12 juli 2026 är en söndag — framflyttat en dag

    const refAfter = new Date(2026, 6, 15) // 15 juli 2026, efter den 12:e — nu räknas JULI-lönen
    const resultAfter = nextAgiDeadline(refAfter)
    expect(resultAfter.periodKey).toBe('2026-07') // lönerna avser juli
    expect(resultAfter.dueDate.getMonth()).toBe(7) // augusti
    expect(resultAfter.dueDate.getDate()).toBe(17) // undantaget, inte 12
  })

  it('computes a positive or zero daysLeft for the returned deadline', () => {
    const ref = new Date(2026, 5, 1)
    const result = nextAgiDeadline(ref)
    expect(result.daysLeft).toBeGreaterThanOrEqual(0)
  })
})
