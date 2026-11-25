import { describe, it, expect } from 'vitest';
import fs from 'fs';
import { analyzeReceipt, buildReceiptPlan } from './receiptScan';

// En riktig kontantfaktura (2026-11-03) med alla namn, nummer och adresser utbytta.
// Google läste den kolumnvis: beloppet blev exkl. moms, momsen underlaget
// inom parentes, fakturanumret saknades och kontot blev Fraktkostnader.
describe.each(['kapellfirman-vision', 'kapellfirman-pdf'])('%s', (fil) => {
  const text = fs.readFileSync(`src/utils/__fixtures__/${fil}.txt`, 'utf8');
  it('ger allt som står på fakturan', async () => {
    const a = await analyzeReceipt({ text });
    const r = a.parsed;
    expect(r.supplier.toLowerCase()).toMatch(/^kapellfirman/);
    expect(r.date).toBe('2026-10-12');
    expect(r.receiptNumber).toBe('462');
    expect(r.amount).toBe(4732);
    expect(r.amountGuessed).toBe(false);
    expect(r.vatRate).toBe(25);
    expect(r.vatAmount).toBe(946.43);
    expect(r.vatVerified).toBe(true);
    expect(a.details.ocrNumber).toBe('46250');
    expect(a.details.bankgiro).toBe('991-2346');
    expect(a.details.orgNr).toBe('556036-0793');
  });
  it('föreslår inget konto', async () => {
    const a = await analyzeReceipt({ text });
    const step = buildReceiptPlan(a, null).find(s => s.key === 'costAccount');
    expect(step.found).toBe(false);
    expect(step.suggest).toBeNull();
  });
});
