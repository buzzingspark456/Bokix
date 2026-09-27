import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { computeAnnualReport } from './annualReport';
import { generateAnnualReportPdf, formatKr } from './annualReportPdf';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

const fy = { start: '2026-01-01', end: '2026-12-31', label: '2026', key: '2026', isCalendar: true };
const v = (id, date, rows) => ({ id, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })) });
const verifications = [
  v('A1', '2025-02-01', [['1930', 25000, 0], ['2081', 0, 25000]]),
  v('A2', '2025-06-01', [['1930', 40000, 0], ['3001', 0, 40000]]),
  v('B1', '2026-03-01', [['1930', 100000, 0], ['3001', 0, 100000]]),
  v('B3', '2026-04-01', [['5010', 20000, 0], ['1930', 0, 20000]]),
  v('B5', '2026-06-01', [['1220', 24000, 0], ['1930', 0, 24000]]),
  v('B6', '2026-12-31', [['7832', 4800, 0], ['1229', 0, 4800]]),
];

describe('årsredovisningens PDF', () => {
  it('belopp i hela kronor med vanligt minustecken', () => {
    expect(formatKr(1234567.6)).toBe('1 234 568');
    expect(formatKr(-4800)).toBe('-4 800');
  });

  it('har alla delar och går att skapa', () => {
    const details = { business: 'Bolaget utvecklar programvara.', seat: 'Stockholm', boardMembers: 'Anna Andersson\nBo Berg', dividend: 5000, signPlace: 'Stockholm', agmDate: '2027-05-15' };
    const report = computeAnnualReport({ verifications, accounts: DEFAULT_ACCOUNTS, company: {}, fy, details });
    const doc = generateAnnualReportPdf({ company: { name: 'Exempel AB', orgNr: '559000-0001' }, report, details });
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(6);
    if (process.env.AR_PDF_OUT) writeFileSync(process.env.AR_PDF_OUT, Buffer.from(doc.output('arraybuffer')));
  });
});
