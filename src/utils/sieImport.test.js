import { describe, it, expect } from 'vitest'
import { parseSieFile, buildOpeningVerification } from './sieImport'
import { encodeCp437 } from './sieCharset'

// Bygger en ArrayBuffer av en SIE-textfixtur, precis som en verklig
// uppladdad fil (File.arrayBuffer()) skulle ge parsern. Ren ASCII duger
// via TextEncoder för de flesta tester — CP437-specifika tester kodar
// medvetet med encodeCp437 istället (se längst ner).
function sieBuffer(text) {
  return new TextEncoder().encode(text).buffer
}

const MINIMAL_HEADER = [
  '#FLAGGA 0',
  '#PROGRAM "Fortnox" 1.0',
  '#FORMAT PC8',
  '#GEN 20260615',
  '#SIETYP 4',
  '#FNAMN "Test AB"',
  '#ORGNR 556677-8899',
  '#RAR 0 20260101 20261231',
].join('\r\n')

describe('parseSieFile — huvud/metadata', () => {
  it('läser #PROGRAM, #FORMAT, #SIETYP, #FNAMN, #ORGNR, #GEN', () => {
    const result = parseSieFile(sieBuffer(MINIMAL_HEADER))
    expect(result.meta.program).toBe('Fortnox 1.0')
    expect(result.meta.format).toBe('PC8')
    expect(result.meta.sieType).toBe('4')
    expect(result.meta.companyName).toBe('Test AB')
    expect(result.meta.orgNr).toEqual({ raw: '556677-8899', digitsOnly: '5566778899' })
    expect(result.meta.generatedDate).toBe('2026-06-15')
  })

  it('läser ett enda #RAR (SIE4I-typiskt, ett räkenskapsår)', () => {
    const result = parseSieFile(sieBuffer(MINIMAL_HEADER))
    expect(result.fiscalYears).toEqual([{ index: 0, start: '2026-01-01', end: '2026-12-31' }])
  })

  it('läser flera #RAR-rader (SIE4E-typiskt, flerårig historik), sorterat nyast-först', () => {
    const sie = [
      MINIMAL_HEADER,
      '#RAR -1 20250101 20251231',
      '#RAR -2 20240101 20241231',
    ].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.fiscalYears).toEqual([
      { index: 0, start: '2026-01-01', end: '2026-12-31' },
      { index: -1, start: '2025-01-01', end: '2025-12-31' },
      { index: -2, start: '2024-01-01', end: '2024-12-31' },
    ])
  })
})

describe('parseSieFile — kontoplan', () => {
  it('läser #KONTO-rader till accounts[]', () => {
    const sie = [MINIMAL_HEADER, '#KONTO 1930 "Företagskonto"', '#KONTO 3001 "Försäljning"'].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.accounts).toEqual([
      { code: '1930', name: 'Företagskonto' },
      { code: '3001', name: 'Försäljning' },
    ])
  })

  it('senare #KONTO för samma kod ersätter, blir inte en dubblett', () => {
    const sie = [MINIMAL_HEADER, '#KONTO 1930 "Först"', '#KONTO 1930 "Sen"'].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.accounts).toEqual([{ code: '1930', name: 'Sen' }])
  })
})

describe('parseSieFile — verifikationer', () => {
  const withVer = [
    MINIMAL_HEADER,
    '#KONTO 1930 "Företagskonto"',
    '#KONTO 3001 "Försäljning"',
    '#VER A 1 20260115 "Försäljning kontant"',
    '{',
    '\t#TRANS 1930 {} 1000.00',
    '\t#TRANS 3001 {} -1000.00',
    '}',
  ].join('\r\n')

  it('bygger en verifikation med rätt serie/datum/beskrivning', () => {
    const result = parseSieFile(sieBuffer(withVer))
    expect(result.verifications).toHaveLength(1)
    const ver = result.verifications[0]
    expect(ver.series).toBe('A')
    expect(ver.sieNumber).toBe('1')
    expect(ver.date).toBe('2026-01-15')
    expect(ver.description).toBe('Försäljning kontant')
  })

  it('delar upp ett signerat #TRANS-belopp till debet/kredit SOM STRÄNGAR (appens radform)', () => {
    const result = parseSieFile(sieBuffer(withVer))
    const [debetRow, kreditRow] = result.verifications[0].rows
    expect(debetRow).toMatchObject({ account: '1930', debet: '1000.00', kredit: '0' })
    expect(kreditRow).toMatchObject({ account: '3001', debet: '0', kredit: '1000.00' })
    expect(typeof debetRow.debet).toBe('string')
    expect(typeof kreditRow.kredit).toBe('string')
  })

  it('flaggar inte en balanserad verifikation', () => {
    const result = parseSieFile(sieBuffer(withVer))
    expect(result.verifications[0].balanced).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('flaggar en OBALANSERAD verifikation som varning, tappar den inte', () => {
    const sie = [
      MINIMAL_HEADER,
      '#KONTO 1930 "Företagskonto"',
      '#KONTO 3001 "Försäljning"',
      '#VER A 1 20260115 "Obalanserad"',
      '{',
      '\t#TRANS 1930 {} 1000.00',
      '\t#TRANS 3001 {} -500.00',
      '}',
    ].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.verifications).toHaveLength(1)
    expect(result.verifications[0].balanced).toBe(false)
    expect(result.warnings.some(w => w.includes('balanserar inte'))).toBe(true)
  })

  it('flera verifikationer parsas i ordning, var för sig', () => {
    const sie = [
      MINIMAL_HEADER,
      '#VER A 1 20260101 "Första"',
      '{',
      '\t#TRANS 1930 {} 100.00',
      '\t#TRANS 3001 {} -100.00',
      '}',
      '#VER A 2 20260102 "Andra"',
      '{',
      '\t#TRANS 1930 {} 200.00',
      '\t#TRANS 3001 {} -200.00',
      '}',
    ].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.verifications).toHaveLength(2)
    expect(result.verifications.map(v => v.sieNumber)).toEqual(['1', '2'])
  })
})

describe('parseSieFile — robusthet mot skräpiga/verkliga filer', () => {
  it('konto som saknar egen #KONTO-rad men används i #TRANS läggs ändå till, med varning', () => {
    const sie = [
      MINIMAL_HEADER,
      '#VER A 1 20260115 "Saknar kontodeklaration"',
      '{',
      '\t#TRANS 9999 {} 100.00',
      '\t#TRANS 1930 {} -100.00',
      '}',
    ].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.accounts.find(a => a.code === '9999')).toEqual({ code: '9999', name: '9999' })
    expect(result.warnings.some(w => w.includes('9999'))).toBe(true)
  })

  it('kända-men-ej-sparade SIE-taggar (#ADRESS, #TAXAR, m.fl.) varnar INTE — bara genuint okända gör', () => {
    const sie = [MINIMAL_HEADER, '#ADRESS "Storgatan 1" "" "Stockholm" "08-123456"', '#TAXAR 2026', '#KONTO 1930 "Företagskonto"'].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.accounts).toEqual([{ code: '1930', name: 'Företagskonto' }])
    expect(result.warnings).toEqual([])
  })

  it('en genuint okänd/felstavad tagg flaggas som varning istället för att krascha parsningen', () => {
    const sie = [MINIMAL_HEADER, '#NOTARIKTIGTAGG "något"', '#KONTO 1930 "Företagskonto"'].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.accounts).toEqual([{ code: '1930', name: 'Företagskonto' }])
    expect(result.warnings.some(w => w.includes('#NOTARIKTIGTAGG'))).toBe(true)
  })

  it('en fil som glömt sista "}" tappar ändå inte den sista verifikationen', () => {
    const sie = [MINIMAL_HEADER, '#VER A 1 20260115 "Sista utan stängd klammer"', '{', '\t#TRANS 1930 {} 100.00'].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.verifications).toHaveLength(1)
  })

  it('en verifikation utan giltigt datum hoppas över med varning, kraschar inte resten', () => {
    const sie = [
      MINIMAL_HEADER,
      '#VER A 1 INVALID "Trasigt datum"',
      '{',
      '\t#TRANS 1930 {} 100.00',
      '}',
      '#VER A 2 20260115 "Giltig verifikation"',
      '{',
      '\t#TRANS 1930 {} 100.00',
      '}',
    ].join('\r\n')
    const result = parseSieFile(sieBuffer(sie))
    expect(result.verifications).toHaveLength(1)
    expect(result.verifications[0].sieNumber).toBe('2')
    expect(result.warnings.some(w => w.includes('datum'))).toBe(true)
  })
})

describe('parseSieFile — CP437-avkodning i praktiken', () => {
  it('ett bolagsnamn med å/ä/ö i #FNAMN avkodas korrekt från riktiga CP437-bytes', () => {
    const sie = [
      '#PROGRAM "Bokio" 1.0',
      '#FORMAT PC8',
      '#SIETYP 4',
      '#FNAMN "Åkeriet i Örebro AB"',
      '#RAR 0 20260101 20261231',
      '#KONTO 1930 "Bankkonto för överföring"',
    ].join('\r\n')
    const buffer = encodeCp437(sie).buffer
    const result = parseSieFile(buffer)
    expect(result.meta.companyName).toBe('Åkeriet i Örebro AB')
    expect(result.accounts[0].name).toBe('Bankkonto för överföring')
  })
})

describe('buildOpeningVerification — #IB → verklig öppningsverifikation', () => {
  it('returnerar null om det inte finns några ingående balanser för innevarande år', () => {
    expect(buildOpeningVerification([], '2026-01-01')).toBeNull()
    expect(buildOpeningVerification([{ fiscalYearIndex: -1, account: '1930', amount: 5000 }], '2026-01-01')).toBeNull()
  })

  it('bygger en balanserad verifikation från flera IB-rader (index 0 = innevarande år)', () => {
    const openingBalances = [
      { fiscalYearIndex: 0, account: '1930', amount: 5000 },
      { fiscalYearIndex: 0, account: '2081', amount: -5000 },
      { fiscalYearIndex: -1, account: '1930', amount: 3000 }, // föregående år, ska INTE tas med
    ]
    const ver = buildOpeningVerification(openingBalances, '2026-01-01')
    expect(ver.date).toBe('2026-01-01')
    expect(ver.description).toBe('Ingående balanser (SIE4-import)')
    expect(ver.status).toBe('booked')
    expect(ver.balanced).toBe(true)
    expect(ver.rows).toEqual([
      { account: '1930', accountName: '1930', debet: '5000.00', kredit: '0' },
      { account: '2081', accountName: '2081', debet: '0', kredit: '5000.00' },
    ])
  })

  it('flaggar (men tappar inte) en obalanserad #IB-uppsättning', () => {
    const openingBalances = [
      { fiscalYearIndex: 0, account: '1930', amount: 5000 },
      { fiscalYearIndex: 0, account: '2081', amount: -3000 },
    ]
    const ver = buildOpeningVerification(openingBalances, '2026-01-01')
    expect(ver.balanced).toBe(false)
  })

  it('slår upp kontonamn via accountsByCode när det ges', () => {
    const openingBalances = [{ fiscalYearIndex: 0, account: '1930', amount: 1000 }, { fiscalYearIndex: 0, account: '2081', amount: -1000 }]
    const accountsByCode = new Map([['1930', { code: '1930', name: 'Företagskonto' }]])
    const ver = buildOpeningVerification(openingBalances, '2026-01-01', { accountsByCode })
    expect(ver.rows[0].accountName).toBe('Företagskonto')
    expect(ver.rows[1].accountName).toBe('2081') // inget namn i mappen — kod som fallback
  })
})
