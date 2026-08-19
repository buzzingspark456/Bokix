import { describe, it, expect } from 'vitest'
import { generateSIE4 } from './sieExport'

const accounts = [
  { code: '1930', name: 'Företagskonto' },
  { code: '3001', name: 'Försäljning' },
]

describe('generateSIE4 — huvud', () => {
  it('innehåller de fasta SIE4-huvudfälten', () => {
    const sie = generateSIE4({ name: 'Test AB' }, [], [])
    expect(sie).toContain('#FLAGGA 0\r\n')
    expect(sie).toContain('#PROGRAM "Bokix" 1.0\r\n')
    expect(sie).toContain('#FORMAT PC8\r\n')
    expect(sie).toContain('#SIETYP 4\r\n')
    expect(sie).toContain('#FNAMN "Test AB"\r\n')
  })

  it('#GEN och #RAR använder dagens datum respektive innevarande kalenderår', () => {
    const sie = generateSIE4({ name: 'Test AB' }, [], [])
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const year = new Date().getFullYear()
    expect(sie).toContain(`#GEN ${today}\r\n`)
    expect(sie).toContain(`#RAR 0 ${year}0101 ${year}1231\r\n`)
  })

  it('faller tillbaka till "Okänt Företag" och utelämnar #ORGNR helt om företagsnamn/orgnr saknas', () => {
    const sie = generateSIE4({}, [], [])
    expect(sie).toContain('#FNAMN "Okänt Företag"\r\n')
    expect(sie).not.toContain('#ORGNR')
  })

  it('rensar orgnumret till bara siffror', () => {
    const sie = generateSIE4({ name: 'Test AB', orgNumber: '556677-8899' }, [], [])
    expect(sie).toContain('#ORGNR "5566778899"\r\n')
  })
})

describe('generateSIE4 — kontoplan', () => {
  it('skriver en #KONTO-rad per konto, i given ordning', () => {
    const sie = generateSIE4({ name: 'Test AB' }, accounts, [])
    expect(sie).toContain('#KONTO 1930 "Företagskonto"\r\n')
    expect(sie).toContain('#KONTO 3001 "Försäljning"\r\n')
    expect(sie.indexOf('#KONTO 1930')).toBeLessThan(sie.indexOf('#KONTO 3001'))
  })
})

describe('generateSIE4 — verifikationer', () => {
  it('exporterar en bokförd verifikation som #VER + #TRANS-block', () => {
    const verifications = [{
      status: 'booked', number: 'A-12', date: '2026-06-15', description: 'Försäljning kontant',
      rows: [
        { account: '1930', debet: 1000, kredit: 0 },
        { account: '3001', debet: 0, kredit: 1000 },
      ],
    }]
    const sie = generateSIE4({ name: 'Test AB' }, accounts, verifications)
    expect(sie).toContain('#VER A 12 20260615 "Försäljning kontant"\r\n')
    expect(sie).toContain('    #TRANS 1930 {} 1000.00\r\n')
    expect(sie).toContain('    #TRANS 3001 {} -1000.00\r\n')
  })

  it('hoppar över utkast helt', () => {
    const verifications = [{
      status: 'draft', number: '1', date: '2026-06-15', description: 'Ej bokförd',
      rows: [{ account: '1930', debet: 500, kredit: 0 }],
    }]
    const sie = generateSIE4({ name: 'Test AB' }, accounts, verifications)
    expect(sie).not.toContain('#VER')
    expect(sie).not.toContain('Ej bokförd')
  })

  it('behandlar en verifikation utan status som bokförd', () => {
    const verifications = [{
      number: '1', date: '2026-06-15', description: 'Utan statusfält',
      rows: [{ account: '1930', debet: 500, kredit: 0 }],
    }]
    const sie = generateSIE4({ name: 'Test AB' }, accounts, verifications)
    expect(sie).toContain('#VER A 1 20260615 "Utan statusfält"\r\n')
  })

  it('hoppar över rader med nettobelopp noll (t.ex. felaktigt dubblerade debet/kredit-rader)', () => {
    const verifications = [{
      status: 'booked', number: '1', date: '2026-06-15', description: 'Nollrad',
      rows: [{ account: '1930', debet: 500, kredit: 500 }],
    }]
    const sie = generateSIE4({ name: 'Test AB' }, accounts, verifications)
    expect(sie).not.toContain('#TRANS')
  })

  it('exporterar flera verifikationer som separata block i ordning', () => {
    const verifications = [
      { status: 'booked', number: '1', date: '2026-06-01', description: 'Första', rows: [{ account: '1930', debet: 100, kredit: 0 }] },
      { status: 'booked', number: '2', date: '2026-06-02', description: 'Andra', rows: [{ account: '1930', debet: 200, kredit: 0 }] },
    ]
    const sie = generateSIE4({ name: 'Test AB' }, accounts, verifications)
    expect(sie.indexOf('#VER A 1 ')).toBeLessThan(sie.indexOf('#VER A 2 '))
  })
})
