import jsPDF from 'jspdf';

// Underlag för Inkomstdeklaration 2: räkenskapsschemat (INK2R) och de
// skattemässiga justeringarna (INK2S) som de står i Bokix. Det är inte
// Skatteverkets blankett, och det står på PDF:en. Själva deklarationen
// lämnas med SRU-filerna i Skatteverkets e-tjänst.

const fmtKr = (v) => `${Math.round(v || 0).toLocaleString('sv-SE').replace(/ /g, ' ')} kr`;

export function generateInk2Pdf({ company, fyLabel, ink2r, resultRows, ink2s }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const x = 48;
  const right = 548;
  let y = 56;
  const ensure = (h = 18) => { if (y + h > 790) { doc.addPage(); y = 56; } };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Underlag för Inkomstdeklaration 2', x, y);
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(company?.name || 'Företag', x, y); y += 16;
  if (company?.orgNr) { doc.text(`Org.nr: ${company.orgNr}`, x, y); y += 16; }
  doc.text(`Räkenskapsår: ${fyLabel}`, x, y);
  y += 26;

  const heading = (title) => {
    ensure(40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, x, y);
    y += 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
  };
  const line = (row, label, amount, bold = false) => {
    ensure();
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(`${row}  ${label}`, x, y, { maxWidth: 400 });
    doc.text(fmtKr(amount), right, y, { align: 'right' });
    y += 17;
  };

  heading('Balansräkning (INK2R)');
  (ink2r?.rows || []).forEach(r => line(r.row, r.label, r.amount));
  y += 10;

  heading('Resultaträkning (INK2R)');
  (resultRows || []).filter(r => r.amount).forEach(r => line(r.row, r.label, r.amount, r.row === '3.26' || r.row === '3.27'));
  y += 10;

  if (ink2s) {
    heading('Skattemässiga justeringar (INK2S)');
    if (ink2s.arsResultatVinst) line('4.1', 'Årets resultat, vinst', ink2s.arsResultatVinst);
    if (ink2s.arsResultatForlust) line('4.2', 'Årets resultat, förlust', ink2s.arsResultatForlust);
    ink2s.rows.filter(r => r.value).forEach(r => line(r.row, r.label, r.value));
    if (ink2s.overskott) line('4.15', 'Överskott (förs till 1.1)', ink2s.overskott, true);
    if (ink2s.underskott) line('4.16', 'Underskott (förs till 1.2)', ink2s.underskott, true);
    y += 10;
  }

  ensure(40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Underlag från Bokix, inte Skatteverkets officiella blankett. Deklarationen lämnas med SRU-filerna hos Skatteverket.', x, y, { maxWidth: 500 });
  return doc;
}

/** Öppnar PDF:en i en ny flik för förhandsvisning. */
export function previewInk2Pdf(args) {
  const doc = generateInk2Pdf(args);
  const url = doc.output('bloburl');
  const win = window.open(url, '_blank');
  if (!win) doc.save(`Underlag-INK2-${String(args.fyLabel).replace('/', '-')}.pdf`);
}
