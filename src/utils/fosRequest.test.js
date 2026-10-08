import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { orgNrWithCentury, fosMissingFields, buildFosQuery, parseFosAnswer, wageColumnFor, fosChanges, latin1Bytes } from './fosRequest';
import { computeEmployeePayroll, activeTaxAdjustment } from './payrollCalculation';

// Skatteverkets egen exempelsvarsfil ("Svarsfil 1", schemat V2), förkortad.
const SVAR = `<?xml version="1.0" encoding="iso-8859-1" ?>
<Skatteavdrag xmlns="se/skatteverket/askatt/csr/2.0">
<Etikett><Frageetikett><Fragestallare organisationsNr="165560000100"><Organisationsnamn>Nystads</Organisationsnamn></Fragestallare>
<Inkomstar>2026</Inkomstar></Frageetikett><Svarsetikett><KvittensId>x</KvittensId><Svarsdatum>2026-10-09</Svarsdatum></Svarsetikett></Etikett>
<Registerutdrag>
<Arbetsgivare organisationsNr="165566778899">
<Anstalld personNr="199001010017"><EgenReferens>e1</EgenReferens>
<Preliminarskatteuppgift><Skatteform>A</Skatteform><Tabell>32</Tabell>
<Jamkning><Procent>20</Procent><Fromdatum>2026-04-17</Fromdatum><Tomdatum>2026-12-31</Tomdatum></Jamkning>
</Preliminarskatteuppgift></Anstalld>
<Anstalld personNr="199604102393"><Preliminarskatteuppgift><Skatteform>A</Skatteform><Tabell>33</Tabell></Preliminarskatteuppgift></Anstalld>
<Anstalld personNr="195801010003"><Preliminarskatteuppgift><Skatteform>A</Skatteform><Tabell>30</Tabell></Preliminarskatteuppgift></Anstalld>
<Anstalld personNr="198001010000" felorsak="2"></Anstalld>
<Anstalld personNr="200501010009"><Preliminarskatteuppgift felorsak="10"></Preliminarskatteuppgift></Anstalld>
</Arbetsgivare>
</Registerutdrag>
</Skatteavdrag>`;

const company = { name: 'Städ & Co AB', orgNr: '556677-8899' };
const contact = { name: 'Åsa Öberg', address: 'Storgatan 1', postalCode: '931 30', city: 'Skellefteå', phone: '070-1234567', email: 'asa@stad.se' };

describe('frågefilen', () => {
  it('organisationsnummer med sekel', () => {
    expect(orgNrWithCentury('556677-8899')).toBe('165566778899');
    expect(orgNrWithCentury('900101-0017')).toBe('199001010017');
    expect(orgNrWithCentury('12')).toBe('');
  });
  it('säger vad som saknas', () => {
    expect(fosMissingFields({ company, contact })).toEqual([]);
    expect(fosMissingFields({ company: {}, contact: { ...contact, postalCode: '12' } })).toEqual(['orgNr', 'companyName', 'postalCode']);
  });
  it('bygger en fil enligt schemat', () => {
    const xml = buildFosQuery({ company, contact, year: 2026, employees: [{ id: 'e1', ssn: '19900101-0017' }, { id: 'e2', ssn: '' }] });
    expect(xml).toContain('encoding="iso-8859-1"');
    expect(xml).toContain('<Fragestallare organisationsNr="165566778899">');
    expect(xml).toContain('<Organisationsnamn>Städ &amp; Co AB</Organisationsnamn>');
    expect(xml).toContain('<Postnr>93130</Postnr>');
    expect(xml).toContain('<Anstalld personNr="199001010017"><EgenReferens>e1</EgenReferens></Anstalld>');
    expect(xml.match(/<Anstalld /g)).toHaveLength(1);
    expect(latin1Bytes('Åsa')[0]).toBe(0xc5);
    if (process.env.FOS_OUT) fs.writeFileSync(path.join(process.env.FOS_OUT, 'bokix-fraga.xml'), Buffer.from(latin1Bytes(xml)));
  });
});

describe('svarsfilen', () => {
  const parsed = parseFosAnswer(SVAR);
  it('läser tabell, skatteform, jämkning och felkoder', () => {
    expect(parsed.year).toBe(2026);
    expect(parsed.answers[0]).toEqual({ pnr: '199001010017', ref: 'e1', skatteform: 'A', tabell: '32', jamkning: { percent: 20, from: '2026-04-17', to: '2026-12-31' }, error: null });
    expect(parsed.answers[3].error).toBe('2');
    expect(parsed.answers[4].error).toBe('10');
  });
  it('läser Skatteverkets riktiga exempelfil om den finns', () => {
    const f = process.env.FOS_SAMPLE;
    if (!f) return;
    const r = parseFosAnswer(fs.readFileSync(f, 'latin1'));
    expect(r.answers.length).toBe(11);
    expect(r.answers.find(a => a.pnr === '193912312380')).toMatchObject({ skatteform: 'FA', tabell: '32', jamkning: { percent: 43 } });
    expect(r.answers.find(a => a.pnr === '199111022399')).toMatchObject({ tabell: '35', error: '9' });
    expect(r.answers.find(a => a.pnr === '192907304766').error).toBe('ag1');
  });
  it('avvisar fel sorts fil', () => {
    expect(() => parseFosAnswer('<Begaran/>')).toThrow();
  });

  it('kolumn efter ålder', () => {
    expect(wageColumnFor('19900101-0017', 2026)).toBe(1);
    expect(wageColumnFor('19600101-0000', 2026)).toBe(3); // fyllde 66 den 1 januari
    expect(wageColumnFor('19600102-0000', 2026)).toBe(1);
  });

  it('räknar fram ändringarna på de anställda', () => {
    const employees = [
      { id: 'e1', firstName: 'Bo', lastName: 'Ek', ssn: '19900101-0017', taxForm: 'a_skatt', taxTable: { tabellnr: '30', kolumn: 1, year: 2026 } },
      { id: 'e2', firstName: 'Sara', lastName: 'Lind', ssn: '19960410-2393', taxForm: 'a_skatt', taxTable: { tabellnr: '33', kolumn: 1, year: 2026 } },
      { id: 'e3', firstName: 'Gun', lastName: 'Ås', ssn: '19580101-0003', taxForm: 'a_skatt', taxTable: { tabellnr: '', kolumn: 1, year: 2026 } },
      { id: 'e5', firstName: 'Ung', lastName: 'Person', ssn: '20050101-0009', taxForm: 'a_skatt' },
    ];
    const ch = fosChanges(employees, parsed);
    expect(ch[0].patch.taxTable).toMatchObject({ tabellnr: '32', kolumn: 1 });
    expect(ch[0].patch.taxAdjustment).toEqual({ percent: 20, from: '2026-04-17', to: '2026-12-31' });
    expect(ch[0].changes.map(c => c.key)).toEqual(['table', 'adjustment']);
    expect(ch[1].changes).toEqual([]);
    expect(ch[2].patch.taxTable).toMatchObject({ tabellnr: '30', kolumn: 3 });
    expect(ch[3]).toMatchObject({ employeeId: null, problem: 'unknown' });
    expect(ch[4]).toMatchObject({ employeeId: 'e5', patch: null, problem: '10' });
  });
});

describe('jämkning i lönen', () => {
  it('gäller bara inom beslutets datum', () => {
    const adj = { percent: 20, from: '2026-04-17', to: '2026-12-31' };
    expect(activeTaxAdjustment(adj, '2026-04')).toBe(true);
    expect(activeTaxAdjustment(adj, '2026-03')).toBe(false);
    expect(activeTaxAdjustment(adj, '2027-01')).toBe(false);
  });
  it('skatten blir procentsatsen av lönen i stället för tabellen', () => {
    const employee = { salaryForm: 'timlon', hourlyRate: 200, taxForm: 'a_skatt', ssn: '19900101-0017', employmentType: 'anstalld', taxTable: { tabellnr: '32', kolumn: 1, year: 2026 }, taxAdjustment: { percent: 20, from: '2026-01-01', to: '2026-12-31' } };
    const c = computeEmployeePayroll(employee, { period: '2026-10', hoursWorked: 100 });
    expect(c.gross).toBe(20000);
    expect(c.tax).toBe(4000);
  });
});
