import { describe, it, expect } from 'vitest'
import { generateInk2rSru, generateNeSru, encodeWindows1252, sruPeriod, sruOrgId, sruMissingFields } from './sruExport'
import { createZip, crc32 } from './zipStore'

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

const company = { orgNr: '556677-8899', name: 'Åkeriet i Norr AB', address: 'Storgatan 1', postalCode: '123 45', city: 'Skattstad' }
const now = new Date(2027, 2, 5, 9, 4, 7)
const fy = { start: '2026-01-01', end: '2026-12-31' }

describe('generateInk2rSru', () => {
  it('skriver en INFO.SRU med alla obligatoriska uppgifter', () => {
    const { infoSru } = generateInk2rSru(company, { rows: [] }, [], fy, now)
    expect(infoSru.split('\r\n')).toEqual([
      '#DATABESKRIVNING_START', '#PRODUKT SRU', '#SKAPAD 20270305 090407', '#PROGRAM Bokix', '#FILNAMN BLANKETTER.SRU',
      '#DATABESKRIVNING_SLUT', '#MEDIELEV_START', '#ORGNR 165566778899', '#NAMN Åkeriet i Norr AB', '#ADRESS Storgatan 1',
      '#POSTNR 12345', '#POSTORT Skattstad', '#MEDIELEV_SLUT', '',
    ])
  })

  it('skriver INK2, INK2R och INK2S med framställningstid i #IDENTITET', () => {
    const ink2r = { rows: [
      { row: '2.26', fieldCode: '7281', amount: 12345.4 },
      { row: '2.45', fieldCode: null, amount: 999 },
    ] }
    const resultRows = [
      { row: '3.1', fieldCode: '7410', amount: 20000 },
      { row: '3.2', fieldCode: '7510', fieldCodePlus: '7411', fieldCodeMinus: '7510', amount: -300 },
      { row: '3.27', fieldCode: '7550', amount: 769 },
    ]
    const { blankettSru } = generateInk2rSru(company, ink2r, resultRows, fy, now)
    expect(blankettSru).toContain('#BLANKETT INK2-2026P4\r\n#IDENTITET 165566778899 20270305 090407\r\n')
    expect(blankettSru).toContain('#BLANKETT INK2R-2026P4')
    expect(blankettSru).toContain('#BLANKETT INK2S-2026P4')
    expect(blankettSru).toContain('#UPPGIFT 7011 20260101')
    expect(blankettSru).toContain('#UPPGIFT 7012 20261231')
    expect(blankettSru).toContain('#UPPGIFT 7281 12345')
    expect(blankettSru).toContain('#UPPGIFT 7410 20000')
    // Minuskoden får ett positivt belopp, raden utan fältkod ingen rad alls.
    expect(blankettSru).toContain('#UPPGIFT 7510 300')
    expect(blankettSru).not.toContain('999')
    expect(blankettSru).toContain('#UPPGIFT 7550 769')
    // INK2S får årets resultat som 4.2 förlust.
    expect(blankettSru).toMatch(/#BLANKETT INK2S-2026P4[\s\S]*#UPPGIFT 7750 769\r\n#BLANKETTSLUT\r\n#FIL_SLUT\r\n$/)
    expect(blankettSru.match(/#BLANKETTSLUT/g)).toHaveLength(3)
  })

  it('räknar fram räkenskapsårets början när bara slutet ges', () => {
    const { blankettSru } = generateInk2rSru(company, { rows: [] }, [], '2026-06-30', now)
    expect(blankettSru).toContain('#UPPGIFT 7011 20250701')
    expect(blankettSru).toContain('#BLANKETT INK2-2026P2')
  })
})

describe('sruPeriod, sruOrgId, sruMissingFields', () => {
  it('räknar beskattningsperiod ur räkenskapsårets slut', () => {
    expect(sruPeriod('2026-12-31')).toBe('2026P4')
    expect(sruPeriod('2026-04-30')).toBe('2026P1')
    expect(sruPeriod('2026-06-30')).toBe('2026P2')
    expect(sruPeriod('2026-08-31')).toBe('2026P3')
  })
  it('gör organisationsnumret tolvsiffrigt', () => {
    expect(sruOrgId('556677-8899')).toBe('165566778899')
    expect(sruOrgId('')).toBe('')
  })
  it('säger vad som saknas', () => {
    expect(sruMissingFields(company)).toEqual([])
    expect(sruMissingFields({ orgNr: '556677-8899', name: 'X AB' })).toEqual(['postnummer', 'ort'])
  })
})

describe('createZip', () => {
  it('ger en giltig zip med filerna okomprimerade', () => {
    const data = new TextEncoder().encode('#FIL_SLUT')
    const zip = createZip([{ name: 'INFO.SRU', data }])
    const view = new DataView(zip.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint32(14, true)).toBe(crc32(data))
    expect(view.getUint32(zip.length - 22, true)).toBe(0x06054b50)
    expect(new TextDecoder().decode(zip.slice(30 + 8, 30 + 8 + data.length))).toBe('#FIL_SLUT')
  })
  it('räknar CRC-32 rätt', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926)
  })
})

describe('NE-bilagan som SRU', () => {
  const company = { orgNr: '850315-1234', name: 'Anna Andersson', postalCode: '111 51', city: 'Stockholm' };
  const ne = {
    balanceRows: [{ row: 'B9', amount: 50000 }, { row: 'B15', amount: 0 }],
    equity: -2000,
    resultRows: [{ row: 'R1', amount: 400000 }, { row: 'R6', amount: 100000 }],
    result: 300000,
    tax: {
      rows: [
        { row: 'R12', sign: '=', amount: 300000 }, { row: 'R13', sign: '+', amount: 1200 },
        { row: 'R17', sign: '=', amount: 301200 }, { row: 'R43', sign: '-', amount: 75300 },
      ],
      r47: 225900, r48: 0,
    },
  };

  it('personnummer med sekel som identitet, NE-block med rätt koder', () => {
    const { infoSru, blankettSru } = generateNeSru(company, ne, { start: '2026-01-01', end: '2026-12-31' }, new Date(2027, 1, 3, 10, 0, 0));
    expect(infoSru).toContain('#ORGNR 198503151234');
    expect(blankettSru).toContain('#BLANKETT NE-2026P4');
    expect(blankettSru).toContain('#IDENTITET 198503151234 20270203 100000');
    for (const line of ['#UPPGIFT 7011 20260101', '#UPPGIFT 7280 50000', '#UPPGIFT 7300 -2000', '#UPPGIFT 7400 400000',
      '#UPPGIFT 7501 100000', '#UPPGIFT 7440 300000', '#UPPGIFT 7600 300000', '#UPPGIFT 7601 1200', '#UPPGIFT 7714 75300', '#UPPGIFT 7630 225900']) {
      expect(blankettSru).toContain(line);
    }
    // Summarader och nollor skrivs inte.
    expect(blankettSru).not.toMatch(/#UPPGIFT 7382 /);
    expect(blankettSru).not.toMatch(/#UPPGIFT 7730 /);
    expect(blankettSru.trim().endsWith('#FIL_SLUT')).toBe(true);
  });
});
