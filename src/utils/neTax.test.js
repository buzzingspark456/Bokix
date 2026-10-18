import { describe, it, expect } from 'vitest';
import {
  computeNeTax, computeNeTaxChain, openFunds, egenavgiftSchablonRate, birthYearFromPersonnummer, bookedNeAdjustments,
} from './neTax';

describe('computeNeTax', () => {
  it('räknar fram R17–R47 och föreslår schablonavdraget 25 %', () => {
    const t = computeNeTax({ r12: 400000, stored: { r13: '2000' }, birthYear: 1985, taxYear: 2025 });
    expect(t.values.r17).toBe(402000);
    expect(t.values.r42).toBe(402000);
    expect(t.values.r43).toBe(100500);
    expect(t.r47).toBe(301500);
    expect(t.r48).toBe(0);
    expect(t.rows.find(r => r.key === 'r43').suggested).toBe(true);
  });

  it('periodiseringsfond högst 30 % av R33, med varning', () => {
    const t = computeNeTax({ r12: 100000, stored: { r34: '40000' } });
    expect(t.maxR34).toBe(30000);
    expect(t.warnings.map(w => w.key)).toContain('r34');
    expect(t.values.r35).toBe(60000);
  });

  it('särskild löneskatt på pensionspremier föreslås', () => {
    const t = computeNeTax({ r12: 100000, stored: { r38: '10000' } });
    expect(t.values.r39).toBe(2426);
  });

  it('underskott: inget egenavgiftsavdrag och R48 fylls i', () => {
    const t = computeNeTax({ r12: -50000 });
    expect(t.values.r43).toBe(0);
    expect(t.r48).toBe(50000);
    expect(t.r47).toBe(0);
  });

  it('R45 och R46 läggs tillbaka (tecknen enligt Skatteverkets fältlista)', () => {
    const t = computeNeTax({ r12: -50000, stored: { r45: '50000' } });
    expect(t.r48).toBe(0);
    expect(t.r47).toBe(0);
    expect(t.rows.find(r => r.key === 'r46').sign).toBe('+');
  });

  it('ett sparat fält vinner över förslaget, även tomt', () => {
    const t = computeNeTax({ r12: 100000, stored: { r13: '', r43: '' }, suggested: { r13: 5000 } });
    expect(t.values.r13).toBe(0);
    expect(t.values.r43).toBe(0);
  });
});

describe('egenavgiftSchablonRate', () => {
  it('25 %, 10 % från 66 år (67 från 2026), 0 för född 1937 eller tidigare', () => {
    expect(egenavgiftSchablonRate(1985, 2025)).toBe(0.25);
    expect(egenavgiftSchablonRate(1958, 2025)).toBe(0.10);
    expect(egenavgiftSchablonRate(1959, 2025)).toBe(0.25);
    // 2026: född 1959 har bara fyllt 66 vid årets ingång, alltså fulla avgifter.
    expect(egenavgiftSchablonRate(1958, 2026)).toBe(0.10);
    expect(egenavgiftSchablonRate(1959, 2026)).toBe(0.25);
    expect(egenavgiftSchablonRate(1959, 2027)).toBe(0.10);
    expect(egenavgiftSchablonRate(1937, 2025)).toBe(0);
    expect(egenavgiftSchablonRate(null, 2025)).toBe(0.25);
  });
});

describe('birthYearFromPersonnummer', () => {
  const now = new Date('2026-10-18');
  it('tolkar 10 och 12 siffror', () => {
    expect(birthYearFromPersonnummer('850315-1234', now)).toBe(1985);
    expect(birthYearFromPersonnummer('19850315-1234', now)).toBe(1985);
    expect(birthYearFromPersonnummer('050315-1234', now)).toBe(2005);
    expect(birthYearFromPersonnummer('250315+1234', now)).toBe(1925);
    expect(birthYearFromPersonnummer('', now)).toBeNull();
  });
});

describe('periodiseringsfonder', () => {
  it('återföring tas från den äldsta fonden först', () => {
    expect(openFunds([
      { year: 2020, allocated: 1000 },
      { year: 2021, allocated: 2000 },
      { year: 2022, reversed: 1500 },
    ])).toEqual([{ year: 2021, amount: 1500 }]);
  });

  it('kedjan: sex år gammal fond föreslås återförd, förra årets R43 och R48 följer med', () => {
    const years = [2019, 2020, 2021, 2022, 2023, 2024, 2025].map(y => ({ key: String(y), start: `${y}-01-01`, end: `${y}-12-31`, r12: y === 2024 ? -10000 : 100000 }));
    const neByKey = { 2019: { tax: { r34: '20000' } } };
    const chain = computeNeTaxChain({ years, neByKey, birthYear: 1985 });
    expect(chain['2025'].mustReverse).toBe(20000);
    expect(chain['2025'].values.r32).toBe(20000);
    expect(chain['2024'].mustReverse).toBe(0);
    expect(chain['2025'].values.r24).toBe(chain['2024'].r48);
    expect(chain['2024'].values.r40).toBe(chain['2023'].values.r43);
    expect(chain['2025'].fundsAfter).toEqual([]);
  });
});

describe('bookedNeAdjustments', () => {
  it('ej avdragsgill representation och skattefri ränta', () => {
    const vers = [
      { date: '2025-03-01', rows: [{ account: '6072', debet: 1200, kredit: 0 }, { account: '1930', debet: 0, kredit: 1200 }] },
      { date: '2025-04-01', rows: [{ account: '1630', debet: 40, kredit: 0 }, { account: '8314', debet: 0, kredit: 40 }] },
      { date: '2024-04-01', rows: [{ account: '6072', debet: 999, kredit: 0 }, { account: '1930', debet: 0, kredit: 999 }] },
    ];
    expect(bookedNeAdjustments(vers, { start: '2025-01-01', end: '2025-12-31' })).toEqual({ r13: 1200, r14: 40 });
  });
});
