import { describe, it, expect } from 'vitest';
import { receiptAttachmentFields, backfillReceiptAttachments } from './receiptAttachment';

const exp = { id: 'exp_1', receiptUrl: 'https://x.supabase.co/storage/v1/object/receipts/u/1789_h30c7u.jpeg', receiptType: 'image/jpeg' };

describe('receiptAttachment', () => {
  it('ger underlagsfälten ur kvittot', () => {
    expect(receiptAttachmentFields(exp)).toEqual({ attachmentUrl: exp.receiptUrl, attachmentName: '1789_h30c7u.jpeg', attachmentType: 'image/jpeg' });
    expect(receiptAttachmentFields({ id: 'x' })).toEqual({});
  });

  it('kopplar kvittot till bokförda verifikationer utan underlag', () => {
    const vers = [
      { id: 'v1', source: 'expense', sourceId: 'exp_1', rows: [] },
      { id: 'v2', source: 'manual', rows: [] },
      { id: 'v3', source: 'expense', sourceId: 'exp_1', attachmentUrl: 'egen.pdf', rows: [] },
    ];
    const out = backfillReceiptAttachments(vers, [exp]);
    expect(out[0].attachmentUrl).toBe(exp.receiptUrl);
    expect(out[0].rows).toBe(vers[0].rows);
    expect(out[1]).toBe(vers[1]);
    expect(out[2].attachmentUrl).toBe('egen.pdf');
  });

  it('ger samma array när inget ändras', () => {
    const vers = [{ id: 'v2', source: 'manual', rows: [] }];
    expect(backfillReceiptAttachments(vers, [exp])).toBe(vers);
  });
});
