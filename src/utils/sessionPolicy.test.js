import { describe, it, expect } from 'vitest'
import { isInactiveTooLong, INACTIVE_DAYS, isPasskeyCancel } from './sessionPolicy.js'

const DAY = 86400000

describe('isInactiveTooLong', () => {
  const now = Date.UTC(2026, 8, 29)
  it('inte inaktiv inom gränsen', () => {
    expect(isInactiveTooLong(now, now - (INACTIVE_DAYS - 1) * DAY)).toBe(false)
  })
  it('inaktiv efter gränsen', () => {
    expect(isInactiveTooLong(now, now - (INACTIVE_DAYS + 1) * DAY)).toBe(true)
  })
  it('saknad tidsstämpel loggar aldrig ut', () => {
    expect(isInactiveTooLong(now, null)).toBe(false)
  })
})

describe('isPasskeyCancel', () => {
  it('känner igen en avbruten Face ID-ruta', () => {
    expect(isPasskeyCancel({ name: 'NotAllowedError' })).toBe(true)
    expect(isPasskeyCancel({ message: 'The operation either timed out or was not allowed.' })).toBe(true)
  })
  it('ett riktigt fel är inget avbrott', () => {
    expect(isPasskeyCancel({ message: 'Passkeys are not enabled' })).toBe(false)
  })
})
