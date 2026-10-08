import { describe, it, expect } from 'vitest';
import { suggestMatch, findSureMatches } from './bankMatching.js';

const inv = (id, amount, extra = {}) => ({ id, invoiceNumber: id, status: 'sent', amount, ...extra });
const row = (id, amount, description = '', extra = {}) => ({ id, amount, description, status: 'unmatched', ...extra });

describe('suggestMatch', () => {
  it('ett unikt belopp är säkert', () => {
    const m = suggestMatch(row('b1', 1250), { invoices: [inv('1001', 1250), inv('1002', 900)] });
    expect(m).toMatchObject({ id: '1001', sure: true, type: 'invoice' });
  });
  it('två fakturor på samma belopp är inte säkert, om inte numret står i texten', () => {
    const invoices = [inv('1001', 500), inv('1002', 500)];
    expect(suggestMatch(row('b1', 500, 'Swish Anna'), { invoices }).sure).toBe(false);
    expect(suggestMatch(row('b1', 500, 'Betalning faktura 1002'), { invoices })).toMatchObject({ id: '1002', sure: true });
  });
  it('ett fakturanummer inuti ett datum räknas inte', () => {
    const invoices = [inv('1001', 500), inv('1012', 500)];
    expect(suggestMatch(row('b1', 500, 'Swish 20261012 2026-10-12'), { invoices }).sure).toBe(false);
  });
  it('leverantörsfaktura matchas på OCR', () => {
    const expenses = [
      { id: 'e1', type: 'supplier_invoice', status: 'unpaid', amount: 300, ocrNumber: '7788991' },
      { id: 'e2', type: 'supplier_invoice', status: 'unpaid', amount: 300, ocrNumber: '1122334' },
    ];
    expect(suggestMatch(row('b1', -300, 'BG 1122334'), { expenses })).toMatchObject({ id: 'e2', sure: true, type: 'supplier_invoice' });
  });
  it('betalda fakturor och utkast hoppas över', () => {
    expect(suggestMatch(row('b1', 100), { invoices: [inv('1', 100, { status: 'paid' }), inv('2', 100, { status: 'draft' })] })).toBeNull();
  });
});

describe('findSureMatches', () => {
  it('samma faktura säker för två rader ger ingen av dem', () => {
    const invoices = [inv('1001', 700)];
    expect(findSureMatches([row('b1', 700), row('b2', 700)], { invoices })).toHaveLength(0);
  });
  it('tar bara ohanterade rader', () => {
    const invoices = [inv('1001', 700)];
    expect(findSureMatches([row('b1', 700, '', { status: 'booked' })], { invoices })).toHaveLength(0);
    expect(findSureMatches([row('b1', 700)], { invoices })).toHaveLength(1);
  });
});
