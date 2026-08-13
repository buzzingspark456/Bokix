import jsPDF from 'jspdf';

const fmt = (v) => new Intl.NumberFormat('sv-SE').format(Math.round(v || 0));

/** Genererar ett enkelt, tydligt lönebesked som PDF — Bokix eget format,
 * inte en myndighetsmall, så inget officiellt schema att avvika från. */
export function generatePayslipPdf({ employee, computed, period }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Lönebesked', marginX, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${employee.firstName} ${employee.lastName}`, marginX, y); y += 16;
  doc.text(`Personnummer: ${employee.ssn || '—'}`, marginX, y); y += 16;
  doc.text(`Period: ${period}`, marginX, y); y += 28;

  const rows = [
    ['Bruttolön', computed.gross],
    ['Skatteavdrag', -computed.tax],
    ['Nettolön (utbetalas)', computed.net],
  ];
  doc.setFont('helvetica', 'bold');
  rows.forEach(([label, val], i) => {
    doc.setFont('helvetica', i === rows.length - 1 ? 'bold' : 'normal');
    doc.text(label, marginX, y);
    doc.text(`${fmt(val)} kr`, 548, y, { align: 'right' });
    y += 20;
  });

  y += 14;
  doc.setLineWidth(0.5);
  doc.line(marginX, y, 548, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Arbetsgivarens kostnader (visas inte som en del av utbetalningen):', marginX, y); y += 16;
  doc.text(`Arbetsgivaravgifter: ${fmt(computed.employerFee)} kr`, marginX, y); y += 14;
  doc.text(`Semesteravsättning: ${fmt(computed.vacationProvision)} kr`, marginX, y); y += 14;
  doc.text(`Total arbetsgivarkostnad: ${fmt(computed.totalCost)} kr`, marginX, y);

  return doc;
}
