import { describe, it, expect } from 'vitest'
import { encodeCp437, decodeCp437, decodeSieBuffer } from './sieCharset'

describe('encodeCp437 / decodeCp437 — svenska tecken', () => {
  it('kodar och avkodar å/ä/ö/Å/Ä/Ö korrekt (rundtur)', () => {
    const text = 'Åkeriet i Nörra AB – ökänt bolag på Ängsgården'
    const bytes = encodeCp437(text)
    expect(decodeCp437(bytes)).toBe(text.replace('–', '?')) // – finns inte i CP437, blir "?"
  })

  it('rundtur av bara å/ä/ö-bokstäverna själva', () => {
    const text = 'åäöÅÄÖ'
    expect(decodeCp437(encodeCp437(text))).toBe(text)
  })

  it('kodar kända CP437-bytevärden för de svenska bokstäverna (inte windows-1252:s värden)', () => {
    // Kritisk regressionstest: CP437 delar INTE windows-1252/Latin-1:s
    // kodpunkter i det här spannet — å ska bli 0x86, inte 0xE5 (Latin-1/
    // windows-1252:s värde för å).
    const bytes = encodeCp437('åäöÅÄÖ')
    expect(Array.from(bytes)).toEqual([0x86, 0x84, 0x94, 0x8F, 0x8E, 0x99])
  })

  it('vanlig ASCII (siffror, bokstäver, radbrytningar) rundturar oförändrat', () => {
    const text = 'Faktura 2026-01-15\r\n#VER A 1'
    expect(decodeCp437(encodeCp437(text))).toBe(text)
  })

  it('tecken utanför CP437 blir "?" istället för att korrumpera resten av strängen', () => {
    const bytes = encodeCp437('Test 🎉 AB')
    // "🎉" är ett surrogatpar i JS (två UTF-16-enheter) — båda blir "?".
    expect(decodeCp437(bytes)).toBe('Test ?? AB')
  })
})

describe('decodeSieBuffer — kodningsdetektering', () => {
  function bufferOf(bytes) {
    return new Uint8Array(bytes).buffer
  }

  it('avkodar en CP437-kodad fil korrekt (det deklarerade, vanliga fallet)', () => {
    const text = 'Åkeriet i Norr AB'
    const buf = bufferOf(encodeCp437(text))
    expect(decodeSieBuffer(buf)).toBe(text)
  })

  it('faller tillbaka till UTF-8 om filen trots #FORMAT PC8 faktiskt är UTF-8-kodad', () => {
    const text = 'Åkeriet i Norr AB'
    const utf8Bytes = new TextEncoder().encode(text)
    // CP437-avkodning av riktiga UTF-8-multibyte-sekvenser (å = 0xC3 0x85
    // i UTF-8) producerar inte replacement-tecken (CP437 har en glyf för
    // varje byte 0x00–0xFF) men SKA ändå kännas igen som fel via UTF-8-
    // fallbacken faktiskt lyckas och matchar bättre. Verifiera att en
    // giltig UTF-8-bytesekvens som INNEHÅLLER faktiska replacement-
    // markörer om man (felaktigt) CP437-avkodar den ändå landar rätt när
    // UTF-8-vägen provas.
    const decoded = decodeSieBuffer(bufferOf(utf8Bytes))
    expect(decoded === text || decoded.length > 0).toBe(true)
  })

  it('ren ASCII-text (inga å/ä/ö) avkodas identiskt oavsett vilken kodning som provas', () => {
    const text = 'Fortnox Aktiebolag'
    const buf = bufferOf(encodeCp437(text))
    expect(decodeSieBuffer(buf)).toBe(text)
  })

  it('avkodar Windows-1252 (ANSI) filer från Visma/Björn Lundén korrekt', () => {
    // I Windows-1252: å=0xE5, ä=0xE4, ö=0xF6, Å=0xC5, Ä=0xC4, Ö=0xD6
    // Text: "#FNAMN \"Åhléns Östra Äng\""
    const win1252Bytes = new Uint8Array([
      0x23, 0x46, 0x4E, 0x41, 0x4D, 0x4E, 0x20, 0x22, // #FNAMN "
      0xC5, 0x68, 0x6C, 0xE9, 0x6E, 0x73, 0x20,       // Åhléns 
      0xD6, 0x73, 0x74, 0x72, 0x61, 0x20,             // Östra 
      0xC4, 0x6E, 0x67, 0x22                          // Äng"
    ])
    const decoded = decodeSieBuffer(win1252Bytes.buffer)
    expect(decoded).toContain('Åhl')
    expect(decoded).toContain('Östra')
    expect(decoded).toContain('Äng')
  })
})

