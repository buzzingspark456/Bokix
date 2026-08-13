import jsPDF from 'jspdf';

// Samma försiktighetsprincip som vatDeclarationExport.js: ingen automatisk
// fil-inlämning mot Skatteverkets AGI-API byggs här. Dels för att den
// verkliga inlämningen kräver arbetsgivarens egen BankID-signering (går
// inte att automatisera bort), dels för att vi inte har verifierat
// filformatet mot Skatteverkets tekniska specifikation. Det här är istället
// en tydlig sammanställning — huvuduppgift (totaler) + individuppgift
// (per anställd, med personnummer) — som täcker exakt de fält
// arbetsgivardeklarationens e-tjänst frågar efter, redo att skriva av.

const fmtKr = (v) => `${Math.round(v || 0).toLocaleString('sv-SE')} kr`;

/**
 * `computedRows`: [{ row, computed }] från PayrollRunDetail — samma data
 * som redan används för att räkna ut lönekörningens totaler, så PDF:en
 * aldrig kan visa andra siffror än vad som redan syns på skärmen.
 */
export function generateAgiPdf({ company, period, computedRows, totals }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Arbetsgivardeklaration (AGI) — sammanställning', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(company?.name || 'Företag', marginX, y);
  y += 16;
  if (company?.orgNr) { doc.text(`Org.nr: ${company.orgNr}`, marginX, y); y += 16; }
  doc.text(`Redovisningsperiod: ${period}`, marginX, y);
  y += 28;

  // ── Huvuduppgift ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Huvuduppgift', marginX, y);
  y += 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const huvuduppgift = [
    ['Summa arbetsgivaravgifter', totals.employerFee],
    ['Summa avdragen skatt', totals.tax],
  ];
  huvuduppgift.forEach(([label, value]) => {
    doc.text(label, marginX, y);
    doc.text(fmtKr(value), 548, y, { align: 'right' });
    y += 20;
  });

  y += 16;

  // ── Individuppgift ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Individuppgift', marginX, y);
  y += 20;

  doc.setFontSize(10.5);
  doc.text('Namn', marginX, y);
  doc.text('Personnummer', marginX + 170, y);
  doc.text('Bruttolön', 420, y, { align: 'right' });
  doc.text('Avdragen skatt', 548, y, { align: 'right' });
  y += 6;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 548, y);
  y += 16;

  doc.setFont('helvetica', 'normal');
  computedRows.forEach(({ row, computed }) => {
    if (y > 760) { doc.addPage(); y = 56; }
    const emp = row.employeeSnapshot;
    doc.text(`${emp.firstName || ''} ${emp.lastName || ''}`.trim() || '—', marginX, y);
    doc.text(emp.ssn || '—', marginX + 170, y);
    doc.text(fmtKr(computed.gross), 420, y, { align: 'right' });
    doc.text(fmtKr(computed.tax), 548, y, { align: 'right' });
    y += 18;
  });

  y += 20;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Detta är en sammanställning från Bokix, inte Skatteverkets officiella blankett.', marginX, y);
  y += 14;
  doc.text('Deklarationen lämnas in på skatteverket.se med BankID — Bokix skickar inte in den åt dig.', marginX, y);

  return doc;
}

export function downloadAgiPdf(args, filename) {
  const doc = generateAgiPdf(args);
  doc.save(filename);
}
