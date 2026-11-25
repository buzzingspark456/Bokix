import { describe, it, expect } from 'vitest';
import {
  spreadShares, spreadPlan, buildSpreadStart, buildSpreadMonth, spreadStatus, dueSpreadMonths,
  buildSpreadUndo, spreadCandidates, balanceAccountFor, sideForAccount,
} from './accrualSpread';

const sum = (rows, k) => Math.round(rows.reduce((s, r) => s + (r[k] || 0), 0) * 100) / 100;
const rent = { id: 's1', description: 'Årshyra', account: '5010', side: 'expense', balanceAccount: '1710', amount: 12000, startMonth: '2026-01', months: 12, date: '2026-01-05' };
const booked = (v) => ({ ...v, id: v.sourceId });

describe('månadsperiodisering', () => {
  it('delarna blir exakt beloppet, sista tar öresresten', () => {
    const s = spreadShares(1000, 3);
    expect(s).toEqual([333.33, 333.33, 333.34]);
    expect(Math.round(s.reduce((a, b) => a + b, 0) * 100) / 100).toBe(1000);
    for (const [amt, n] of [[0.01, 1], [99.99, 7], [12345.67, 12], [5, 36]]) {
      expect(Math.round(spreadShares(amt, n).reduce((a, b) => a + b, 0) * 100) / 100).toBe(amt);
    }
  });
  it('kostnad: omföring D 1710 K 5010, varje månad D 5010 K 1710, allt balanserar', () => {
    const start = buildSpreadStart(rent);
    expect(start.rows).toEqual([{ account: '1710', debet: 12000, kredit: 0 }, { account: '5010', debet: 0, kredit: 12000 }]);
    const m = buildSpreadMonth(rent, '2026-03', 1000);
    expect(m.rows).toEqual([{ account: '5010', debet: 1000, kredit: 0 }, { account: '1710', debet: 0, kredit: 1000 }]);
    expect(m.date).toBe('2026-03-31');
    // Efter alla månader är 1710 noll och 5010 har hela beloppet igen.
    const all = [start, ...spreadPlan(rent).map(p => buildSpreadMonth(rent, p.month, p.amount))];
    const bal = (acc) => Math.round(all.flatMap(v => v.rows).filter(r => r.account === acc).reduce((s, r) => s + r.debet - r.kredit, 0) * 100) / 100;
    expect(bal('1710')).toBe(0);
    expect(bal('5010')).toBe(0);
    all.forEach(v => expect(sum(v.rows, 'debet')).toBe(sum(v.rows, 'kredit')));
  });
  it('intäkt: omföring D 3001 K 2970, varje månad D 2970 K 3001', () => {
    const lic = { ...rent, id: 's2', account: '3001', side: 'income', balanceAccount: '2970' };
    expect(buildSpreadStart(lic).rows[0]).toEqual({ account: '3001', debet: 12000, kredit: 0 });
    expect(buildSpreadMonth(lic, '2026-02', 1000).rows[0]).toEqual({ account: '2970', debet: 1000, kredit: 0 });
  });
  it('status och förfallna månader läses från verifikationerna', () => {
    const vers = [booked(buildSpreadStart(rent)), booked(buildSpreadMonth(rent, '2026-01', 1000))];
    const st = spreadStatus(rent, vers);
    expect(st).toMatchObject({ started: true, booked: 1, total: 12, distributed: 1000, remaining: 11000, done: false });
    expect(st.next.month).toBe('2026-02');
    const { due, total } = dueSpreadMonths([rent], vers, '2026-04-15', {});
    expect(due.map(d => d.month)).toEqual(['2026-02', '2026-03']);
    expect(total).toBe(2000);
  });
  it('låst år: månaderna bokas inte', () => {
    const vers = [booked(buildSpreadStart(rent))];
    const r = dueSpreadMonths([rent], vers, '2026-06-30', { 2026: { start: '2026-01-01', end: '2026-12-31' } });
    expect(r.due).toEqual([]);
    expect(r.blockedByLock).toBe(6);
  });
  it('ångra flyttar bara tillbaka det som inte fördelats', () => {
    const vers = [booked(buildSpreadStart(rent)), ...['2026-01', '2026-02', '2026-03'].map(m => booked(buildSpreadMonth(rent, m, 1000)))];
    const undo = buildSpreadUndo(rent, vers, '2026-04-10');
    expect(undo.rows).toEqual([{ account: '5010', debet: 9000, kredit: 0 }, { account: '1710', debet: 0, kredit: 9000 }]);
    const after = [...vers, booked(undo)];
    expect(spreadStatus(rent, after).undone).toBe(true);
    expect(dueSpreadMonths([rent], after, '2026-12-31', {}).due).toEqual([]);
    expect(buildSpreadUndo(rent, after, '2026-05-01')).toBeNull();
  });
  it('förslag ur en verifikation: resultatkonton med belopp och rätt balanskonto', () => {
    const v = { rows: [{ account: '5010', debet: 12000, kredit: 0 }, { account: '2641', debet: 3000, kredit: 0 }, { account: '2440', debet: 0, kredit: 15000 }] };
    const c = spreadCandidates(v, r => r.debet || 0, r => r.kredit || 0);
    expect(c).toEqual([{ account: '5010', amount: 12000, side: 'expense', balanceAccount: '1710' }]);
    expect(balanceAccountFor('expense', '6540')).toBe('1790');
    expect(sideForAccount('3001')).toBe('income');
  });
});
