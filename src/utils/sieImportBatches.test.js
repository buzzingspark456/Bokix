import { describe, it, expect } from 'vitest';
import { sieImportTagOf, sieImportBatches } from './sieImportBatches';

describe('sieImportBatches', () => {
  it('läser taggen ur sourceId för äldre importer', () => {
    expect(sieImportTagOf({ sourceId: 'sie_import_Foretag_2025.se_2026-01-15_A_12' })).toBe('sie_import_Foretag_2025.se_2026-01-15');
    expect(sieImportTagOf({ sourceId: 'sie_import_fil_med_understreck.si_okant-datum_B_3' })).toBe('sie_import_fil_med_understreck.si_okant-datum');
    expect(sieImportTagOf({ sourceId: 'skattekonto_import_x' })).toBeNull();
    expect(sieImportTagOf({ sieImportTag: 'sie_import_a.se_2026-01-01', sourceId: 'x' })).toBe('sie_import_a.se_2026-01-01');
  });

  it('grupperar per fil, nyast först', () => {
    const vs = [
      { id: '1', date: '2025-01-01', sourceId: 'sie_import_a.se_2026-01-01_A_1' },
      { id: '2', date: '2025-12-31', sourceId: 'sie_import_a.se_2026-01-01_A_2' },
      { id: '3', date: '2026-02-01', sieImportTag: 'sie_import_b.se_2026-03-01', sourceId: 'sie_import_b.se_2026-03-01_A_1' },
      { id: '4', date: '2026-02-01' },
    ];
    const b = sieImportBatches(vs);
    expect(b.map(x => x.fileName)).toEqual(['b.se', 'a.se']);
    expect(b[1]).toMatchObject({ count: 2, from: '2025-01-01', to: '2025-12-31', ids: ['1', '2'], generatedDate: '2026-01-01' });
  });
});
