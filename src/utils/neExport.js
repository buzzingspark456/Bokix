import jsPDF from 'jspdf';

// Samma försiktighetsprincip som agiExport.js/kuExport.js: NE-bilagans
// belopp matas in manuellt (se ne.js:s filkommentar för varför — ingen
// verifierad kontokoppling), så det här är bara en RENSKRIVNING av det
// användaren redan fyllt i, inte en ifylld kopia av Skatteverkets
// officiella blankett och inte en automatisk inlämning.

const fmtKr = (v) => `${Math.round(v || 0).toLocaleString('sv-SE')} kr`;

/**
 * `balanceRows`/`resultRows`: samma radlistor som NeFormColumn redan
 * renderar (row/label/amount), så PDF:en aldrig kan visa andra siffror
 * än vad som redan syns på skärmen.
 */
export function generateNePdf({ company, year, balanceRows, resultRows, equity, result, tax = null }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 48;
  let y = 56;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('NE-bilaga — sammanställning', marginX, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(company?.name || 'Företag', marginX, y);
  y += 16;
  if (company?.orgNr) { doc.text(`Org.nr/personnummer: ${company.orgNr}`, marginX, y); y += 16; }
  doc.text(`Inkomstår: ${year}`, marginX, y);
  y += 28;

  const table = (title, rows) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(title, marginX, y);
    y += 20;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    rows.filter(r => r.amount).forEach(r => {
      if (y > 760) { doc.addPage(); y = 56; }
      doc.text(`${r.row}  ${r.label}`, marginX, y, { maxWidth: 400 });
      doc.text(fmtKr(r.amount), 548, y, { align: 'right' });
      y += 18;
    });
    y += 12;
  };

  table('Balansräkning/räkenskapsschema', balanceRows);
  doc.setFont('helvetica', 'bold');
  doc.text('B10 Eget kapital (tillgångar − skulder)', marginX, y);
  doc.text(fmtKr(equity), 548, y, { align: 'right' });
  y += 28;

  table('Resultaträkning/räkenskapsschema', resultRows);
  doc.setFont('helvetica', 'bold');
  doc.text('R11 Bokfört resultat', marginX, y);
  doc.text(fmtKr(result), 548, y, { align: 'right' });
  y += 30;

  // Sida 2 (utils/neTax.js): bara rader med belopp, summorna i fetstil.
  if (tax) {
    if (y > 640) { doc.addPage(); y = 56; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Skattemässiga justeringar (sida 2)', marginX, y);
    y += 20;
    doc.setFontSize(10.5);
    tax.rows.filter(r => r.amount || r.sign === '=').forEach(r => {
      if (y > 760) { doc.addPage(); y = 56; }
      doc.setFont('helvetica', r.sign === '=' ? 'bold' : 'normal');
      const sign = r.sign === '=' ? '' : `(${r.sign}) `;
      doc.text(`${r.row}  ${sign}${r.label}`, marginX, y, { maxWidth: 400 });
      doc.text(fmtKr(r.amount), 548, y, { align: 'right' });
      y += 18;
    });
    doc.setFont('helvetica', 'bold');
    doc.text(tax.r48 > 0 ? 'R48 Underskott' : 'R47 Överskott', marginX, y);
    doc.text(fmtKr(tax.r48 > 0 ? tax.r48 : tax.r47), 548, y, { align: 'right' });
    y += 30;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text('Detta är en sammanställning från Bokix av dina egna ifyllda uppgifter, inte Skatteverkets officiella blankett.', marginX, y);
  y += 14;
  doc.text('Fyll i själva NE-bilagan hos skatteverket.se — Bokix skickar inte in den åt dig.', marginX, y);

  return doc;
}

export function downloadNePdf(args, filename) {
  const doc = generateNePdf(args);
  doc.save(filename);
}
