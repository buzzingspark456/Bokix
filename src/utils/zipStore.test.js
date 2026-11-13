import { describe, it, expect } from 'vitest'
import { createZip } from './zipStore'

describe('createZip och svenska filnamn', () => {
  it('sätter UTF-8-flaggan så att å, ä och ö visas rätt', () => {
    const zip = createZip([{ name: 'Förteckning å.txt', data: new Uint8Array([1, 2, 3]) }])
    const dv = new DataView(zip.buffer)
    expect(dv.getUint32(0, true)).toBe(0x04034b50)
    expect(dv.getUint16(6, true) & 0x0800).toBe(0x0800)
    const nameLen = dv.getUint16(26, true)
    expect(new TextDecoder().decode(zip.slice(30, 30 + nameLen))).toBe('Förteckning å.txt')
    const centralStart = dv.getUint32(zip.length - 22 + 16, true)
    expect(dv.getUint32(centralStart, true)).toBe(0x02014b50)
    expect(dv.getUint16(centralStart + 8, true) & 0x0800).toBe(0x0800)
  })
})
