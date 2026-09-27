import { describe, it, expect } from 'vitest';
import { ecPeriod, ecDeadline, computeEcSalesList, generateEcSalesListFile, sellerVatNumber } from './ecSalesList';
import { invoiceBookingRows } from './invoiceBooking';

const contacts = [
  { id: 'de', name: 'Beispiel GmbH', customerType: 'eu_company', vatNumber: 'DE 262875793' },
  { id: 'fi', name: 'Esimerkki Oy', customerType: 'eu_company', vatNumber: 'FI01409351' },
  { id: 'nov', name: 'Utan nummer', customerType: 'eu_company', vatNumber: '' },
];
const inv = (id, customerId, date, rows, over = {}) => ({ id, invoiceNumber: id, customerId, date, status: 'sent', type: 'invoice', rows, ...over });
const row = (account, qty, unitPrice) => ({ account, qty, unitPrice, vatRate: 0, discount: 0 });

describe('perioder och frist', () => {
  it('månad och kvartal med Skatteverkets koder', () => {
    expect(ecPeriod(2026, 9)).toMatchObject({ start: '2026-09-01', end: '2026-09-30', code: '2609' });
    expect(ecPeriod(2026, 'Q4')).toMatchObject({ start: '2026-10-01', end: '2026-12-31', code: '26-4' });
    expect(ecDeadline(ecPeriod(2026, 'Q4'))).toBe('2027-01-25');
    expect(ecDeadline(ecPeriod(2026, 9))).toBe('2026-10-25');
  });

  it('säljarens momsnummer', () => {
    expect(sellerVatNumber({ orgNr: '556000-0167' })).toBe('556000016701');
    expect(sellerVatNumber({ vatNr: 'SE556000016701' })).toBe('556000016701');
  });
});

describe('sammanställningen', () => {
  const invoices = [
    inv('1', 'de', '2026-07-10', [row('3308', 10, 1000)]),
    inv('2', 'de', '2026-08-10', [row('3108', 1, 5000), row('3308', 2, 500)]),
    inv('3', 'fi', '2026-09-01', [row('3108', 1, 100)], { currency: 'EUR', fxRate: 11.5 }),
    inv('4', 'fi', '2026-09-02', [row('3308', 1, 1000)], { status: 'draft' }),
    inv('5', 'nov', '2026-09-03', [row('3308', 1, 1000)]),
    inv('6', 'de', '2026-10-01', [row('3308', 1, 1000)]),
  ];
  const list = computeEcSalesList({ invoices, contacts, period: ecPeriod(2026, 'Q3') });

  it('en rad per köpare, varor och tjänster för sig, i kronor', () => {
    expect(list.rows).toEqual([
      { vatNumber: 'DE262875793', name: 'Beispiel GmbH', goods: 5000, services: 11000 },
      { vatNumber: 'FI01409351', name: 'Esimerkki Oy', goods: 1150, services: 0 },
    ]);
  });

  it('varnar för kund utan momsnummer, utkast räknas inte', () => {
    expect(list.warnings.join(' ')).toMatch(/Utan nummer/);
  });

  it('filen följer Skatteverkets format', () => {
    const file = generateEcSalesListFile({ company: { orgNr: '5560000167' }, period: ecPeriod(2026, 'Q3'), list, contact: { name: 'Per Persson', phone: '0123-45690', email: 'post@exempel.se' } });
    expect(file.split('\r\n')).toEqual([
      'SKV574008;',
      '556000016701;26-3;Per Persson;0123-45690;post@exempel.se',
      'DE262875793;5000;;11000;',
      'FI01409351;1150;;;',
      '',
    ]);
  });
});

describe('faktura i annan valuta', () => {
  it('bokförs i kronor med fakturans kurs', () => {
    const rows = invoiceBookingRows([{ account: '3308', qty: 1, unitPrice: 100, vatRate: 0 }], { revenueAccounts: { 25: '3001', 0: '3004' }, vatAccounts: {}, rate: 11.5 });
    expect(rows).toEqual([{ account: '1510', debet: 1150, kredit: 0 }, { account: '3308', debet: 0, kredit: 1150 }]);
  });
});
