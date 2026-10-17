import { describe, it, expect } from 'vitest';
import { csvToEmployees, employeesToCsv, employeeTemplateCsv, mergeImportedEmployees } from './employeeCsv';

const header = 'Förnamn;Efternamn;Personnummer;Kommun;Anställd från;Timlön;Skattetabell;Medlem i Svenska kyrkan;Kolumn';

describe('csvToEmployees', () => {
  it('mallen går att importera utan fel', () => {
    const rows = csvToEmployees(employeeTemplateCsv(), { currentYear: 2026 });
    expect(rows).toHaveLength(1);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].employee).toMatchObject({ firstName: 'Anna', salaryForm: 'timlon', hourlyRate: 165, municipality: 'Skellefteå', ssn: '19900101-0017' });
    expect(rows[0].employee.taxTable.tabellnr).toMatch(/^\d+$/);
  });

  it('tio siffror, svenska belopp och kommun med "kommun" efter', () => {
    const csv = `${header}\nBo;Ek;900101-0017;Ale kommun;2026-02-01;"152,50";;nej;`;
    const [r] = csvToEmployees(csv, { currentYear: 2026 });
    expect(r.errors).toEqual([]);
    expect(r.employee).toMatchObject({ ssn: '19900101-0017', municipality: 'Ale', hourlyRate: 152.5, salaryForm: 'timlon' });
    expect(r.employee.taxTable).toMatchObject({ tabellnr: '33', kolumn: 1 });
  });

  it('gissar inte skattetabell när kommunen har flera, utan lämnar den tom att hämta', () => {
    const csv = `${header}\nBo;Ek;19900101-0017;Ale;2026-02-01;150;;;`;
    const [r] = csvToEmployees(csv, { currentYear: 2026 });
    expect(r.errors).toEqual([]);
    expect(r.needsTaxTable).toBe(true);
    expect(r.employee.taxTable.tabellnr).toBe('');
  });

  it('rapporterar fel per rad', () => {
    const csv = `${header}\n;Ek;19900101-0018;Atlantis;1 feb;abc;;;9`;
    const [r] = csvToEmployees(csv, { currentYear: 2026 });
    expect(r.line).toBe(2);
    expect(r.errors.length).toBeGreaterThanOrEqual(5);
  });

  it('kräver kolumn för 66 år och äldre', () => {
    const csv = `${header}\nBo;Ek;19500101-0012;Ale;2026-02-01;150;33;;`;
    const [r] = csvToEmployees(csv, { currentYear: 2026 });
    expect(r.errors.join(' ')).toMatch(/Kolumn/);
  });
});

describe('export och sammanslagning', () => {
  it('export går att importera igen', () => {
    const [r] = csvToEmployees(employeeTemplateCsv(), { currentYear: 2026 });
    const again = csvToEmployees(employeesToCsv([r.employee]), { currentYear: 2026 });
    expect(again[0].errors).toEqual([]);
    expect(again[0].employee).toMatchObject({ ssn: r.employee.ssn, hourlyRate: 165, taxForm: 'a_skatt' });
  });

  it('uppdaterar på personnummer och behåller det som inte står i filen', () => {
    const existing = [{ id: 'e1', ssn: '19900101-0017', firstName: 'Anna', email: 'gammal@x.se', employmentRate: 50, projectId: 'p1' }];
    const csv = `${header}\nAnna;Andersson;199001010017;Ale;2026-02-01;170;33;;`;
    const rows = csvToEmployees(csv, { currentYear: 2026 });
    const { list, added, updated } = mergeImportedEmployees(existing, rows, 1);
    expect({ added, updated }).toEqual({ added: 0, updated: 1 });
    expect(list[0]).toMatchObject({ id: 'e1', hourlyRate: 170, email: 'gammal@x.se', employmentRate: 50, projectId: 'p1' });
  });
});

describe('csvToEmployees med andra rubriknamn', () => {
  it('läser Anställningsdatum, Grundlön och Hemkommun som Anställd från, Månadslön och Kommun', () => {
    const csv = 'Förnamn;Efternamn;Personnummer;Anställningsdatum;Grundlön;Hemkommun\nAnna;Andersson;19850312-1231;2025-03-01;34000;Stockholm';
    const [row] = csvToEmployees(csv, { currentYear: 2026 });
    expect(row.errors).toEqual([]);
    expect(row.employee).toMatchObject({ startDate: '2025-03-01', monthlySalary: 34000 });
  });
});
