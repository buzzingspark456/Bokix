import { describe, it, expect } from 'vitest';
import { parseBookingCsv, groupBookingsByDay, buyerTotals, parseAmount, parseDate, bookingTemplateCsv } from './bookingImport';
import { parsePayrollHours } from './payrollHoursImport';
import { buildRotRutXml, casesBatchErrors, splitIntoFiles } from './rotRutRequest';
import { invoiceBookingRows } from './invoiceBooking';

const opts = { type: 'rut', defaultWorkType: 'Stadning', today: '2026-10-07' };

describe('belopp och datum', () => {
  it('läser svenska och engelska belopp', () => {
    expect(parseAmount('1 234,50')).toBe(1234.5);
    expect(parseAmount('1,234.50')).toBe(1234.5);
    expect(parseAmount('956 kr')).toBe(956);
    expect(parseAmount('')).toBe(null);
    expect(parseAmount('abc')).toBeNaN();
  });
  it('läser datum med klockslag', () => {
    expect(parseDate('2026-10-07 14:30')).toBe('2026-10-07');
    expect(parseDate('2026-10-07T14:30:00Z')).toBe('2026-10-07');
    expect(parseDate('2026-02-30')).toBe(null);
    expect(parseDate('7/10/2026')).toBe(null);
  });
});

describe('parseBookingCsv', () => {
  it('mallen ger ett giltigt ärende', () => {
    const { rows, missingColumns } = parseBookingCsv(bookingTemplateCsv('rut'), opts);
    expect(missingColumns).toEqual([]);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].case).toMatchObject({ buyer: '199001010017', labor: 956, deduction: 478, hours: 4, workType: 'Stadning' });
    expect(rows[0].customerPaid).toBe(478);
  });

  it('kommaseparerad export med egna rubriker, avdraget räknas fram', () => {
    const csv = 'Booking ID,Payment date,Personal number,Labor,Hours\nA1,2026-10-01 09:12,900101-0017,956,"3,5"\n';
    const { rows } = parseBookingCsv(csv, opts);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].case).toMatchObject({ ref: 'A1', paidDate: '2026-10-01', deduction: 478, hours: 4 });
  });

  it('visar fel per rad', () => {
    const csv = 'Betaldatum;Personnummer;Arbetskostnad;Timmar;Typ av arbete;Betalt\n2026-13-01;123;abc;;Fönsterputs;999\n';
    const keys = parseBookingCsv(csv, opts).rows[0].errors.map(e => e.key);
    expect(keys).toEqual(expect.arrayContaining(['badDate', 'badAmount', 'noPnr', 'noHours']));
  });

  it('säger till om obligatoriska kolumner saknas', () => {
    expect(parseBookingCsv('Datum;Summa\n2026-10-01;100\n', opts).missingColumns).toEqual(['buyer', 'labor', 'hours']);
  });

  it('okänd arbetstyp gissas inte', () => {
    const csv = 'Betaldatum;Personnummer;Arbetskostnad;Timmar;Typ av arbete\n2026-10-01;19900101-0017;956;4;Hundpromenad\n';
    expect(parseBookingCsv(csv, opts).rows[0].errors.map(e => e.key)).toEqual(['unknownWork']);
  });
});

describe('bokföring och fil', () => {
  const csv = 'Betaldatum;Personnummer;Arbetskostnad;Timmar\n'
    + '2026-10-01;19900101-0017;956;4\n2026-10-01;19960410-2393;1195;5\n2026-10-02;19900101-0017;717;3\n';
  const { rows } = parseBookingCsv(csv, opts);

  it('en verifikation per dag som balanserar', () => {
    const days = groupBookingsByDay(rows);
    // 1195 kr ger 597,50 i avdrag, avrundat nedåt till 597 (aldrig mer än kunden betalat).
    expect(days.map(d => [d.date, d.count, d.customerPaid, d.deduction])).toEqual([['2026-10-01', 2, 1076, 1075], ['2026-10-02', 1, 359, 358]]);
    const ver = invoiceBookingRows(days[0].invoiceRows, { revenueAccounts: { 25: '3001' }, vatAccounts: { 25: '2611' }, receivableAccount: '1930', rotRutDeduction: days[0].deduction });
    expect(ver.find(r => r.account === '1513').debet).toBe(1075);
    expect(ver.find(r => r.account === '1930').debet).toBe(1076);
    expect(Math.abs(ver.reduce((s, r) => s + r.debet - r.kredit, 0))).toBeLessThan(0.01);
  });

  it('taket räknas med tidigare importer', () => {
    const cases = rows.map(r => r.case);
    expect(casesBatchErrors(cases, [{ buyer: '199001010017', year: 2026, type: 'rut', deduction: 74800 }]).map(e => e.key)).toEqual(['combinedCap']);
    expect(buyerTotals(rows)).toEqual({ 199001010017: 836, 199604102393: 597 });
  });

  it('delar upp i filer om 100 och bygger XML', () => {
    const many = Array.from({ length: 250 }, () => rows[0].case);
    expect(splitIntoFiles(many).map(f => f.length)).toEqual([100, 100, 50]);
    const xml = buildRotRutXml({ type: 'rut', name: 'RUT 2026-10 1/3', cases: [rows[0].case] });
    expect(xml).toContain('<ns2:FakturaNr></ns2:FakturaNr>');
    expect(xml).toContain('<ns2:BetaltBelopp>478</ns2:BetaltBelopp>');
  });
});

describe('timmar till lönekörning', () => {
  const runRows = [
    { employeeId: 'e1', employeeSnapshot: { ssn: '19900101-0017', firstName: 'Bo', lastName: 'Ek', salaryForm: 'timlon' } },
    { employeeId: 'e2', employeeSnapshot: { ssn: '19960410-2393', firstName: 'Sara', lastName: 'Lind', salaryForm: 'timlon' } },
  ];
  it('summerar flera pass per person och hittar okända', () => {
    const csv = 'Personnummer;Timmar;Namn\n900101-0017;"3,5";Bo\n199001010017;4;Bo\n19960410-2393;8;Sara\n20000101-0000;2;Okänd\n19960410-2393;x;Sara\n';
    const r = parsePayrollHours(csv, runRows);
    expect(r.updates).toEqual([
      { employeeId: 'e1', name: 'Bo Ek', hours: 7.5, hourly: true },
      { employeeId: 'e2', name: 'Sara Lind', hours: 8, hourly: true },
    ]);
    expect(r.unmatched.map(u => u.line)).toEqual([5]);
    expect(r.errors.map(e => e.line)).toEqual([6]);
  });
  it('kräver kolumnerna', () => {
    expect(parsePayrollHours('Namn;Tid2\nBo;3\n', runRows).missingColumns).toEqual(['Personnummer', 'Timmar']);
  });
});
