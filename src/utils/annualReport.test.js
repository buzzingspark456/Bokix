import { describe, it, expect } from 'vitest';
import { computeAnnualReport, previousFiscalYear, annualReportDeadline } from './annualReport';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

const fy = { start: '2026-01-01', end: '2026-12-31', label: '2026', key: '2026', isCalendar: true };
const v = (id, date, rows) => ({ id, number: id, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })) });

// Ett litet AB: startade 2025 med 25 000 kr i aktiekapital.
const verifications = [
  v('A1', '2025-02-01', [['1930', 25000, 0], ['2081', 0, 25000]]),
  v('A2', '2025-06-01', [['1510', 50000, 0], ['3001', 0, 40000], ['2611', 0, 10000]]),
  v('A3', '2025-06-20', [['1930', 50000, 0], ['1510', 0, 50000]]),
  v('A4', '2025-07-01', [['6540', 10000, 0], ['2641', 2500, 0], ['1930', 0, 12500]]),
  // 2025 års resultat (30 000) bokfört i bokslut och flyttat till balanserat.
  v('A5', '2025-12-31', [['8999', 30000, 0], ['2099', 0, 30000]]),
  v('A6', '2026-05-01', [['2099', 30000, 0], ['2091', 0, 30000]]),
  // 2026: försäljning 100 000, kostnader 20 000 + lön 30 000, inventarie 24 000 skrivs av 4 800.
  v('B1', '2026-03-01', [['1510', 125000, 0], ['3001', 0, 100000], ['2611', 0, 25000]]),
  v('B2', '2026-03-30', [['1930', 125000, 0], ['1510', 0, 125000]]),
  v('B3', '2026-04-01', [['5010', 20000, 0], ['2641', 5000, 0], ['1930', 0, 25000]]),
  v('B4', '2026-05-25', [['7210', 30000, 0], ['1930', 0, 30000]]),
  v('B5', '2026-06-01', [['1220', 24000, 0], ['2641', 6000, 0], ['1930', 0, 30000]]),
  v('B6', '2026-12-31', [['7832', 4800, 0], ['1229', 0, 4800]]),
];

describe('årsredovisning K2', () => {
  const report = computeAnnualReport({ verifications, accounts: DEFAULT_ACCOUNTS, company: {}, fy, details: { boardMembers: 'Anna Andersson', dividend: 10000 } });

  it('resultaträkningen med jämförelseår', () => {
    const line = (label) => report.income.lines.find(l => l.label === label);
    expect(line('Nettoomsättning')).toMatchObject({ current: 100000, previous: 40000 });
    expect(line('Personalkostnader').current).toBe(-30000);
    expect(line('Rörelseresultat')).toMatchObject({ current: 45200, previous: 30000 });
    expect(report.yearResult).toBe(45200);
  });

  it('balansräkningen går ihop och eget kapital delas upp rätt', () => {
    const b = report.balance;
    expect(Math.round(b.totalAssets)).toBe(Math.round(b.totalEqLiab));
    expect(b.equity.restrictedTotal).toBe(25000);
    expect(b.equity.retained).toBe(30000);
    expect(b.equity.yearResult).toBe(45200);
    expect(report.warnings).toEqual([]);
  });

  it('förslag till resultatdisposition', () => {
    expect(report.disposition).toMatchObject({ available: 75200, dividend: 10000, carriedForward: 65200 });
  });

  it('flerårsöversikt och not för inventarier', () => {
    expect(report.overview.map(o => o.label)).toEqual(['2026', '2025']);
    expect(report.overview[0].netSales).toBe(100000);
    expect(report.overview[0].solidity).toBeGreaterThan(0);
    const note = report.notes.find(n => n.title === 'Maskiner och inventarier');
    expect(note).toMatchObject({ costIn: 24000, depYear: -4800, bookValue: 19200 });
  });

  it('samma siffror innan bokslutet för 2025 bokförts', () => {
    const utan = verifications.filter(x => !['A5', 'A6'].includes(x.id));
    const r = computeAnnualReport({ verifications: utan, accounts: DEFAULT_ACCOUNTS, company: {}, fy, details: { boardMembers: 'A' } });
    expect(r.balance.equity.retained).toBe(30000);
    expect(r.balance.equity.yearResult).toBe(45200);
    expect(Math.round(r.balance.totalAssets)).toBe(Math.round(r.balance.totalEqLiab));
  });

  it('varnar för utdelning större än fritt eget kapital', () => {
    const r = computeAnnualReport({ verifications, accounts: DEFAULT_ACCOUNTS, company: {}, fy, details: { boardMembers: 'A', dividend: 100000 } });
    expect(r.warnings.join(' ')).toMatch(/fria egna kapitalet/);
  });
});

describe('räkenskapsår och frist', () => {
  it('föregående år, även brutet', () => {
    expect(previousFiscalYear(fy, {})).toMatchObject({ start: '2025-01-01', end: '2025-12-31' });
    expect(previousFiscalYear({ start: '2026-07-01', end: '2027-06-30' }, {})).toMatchObject({ start: '2025-07-01', end: '2026-06-30' });
  });

  it('sju månader efter räkenskapsårets slut', () => {
    expect(annualReportDeadline('2026-12-31')).toBe('2027-07-31');
    expect(annualReportDeadline('2026-06-30')).toBe('2027-01-31');
    expect(annualReportDeadline('2026-04-30')).toBe('2026-11-30');
  });
});
