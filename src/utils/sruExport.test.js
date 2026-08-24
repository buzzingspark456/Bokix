import { describe, it, expect } from 'vitest'
import { generateInk2rSru, encodeWindows1252 } from './sruExport'

describe('encodeWindows1252', () => {
  it('maps å/ä/ö (and uppercase) to their real single-byte windows-1252 codes', () => {
    // Bugkritiskt regressionstest: en Blob deklarerad som windows-1252
    // men fylld med UTF-8-bytes (new Blob([sträng], {type: '...cp1252'}))
    // gör å till två bytes (0xC3 0xA5) istället för den enda byte
    // (0xE5) en cp1252-läsare förväntar sig.
    const input = 'Åkeriet i Norr AB - åäö ÅÄÖ'
    const bytes = encodeWindows1252(input)
    expect(Array.from(bytes)).toEqual([
      0xC5, 0x6B, 0x65, 0x72, 0x69, 0x65, 0x74, 0x20, 0x69, 0x20, 0x4E, 0x6F, 0x72, 0x72, 0x20, 0x41, 0x42,
      0x20, 0x2D, 0x20, 0xE5, 0xE4, 0xF6, 0x20, 0xC5, 0xC4, 0xD6,
    ])
    expect(bytes.length).toBe(input.length) // en byte per tecken, ingen multi-byte-expansion
  })

  it('falls back to "?" for characters outside the Latin-1 range instead of corrupting the byte stream', () => {
    const bytes = encodeWindows1252('AB 中 CD')
    expect(String.fromCharCode(...bytes)).toBe('AB ? CD')
  })
})

describe('generateInk2rSru', () => {
  it('includes the field code for every row that has one, and skips rows without one', () => {
    const ink2r = {
      rows: [
        { row: '2.26', label: 'Kassa, bank och redovisningsmedel', fieldCode: '7281', amount: 12345 },
        { row: '2.45', label: 'Leverantörsskulder', fieldCode: null, amount: 999 },
      ],
    }
    const { blankettSru } = generateInk2rSru({ orgNr: '556677-8899', name: 'Åkeriet i Norr AB' }, ink2r, [], '2026-12-31')
    expect(blankettSru).toContain('#UPPGIFT 7281 12345')
    // Raden utan fältkod (2.45) ska inte ge en egen #UPPGIFT-rad alls.
    expect(blankettSru.match(/#UPPGIFT/g)).toHaveLength(1)
  })

  it('also includes resultaträkningens rader when given', () => {
    const ink2r = { rows: [{ row: '2.26', fieldCode: '7281', amount: 100 }] }
    const resultRows = [{ row: '3.1', fieldCode: '7410', amount: 20000 }]
    const { blankettSru } = generateInk2rSru({ orgNr: '556677-8899', name: 'Test AB' }, ink2r, resultRows, '2026-12-31')
    expect(blankettSru).toContain('#UPPGIFT 7281 100')
    expect(blankettSru).toContain('#UPPGIFT 7410 20000')
  })
})
