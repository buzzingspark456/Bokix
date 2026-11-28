import { describe, it, expect } from 'vitest';
import { topupsThisMonth, forgetTopups, OCR_TOPUP } from './_ocrTopups.js';

const fakeStripe = (items) => ({ invoiceItems: { list: async () => ({ data: items, has_more: false }) } });

describe('topupsThisMonth', () => {
  const now = new Date('2026-11-28T12:00:00Z');
  it('räknar bara månadens köp för rätt företag', async () => {
    const items = [
      { metadata: { bokix_ocr_month: '2026-11', bokix_company: 'f1' } },
      { metadata: { bokix_ocr_month: '2026-11', bokix_company: 'f1' } },
      { metadata: { bokix_ocr_month: '2026-10', bokix_company: 'f1' } },
      { metadata: { bokix_ocr_month: '2026-11', bokix_company: 'f2' } },
      { metadata: {} },
    ];
    forgetTopups('cus_a', 'f1', now);
    expect(await topupsThisMonth(fakeStripe(items), 'cus_a', 'f1', now)).toBe(2);
  });
  it('kontots företag utan nyckel räknas som tom sträng', async () => {
    forgetTopups('cus_b', '', now);
    expect(await topupsThisMonth(fakeStripe([{ metadata: { bokix_ocr_month: '2026-11' } }]), 'cus_b', '', now)).toBe(1);
  });
  it('utan kund blir det noll', async () => {
    expect(await topupsThisMonth(fakeStripe([]), null, 'f1', now)).toBe(0);
  });
  it('ett paket är 100 avläsningar för 25 kr', () => {
    expect(OCR_TOPUP).toEqual({ reads: 100, ore: 2500 });
  });
});
