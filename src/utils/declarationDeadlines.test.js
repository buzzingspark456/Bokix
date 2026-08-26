import { describe, it, expect } from 'vitest'
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

  it('computes a positive or zero daysLeft for the returned deadline', () => {
    const ref = new Date(2026, 5, 1)
    const result = nextAgiDeadline(ref)
    expect(result.daysLeft).toBeGreaterThanOrEqual(0)
  })
})
