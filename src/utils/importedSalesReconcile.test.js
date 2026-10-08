import { describe, it, expect } from 'vitest';
import { reconcileImportedSales } from './importedSalesReconcile';
import { parseBookingCsv, groupBookingsByDay } from './bookingImport';

const ver = (id, date, amount, account = '1930') => ({ id, date, source: 'rotrut_import', rows: [
  { account, debet: amount, kredit: 0 }, { account: '1513', debet: amount, kredit: 0 }, { account: '3001', debet: 0, kredit: amount * 1.6 }, { account: '2611', debet: 0, kredit: amount * 0.4 },
] });
const bank = (id, date, amount, status = 'unmatched') => ({ id, date, amount, status });
const ledgerOf = () => '1930';

describe('reconcileImportedSales', () => {
  it('stämmer av en dag när summan stämmer, rör inte en dag som inte stämmer', () => {
    const rows = [bank('a', '2026-09-01', 478), bank('b', '2026-09-01', 597.5), bank('c', '2026-09-02', 300), bank('d', '2026-09-01', -50)];
    const r = reconcileImportedSales(rows, [ver('v1', '2026-09-01', 1075.5), ver('v2', '2026-09-02', 359)], ledgerOf);
    expect(r.updates.map(u => u.id)).toEqual(['a', 'b']);
    expect(r.updates[0].patch).toMatchObject({ status: 'matched', matchedType: 'rotrut_import', matchedId: 'v1' });
    expect(r.matchedDays).toBe(1);
    expect(r.unmatchedDays).toEqual([{ date: '2026-09-02', account: '1930', expected: 359, found: 300 }]);
  });

  it('hoppar över dagar som redan stämts av och konton utan kontoutdrag', () => {
    const rows = [bank('a', '2026-09-01', 478, 'matched')];
    rows[0].matchedType = 'rotrut_import'; rows[0].matchedId = 'v1';
    expect(reconcileImportedSales(rows, [ver('v1', '2026-09-01', 478), ver('v3', '2026-09-01', 10, '1580')], ledgerOf).updates).toEqual([]);
  });
});

describe('avgift i importen', () => {
  it('summeras per dag', () => {
    const csv = 'Betaldatum;Personnummer;Arbetskostnad;Timmar;Avgift\n2026-09-01;19900101-0017;956;4;"8,10"\n2026-09-01;19960410-2393;956;4;8,10\n';
    const days = groupBookingsByDay(parseBookingCsv(csv, { type: 'rut', defaultWorkType: 'Stadning', today: '2026-10-07' }).rows);
    expect(days[0].fee).toBe(16.2);
  });
});
