import { describe, it, expect } from 'vitest'
import { generateInventoryListPdf } from './inventoryListPdf'

describe('inventeringslistan', () => {
  it('ritar en PDF med varor, summa och underskriftsrad', () => {
    const doc = generateInventoryListPdf({
      company: { name: 'Test AB', orgNr: '556000-0000' }, date: '2026-12-31', methodName: 'FIFO', account: '1460',
      lines: [{ articleNumber: 'K-100', description: 'Kaffebönor 1 kg', qty: 18, unit: 'st', unitCost: 98, bookValue: 1764, writeDown: 0 }],
      total: 1764, writeDown: 0,
    })
    const text = doc.output()
    expect(text.length).toBeGreaterThan(1000)
    expect(text).toContain('Inventeringslista')
    expect(text).toContain('1 764,00 kr')
    expect(doc.getNumberOfPages()).toBe(1)
  })
})
