import { describe, it, expect } from 'vitest';
import { computeInk4r, computeInk4rResultat, computeInk4s, computeInk4du, ink4rRowForAccount, sruPersonId } from './ink4';
import { generateInk4Sru } from './sruExport';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

// Ett handelsbolag med två delägare, 50 % var.
const period = { start: '2026-01-01', end: '2026-12-31' };
const v = (id, date, rows) => ({ id, number: id, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })) });
const verifications = [
  // Ingående kapital från förra året.
  v('A1', '2025-12-31', [['1930', 40000, 0], ['2010', 0, 20000], ['2020', 0, 20000]]),
  // 2026: försäljning, kostnad, en insättning och två uttag.
  v('B1', '2026-02-01', [['1930', 125000, 0], ['3001', 0, 100000], ['2611', 0, 25000]]),
  v('B2', '2026-03-01', [['5010', 20000, 0], ['2641', 5000, 0], ['1930', 0, 25000]]),
  v('B3', '2026-04-01', [['1930', 10000, 0], ['2018', 0, 10000]]),
  v('B4', '2026-06-01', [['2013', 15000, 0], ['1930', 0, 15000]]),
  v('B5', '2026-06-01', [['2023', 5000, 0], ['1930', 0, 5000]]),
  // Ej avdragsgill representation (läggs tillbaka i INK4S 4.3b).
  v('B6', '2026-09-01', [['6072', 2000, 0], ['1930', 0, 2000]]),
];
const partners = [
  { id: 'p1', name: 'Anna Andersson', personnummer: '19800101-1234', sharePct: 50 },
  { id: 'p2', name: 'Bo Berg', personnummer: '850202-5678', sharePct: 50 },
];
const company = { orgNr: '969600-0001', name: 'Exempel HB', postalCode: '12345', city: 'Stockholm' };

describe('INK4 för handelsbolag', () => {
  const ink4r = computeInk4r(verifications, DEFAULT_ACCOUNTS, period.end);
  const res = computeInk4rResultat(verifications, period);

  it('delägarkontona hamnar på eget kapital-raderna', () => {
    expect(ink4rRowForAccount('2010')).toBe('2.19');
    expect(ink4rRowForAccount('2023')).toBe('2.20');
    expect(ink4rRowForAccount('2029')).toBe('result');
    expect(ink4rRowForAccount('1930')).toBe('2.18');
    expect(ink4rRowForAccount('2440')).toBe('2.33');
  });

  it('räkenskapsschemat: resultat och balans går ihop', () => {
    expect(res.total).toBe(78000);
    expect(res.rows.find(r => r.row === '3.1').amount).toBe(100000);
    expect(res.rows.find(r => r.row === '3.18').amount).toBe(78000);
    const row = (id) => ink4r.rows.find(r => r.row === id)?.amount || 0;
    expect(row('2.19')).toBe(40000);
    expect(row('2.20')).toBe(-10000); // 10 000 in, 20 000 ut
    expect(row('2.21')).toBe(78000);
    expect(row('2.23')).toBe(108000);
    expect(ink4r.balanced).toBe(true);
  });

  it('INK4S och delägarnas andelar', () => {
    const ink4s = computeInk4s({ '4.3b': 2000 }, res.total);
    expect(ink4s.overskott).toBe(80000);
    const du = computeInk4du(verifications, partners, period, ink4s);
    expect(du.map(d => d.overskott)).toEqual([40000, 40000]);
    expect(du[0]).toMatchObject({ tillskott: 10000, uttag: 15000 });
    expect(du[1]).toMatchObject({ tillskott: 0, uttag: 5000 });
  });

  it('personnummer i SRU-format', () => {
    expect(sruPersonId('19800101-1234')).toBe('198001011234');
    expect(sruPersonId('850202-5678')).toBe('198502025678');
  });

  it('SRU-filen har INK4R, INK4S och ett INK4DU per delägare med Skatteverkets fältkoder', () => {
    const ink4s = computeInk4s({ '4.3b': 2000 }, res.total);
    const delagare = computeInk4du(verifications, partners, period, ink4s);
    const { blankettSru, infoSru } = generateInk4Sru(company, { ink4r, ink4rResultat: res, ink4s, answers: { consultant: false, audited: false }, delagare }, period, new Date(2027, 2, 1, 10, 0, 0));
    expect(infoSru).toContain('#ORGNR 169696000001');
    expect(blankettSru).toContain('#BLANKETT INK4R-2026P4');
    expect(blankettSru).toContain('#BLANKETT INK4S-2026P4');
    expect(blankettSru.match(/#BLANKETT INK4DU-2026P4/g)).toHaveLength(2);
    expect(blankettSru).toContain('#UPPGIFT 7410 100000');
    expect(blankettSru).toContain('#UPPGIFT 7310 40000');
    expect(blankettSru).toContain('#UPPGIFT 7311 -10000');
    expect(blankettSru).toContain('#UPPGIFT 7312 78000');
    expect(blankettSru).toContain('#UPPGIFT 7450 78000');
    expect(blankettSru).toContain('#UPPGIFT 7650 78000');
    expect(blankettSru).toContain('#UPPGIFT 7653 2000');
    expect(blankettSru).toContain('#UPPGIFT 7670 80000');
    expect(blankettSru).toContain('#UPPGIFT 8041 X');
    expect(blankettSru).toContain('#UPPGIFT 8100 198001011234');
    expect(blankettSru).toContain('#UPPGIFT 8101 40000');
    expect(blankettSru).toContain('#UPPGIFT 8104 15000');
    expect(blankettSru.trim().endsWith('#FIL_SLUT')).toBe(true);
  });
});

describe('INK4S fält som bara finns i nyare blankettutgåvor', () => {
  it('8022 tas med från 2026P4 men inte för 2025', () => {
    const company = { orgNr: '969600-0001', name: 'Exempel HB', postalCode: '12345', city: 'Stockholm' };
    const ink4s = computeInk4s({}, 1000);
    const data = { ink4r: { rows: [] }, ink4rResultat: { rows: [] }, ink4s, info: { '4.16': 500 }, delagare: [] };
    expect(generateInk4Sru(company, data, { start: '2026-01-01', end: '2026-12-31' }).blankettSru).toContain('#UPPGIFT 8022 500');
    expect(generateInk4Sru(company, data, { start: '2025-01-01', end: '2025-12-31' }).blankettSru).not.toContain('8022');
  });
});
