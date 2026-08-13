import jsPDF from 'jspdf';
import { computeEmployeePayroll } from './payrollCalculation';

// Samma princip som agiExport.js/vatDeclarationExport.js: ingen automatisk
// inlämning av kontrolluppgifter till Skatteverket — det kräver arbets-
// givarens egen BankID-signatur och vi har inte verifierat XML-formatet
// mot Skatteverkets specifikation. Det här är en årssammanställning per
// anställd (kontant bruttolön + avdragen skatt, summerat över alla
// bokförda lönekörningar för året) — redo att skriva av eller använda som
// underlag när man fyller i e-tjänsten.

/** De skattetabeller (år:tabellnr) som måste vara inlästa (se
 * preloadSkattetabell i skattetabell.js) innan summarizeAnnualPayrollByEmployee
 * kan räkna rätt — annars kastar lookupSkatteavdrag internt, fångas tyst av
 * computeEmployeePayroll, och skatten blir 0 kr utan någon synlig varning.
 * Samma mönster som PayrollRunDetail.jsx redan använder, bara för alla
 * bokförda körningar under ett helt år istället för en enskild körning. */
export function neededTaxTableKeysForYear(payrollRuns, year) {
  const runsThisYear = (payrollRuns || []).filter(
    r => (r.period || '').startsWith(year) && r.completedSteps?.includes('booked')
  );
  const keys = new Set();
  runsThisYear.forEach(run => {
    run.rows.forEach(row => {
      const snap = row.employeeSnapshot;
      if (!snap?.secondaryIncome && snap?.taxTable?.tabellnr) {
        keys.add(`${snap.taxTable.year}:${snap.taxTable.tabellnr}`);
      }
    });
  });
  return [...keys];
}

/**
 * Summerar alla BOKFÖRDA lönekörningar för `year` (t.ex. "2026"), grupperat
 * per anställd (via employeeId). Drafts/ej bokförda körningar räknas inte
 * med — en kontrolluppgift ska spegla vad som faktiskt betalats ut, inte
 * planerade men obokförda belopp.
 *
 * Bugkritiskt: kräver att neededTaxTableKeysForYear(...) redan preloadats
 * (preloadSkattetabell) INNAN denna anropas — annars faller varje anställds
 * skatteavdrag tyst tillbaka till 0 kr istället för att kasta ett synligt
 * fel, se computeEmployeePayroll.
 */
export function summarizeAnnualPayrollByEmployee(payrollRuns, year) {
  const runsThisYear = (payrollRuns || []).filter(
    r => (r.period || '').startsWith(year) && r.completedSteps?.includes('booked')
  );

  const byEmployee = {};
  runsThisYear.forEach(run => {
    run.rows.forEach(row => {
      const computed = computeEmployeePayroll(row.employeeSnapshot, row);
      const key = row.employeeId;
      if (!byEmployee[key]) {
        byEmployee[key] = {
          employeeId: key,
          firstName: row.employeeSnapshot.firstName,
          lastName: row.employeeSnapshot.lastName,
          ssn: row.employeeSnapshot.ssn,
          gross: 0,
          tax: 0,
          runCount: 0,
        };
      }
      byEmployee[key].gross += computed.gross;
      byEmployee[key].tax += computed.tax;
      byEmployee[key].runCount += 1;
      // Senaste körningens ögonblicksbild vinner för namn/personnummer,
      // om en anställds uppgifter skulle ha ändrats under året.
      byEmployee[key].firstName = row.employeeSnapshot.firstName;
      byEmployee[key].lastName = row.employeeSnapshot.lastName;
      byEmployee[key].ssn = row.employeeSnapshot.ssn;
    });
  });

  return Object.values(byEmployee).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '', 'sv'));
}

export function generateKuPdf({ company, year, employeeTotals }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`Kontrolluppgifter (KU) — inkomstår ${year}`, marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(company?.name || 'Företag', marginX, y);
  y += 16;
  if (company?.orgNr) { doc.text(`Org.nr: ${company.orgNr}`, marginX, y); y += 16; }
  y += 12;

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Namn', marginX, y);
  doc.text('Personnummer', marginX + 170, y);
  doc.text('Kontant bruttolön', 460, y, { align: 'right' });
  doc.text('Avdragen skatt', 548, y, { align: 'right' });
  y += 6;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 548, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  let sumGross = 0, sumTax = 0;
  employeeTotals.forEach(emp => {
    if (y > 760) { doc.addPage(); y = 56; }
    doc.text(`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—', marginX, y);
    doc.text(emp.ssn || '—', marginX + 170, y);
    doc.text(`${Math.round(emp.gross).toLocaleString('sv-SE')} kr`, 460, y, { align: 'right' });
    doc.text(`${Math.round(emp.tax).toLocaleString('sv-SE')} kr`, 548, y, { align: 'right' });
    sumGross += emp.gross;
    sumTax += emp.tax;
    y += 18;
  });

  y += 10;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 548, y);
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.text('Summa', marginX, y);
  doc.text(`${Math.round(sumGross).toLocaleString('sv-SE')} kr`, 460, y, { align: 'right' });
  doc.text(`${Math.round(sumTax).toLocaleString('sv-SE')} kr`, 548, y, { align: 'right' });

  y += 34;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Detta är en sammanställning från Bokix, inte Skatteverkets officiella blankett.', marginX, y);
  y += 14;
  doc.text('Baserat endast på bokförda lönekörningar för året. Kontrolluppgifter lämnas in på skatteverket.se med BankID, senast 31 januari.', marginX, y);

  return doc;
}

export function downloadKuPdf(args, filename) {
  const doc = generateKuPdf(args);
  doc.save(filename);
}
