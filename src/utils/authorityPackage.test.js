import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { buildAuthorityPackage, readmeText } from './authorityPackage';
import { generateSIE4 } from './sieExport';

// Läser filnamn och innehåll ur en okomprimerad zip (zipStore.js).
function unzip(bytes) {
  const out = {};
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let i = 0;
  while (i + 30 <= bytes.length && dv.getUint32(i, true) === 0x04034b50) {
    const size = dv.getUint32(i + 18, true);
    const nameLen = dv.getUint16(i + 26, true);
    const extra = dv.getUint16(i + 28, true);
    const name = new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nameLen));
    const start = i + 30 + nameLen + extra;
    out[name] = bytes.slice(start, start + size);
    i = start + size;
  }
  return out;
}

const company = { name: 'Test AB', orgNr: '559450-5249', fiscalYear: '2025-01-01' };
const accounts = [{ code: '1930', name: 'Bank' }, { code: '3001', name: 'Försäljning' }, { code: '5010', name: 'Hyra' }];
const v = (id, number, date, rows, extra = {}) => ({ id, number, series: number[0], date, description: `Ver ${number}`, status: 'booked', rows, ...extra });
const verifications = [
  v('a', 'A1', '2025-03-01', [{ account: '1930', debet: 1000, kredit: 0 }, { account: '3001', debet: 0, kredit: 1000 }], { attachmentUrl: 'https://x/a1.pdf', attachmentName: 'a1.pdf' }),
  v('b', 'A1', '2026-01-01', [{ account: '5010', debet: 400, kredit: 0 }, { account: '1930', debet: 0, kredit: 400 }], { attachmentUrl: 'https://x/b.jpg', attachmentName: 'b.jpg' }),
  v('c', 'A2', '2026-02-10', [{ account: '5010', debet: 100, kredit: 0 }, { account: '1930', debet: 0, kredit: 100 }]),
  { ...v('d', 'A3', '2026-03-01', [{ account: '5010', debet: 50, kredit: 0 }, { account: '1930', debet: 0, kredit: 50 }]), status: 'draft' },
];

describe('paket till Skatteverket', () => {
  it('innehåller läs mig, SIE4, verifikationslista och årets underlag', async () => {
    const fetched = [];
    const fetchFile = async (url) => { fetched.push(url); return new TextEncoder().encode(`fil ${url}`); };
    const res = await buildAuthorityPackage({ company, accounts, verifications, range: { from: '2026-01-01', to: '2026-12-31' }, label: '2026', XLSX, fetchFile, createdAt: new Date('2026-11-23T10:00:00Z') });
    const files = unzip(res.zip);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['Las_mig.txt', 'Bokforing_2026.se', 'Verifikationslista_2026.xlsx', 'Underlag/Forteckning.xlsx', 'Underlag/A1.jpg']));
    expect(Object.keys(files)).not.toContain('Underlag/A1.pdf'); // förra årets underlag
    expect(fetched).toEqual(['https://x/b.jpg']); // hämtas bara en gång trots två varv
    expect(res.verificationCount).toBe(2); // utkastet räknas inte
    expect(res.missing).toBe(1); // A2 saknar underlag
    expect(res.fileName).toBe('Test AB_2026.zip');
    const readme = new TextDecoder().decode(files['Las_mig.txt'].slice(3));
    expect(readme).toContain('Räkenskapsår: 2026-01-01 till 2026-12-31');
    expect(readme).toContain('Verifikationer utan underlag: 1');
  });

  it('SIE4 för ett år: ingående balans från tidigare år och bara årets verifikationer', () => {
    const sie = generateSIE4(company, accounts, verifications, { from: '2026-01-01', to: '2026-12-31' });
    expect(sie).toContain('#RAR 0 20260101 20261231');
    expect(sie).toContain('#IB 0 1930 1000.00');
    expect(sie).toContain('#UB 0 1930 500.00');
    expect(sie).toContain('#VER A 1 20260101');
    expect(sie).not.toContain('20250301');
    expect(sie).not.toContain('#VER A 3'); // utkast
  });

  it('läs mig nämner underlag som inte gick att hämta', () => {
    expect(readmeText({ company, range: null, label: 'alla', verificationCount: 3, fileCount: 1, missing: 0, failed: 2 })).toContain('inte gick att hämta: 2');
  });
});
