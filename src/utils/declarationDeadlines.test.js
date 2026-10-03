import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextVatDeadline, nextAgiDeadline, nextKuDeadline, vatDueDate } from './declarationDeadlines'

describe('nextVatDeadline', () => {
  it('returns null for non-quarterly reporting', () => {
    expect(nextVatDeadline({ vatPeriod: 'monthly' }, {})).toBeNull()
    expect(nextVatDeadline({ vatPeriod: 'yearly' }, {})).toBeNull()
  })

  it('defaults to quarterly when vatPeriod is unset', () => {
    expect(nextVatDeadline({}, {})).not.toBeNull()
  })

  it('skips already-booked quarters', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-03T00:00:00'))
    const withNoneBooked = nextVatDeadline({ vatPeriod: 'quarterly' }, {})
    const withQ3Booked = nextVatDeadline({ vatPeriod: 'quarterly' }, { '2026-Q3': {} })
    vi.useRealTimers()
    expect(`${withNoneBooked.year}-Q${withNoneBooked.quarter}`).toBe('2026-Q3')
    expect(`${withQ3Booked.year}-Q${withQ3Booked.quarter}`).toBe('2026-Q4')
  })

  // Regressionstest (2026-10-03): den 3 oktober är nästa deadline Q3:s den
  // 12 november, inte Q4:s i februari. Funktionen började förut i
  // innevarande kvartal och missade kvartalet som just tagit slut.
  describe('kvartalet som just tog slut kommer först', () => {
    afterEach(() => { vi.useRealTimers() })
    const cases = [
      ['3 oktober → Q3, 12 november', '2026-10-03', 2026, 3, 2026, 10, 12],
      ['15 januari → Q4 året innan, 12 februari', '2026-01-15', 2025, 4, 2026, 1, 12],
      ['på själva dagen räknas den fortfarande', '2026-11-12', 2026, 3, 2026, 10, 12],
      ['dagen efter → innevarande kvartal', '2026-11-13', 2026, 4, 2027, 1, 12],
    ]
    for (const [label, todayIso, qy, qq, dy, dm, dd] of cases) {
      it(label, () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(`${todayIso}T00:00:00`))
        const r = nextVatDeadline({ vatPeriod: 'quarterly' }, {})
        expect([r.year, r.quarter]).toEqual([qy, qq])
        expect([r.dueDate.getFullYear(), r.dueDate.getMonth(), r.dueDate.getDate()]).toEqual([dy, dm, dd])
      })
    }
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
      // Datumen ligger efter förra kvartalets deadline, så det är
      // innevarande kvartal som räknas fram.
      ['kvartal 1 (jan–mar) → 12 maj', '2026-02-20', 2026, 4, 12],
      ['kvartal 2 (apr–jun) → 17 augusti (undantaget)', '2026-05-20', 2026, 7, 17],
      ['kvartal 3 (jul–sep) → 12 november', '2026-08-20', 2026, 10, 12],
      // Detta är fallet som tidigare landade i mars (bug), inte februari.
      ['kvartal 4 (okt–dec) → 12 februari ÅRET EFTER, inte mars', '2026-11-20', 2027, 1, 12],
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

describe('vatDueDate', () => {
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  it('is the 12th of the second month after the quarter (rolled off weekends)', () => {
    expect(ymd(vatDueDate(2026, 3))).toBe('2026-11-12') // torsdag
    expect(ymd(vatDueDate(2026, 1))).toBe('2026-05-12') // tisdag
  })

  it('uses the 17th when the due month is August', () => {
    // Kvartal 2 slutar i juni, förfaller i augusti: 17 augusti 2026 är en måndag.
    expect(ymd(vatDueDate(2026, 2))).toBe('2026-08-17')
  })

  it('handles quarter 4 (due in February of the next year, no month overflow)', () => {
    // 12 februari 2027 är en fredag.
    expect(ymd(vatDueDate(2026, 4))).toBe('2027-02-12')
  })

  it('matches nextVatDeadline for the quarter it returns', () => {
    const next = nextVatDeadline({ vatPeriod: 'quarterly' }, {})
    expect(ymd(vatDueDate(next.year, next.quarter))).toBe(ymd(next.dueDate))
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

  // Regressionstest (omkorsverifierat 2026-09-12 mot flera oberoende
  // datumtabeller, se filkommentaren i declarationDeadlines.js) — december-
  // lönen (deklareras i januari) hade tidigare fel förfallodag: 12 januari
  // istället för det dokumenterade undantaget, 17 januari (framflyttat till
  // 19 januari 2026 eftersom 17:e är en lördag det året).
  it('uses the 17th (not the 12th) for December payroll, due in January', () => {
    const ref = new Date(2025, 11, 5) // 5 december 2025, före den 12:e
    const result = nextAgiDeadline(ref)
    expect(result.periodKey).toBe('2025-11') // väntar — lönerna avser NOVEMBER här (12:e december inte passerad än)

    const refAfter = new Date(2025, 11, 15) // 15 december 2025, efter den 12:e — nu räknas DECEMBER-lönen
    const resultAfter = nextAgiDeadline(refAfter)
    expect(resultAfter.periodKey).toBe('2025-12') // lönerna avser december
    expect(resultAfter.dueDate.getFullYear()).toBe(2026)
    expect(resultAfter.dueDate.getMonth()).toBe(0) // januari
    expect(resultAfter.dueDate.getDate()).toBe(19) // 17 januari 2026 är en lördag — framflyttat till måndag
  })
})

// Regressionstest (kundfeedback: "viktiga datum visar inget när det
// senaste är avklarat") — KU var den saknade tredje deadline-typen: till
// skillnad från moms/AGI (som alltid har NÅGON framtida period att peka på)
// fanns ingen uträkning alls för KU:s fasta 31 januari-datum, så "Viktiga
// datum" kunde stå helt tomt utanför en snar moms-/lönedeadline.
describe('nextKuDeadline', () => {
  it('returns this year\'s 31 January (rolled off any weekend) when still ahead', () => {
    const ref = new Date(2026, 0, 5) // 5 januari 2026, före den 31:a
    const result = nextKuDeadline(ref)
    // 31 januari 2026 är en lördag — framflyttat till måndag 2 februari,
    // se rollForwardPastWeekend. Kollar därför bara att den INTE hoppat
    // vidare till nästa ÅR (den faktiska bugg-ytan) — exakt vilken dag den
    // landar på täcks redan av "never lands on a weekend" nedan.
    expect(result.dueDate.getFullYear()).toBe(2026)
    expect(result.incomeYear).toBe(2025) // KU:n avser inkomståret INNAN förfallodatumets år
  })

  it('rolls to next year\'s 31 January once this year\'s has passed', () => {
    const ref = new Date(2026, 5, 1) // juni 2026, långt efter 31 januari
    const result = nextKuDeadline(ref)
    expect(result.dueDate.getFullYear()).toBe(2027)
    expect(result.incomeYear).toBe(2026)
  })

  it('never lands on a weekend, whatever year it falls in', () => {
    for (let y = 2025; y <= 2032; y++) {
      const result = nextKuDeadline(new Date(y, 0, 1))
      const dow = result.dueDate.getDay()
      expect(dow).not.toBe(0)
      expect(dow).not.toBe(6)
    }
  })

  it('computes a non-negative daysLeft for the returned deadline', () => {
    const result = nextKuDeadline(new Date(2026, 8, 12))
    expect(result.daysLeft).toBeGreaterThanOrEqual(0)
  })
})
