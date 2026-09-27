import { describe, it, expect } from 'vitest';
import { foreignSaleRegion, rowsForCustomer, foreignSaleNote } from './foreignSales';
import { invoiceBookingRows } from './invoiceBooking';
import { computeVatPeriod, roundedVatPeriod } from './vatCalculation';
import { REVENUE_ACCOUNTS, VAT_ACCOUNTS } from '../components/AccountsData';

const euCustomer = { customerType: 'eu_company', vatNumber: 'DE123456789' };
const nonEuCustomer = { customerType: 'non_eu_company' };
const swede = { customerType: 'se_company' };
const row = (over = {}) => ({ description: 'Konsulttimmar', qty: 10, unitPrice: 1000, vatRate: 25, discount: 0, account: '3001', ...over });

describe('kund utomlands', () => {
  it('EU-företag utan momsnummer får svensk moms', () => {
    expect(foreignSaleRegion({ customerType: 'eu_company', vatNumber: ' ' })).toBeNull();
    expect(foreignSaleRegion(euCustomer)).toBe('eu');
    expect(foreignSaleRegion(nonEuCustomer)).toBe('nonEu');
    expect(foreignSaleRegion(swede)).toBeNull();
  });

  it('raderna får 0 % och tjänstekontot, varukontot behålls, och tillbaka vid svensk kund', () => {
    const eu = rowsForCustomer([row(), row({ account: '3108' })], euCustomer);
    expect(eu.map(r => [r.vatRate, r.account])).toEqual([[0, '3308'], [0, '3108']]);
    expect(rowsForCustomer([row()], nonEuCustomer)[0].account).toBe('3305');
    const back = rowsForCustomer(eu, swede);
    expect(back.map(r => [r.vatRate, r.account])).toEqual([[25, '3001'], [25, '3001']]);
    const untouched = rowsForCustomer([row({ account: '3041', vatRate: 12 })], swede);
    expect(untouched[0]).toMatchObject({ account: '3041', vatRate: 12 });
  });

  it('fakturatexten följer varor och tjänster, och saknas om någon rad har moms', () => {
    expect(foreignSaleNote(euCustomer, [row({ vatRate: 0, account: '3308' })])).toMatch(/Omvänd betalningsskyldighet/);
    const both = foreignSaleNote(euCustomer, [row({ vatRate: 0, account: '3308' }), row({ vatRate: 0, account: '3108' })]);
    expect(both).toMatch(/artikel 196/);
    expect(both).toMatch(/artikel 138/);
    expect(foreignSaleNote(euCustomer, [row()])).toBeNull();
    expect(foreignSaleNote(swede, [row({ vatRate: 0 })])).toBeNull();
  });
});

describe('bokföringen av en faktura till utlandet', () => {
  it('bokas på 3308 utan moms och hamnar i ruta 39', () => {
    const rows = invoiceBookingRows(rowsForCustomer([row()], euCustomer), { revenueAccounts: REVENUE_ACCOUNTS, vatAccounts: VAT_ACCOUNTS });
    expect(rows).toEqual([{ account: '1510', debet: 10000, kredit: 0 }, { account: '3308', debet: 0, kredit: 10000 }]);
    const r = roundedVatPeriod(computeVatPeriod({ verifications: [{ id: 'f', date: '2026-08-01', rows }], periodStart: '2026-07-01', periodEnd: '2026-09-30' }));
    expect(r.exemptSalesByRuta['39']).toBe(10000);
    expect(r.netToPay).toBe(0);
  });

  it('en vanlig svensk faktura bokas som förut', () => {
    const rows = invoiceBookingRows([row(), row({ vatRate: 12, account: '3002' })], { revenueAccounts: REVENUE_ACCOUNTS, vatAccounts: VAT_ACCOUNTS });
    expect(rows).toEqual([
      { account: '1510', debet: 23700, kredit: 0 },
      { account: '3001', debet: 0, kredit: 10000 },
      { account: '3002', debet: 0, kredit: 10000 },
      { account: '2621', debet: 0, kredit: 1200 },
      { account: '2611', debet: 0, kredit: 2500 },
    ]);
  });
});
