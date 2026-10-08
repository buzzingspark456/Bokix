import { describe, it, expect } from 'vitest';
import { buyerId, rotRutAmounts, rotRutInvoiceErrors, rotRutBatchErrors, buildRotRutXml } from './rotRutRequest';
import { invoiceCustomerDue, invoiceCustomerRemaining } from './rotRutConfig';

const customer = { id: 'c1', name: 'Anna Andersson', orgNr: '19960410-2393', customerType: 'se_individual' };
const rows = [
  { qty: 8, unitPrice: 400, vatRate: 25, rotRutLabor: true },   // 4 000 inkl. moms
  { qty: 1, unitPrice: 800, vatRate: 25, rotRutLabor: false },  // material 1 000
];
const rutInvoice = {
  id: 'i1', invoiceNumber: '1001', customerId: 'c1', rows, rotRutType: 'rut',
  rotRutWorkType: 'Stadning', rotRutHours: 8, status: 'paid', paidDate: '2026-03-02', paidAmount: 3000,
};

describe('buyerId', () => {
  it('lämnar tolv siffror orörda och lägger till sekel på tio', () => {
    expect(buyerId('19960410-2393')).toBe('199604102393');
    expect(buyerId('960410-2393', 2026)).toBe('199604102393');
    expect(buyerId('100410-2393', 2026)).toBe('201004102393');
    expect(buyerId('200410+2393', 2026)).toBe('192004102393');
    expect(buyerId('123')).toBe('');
  });
});

describe('belopp', () => {
  it('räknar arbete, material, avdrag och betalt i hela kronor', () => {
    expect(rotRutAmounts(rutInvoice)).toEqual({ labor: 4000, material: 1000, deduction: 2000, paid: 2000 });
  });
  it('kunden betalar fakturan minus avdraget, hela om begäran avslagits', () => {
    expect(invoiceCustomerDue(rutInvoice)).toBe(3000);
    expect(invoiceCustomerRemaining(rutInvoice)).toBe(0);
    expect(invoiceCustomerDue({ ...rutInvoice, rotRutStatus: 'rejected' })).toBe(5000);
    expect(invoiceCustomerDue({ rows })).toBe(5000);
  });
});

describe('kontroller', () => {
  const opts = { today: '2026-10-07', company: { orgNr: '559000-0000' } };
  it('godkänner en komplett betald RUT-faktura', () => {
    expect(rotRutInvoiceErrors(rutInvoice, customer, opts)).toEqual([]);
  });
  it('kräver betald faktura, timmar, arbetstyp och personnummer', () => {
    const keys = rotRutInvoiceErrors({ ...rutInvoice, status: 'sent', rotRutHours: '', rotRutWorkType: '' }, { ...customer, orgNr: '' }, opts).map(e => e.key);
    expect(keys).toEqual(expect.arrayContaining(['notPaid', 'noPnr', 'noWorkType']));
    expect(rotRutInvoiceErrors({ ...rutInvoice, rotRutHours: '' }, customer, opts).map(e => e.key)).toEqual(['noHours']);
  });
  it('ROT kräver fastighetsbeteckning eller BRF och lägenhet', () => {
    const rot = { ...rutInvoice, rotRutType: 'rot', rotRutWorkType: 'Bygg' };
    expect(rotRutInvoiceErrors(rot, customer, opts).map(e => e.key)).toEqual(['noProperty']);
    expect(rotRutInvoiceErrors({ ...rot, rotRutProperty: 'Skellefteå Moro 1:7' }, customer, opts)).toEqual([]);
    expect(rotRutInvoiceErrors({ ...rot, rotRutBrfOrgNr: '769600-0000', rotRutApartment: '1102' }, customer, opts)).toEqual([]);
  });
  it('schablontjänst behöver inga timmar', () => {
    expect(rotRutInvoiceErrors({ ...rutInvoice, rotRutWorkType: 'TvattVidTvattinrattning', rotRutHours: '' }, customer, opts)).toEqual([]);
  });
  it('köparen ska vara minst 18 år', () => {
    expect(rotRutInvoiceErrors(rutInvoice, { ...customer, orgNr: '20100410-2396' }, opts).map(e => e.key)).toContain('under18');
  });
  it('flaggar blandade år och taket per person', () => {
    const big = { ...rutInvoice, id: 'i2', rows: [{ qty: 1, unitPrice: 128000, vatRate: 25, rotRutLabor: true }] };
    const keys = rotRutBatchErrors([rutInvoice, big, { ...rutInvoice, id: 'i3', paidDate: '2025-12-30' }], [], [customer]).map(e => e.key);
    expect(keys).toEqual(expect.arrayContaining(['mixedYears', 'combinedCap']));
  });
});

describe('XML', () => {
  it('följer Skatteverkets exempelfil för RUT', () => {
    const xml = buildRotRutXml({ type: 'rut', name: 'Bokix mars', invoices: [rutInvoice], contacts: [customer] });
    expect(xml).toContain('<ns2:HushallBegaran>');
    expect(xml).toContain('<ns2:Kopare>199604102393</ns2:Kopare>');
    expect(xml).toContain('<ns2:PrisForArbete>4000</ns2:PrisForArbete>');
    expect(xml).toContain('<ns2:BetaltBelopp>2000</ns2:BetaltBelopp>');
    expect(xml).toContain('<ns2:BegartBelopp>2000</ns2:BegartBelopp>');
    expect(xml).toContain('<ns2:Stadning><ns2:AntalTimmar>8</ns2:AntalTimmar><ns2:Materialkostnad>1000</ns2:Materialkostnad></ns2:Stadning>');
  });
  it('ROT med BRF skriver lägenhet före org.nr', () => {
    const xml = buildRotRutXml({ type: 'rot', name: 'R', contacts: [customer], invoices: [{ ...rutInvoice, rotRutType: 'rot', rotRutWorkType: 'Vvs', rotRutBrfOrgNr: '769600-0000', rotRutApartment: '1102' }] });
    expect(xml).toMatch(/<ns2:LagenhetsNr>1102<\/ns2:LagenhetsNr>\s*<ns2:BrfOrgNr>7696000000<\/ns2:BrfOrgNr>\s*<ns2:UtfortArbete>/);
    expect(xml).toContain('<ns2:RotBegaran>');
  });
});
