import { describe, it, expect } from 'vitest';

describe('skattetabellens år i lönekörningen', async () => {
  const { payrollSnapshot } = await import('./payrollConfig');
  it('följer utbetalningsdagen, inte året då den anställda lades upp', () => {
    const e = { id: 'a', taxTable: { tabellnr: '33', kolumn: 1, year: 2026 } };
    expect(payrollSnapshot(e, { payDate: '2027-01-25', period: '2026-12' }).taxTable.year).toBe(2027);
    expect(payrollSnapshot(e, { period: '2027-02' }).taxTable.year).toBe(2027);
    expect(payrollSnapshot(e, {}).taxTable.year).toBe(2026);
    expect(e.taxTable.year).toBe(2026);
    expect(payrollSnapshot({ id: 'b' }, { payDate: '2027-01-25' })).toEqual({ id: 'b' });
  });
});
