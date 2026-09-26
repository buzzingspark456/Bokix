import { describe, it, expect } from 'vitest';
import { parseAttachmentFileName, matchAttachments, importedFiscalYears, buildAttachmentUpdates } from './sieAttachments';

describe('parseAttachmentFileName', () => {
  it('läser verifikatnumret ur de vanliga namnformerna', () => {
    expect(parseAttachmentFileName('A31_abc123.pdf')).toEqual({ year: null, series: 'A', number: 31 });
    expect(parseAttachmentFileName('A31.pdf')).toEqual({ year: null, series: 'A', number: 31 });
    expect(parseAttachmentFileName('A-31 kvitto.pdf')).toEqual({ year: null, series: 'A', number: 31 });
    expect(parseAttachmentFileName('2024-A-31.pdf')).toEqual({ year: 2024, series: 'A', number: 31 });
    expect(parseAttachmentFileName('b 007.JPG')).toEqual({ year: null, series: 'B', number: 7 });
    expect(parseAttachmentFileName('underlag/A31.pdf')).toEqual({ year: null, series: 'A', number: 31 });
  });
  it('hittar inget nummer i vanliga filnamn', () => {
    expect(parseAttachmentFileName('kvitto.pdf')).toBeNull();
    expect(parseAttachmentFileName('IMG_2024.jpg')).toBeNull();
  });
});

const file = (name) => ({ name, type: 'application/pdf' });
const ver = (id, series, sieNumber, date, extra = {}) => ({ id, series, sieNumber: String(sieNumber), date, source: 'sie_import_fil_20250101', ...extra });

describe('matchAttachments', () => {
  const verifications = [
    ver('1', 'A', 31, '2024-03-02'),
    ver('2', 'A', 31, '2025-03-02'),
    ver('3', 'B', 4, '2024-05-01', { attachmentName: 'B4.pdf', attachmentUrl: 'u' }),
    { id: '4', series: 'A', number: 'A001', date: '2024-01-01' },
  ];

  it('kopplar bara inom valt räkenskapsår', () => {
    const rows = matchAttachments([file('A31.pdf')], verifications, { fiscalYearStart: '2024-01-01', companyFiscalYear: '2024-01-01' });
    expect(rows[0]).toMatchObject({ status: 'match', ref: 'A31' });
    expect(rows[0].verification.id).toBe('1');
  });

  it('ger tydliga skäl när en fil inte kopplas', () => {
    const rows = matchAttachments(
      [file('A99.pdf'), file('kvitto.pdf'), file('A31.docx'), file('2025-A-31.pdf'), file('B4.pdf'), file('.DS_Store')],
      verifications,
      { fiscalYearStart: '2024-01-01', companyFiscalYear: '2024-01-01' },
    );
    const byName = Object.fromEntries(rows.map(r => [r.name, r.status]));
    expect(byName).toEqual({
      'A99.pdf': 'not-found', 'kvitto.pdf': 'no-number', 'A31.docx': 'unsupported',
      '2025-A-31.pdf': 'other-year', 'B4.pdf': 'attached',
    });
  });

  it('räknar räkenskapsår ur sparad #RAR-start när den finns', () => {
    const brutet = [ver('x', 'A', 1, '2024-08-01', { sieFiscalYearStart: '2024-07-01', sieFiscalYearEnd: '2025-06-30' })];
    expect(importedFiscalYears(brutet, '2024-01-01')).toEqual([{ start: '2024-07-01', end: '2025-06-30', count: 1, label: '2024/2025' }]);
    expect(importedFiscalYears(verifications, '2024-01-01').map(y => y.label)).toEqual(['2025', '2024']);
  });
});

describe('buildAttachmentUpdates', () => {
  it('första filen blir underlaget, resten extra underlag', () => {
    const updates = buildAttachmentUpdates([
      { verificationId: '1', url: 'a', name: 'A31.pdf', type: 'application/pdf' },
      { verificationId: '1', url: 'b', name: 'A31_2.pdf', type: 'application/pdf' },
      { verificationId: '3', url: 'c', name: 'B4_2.pdf', type: 'application/pdf' },
    ], [{ id: '1' }, { id: '3', attachmentUrl: 'u', attachmentName: 'B4.pdf' }]);
    expect(updates).toEqual([
      { id: '1', attachmentUrl: 'a', attachmentName: 'A31.pdf', attachmentType: 'application/pdf', extraAttachments: [{ url: 'b', name: 'A31_2.pdf', type: 'application/pdf' }] },
      { id: '3', attachmentUrl: 'u', attachmentName: 'B4.pdf', attachmentType: null, extraAttachments: [{ url: 'c', name: 'B4_2.pdf', type: 'application/pdf' }] },
    ]);
  });
});
