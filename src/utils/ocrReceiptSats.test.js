import { it, expect } from 'vitest';
import { parseReceiptText } from './ocrReceipt';
it('sats på varuraden', () => {
  const r = parseReceiptText('Elgiganten\n2026-05-26\n220282 25% 899.00\nPlayStation kontroll\nTotalt 899.00');
  expect(r.vatRate).toBe(25);
  expect(r.vatRateGuessed).toBe(false);
});
it('två olika satser på varuraderna är inte en läst sats', () => {
  const r = parseReceiptText('Coop\n2026-05-26\nMjölk 6% 18,90\nTvål 25% 29,90\nTotalt 48,80');
  expect(r.vatRateGuessed).toBe(true);
});
it('rabatt i procent är ingen momssats', () => {
  const r = parseReceiptText('Coop\n2026-05-26\nMjölk 18,90\nRabatt 25% -4,73\nTotalt 14,17');
  expect(r.vatRateGuessed).toBe(true);
});
