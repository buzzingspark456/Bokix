import { describe, it, expect } from 'vitest';
import { computeInk3r, computeInk3rResultat, computeInk3Taxable, computeInk3s, suggestInk3suf, suggestInk3sus, fillTaxableFromBooked, ink3Forms, ink3rSruRows, ink3sSruRows, ink3sufSruRows, ink3susSruRows } from './ink3';
import { generateInk3Sru } from './sruExport';
import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

// En idrottsförening: medlemsavgifter, kommunalt bidrag, kioskförsäljning,
// hyra, lämnat stipendium och ränta. Ett senare år ska inte räknas med.
const period = { start: '2026-01-01', end: '2026-12-31' };
const end = new Date('2026-12-31T23:59:59');
const v = (id, date, rows) => ({ id, number: id, date, status: 'booked', rows: rows.map(([account, debet, kredit]) => ({ account, debet, kredit })) });
const accounts = [...DEFAULT_ACCOUNTS, { code: '3010', name: 'Medlemsavgifter', type: 'intakt' }];
const verifications = [
  v('A1', '2025-12-31', [['1930', 20000, 0], ['2060', 0, 20000]]),
  v('B1', '2026-02-01', [['1930', 30000, 0], ['3010', 0, 30000]]),
  v('B2', '2026-03-01', [['1930', 15000, 0], ['3987', 0, 15000]]),
  v('B3', '2026-05-01', [['1930', 8000, 0], ['3001', 0, 8000]]),
  v('B4', '2026-06-01', [['5010', 12000, 0], ['1930', 0, 12000]]),
  v('B5', '2026-09-01', [['6710', 5000, 0], ['1930', 0, 5000]]),
  v('B6', '2026-12-31', [['1930', 300, 0], ['8310', 0, 300]]),
  v('C1', '2027-02-01', [['1930', 99999, 0], ['3001', 0, 99999]]),
];
const company = { orgNr: '802400-0000', name: 'Exempel IF', postalCode: '12345', city: 'Stockholm' };

describe('INK3 för ideell förening', () => {
  const ink3r = computeInk3r(verifications, accounts, end);
  const res = computeInk3rResultat(verifications, period, accounts);

  it('intäktskontona hamnar på rätt rad', () => {
    const row = (r) => res.rows.find(x => x.row === r)?.amount || 0;
    expect(row('6.1')).toBe(30000);
    expect(row('6.3')).toBe(15000);
    expect(row('6.4')).toBe(8000);
    expect(row('6.7')).toBe(17000);
    expect(row('6.13')).toBe(300);
    expect(res.total).toBe(36300);
  });

  it('balansen går ihop och årets resultat ligger i eget kapital, utan senare år', () => {
    expect(ink3r.balanced).toBe(true);
    expect(ink3r.rows.find(r => r.row === '5.11').amount).toBe(56300);
    expect(ink3r.rows.find(r => r.row === '5.12').amount).toBe(56300);
  });

  it('ett intäktskonto kan flyttas till en annan rad', () => {
    const moved = computeInk3rResultat(verifications, period, accounts, { '3001': '6.2' });
    expect(moved.rows.find(r => r.row === '6.2').amount).toBe(8000);
    expect(moved.rows.find(r => r.row === '6.4')).toBeUndefined();
  });

  it('allmännyttig utan skattepliktig verksamhet: bara INK3SUF med den skattefria delen', () => {
    expect(ink3Forms({ publicBenefit: true, taxableActivity: false })).toEqual({ suf: true, sus: false, rs: false });
    const suf = suggestInk3suf(verifications, period, res.rows, {});
    expect(suf).toMatchObject({ '4.1': 30000, '4.2': 15000, '4.3': 300, '4.5': 8000, '4.7': 12000, '4.8': 5000 });
    const rows = ink3sufSruRows({ purposes: { sport: true }, values: suf });
    expect(rows).toContainEqual(['8822', 'X']);
    expect(rows).toContainEqual(['8640', 30000]);
  });

  it('kiosken skattepliktig: 6.21, INK3S och SUF minskas med det som tagits upp', () => {
    const taxable = computeInk3Taxable(res.rows, { '6.4': 8000, '6.7': 3000 });
    expect(taxable.total).toBe(5000);
    const ink3s = computeInk3s({ '7.3a': 2000 }, taxable.total);
    expect(ink3s.overskott).toBe(3000);
    const r = ink3rSruRows(ink3r, res, taxable);
    expect(r).toContainEqual(['8650', 30000]);
    expect(r).toContainEqual(['8673', 8000]);
    expect(r).toContainEqual(['8771', 3000]);
    expect(r).toContainEqual(['8663', 36300]);
    expect(r).toContainEqual(['8685', 5000]);
    const s = ink3sSruRows(ink3s, { '7.15': 100 }, { consultant: false, audited: true }, '2025P4');
    expect(s).toEqual([['8686', 5000], ['8787', 2000], ['8695', 3000], ['8041', 'X'], ['8044', 'X']]);
    const suf = suggestInk3suf(verifications, period, res.rows, taxable.values);
    expect(suf['4.5']).toBe(0);
    expect(suf['4.7']).toBe(9000);
  });

  it('inte allmännyttig: allt utom medlemsavgifter, gåvor och bidrag föreslås skattepliktigt', () => {
    expect(ink3Forms({ publicBenefit: false })).toEqual({ suf: false, sus: false, rs: true });
    const filled = fillTaxableFromBooked(res.rows);
    expect(filled['6.1']).toBeUndefined();
    expect(filled['6.3']).toBeUndefined();
    expect(filled['6.4']).toBe(8000);
  });

  it('SRU-filen har bara de bilagor som ska lämnas', () => {
    const taxable = computeInk3Taxable(res.rows, {});
    const ink3s = computeInk3s({}, 0);
    const now = new Date('2027-03-01T10:00:00');
    const onlySuf = generateInk3Sru(company, { forms: { suf: true, rs: false }, ink3r, ink3rResultat: res, taxable, ink3s, suf: { purposes: { other: true }, otherPurpose: 'Schack och brädspel för alla åldrar i kommunen' } }, period, now).blankettSru;
    expect(onlySuf).toContain('#BLANKETT INK3SUF-2026P4');
    expect(onlySuf).not.toContain('INK3R');
    expect(onlySuf).toContain('#UPPGIFT 8620 Schack och brädspel för alla åldrar\r\n');
    const all = generateInk3Sru(company, { forms: { suf: true, rs: true }, ink3r, ink3rResultat: res, taxable, ink3s }, period, now).blankettSru;
    expect(all).toContain('#BLANKETT INK3R-2026P4');
    expect(all).toContain('#BLANKETT INK3S-2026P4');
    expect(all).toContain('#IDENTITET 168024000000');
  });

  it('allmännyttig stiftelse: INK3SUS med stiftelsens fältkoder, avkastnings- eller verksamhetsrader', () => {
    expect(ink3Forms({ entity: 'foundation', publicBenefit: true, taxableActivity: false })).toEqual({ suf: false, sus: true, rs: false });
    const sus = suggestInk3sus(verifications, period, res.rows, {});
    expect(sus).toMatchObject({ '3.1': 5000, '3.2': 15000, '3.4': 300, '3.6': 12000, '3.8': 53300, '3.9': 17000 });
    const yieldRows = ink3susSruRows({ kind: 'yield', values: sus, previousYearDividend: true }, { research: true });
    expect(yieldRows).toEqual([['8803', 'X'], ['8850', 5000], ['8857', 15000], ['8851', 300], ['8853', 12000], ['8854', 'X']]);
    const operating = ink3susSruRows({ kind: 'operating', values: sus, previousYearDividend: true }, { other: true }, 'Museum');
    expect(operating).toEqual([['8839', 'X'], ['8840', 'Museum'], ['8855', 53300], ['8856', 17000]]);
    const sru = generateInk3Sru(company, { forms: { sus: true }, suf: { purposes: { research: true } }, sus: { kind: 'yield', values: sus } }, period, new Date('2027-03-01T10:00:00')).blankettSru;
    expect(sru).toContain('#BLANKETT INK3SUS-2026P4');
    expect(sru).toContain('#UPPGIFT 8803 X');
    expect(sru).not.toContain('INK3SUF');
  });
});
