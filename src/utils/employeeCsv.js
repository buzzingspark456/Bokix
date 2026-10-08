// CSV-import och export av anställda, t.ex. vid byte från ett annat
// lönesystem med många anställda. Samma format som övriga register
// (csvRegister.js: semikolon, BOM, svenska rubriker i valfri ordning).
// Samma kontroller som formuläret i EmployeeForm.jsx: giltigt personnummer,
// anställningsdatum, folkbokföringskommun och skattetabell. Skattetabellen
// gissas inte: finns bara en tabell i kommunen används den, annars krävs
// kolumnen Skattetabell eller Medlem i Svenska kyrkan.

import { rowsToCsv, parseCsv, rowsToObjects, detectDelimiter } from './csvRegister';
import { SWEDISH_MUNICIPALITIES } from './kommuner';
import { suggestTaxTables } from './kommunSkattetabell';
import { validatePersonnummer, toTwelveDigits } from './personnummer';
import { isValidIban } from './salaryPaymentFile';
import { MIN_VACATION_DAYS } from './payrollConfig';

const EMPLOYEE_COLUMNS = [
  ['firstName', 'Förnamn'], ['lastName', 'Efternamn'], ['ssn', 'Personnummer'],
  ['email', 'E-post'], ['phone', 'Telefon'], ['address', 'Adress'], ['postalCode', 'Postnummer'], ['city', 'Ort'],
  ['employmentType', 'Anställningsform'], ['startDate', 'Anställd från'], ['endDate', 'Anställd till'],
  ['employmentRate', 'Sysselsättningsgrad (%)'], ['hoursPerWeek', 'Timmar per vecka'],
  ['salaryForm', 'Löneform'], ['monthlySalary', 'Månadslön'], ['hourlyRate', 'Timlön'],
  ['taxForm', 'Skatteform'], ['municipality', 'Kommun'], ['churchMember', 'Medlem i Svenska kyrkan'],
  ['taxTableNr', 'Skattetabell'], ['taxColumn', 'Kolumn'], ['secondaryIncome', 'Sidoinkomst'],
  ['vacationDays', 'Semesterdagar'], ['clearingNumber', 'Clearingnummer'], ['accountNumber', 'Kontonummer'],
  ['iban', 'IBAN'], ['bic', 'BIC'],
];

const EMPLOYMENT_TYPES = { 'anställd': 'anstalld', anstalld: 'anstalld', 'företagsledare': 'foretagsledare', foretagsledare: 'foretagsledare', styrelseledamot: 'styrelseledamot' };
const EMPLOYMENT_TYPE_LABELS = { anstalld: 'Anställd', foretagsledare: 'Företagsledare', styrelseledamot: 'Styrelseledamot' };
const SALARY_FORMS = { 'månadslön': 'manadslon', manadslon: 'manadslon', 'timlön': 'timlon', timlon: 'timlon' };
const SALARY_FORM_LABELS = { manadslon: 'Månadslön', timlon: 'Timlön' };
const TAX_FORMS = { 'a-skatt': 'a_skatt', a_skatt: 'a_skatt', 'f-skatt': 'f_skatt', f_skatt: 'f_skatt', 'fa-skatt': 'fa_skatt', fa_skatt: 'fa_skatt', 'ej verifierad': 'ej_verifierad', ej_verifierad: 'ej_verifierad' };
const TAX_FORM_LABELS = { a_skatt: 'A-skatt', f_skatt: 'F-skatt', fa_skatt: 'FA-skatt', ej_verifierad: 'Ej verifierad' };

const yesNo = (v) => {
  const s = String(v || '').trim().toLowerCase();
  if (['ja', 'j', 'yes', 'y', 'x', '1', 'true'].includes(s)) return true;
  if (['nej', 'n', 'no', '0', 'false'].includes(s)) return false;
  return null;
};
// "25 000,50" / "25000.5" / "25 000 kr" → 25000.5. Tomt → ''. Ogiltigt → NaN.
const num = (v) => {
  const s = String(v || '').replace(/kr|%|\s| /gi, '').replace(',', '.');
  if (s === '') return '';
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s).getTime());
const orDefault = (v, d) => (v === '' || Number.isNaN(v) ? d : v);

export function employeesToCsv(list) {
  return rowsToCsv(EMPLOYEE_COLUMNS.map(([, h]) => h), (list || []).map(e => EMPLOYEE_COLUMNS.map(([key]) => {
    switch (key) {
      case 'employmentType': return EMPLOYMENT_TYPE_LABELS[e.employmentType] || '';
      case 'salaryForm': return SALARY_FORM_LABELS[e.salaryForm] || '';
      case 'taxForm': return TAX_FORM_LABELS[e.taxForm] || '';
      case 'taxTableNr': return e.taxTable?.tabellnr || '';
      case 'taxColumn': return e.taxTable?.kolumn || '';
      case 'churchMember': return '';
      case 'secondaryIncome': return e.secondaryIncome ? 'Ja' : 'Nej';
      default: return e[key] ?? '';
    }
  })));
}

/** Mall med rubrikerna och en exempelrad, att fylla i Excel. */
export function employeeTemplateCsv() {
  const example = {
    firstName: 'Anna', lastName: 'Andersson', ssn: '19900101-0017', email: 'anna@exempel.se', phone: '070-123 45 67',
    address: 'Storgatan 1', postalCode: '931 30', city: 'Skellefteå', employmentType: 'Anställd', startDate: '2026-01-01',
    endDate: '', employmentRate: 100, hoursPerWeek: 40, salaryForm: 'Timlön', monthlySalary: '', hourlyRate: 165,
    taxForm: 'A-skatt', municipality: 'Skellefteå', churchMember: 'Nej', taxTableNr: '', taxColumn: 1,
    secondaryIncome: 'Nej', vacationDays: 25, clearingNumber: '8327', accountNumber: '1234567', iban: '', bic: '',
  };
  return rowsToCsv(EMPLOYEE_COLUMNS.map(([, h]) => h), [EMPLOYEE_COLUMNS.map(([key]) => example[key])]);
}

/**
 * Tolkar en CSV med anställda. En rad per anställd:
 * { line, name, employee, errors }, där `errors` är svenska felmeddelanden.
 * Bara rader utan fel ska importeras.
 */
export function csvToEmployees(text, { currentYear = new Date().getFullYear() } = {}) {
  const objs = rowsToObjects(parseCsv(text, detectDelimiter(text)), EMPLOYEE_COLUMNS);
  const kommunByLower = new Map(SWEDISH_MUNICIPALITIES.map(k => [k.toLowerCase(), k]));
  return objs.map((o, i) => {
    const errors = [];
    // Skattetabell som inte går att avgöra ur filen stoppar inte importen:
    // den hämtas från Skatteverket (Anställda → Hämta skattetabeller).
    let needsTaxTable = false;
    const ssn12 = toTwelveDigits(o.ssn, currentYear);
    const ssn = ssn12 ? `${ssn12.slice(0, 8)}-${ssn12.slice(8)}` : o.ssn;
    if (!o.firstName) errors.push('Förnamn saknas.');
    if (!o.lastName) errors.push('Efternamn saknas.');
    const pnr = validatePersonnummer(ssn);
    if (!pnr.valid) errors.push(pnr.error);
    if (!isDate(o.startDate)) errors.push('Anställd från ska vara ett datum (ÅÅÅÅ-MM-DD).');
    if (o.endDate && !isDate(o.endDate)) errors.push('Anställd till ska vara ett datum (ÅÅÅÅ-MM-DD).');

    const kommun = kommunByLower.get(o.municipality.toLowerCase().replace(/\s+kommun$/, '').trim());
    if (!kommun) errors.push(o.municipality ? `Okänd kommun: ${o.municipality}.` : 'Kommun saknas.');

    // Skattetabell: angiven, annars ur kommunen när det bara finns ett svar.
    let tabellnr = '';
    const given = num(o.taxTableNr);
    if (given !== '') {
      if (!Number.isInteger(given) || given < 29 || given > 42) errors.push(`Skattetabell ${o.taxTableNr} finns inte.`);
      else tabellnr = String(given);
    } else if (kommun) {
      const s = suggestTaxTables(kommun);
      const member = yesNo(o.churchMember);
      const options = !s ? [] : member === true ? s.medlem : member === false ? s.ejMedlem : [...new Set([...s.ejMedlem, ...s.medlem])];
      if (options.length === 1) tabellnr = String(options[0]);
      else needsTaxTable = true;
    }

    // Kolumn 1 gäller under 66 år. Äldre har en annan kolumn, den gissas inte.
    let kolumn = num(o.taxColumn);
    const birthYear = ssn12 ? Number(ssn12.slice(0, 4)) : null;
    if (kolumn === '') {
      if (birthYear && currentYear - birthYear >= 66) errors.push('Fyll i Kolumn, den anställda är 66 år eller äldre.');
      kolumn = 1;
    } else if (![1, 2, 3, 4, 5, 6].includes(kolumn)) errors.push('Kolumn ska vara 1 till 6.');

    const employmentType = o.employmentType ? EMPLOYMENT_TYPES[o.employmentType.toLowerCase()] : 'anstalld';
    if (!employmentType) errors.push(`Okänd anställningsform: ${o.employmentType}.`);
    const taxForm = o.taxForm ? TAX_FORMS[o.taxForm.toLowerCase()] : 'a_skatt';
    if (!taxForm) errors.push(`Okänd skatteform: ${o.taxForm}.`);
    const monthlySalary = num(o.monthlySalary);
    const hourlyRate = num(o.hourlyRate);
    if (Number.isNaN(monthlySalary)) errors.push('Månadslön är inte ett belopp.');
    if (Number.isNaN(hourlyRate)) errors.push('Timlön är inte ett belopp.');
    let salaryForm = o.salaryForm ? SALARY_FORMS[o.salaryForm.toLowerCase()] : (hourlyRate && !monthlySalary ? 'timlon' : 'manadslon');
    if (!salaryForm) { errors.push(`Okänd löneform: ${o.salaryForm}.`); salaryForm = 'manadslon'; }

    const vacationDays = num(o.vacationDays);
    if (vacationDays !== '' && (Number.isNaN(vacationDays) || vacationDays < MIN_VACATION_DAYS)) errors.push(`Minst ${MIN_VACATION_DAYS} semesterdagar krävs enligt semesterlagen.`);
    const iban = o.iban.replace(/\s/g, '').toUpperCase();
    if (iban && !isValidIban(iban)) errors.push('IBAN ser inte korrekt ut.');

    const employee = {
      firstName: o.firstName, lastName: o.lastName, ssn,
      email: o.email, phone: o.phone, address: o.address, postalCode: o.postalCode, city: o.city,
      employmentType: employmentType || 'anstalld', startDate: o.startDate, endDate: o.endDate,
      employmentRate: orDefault(num(o.employmentRate), 100),
      hoursPerWeek: orDefault(num(o.hoursPerWeek), 40),
      daysPerWeek: 5,
      salaryForm, monthlySalary: orDefault(monthlySalary, ''), hourlyRate: orDefault(hourlyRate, ''),
      taxForm: taxForm || 'a_skatt', secondaryIncome: yesNo(o.secondaryIncome) === true,
      municipality: kommun || '', taxTableMode: 'manual', taxTable: { tabellnr, kolumn, year: currentYear },
      vacationRule: 'procentregeln', vacationDays: orDefault(vacationDays, 25), savedVacationDays: 0,
      costCenter: '', projectId: '',
      clearingNumber: o.clearingNumber.replace(/\D/g, ''), accountNumber: o.accountNumber.replace(/\D/g, ''), iban, bic: o.bic.toUpperCase(),
      active: true,
    };
    // Fält där filen var tom och ett standardvärde fylldes i. Vid uppdatering
    // av en befintlig anställd ska de inte skriva över det som redan finns.
    const defaulted = ['employmentType', 'taxForm', 'salaryForm', 'employmentRate', 'hoursPerWeek', 'secondaryIncome', 'vacationDays']
      .filter(k => !String(o[k] || '').trim());
    return { line: i + 2, defaulted, needsTaxTable, name: `${o.firstName} ${o.lastName}`.trim() || ssn || `Rad ${i + 2}`, employee, errors };
  });
}

/**
 * Lägger in importerade anställda. Finns personnumret redan uppdateras den
 * anställda (id och uppgifter som inte finns i filen behålls), annars läggs
 * en ny till. Returnerar { list, added, updated }.
 */
const NOT_IN_FILE = ['daysPerWeek', 'taxTableMode', 'vacationRule', 'savedVacationDays', 'costCenter', 'projectId', 'active'];

export function mergeImportedEmployees(existing, imported, now = Date.now()) {
  // imported: rader från csvToEmployees (utan fel).
  const list = [...(existing || [])];
  let added = 0, updated = 0;
  const key = (ssn) => String(ssn || '').replace(/\D/g, '');
  imported.forEach(({ employee: emp, defaulted = [], needsTaxTable = false }, i) => {
    const idx = list.findIndex(e => key(e.ssn) && key(e.ssn) === key(emp.ssn));
    if (idx === -1) {
      list.push({ ...emp, id: `emp_${now}_${i}` });
      added++;
    } else {
      // Tomma celler och fält som inte finns i filen ska inte sudda ut det
      // som redan är ifyllt på den anställda.
      const patch = Object.fromEntries(Object.entries(emp).filter(([k, v]) => v !== '' && !NOT_IN_FILE.includes(k) && !defaulted.includes(k) && !(needsTaxTable && k === 'taxTable')));
      list[idx] = { ...list[idx], ...patch, id: list[idx].id };
      updated++;
    }
  });
  return { list, added, updated };
}
