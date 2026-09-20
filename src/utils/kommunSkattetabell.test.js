import { describe, it, expect } from 'vitest';
import { SWEDISH_MUNICIPALITIES } from './kommuner';
import { KOMMUN_SKATTETABELLER, suggestTaxTables } from './kommunSkattetabell';

describe('kommunSkattetabell', () => {
  it('har en post för varje kommun i appens lista', () => {
    expect(SWEDISH_MUNICIPALITIES).toHaveLength(290);
    for (const kommun of SWEDISH_MUNICIPALITIES) {
      expect(KOMMUN_SKATTETABELLER[kommun], kommun).toBeTruthy();
    }
    expect(Object.keys(KOMMUN_SKATTETABELLER)).toHaveLength(290);
  });

  it('ger tabellnummer i Skatteverkets intervall 29-42', () => {
    for (const [kommun, [ej, medlem]] of Object.entries(KOMMUN_SKATTETABELLER)) {
      for (const nr of [...ej, ...medlem]) {
        expect(nr, kommun).toBeGreaterThanOrEqual(29);
        expect(nr, kommun).toBeLessThanOrEqual(42);
      }
    }
  });

  it('medlemmar i Svenska kyrkan får aldrig lägre tabell än icke-medlemmar', () => {
    for (const [kommun, [ej, medlem]] of Object.entries(KOMMUN_SKATTETABELLER)) {
      expect(Math.min(...medlem), kommun).toBeGreaterThanOrEqual(Math.min(...ej));
    }
  });

  it('föreslår tabell för en känd kommun och null för en okänd', () => {
    const lund = suggestTaxTables('Lund');
    expect(lund.ejMedlem).toEqual([33]);
    expect(lund.medlem).toEqual([34]);
    expect(suggestTaxTables('Ystad')).toBeTruthy();
    expect(suggestTaxTables('Östra Göinge')).toBeTruthy();
    expect(suggestTaxTables('Atlantis')).toBeNull();
  });
});
