import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { computeAnnualReport, annualReportTerms } from './annualReport';
import { generateAnnualReportPdf } from './annualReportPdf';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

// En ekonomisk förening: medlemsinsatser 20 000, förlagsinsatser 10 000.
const fy = { start: '2026-01-01', end: '2026-12-31', label: '2026', key: '2026', isCalendar: true };
const v = (id, date, rows) => ({ id, number: id, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })) });
const verifications = [
  v('A1', '2025-02-01', [['1930', 30000, 0], ['2083', 0, 20000], ['2084', 0, 10000]]),
  v('A2', '2025-06-01', [['1930', 40000, 0], ['3001', 0, 40000]]),
  v('B1', '2026-03-01', [['1930', 100000, 0], ['3001', 0, 100000]]),
  v('B2', '2026-04-01', [['5010', 20000, 0], ['1930', 0, 20000]]),
];
const ORG = 'Ekonomisk förening';

describe('årsredovisning för ekonomisk förening', () => {
  const details = { business: 'Föreningen driver en butik åt medlemmarna.', seat: 'Umeå', boardMembers: 'Anna Andersson\nBo Berg', dividend: 5000, signPlace: 'Umeå', agmDate: '2027-05-15' };
  const report = computeAnnualReport({ verifications, accounts: DEFAULT_ACCOUNTS, company: {}, fy, details, orgType: ORG });

  it('använder föreningens ord', () => {
    expect(report.terms.kind).toBe('association');
    expect(annualReportTerms('Aktiebolag (AB)').capital).toBe('Aktiekapital');
    expect(annualReportTerms(ORG).capital).toBe('Medlemsinsatser');
  });

  it('visar medlemsinsatser och förlagsinsatser var för sig, och summorna stämmer', () => {
    const cols = Object.fromEntries(report.balance.equity.columns.map(c => [c.key, c]));
    expect(cols.shareCapital.label).toBe('Medlemsinsatser');
    expect(cols.shareCapital.close).toBe(20000);
    expect(cols.contributions.close).toBe(10000);
    expect(report.balance.equity.restrictedTotal).toBe(30000);
    expect(Math.round(report.balance.totalAssets)).toBe(Math.round(report.balance.totalEqLiab));
  });

  it('ett aktiebolag påverkas inte', () => {
    const ab = computeAnnualReport({ verifications, accounts: DEFAULT_ACCOUNTS, company: {}, fy, details, orgType: 'Aktiebolag (AB)' });
    const cols = ab.balance.equity.columns.map(c => c.key);
    expect(cols).not.toContain('contributions');
    expect(ab.balance.equity.columns[0].label).toBe('Aktiekapital');
  });

  it('PDF:en går att skapa', () => {
    const doc = generateAnnualReportPdf({ company: { name: 'Exempel ek. för.', orgNr: '769600-0001' }, report, details });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6);
    if (process.env.AR_PDF_OUT) writeFileSync(process.env.AR_PDF_OUT, Buffer.from(doc.output('arraybuffer')));
  });
});
