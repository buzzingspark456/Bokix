import { describe, it, expect } from 'vitest';
import { needsUnderlagWork, underlagStep, missingUnderlag } from './underlagStep';

describe('underlagStep', () => {
  const booked = [{ id: 'a', type: 'receipt', supplier: 'Telia', amount: 299, costAccount: '6212' }];

  it('saknar leverantör eller belopp: hör hemma i Underlag', () => {
    expect(needsUnderlagWork({ supplier: '', amount: 100 })).toBe(true);
    expect(needsUnderlagWork({ supplier: 'Telia', amount: 0 })).toBe(true);
    expect(needsUnderlagWork({ supplier: 'Telia', amount: 299 })).toBe(false);
    expect(needsUnderlagWork({ supplier: '', amount: 0, costAccount: '6212' })).toBe(false);
  });

  it('säger vad som återstår', () => {
    expect(underlagStep({ type: 'receipt' }, booked)).toBe('read');
    expect(underlagStep({ type: 'receipt', ocrDraft: {} }, booked)).toBe('fill');
    expect(underlagStep({ type: 'receipt', supplier: 'Telia', amount: 299 }, booked)).toBe('ready');
    expect(underlagStep({ type: 'receipt', supplier: 'Ny butik', amount: 50 }, booked)).toBe('account');
    expect(underlagStep(booked[0], booked)).toBe(null);
  });
});

describe('missingUnderlag', () => {
  const vers = [
    { id: 1, number: 'A1', date: '2026-01-10', description: 'Hyra', rows: [{ account: '5010', debit: 1000 }, { account: '1930', credit: 1000 }] },
    { id: 2, number: 'A2', date: '2026-02-10', description: 'Med fil', attachmentUrl: 'x', rows: [] },
    { id: 3, number: 'A3', date: '2026-03-10', description: 'Papper', originalLocation: 'Papper', rows: [] },
    { id: 4, number: 'A4', date: '2026-04-10', description: 'Utkast', status: 'draft', rows: [] },
    { id: 5, number: 'F1', date: '2026-05-10', source: 'invoice', rows: [] },
    { id: 6, number: 'A5', date: '2025-01-10', description: 'Gammal', rows: [{ debet: '250' }] },
  ];

  it('bara bokförda utan underlag, nyast först, med belopp', () => {
    const r = missingUnderlag(vers);
    expect(r.map(x => x.v.id)).toEqual([1, 6]);
    expect(r[0].amount).toBe(1000);
    expect(r[1].amount).toBe(250);
  });

  it('since begränsar till ett datum och framåt', () => {
    expect(missingUnderlag(vers, '2026-01-01').map(x => x.v.id)).toEqual([1]);
  });
});
