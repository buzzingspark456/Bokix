import { describe, it, expect } from 'vitest';
import { looksLikeTwoReceipts } from './ocrReceipt';
import { analyzeReceipt, buildReceiptPlan } from './receiptScan';

// Två butikskvitton bredvid varandra, i Googles läsordning (vart kvitto för sig).
const TWO = `Butik Ett
Org nr: 556036-0793
2026-09-23 13:22
Kvitto 2190100884216
Butik Två
23/09/26 13:30
Fotoram 15,00
Summa 15,00
Moms 25% 3,00
VÄLKOMMEN
ÅTER!
Läsk 24,00
Totalt 24,00
Moms 6% 1,36
Mastercard 24,00
2026-09-23 13:22
Välkommen åter!`;

const ONE = `Butik Ett
Org nr: 556036-0793
2026-09-23 13:22
Kvitto 2190100884216
Läsk 24,00
Totalt 24,00
Moms 6% 1,36
Kortköp 2026-09-23 13:22
Välkommen åter!`;

describe('två kvitton i samma foto', () => {
  it('känns igen', () => {
    expect(looksLikeTwoReceipts(TWO)).toBe(true);
  });

  it('ett kvitto med kortslip vid samma tid är ett kvitto', () => {
    expect(looksLikeTwoReceipts(ONE)).toBe(false);
  });

  it('en faktura med två datum utan klockslag är ett dokument', () => {
    expect(looksLikeTwoReceipts('Fakturadatum 2026-03-01\nFörfallodatum 2026-03-31\nOrg.nr 556036-0793')).toBe(false);
  });

  it('inget fylls i och rådet säger varför', async () => {
    const a = await analyzeReceipt({ text: TWO });
    expect(a.parsed.notReceipt).toBe(true);
    expect(a.parsed.unreadable).toBe(true);
    expect(a.hint).toBe('multiple');
    expect(buildReceiptPlan(a).every(p => !p.found)).toBe(true);
  });

  it('ett vanligt kvitto läses som förut', async () => {
    const a = await analyzeReceipt({ text: ONE });
    expect(a.parsed.notReceipt).toBe(false);
    expect(a.parsed.amount).toBe(24);
  });
});
