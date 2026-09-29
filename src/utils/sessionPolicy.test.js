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

describe('appspärren', () => {
  it('är av utan påslagna passkeys, även om nyckeln finns', async () => {
    const { appLockEnabledFor, setAppLock } = await import('./sessionPolicy.js')
    globalThis.window = globalThis.window || {}
    const store = {}
    globalThis.window.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v }, removeItem: k => { delete store[k] } }
    setAppLock('u1')
    expect(appLockEnabledFor('u1')).toBe(false) // VITE_PASSKEYS är inte satt i testerna
    expect(appLockEnabledFor(null)).toBe(false)
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
