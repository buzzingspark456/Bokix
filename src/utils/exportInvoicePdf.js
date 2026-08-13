import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Renders the given DOM node (the InvoiceDocument, in practice — the exact
 * same node the user is looking at in the live preview) to a downloadable
 * PDF. Because it captures the real rendered markup rather than redrawing
 * the invoice from scratch, the PDF can never visually diverge from the
 * on-screen preview.
 */
export async function exportInvoicePdf(node, filename = 'faktura.pdf') {
  if (!node) throw new Error('Inget fakturaunderlag att exportera.');

  const canvas = await html2canvas(node, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
  const imgData = canvas.toDataURL('image/png');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}
