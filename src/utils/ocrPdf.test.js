import { describe, it, expect } from 'vitest';
import { pdfTextLooksUsable } from './ocrReceipt';

describe('pdfTextLooksUsable', () => {
  it('godtar en vanlig digital PDF-kvittotext', () => {
    expect(pdfTextLooksUsable('ICA Kvantum Bymarken\nDatum 2026-10-20\nTotalt 249,00 SEK\nVarav moms 25% 49,80')).toBe(true);
  });

  it('godtar hela kronor med valuta', () => {
    expect(pdfTextLooksUsable('Bymarkens Nagelstudio\nGellack 2026-10-20\nAtt betala 450 kr')).toBe(true);
    expect(pdfTextLooksUsable('Frisören på hörnet\nKlippning\nSumma 395:-')).toBe(true);
  });

  it('läser hellre bilden när textlagret bara är en vattenstämpel', () => {
    expect(pdfTextLooksUsable('Scanned with CamScanner')).toBe(false);
    expect(pdfTextLooksUsable('Skannad med Adobe Scan, sida 1 av 1')).toBe(false);
  });

  it('läser hellre bilden när typsnittet gav obegripliga tecken', () => {
    expect(pdfTextLooksUsable('  249,00 ')).toBe(false);
  });

  it('kräver mer än några tecken', () => {
    expect(pdfTextLooksUsable('')).toBe(false);
    expect(pdfTextLooksUsable('49,00')).toBe(false);
  });
});
